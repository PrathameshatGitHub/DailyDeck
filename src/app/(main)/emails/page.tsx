'use client';

import { useState, useEffect } from 'react';
import { useEmails, type Email } from '@/lib/hooks/useEmails';
import { Copy, Plus, Trash2, CopyPlus, Search, CheckCircle2, Circle, Clock, Mail } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function EmailsPage() {
  const { emails, loading, addEmail, updateEmail, deleteEmail, duplicateEmail } = useEmails();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'updated' | 'alpha'>('newest');
  
  const [toast, setToast] = useState<string | null>(null);
  const [emailToDelete, setEmailToDelete] = useState<string | null>(null);

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
    if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === 'updated') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    if (sortBy === 'alpha') return a.title.localeCompare(b.title);
    return 0;
  });

  const pendingCount = emails.filter(e => e.status === 'pending').length;
  const completedCount = emails.filter(e => e.status === 'completed').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#7FE7C4] text-black px-4 py-2 rounded shadow-lg font-mono text-xs font-bold animate-in fade-in slide-in-from-top-4">
          {toast}
        </div>
      )}

      {/* Dev Stats Strip - Monospace */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#242930] gap-2 font-mono text-xs text-zinc-400">
        <div className="flex items-center gap-1">
          <span className="text-[#89295E] font-bold">&gt;</span>
          <span>email_templates:</span>
          <span className="text-zinc-200 ml-1">
            {pendingCount} pending &bull; {completedCount} completed &bull; {emails.length} total
          </span>
        </div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-widest">
          templates_active
        </div>
      </div>

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

      {/* Filters & Search - Monospace */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between pb-3 border-b border-[#242930] font-mono text-xs">
        <div className="flex flex-wrap gap-3">
          {/* Status Filter */}
          <div className="flex bg-[#15181D] p-0.5 rounded border border-[#242930]">
            {(['all', 'pending', 'completed'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  statusFilter === filter
                    ? 'bg-[#89295E] text-white'
                    : 'text-zinc-500 hover:text-zinc-350'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
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

        {/* Search */}
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

      <ConfirmModal 
        isOpen={!!emailToDelete}
        onConfirm={() => {
          if (emailToDelete) deleteEmail(emailToDelete);
        }}
        onCancel={() => setEmailToDelete(null)}
      />
    </div>
  );
}

function EmailCard({ 
  email, 
  onUpdate, 
  onDelete, 
  onDuplicate,
  onCopy
}: { 
  email: Email, 
  onUpdate: (id: string, updates: Partial<Email>) => void,
  onDelete: (id: string) => void,
  onDuplicate: (email: Email) => void,
  onCopy: (msg: string) => void
}) {
  const isCompleted = email.status === 'completed';
  
  // Local state for debounced content updates
  const [content, setContent] = useState(email.content || '');

  useEffect(() => {
    setContent(email.content || '');
  }, [email.content]);

  // Debounced auto-save for content
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

  return (
    <div className={`flex flex-col bg-[#15181D] border rounded-2xl overflow-hidden transition-colors ${
      isCompleted ? 'border-[#7FE7C4]/30' : 'border-[#242930] hover:border-zinc-700/80'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-[#242930] flex flex-wrap items-start justify-between gap-3 bg-[#0D0F12]/30">
        <div className="flex-1 min-w-0 space-y-2">
          <input 
            value={email.title}
            onChange={(e) => onUpdate(email.id, { title: e.target.value })}
            className="w-full bg-transparent border-none outline-none text-sm font-bold text-zinc-200 placeholder:text-zinc-600 truncate focus:text-white transition-colors"
            placeholder="Email Title..."
          />
          {email.category && (
            <span className="inline-block px-2 py-0.5 rounded border border-[#242930] bg-[#1F2329] text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
              {email.category}
            </span>
          )}
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

      {/* Body: Rich Text Area */}
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
