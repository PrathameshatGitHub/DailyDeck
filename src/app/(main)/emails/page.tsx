'use client';

import { useState, useEffect } from 'react';
import { useEmails, type Email } from '@/lib/hooks/useEmails';
import { MultiSelectBar } from '@/components/MultiSelectBar';
import { Copy, Plus, Trash2, CopyPlus, Search, CheckCircle2, Circle, Clock, Mail, Share2, Download, KeyRound, Lock } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function EmailsPage() {
  const { emails, loading, addEmail, updateEmail, deleteEmail, duplicateEmail, shareEmails, importEmails } = useEmails();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'updated' | 'alpha'>('newest');
  
  const [toast, setToast] = useState<string | null>(null);
  const [emailToDelete, setEmailToDelete] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Bulk Sharing states
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharePasscode, setSharePasscode] = useState('');
  const [shareKeyResult, setShareKeyResult] = useState('');
  const [shareLoading, setShareLoading] = useState(false);

  // Importing states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importShareKey, setImportShareKey] = useState('');
  const [importPasscode, setImportPasscode] = useState('');
  const [importError, setImportError] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  // New Email Form State
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await addEmail(newTitle.trim(), newCategory.trim(), '');
    setNewTitle('');
    setNewCategory('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] font-mono text-xs text-zinc-500">
        <span className="animate-pulse">&gt; loading_emails...</span>
      </div>
    );
  }

  // Filter & Sort
  let displayedEmails = emails.filter((email) => {
    const matchesSearch = 
      email.title.toLowerCase().includes(search.toLowerCase()) || 
      email.content.toLowerCase().includes(search.toLowerCase()) ||
      (email.category && email.category.toLowerCase().includes(search.toLowerCase()));
      
    const matchesStatus = statusFilter === 'all' ? true : email.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  displayedEmails.sort((a, b) => {
    const aOrder = a.status === 'pending' ? 0 : 1;
    const bOrder = b.status === 'pending' ? 0 : 1;
    if (aOrder !== bOrder) return aOrder - bOrder;

    if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === 'updated') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    if (sortBy === 'alpha') return a.title.localeCompare(b.title);
    return 0;
  });

  const pendingCount = emails.filter(e => e.status === 'pending').length;
  const completedCount = emails.filter(e => e.status === 'completed').length;

  const toggleSelect = (id: string) => {
    // Auto-enter selection mode if not already in it
    if (!isSelectionMode) {
      setIsSelectionMode(true);
    }
    
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setIsSelectionMode(true);
    setSelectedIds(new Set(displayedEmails.map(e => e.id)));
  };
  
  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkMarkCompleted = async () => {
    await Promise.all([...selectedIds].map(id => updateEmail(id, { status: 'completed' })));
    showToast(`${selectedIds.size} templates marked completed`);
    clearSelection();
    setIsSelectionMode(false);
  };

  const handleBulkMarkPending = async () => {
    await Promise.all([...selectedIds].map(id => updateEmail(id, { status: 'pending' })));
    showToast(`${selectedIds.size} templates marked pending`);
    clearSelection();
    setIsSelectionMode(false);
  };

  const handleBulkDelete = async () => {
    await Promise.all([...selectedIds].map(id => deleteEmail(id)));
    showToast(`${selectedIds.size} templates deleted`);
    clearSelection();
    setIsSelectionMode(false);
    setConfirmBulkDelete(false);
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto font-sans relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#7FE7C4] text-black px-4 py-2 rounded shadow-lg font-mono text-xs font-bold animate-in fade-in slide-in-from-top-4">
          {toast}
        </div>
      )}

      {/* Stats Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#242930] gap-2 font-mono text-xs text-zinc-400">
        <div className="flex items-center gap-1">
          <span className="text-[#89295E] font-bold">&gt;</span>
          <span>email_templates:</span>
          <span className="text-zinc-200 ml-1">
            {pendingCount} pending &bull; {completedCount} completed &bull; {emails.length} total
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isSelectionMode ? (
            <>
              <button
                onClick={() => {
                  const allSelected = selectedIds.size === displayedEmails.length;
                  if (allSelected) {
                    clearSelection();
                  } else {
                    selectAll();
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border border-zinc-700 bg-[#1F2329] text-zinc-300 hover:bg-[#282D35] transition-colors w-fit"
              >
                <div className={`w-3 h-3 rounded border flex items-center justify-center ${
                  selectedIds.size === displayedEmails.length ? 'bg-[#89295E] border-[#89295E]' : 'border-zinc-600'
                }`}>
                  {selectedIds.size === displayedEmails.length && <span className="text-white text-[8px] font-bold">✓</span>}
                </div>
                <span>{selectedIds.size === displayedEmails.length ? 'Deselect All' : 'Select All'}</span>
              </button>
              <button
                onClick={() => {
                  setIsSelectionMode(false);
                  clearSelection();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border border-zinc-700 bg-[#1F2329] text-zinc-300 hover:bg-[#282D35] transition-colors w-fit"
              >
                <span>Cancel Selection</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsSelectionMode(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border border-zinc-700 bg-[#1F2329] text-zinc-300 hover:bg-[#282D35] transition-colors w-fit"
            >
              <span>Select</span>
            </button>
          )}
          <button
            onClick={() => {
              setImportShareKey('');
              setImportPasscode('');
              setImportError('');
              setIsImportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border border-zinc-700 bg-[#1F2329] text-zinc-300 hover:bg-[#282D35] transition-colors w-fit"
            title="Import shared templates bundle"
          >
            <Download className="w-3 h-3 text-[#ff8ac8]" />
            <span>Import Shared Templates</span>
          </button>
          <div className="text-[10px] text-zinc-500 uppercase tracking-widest hidden sm:block">templates_active</div>
        </div>
      </div>

      {/* Multi-Select Bar */}
      {selectedIds.size > 0 && (
        <MultiSelectBar
          selectedCount={selectedIds.size}
          totalCount={displayedEmails.length}
          onMarkCompleted={handleBulkMarkCompleted}
          onMarkPending={handleBulkMarkPending}
          onDeleteSelected={() => setConfirmBulkDelete(true)}
          onShareSelected={() => {
            setSharePasscode('');
            setShareKeyResult('');
            setIsShareModalOpen(true);
          }}
        />
      )}

      {/* Creation Form */}
      <form onSubmit={handleCreate} className="flex flex-wrap gap-3 bg-[#15181D] p-3 border border-[#242930] rounded">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <span className="font-mono text-xs text-[#89295E] select-none">&gt;</span>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Template Title..."
            className="flex-1 bg-transparent border-none outline-none text-xs text-zinc-200 placeholder:text-zinc-600 font-mono"
            required
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Category (optional)..."
            className="w-full sm:w-48 bg-[#1F2329] px-2 py-1.5 rounded border border-[#242930] outline-none focus:border-zinc-700 text-xs text-zinc-200 placeholder:text-zinc-600 font-mono"
          />
          <button
            type="submit"
            className="px-4 py-1.5 rounded bg-[#89295E] hover:bg-[#a03672] text-white text-xs font-bold font-mono tracking-wide transition-all active:scale-[0.98] shrink-0"
          >
            CREATE
          </button>
        </div>
      </form>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between pb-3 border-b border-[#242930] font-mono text-xs">
        <div className="flex flex-wrap gap-3">
          <div className="flex bg-[#15181D] p-0.5 rounded border border-[#242930]">
            {(['all', 'pending', 'completed'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  statusFilter === filter ? 'bg-[#89295E] text-white' : 'text-zinc-500 hover:text-zinc-350'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-[#15181D] text-zinc-400 border border-[#242930] rounded px-3 py-1.5 outline-none focus:border-zinc-700 uppercase tracking-wider text-[10px] font-bold cursor-pointer"
          >
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="updated">Sort: Recently Updated</option>
            <option value="alpha">Sort: Alphabetical</option>
          </select>
        </div>

        <div className="relative min-w-[200px] sm:w-64">
          <Search className="w-3.5 h-3.5 text-zinc-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="filter_templates..."
            className="w-full pl-8 pr-3 py-1.5 rounded bg-[#15181D] border border-[#242930] outline-none focus:border-zinc-700 text-zinc-200 placeholder:text-zinc-650"
          />
        </div>
      </div>

      {/* Email Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {displayedEmails.map((email) => (
          <EmailCard 
            key={email.id} 
            email={email} 
            onUpdate={updateEmail} 
            onDelete={setEmailToDelete}
            onDuplicate={duplicateEmail}
            onCopy={showToast}
            isSelected={selectedIds.has(email.id)}
            onToggleSelect={toggleSelect}
            showCheckbox={isSelectionMode}
          />
        ))}

        {displayedEmails.length === 0 && (
          <div className="col-span-1 lg:col-span-2 flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#242930] rounded font-mono">
            <Mail className="w-8 h-8 text-zinc-700 mb-3" />
            <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">
              {search.trim() ? "No matching templates found." : "No templates yet. Create one above."}
            </p>
          </div>
        )}
      </div>

      {/* Single delete confirm */}
      <ConfirmModal 
        isOpen={!!emailToDelete}
        title="Delete Email Template"
        message="Are you sure you want to delete this email template?"
        onConfirm={() => {
          if (emailToDelete) deleteEmail(emailToDelete);
          setEmailToDelete(null);
        }}
        onCancel={() => setEmailToDelete(null)}
      />

      {/* Bulk delete confirm */}
      <ConfirmModal
        isOpen={confirmBulkDelete}
        title={`Delete ${selectedIds.size} Templates`}
        message={`Are you sure you want to permanently delete ${selectedIds.size} selected email templates? This cannot be undone.`}
        onConfirm={handleBulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />

      {/* Share Email Templates Modal */}
      {isShareModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 font-mono"
          onClick={() => setIsShareModalOpen(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#15181D] border border-[#242930] rounded-xl w-full max-w-md shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-[#242930] pb-3">
              <div className="flex items-center gap-2 text-xs text-zinc-200 font-bold uppercase tracking-wider">
                <Share2 className="w-4 h-4 text-[#ff8ac8]" />
                <span>Share Templates Bundle</span>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="p-1 rounded text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            </div>

            <div className="text-[11px] text-zinc-400 font-sans leading-relaxed">
              Sharing a bundle of <strong className="text-zinc-200 font-mono">{selectedIds.size} email templates</strong>. 
              Anyone with the generated <strong className="text-[#ff8ac8]">Share Key</strong> and passcode can import copies of these templates into their project.
            </div>

            {!shareKeyResult ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                    Set Passcode / Password
                  </label>
                  <input
                    type="text"
                    value={sharePasscode}
                    onChange={(e) => setSharePasscode(e.target.value)}
                    placeholder="e.g. 1234 or team_pass"
                    className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-650 outline-none focus:border-[#89295E] select-all font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#242930]">
                  <button
                    type="button"
                    onClick={() => setIsShareModalOpen(false)}
                    className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1F2329]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={shareLoading || !sharePasscode.trim()}
                    onClick={async () => {
                      setShareLoading(true);
                      const key = await shareEmails(Array.from(selectedIds), sharePasscode);
                      setShareLoading(false);
                      if (key) {
                        setShareKeyResult(key);
                        showToast('Templates shared successfully!');
                      } else {
                        showToast('Failed to create shared templates.');
                      }
                    }}
                    className="px-4 py-1.5 rounded bg-[#89295E] hover:bg-[#a03672] disabled:opacity-40 text-white text-xs font-bold tracking-wide"
                  >
                    {shareLoading ? 'Sharing...' : 'Share Templates'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-[#0D0F12] border border-[#242930] p-3 rounded-lg space-y-2.5">
                  <div>
                    <label className="block text-[8px] text-zinc-500 uppercase font-bold tracking-wider mb-0.5">Share Key</label>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[#7FE7C4] font-bold font-mono select-all">{shareKeyResult}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(shareKeyResult);
                            showToast('Share Key copied!');
                          } catch {}
                        }}
                        className="px-2 py-0.5 rounded bg-[#1F2329] border border-[#242930] hover:text-zinc-200 text-[10px] text-zinc-400 transition-colors"
                      >
                        Copy Key
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[8px] text-zinc-500 uppercase font-bold tracking-wider mb-0.5">Required Passcode</label>
                    <span className="text-xs text-zinc-300 font-bold font-mono">{sharePasscode}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-[#242930]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsShareModalOpen(false);
                      clearSelection();
                      setIsSelectionMode(false);
                    }}
                    className="px-4 py-1.5 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-xs font-bold"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import Shared Email Templates Modal */}
      {isImportModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 font-mono"
          onClick={() => setIsImportModalOpen(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#15181D] border border-[#242930] rounded-xl w-full max-w-md shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-[#242930] pb-3">
              <div className="flex items-center gap-2 text-xs text-zinc-200 font-bold uppercase tracking-wider">
                <Download className="w-4 h-4 text-[#ff8ac8]" />
                <span>Import Templates Bundle</span>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
              Enter the Share Key and passcode of the shared bundle to import them into your email templates list.
            </p>

            {importError && (
              <div className="p-2 bg-red-950/30 border border-red-900/50 rounded-lg text-[10px] text-red-400">
                Error: {importError}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                  Share Key (e.g. share-xxxxxx)
                </label>
                <input
                  type="text"
                  value={importShareKey}
                  onChange={(e) => setImportShareKey(e.target.value)}
                  placeholder="share-xxxxxx"
                  className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-650 outline-none focus:border-[#89295E] font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                  Enter Passcode
                </label>
                <input
                  type="password"
                  value={importPasscode}
                  onChange={(e) => setImportPasscode(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-650 outline-none focus:border-[#89295E] font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#242930]">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1F2329]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={importLoading || !importShareKey.trim() || !importPasscode.trim()}
                  onClick={async () => {
                    setImportLoading(true);
                    setImportError('');
                    const result = await importEmails(importShareKey, importPasscode);
                    setImportLoading(false);
                    if (result.success) {
                      showToast(`✓ Imported ${result.count} template${(result.count || 0) > 1 ? 's' : ''} shared by ${result.ownerName}!`);
                      setIsImportModalOpen(false);
                    } else {
                      setImportError('Invalid Share Key, incorrect passcode, or the templates were deleted.');
                    }
                  }}
                  className="px-4 py-1.5 rounded bg-[#89295E] hover:bg-[#a03672] disabled:opacity-40 text-white text-xs font-bold tracking-wide"
                >
                  {importLoading ? 'Importing...' : 'Import Templates'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmailCard({ 
  email, 
  onUpdate, 
  onDelete, 
  onDuplicate,
  onCopy,
  isSelected,
  onToggleSelect,
  showCheckbox,
}: { 
  email: Email, 
  onUpdate: (id: string, updates: Partial<Email>) => void,
  onDelete: (id: string) => void,
  onDuplicate: (email: Email) => void,
  onCopy: (msg: string) => void,
  isSelected: boolean,
  onToggleSelect: (id: string) => void,
  showCheckbox: boolean,
}) {
  const isCompleted = email.status === 'completed';
  
  const [content, setContent] = useState(email.content || '');

  useEffect(() => {
    setContent(email.content || '');
  }, [email.content]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (content !== email.content) {
        onUpdate(email.id, { content });
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [content, email.content, email.id, onUpdate]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    onCopy("Email copied successfully.");
  };

  const emailMatches = (content.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g) || []);
  const emailCount = new Set(emailMatches.map(e => e.toLowerCase().trim())).size;

  return (
    <div
      className={`flex flex-col bg-[#15181D] border rounded-2xl overflow-hidden transition-all ${
        isSelected && showCheckbox
          ? 'border-[#89295E] ring-2 ring-[#89295E]/30'
          : isCompleted ? 'border-[#7FE7C4]/30' : 'border-[#242930] hover:border-zinc-700/80'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-[#242930] flex flex-wrap items-start justify-between gap-3 bg-[#0D0F12]/30">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {/* Checkbox for multi-select - only show when in selection mode */}
          {showCheckbox && (
            <button
              onClick={() => onToggleSelect(email.id)}
              className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                isSelected
                  ? 'bg-[#89295E] border-[#89295E]'
                  : 'border-zinc-600'
              }`}
            >
              {isSelected && <span className="text-white text-[8px] font-bold">✓</span>}
            </button>
          )}
          <div className="flex-1 min-w-0 space-y-2">
            <input 
              value={email.title || ''}
              onChange={(e) => onUpdate(email.id, { title: e.target.value })}
              className="w-full bg-transparent border-none outline-none text-sm font-bold text-zinc-200 placeholder:text-zinc-600 truncate focus:text-white transition-colors"
              placeholder="Email Title..."
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              {emailCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#7FE7C4]/30 bg-[#7FE7C4]/15 text-[10px] font-mono font-bold text-[#7FE7C4]">
                  <Mail className="w-3 h-3" />
                  {emailCount} {emailCount === 1 ? 'email' : 'emails'}
                </span>
              )}
              {email.category && (
                <span className="inline-block px-2 py-0.5 rounded border border-[#242930] bg-[#1F2329] text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  {email.category}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status Segmented Control */}
        <div className="flex bg-[#1F2329] p-0.5 rounded-lg border border-[#242930] shrink-0 font-mono text-[9px] font-bold uppercase tracking-wider">
          <button
            onClick={() => onUpdate(email.id, { status: 'pending' })}
            className={`px-2 py-1 rounded-md flex items-center gap-1.5 transition-all ${
              !isCompleted ? 'bg-[#E8B54D] text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Circle className={`w-3 h-3 ${!isCompleted ? 'text-black' : 'text-zinc-600'}`} />
            Pending
          </button>
          <button
            onClick={() => onUpdate(email.id, { status: 'completed' })}
            className={`px-2 py-1 rounded-md flex items-center gap-1.5 transition-all ${
              isCompleted ? 'bg-[#7FE7C4] text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <CheckCircle2 className={`w-3 h-3 ${isCompleted ? 'text-black' : 'text-zinc-600'}`} />
            Completed
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 bg-[#15181D]">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start typing your email template here..."
          className="w-full h-48 bg-transparent border-none outline-none text-xs text-zinc-300 leading-relaxed placeholder:text-zinc-600 resize-none font-sans"
        />
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-[#242930] bg-[#0D0F12]/30 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 font-mono text-[9px] text-zinc-500 uppercase tracking-wider font-bold">
          <div className="flex items-center gap-1" title="Created">
            <Plus className="w-3 h-3 text-zinc-600" />
            {new Date(email.created_at).toLocaleDateString()}
          </div>
          <div className="flex items-center gap-1" title="Updated">
            <Clock className="w-3 h-3 text-zinc-600" />
            {new Date(email.updated_at).toLocaleDateString()}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onDelete(email.id)}
            className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-[#1F2329] transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDuplicate(email)}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-[#1F2329] transition-colors"
            title="Duplicate"
          >
            <CopyPlus className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F2329] hover:bg-zinc-800 border border-[#242930] text-zinc-200 text-[10px] font-mono font-bold uppercase tracking-wider transition-all active:scale-[0.98] ml-1"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Content
          </button>
        </div>
      </div>
    </div>
  );
}
