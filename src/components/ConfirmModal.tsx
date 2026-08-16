'use client';

import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ 
  isOpen, 
  title = "Confirm Deletion", 
  message = "Are you sure you want to delete this item? This action cannot be undone.", 
  onConfirm, 
  onCancel 
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 font-sans">
      <div 
        className="bg-[#15181D] border border-[#242930] rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#242930]">
          <div className="flex items-center gap-2 text-red-400 font-mono text-sm font-bold tracking-wider uppercase">
            <AlertTriangle className="w-4 h-4" />
            {title}
          </div>
          <button 
            onClick={onCancel}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-5">
          <p className="text-sm text-zinc-300 leading-relaxed font-mono">
            {message}
          </p>
        </div>
        
        <div className="p-4 bg-[#0D0F12] border-t border-[#242930] flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 hover:bg-[#1F2329] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onCancel(); // Close modal after confirming
            }}
            className="px-4 py-2 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs font-mono font-bold uppercase tracking-wider transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
