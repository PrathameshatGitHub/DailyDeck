import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

type RecipientInput = { email: string; name?: string; company?: string };

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const body = await req.json();
    const { subject, content, recipients, user_id } = body;

    if (!subject || !content || !recipients || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || '' } }
    });

    // 1. Create Campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .insert({ subject, body: content, user_id, status: 'in_progress' })
      .select()
      .single();

    if (campaignError) throw campaignError;

    // 2. Parse recipients — supports both legacy string and new object array
    let recipientList: RecipientInput[] = [];

    if (typeof recipients === 'string') {
      // Legacy: comma / newline separated emails
      recipientList = recipients
        .split(/[\n,]+/)
        .map((e: string) => e.trim())
        .filter((e: string) => e.length > 0 && e.includes('@'))
        .map((email: string) => ({ email }));
    } else if (Array.isArray(recipients)) {
      // New: array of { email, name?, company? } from CSV import
      recipientList = (recipients as RecipientInput[])
        .filter((r) => r.email && r.email.includes('@'))
        .map((r) => ({
          email:   r.email.trim(),
          name:    r.name?.trim()    || undefined,
          company: r.company?.trim() || undefined,
        }));
    }

    if (recipientList.length === 0) {
      return NextResponse.json({ error: 'No valid email addresses found' }, { status: 400 });
    }

    // 3. Bulk Insert into Queue (with name + company)
    const queueData = recipientList.map((r) => ({
      campaign_id:       campaign.id,
      user_id,
      recipient_email:   r.email,
      recipient_name:    r.name    ?? null,
      recipient_company: r.company ?? null,
      status:            'pending',
    }));

    const { error: queueError } = await supabase.from('email_queue').insert(queueData);
    if (queueError) throw queueError;

    return NextResponse.json({
      success:           true,
      campaign_id:       campaign.id,
      total_recipients:  recipientList.length,
    });

  } catch (error: any) {
    console.error('Create campaign error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
