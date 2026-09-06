import { NextResponse } from 'next/server';
import { callGeminiVision } from '@/lib/groq';

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
  source_image?: string;
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
- CRITICAL: If the example body already contains greeting phrases like "I hope you are doing well" or "I hope this message finds you well", you MUST REMOVE them before adding your chosen greeting and opening to avoid duplication.
- NEVER output literal brackets like "[Company]", "[Role]", or "[Recruiter Name]" in the generated subject or body under any circumstances. If details are missing, use natural English fallbacks.`
    : '';

  return `You are an expert AI Job Application & Cold Outreach Assistant helping ${name} apply for jobs based on information extracted from images.

${profileSection}
${exampleSection}

IMAGE EXTRACTION RULES:
- You will receive one or more images containing job posting information, recruiter contact details, or hiring announcements.
- Extract ALL visible email addresses, phone numbers, company names, job roles, recruiter names, and any other relevant contact information from the images.
- Each image may contain one or multiple job opportunities - treat each distinct job posting as a separate application card.
- If an image contains multiple email addresses or roles, create separate cards for each.

CRITICAL RULES FOR EMAIL EXTRACTION:
1. STRICTLY DO NOT FABRICATE, INVENT, OR GUESS ANY EMAIL ADDRESSES.
2. ONLY use the exact email address that is EXPLICITLY VISIBLE in the image.
3. If an image does not have a real email address explicitly visible, DO NOT create a card for it.
4. Use the context, company name, recruiter name, and job role found in the same image to generate the customized subject and body.

ROLE ADAPTATION RULE (CRITICAL):
- Read the job role from each image carefully (Backend Engineer, UI/UX Designer, Data Analyst, Full Stack Developer, etc.)
- Adapt the skills paragraph to match WHAT THAT JOB REQUIRES based on the image details AND the applicant skills profile above.
- If the applicant skills overlap with the job, highlight those. If the job needs something slightly different, frame the applicant skills in the most relevant way.
- NEVER write a generic Frontend Developer email if the job is for a Backend role or any other role.

SPAM AVOIDANCE - WITHIN-BATCH VARIATION (STRICT COMPLIANCE REQUIRED):
When generating multiple cards from multiple images, you MUST vary the email content opening phrase to avoid spam detection. Use the following greetings sequentially:
- For the first card (id: "img_1"), begin the body with: "Hi hiring manager,\n\nI hope this message finds you well."
- For the second card (id: "img_2"), begin the body with: "Dear hiring manager,\n\nI came across your job posting and was excited to apply."
- For the third card (id: "img_3"), begin the body with: "Hello hiring manager,\n\nI noticed you are actively hiring for this role and I would love to be considered."
- For the fourth card (id: "img_4"), begin the body with: "Hi hiring team,\n\nI recently saw your job posting and believe my background is a strong match."
- For the fifth card (id: "img_5"), begin the body with: "Dear hiring team,\n\nI am writing to express my interest in this position."
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
      "id": "img_1",
      "recruiter_name": "Recruiter or Poster Name or null",
      "company": "Company Name or null",
      "role": "Exact Role Title from the image or null",
      "location": "Location if specified or null",
      "experience": "Experience range if specified or null",
      "skills": ["Skill1", "Skill2"],
      "to_email": "exact_email_from_image@domain.com",
      "phone": "Extracted phone with country code like 919978455050 if present, otherwise null",
      "subject": "Tailored subject line using the applicant name and the actual job role (never leave literal brackets!)",
      "body": "Clean multi-paragraph email body with blank lines between every section and the signature at end. Ensure there are absolutely no literal bracketed placeholders in the text."
    }
  ],
  "emails": ["exact_email_from_image@domain.com"],
  "phones": ["919978455050"],
  "comma_separated": "exact_email_from_image@domain.com"
}
Ensure all to_emails are lowercase, valid, and strictly taken from the image content.

Signature to use at end of every email body:
${signatureLines}`;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const imageFiles = formData.getAll('images') as File[];
    const apiKey = formData.get('apiKey') as string | null;
    const preferencesStr = formData.get('preferences') as string | null;

    const prefs: EmailPreferences = preferencesStr ? JSON.parse(preferencesStr) : {};

    if (!imageFiles || imageFiles.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    const geminiKey = apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
    if (!geminiKey) {
      return NextResponse.json({ error: 'Gemini API key is required for image processing' }, { status: 400 });
    }

    const imageData = await Promise.all(
      imageFiles.map(async (file) => {
        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString('base64');
        return {
          base64,
          mimeType: file.type || 'image/jpeg',
          dataUrl: `data:${file.type || 'image/jpeg'};base64,${base64}`,
        };
      })
    );

    const systemPrompt = buildJobSystemPrompt(prefs);
    const userPrompt = 'Extract job application information from these images and generate cold emails:';

    const parsed = await callGeminiVision<{
      applications?: JobApplicationCard[];
      emails?: string[];
      phones?: string[];
    }>(
      systemPrompt,
      userPrompt,
      imageData.map(({ base64, mimeType }) => ({ base64, mimeType })),
      geminiKey
    );

    const emails: string[] = (parsed.emails || []).map((e: string) => e.toLowerCase().trim());
    const uniqueEmails = Array.from(new Set(emails));
    const phones: string[] = (parsed.phones || []).map((p: string) => cleanPhone(p)).filter(Boolean);
    const uniquePhones = Array.from(new Set(phones));

    const applications = (parsed.applications || []).map((app, idx) => ({
      ...app,
      source_image: imageData[idx % imageData.length]?.dataUrl,
    }));

    return NextResponse.json({
      success: true,
      source: 'gemini-ai-vision',
      model: 'gemini-3.5-flash',
      entries: [],
      applications,
      emails: uniqueEmails,
      phones: uniquePhones,
      commaSeparated: uniqueEmails.join(', '),
      phonesCommaSeparated: uniquePhones.join(', '),
      count: uniqueEmails.length,
      phoneCount: uniquePhones.length,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Image extraction failed';
    console.error('Image extraction error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}