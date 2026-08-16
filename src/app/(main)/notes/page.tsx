'use client';

import { useState } from 'react';
import { useNotes } from '@/lib/hooks/useNotes';
import { Plus, Trash2, Calendar, Search } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function NotesPage() {
  const { grouped, loading, addNote, deleteNote } = useNotes();
  const [content, setContent] = useState('');
  const [search, setSearch] = useState('');
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  const handleAdd = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim()) return;
    await addNote(content.trim());
    setContent('');
  };

  // Keyboard shortcut listener: Ctrl+Enter or Cmd+Enter inside the textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleAdd();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] font-mono text-xs text-zinc-500">
        <span className="animate-pulse">&gt; loading_notes...</span>
      </div>
    );
  }

  const dates = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));
  const totalNotes = Object.values(grouped).reduce((acc, curr) => acc + curr.length, 0);

  // Filter notes by search text
  const getFilteredNotesForDate = (date: string) => {
    return grouped[date].filter((note) =>
      note.content.toLowerCase().includes(search.toLowerCase())
    );
  };

  // Check if any notes match search in the entire dataset
  const hasMatchingNotes = dates.some((date) => getFilteredNotesForDate(date).length > 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans">
      {/* Dev Header section - Monospace */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#242930] gap-2 font-mono text-xs text-zinc-400">
        <div className="flex items-center gap-1">
          <span className="text-[#89295E] font-bold">&gt;</span>
          <span>journal_directory:</span>
          <span className="text-zinc-200 ml-1">
            {totalNotes} logs_total
          </span>
        </div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-widest">
          archive_verified
        </div>
      </div>

      {/* Input box */}
      <form onSubmit={handleAdd} className="flex gap-2 bg-[#15181D] p-2.5 border border-[#242930] rounded">
        <span className="font-mono text-xs text-[#89295E] pl-2 select-none self-start mt-2">&gt;</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="log_new_note... (Ctrl+Enter to save)"
          rows={2}
          className="flex-1 px-2 py-1 bg-transparent border-none outline-none text-xs text-zinc-200 placeholder:text-zinc-600 resize-none font-mono"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded bg-[#89295E] hover:bg-[#a03672] text-white text-xs font-bold font-mono tracking-wide transition-all self-end active:scale-[0.98]"
        >
          + ADD NOTE
        </button>
      </form>

      {/* Search Bar - Monospace styling */}
      {totalNotes > 0 && (
        <div className="relative bg-[#15181D]/60 border border-[#242930] rounded flex items-center px-3 font-mono">
          <Search className="w-3.5 h-3.5 text-zinc-600 mr-2 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="filter_logs_by_query..."
            className="w-full py-2 bg-transparent text-xs text-zinc-200 outline-none border-none placeholder:text-zinc-650"
          />
        </div>
      )}

      {/* Asymmetrical notes feed */}
      <div className="space-y-8">
        {dates.map((date) => {
          const dateObj = new Date(date);
          const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
          const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const year = dateObj.getFullYear();
          const filteredNotes = getFilteredNotesForDate(date);

          if (filteredNotes.length === 0) return null;

          return (
            <div key={date} className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-4 items-start">
              {/* Left Asymmetrical Sticky Column */}
              <div className="md:sticky md:top-20 space-y-0.5 font-mono">
                <div className="flex items-baseline md:flex-col md:items-start gap-2">
                  <span className="text-[10px] font-bold text-[#89295E] uppercase tracking-wider">{weekday}</span>
                  <span className="text-xs font-bold text-zinc-300">{monthDay}</span>
                </div>
                <span className="hidden md:block text-[9px] text-zinc-600 font-bold">{year}</span>
              </div>

              {/* Right Notes Cascade Column */}
              <div className="space-y-3">
                {filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    className="group bg-[#15181D] hover:bg-[#15181D]/90 border-l border-t border-r border-b border-[#242930] hover:border-zinc-800 rounded p-4 flex flex-col justify-between gap-3 transition-colors relative"
                  >
                    <p className="text-xs text-zinc-350 leading-relaxed whitespace-pre-wrap font-sans">
                      {note.content}
                    </p>
                    
                    <div className="flex items-center justify-between border-t border-[#242930]/40 pt-2 text-[9px] font-mono font-bold tracking-wider text-zinc-600">
                      <span>
                        {new Date(note.created_at).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                      
                      <button
                        onClick={() => setNoteToDelete(note.id)}
                        className="p-1 hover:bg-[#1F2329] text-zinc-600 hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {(!hasMatchingNotes || dates.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[#242930] rounded font-mono">
            <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-wider">
              {search.trim() ? "No matching logs found." : "Nothing logged today. Start writing."}
            </p>
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={!!noteToDelete}
        onConfirm={() => {
          if (noteToDelete) deleteNote(noteToDelete);
        }}
        onCancel={() => setNoteToDelete(null)}
      />
    </div>
  );
}




