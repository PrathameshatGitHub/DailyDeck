'use client';

import { useState, useEffect } from 'react';
import {
  useWhatsApp,
  type WhatsAppContact,
  DEFAULT_WHATSAPP_TEMPLATE,
  buildWhatsAppLink,
  cleanPhoneNumber,
} from '@/lib/hooks/useWhatsApp';
import { useGlobalSpace } from '@/lib/hooks/useGlobalSpace';
import {
  MessageCircle,
  Plus,
  Trash2,
  Search,
  Check,
  X,
  ExternalLink,
  Copy,
  Sparkles,
  Building2,
  Phone,
  FileText,
  Clock,
  CheckCircle2,
  Circle,
  Edit3,
  Layers,
  Send,
  Link2,
  ChevronDown,
  Globe
} from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function WhatsAppOutreachPage() {
  const { shareToGlobal, getUnsharedItems } = useGlobalSpace();
  const {
    contacts,
    loading,
    template,
    savingTemplate,
    saveTemplate,
    stats,
    batches,
    addContact,
    addBatchContacts,
    toggleStatus,
    markContacted,
    updateContact,
    deleteContact,
    deleteBatch,
  } = useWhatsApp();

  // Mode state
  const [creatorMode, setCreatorMode] = useState<'single' | 'bulk'>('single');
  const [isExpanded, setIsExpanded] = useState(false);

  // Single form
  const [singleName, setSingleName] = useState('');
  const [singlePhone, setSinglePhone] = useState('');
  const [singleCompany, setSingleCompany] = useState('');
  const [singleMessage, setSingleMessage] = useState(template);

  // Bulk paste form
  const [bulkText, setBulkText] = useState('');
  const [bulkBatchTitle, setBulkBatchTitle] = useState('');
  const [bulkMessage, setBulkMessage] = useState(template);

  // Template editor modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [customDefaultTemplate, setCustomDefaultTemplate] = useState(template);

  // Keep local template state synced when loaded from DB/cache
  useEffect(() => {
    setCustomDefaultTemplate(template);
    setSingleMessage(template);
    setBulkMessage(template);
  }, [template]);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'contacted'>('all');

  // Contact actions & Collection state
  const [contactToDelete, setContactToDelete] = useState<{ id: string; name?: string; phone: string } | null>(null);
  const [editingContact, setEditingContact] = useState<WhatsAppContact | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Collected Numbers Card state
  const [showNumbersCard, setShowNumbersCard] = useState(false);
  const [numberFormat, setNumberFormat] = useState<'comma' | 'lines' | 'clean'>('comma');
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Helper for batch naming
  const getNextBatchTitle = () => {
    const now = new Date();
    const day = now.getDate();
    const month = now.toLocaleDateString('en-US', { month: 'short' });
    const prefix = `${day} ${month} WA Batch`;
    const todayBatches = batches.filter(b => b.startsWith(prefix));
    return `${prefix} ${todayBatches.length + 1}`;
  };

  // Single add submit
  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singlePhone.trim()) return;

    const res = await addContact({
      name: singleName.trim() || undefined,
      phone: singlePhone.trim(),
      company: singleCompany.trim() || undefined,
      message: singleMessage.trim() || customDefaultTemplate,
      batch_title: getNextBatchTitle(),
    });

    if (res) {
      setSingleName('');
      setSinglePhone('');
      setSingleCompany('');
      setIsExpanded(false);
      showToast('WhatsApp contact added!');
    }
  };

  // Bulk add submit
  const handleAddBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim()) return;

    // Parse phone numbers from lines or commas
    const lines = bulkText.split(/\r?\n|,/).map(l => l.trim()).filter(Boolean);
    const phoneRegex = /(?:\+?(\d{1,3}))?[-. (]*(\d{3,5})[-. )]*(\d{3,5})[-. ]*(\d{3,5})/;
    const items: Array<{ phone: string; name?: string }> = [];

    for (const line of lines) {
      const match = line.match(phoneRegex);
      if (match) {
        const cleaned = cleanPhoneNumber(match[0]);
        if (cleaned.length >= 10) {
          items.push({ phone: cleaned });
        }
      }
    }

    if (items.length === 0) {
      showToast('No valid phone numbers found in input.');
      return;
    }

    const batchName = bulkBatchTitle.trim() || getNextBatchTitle();
    const success = await addBatchContacts(
      items.map(it => ({ ...it, message: bulkMessage })),
      batchName
    );

    if (success) {
      setBulkText('');
      setBulkBatchTitle('');
      setIsExpanded(false);
      showToast(`Added ${items.length} contacts to "${batchName}"!`);
    }
  };

  // Click & Chat action: Opens wa.me in new tab and auto-marks as contacted
  const handleLaunchChat = (contact: WhatsAppContact) => {
    const link = buildWhatsAppLink(contact.phone, contact.message);
    window.open(link, '_blank');
    if (contact.status === 'pending') {
      markContacted(contact.id);
      showToast(`Opened chat for ${contact.name || contact.phone} & marked contacted!`);
    }
  };

  // Copy direct wa.me link
  const handleCopyLink = async (contact: WhatsAppContact, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const link = buildWhatsAppLink(contact.phone, contact.message);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(contact.id);
      showToast('WhatsApp direct link copied!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast('Failed to copy link');
    }
  };

  // Save edited message
  const handleSaveEdit = async () => {
    if (editingContact && editMessage.trim()) {
      await updateContact(editingContact.id, { message: editMessage.trim() });
      setEditingContact(null);
      showToast('Message updated!');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] font-mono text-xs text-zinc-500">
        <span className="animate-pulse">&gt; loading_whatsapp_outreach...</span>
      </div>
    );
  }

  // Filter & Sort contacts: Pending on TOP, Done/Contacted on BOTTOM
  const filtered = contacts
    .filter((c) => {
      const matchSearch =
        c.phone.includes(search) ||
        (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.company || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.batch_title || '').toLowerCase().includes(search.toLowerCase());

      const matchBatch = selectedBatch === 'all' ? true : c.batch_title === selectedBatch;
      const matchStatus = statusFilter === 'all' ? true : c.status === statusFilter;

      return matchSearch && matchBatch && matchStatus;
    })
    .sort((a, b) => {
      // Pending (0) comes before Contacted/Done (1)
      const aOrder = a.status === 'pending' ? 0 : 1;
      const bOrder = b.status === 'pending' ? 0 : 1;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans pb-16 relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 bg-[#25D366] text-black px-4 py-2 rounded-lg shadow-xl font-mono text-xs font-bold animate-in fade-in slide-in-from-top-3 flex items-center gap-2">
          <Check className="w-3.5 h-3.5" />
          <span>{toast}</span>
        </div>
      )}

      {/* Dev Stats Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#242930] gap-2 font-mono text-xs text-zinc-400">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4 text-[#25D366]" />
            <span className="text-zinc-200 font-bold">whatsapp_outreach</span>
          </div>
          <span className="text-zinc-600">&bull;</span>
          <span>{stats.total} contacts</span>
          <span className="text-[#E8B54D]">&bull; {stats.pending} pending</span>
          <span className="text-[#25D366]">&bull; {stats.contacted} contacted</span>
        </div>

        <button
          onClick={() => setShowTemplateModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1F2329] border border-[#242930] hover:border-zinc-600 text-zinc-300 text-[10px] font-bold transition-colors w-fit"
        >
          <FileText className="w-3 h-3 text-[#25D366]" />
          <span>EDIT PITCH TEMPLATE</span>
        </button>
      </div>

      {/* Top Expandable Contact Creator */}
      <div className="max-w-2xl mx-auto">
        <div className={`bg-[#15181D] border rounded-xl shadow-lg transition-all duration-200 overflow-hidden ${
          isExpanded ? 'border-[#25D366]/60 ring-1 ring-[#25D366]/30' : 'border-[#242930] hover:border-zinc-700'
        }`}>
          {!isExpanded ? (
            <div
              onClick={() => setIsExpanded(true)}
              className="p-3.5 flex items-center justify-between cursor-pointer text-zinc-400 hover:text-zinc-300"
            >
              <div className="flex items-center gap-3 font-mono text-xs">
                <span className="text-[#25D366] font-bold">&gt;</span>
                <span className="text-zinc-400 font-sans">Add new recruiter / client WhatsApp number...</span>
              </div>
              <Plus className="w-4 h-4 text-[#25D366]" />
            </div>
          ) : (
            <div className="p-4 space-y-4 font-sans">
              {/* Toggle Single vs Bulk mode */}
              <div className="flex items-center justify-between border-b border-[#242930] pb-2 font-mono text-xs">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCreatorMode('single')}
                    className={`px-3 py-1 rounded text-[11px] font-bold transition-colors ${
                      creatorMode === 'single'
                        ? 'bg-[#25D366] text-black'
                        : 'bg-[#1F2329] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Single Contact
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatorMode('bulk')}
                    className={`px-3 py-1 rounded text-[11px] font-bold transition-colors ${
                      creatorMode === 'bulk'
                        ? 'bg-[#25D366] text-black'
                        : 'bg-[#1F2329] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Bulk Paste Numbers
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="p-1 rounded text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {creatorMode === 'single' ? (
                /* Single Form */
                <form onSubmit={handleAddSingle} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1">
                        Phone Number * (10 digits or with country code)
                      </label>
                      <input
                        value={singlePhone}
                        onChange={(e) => setSinglePhone(e.target.value)}
                        placeholder="e.g. 9978455050"
                        className="w-full bg-[#1F2329] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#25D366] font-mono"
                        required
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1">
                        Recruiter / Contact Name (Optional)
                      </label>
                      <input
                        value={singleName}
                        onChange={(e) => setSingleName(e.target.value)}
                        placeholder="e.g. Suhas Prabhu"
                        className="w-full bg-[#1F2329] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#25D366]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1">
                      Company (Optional)
                    </label>
                    <input
                      value={singleCompany}
                      onChange={(e) => setSingleCompany(e.target.value)}
                      placeholder="e.g. Google / Microsoft / Startup"
                      className="w-full bg-[#1F2329] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#25D366]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#242930]/80 font-mono">
                    <button
                      type="button"
                      onClick={() => setIsExpanded(false)}
                      className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!singlePhone.trim()}
                      className="px-4 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20ba5a] disabled:opacity-40 text-black text-xs font-bold tracking-wide transition-all shadow"
                    >
                      + Add WhatsApp Card
                    </button>
                  </div>
                </form>
              ) : (
                /* Bulk Paste Form */
                <form onSubmit={handleAddBulk} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1">
                      Paste List of Numbers (one per line, or comma-separated)
                    </label>
                    <textarea
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder="9978455050&#10;918877665544&#10;7620537089"
                      rows={5}
                      className="w-full bg-[#1F2329] border border-[#242930] rounded-lg p-3 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#25D366] font-mono leading-relaxed resize-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1">
                      Batch Name
                    </label>
                    <input
                      value={bulkBatchTitle}
                      onChange={(e) => setBulkBatchTitle(e.target.value)}
                      placeholder={getNextBatchTitle()}
                      className="w-full bg-[#1F2329] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#25D366] font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#242930]/80 font-mono">
                    <button
                      type="button"
                      onClick={() => setIsExpanded(false)}
                      className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!bulkText.trim()}
                      className="px-4 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20ba5a] disabled:opacity-40 text-black text-xs font-bold tracking-wide transition-all shadow"
                    >
                      Import Batch Numbers
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 bg-[#15181D] border border-[#242930] rounded-xl flex items-center px-3.5 py-2 focus-within:border-[#25D366]/60 transition-colors">
            <Search className="w-4 h-4 text-zinc-500 mr-2.5 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search phone, name, company, or batch..."
              className="w-full bg-transparent text-xs text-zinc-200 outline-none border-none placeholder:text-zinc-600 font-sans"
            />
            {search && (
              <button onClick={() => setSearch('')} className="p-0.5 text-zinc-500 hover:text-zinc-300">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Pills */}
          <div className="flex gap-1.5 font-mono flex-wrap">
            {(['all', 'pending', 'contacted'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                  statusFilter === s
                    ? s === 'contacted'
                      ? 'bg-[#25D366]/20 text-[#25D366] border-[#25D366]/50'
                      : s === 'pending'
                      ? 'bg-[#E8B54D]/20 text-[#E8B54D] border-[#E8B54D]/50'
                      : 'bg-[#25D366] text-black border-[#25D366]'
                    : 'bg-[#15181D] text-zinc-500 border-[#242930] hover:border-zinc-600 hover:text-zinc-300'
                }`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>

        {/* Batch Pills Bar */}
        {batches.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 font-mono text-[10px]">
            <span className="text-zinc-600 uppercase font-bold shrink-0">Batches:</span>
            <button
              onClick={() => setSelectedBatch('all')}
              className={`px-2 py-0.5 rounded shrink-0 transition-colors ${
                selectedBatch === 'all'
                  ? 'bg-[#1F2329] text-zinc-200 font-bold border border-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              All Batches ({contacts.length})
            </button>
            {batches.map((b) => (
              <button
                key={b}
                onClick={() => setSelectedBatch(b)}
                className={`px-2 py-0.5 rounded shrink-0 transition-colors ${
                  selectedBatch === b
                    ? 'bg-[#25D366]/20 text-[#25D366] font-bold border border-[#25D366]/40'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action Bar: All Collected WhatsApp Numbers Card */}
      {contacts.length > 0 && (() => {
        const validPhones = Array.from(
          new Set(contacts.map(c => c.phone?.trim()).filter(Boolean))
        );

        const commaText = validPhones.map(p => p.startsWith('+') ? p : `+${p}`).join(', ');
        const linesText = validPhones.map(p => p.startsWith('+') ? p : `+${p}`).join('\n');
        const cleanText = validPhones.map(p => p.replace(/\D/g, '')).join(', ');
        const waLinksText = validPhones.map(p => buildWhatsAppLink(p, template || DEFAULT_WHATSAPP_TEMPLATE)).join('\n');

        const displayText = numberFormat === 'comma' ? commaText : numberFormat === 'lines' ? linesText : cleanText;

        return (
          <div className="bg-[#15181D] border border-[#25D366]/40 rounded-xl overflow-hidden shadow-lg transition-all max-w-5xl mx-auto">
            {/* Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#1A1D24] border-b border-[#242930]">
              <div className="flex items-center gap-2 font-mono text-xs text-zinc-200">
                <Phone className="w-4 h-4 text-[#25D366]" />
                <span className="font-bold">Collected WhatsApp Numbers:</span>
                <span className="px-2 py-0.5 rounded-full bg-[#25D366]/20 text-[#25D366] text-[10px] font-bold border border-[#25D366]/30">
                  {validPhones.length} {validPhones.length === 1 ? 'Number' : 'Numbers'}
                </span>
                <span className="text-zinc-500 text-[10px] hidden sm:inline">&bull; from outreach contacts</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!commaText) return;
                    navigator.clipboard.writeText(commaText);
                    setCopiedFormat('comma');
                    showToast(`Copied ${validPhones.length} phone numbers!`);
                    setTimeout(() => setCopiedFormat(null), 2000);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#25D366] hover:bg-[#20ba5a] text-black transition-all shadow-sm"
                >
                  {copiedFormat === 'comma' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedFormat === 'comma' ? 'Copied!' : 'Copy All Numbers'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowNumbersCard((prev) => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border border-zinc-700 bg-zinc-800/60 text-zinc-200 hover:bg-zinc-800 transition-all"
                >
                  <FileText className="w-3.5 h-3.5 text-[#25D366]" />
                  <span>{showNumbersCard ? 'Hide Collection' : 'View Collection'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showNumbersCard ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* Expanded Content Panel */}
            {showNumbersCard && (
              <div className="p-4 space-y-3 bg-[#0D0F12] border-t border-[#242930] animate-in fade-in duration-150">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#242930] pb-2 font-mono text-[11px]">
                  {/* Format selector */}
                  <div className="flex bg-[#15181D] p-0.5 rounded-lg border border-[#242930]">
                    <button
                      type="button"
                      onClick={() => setNumberFormat('comma')}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                        numberFormat === 'comma' ? 'bg-[#25D366] text-black' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Comma-Separated
                    </button>
                    <button
                      type="button"
                      onClick={() => setNumberFormat('lines')}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                        numberFormat === 'lines' ? 'bg-[#25D366] text-black' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Line-by-Line
                    </button>
                    <button
                      type="button"
                      onClick={() => setNumberFormat('clean')}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                        numberFormat === 'clean' ? 'bg-[#25D366] text-black' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Digits Only
                    </button>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!displayText) return;
                        navigator.clipboard.writeText(displayText);
                        setCopiedFormat(numberFormat);
                        showToast(`Copied ${validPhones.length} numbers (${numberFormat})!`);
                        setTimeout(() => setCopiedFormat(null), 2000);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                        copiedFormat === numberFormat
                          ? 'bg-[#25D366] text-black'
                          : 'bg-[#1F2329] hover:bg-[#282D35] text-zinc-200 border border-[#242930]'
                      }`}
                    >
                      {copiedFormat === numberFormat ? <Check className="w-3 h-3 text-black" /> : <Copy className="w-3 h-3 text-[#25D366]" />}
                      <span>{copiedFormat === numberFormat ? 'Copied!' : `Copy (${numberFormat})`}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!waLinksText) return;
                        navigator.clipboard.writeText(waLinksText);
                        setCopiedFormat('links');
                        showToast(`Copied ${validPhones.length} wa.me chat links!`);
                        setTimeout(() => setCopiedFormat(null), 2000);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                        copiedFormat === 'links'
                          ? 'bg-[#25D366] text-black'
                          : 'bg-[#1F2329] hover:bg-[#282D35] text-sky-300 border border-[#242930]'
                      }`}
                    >
                      <Link2 className="w-3 h-3 text-sky-400" />
                      <span>{copiedFormat === 'links' ? 'Links Copied!' : 'Copy wa.me Links'}</span>
                    </button>

                    {(() => {
                      const unshared = getUnsharedItems('phone', validPhones);
                      const isAllShared = validPhones.length > 0 && unshared.length === 0;
                      return (
                        <button
                          type="button"
                          onClick={async () => {
                            if (unshared.length === 0) {
                              showToast('✓ All phone numbers from this list are already shared to Global Space!');
                              return;
                            }
                            const title = `WhatsApp Contact Numbers (${unshared.length} New)`;
                            const res = await shareToGlobal('phone', title, unshared);
                            if (res) {
                              showToast(`✓ Shared ${unshared.length} new phone number${unshared.length > 1 ? 's' : ''} to Global Space!`);
                            } else {
                              showToast('Failed to share to Global Space.');
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold bg-[#1F2329] hover:bg-[#282D35] text-[#25D366] border border-[#242930] transition-colors"
                        >
                          <Globe className="w-3 h-3 text-[#25D366]" />
                          <span>
                            {isAllShared
                              ? '✓ All Shared to Global'
                              : unshared.length < validPhones.length
                              ? `Share ${unshared.length} New to Global`
                              : 'Share to Global Space'}
                          </span>
                        </button>
                      );
                    })()}
                  </div>
                </div>

                <textarea
                  readOnly
                  value={displayText}
                  rows={Math.min(8, Math.max(3, validPhones.length))}
                  className="w-full bg-[#15181D] border border-[#242930] rounded-lg p-3 text-xs text-[#25D366] font-mono leading-relaxed outline-none select-all focus:border-[#25D366]"
                />
              </div>
            )}
          </div>
        );
      })()}

      {/* WhatsApp Masonry Card Grid */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#242930] rounded-2xl bg-[#15181D]/30 max-w-2xl mx-auto space-y-2">
            <MessageCircle className="w-8 h-8 text-zinc-600 mb-1" />
            <p className="text-xs text-zinc-400 font-bold font-mono">
              {search || statusFilter !== 'all' ? 'No matching WhatsApp contacts' : 'No WhatsApp outreach contacts yet'}
            </p>
            <p className="text-[11px] text-zinc-600 max-w-xs font-sans">
              Add contacts above or extract numbers from the AI Extractor tab!
            </p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-3.5">
            {filtered.map((contact) => {
              const isCopied = copiedId === contact.id;
              const isContacted = contact.status === 'contacted';

              return (
                <div
                  key={contact.id}
                  className={`break-inside-avoid mb-3.5 w-full group relative bg-[#15181D] hover:bg-[#181C22] border rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-150 overflow-hidden ${
                    isContacted
                      ? 'border-[#242930] opacity-80 hover:opacity-100'
                      : 'border-[#25D366]/40 hover:border-[#25D366]/80'
                  }`}
                >
                  {/* Top Header: Name/Phone + Batch Tag */}
                  <div className="space-y-1 pb-2 border-b border-[#242930]/60">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {contact.name ? (
                          <>
                            <h3 className="text-xs font-bold text-zinc-100 truncate">{contact.name}</h3>
                            <p className="text-[10px] font-mono text-[#25D366] font-bold">+{contact.phone}</p>
                          </>
                        ) : (
                          <h3 className="text-xs font-bold font-mono text-[#25D366]">+{contact.phone}</h3>
                        )}
                      </div>

                      {/* Status Toggle Badge */}
                      <button
                        onClick={() => toggleStatus(contact.id)}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border transition-colors shrink-0 ${
                          isContacted
                            ? 'bg-[#25D366]/15 text-[#25D366] border-[#25D366]/30'
                            : 'bg-[#E8B54D]/15 text-[#E8B54D] border-[#E8B54D]/30'
                        }`}
                        title="Click to toggle status"
                      >
                        {isContacted ? (
                          <>
                            <CheckCircle2 className="w-2.5 h-2.5 text-[#25D366]" />
                            <span>Done</span>
                          </>
                        ) : (
                          <>
                            <Circle className="w-2.5 h-2.5 text-[#E8B54D]" />
                            <span>Pending</span>
                          </>
                        )}
                      </button>
                    </div>

                    {contact.company && (
                      <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                        <Building2 className="w-3 h-3 text-zinc-500 shrink-0" />
                        <span className="truncate">{contact.company}</span>
                      </div>
                    )}

                    {contact.batch_title && (
                      <span className="inline-block text-[9px] font-mono text-zinc-500 bg-[#1F2329] px-1.5 py-0.5 rounded truncate max-w-full">
                        {contact.batch_title}
                      </span>
                    )}
                  </div>

                  {/* Message Snippet */}
                  <div className="py-2.5 space-y-1">
                    <p className="text-[11px] text-zinc-300 font-sans leading-relaxed line-clamp-3">
                      {contact.message}
                    </p>
                    <span className="text-[9px] font-mono text-sky-400 block truncate">
                      🔗 Includes Portfolio Link
                    </span>
                  </div>

                  {/* Big Action Bar */}
                  <div className="pt-2 border-t border-[#242930]/60 space-y-2">
                    {/* Launch Chat Button */}
                    <button
                      type="button"
                      onClick={() => handleLaunchChat(contact)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#25D366] hover:bg-[#20ba5a] text-black font-mono text-xs font-bold tracking-wide transition-all shadow active:scale-[0.98]"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Chat on WhatsApp</span>
                      <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                    </button>

                    {/* Card Utility Buttons */}
                    <div className="flex items-center justify-between text-zinc-500 pt-1">
                      <button
                        onClick={(e) => handleCopyLink(contact, e)}
                        className={`flex items-center gap-1 text-[10px] font-mono hover:text-zinc-200 transition-colors ${
                          isCopied ? 'text-[#25D366]' : ''
                        }`}
                        title="Copy direct wa.me link"
                      >
                        {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{isCopied ? 'Link Copied!' : 'Copy Link'}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingContact(contact);
                            setEditMessage(contact.message);
                          }}
                          className="p-1 hover:bg-[#1F2329] rounded text-zinc-400 hover:text-zinc-200 transition-colors"
                          title="Edit message"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setContactToDelete({ id: contact.id, name: contact.name || undefined, phone: contact.phone })}
                          className="p-1 hover:bg-red-950/40 rounded text-zinc-500 hover:text-red-400 transition-colors"
                          title="Delete contact"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pitch Template Settings Modal */}
      {showTemplateModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowTemplateModal(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#15181D] border border-[#242930] rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-[#242930] pb-3 font-mono text-xs">
              <div className="flex items-center gap-2 text-zinc-200 font-bold">
                <FileText className="w-3.5 h-3.5 text-[#25D366]" />
                <span>Default Pitch Message Template</span>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-1 rounded hover:bg-[#1F2329] text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              This message will be pre-filled automatically when generating WhatsApp outreach links.
            </p>

            <textarea
              value={customDefaultTemplate}
              onChange={(e) => setCustomDefaultTemplate(e.target.value)}
              rows={8}
              className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg p-3 text-xs text-zinc-200 outline-none focus:border-[#25D366] font-sans leading-relaxed resize-none"
            />

            <div className="flex items-center justify-end gap-2 pt-1 font-mono">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1F2329]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingTemplate || !customDefaultTemplate.trim()}
                onClick={async () => {
                  const ok = await saveTemplate(customDefaultTemplate);
                  if (ok) {
                    showToast('✓ WhatsApp pitch template saved to Supabase!');
                    setShowTemplateModal(false);
                  } else {
                    showToast('Failed to save pitch template');
                  }
                }}
                className="px-4 py-1.5 rounded bg-[#25D366] hover:bg-[#20ba5a] text-black text-xs font-bold tracking-wide transition-all shadow disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingTemplate ? 'Saving...' : 'Save Pitch Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {editingContact && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEditingContact(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#15181D] border border-[#242930] rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-[#242930] pb-3 font-mono text-xs">
              <div className="flex items-center gap-2 text-zinc-200 font-bold">
                <Edit3 className="w-3.5 h-3.5 text-[#25D366]" />
                <span>Customize Message for +{editingContact.phone}</span>
              </div>
              <button
                onClick={() => setEditingContact(null)}
                className="p-1 rounded hover:bg-[#1F2329] text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              value={editMessage}
              onChange={(e) => setEditMessage(e.target.value)}
              rows={7}
              className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg p-3 text-xs text-zinc-200 outline-none focus:border-[#25D366] font-sans leading-relaxed resize-none"
              autoFocus
            />

            <div className="flex items-center justify-end gap-2 pt-1 font-mono">
              <button
                type="button"
                onClick={() => setEditingContact(null)}
                className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1F2329]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-1.5 rounded bg-[#25D366] hover:bg-[#20ba5a] text-black text-xs font-bold tracking-wide"
              >
                Save Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!contactToDelete}
        title="Delete WhatsApp Contact"
        message={`Delete outreach card for ${contactToDelete?.name || contactToDelete?.phone}? This action cannot be undone.`}
        onConfirm={() => {
          if (contactToDelete) {
            deleteContact(contactToDelete.id);
            setContactToDelete(null);
            showToast('Contact deleted');
          }
        }}
        onCancel={() => setContactToDelete(null)}
      />
    </div>
  );
}
