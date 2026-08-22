'use client';

import { Trash2, CheckCircle2, X, Circle } from 'lucide-react';

interface MultiSelectBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearAll: () => void;
  onMarkCompleted?: () => void;
  onMarkPending?: () => void;
  onDeleteSelected: () => void;
  completedLabel?: string;
  pendingLabel?: string;
}

export function MultiSelectBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearAll,
  onMarkCompleted,
  onMarkPending,
  onDeleteSelected,
  completedLabel = 'Mark Completed',
  pendingLabel = 'Mark Pending',
}: MultiSelectBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-14 z-40 flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#1F2329] border border-[#89295E]/60 rounded-xl shadow-xl font-mono text-xs">
      <div className="flex items-center gap-3">
        <span className="text-[#ff8ac8] font-bold">{selectedCount} selected</span>
        <button
          onClick={selectedCount === totalCount ? onClearAll : onSelectAll}
          className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2 text-[11px]"
        >
          {selectedCount === totalCount ? 'Deselect all' : `Select all ${totalCount}`}
        </button>
      </div>
      <div className="flex items-center gap-2">
        {onMarkPending && (
          <button
            onClick={onMarkPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E8B54D]/20 hover:bg-[#E8B54D]/30 text-[#E8B54D] border border-[#E8B54D]/40 font-bold text-[11px] transition-all"
          >
            <Circle className="w-3 h-3" />
            {pendingLabel}
          </button>
        )}
        {onMarkCompleted && (
          <button
            onClick={onMarkCompleted}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7FE7C4]/20 hover:bg-[#7FE7C4]/30 text-[#7FE7C4] border border-[#7FE7C4]/40 font-bold text-[11px] transition-all"
          >
            <CheckCircle2 className="w-3 h-3" />
            {completedLabel}
          </button>
        )}
        <button
          onClick={onDeleteSelected}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-800/40 font-bold text-[11px] transition-all"
        >
          <Trash2 className="w-3 h-3" />
          Delete ({selectedCount})
        </button>
        <button
          onClick={onClearAll}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-[#282D35] transition-colors"
          title="Cancel selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

