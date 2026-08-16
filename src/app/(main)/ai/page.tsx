'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEmails } from '@/lib/hooks/useEmails';
import { useWhatsApp, buildWhatsAppLink, DEFAULT_WHATSAPP_TEMPLATE } from '@/lib/hooks/useWhatsApp';
import {
  Sparkles,
  Copy,
  Check,
  KeyRound,
  Send,
  Plus,
  Trash2,
  FileText,
  Users,
  Building2,
  Globe,
  ExternalLink,
  Zap,
  ArrowRight,
  ClipboardPaste,
  Filter,
  MessageCircle,
  Phone
} from 'lucide-react';

interface ExtractedEntry {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  linkedin?: string;
}

export default function AiExtractorPage() {
  const router = useRouter();
  const supabase = createClient();
  const { emails: existingEmails, addEmail } = useEmails();
  const { batches: waBatches, addBatchContacts } = useWhatsApp();

  const [rawText, setRawText] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedWaLinks, setCopiedWaLinks] = useState(false);
  const [savedToEmails, setSavedToEmails] = useState(false);
  const [savedToWhatsApp, setSavedToWhatsApp] = useState(false);

  // Results
  const [extractedEntries, setExtractedEntries] = useState<ExtractedEntry[]>([]);
  const [extractedEmails, setExtractedEmails] = useState<string[]>([]);
  const [extractedPhones, setExtractedPhones] = useState<string[]>([]);
  const [commaSeparated, setCommaSeparated] = useState('');
  const [phonesCommaSeparated, setPhonesCommaSeparated] = useState('');
  const [extractionSource, setExtractionSource] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'comma' | 'table' | 'whatsapp' | 'lines'>('comma');

  // Load saved Groq API key from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dailydeck_groq_key');
    if (saved) setApiKey(saved);
  }, []);

  const showNotification = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveApiKey = (keyToSave: string) => {
    setApiKey(keyToSave.trim());
    localStorage.setItem('dailydeck_groq_key', keyToSave.trim());
    setShowKeyModal(false);
    showNotification('Groq API Key saved');
  };

  // Helper for email batch name e.g. "16 Aug Batch 1"
  const getNextEmailBatchTitle = () => {
    const now = new Date();
    const day = now.getDate();
    const month = now.toLocaleDateString('en-US', { month: 'short' });
    const datePrefix = `${day} ${month} Batch`;
    const todayBatches = existingEmails.filter(e => e.title.startsWith(datePrefix));
    return `${datePrefix} ${todayBatches.length + 1}`;
  };

  // Helper for WhatsApp batch name e.g. "16 Aug WA Batch 1"
  const getNextWaBatchTitle = () => {
    const now = new Date();
    const day = now.getDate();
    const month = now.toLocaleDateString('en-US', { month: 'short' });
    const prefix = `${day} ${month} WA Batch`;
    const todayBatches = waBatches.filter(b => b.startsWith(prefix));
    return `${prefix} ${todayBatches.length + 1}`;
  };

  // Run AI / Parser extraction
  const handleExtract = async () => {
    if (!rawText.trim()) {
      showNotification('Please paste text to extract contacts.');
      return;
    }

    setLoading(true);
    setCopied(false);
    setCopiedWaLinks(false);
    setSavedToEmails(false);
    setSavedToWhatsApp(false);

    try {
      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: rawText,
          apiKey: apiKey.trim() || undefined,
        })
      });

      const data = await res.json();

      if (data.error) {
        showNotification(`Error: ${data.error}`);
      } else {
        setExtractedEntries(data.entries || []);
        setExtractedEmails(data.emails || []);
        setExtractedPhones(data.phones || []);
        setCommaSeparated(data.commaSeparated || '');
        setPhonesCommaSeparated(data.phonesCommaSeparated || '');
        setExtractionSource(data.source || 'parser');
        showNotification(`Extracted ${data.count || 0} emails & ${data.phoneCount || 0} phone numbers!`);
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to extract contacts');
    } finally {
      setLoading(false);
    }
  };

  // Copy Comma-separated list to clipboard
  const handleCopyComma = async () => {
    if (!commaSeparated) return;
    try {
      await navigator.clipboard.writeText(commaSeparated);
      setCopied(true);
      showNotification('Copied comma-separated emails to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showNotification('Failed to copy to clipboard');
    }
  };

  // Copy all wa.me links
  const handleCopyAllWaLinks = async () => {
    if (extractedPhones.length === 0) return;
    const links = extractedPhones.map(p => buildWhatsAppLink(p, DEFAULT_WHATSAPP_TEMPLATE)).join('\n\n');
    try {
      await navigator.clipboard.writeText(links);
      setCopiedWaLinks(true);
      showNotification('Copied all direct WhatsApp links to clipboard!');
      setTimeout(() => setCopiedWaLinks(false), 2500);
    } catch {
      showNotification('Failed to copy WhatsApp links');
    }
  };

  // Save directly to Emails tab with auto batch title
  const handleSaveToEmails = async () => {
    if (!commaSeparated) return;
    const batchTitle = getNextEmailBatchTitle();
    const category = 'AI Extracted';

    try {
      await addEmail(batchTitle, category, commaSeparated);
      setSavedToEmails(true);
      showNotification(`Saved as "${batchTitle}" in Emails tab!`);
    } catch (err) {
      showNotification('Failed to save to emails tab');
    }
  };

  // Save directly to WhatsApp tab with auto WA batch title
  const handleSaveToWhatsApp = async () => {
    if (extractedPhones.length === 0) return;
    const batchTitle = getNextWaBatchTitle();

    // Map extracted entries with phone numbers
    const items = extractedPhones.map(phone => {
      const entry = extractedEntries.find(e => e.phone === phone);
      return {
        phone,
        name: entry?.name || undefined,
        company: entry?.company || undefined,
        message: DEFAULT_WHATSAPP_TEMPLATE,
      };
    });

    try {
      const ok = await addBatchContacts(items, batchTitle);
      if (ok) {
        setSavedToWhatsApp(true);
        showNotification(`Saved ${items.length} cards to WhatsApp Tab ("${batchTitle}")!`);
      }
    } catch (err) {
      showNotification('Failed to save to WhatsApp tab');
    }
  };

  // Quick paste from clipboard
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText(text);
        showNotification('Pasted from clipboard!');
      }
    } catch {
      showNotification('Could not read clipboard. Please paste manually.');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans pb-16 relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 bg-[#7FE7C4] text-black px-4 py-2 rounded-lg shadow-xl font-mono text-xs font-bold animate-in fade-in slide-in-from-top-3 flex items-center gap-2">
          <Check className="w-3.5 h-3.5" />
          <span>{toast}</span>
        </div>
      )}

      {/* Dev Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#242930] gap-2 font-mono text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#89295E]" />
          <span className="text-zinc-200 font-bold">ai_contact_extractor</span>
          <span className="text-zinc-500">&bull;</span>
          <span className="text-zinc-400">Groq LLaMA-3.3 70B &bull; Emails + WhatsApp Numbers</span>
        </div>
        <button
          onClick={() => setShowKeyModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border transition-colors bg-[#7FE7C4]/10 text-[#7FE7C4] border-[#7FE7C4]/30 hover:bg-[#7FE7C4]/20"
        >
          <KeyRound className="w-3 h-3" />
          <span>GROQ LLaMA 3.3 READY</span>
        </button>
      </div>

      {/* Main Grid: Input & Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Raw Text Input Area */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#15181D] border border-[#242930] rounded-xl p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
                <FileText className="w-3.5 h-3.5 text-[#89295E]" />
                <span className="font-bold">Raw Unstructured Text (Emails &amp; Phones)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1F2329] hover:bg-[#282D35] text-[11px] font-mono text-zinc-300 transition-colors"
                >
                  <ClipboardPaste className="w-3 h-3 text-[#89295E]" />
                  <span>Paste</span>
                </button>
                {rawText && (
                  <button
                    type="button"
                    onClick={() => {
                      setRawText('');
                      setExtractedEmails([]);
                      setExtractedPhones([]);
                      setExtractedEntries([]);
                      setCommaSeparated('');
                    }}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-[#1F2329]"
                    title="Clear text"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste raw names, emails, phone numbers, LinkedIn dumps, or messy candidate/recruiter lists here..."
              rows={16}
              className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg p-3 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#89295E] resize-none font-mono leading-relaxed"
            />

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <span className="text-[10px] font-mono text-zinc-500">
                {rawText ? `${rawText.split('\n').length} lines pasted` : 'Ready for input'}
              </span>

              <button
                type="button"
                onClick={handleExtract}
                disabled={loading || !rawText.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#89295E] hover:bg-[#a03672] disabled:opacity-40 text-white text-xs font-bold font-mono tracking-wide transition-all shadow-md active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Zap className="w-3.5 h-3.5 animate-spin" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Extract with AI</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Results & Export */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#15181D] border border-[#242930] rounded-xl p-4 space-y-4 shadow-md min-h-[480px] flex flex-col justify-between">
            
            {/* Header with Stats & Views */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#242930] pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-[#89295E] font-bold">&gt;</span>
                  <span className="text-zinc-200 font-bold">Results:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#7FE7C4]/20 text-[#7FE7C4] border border-[#7FE7C4]/30">
                    {extractedEmails.length} emails
                  </span>
                  {extractedPhones.length > 0 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30">
                      {extractedPhones.length} phones
                    </span>
                  )}
                </div>

                {/* View Mode Toggle */}
                {(extractedEmails.length > 0 || extractedPhones.length > 0) && (
                  <div className="flex bg-[#1F2329] p-0.5 rounded border border-[#242930] font-mono text-[10px]">
                    <button
                      onClick={() => setViewMode('comma')}
                      className={`px-2.5 py-1 rounded font-bold ${
                        viewMode === 'comma' ? 'bg-[#89295E] text-white' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Emails
                    </button>
                    {extractedPhones.length > 0 && (
                      <button
                        onClick={() => setViewMode('whatsapp')}
                        className={`px-2.5 py-1 rounded font-bold ${
                          viewMode === 'whatsapp' ? 'bg-[#25D366] text-black' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        WhatsApp
                      </button>
                    )}
                    <button
                      onClick={() => setViewMode('table')}
                      className={`px-2.5 py-1 rounded font-bold ${
                        viewMode === 'table' ? 'bg-[#89295E] text-white' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Table
                    </button>
                    <button
                      onClick={() => setViewMode('lines')}
                      className={`px-2.5 py-1 rounded font-bold ${
                        viewMode === 'lines' ? 'bg-[#89295E] text-white' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Lines
                    </button>
                  </div>
                )}
              </div>

              {/* Extraction Content Display */}
              {extractedEmails.length === 0 && extractedPhones.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-[#242930] rounded-xl font-mono bg-[#0D0F12]/50 space-y-2">
                  <Sparkles className="w-8 h-8 text-zinc-600 mb-1 animate-pulse" />
                  <p className="text-xs text-zinc-400 font-bold">No contacts extracted yet</p>
                  <p className="text-[11px] text-zinc-600 max-w-xs font-sans">
                    Paste raw text on the left and click "Extract with AI" to generate clean emails and WhatsApp links.
                  </p>
                </div>
              ) : viewMode === 'comma' ? (
                /* Comma Separated Output Box */
                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                    Comma-separated emails:
                  </div>
                  <textarea
                    readOnly
                    value={commaSeparated}
                    rows={12}
                    className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg p-3 text-xs text-[#7FE7C4] font-mono leading-relaxed outline-none select-all"
                  />
                </div>
              ) : viewMode === 'whatsapp' ? (
                /* WhatsApp Direct Links View */
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                    Extracted WhatsApp Outreach Contacts:
                  </div>
                  {extractedPhones.map((phone, idx) => {
                    const waLink = buildWhatsAppLink(phone, DEFAULT_WHATSAPP_TEMPLATE);
                    return (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-[#0D0F12] border border-[#242930] rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <MessageCircle className="w-4 h-4 text-[#25D366] shrink-0" />
                          <span className="font-mono text-xs text-zinc-200 font-bold">+{phone}</span>
                        </div>
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 px-3 py-1 rounded bg-[#25D366] hover:bg-[#20ba5a] text-black text-[11px] font-bold font-mono transition-colors shrink-0"
                        >
                          <span>Chat</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              ) : viewMode === 'table' ? (
                /* Rich Structured Contact Table */
                <div className="max-h-[340px] overflow-y-auto border border-[#242930] rounded-lg bg-[#0D0F12]">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="sticky top-0 bg-[#1F2329] border-b border-[#242930] text-[10px] font-mono uppercase text-zinc-400">
                      <tr>
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">Email / Phone</th>
                        <th className="py-2 px-3">Company</th>
                        <th className="py-2 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#242930]/60 font-mono text-[11px]">
                      {extractedEntries.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-[#15181D]/80 transition-colors">
                          <td className="py-2 px-3 text-zinc-200 font-sans">{entry.name || '—'}</td>
                          <td className="py-2 px-3 font-mono">
                            {entry.email && <div className="text-[#7FE7C4] select-all">{entry.email}</div>}
                            {entry.phone && <div className="text-[#25D366] select-all">+{entry.phone}</div>}
                          </td>
                          <td className="py-2 px-3 text-zinc-400 font-sans">{entry.company || '—'}</td>
                          <td className="py-2 px-3 text-right">
                            {entry.phone ? (
                              <a
                                href={buildWhatsAppLink(entry.phone, DEFAULT_WHATSAPP_TEMPLATE)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-[#25D366] hover:underline"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>WhatsApp</span>
                              </a>
                            ) : entry.linkedin ? (
                              <a
                                href={entry.linkedin}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-sky-400 hover:underline"
                              >
                                <Globe className="w-3 h-3" />
                                <span>LinkedIn</span>
                              </a>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* One email per line */
                <textarea
                  readOnly
                  value={extractedEmails.join('\n')}
                  rows={12}
                  className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg p-3 text-xs text-zinc-200 font-mono leading-relaxed outline-none select-all"
                />
              )}
            </div>

            {/* Quick One-Click Action Buttons */}
            {(extractedEmails.length > 0 || extractedPhones.length > 0) && (
              <div className="space-y-3 pt-3 border-t border-[#242930]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono">
                  
                  {/* Email Action 1: Copy Comma Emails */}
                  {extractedEmails.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCopyComma}
                      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow ${
                        copied
                          ? 'bg-[#7FE7C4] text-black'
                          : 'bg-[#1F2329] hover:bg-[#282D35] text-zinc-200 border border-[#242930] hover:border-zinc-600'
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Copied Emails!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-[#89295E]" />
                          <span>Copy Comma Emails</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Email Action 2: Save to Emails Tab as Batch */}
                  {extractedEmails.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSaveToEmails}
                      disabled={savedToEmails}
                      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow ${
                        savedToEmails
                          ? 'bg-[#7FE7C4]/20 text-[#7FE7C4] border border-[#7FE7C4]/40'
                          : 'bg-[#89295E] hover:bg-[#a03672] text-white active:scale-[0.98]'
                      }`}
                    >
                      {savedToEmails ? (
                        <>
                          <Check className="w-4 h-4 text-[#7FE7C4]" />
                          <span>Saved to Emails Tab!</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Save to Emails ({getNextEmailBatchTitle()})</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* WhatsApp Action 1: Copy all wa.me links */}
                  {extractedPhones.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCopyAllWaLinks}
                      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow ${
                        copiedWaLinks
                          ? 'bg-[#25D366] text-black'
                          : 'bg-[#1F2329] hover:bg-[#282D35] text-zinc-200 border border-[#242930] hover:border-zinc-600'
                      }`}
                    >
                      {copiedWaLinks ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Copied WA Links!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-[#25D366]" />
                          <span>Copy WhatsApp Links</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* WhatsApp Action 2: Save to WhatsApp Tab */}
                  {extractedPhones.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSaveToWhatsApp}
                      disabled={savedToWhatsApp}
                      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow ${
                        savedToWhatsApp
                          ? 'bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40'
                          : 'bg-[#25D366] hover:bg-[#20ba5a] text-black active:scale-[0.98]'
                      }`}
                    >
                      {savedToWhatsApp ? (
                        <>
                          <Check className="w-4 h-4 text-[#25D366]" />
                          <span>Saved to WhatsApp Tab!</span>
                        </>
                      ) : (
                        <>
                          <MessageCircle className="w-4 h-4" />
                          <span>Save to WhatsApp ({getNextWaBatchTitle()})</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Shortcuts */}
                <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-zinc-500">
                  <button
                    onClick={() => router.push('/whatsapp')}
                    className="flex items-center gap-1 text-[#25D366] hover:underline"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Go to WhatsApp Tab</span>
                  </button>

                  <button
                    onClick={() => router.push('/campaigns')}
                    className="flex items-center gap-1 text-[#ff8ac8] hover:text-white transition-colors"
                  >
                    <span>Go to Campaigns</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Groq API Key Modal */}
      {showKeyModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowKeyModal(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#15181D] border border-[#242930] rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 font-mono"
          >
            <div className="flex items-center justify-between border-b border-[#242930] pb-3">
              <div className="flex items-center gap-2 text-xs text-zinc-200 font-bold uppercase tracking-wider">
                <KeyRound className="w-4 h-4 text-[#E8B54D]" />
                <span>Configure Groq API Key</span>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="p-1 rounded text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Groq API Key (gsk_...)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#89295E]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#242930]">
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1F2329]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveApiKey(apiKey)}
                className="px-4 py-1.5 rounded bg-[#89295E] hover:bg-[#a03672] text-white text-xs font-bold tracking-wide"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
