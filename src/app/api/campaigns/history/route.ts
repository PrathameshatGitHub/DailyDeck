import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || '' } }
    });

    // Fetch all sent emails for the current user
    const { data: sentQueue, error } = await supabase
      .from('email_queue')
      .select('recipient_email, sent_at')
      .eq('status', 'sent')
      .order('sent_at', { ascending: false });

    if (error) throw error;

    // Group emails by calendar date (local day context)
    const groupsMap: { [key: string]: { formattedDate: string; emails: string[] } } = {};

    sentQueue?.forEach((item: any) => {
      if (!item.sent_at) return;
      
      const dateObj = new Date(item.sent_at);
      // Grouping key: YYYY-MM-DD
      const dateKey = dateObj.toISOString().split('T')[0];
      
      if (!groupsMap[dateKey]) {
        // Formatted human-readable date, e.g. "Wednesday, July 29, 2026"
        const formattedDate = dateObj.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        groupsMap[dateKey] = {
          formattedDate,
          emails: []
        };
      }
      
      // Prevent duplicates in the same day if user sent multiple times to the same email
      if (!groupsMap[dateKey].emails.includes(item.recipient_email)) {
        groupsMap[dateKey].emails.push(item.recipient_email);
      }
    });

    // Convert map to array and sort by date descending
    const history = Object.keys(groupsMap)
      .sort((a, b) => b.localeCompare(a))
      .map((dateKey) => ({
        dateKey,
        formattedDate: groupsMap[dateKey].formattedDate,
        emails: groupsMap[dateKey].emails,
        count: groupsMap[dateKey].emails.length
      }));

    return NextResponse.json({ history });

  } catch (error: any) {
    console.error('History fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
