'use client';

import { useState } from 'react';
import { useGlobalSpace, type GlobalShare } from '@/lib/hooks/useGlobalSpace';
import { useEmails } from '@/lib/hooks/useEmails';
import { useWhatsApp, DEFAULT_WHATSAPP_TEMPLATE } from '@/lib/hooks/useWhatsApp';
import {
  Globe,
  Mail,
  Phone,
  Search,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Plus,
  User,
  Calendar,
  X,
  Sparkles,
  MessageCircle,
  FileText
} from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function GlobalSpacePage() {
  const { shares, loading, deleteGlobalShare } = useGlobalSpace();
  const { addEmail } = useEmails();
  const { addBatchContacts } = useWhatsApp();

  const [activeTab, setActiveTab] = useState<'emails' | 'phones'>('emails');
  const [search, setSearch] = useState('');
  const [cardToDelete, setCardToDelete] = useState<GlobalShare | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const emailShares = shares.filter((s) => s.type === 'email');
  const phoneShares = shares.filter((s) => s.type === 'phone');

  const activeShares = activeTab === 'emails' ? emailShares : phoneShares;

  const filteredShares = activeShares.filter((s) => {
    const term = search.toLowerCase();
    return (
      s.title.toLowerCase().includes(term) ||
      s.sender_name.toLowerCase().includes(term) ||
      s.items.some((item) => item.toLowerCase().includes(term))
    );
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

      {/* Page Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#242930] gap-3 font-mono text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#89295E]" />
          <span className="text-zinc-100 font-bold text-sm">global_space</span>
          <span className="text-zinc-600">&bull;</span>
          <span className="text-zinc-400">Shared Repository across All Members</span>
        </div>

        {/* Counts Badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#15181D] border border-[#242930] text-[11px]">
            <Mail className="w-3.5 h-3.5 text-[#7FE7C4]" />
            <span className="text-zinc-300 font-bold">{emailShares.length} Email Bundles</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#15181D] border border-[#242930] text-[11px]">
            <Phone className="w-3.5 h-3.5 text-[#25D366]" />
            <span className="text-zinc-300 font-bold">{phoneShares.length} Phone Bundles</span>
          </div>
        </div>
      </div>

      {/* Sub-Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Sub-Tabs: Emails vs Phone Numbers */}
        <div className="flex bg-[#15181D] p-1 rounded-xl border border-[#242930] w-fit font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('emails')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'emails'
                ? 'bg-[#89295E] text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1A1D24]'
            }`}
          >
            <Mail className="w-4 h-4 text-[#7FE7C4]" />
            <span>Emails Collections ({emailShares.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('phones')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'phones'
                ? 'bg-[#89295E] text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1A1D24]'
            }`}
          >
            <Phone className="w-4 h-4 text-[#25D366]" />
            <span>Phone Numbers ({phoneShares.length})</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-md bg-[#15181D] border border-[#242930] rounded-xl flex items-center px-3.5 py-2 focus-within:border-[#89295E]/60 transition-colors">
          <Search className="w-4 h-4 text-zinc-500 mr-2.5 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search shared ${activeTab === 'emails' ? 'emails' : 'phone numbers'} by title, sender, or content...`}
            className="w-full bg-transparent text-xs text-zinc-200 outline-none border-none placeholder:text-zinc-600 font-sans"
          />
          {search && (
            <button onClick={() => setSearch('')} className="p-0.5 text-zinc-500 hover:text-zinc-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Shared Cards Grid */}
      <div className="space-y-4">
        {loading && shares.length === 0 ? (
          <div className="flex items-center justify-center py-20 font-mono text-xs text-zinc-500">
            <span className="animate-pulse">&gt; loading_global_space_shares...</span>
          </div>
        ) : filteredShares.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#242930] rounded-2xl bg-[#15181D]/30 max-w-2xl mx-auto space-y-2">
            <Globe className="w-8 h-8 text-zinc-600 mb-1" />
            <p className="text-xs text-zinc-400 font-bold font-mono">
              {search
                ? `No matching ${activeTab} collections found`
                : `No shared ${activeTab === 'emails' ? 'email' : 'phone number'} collections yet`}
            </p>
            <p className="text-[11px] text-zinc-600 max-w-sm font-sans">
              Go to the <strong className="text-zinc-400 font-mono">AI Extractor</strong>, <strong className="text-zinc-400 font-mono">Emails</strong>, or <strong className="text-zinc-400 font-mono">WhatsApp</strong> tabs and click <span className="text-[#7FE7C4] font-bold">"Share to Global Space"</span> to post collections here!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredShares.map((share) => (
              <GlobalShareCardItem
                key={share.id}
                share={share}
                onDelete={() => setCardToDelete(share)}
                onSaveToEmails={async (title, content) => {
                  await addEmail(title, 'Global Space Import', content);
                  showToast(`Saved "${title}" to your Emails tab!`);
                }}
                onSaveToWhatsApp={async (title, phoneNumbers) => {
                  const items = phoneNumbers.map((p) => ({ phone: p }));
                  await addBatchContacts(items, title);
                  showToast(`Saved ${phoneNumbers.length} contacts to WhatsApp tab ("${title}")!`);
                }}
                onNotify={(msg) => showToast(msg)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!cardToDelete}
        title="Delete Shared Collection"
        message={`Delete shared collection "${cardToDelete?.title}" from Global Space? This action cannot be undone.`}
        onConfirm={() => {
          if (cardToDelete) {
            deleteGlobalShare(cardToDelete.id);
            setCardToDelete(null);
            showToast('Collection deleted from Global Space');
          }
        }}
        onCancel={() => setCardToDelete(null)}
      />
    </div>
  );
}

function GlobalShareCardItem({
  share,
  onDelete,
  onSaveToEmails,
  onSaveToWhatsApp,
  onNotify,
}: {
  share: GlobalShare;
  onDelete: () => void;
  onSaveToEmails: (title: string, content: string) => Promise<void>;
  onSaveToWhatsApp: (title: string, phoneNumbers: string[]) => Promise<void>;
  onNotify: (msg: string) => void;
}) {
  const [format, setFormat] = useState<'comma' | 'lines'>('comma');
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  const formattedDate = new Date(share.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isEmail = share.type === 'email';
  const commaText = share.items.join(', ');
  const linesText = share.items.join('\n');
  const displayText = format === 'comma' ? commaText : linesText;
  const mailtoBccUrl = isEmail ? `mailto:?bcc=${encodeURIComponent(commaText)}` : '';

  const handleCopy = async (targetFormat: 'comma' | 'lines') => {
    const textToCopy = targetFormat === 'comma' ? commaText : linesText;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedFormat(targetFormat);
      onNotify(`Copied ${share.items.length} ${isEmail ? 'emails' : 'phone numbers'} (${targetFormat})!`);
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch {
      onNotify('Failed to copy to clipboard');
    }
  };

  return (
    <div className="bg-[#15181D] border border-[#242930] hover:border-[#89295E]/60 rounded-2xl p-4.5 space-y-3.5 shadow-md flex flex-col justify-between transition-all duration-150">
      {/* Header: Sender Name, Date, Share Title & Delete */}
      <div className="space-y-2 pb-2.5 border-b border-[#242930]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[#89295E]/20 border border-[#89295E]/40 flex items-center justify-center text-[#ff8ac8] shrink-0 font-mono text-xs font-bold">
              {share.sender_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-zinc-200 truncate block">
                {share.sender_name}
              </span>
              <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5 text-zinc-600" />
                {formattedDate}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 font-mono">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                isEmail
                  ? 'bg-[#7FE7C4]/15 text-[#7FE7C4] border-[#7FE7C4]/30'
                  : 'bg-[#25D366]/15 text-[#25D366] border-[#25D366]/30'
              }`}
            >
              {share.items.length} {isEmail ? (share.items.length === 1 ? 'Email' : 'Emails') : (share.items.length === 1 ? 'Number' : 'Numbers')}
            </span>

            <button
              type="button"
              onClick={onDelete}
              className="p-1 hover:bg-red-950/40 rounded text-zinc-500 hover:text-red-400 transition-colors"
              title="Delete shared collection"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <h3 className="text-sm font-bold text-zinc-100 font-sans tracking-tight">
          {share.title}
        </h3>
      </div>

      {/* Format Selector & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px]">
        {/* Format Selector */}
        <div className="flex bg-[#0D0F12] p-0.5 rounded-lg border border-[#242930]">
          <button
            type="button"
            onClick={() => setFormat('comma')}
            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
              format === 'comma' ? 'bg-[#89295E] text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Comma
          </button>
          <button
            type="button"
            onClick={() => setFormat('lines')}
            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
              format === 'lines' ? 'bg-[#89295E] text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Line-by-Line
          </button>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleCopy(format)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold font-mono transition-all ${
              copiedFormat === format
                ? 'bg-[#7FE7C4] text-black'
                : 'bg-[#1F2329] hover:bg-[#282D35] text-zinc-300 border border-[#242930]'
            }`}
          >
            {copiedFormat === format ? <Check className="w-3 h-3 text-black" /> : <Copy className="w-3 h-3 text-[#7FE7C4]" />}
            <span>{copiedFormat === format ? 'Copied!' : 'Copy'}</span>
          </button>

          {isEmail ? (
            <>
              <a
                href={mailtoBccUrl}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold bg-[#1F2329] hover:bg-[#282D35] text-sky-300 border border-[#242930] transition-colors"
                title="Open in default Mail app with BCC"
              >
                <ExternalLink className="w-3 h-3 text-sky-400" />
                <span>Mail (BCC)</span>
              </a>

              <button
                type="button"
                onClick={() => onSaveToEmails(share.title, commaText)}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold bg-[#89295E] hover:bg-[#a03672] text-white transition-colors"
                title="Save this bundle to your Emails tab"
              >
                <Plus className="w-3 h-3" />
                <span>Save to Emails</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onSaveToWhatsApp(share.title, share.items)}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold bg-[#25D366] hover:bg-[#20ba5a] text-black transition-colors"
              title="Save these numbers to your WhatsApp tab"
            >
              <Plus className="w-3 h-3" />
              <span>Save to WhatsApp</span>
            </button>
          )}
        </div>
      </div>

      {/* Items Preview Area */}
      <textarea
        readOnly
        value={displayText}
        rows={Math.min(6, Math.max(3, share.items.length))}
        className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg p-3 text-xs text-[#7FE7C4] font-mono leading-relaxed outline-none select-all focus:border-[#89295E]"
      />
    </div>
  );
}
