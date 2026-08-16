import { NextResponse } from 'next/server';

export type ExtractedEntry = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  linkedin?: string;
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

// Fallback deterministic extractor using regex & pattern heuristics
function extractFallback(rawText: string): {
  entries: ExtractedEntry[];
  emails: string[];
  phones: string[];
  commaSeparated: string;
  phonesCommaSeparated: string;
} {
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  // Match 10 to 13 digit phone patterns with optional +, spaces, dashes
  const phoneRegex = /(?:\+?(\d{1,3}))?[-. (]*(\d{3,5})[-. )]*(\d{3,5})[-. ]*(\d{3,5})/g;

  const emailMatches = rawText.match(emailRegex) || [];
  const uniqueEmails = Array.from(new Set(emailMatches.map(e => e.toLowerCase().trim())));

  // Phone matching
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
    let company: string | undefined;
    let linkedin: string | undefined;

    if (emailIndex >= 0) {
      if (emailIndex >= 2 && !lines[emailIndex - 1].includes('@') && !lines[emailIndex - 2].includes('@')) {
        name = `${lines[emailIndex - 2]} ${lines[emailIndex - 1]}`.trim();
      } else if (emailIndex >= 1 && !lines[emailIndex - 1].includes('@')) {
        name = lines[emailIndex - 1].trim();
      }

      for (let i = emailIndex; i < Math.min(lines.length, emailIndex + 6); i++) {
        if (lines[i].includes('linkedin.com') && !linkedin) {
          const match = lines[i].match(/https?:\/\/[^\s\]\)]+/);
          linkedin = match ? match[0] : lines[i];
        }
      }
    }

    entries.push({
      email,
      name: name || undefined,
      company: company || undefined,
      linkedin: linkedin || undefined,
    });
  }

  // Also build entries for phones if not captured
  for (const phone of uniquePhones) {
    if (!entries.some(e => e.phone === phone)) {
      entries.push({ phone });
    }
  }

  return {
    entries,
    emails: uniqueEmails,
    phones: uniquePhones,
    commaSeparated: uniqueEmails.join(', '),
    phonesCommaSeparated: uniquePhones.join(', '),
  };
}

export async function POST(req: Request) {
  try {
    const { text, apiKey } = await req.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text content is required' }, { status: 400 });
    }

    const groqKey = apiKey?.trim() || process.env.GROQ_API_KEY?.trim();

    if (groqKey) {
      try {
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content: `You are an expert data parsing assistant. Your task is to extract email addresses, phone numbers, and associated contact information (name, company, role, LinkedIn URL) from raw unstructured text.
Always return pure JSON in this exact structure:
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
  "phones": ["919978455050", "917620537089"],
  "comma_separated": "email1@example.com, email2@example.com",
  "phones_comma_separated": "919978455050, 917620537089"
}
Ensure all phone numbers are cleaned with country code digits (if 10 digit Indian number without country code, prepend 91). Make sure all emails are lowercase.`
              },
              {
                role: 'user',
                content: text
              }
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
