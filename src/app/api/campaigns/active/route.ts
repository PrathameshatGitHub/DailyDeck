import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// GET /api/campaigns/active — find any in-progress campaign for the authenticated user
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch recent campaigns with status 'in_progress'
    const { data: campaigns, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('id, subject, body, status, created_at')
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(10);

    if (campaignError) throw campaignError;

    const inProgressList: any[] = [];
    let activeCampaign: any = null;

    if (campaigns && campaigns.length > 0) {
      for (const camp of campaigns) {
        // Check queue counts for this campaign
        const { count: pendingCount } = await supabase
          .from('email_queue')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', camp.id)
          .eq('status', 'pending');

        const { count: totalCount } = await supabase
          .from('email_queue')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', camp.id);

        const { count: sentCount } = await supabase
          .from('email_queue')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', camp.id)
          .eq('status', 'sent');

        const { count: failedCount } = await supabase
          .from('email_queue')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', camp.id)
          .eq('status', 'failed');

        // If no pending emails left, mark campaign completed in DB
        if ((pendingCount ?? 0) === 0 && (totalCount ?? 0) > 0) {
          await supabase
            .from('email_campaigns')
            .update({ status: 'completed' })
            .eq('id', camp.id);
        } else if ((pendingCount ?? 0) > 0) {
          const item = {
            ...camp,
            total: totalCount ?? 0,
            pending: pendingCount ?? 0,
            sent: sentCount ?? 0,
            failed: failedCount ?? 0,
          };
          inProgressList.push(item);
          if (!activeCampaign) {
            activeCampaign = item;
          }
        }
      }
    }

    return NextResponse.json({
      has_active: !!activeCampaign,
      active_campaign: activeCampaign,
      in_progress_campaigns: inProgressList,
    });
  } catch (error: any) {
    console.error('Active campaign fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/campaigns/active — mark a campaign as completed/archived
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const { campaign_id } = await req.json();
    if (!campaign_id) {
      return NextResponse.json({ error: 'Missing campaign_id' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { error } = await supabase
      .from('email_campaigns')
      .update({ status: 'completed' })
      .eq('id', campaign_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Complete campaign error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
