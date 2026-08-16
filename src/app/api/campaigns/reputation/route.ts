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

    // Get 30-day sending history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: history, error: historyError } = await supabase
      .from('email_queue')
      .select('id, status, sent_at, error_message')
      .eq('campaign_id', campaign_id)
      .gte('sent_at', thirtyDaysAgo.toISOString())
      .order('sent_at', { ascending: false });

    if (historyError) throw historyError;

    // Calculate reputation metrics
    const totalSent = history?.filter(h => h.status === 'sent').length || 0;
    const totalFailed = history?.filter(h => h.status === 'failed').length || 0;
    const totalBounced = history?.filter(h => h.error_message?.toLowerCase().includes('bounce')).length || 0;
    const totalProcessed = totalSent + totalFailed;

    const successRate = totalProcessed > 0 ? (totalSent / totalProcessed) * 100 : 100;
    const bounceRate = totalProcessed > 0 ? (totalBounced / totalProcessed) * 100 : 0;

    // Calculate daily sending patterns
    const dailyStats: Record<string, { sent: number; failed: number }> = {};
    history?.forEach(h => {
      const date = h.sent_at?.split('T')[0] || new Date().toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { sent: 0, failed: 0 };
      }
      if (h.status === 'sent') dailyStats[date].sent++;
      if (h.status === 'failed') dailyStats[date].failed++;
    });

    // Account age calculation
    const firstSend = history?.[history.length - 1]?.sent_at;
    const accountAgeDays = firstSend 
      ? Math.ceil((new Date().getTime() - new Date(firstSend).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Determine reputation score
    let reputationScore = 100;
    if (bounceRate > 10) reputationScore -= 30;
    if (bounceRate > 5) reputationScore -= 15;
    if (successRate < 90) reputationScore -= 20;
    if (successRate < 80) reputationScore -= 20;
    if (accountAgeDays < 7) reputationScore -= 10;
    if (accountAgeDays < 30) reputationScore -= 10;
    
    reputationScore = Math.max(0, reputationScore);

    // Get current daily limit based on warm-up
    let currentLimit = 50;
    if (accountAgeDays >= 30 && totalSent >= 1000) currentLimit = 400;
    else if (accountAgeDays >= 14 && totalSent >= 300) currentLimit = 200;
    else if (accountAgeDays >= 7 && totalSent >= 100) currentLimit = 100;
    else if (accountAgeDays >= 3 && totalSent >= 30) currentLimit = 75;

    return NextResponse.json({
      reputation: {
        score: reputationScore,
        status: reputationScore >= 80 ? 'excellent' : reputationScore >= 60 ? 'good' : reputationScore >= 40 ? 'fair' : 'poor'
      },
      metrics: {
        totalSent,
        totalFailed,
        totalBounced,
        totalProcessed,
        successRate: Math.round(successRate),
        bounceRate: Math.round(bounceRate),
        accountAgeDays,
        currentLimit
      },
      dailyStats: Object.entries(dailyStats)
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 7)
    });

  } catch (error: any) {
    console.error('Reputation check error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
