import { NextResponse } from 'next/server';

export type ExtractedEntry = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  linkedin?: string;
};

export type JobApplicationCard = {
  id: string;
  recruiter_name?: string;
  company?: string;
  role?: string;
  location?: string;
  experience?: string;
  skills?: string[];
  to_email: string;
  phone?: string;
  subject: string;
  body: string;
};

export type EmailPreferences = {
  full_name?: string;
  your_email?: string;
  phone?: string;
  portfolio_url?: string;
  linkedin_url?: string;
  your_role?: string;
  experience?: string;
  key_skills?: string;
  example_subject?: string;
  example_body?: string;
};

function cleanPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    digits = `91${digits}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = `91${digits.slice(1)}`;
  }
  return digits;
}

function buildJobSystemPrompt(prefs: EmailPreferences): string {
  const name = prefs.full_name?.trim() || 'the applicant';
  const email = prefs.your_email?.trim() || '';
  const phone = prefs.phone?.trim() || '';
  const portfolio = prefs.portfolio_url?.trim() || '';
  const linkedin = prefs.linkedin_url?.trim() || '';
  const yourRole = prefs.your_role?.trim() || 'professional';
  const exp = prefs.experience?.trim() || '';
  const skills = prefs.key_skills?.trim() || '';
  const exampleSubject = prefs.example_subject?.trim() || '';
  const exampleBody = prefs.example_body?.trim() || '';

  const signatureParts: string[] = [
    'Best regards,',
    name,
  ];
  if (phone) signatureParts.push(`Phone: ${phone}`);
  if (linkedin) signatureParts.push(`LinkedIn: ${linkedin}`);
  if (portfolio) signatureParts.push(`Portfolio: ${portfolio}`);
  const signatureLines = signatureParts.join('\n');

  const profileSection = [
    'APPLICANT PROFILE:',
    `- Name: ${name}`,
    `- Email: ${email}`,
    `- Phone: ${phone}`,
    `- Role/Title: ${yourRole}`,
    `- Experience: ${exp || 'professional experience'}`,
    `- Skills: ${skills || 'relevant technical skills'}`,
    `- Portfolio: ${portfolio}`,
    `- LinkedIn: ${linkedin}`,
  ].join('\n');

  const exampleSection = exampleBody
    ? `\nAPPLICANT EXAMPLE EMAIL STYLE (use as STYLE GUIDE only, adapt content for each job role and company):
Example Subject: ${exampleSubject || 'Application for [Role] - ' + name}
Example Body:
${exampleBody}

HOW TO ADAPT THIS EXAMPLE BODY:
- The example body contains specific details like "React.js Developer position at your organization" or "Frontend Developer position". You must replace these with the actual role from the job post (e.g. "Backend Engineer position").
- If the company name is available from the post, replace "your organization" with the company name (e.g., "apply for the Backend Engineer position at iBotix"). If the company is NOT specified, keep it general as "your organization" or "your company".
- Start emails with varied professional greetings like "Hi hiring manager,", "Dear hiring manager,", "Hello hiring manager,", "Hi hiring team,", "Dear hiring team," etc. to avoid spam detection.
- IMPORTANT: If the example body already contains greeting phrases like "I hope you are doing well" or "I hope this message finds you well", REMOVE them before adding your chosen greeting and opening to avoid duplication.
- NEVER output literal brackets like "[Company]", "[Role]", or "[Recruiter Name]" in the generated subject or body under any circumstances. If details are missing, use natural English fallbacks.`
    : '';

  return `You are an expert AI Job Application & Cold Outreach Assistant helping ${name} apply for jobs.

${profileSection}
${exampleSection}

MULTIPLE POST PARSING:
The user may paste multiple LinkedIn job posts in one message. Each individual post is SEPARATED by "---" (three dashes). Treat each section between "---" delimiters as a SEPARATE, INDEPENDENT job post and generate ONE cold email application card per post.
If there is no "---" separator, try to detect individual posts by looking for new hiring announcements, company changes, or recruiter name changes.

CRITICAL RULES FOR EMAIL EXTRACTION:
1. STRICTLY DO NOT FABRICATE, INVENT, OR GUESS ANY EMAIL ADDRESSES.
2. ONLY use the exact email address that is EXPLICITLY PRESENT in the input text for that specific post section.
3. If a post section does not have a real email address explicitly written in it, DO NOT create a card for it.
4. Use the context, company name, recruiter name, and job role found WITHIN THAT SAME POST SECTION to generate the customized subject and body. Do not mix details from different posts.

ROLE ADAPTATION RULE (CRITICAL):
- Read the job role from each LinkedIn post carefully (Backend Engineer, UI/UX Designer, Data Analyst, Full Stack Developer, etc.)
- Adapt the skills paragraph to match WHAT THAT JOB REQUIRES based on the post details AND the applicant skills profile above.
- If the applicant skills overlap with the job, highlight those. If the job needs something slightly different, frame the applicant skills in the most relevant way.
- NEVER write a generic Frontend Developer email if the job is for a Backend role or any other role.

SPAM AVOIDANCE - WITHIN-BATCH VARIATION (STRICT COMPLIANCE REQUIRED):
When generating multiple cards in the same batch, you MUST vary the email content opening phrase to avoid spam detection. Use the following greetings sequentially:
- For the first card (id: "app_1"), begin the body with: "Hi hiring manager,\n\nI hope this message finds you well."
- For the second card (id: "app_2"), begin the body with: "Dear hiring manager,\n\nI came across your post on LinkedIn and was excited to apply."
- For the third card (id: "app_3"), begin the body with: "Hello hiring manager,\n\nI noticed you are actively hiring for this role and I would love to be considered."
- For the fourth card (id: "app_4"), begin the body with: "Hi hiring team,\n\nI recently saw your job post and believe my background is a strong match."
- For the fifth card (id: "app_5"), begin the body with: "Dear hiring team,\n\nI am writing to express my interest in this position."
- If there are more cards, rotate these greetings in order.
- Also, vary the sentence structures in the skills paragraph slightly by reordering skills or using synonyms so they do not look like a carbon copy.

FORMATTING RULE FOR THE body FIELD:
Format the email body with clear blank lines (double newlines) separating each paragraph:
- Opening greeting line: Use varied professional greetings like "Hi hiring manager,", "Dear hiring manager,", "Hello hiring manager,", "Hi hiring team,", "Dear hiring team," etc.
- 1-2 sentence intro about why applying and to which role at which company (or "your organization")
- 2-3 sentence skills paragraph adapted to match the job post requirements
- Closing line about attached resume

Then the signature block.

Return pure JSON in this exact structure:
{
  "applications": [
    {
      "id": "app_1",
      "recruiter_name": "Recruiter or Poster Name or null",
      "company": "Company Name or null",
      "role": "Exact Role Title from the post or null",
      "location": "Location if specified or null",
      "experience": "Experience range if specified or null",
      "skills": ["Skill1", "Skill2"],
      "to_email": "exact_email_from_text@domain.com",
      "phone": "Extracted phone with country code like 919978455050 if present, otherwise null",
      "subject": "Tailored subject line using the applicant name and the actual job role (never leave literal brackets!)",
      "body": "Clean multi-paragraph email body with blank lines between every section and the signature at end. Ensure there are absolutely no literal bracketed placeholders in the text."
    }
  ],
  "emails": ["exact_email_from_text@domain.com"],
  "phones": ["919978455050"],
  "comma_separated": "exact_email_from_text@domain.com"
}
Ensure all to_emails are lowercase, valid, and strictly taken from the user input text.

Signature to use at end of every email body:
${signatureLines}`;
}

function extractFallback(rawText: string, prefs: EmailPreferences) {
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const phoneRegex = /(?:\+?(\d{1,3}))?[-. (]*(\d{3,5})[-. )]*(\d{3,5})[-. ]*(\d{3,5})/g;

  const emailMatches = rawText.match(emailRegex) || [];
  const uniqueEmails = Array.from(new Set(emailMatches.map(e => e.toLowerCase().trim())));

  const rawPhones: string[] = [];
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const pMatches = line.match(phoneRegex);
    if (pMatches) {
      for (const p of pMatches) {
        const cleaned = cleanPhone(p);
        if (cleaned.length >= 10 && cleaned.length <= 13) {
          rawPhones.push(cleaned);
        }
      }
    }
  }
  const uniquePhones = Array.from(new Set(rawPhones));
  const entries: ExtractedEntry[] = [];

  for (const email of uniqueEmails) {
    const emailIndex = lines.findIndex(l => l.toLowerCase().includes(email));
    let name: string | undefined;
    if (emailIndex >= 2 && !lines[emailIndex - 1].includes('@') && !lines[emailIndex - 2].includes('@')) {
      name = `${lines[emailIndex - 2]} ${lines[emailIndex - 1]}`.trim();
    } else if (emailIndex >= 1 && !lines[emailIndex - 1].includes('@')) {
      name = lines[emailIndex - 1].trim();
    }
    entries.push({ email, name: name || undefined });
  }

  const yourName = prefs.full_name?.trim() || 'the applicant';
  const yourRole = prefs.your_role?.trim() || 'Professional';
  const skills = prefs.key_skills?.trim() || 'relevant technical skills';
  const exp = prefs.experience?.trim() || 'professional experience';
  const phone = prefs.phone?.trim() || '';
  const linkedin = prefs.linkedin_url?.trim() || '';
  const portfolio = prefs.portfolio_url?.trim() || '';
  const yourEmail = prefs.your_email?.trim() || '';
  const exampleBody = prefs.example_body?.trim();

  const greetings = [
    "Hi hiring manager,",
    "Dear hiring manager,",
    "Hello hiring manager,",
    "Hi hiring team,",
    "Dear hiring team,"
  ];

  const openings = [
    "I hope this message finds you well.",
    "I came across your post on LinkedIn and was excited to apply.",
    "I noticed you are actively hiring for this role and I would love to be considered.",
    "I recently saw your job post and believe my background is a strong match.",
    "I am writing to express my interest in this position."
  ];

  const applications: JobApplicationCard[] = uniqueEmails.map((email, idx) => {
    const chosenGreeting = greetings[idx % greetings.length];
    const chosenOpening = openings[idx % openings.length];
    
    let baseBody = exampleBody ? exampleBody : '';

    // If they supplied an example body, let's substitute the opener dynamically if it has standard greeting phrases
    if (baseBody) {
      // Check if the example body already has greeting-like phrases and remove them to avoid duplication
      const greetingRegex = /^(I hope (you are doing well|this finds you well|this message finds you well)\.?\s*)/i;
      baseBody = baseBody.replace(greetingRegex, '').trim();
      
      // Always start with varied greeting followed by the chosen opening
      baseBody = `${chosenGreeting}\n\n${chosenOpening}\n\n${baseBody}`;
    } else {
      baseBody = [
        chosenGreeting,
        '',
        chosenOpening,
        '',
        `I am writing to apply for the ${yourRole} position. I have ${exp} of experience, specializing in ${skills}.`,
        '',
        'I have attached my resume for your review. I would appreciate the opportunity to discuss how my skills can contribute to your team.',
        '',
        'Thank you for your time and consideration. I look forward to hearing from you.',
        '',
        'Best regards,',
        yourName,
        phone ? `Phone: ${phone}` : '',
        linkedin ? `LinkedIn: ${linkedin}` : '',
        portfolio ? `Portfolio: ${portfolio}` : '',
        yourEmail ? `Email: ${yourEmail}` : '',
      ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n').trimEnd();
    }

    return {
      id: `app_${idx + 1}`,
      to_email: email,
      subject: `Application for ${yourRole} Position - ${yourName}`,
      body: baseBody,
    };
  });

  return {
    entries,
    emails: uniqueEmails,
    phones: uniquePhones,
    commaSeparated: uniqueEmails.join(', '),
    phonesCommaSeparated: uniquePhones.join(', '),
    applications,
  };
}

export async function POST(req: Request) {
  try {
    const { text, apiKey, mode, preferences } = await req.json();
    const prefs: EmailPreferences = preferences || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text content is required' }, { status: 400 });
    }

    const groqKey = apiKey?.trim() || process.env.GROQ_API_KEY?.trim();

    if (groqKey) {
      try {
        const isJobMode = mode === 'job_applications';

        const systemPrompt = isJobMode
          ? buildJobSystemPrompt(prefs)
          : `You are an expert data parsing assistant. Extract email addresses, phone numbers, and associated contact information (name, company, role, LinkedIn URL) from raw unstructured text.
Return pure JSON:
{
  "entries": [
    {
      "name": "Full Name or null",
      "email": "email@example.com or null",
      "phone": "Phone number with country code like 919978455050 or null",
      "company": "Company Name or null",
      "role": "Job Role or null",
      "linkedin": "LinkedIn URL or null"
    }
  ],
  "emails": ["email1@example.com", "email2@example.com"],
  "phones": ["919978455050"],
  "comma_separated": "email1@example.com, email2@example.com",
  "phones_comma_separated": "919978455050"
}`;

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: text },
            ],
            temperature: 0.5,
            response_format: { type: 'json_object' },
          }),
        });

        if (groqResponse.ok) {
          const groqData = await groqResponse.json();
          const contentStr = groqData.choices?.[0]?.message?.content;
          if (contentStr) {
            const parsed = JSON.parse(contentStr);
            const emails: string[] = (parsed.emails || []).map((e: string) => e.toLowerCase().trim());
            const uniqueEmails = Array.from(new Set(emails));
            const phones: string[] = (parsed.phones || []).map((p: string) => cleanPhone(p)).filter(Boolean);
            const uniquePhones = Array.from(new Set(phones));

            return NextResponse.json({
              success: true,
              source: 'groq-ai',
              model: 'llama-3.3-70b-versatile',
              entries: parsed.entries || [],
              applications: parsed.applications || [],
              emails: uniqueEmails,
              phones: uniquePhones,
              commaSeparated: uniqueEmails.join(', '),
              phonesCommaSeparated: uniquePhones.join(', '),
              count: uniqueEmails.length,
              phoneCount: uniquePhones.length,
            });
          }
        }
      } catch (groqErr) {
        console.error('Groq fetch error, falling back:', groqErr);
      }
    }

    const fallback = extractFallback(text, prefs);
    return NextResponse.json({
      success: true,
      source: 'regex-parser',
      entries: fallback.entries,
      applications: fallback.applications,
      emails: fallback.emails,
      phones: fallback.phones,
      commaSeparated: fallback.commaSeparated,
      phonesCommaSeparated: fallback.phonesCommaSeparated,
      count: fallback.emails.length,
      phoneCount: fallback.phones.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Extraction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}