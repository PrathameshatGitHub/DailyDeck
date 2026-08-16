import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Spam trigger words to detect
const SPAM_TRIGGER_WORDS = [
  'free', 'winner', 'winning', 'won', 'congratulations', 'urgent', 'act now',
  'limited time', 'exclusive deal', 'amazing', 'incredible', 'unbelievable',
  'risk-free', 'guarantee', 'no obligation', 'click here', 'subscribe now',
  'call now', 'don\'t delete', 'special promotion', 'you have been selected',
  'apply now', 'credit card', 'no cost', 'no fees', '100% free', 'cash bonus',
  'prize', 'award', 'bonus', 'earn money', 'make money', 'work from home',
  'double your', 'increase your', 'save big', 'save up to', 'lowest price',
  'best price', 'cheap', 'discount', 'offer expires', 'act immediately',
  'order now', 'get it now', 'limited supply', 'limited quantity', 'while supplies last'
];

// Check content for spam triggers
function detectSpamTriggers(text: string): { score: number; triggers: string[] } {
  const lowerText = text.toLowerCase();
  const triggers: string[] = [];
  
  for (const word of SPAM_TRIGGER_WORDS) {
    if (lowerText.includes(word)) {
      triggers.push(word);
    }
  }
  
  // Calculate spam score based on trigger count
  const score = Math.min(triggers.length * 10, 100);
  return { score, triggers };
}

// Check content quality
function analyzeContentQuality(subject: string, body: string): {
  capsRatio: number;
  textToImageRatio: number;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check excessive caps in subject
  const subjectCaps = (subject.match(/[A-Z]/g) || []).length;
  const subjectRatio = subject.length > 0 ? subjectCaps / subject.length : 0;
  if (subjectRatio > 0.5) {
    issues.push('Subject has too many capital letters');
  }
  
  // Check excessive caps in body
  const bodyCaps = (body.match(/[A-Z]/g) || []).length;
  const bodyRatio = body.length > 0 ? bodyCaps / body.length : 0;
  if (bodyRatio > 0.3) {
    issues.push('Body has too many capital letters');
  }
  
  // Check for excessive exclamation marks
  const exclamations = (body.match(/!/g) || []).length;
  if (exclamations > 3) {
    issues.push('Too many exclamation marks');
  }
  
  return {
    capsRatio: Math.max(subjectRatio, bodyRatio),
    textToImageRatio: 1, // No images in plain text
    issues
  };
}

// ── Personalize a template string with recipient data ─────────────────────
function personalize(
  template: string,
  name: string | null,
  company: string | null,
  email: string,
  senderEmail: string
): string {
  // Fallback: use the part before @ as name if no name provided
  const resolvedName    = (name && name.trim())    ? name.trim()    : email.split('@')[0];
  const resolvedCompany = (company && company.trim()) ? company.trim() : '';

  // Add more natural variations to reduce spam detection
  let result = template
    .replace(/\{name\}/gi,    resolvedName)
    .replace(/\{company\}/gi, resolvedCompany);

  // Add random small variations to make each email unique
  const variations = [
    '',
    '\n',
    '  ',
    '\n\n',
  ];
  const randomVariation = variations[Math.floor(Math.random() * variations.length)];

  // Add CAN-SPAM compliance footer
  const footer = `\n\n--\nTo unsubscribe from future emails, reply with "unsubscribe" in the subject line.\nThis message was sent by ${senderEmail || 'the sender'}.`;
  
  return result + randomVariation + footer;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const body = await req.json();
    const { campaign_id, smtp_user, smtp_pass, smtp_sender_name, attachments = [], delay_ms = 3000 } = body;

    if (!campaign_id) {
      return NextResponse.json({ error: 'Missing campaign_id' }, { status: 400 });
    }
    if (!smtp_user || !smtp_pass) {
      return NextResponse.json({ error: 'Missing SMTP credentials' }, { status: 400 });
    }

    // Daily sending limit check with warm-up schedule
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || '' } }
    });

    // Calculate warm-up limit based on account sending history
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get total emails sent in last 30 days
    const { data: monthlyStats, error: monthlyError } = await supabase
      .from('email_queue')
      .select('id, sent_at')
      .eq('status', 'sent')
      .gte('sent_at', thirtyDaysAgo.toISOString());

    // Calculate warm-up limit based on sending history
    let DAILY_LIMIT = 50; // Starting limit for new accounts
    if (monthlyStats && monthlyStats.length > 0) {
      const daysActive = Math.ceil((new Date().getTime() - new Date(monthlyStats[0].sent_at).getTime()) / (1000 * 60 * 60 * 24));
      const totalSent = monthlyStats.length;
      
      // Gradual warm-up schedule
      if (daysActive >= 30 && totalSent >= 1000) {
        DAILY_LIMIT = 400; // Established accounts
      } else if (daysActive >= 14 && totalSent >= 300) {
        DAILY_LIMIT = 200; // 2+ weeks
      } else if (daysActive >= 7 && totalSent >= 100) {
        DAILY_LIMIT = 100; // 1+ week
      } else if (daysActive >= 3 && totalSent >= 30) {
        DAILY_LIMIT = 75; // 3+ days
      }
    }

    // Check emails sent today
    const { data: todayStats, error: statsError } = await supabase
      .from('email_queue')
      .select('id')
      .eq('campaign_id', campaign_id)
      .eq('status', 'sent')
      .gte('sent_at', `${today}T00:00:00.000Z`)
      .lte('sent_at', `${today}T23:59:59.999Z`);

    if (!statsError && todayStats && todayStats.length >= DAILY_LIMIT) {
      return NextResponse.json({
        status: 'daily_limit_reached',
        error: `Daily sending limit of ${DAILY_LIMIT} emails reached (warm-up schedule). Continue sending daily to gradually increase your limit.`
      }, { status: 429 });
    }

    // 1. Fetch campaign (subject + body template)
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (campaignError) {
      return NextResponse.json({ error: `Campaign fetch failed: ${campaignError.message}` }, { status: 404 });
    }
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    if (campaign.status === 'completed') {
      return NextResponse.json({ status: 'completed', message: 'Campaign already completed' });
    }

    // 1.5. Perform spam and quality checks
    const spamCheck = detectSpamTriggers(campaign.subject + ' ' + campaign.body);
    const qualityCheck = analyzeContentQuality(campaign.subject, campaign.body);
    
    if (spamCheck.score > 50) {
      console.warn(`High spam score detected: ${spamCheck.score}%. Triggers:`, spamCheck.triggers);
    }
    
    if (qualityCheck.issues.length > 0) {
      console.warn('Content quality issues:', qualityCheck.issues);
    }

    // 2. Fetch next pending recipient (now includes name + company)
    const { data: nextRecipient, error: queueError } = await supabase
      .from('email_queue')
      .select('id, recipient_email, recipient_name, recipient_company')
      .eq('campaign_id', campaign_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (queueError && queueError.code === 'PGRST116') {
      // No more pending → mark campaign complete
      await supabase
        .from('email_campaigns')
        .update({ status: 'completed' })
        .eq('id', campaign_id);
      return NextResponse.json({ status: 'completed', message: 'All emails sent' });
    }
    if (queueError) throw queueError;

    // Per-recipient rate limiting (max 1 email per day to same person)
    const { data: recipientHistory, error: recipientError } = await supabase
      .from('email_queue')
      .select('id')
      .eq('recipient_email', nextRecipient.recipient_email)
      .eq('status', 'sent')
      .gte('sent_at', `${today}T00:00:00.000Z`)
      .lte('sent_at', `${today}T23:59:59.999Z`)
      .limit(1);

    if (!recipientError && recipientHistory && recipientHistory.length > 0) {
      // Skip this recipient, mark as sent to avoid retry loop
      await supabase
        .from('email_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: 'Skipped: Already sent today' })
        .eq('id', nextRecipient.id);
      
      return NextResponse.json({
        status: 'skipped',
        processed_email: nextRecipient.recipient_email,
        message: 'Recipient already received an email today'
      });
    }

    // 3. Personalize subject + body for THIS specific recipient
    const personalizedSubject = personalize(
      campaign.subject,
      nextRecipient.recipient_name,
      nextRecipient.recipient_company,
      nextRecipient.recipient_email,
      smtp_user
    );
    const personalizedBody = personalize(
      campaign.body,
      nextRecipient.recipient_name,
      nextRecipient.recipient_company,
      nextRecipient.recipient_email,
      smtp_user
    );

    // 4. Build transporter
    const cleanPass   = smtp_pass.replace(/\s/g, '');
    const senderName  = smtp_sender_name || smtp_user;
    const domain      = smtp_user.split('@')[1] || 'gmail.com';

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: smtp_user, pass: cleanPass },
      tls: { rejectUnauthorized: false }
    });

    // 5. Verify SMTP credentials
    try {
      await transporter.verify();
    } catch (verifyErr: any) {
      await supabase
        .from('email_queue')
        .update({ status: 'failed', error_message: `SMTP Auth Failed: ${verifyErr.message}` })
        .eq('id', nextRecipient.id);

      return NextResponse.json({
        status: 'smtp_error',
        error: `SMTP Authentication Failed. Check your Gmail address and App Password. Error: ${verifyErr.message}`
      });
    }

    // 6. Check optimal sending time (business hours: 9AM-5PM weekdays)
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const isWeekend = day === 0 || day === 6;
    const isBusinessHours = hour >= 9 && hour <= 17 && !isWeekend;
    
    if (!isBusinessHours) {
      console.log(`Sending outside business hours (hour: ${hour}, weekend: ${isWeekend}). Consider scheduling for better engagement.`);
    }

    // 7. Add delay before sending to prevent spam detection
    if (delay_ms > 0) {
      await new Promise(resolve => setTimeout(resolve, delay_ms));
    }

    // 7. Send personalized plain-text email
    try {
      await transporter.sendMail({
        from:    `"${senderName}" <${smtp_user}>`,
        to:      nextRecipient.recipient_email,
        replyTo: `"${senderName}" <${smtp_user}>`,
        subject: personalizedSubject,
        // Plain text ONLY — no html property.
        // Having no html key forces Gmail to treat this as a personal email.
        text: personalizedBody,
        attachments: attachments.map((a: any) => ({
          filename:    a.filename,
          content:     Buffer.from(a.content, 'base64'),
          contentType: a.contentType
        })),
        headers: {
          // Unique Message-ID per recipient avoids duplicate/spam detection
          'Message-ID': `<${crypto.randomUUID()}@${domain}>`,
          // Anti-spam headers
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
          'Importance': 'Normal',
          'Precedence': 'bulk',
          'List-Unsubscribe': `<mailto:${smtp_user}?subject=unsubscribe>`,
        }
      });

      await supabase
        .from('email_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', nextRecipient.id);

    } catch (emailError: any) {
      console.error('Email send error:', emailError);
      
      // Detect bounce types and handle accordingly
      const errorMessage = emailError.message.toLowerCase();
      let bounceType = 'unknown';
      
      if (errorMessage.includes('bounce') || errorMessage.includes('permanent') || errorMessage.includes('550')) {
        bounceType = 'permanent_bounce';
      } else if (errorMessage.includes('temporary') || errorMessage.includes('450') || errorMessage.includes('421')) {
        bounceType = 'temporary_bounce';
      } else if (errorMessage.includes('mailbox full') || errorMessage.includes('over quota')) {
        bounceType = 'mailbox_full';
      }
      
      // Auto-remove permanently bouncing emails after 3 attempts
      if (bounceType === 'permanent_bounce') {
        const { data: existingBounces } = await supabase
          .from('email_queue')
          .select('id')
          .eq('recipient_email', nextRecipient.recipient_email)
          .eq('status', 'failed')
          .ilike('error_message', '%bounce%');
        
        if (existingBounces && existingBounces.length >= 2) {
          // Mark recipient as permanently bounced to prevent future sends
          await supabase
            .from('email_queue')
            .update({ 
              status: 'failed', 
              error_message: `Permanently bounced - removed from list (${emailError.message})` 
            })
            .eq('id', nextRecipient.id);
          
          return NextResponse.json({
            status: 'permanent_bounce',
            processed_email: nextRecipient.recipient_email,
            message: 'Email permanently bounced - recipient removed from future campaigns'
          });
        }
      }
      
      await supabase
        .from('email_queue')
        .update({ status: 'failed', error_message: `${bounceType}: ${emailError.message}` })
        .eq('id', nextRecipient.id);
    }

    return NextResponse.json({
      status:          'sent_one',
      processed_email: nextRecipient.recipient_email,
    });

  } catch (error: any) {
    console.error('Send next error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
