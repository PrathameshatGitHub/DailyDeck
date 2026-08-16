import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const { searchParams } = new URL(req.url);
    const campaign_id = searchParams.get('campaign_id');

    if (!campaign_id) {
      return NextResponse.json({ error: 'Missing campaign_id' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || '' } }
    });

    // 1. Get campaign status
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('status, subject')
      .eq('id', campaign_id)
      .single();

    if (campaignError) throw campaignError;

    // 2. Get full queue with recipient data (name + company included)
    const { data: queue, error: queueError } = await supabase
      .from('email_queue')
      .select('status, recipient_email, recipient_name, recipient_company')
      .eq('campaign_id', campaign_id);

    if (queueError) throw queueError;

    let pending = 0, sent = 0, failed = 0;
    const pending_recipients: any[] = [];
    const sent_recipients:    any[] = [];
    const failed_recipients:  any[] = [];

    queue.forEach((q: any) => {
      const card = {
        email:   q.recipient_email,
        name:    q.recipient_name    || undefined,
        company: q.recipient_company || undefined,
        status:  q.status,
      };

      if (q.status === 'pending') { pending++; pending_recipients.push(card); }
      if (q.status === 'sent')    { sent++;    sent_recipients.push(card);    }
      if (q.status === 'failed')  { failed++;  failed_recipients.push(card);  }
    });

    return NextResponse.json({
      campaign_status:   campaign.status,
      subject:           campaign.subject,
      total:             queue.length,
      pending,
      sent,
      failed,
      // Full card objects for the recipient grid
      pending_recipients,
      sent_recipients,
      failed_recipients,
      // Legacy string arrays (kept for backward compat)
      pending_emails: pending_recipients.map((r: any) => r.email),
      sent_emails:    sent_recipients.map((r: any)    => r.email),
      failed_emails:  failed_recipients.map((r: any)  => r.email),
    });

  } catch (error: any) {
    console.error('Status fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
