'use client';

import { useState, useEffect } from 'react';
import { useScheduledTasks, type ScheduledTask } from '@/lib/hooks/useScheduledTasks';
import { Plus, Trash2, Calendar, Search, CheckCircle2, Circle, AlertCircle, Clock } from 'lucide-react';

export default function ScheduledTasksPage() {
  const { tasks, loading, uniqueTypes, addTask, updateTask, deleteTask, toggleStatus } = useScheduledTasks();
  
  const [search, setSearch] = useState('');
  
  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newType, setNewType] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newType.trim()) return;
    await addTask(newTitle.trim(), newDate, newType.trim(), newNotes.trim());
    setNewTitle('');
    setNewNotes('');
    // keep newDate and newType for quick bulk entry
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] font-mono text-xs text-zinc-500">
        <span className="animate-pulse">&gt; loading_pipeline...</span>
      </div>
    );
  }

  // Filter Search
  const filtered = tasks.filter((t) => 
    t.title.toLowerCase().includes(search.toLowerCase()) || 
    t.notes?.toLowerCase().includes(search.toLowerCase()) ||
    t.type.toLowerCase().includes(search.toLowerCase())
  );

  const todayStr = new Date().toISOString().split('T')[0];

  // Grouping
  const pendingTasks = filtered.filter(t => t.status === 'pending');
  const pastDue = pendingTasks.filter(t => t.scheduled_date < todayStr);
  const upcoming = pendingTasks.filter(t => t.scheduled_date >= todayStr);
  
  // Done tasks
  const doneTasks = filtered.filter(t => t.status === 'done').sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime());

  // Pending Count
  const totalPending = pendingTasks.length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans relative">
      {/* Dev Stats Strip - Monospace */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#242930] gap-2 font-mono text-xs text-zinc-400">
        <div className="flex items-center gap-1">
          <span className="text-[#89295E] font-bold">&gt;</span>
          <span>pipeline_todos:</span>
          <span className="text-zinc-200 ml-1">
            {totalPending} active &bull; {pastDue.length} overdue
          </span>
        </div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-widest">
          schedule_active
        </div>
      </div>

      {/* Creation Form */}
      <form onSubmit={handleCreate} className="bg-[#15181D] p-4 border border-[#242930] rounded space-y-4">
        <div className="flex items-center gap-2 font-mono text-xs text-zinc-400 uppercase font-bold tracking-wider mb-2">
          <Plus className="w-3.5 h-3.5 text-[#89295E]" />
          schedule_new_event
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task / Follow-up Title..."
              className="w-full bg-[#1F2329] px-3 py-2 rounded border border-[#242930] outline-none focus:border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-600 font-mono"
              required
            />
          </div>
          
          <div>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full bg-[#1F2329] px-3 py-2 rounded border border-[#242930] outline-none focus:border-zinc-700 text-sm text-zinc-200 font-mono"
              required
            />
          </div>

          <div>
            <input
              list="dynamic-types"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              placeholder="Type "
              className="w-full bg-[#1F2329] px-3 py-2 rounded border border-[#242930] outline-none focus:border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-600 font-mono"
              required
            />
            <datalist id="dynamic-types">
              {uniqueTypes.map(type => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Additional notes / context..."
            className="flex-1 bg-[#1F2329] px-3 py-2 rounded border border-[#242930] outline-none focus:border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-600 font-mono"
          />
          <button
            type="submit"
            className="px-6 py-2 rounded bg-[#89295E] hover:bg-[#a03672] text-white text-xs font-bold font-mono tracking-wide transition-all active:scale-[0.98] shrink-0"
          >
            SCHEDULE
          </button>
        </div>
      </form>

      {/* Search */}
      <div className="relative font-mono text-xs w-full sm:w-64">
        <Search className="w-3.5 h-3.5 text-zinc-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="filter_pipeline..."
          className="w-full pl-8 pr-3 py-1.5 rounded bg-[#15181D] border border-[#242930] outline-none focus:border-zinc-700 text-zinc-200 placeholder:text-zinc-650"
        />
      </div>

      <div className="space-y-8">
        {/* Past Due Section */}
        {pastDue.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-mono text-xs font-bold text-[#E8B54D] uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Past Due [{pastDue.length}]
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pastDue.map(task => (
                <TodoCard 
                  key={task.id} 
                  task={task} 
                  onUpdate={updateTask} 
                  onDelete={deleteTask} 
                  onToggle={() => toggleStatus(task)} 
                  isOverdue={true} 
                />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Section */}
        <div className="space-y-3">
          <h2 className="font-mono text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-500" />
            Upcoming / Today [{upcoming.length}]
          </h2>
          {upcoming.length === 0 && pastDue.length === 0 && search === '' ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-[#242930] rounded font-mono bg-[#15181D]/50">
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                Pipeline is empty. Schedule your first follow-up.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcoming.map(task => (
                <TodoCard 
                  key={task.id} 
                  task={task} 
                  onUpdate={updateTask} 
                  onDelete={deleteTask} 
                  onToggle={() => toggleStatus(task)} 
                />
              ))}
            </div>
          )}
        </div>

        {/* Completed Section (Collapsible or just standard) */}
        {doneTasks.length > 0 && (
          <div className="space-y-3 pt-6 border-t border-[#242930]">
            <h2 className="font-mono text-xs font-bold text-[#7FE7C4] uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Completed History
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70">
              {doneTasks.slice(0, 10).map(task => (
                <TodoCard 
                  key={task.id} 
                  task={task} 
                  onUpdate={updateTask} 
                  onDelete={deleteTask} 
                  onToggle={() => toggleStatus(task)} 
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TodoCard({ 
  task, 
  onUpdate, 
  onDelete, 
  onToggle,
  isOverdue = false
}: { 
  task: ScheduledTask, 
  onUpdate: (id: string, updates: Partial<ScheduledTask>) => void,
  onDelete: (id: string) => void,
  onToggle: () => void,
  isOverdue?: boolean
}) {
  const isDone = task.status === 'done';
  const isToday = task.scheduled_date === new Date().toISOString().split('T')[0];

  const [notes, setNotes] = useState(task.notes || '');

  // Debounced auto-save for notes
  useEffect(() => {
    const handler = setTimeout(() => {
      if (notes !== (task.notes || '')) {
        onUpdate(task.id, { notes });
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [notes, task.notes, task.id, onUpdate]);

  return (
    <div className={`flex flex-col bg-[#15181D] border-l-2 border-t border-r border-b rounded-xl transition-colors ${
      isDone 
        ? 'border-l-[#7FE7C4] border-t-[#242930] border-r-[#242930] border-b-[#242930] bg-[#15181D]/40' 
        : isOverdue 
          ? 'border-[#E8B54D] shadow-[0_0_15px_rgba(232,181,77,0.1)]' 
          : isToday
            ? 'border-l-[#89295E] border-t-[#242930] border-r-[#242930] border-b-[#242930]'
            : 'border-[#242930] hover:border-zinc-700'
    }`}>
      <div className="p-4 flex gap-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className="mt-1 shrink-0"
        >
          {isDone ? (
            <CheckCircle2 className="w-5 h-5 text-[#7FE7C4] hover:text-[#7FE7C4]/80 transition-colors" />
          ) : (
            <Circle className={`w-5 h-5 transition-colors ${isOverdue ? 'text-[#E8B54D] hover:text-[#E8B54D]/80' : 'text-zinc-600 hover:text-zinc-400'}`} />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              value={task.title}
              onChange={(e) => onUpdate(task.id, { title: e.target.value })}
              className={`w-full sm:w-auto flex-1 bg-transparent border-none outline-none text-sm font-bold truncate focus:text-white transition-colors ${
                isDone ? 'line-through text-zinc-500' : 'text-zinc-200'
              }`}
            />
            <span className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold uppercase tracking-wider shrink-0 ${
              isDone ? 'bg-[#7FE7C4]/10 border-[#7FE7C4]/30 text-[#7FE7C4]' : 'bg-[#1F2329] border-[#242930] text-zinc-400'
            }`}>
              [{task.type}]
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              <input
                type="date"
                value={task.scheduled_date}
                onChange={(e) => onUpdate(task.id, { scheduled_date: e.target.value })}
                className={`bg-transparent border-none outline-none cursor-pointer ${
                  !isDone && isOverdue ? 'text-[#E8B54D]' : !isDone && isToday ? 'text-[#89295E]' : ''
                }`}
              />
            </div>
          </div>

          {/* Notes inline edit */}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes..."
            className="w-full bg-transparent border-none outline-none text-xs text-zinc-400 placeholder:text-zinc-700 resize-none font-sans h-12 mt-2 leading-relaxed"
          />
        </div>

        {/* Actions */}
        <div className="shrink-0 flex flex-col justify-start">
          <button
            onClick={() => onDelete(task.id)}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-[#1F2329] transition-colors"
            title="Delete task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
