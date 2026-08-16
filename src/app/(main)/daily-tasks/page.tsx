'use client';

import { useState, useEffect, useRef } from 'react';
import { useTasks, type Task } from '@/lib/hooks/useTasks';
import { useNotes } from '@/lib/hooks/useNotes';
import { useTaskLogs } from '@/lib/hooks/useTaskLogs';
import { Plus, Trash2, RefreshCw, GripVertical, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function DailyTasksPage() {
  const { tasks, loading, addTask, toggleStatus, deleteTask } = useTasks();
  const [title, setTitle] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pending = tasks.filter((t) => t.status === 'pending');
  const complete = tasks.filter((t) => t.status === 'complete');
  
  const totalCount = tasks.length;
  const completedCount = complete.length;
  const recurringCount = tasks.filter(t => t.is_recurring).length;

  const handleAdd = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) return;
    await addTask(title.trim(), isRecurring);
    setTitle('');
    setIsRecurring(false);
  };

  // Keyboard shortcut listener: Ctrl+Enter or Cmd+Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleAdd();
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingTaskId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
  };

  const handleDrop = async (targetStatus: 'pending' | 'complete') => {
    if (!draggingTaskId) return;
    const task = tasks.find((t) => t.id === draggingTaskId);
    if (task && task.status !== targetStatus) {
      await toggleStatus(task);
    }
    setDraggingTaskId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] font-mono text-xs text-zinc-500">
        <span className="animate-pulse">&gt; loading_session...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans">
      {/* Dev Stats Strip - Monospace */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#242930] gap-2 font-mono text-xs text-zinc-400">
        <div className="flex items-center gap-1">
          <span className="text-[#89295E] font-bold">&gt;</span>
          <span>task_metrics:</span>
          <span className="text-zinc-200 ml-1">
            {pending.length} pending &bull; {complete.length} done today &bull; {recurringCount} recurring
          </span>
        </div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-widest">
          session_live
        </div>
      </div>

      {/* Dev Command Creation Form */}
      <form onSubmit={handleAdd} className="flex gap-2 items-center bg-[#15181D] p-2 border border-[#242930] rounded">
        <span className="font-mono text-xs text-[#89295E] pl-2 select-none">&gt;</span>
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="create_new_task... (Press Ctrl+Enter to quick-add)"
          className="flex-1 px-2 py-1.5 bg-transparent border-none outline-none text-xs text-zinc-200 placeholder:text-zinc-600 font-mono"
        />
        
        {/* Toggle style */}
        <label className="flex items-center gap-2 cursor-pointer select-none px-2.5 py-1.5 rounded bg-[#1F2329] border border-[#242930] hover:bg-[#242930] transition-colors">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="sr-only peer"
          />
          <div className="relative w-6 h-3 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-zinc-400 after:rounded-full after:h-2 after:w-2 after:transition-all peer-checked:bg-[#89295E]"></div>
          <span className="text-[9px] font-bold text-zinc-400 peer-checked:text-zinc-200 uppercase font-mono tracking-wider">
            Repeats daily
          </span>
        </label>

        <button
          type="submit"
          className="px-3.5 py-1.5 rounded bg-[#89295E] hover:bg-[#a03672] text-white text-xs font-bold font-mono tracking-wide transition-all active:scale-[0.98]"
        >
          EXECUTE
        </button>
      </form>

      {/* Kanban Board columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Column Active */}
        <Column 
          title="active_tasks" 
          count={pending.length}
          tasks={pending}
          onToggle={toggleStatus}
          onDelete={deleteTask}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDrop={() => handleDrop('pending')}
          emptyText="No pending tasks. Add one above."
          actionText="Mark done"
        />

        {/* Column Complete */}
        <Column 
          title="completed_tasks" 
          count={complete.length}
          tasks={complete}
          onToggle={toggleStatus}
          onDelete={deleteTask}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDrop={() => handleDrop('complete')}
          emptyText="Nothing here."
          actionText="Reopen"
        />
      </div>

      {/* Collapsible Weekly Summary Analysis View */}
      <div className="border border-[#242930] rounded bg-[#15181D]/40 overflow-hidden font-mono">
        <button
          onClick={() => setShowSummary(!showSummary)}
          className="w-full flex items-center justify-between p-3.5 hover:bg-[#15181D]/80 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
            <BarChart2 className="w-3.5 h-3.5 text-[#89295E]" />
            <span>weekly_analytics_report</span>
          </div>
          {showSummary ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showSummary && (
          <div className="p-4 border-t border-[#242930] bg-[#0D0F12]/50">
            <WeeklySummary tasks={tasks} />
          </div>
        )}
      </div>
    </div>
  );
}

function Column({
  title,
  count,
  tasks,
  onToggle,
  onDelete,
  onDragStart,
  onDragEnd,
  onDrop,
  emptyText,
  actionText,
}: {
  title: string;
  count: number;
  tasks: Task[];
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onDrop: () => void;
  emptyText: string;
  actionText: string;
}) {
  const [isOver, setIsOver] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = () => {
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleLocalDrop = () => {
    setIsOver(false);
    onDrop();
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleLocalDrop}
      className={`bg-[#15181D] border rounded p-4 flex flex-col min-h-[380px] transition-all font-mono ${
        isOver ? 'border-[#89295E] bg-[#15181D]/80' : 'border-[#242930]'
      }`}
    >
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#242930]">
        <span className="text-[11px] font-bold text-zinc-400 tracking-wider">[{title}]</span>
        <span className="text-[10px] bg-[#1F2329] text-zinc-500 border border-[#242930] px-1.5 py-0.5 rounded font-bold">
          {count}
        </span>
      </div>

      <div className="space-y-2 flex-1">
        {tasks.map((task) => {
          const isComplete = task.status === 'complete';
          return (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => onDragStart(e, task.id)}
              onDragEnd={onDragEnd}
              className={`group bg-[#1F2329]/60 hover:bg-[#1F2329] border border-[#242930] hover:border-zinc-700/50 rounded p-2.5 flex items-center justify-between gap-3 cursor-grab active:cursor-grabbing transition-colors select-none ${
                task.is_recurring ? 'border-l-2 border-l-[#89295E]' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <GripVertical className="w-3.5 h-3.5 text-zinc-700 shrink-0 cursor-grab group-hover:text-zinc-500 transition-colors" />
                
                {/* Prefix */}
                <span className="text-zinc-600 select-none">&gt;</span>

                {/* Monospace Status Tag */}
                <span className={`text-[10px] font-bold px-1 py-0.5 rounded border select-none shrink-0 ${
                  isComplete 
                    ? 'text-[#7FE7C4] border-[#7FE7C4]/20 bg-[#7FE7C4]/5' 
                    : 'text-[#E8B54D] border-[#E8B54D]/20 bg-[#E8B54D]/5'
                }`}>
                  {isComplete ? '[done]' : '[pending]'}
                </span>

                <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                  <span className={`text-xs ${
                    isComplete ? 'line-through text-zinc-500 font-medium' : 'text-zinc-200'
                  }`}>
                    {task.title}
                  </span>
                  
                  {/* Streak displays */}
                  {task.is_recurring && task.streak_count > 0 && (
                    <span className="text-[9px] text-[#E8B54D] font-bold select-none whitespace-nowrap">
                      🔥 {task.streak_count}d streak
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2 font-mono">
                <button
                  onClick={() => onToggle(task)}
                  className="text-[9px] font-bold text-zinc-400 hover:text-zinc-200 hover:underline uppercase tracking-wide cursor-pointer select-none"
                >
                  {actionText}
                </button>
                <button
                  onClick={() => setTaskToDelete(task.id)}
                  className="p-1 hover:bg-[#15181D] text-zinc-600 hover:text-red-400 rounded transition-colors"
                  title="Delete event"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
        
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-28 text-center border border-dashed border-[#242930] rounded">
            <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-wider">{emptyText}</p>
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={!!taskToDelete}
        onConfirm={() => {
          if (taskToDelete) onDelete(taskToDelete);
        }}
        onCancel={() => setTaskToDelete(null)}
      />
    </div>
  );
}

function WeeklySummary({ tasks }: { tasks: Task[] }) {
  const { grouped: notesGrouped, loading: loadingNotes } = useNotes();
  const { logs, loading: loadingLogs } = useTaskLogs();

  if (loadingNotes || loadingLogs) {
    return <span className="text-[10px] text-zinc-500 animate-pulse">&gt; calculating_summary_data...</span>;
  }

  // Filter last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const filterLast7Days = (dateStr: string) => {
    return new Date(dateStr) >= sevenDaysAgo;
  };

  const tasksCompletedCount = tasks.filter(t => t.status === 'complete').length;

  const notesCount = Object.keys(notesGrouped)
    .filter(filterLast7Days)
    .reduce((acc, date) => acc + notesGrouped[date].length, 0);

  const recentLogs = logs.filter(l => new Date(l.log_date) >= sevenDaysAgo);
  const logsCount = recentLogs.length;

  // Log counts by type
  const logsByType: Record<string, number> = {};
  recentLogs.forEach(l => {
    logsByType[l.type] = (logsByType[l.type] || 0) + 1;
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs leading-relaxed text-zinc-400">
      <div className="space-y-1">
        <span className="text-zinc-200 font-bold uppercase tracking-wider block border-b border-[#242930] pb-1 mb-2">
          [1] tasks_stats
        </span>
        <p>&bull; completed: <span className="text-[#7FE7C4] font-bold">{tasksCompletedCount}</span></p>
        <p>&bull; active: <span className="text-[#E8B54D] font-bold">{tasks.filter(t => t.status === 'pending').length}</span></p>
        <p>&bull; total_items: {tasks.length}</p>
      </div>

      <div className="space-y-1">
        <span className="text-zinc-200 font-bold uppercase tracking-wider block border-b border-[#242930] pb-1 mb-2">
          [2] journaling_stats
        </span>
        <p>&bull; notes_written_7d: <span className="text-[#7FE7C4] font-bold">{notesCount}</span></p>
        <p>&bull; total_notes: {Object.values(notesGrouped).reduce((acc, curr) => acc + curr.length, 0)}</p>
      </div>

      <div className="space-y-1">
        <span className="text-zinc-200 font-bold uppercase tracking-wider block border-b border-[#242930] pb-1 mb-2">
          [3] event_types_7d
        </span>
        {logsCount === 0 ? (
          <p className="text-zinc-600">no_events_logged</p>
        ) : (
          Object.entries(logsByType).map(([type, cnt]) => (
            <p key={type}>&bull; {type}: <span className="text-zinc-200 font-bold">{cnt}</span></p>
          ))
        )}
        <p className="border-t border-[#242930]/40 pt-1 mt-1">total_events_7d: {logsCount}</p>
      </div>
    </div>
  );
}




