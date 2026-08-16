'use client';

import { useState, useRef, useEffect } from 'react';
import { useNotes, type Note } from '@/lib/hooks/useNotes';
import { 
  Plus, 
  Trash2, 
  Search, 
  Copy, 
  Check, 
  Edit3, 
  Calendar as CalendarIcon, 
  X, 
  Sparkles,
  FileText,
  Clock,
  Pin,
  PinOff
} from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function NotesPage() {
  const { notes, loading, addNote, updateNote, togglePin, deleteNote } = useNotes();
  const [content, setContent] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isPinnedDraft, setIsPinnedDraft] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [search, setSearch] = useState('');
  
  // Note actions state
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editContent, setEditContent] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // Close creator on outside click if empty
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!content.trim()) {
          setIsExpanded(false);
          setIsPinnedDraft(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [content]);

  // Adjust height on input
  useEffect(() => {
    if (textareaRef.current && isExpanded) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 72)}px`;
    }
  }, [content, isExpanded]);

  const handleAdd = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim()) return;
    await addNote(content.trim(), selectedDate, isPinnedDraft);
    setContent('');
    setIsPinnedDraft(false);
    setIsExpanded(false);
    showToast(isPinnedDraft ? 'Pinned note created' : 'Note created');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleAdd();
    }
  };

  const handleCopy = async (note: Note, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(note.content);
      setCopiedId(note.id);
      showToast('Copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast('Failed to copy');
    }
  };

  const handleTogglePin = async (note: Note, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await togglePin(note.id);
    showToast(note.is_pinned ? 'Unpinned note' : 'Pinned to top');
  };

  const handleStartEdit = (note: Note, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingNote(note);
    setEditContent(note.content);
  };

  const handleSaveEdit = async () => {
    if (editingNote && editContent.trim()) {
      await updateNote(editingNote.id, editContent.trim());
      setEditingNote(null);
      setEditContent('');
      showToast('Note updated');
    }
  };

  const formatNoteDate = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';

    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] font-mono text-xs text-zinc-500">
        <span className="animate-pulse">&gt; loading_notes...</span>
      </div>
    );
  }

  // Filter notes by search
  const filteredNotes = notes.filter((note) =>
    note.content.toLowerCase().includes(search.toLowerCase())
  );

  const pinnedNotes = filteredNotes.filter((n) => n.is_pinned);
  const otherNotes = filteredNotes.filter((n) => !n.is_pinned);

  // Render an individual Google Keep Card
  const renderNoteCard = (note: Note) => {
    const isCopied = copiedId === note.id;
    const timeFormatted = new Date(note.created_at).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const dateLabel = formatNoteDate(note.note_date);

    return (
      <div
        key={note.id}
        onClick={() => handleStartEdit(note)}
        className={`break-inside-avoid mb-3.5 w-full group relative bg-[#15181D] hover:bg-[#181C22] border rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer overflow-hidden ${
          note.is_pinned 
            ? 'border-[#89295E]/50 hover:border-[#89295E]/80 bg-[#16141a]' 
            : 'border-[#242930] hover:border-zinc-600'
        }`}
      >
        {/* Top Header Row of Card: Date badge & Pin button */}
        <div className="flex items-center justify-between pb-2 mb-1 border-b border-[#242930]/40">
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
            note.is_pinned ? 'text-[#ff92cd] bg-[#89295E]/20' : 'text-zinc-400 bg-[#1F2329]'
          }`}>
            {dateLabel}
          </span>

          <button
            onClick={(e) => handleTogglePin(note, e)}
            className={`p-1 rounded-md transition-all ${
              note.is_pinned
                ? 'text-[#89295E] hover:text-[#ff8ac8] bg-[#89295E]/10'
                : 'text-zinc-600 hover:text-zinc-200 hover:bg-[#1F2329] opacity-90 sm:opacity-0 sm:group-hover:opacity-100'
            }`}
            title={note.is_pinned ? 'Unpin note' : 'Pin note'}
          >
            {note.is_pinned ? (
              <Pin className="w-3.5 h-3.5 fill-[#89295E]" />
            ) : (
              <Pin className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Note Body */}
        <div className="py-1">
          <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans break-words selection:bg-[#89295E]/40">
            {note.content}
          </p>
        </div>

        {/* Bottom Action Bar */}
        <div className="mt-3 pt-2 border-t border-[#242930]/60 flex items-center justify-between text-zinc-500">
          <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 text-zinc-600" />
            {timeFormatted}
          </span>

          <div className="flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {/* Copy Button */}
            <button
              onClick={(e) => handleCopy(note, e)}
              className={`p-1.5 rounded-lg transition-colors ${
                isCopied 
                  ? 'bg-[#7FE7C4]/20 text-[#7FE7C4]' 
                  : 'hover:bg-[#1F2329] text-zinc-400 hover:text-zinc-200'
              }`}
              title="Copy note content"
            >
              {isCopied ? (
                <Check className="w-3.5 h-3.5 text-[#7FE7C4]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Edit Button */}
            <button
              onClick={(e) => handleStartEdit(note, e)}
              className="p-1.5 rounded-lg hover:bg-[#1F2329] text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Edit note"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            {/* Delete Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setNoteToDelete(note.id);
              }}
              className="p-1.5 rounded-lg hover:bg-red-950/40 text-zinc-400 hover:text-red-400 transition-colors"
              title="Delete note"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-7 max-w-6xl mx-auto font-sans pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 bg-[#7FE7C4] text-black px-4 py-2 rounded-lg shadow-xl font-mono text-xs font-bold animate-in fade-in slide-in-from-top-3 flex items-center gap-2">
          <Check className="w-3.5 h-3.5" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header Info Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#242930] gap-2 font-mono text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#89295E]" />
          <span className="text-zinc-200 font-bold">journal_vault</span>
          <span className="text-zinc-500">&bull;</span>
          <span className="text-zinc-400">{notes.length} {notes.length === 1 ? 'note' : 'notes'} stored</span>
          {pinnedNotes.length > 0 && (
            <>
              <span className="text-zinc-500">&bull;</span>
              <span className="text-[#ff92cd]">{pinnedNotes.length} pinned</span>
            </>
          )}
        </div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
          google_keep_masonry_layout
        </div>
      </div>

      {/* Top Google Keep Style "Take a note" Creator */}
      <div className="max-w-2xl mx-auto" ref={containerRef}>
        <div className={`bg-[#15181D] border border-[#242930] rounded-xl shadow-lg transition-all duration-200 overflow-hidden ${
          isExpanded ? 'ring-1 ring-[#89295E]/50 border-[#89295E]/60 shadow-[#89295E]/5' : 'hover:border-zinc-700'
        }`}>
          {!isExpanded ? (
            <div
              onClick={() => {
                setIsExpanded(true);
                setTimeout(() => textareaRef.current?.focus(), 50);
              }}
              className="p-3.5 flex items-center justify-between cursor-text text-zinc-400 hover:text-zinc-300"
            >
              <div className="flex items-center gap-3 font-mono text-xs">
                <span className="text-[#89295E] font-bold">&gt;</span>
                <span className="text-zinc-500">Take a note...</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-500">
                <span className="text-[10px] font-mono border border-[#242930] px-1.5 py-0.5 rounded bg-[#1F2329]/50">
                  Ctrl+Enter
                </span>
                <Plus className="w-4 h-4 text-zinc-400" />
              </div>
            </div>
          ) : (
            <form onSubmit={handleAdd} className="p-4 space-y-3">
              {/* Note Content Input */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Take a note... (write details, ideas, code snippets)"
                rows={3}
                className="w-full bg-transparent border-none outline-none text-xs text-zinc-200 placeholder:text-zinc-600 resize-none font-sans leading-relaxed"
                autoFocus
              />

              {/* Bottom bar inside Note Creator */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#242930]/80">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-[#1F2329] border border-[#242930] px-2 py-1 rounded text-[11px] font-mono text-zinc-300">
                    <CalendarIcon className="w-3 h-3 text-[#89295E]" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-transparent border-none outline-none text-[11px] text-zinc-300 font-mono cursor-pointer"
                    />
                  </div>

                  {/* Pin toggle for draft */}
                  <button
                    type="button"
                    onClick={() => setIsPinnedDraft(!isPinnedDraft)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                      isPinnedDraft 
                        ? 'bg-[#89295E]/20 text-[#ff8ac8] border-[#89295E]/50' 
                        : 'bg-[#1F2329] text-zinc-400 border-[#242930] hover:text-zinc-200'
                    }`}
                    title="Pin this note"
                  >
                    <Pin className={`w-3 h-3 ${isPinnedDraft ? 'fill-[#89295E]' : ''}`} />
                    <span>{isPinnedDraft ? 'Pinned' : 'Pin'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      setIsExpanded(false);
                      setIsPinnedDraft(false);
                      setContent('');
                    }}
                    className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1F2329] transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={!content.trim()}
                    className="px-4 py-1.5 rounded bg-[#89295E] hover:bg-[#a03672] disabled:opacity-40 disabled:hover:bg-[#89295E] text-white text-xs font-bold tracking-wide transition-all shadow active:scale-[0.98]"
                  >
                    Save Note
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-2xl mx-auto">
        <div className="relative bg-[#15181D]/80 border border-[#242930] rounded-xl flex items-center px-3.5 py-2 font-mono shadow-sm focus-within:border-[#89295E]/70 transition-colors">
          <Search className="w-4 h-4 text-zinc-500 mr-2.5 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full bg-transparent text-xs text-zinc-200 outline-none border-none placeholder:text-zinc-600 font-sans"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="p-1 hover:bg-[#1F2329] rounded text-zinc-500 hover:text-zinc-300 text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Masonry Layout without Wasted Whitespace */}
      <div className="space-y-8">
        {/* Pinned Notes Section (if any pinned notes exist) */}
        {pinnedNotes.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
              <Pin className="w-3 h-3 text-[#89295E] fill-[#89295E]" />
              <span>PINNED ({pinnedNotes.length})</span>
            </div>
            <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-3.5">
              {pinnedNotes.map((note) => renderNoteCard(note))}
            </div>
          </div>
        )}

        {/* Other / All Notes Section */}
        {otherNotes.length > 0 && (
          <div className="space-y-3">
            {pinnedNotes.length > 0 && (
              <div className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                OTHERS ({otherNotes.length})
              </div>
            )}
            <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-3.5">
              {otherNotes.map((note) => renderNoteCard(note))}
            </div>
          </div>
        )}


        {/* Empty / No Results State */}
        {filteredNotes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#242930] rounded-2xl font-mono bg-[#15181D]/30 max-w-2xl mx-auto space-y-2">
            <Sparkles className="w-6 h-6 text-zinc-600 mb-1" />
            <p className="text-xs text-zinc-400 font-bold">
              {search.trim() ? `No logs found matching "${search}"` : 'No notes created yet'}
            </p>
            <p className="text-[11px] text-zinc-600 font-sans max-w-xs">
              {search.trim() ? 'Try clearing your search query' : 'Click the box above to write your first note.'}
            </p>
          </div>
        )}
      </div>

      {/* Edit Note Modal (Google Keep Pop-up style) */}
      {editingNote && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEditingNote(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#15181D] border border-[#242930] rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-[#242930] pb-3">
              <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
                <Edit3 className="w-3.5 h-3.5 text-[#89295E]" />
                <span>edit_note</span>
                <span className="text-zinc-600">&bull;</span>
                <span className="text-[11px] text-zinc-500">{editingNote.note_date}</span>
                {editingNote.is_pinned && (
                  <span className="text-[10px] bg-[#89295E]/20 text-[#ff92cd] px-1.5 py-0.5 rounded font-bold">
                    PINNED
                  </span>
                )}
              </div>
              <button
                onClick={() => setEditingNote(null)}
                className="p-1 rounded-lg hover:bg-[#1F2329] text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={6}
              className="w-full bg-transparent border border-[#242930] rounded-lg p-3 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-[#89295E] resize-none font-sans leading-relaxed"
              autoFocus
            />

            <div className="flex items-center justify-between pt-1 font-mono">
              <button
                type="button"
                onClick={() => handleCopy({ ...editingNote, content: editContent })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F2329] hover:bg-[#282D35] text-xs text-zinc-300 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy text</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingNote(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1F2329] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-4 py-1.5 rounded-lg bg-[#89295E] hover:bg-[#a03672] text-white text-xs font-bold tracking-wide transition-all shadow"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal 
        isOpen={!!noteToDelete}
        onConfirm={() => {
          if (noteToDelete) {
            deleteNote(noteToDelete);
            setNoteToDelete(null);
            showToast('Note deleted');
          }
        }}
        onCancel={() => setNoteToDelete(null)}
      />
    </div>
  );
}
