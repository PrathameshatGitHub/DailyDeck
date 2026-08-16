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

function cleanPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    digits = `91${digits}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = `91${digits.slice(1)}`;
  }
  return digits;
}

// Fallback deterministic extractor
function extractFallback(rawText: string) {
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

    if (emailIndex >= 0) {
      if (emailIndex >= 2 && !lines[emailIndex - 1].includes('@') && !lines[emailIndex - 2].includes('@')) {
        name = `${lines[emailIndex - 2]} ${lines[emailIndex - 1]}`.trim();
      } else if (emailIndex >= 1 && !lines[emailIndex - 1].includes('@')) {
        name = lines[emailIndex - 1].trim();
      }
    }

    entries.push({
      email,
      name: name || undefined,
    });
  }

  // Fallback generated job cards
  const applications: JobApplicationCard[] = uniqueEmails.map((email, idx) => {
    return {
      id: `app_${idx + 1}`,
      to_email: email,
      subject: `Application for Frontend Developer Position - Prathamesh Mali`,
      body: `Hi,\n\nI hope you are doing well.\n\nI am writing to apply for the Frontend Developer position. I have 2 years of professional experience in frontend development, specializing in React.js, Next.js, JavaScript, TypeScript, HTML5, CSS3, and responsive web development.\n\nI have built reusable UI components, integrated REST APIs, and collaborated with teams to deliver high-quality, scalable web applications with a strong focus on clean UI/UX.\n\nPortfolio: https://profile-inky-iota.vercel.app/\nLinkedIn: https://www.linkedin.com/in/prathamesh-mali-27685b236/\n\nI have attached my resume for your review. I would appreciate the opportunity to discuss how my skills and experience can contribute to your team.\n\nThank you for your time and consideration. I look forward to hearing from you.\n\nBest regards,\nPrathamesh Mali\nPhone: 7620537089\nEmail: maliprathamesh3162@gmail.com`
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
    const { text, apiKey, mode, customTemplate } = await req.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text content is required' }, { status: 400 });
    }

    const groqKey = apiKey?.trim() || process.env.GROQ_API_KEY?.trim();

    if (groqKey) {
      try {
        const isJobMode = mode === 'job_applications';

        const systemPrompt = isJobMode
          ? `You are an expert AI Job Application & Cold Outreach Assistant for Prathamesh Mali, a Frontend Developer (React.js, Next.js, JavaScript, TypeScript, HTML, CSS, TailwindCSS, 2 years exp, Phone: 7620537089, Email: maliprathamesh3162@gmail.com, Portfolio: https://profile-inky-iota.vercel.app/, LinkedIn: https://www.linkedin.com/in/prathamesh-mali-27685b236/).

Analyze the provided text which may contain ONE OR MULTIPLE LinkedIn hiring posts / job vacancies.

CRITICAL RULES FOR EMAIL EXTRACTION:
1. STRICTLY DO NOT FABRICATE, INVENT, OR GUESS ANY EMAIL ADDRESSES.
2. ONLY use the exact email address that is EXPLICITLY PRESENT in the input text for that job post (e.g. maliprathamesh3162@gmail.com, Riya.singh@ibotix.ai, hiring@karyah.app).
3. If a section or post does not have a real email address explicitly written in it, DO NOT create a card for it. Every application card MUST have a real "to_email" directly extracted from the text.
4. Use the context, company name, recruiter name, and job role found around that exact email to generate the customized subject and body.

CRITICAL FORMATTING RULE FOR THE "body" FIELD:
DO NOT output a single block of text or compressed paragraph. You MUST format the email body with clear blank lines (double newlines \\n\\n) separating each paragraph and section, in this EXACT clean style:

Hi [Recruiter Name or Hiring Team],

I hope you are doing well.

I am writing to apply for the [Job Role] position at [Company Name]. I have 2 years of professional experience in frontend development, specializing in React.js, Next.js, JavaScript, HTML, CSS, and responsive web development.

In my current and previous projects, I have developed responsive and scalable web applications, built reusable UI components, integrated REST APIs, optimized application performance, and collaborated with teams to deliver high-quality user experiences. [Mention any matching specific skills from post like TypeScript/Angular/Redux/TailwindCSS if relevant].

I have attached my resume for your review. I would appreciate the opportunity to discuss how my skills and experience can contribute to your team.

Thank you for your time and consideration. I look forward to hearing from you.

Best regards,
Prathamesh Mali
Phone: 7620537089
LinkedIn: https://www.linkedin.com/in/prathamesh-mali-27685b236/
Portfolio: https://profile-inky-iota.vercel.app/

Return pure JSON in this exact structure:
{
  "applications": [
    {
      "id": "app_1",
      "recruiter_name": "Recruiter or Poster Name (e.g. Riya Singh, Sirisha PV) or null",
      "company": "Company Name (e.g. iBotix, karyah) or null",
      "role": "Role Title (e.g. Frontend Developer, ReactJS Developer) or null",
      "location": "Location if specified or null",
      "experience": "Experience range if specified or null",
      "skills": ["Skill1", "Skill2"],
      "to_email": "exact_email_from_text@domain.com",
      "phone": "Extracted phone number with country code like 919978455050 if present in this post, otherwise null",
      "subject": "Tailored subject line (e.g. 'ReactJS - Prathamesh Mali' if post specifies a format, otherwise 'Application for [Role] Position - Prathamesh Mali')",
      "body": "Clean multi-paragraph email body strictly formatted with \\n\\n between every section as shown above."
    }
  ],
  "emails": ["exact_email_from_text@domain.com"],
  "phones": ["919978455050"],
  "comma_separated": "exact_email_from_text@domain.com"
}
Ensure all to_emails are lowercase, valid, and strictly taken from the user's input text.`


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
              { role: 'user', content: text }
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' }
          })
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

    // Fallback if no key or if Groq failed
    const fallback = extractFallback(text);
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Extraction failed' }, { status: 500 });
  }
}
