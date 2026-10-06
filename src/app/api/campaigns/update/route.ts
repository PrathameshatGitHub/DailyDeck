import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const body = await req.json();
    const { campaign_id, subject, content } = body;

    if (!campaign_id) {
      return NextResponse.json({ error: 'Missing campaign_id' }, { status: 400 });
    }
    if (subject === undefined && content === undefined) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || '' } }
    });

    const updatePayload: Record<string, string> = {};
    if (subject !== undefined) updatePayload.subject = subject;
    if (content !== undefined) updatePayload.body = content;

    const { data, error } = await supabase
      .from('email_campaigns')
      .update(updatePayload)
      .eq('id', campaign_id)
      .select('id, subject, body')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      campaign: data,
    });
  } catch (error: any) {
    console.error('Update campaign error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
