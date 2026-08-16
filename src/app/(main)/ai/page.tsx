'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEmails } from '@/lib/hooks/useEmails';
import { useWhatsApp, buildWhatsAppLink, DEFAULT_WHATSAPP_TEMPLATE } from '@/lib/hooks/useWhatsApp';
import { useJobApplications, type JobApplication } from '@/lib/hooks/useJobApplications';
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
  Phone,
  Briefcase,
  Mail,
  Edit3,
  MapPin,
  CheckCircle2,
  Circle,
  Search,
  X
} from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';

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

  // Hook for persistent Database-backed Job Applications
  const {
    applications: savedJobCards,
    loading: jobCardsLoading,
    stats: jobStats,
    addBatchApplications,
    toggleStatus: toggleJobStatus,
    updateApplication: updateJobCardInDb,
    deleteApplication: deleteJobCardFromDb,
  } = useJobApplications();

  // Mode: 'job_applications' (Default) or 'extractor'
  const [activeTab, setActiveTab] = useState<'job_applications' | 'extractor'>('job_applications');

  const [rawText, setRawText] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Search & Filter for Job Applications
  const [jobSearch, setJobSearch] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [cardToDelete, setCardToDelete] = useState<{ id: string; title: string } | null>(null);

  // Copy State Feedback per Card & Type
  const [copiedState, setCopiedState] = useState<{ id: string; type: 'email' | 'subject' | 'body' | 'all' } | null>(null);
  const [savedToEmailsMap, setSavedToEmailsMap] = useState<Record<string, boolean>>({});

  // Extractor Results
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

  // Run AI processing
  const handleProcess = async () => {
    if (!rawText.trim()) {
      showNotification('Please paste text to process.');
      return;
    }

    setLoading(true);
    setCopiedState(null);

    try {
      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: rawText,
          apiKey: apiKey.trim() || undefined,
          mode: activeTab,
        })
      });

      const data = await res.json();

      if (data.error) {
        showNotification(`Error: ${data.error}`);
      } else {
        if (activeTab === 'job_applications') {
          const apps = data.applications || [];
          if (apps.length > 0) {
            // 1. Automatically save generated cold email cards to Supabase database
            await addBatchApplications(apps);

            // 2. Automatically save any detected phone numbers to WhatsApp Outreach tab
            const phoneItems: Array<{ phone: string; name?: string; company?: string }> = [];
            for (const app of apps) {
              if (app.phone) {
                phoneItems.push({
                  phone: app.phone,
                  name: app.recruiter_name || undefined,
                  company: app.company || undefined,
                });
              }
            }

            // Also check data.phones list
            if (data.phones && Array.isArray(data.phones)) {
              for (const p of data.phones) {
                if (!phoneItems.some(it => it.phone === p)) {
                  phoneItems.push({ phone: p });
                }
              }
            }

            if (phoneItems.length > 0) {
              const now = new Date();
              const batchTitle = `${now.getDate()} ${now.toLocaleDateString('en-US', { month: 'short' })} WA Batch`;
              await addBatchContacts(phoneItems, batchTitle);
              showNotification(`Generated ${apps.length} Cold Emails & added ${phoneItems.length} WhatsApp card${phoneItems.length > 1 ? 's' : ''} to WhatsApp Outreach tab!`);
            } else {
              showNotification(`Generated & saved ${apps.length} cold email cards to database!`);
            }

            setRawText(''); // Clear input after successful creation
          } else {
            showNotification('No job applications detected in text.');
          }
        } else {
          setExtractedEntries(data.entries || []);
          setExtractedEmails(data.emails || []);
          setExtractedPhones(data.phones || []);
          setCommaSeparated(data.commaSeparated || '');
          setPhonesCommaSeparated(data.phonesCommaSeparated || '');
          setExtractionSource(data.source || 'parser');
          showNotification(`Extracted ${data.count || 0} emails & ${data.phoneCount || 0} phone numbers!`);
        }
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to process with AI');
    } finally {
      setLoading(false);
    }
  };

  // Copy helper with animated feedback per button
  const copyToClipboard = async (text: string, id: string, type: 'email' | 'subject' | 'body' | 'all', label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedState({ id, type });
      showNotification(`Copied ${label}!`);
      setTimeout(() => setCopiedState(null), 2000);
    } catch {
      showNotification('Failed to copy to clipboard');
    }
  };

  // Save individual Job Card to Emails tab
  const handleSaveJobCardToEmails = async (card: JobApplication) => {
    const title = card.company ? `${card.role || 'Job'} @ ${card.company}` : card.subject;
    const category = 'Cold Outreach';
    const content = `To: ${card.to_email}\nSubject: ${card.subject}\n\n${card.body}`;

    try {
      await addEmail(title, category, content);
      setSavedToEmailsMap(prev => ({ ...prev, [card.id]: true }));
      showNotification(`Saved "${title}" to Emails tab!`);
    } catch {
      showNotification('Failed to save to emails tab');
    }
  };

  // Paste from clipboard
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

  // Filter Job Cards (Pending on top, Completed at bottom)
  const filteredJobCards = savedJobCards.filter((card) => {
    const matchSearch =
      (card.to_email || '').toLowerCase().includes(jobSearch.toLowerCase()) ||
      (card.company || '').toLowerCase().includes(jobSearch.toLowerCase()) ||
      (card.role || '').toLowerCase().includes(jobSearch.toLowerCase()) ||
      (card.recruiter_name || '').toLowerCase().includes(jobSearch.toLowerCase()) ||
      (card.subject || '').toLowerCase().includes(jobSearch.toLowerCase());

    const matchStatus = jobStatusFilter === 'all' ? true : card.status === jobStatusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans pb-16 relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 bg-[#7FE7C4] text-black px-4 py-2 rounded-lg shadow-xl font-mono text-xs font-bold animate-in fade-in slide-in-from-top-3 flex items-center gap-2">
          <Check className="w-3.5 h-3.5" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Header & Sub-Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#242930] gap-3 font-mono text-xs text-zinc-400">
        {/* Mode Selector */}
        <div className="flex bg-[#15181D] p-0.5 rounded-lg border border-[#242930] w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('job_applications')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[11px] font-bold tracking-wide transition-colors ${
              activeTab === 'job_applications'
                ? 'bg-[#89295E] text-white border border-[#89295E]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>LinkedIn Posts &rarr; Cold Emails</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('extractor')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[11px] font-bold tracking-wide transition-colors ${
              activeTab === 'extractor'
                ? 'bg-[#89295E] text-white border border-[#89295E]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Bulk Extractor (Email/Phone)</span>
          </button>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-3">
          {activeTab === 'job_applications' && (
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-[#E8B54D] font-bold">{jobStats.pending} pending</span>
              <span className="text-zinc-600">&bull;</span>
              <span className="text-[#7FE7C4] font-bold">{jobStats.completed} completed</span>
            </div>
          )}
          <button
            onClick={() => setShowKeyModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border transition-colors bg-[#7FE7C4]/10 text-[#7FE7C4] border-[#7FE7C4]/30 hover:bg-[#7FE7C4]/20 w-fit"
          >
            <KeyRound className="w-3 h-3" />
            <span>GROQ LLaMA-3.3 ACTIVE</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODE 1: LINKEDIN POSTS -> PERSISTENT TAILORED COLD EMAILS CARDS */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'job_applications' && (
        <div className="space-y-6">
          
          {/* Paste Section */}
          <div className="bg-[#15181D] border border-[#242930] rounded-xl p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs text-zinc-300">
                <Briefcase className="w-3.5 h-3.5 text-[#ff8ac8]" />
                <span className="font-bold">Paste One or Multiple LinkedIn Job Posts</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1F2329] hover:bg-[#282D35] text-[11px] font-mono text-zinc-300 transition-colors"
                >
                  <ClipboardPaste className="w-3 h-3 text-[#ff8ac8]" />
                  <span>Paste</span>
                </button>
                {rawText && (
                  <button
                    type="button"
                    onClick={() => setRawText('')}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-[#1F2329]"
                    title="Clear text"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <textarea
              value={rawText || ''}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste raw LinkedIn hiring posts, recruiter updates, or job descriptions here (e.g. Riya.singh@ibotix.ai, hiring@karyah.app)..."
              rows={6}
              className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg p-3 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#89295E] resize-none font-sans leading-relaxed"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-[10px] font-mono text-zinc-500">
                AI extracts company, role, recruiter, and matches your 2 yrs React/Next.js stack + portfolio.
              </span>

              <button
                type="button"
                onClick={handleProcess}
                disabled={loading || !rawText.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#89295E] hover:bg-[#a03672] disabled:opacity-40 text-white text-xs font-bold font-mono tracking-wide transition-all shadow-md active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Zap className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing &amp; Saving with AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Tailored Cold Emails</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Search & Filter Bar for Generated Cards */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 bg-[#15181D] border border-[#242930] rounded-xl flex items-center px-3.5 py-2 focus-within:border-[#89295E]/60 transition-colors">
              <Search className="w-4 h-4 text-zinc-500 mr-2.5 shrink-0" />
              <input
                value={jobSearch || ''}
                onChange={(e) => setJobSearch(e.target.value)}
                placeholder="Search generated applications by company, role, email, or recruiter..."
                className="w-full bg-transparent text-xs text-zinc-200 outline-none border-none placeholder:text-zinc-600 font-sans"
              />
              {jobSearch && (
                <button onClick={() => setJobSearch('')} className="p-0.5 text-zinc-500 hover:text-zinc-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter Pills */}
            <div className="flex gap-1.5 font-mono flex-wrap">
              {(['all', 'pending', 'completed'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setJobStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                    jobStatusFilter === s
                      ? s === 'completed'
                        ? 'bg-[#7FE7C4]/20 text-[#7FE7C4] border-[#7FE7C4]/50'
                        : s === 'pending'
                        ? 'bg-[#E8B54D]/20 text-[#E8B54D] border-[#E8B54D]/50'
                        : 'bg-[#89295E] text-white border-[#89295E]'
                      : 'bg-[#15181D] text-zinc-500 border-[#242930] hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {s === 'all' ? `All (${jobStats.total})` : s === 'pending' ? `Pending (${jobStats.pending})` : `Completed (${jobStats.completed})`}
                </button>
              ))}
            </div>
          </div>

          {/* Persistent Cards Grid (Pending on top, Completed at bottom) */}
          <div className="space-y-4">
            {jobCardsLoading && savedJobCards.length === 0 ? (
              <div className="flex items-center justify-center py-20 font-mono text-xs text-zinc-500">
                <span className="animate-pulse">&gt; loading_job_applications...</span>
              </div>
            ) : filteredJobCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#242930] rounded-2xl bg-[#15181D]/30 max-w-2xl mx-auto space-y-2">
                <Briefcase className="w-8 h-8 text-zinc-600 mb-1" />
                <p className="text-xs text-zinc-400 font-bold font-mono">
                  {jobSearch || jobStatusFilter !== 'all' ? 'No matching applications' : 'No job applications saved yet'}
                </p>
                <p className="text-[11px] text-zinc-600 max-w-xs font-sans">
                  Paste LinkedIn hiring posts above and click "Generate Tailored Cold Emails" to create and save application cards!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredJobCards.map((card) => {
                  const isCompleted = card.status === 'completed';
                  const isEmailCopied = copiedState?.id === card.id && copiedState.type === 'email';
                  const isSubCopied = copiedState?.id === card.id && copiedState.type === 'subject';
                  const isBodyCopied = copiedState?.id === card.id && copiedState.type === 'body';
                  const isAllCopied = copiedState?.id === card.id && copiedState.type === 'all';
                  const isSaved = savedToEmailsMap[card.id];

                  // mailto link
                  const mailtoUrl = `mailto:${card.to_email}?subject=${encodeURIComponent(card.subject || '')}&body=${encodeURIComponent(card.body || '')}`;

                  return (
                    <div
                      key={card.id}
                      className={`bg-[#15181D] border rounded-2xl p-4.5 space-y-3.5 shadow-md flex flex-col justify-between transition-all duration-150 ${
                        isCompleted
                          ? 'border-[#242930] opacity-80 hover:opacity-100'
                          : 'border-[#89295E]/40 hover:border-[#89295E]/80'
                      }`}
                    >
                      {/* Top Header: Company, Recruiter, Role, Status Button */}
                      <div className="space-y-1.5 pb-2.5 border-b border-[#242930]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className={`text-sm font-bold truncate ${isCompleted ? 'text-zinc-400 line-through' : 'text-zinc-100'}`}>
                              <span>{card.role || 'Frontend Developer'}</span>
                              {card.company && (
                                <span className="text-[#ff8ac8] font-normal ml-1.5">@ {card.company}</span>
                              )}
                            </h3>
                            {card.recruiter_name && (
                              <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                                Recruiter: <span className="text-zinc-200">{card.recruiter_name}</span>
                              </p>
                            )}
                          </div>

                          {/* Status Toggle Badge */}
                          <div className="flex items-center gap-1.5 shrink-0 font-mono text-[9px] font-bold uppercase tracking-wider">
                            <button
                              type="button"
                              onClick={() => toggleJobStatus(card.id)}
                              className={`px-2 py-1 rounded-md flex items-center gap-1.5 transition-all border ${
                                isCompleted
                                  ? 'bg-[#7FE7C4]/15 text-[#7FE7C4] border-[#7FE7C4]/30 hover:bg-[#7FE7C4]/25'
                                  : 'bg-[#E8B54D]/15 text-[#E8B54D] border-[#E8B54D]/30 hover:bg-[#E8B54D]/25'
                              }`}
                              title="Click to toggle status"
                            >
                              {isCompleted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-[#7FE7C4]" />
                                  <span>Done</span>
                                </>
                              ) : (
                                <>
                                  <Circle className="w-3 h-3 text-[#E8B54D]" />
                                  <span>Pending</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setCardToDelete({ id: card.id, title: `${card.role || 'Job'} @ ${card.company || card.to_email}` })}
                              className="p-1 hover:bg-red-950/40 rounded text-zinc-500 hover:text-red-400 transition-colors"
                              title="Delete card"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Location & Skills tags */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {card.location && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1F2329] border border-[#242930] text-[10px] font-mono text-zinc-400">
                              <MapPin className="w-3 h-3 text-[#E8B54D]" />
                              {card.location}
                            </span>
                          )}
                          {card.skills && card.skills.map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-1.5 py-0.5 rounded bg-[#0D0F12] border border-[#242930] text-[9px] font-mono text-zinc-400"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* 1. Target Email Field with Copy Button */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                          Send To Email:
                        </label>
                        <div className="flex items-center gap-2 bg-[#0D0F12] border border-[#242930] rounded-lg px-2.5 py-1.5">
                          <Mail className="w-3.5 h-3.5 text-[#7FE7C4] shrink-0" />
                          <input
                            value={card.to_email || ''}
                            onChange={(e) => updateJobCardInDb(card.id, { to_email: e.target.value })}
                            className="flex-1 bg-transparent text-xs font-mono text-[#7FE7C4] font-bold outline-none border-none select-all"
                          />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(card.to_email, card.id, 'email', 'Email Address')}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold transition-all shrink-0 ${
                              isEmailCopied
                                ? 'bg-[#7FE7C4] text-black'
                                : 'bg-[#1F2329] hover:bg-[#282D35] text-zinc-300 border border-[#242930]'
                            }`}
                            title="Copy email address"
                          >
                            {isEmailCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 text-[#7FE7C4]" />}
                            <span>{isEmailCopied ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Optional: WhatsApp Outreach if phone was extracted */}
                      {card.phone && (
                        <div className="space-y-1">
                          <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                            Extracted WhatsApp Contact:
                          </label>
                          <div className="flex items-center justify-between bg-[#0D0F12] border border-[#242930] rounded-lg px-2.5 py-1.5">
                            <div className="flex items-center gap-2">
                              <MessageCircle className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                              <span className="font-mono text-xs text-[#25D366] font-bold">+{card.phone}</span>
                            </div>
                            <a
                              href={buildWhatsAppLink(card.phone, DEFAULT_WHATSAPP_TEMPLATE)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#25D366] hover:bg-[#20ba5a] text-black text-[10px] font-mono font-bold transition-all"
                            >
                              <span>Chat on WhatsApp</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      )}

                      {/* 2. Subject Line Field with Copy Button */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                          Subject Line:
                        </label>
                        <div className="flex items-center gap-2 bg-[#0D0F12] border border-[#242930] rounded-lg px-2.5 py-1.5">
                          <input
                            value={card.subject || ''}
                            onChange={(e) => updateJobCardInDb(card.id, { subject: e.target.value })}
                            className="flex-1 bg-transparent text-xs font-sans text-zinc-200 outline-none border-none select-all"
                          />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(card.subject, card.id, 'subject', 'Subject Line')}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold transition-all shrink-0 ${
                              isSubCopied
                                ? 'bg-[#7FE7C4] text-black'
                                : 'bg-[#1F2329] hover:bg-[#282D35] text-zinc-300 border border-[#242930]'
                            }`}
                            title="Copy subject line"
                          >
                            {isSubCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 text-[#ff8ac8]" />}
                            <span>{isSubCopied ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>

                      {/* 3. Tailored Email Body with Copy Button */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                            Personalized Pitch Body:
                          </label>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(card.body, card.id, 'body', 'Email Body')}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                              isBodyCopied
                                ? 'bg-[#7FE7C4] text-black'
                                : 'text-zinc-400 hover:text-zinc-200 bg-[#1F2329]'
                            }`}
                            title="Copy full body"
                          >
                            {isBodyCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 text-[#7FE7C4]" />}
                            <span>{isBodyCopied ? 'Body Copied!' : 'Copy Body'}</span>
                          </button>
                        </div>

                        <textarea
                          value={card.body || ''}
                          onChange={(e) => updateJobCardInDb(card.id, { body: e.target.value })}
                          rows={12}
                          className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg p-3 text-xs text-zinc-300 font-sans leading-relaxed outline-none focus:border-[#89295E] resize-none"
                        />
                      </div>

                      {/* Card Footer: Quick Actions */}
                      <div className="pt-2 border-t border-[#242930] flex flex-wrap items-center justify-between gap-2 font-mono text-[10px]">
                        {/* Open in Mail app */}
                        <a
                          href={mailtoUrl}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1F2329] hover:bg-[#282D35] text-zinc-200 border border-[#242930] hover:border-zinc-600 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3 text-sky-400" />
                          <span>Open in Mail</span>
                        </a>

                        <div className="flex items-center gap-2">
                          {/* Save to Emails Tab */}
                          <button
                            type="button"
                            onClick={() => handleSaveJobCardToEmails(card)}
                            disabled={isSaved}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                              isSaved
                                ? 'bg-[#7FE7C4]/20 text-[#7FE7C4] border border-[#7FE7C4]/40'
                                : 'bg-[#1F2329] hover:bg-[#282D35] text-zinc-300 border border-[#242930]'
                            }`}
                          >
                            {isSaved ? (
                              <>
                                <Check className="w-3 h-3 text-[#7FE7C4]" />
                                <span>Saved in Emails</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3 text-[#89295E]" />
                                <span>Save to Emails</span>
                              </>
                            )}
                          </button>

                          {/* Copy All (Email + Sub + Body) */}
                          <button
                            type="button"
                            onClick={() => {
                              const fullText = `To: ${card.to_email}\nSubject: ${card.subject}\n\n${card.body}`;
                              copyToClipboard(fullText, card.id, 'all', 'Full Email Package');
                            }}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold transition-all ${
                              isAllCopied
                                ? 'bg-[#7FE7C4] text-black'
                                : 'bg-[#89295E] hover:bg-[#a03672] text-white'
                            }`}
                          >
                            {isAllCopied ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>All Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy All</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODE 2: BULK EMAIL & PHONE EXTRACTOR (ORIGINAL PARSER) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'extractor' && (
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
                value={rawText || ''}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste raw names, emails, phone numbers, LinkedIn dumps, or candidate lists here..."
                rows={14}
                className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg p-3 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#89295E] resize-none font-mono leading-relaxed"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <span className="text-[10px] font-mono text-zinc-500">
                  {rawText ? `${rawText.split('\n').length} lines pasted` : 'Ready for input'}
                </span>

                <button
                  type="button"
                  onClick={handleProcess}
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
            <div className="bg-[#15181D] border border-[#242930] rounded-xl p-4 space-y-4 shadow-md min-h-[460px] flex flex-col justify-between">
              
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
                  <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#242930] rounded-xl font-mono bg-[#0D0F12]/50 space-y-2">
                    <Sparkles className="w-8 h-8 text-zinc-600 mb-1 animate-pulse" />
                    <p className="text-xs text-zinc-400 font-bold">No contacts extracted yet</p>
                    <p className="text-[11px] text-zinc-600 max-w-xs font-sans">
                      Paste raw text on the left and click "Extract with AI".
                    </p>
                  </div>
                ) : viewMode === 'comma' ? (
                  <div className="space-y-2">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                      Comma-separated emails:
                    </div>
                    <textarea
                      readOnly
                      value={commaSeparated || ''}
                      rows={10}
                      className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg p-3 text-xs text-[#7FE7C4] font-mono leading-relaxed outline-none select-all"
                    />
                  </div>
                ) : viewMode === 'whatsapp' ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
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
                  <div className="max-h-[300px] overflow-y-auto border border-[#242930] rounded-lg bg-[#0D0F12]">
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
                  <textarea
                    readOnly
                    value={extractedEmails.join('\n') || ''}
                    rows={10}
                    className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg p-3 text-xs text-zinc-200 font-mono leading-relaxed outline-none select-all"
                  />
                )}
              </div>

              {/* Action Buttons */}
              {(extractedEmails.length > 0 || extractedPhones.length > 0) && (
                <div className="space-y-3 pt-3 border-t border-[#242930]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono">
                    {extractedEmails.length > 0 && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(commaSeparated, 'bulk', 'email', 'Comma Emails')}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-[#1F2329] hover:bg-[#282D35] text-zinc-200 border border-[#242930]"
                      >
                        <Copy className="w-4 h-4 text-[#89295E]" />
                        <span>Copy Comma Emails</span>
                      </button>
                    )}

                    {extractedEmails.length > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          const batchTitle = `${new Date().getDate()} ${new Date().toLocaleDateString('en-US', { month: 'short' })} Batch`;
                          await addEmail(batchTitle, 'AI Extracted', commaSeparated);
                          showNotification(`Saved "${batchTitle}" in Emails tab!`);
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-[#89295E] hover:bg-[#a03672] text-white"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Save to Emails Tab</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Job Card */}
      <ConfirmModal
        isOpen={!!cardToDelete}
        title="Delete Job Application Card"
        message={`Delete application card for "${cardToDelete?.title}"? This action cannot be undone.`}
        onConfirm={() => {
          if (cardToDelete) {
            deleteJobCardFromDb(cardToDelete.id);
            setCardToDelete(null);
            showNotification('Application card deleted');
          }
        }}
        onCancel={() => setCardToDelete(null)}
      />

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
                value={apiKey || ''}
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
