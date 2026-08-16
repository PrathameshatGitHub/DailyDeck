import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// GET /api/config — load saved config for authenticated user
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || '' } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_smtp_config')
      .select('smtp_email, smtp_password, smtp_sender_name, sending_speed, campaign_subject, campaign_body')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ config: data || null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/config — upsert config for authenticated user
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || '' } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      smtp_email,
      smtp_password,
      smtp_sender_name,
      sending_speed,
      campaign_subject,
      campaign_body,
    } = body;

    const { error } = await supabase
      .from('user_smtp_config')
      .upsert(
        {
          user_id: user.id,
          smtp_email:        smtp_email        ?? null,
          smtp_password:     smtp_password     ?? null,
          smtp_sender_name:  smtp_sender_name  ?? null,
          sending_speed:     sending_speed     ?? 'medium',
          campaign_subject:  campaign_subject  ?? null,
          campaign_body:     campaign_body     ?? null,
          updated_at:        new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
