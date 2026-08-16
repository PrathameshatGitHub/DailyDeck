'use client';

import { CheckCircle2, Circle, XCircle, User, Building2 } from 'lucide-react';

// ── Shared type used by context, API, and page ──────────────────────────────
export type RecipientCard = {
  email: string;
  name?: string;
  company?: string;
  status: 'pending' | 'sent' | 'failed';
};

// ── Visual card component ───────────────────────────────────────────────────
export function RecipientCardItem({ email, name, company, status }: RecipientCard) {
  const isSent   = status === 'sent';
  const isFailed = status === 'failed';

  return (
    <div
      className={`relative flex flex-col gap-1 p-2.5 rounded-lg border font-mono text-[10px] transition-all duration-500 ${
        isSent
          ? 'bg-[#7FE7C4]/8 border-[#7FE7C4]/25 shadow-[0_0_8px_rgba(127,231,196,0.06)]'
          : isFailed
          ? 'bg-red-950/20 border-red-900/30'
          : 'bg-[#1F2329] border-[#242930]'
      }`}
    >
      {/* Status icon – top right */}
      <div className="absolute top-2 right-2">
        {isSent ? (
          <CheckCircle2 className="w-3 h-3 text-[#7FE7C4]" />
        ) : isFailed ? (
          <XCircle className="w-3 h-3 text-red-400" />
        ) : (
          <Circle className="w-3 h-3 text-zinc-700" />
        )}
      </div>

      {/* Status label */}
      <span
        className={`text-[8px] font-bold uppercase tracking-widest ${
          isSent ? 'text-[#7FE7C4]' : isFailed ? 'text-red-400' : 'text-zinc-600'
        }`}
      >
        [{status}]
      </span>

      {/* Email */}
      <span
        className={`truncate pr-4 ${isSent ? 'text-zinc-300' : 'text-zinc-400'}`}
      >
        {email}
      </span>

      {/* Name */}
      {name && (
        <div className="flex items-center gap-1 text-zinc-500">
          <User className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate">{name}</span>
        </div>
      )}

      {/* Company */}
      {company && (
        <div className="flex items-center gap-1 text-zinc-600">
          <Building2 className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate">{company}</span>
        </div>
      )}
    </div>
  );
}
