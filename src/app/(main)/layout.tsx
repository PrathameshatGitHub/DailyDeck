'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckSquare, FileText, Calendar, LogOut, Terminal, Mail, ListTodo, Send, Coins, Bell, AlarmClock, Check, X, ChevronDown } from 'lucide-react';
import { CampaignProvider, useCampaign } from '@/lib/context/CampaignContext';
import { useJobCallbacks } from '@/lib/hooks/useJobCallbacks';

const tabs = [
  { href: '/daily-tasks', label: 'tasks', icon: CheckSquare },
  { href: '/notes', label: 'notes', icon: FileText },
  { href: '/task-date', label: 'logs', icon: Calendar },
  { href: '/emails', label: 'emails', icon: Mail },
  { href: '/todos', label: 'schedules', icon: ListTodo },
  { href: '/finance', label: 'finance', icon: Coins },
  { href: '/campaigns', label: 'campaigns', icon: Send },
];

const SNOOZE_OPTIONS = [
  { label: 'Tomorrow',  days: 1 },
  { label: 'In 3 Days', days: 3 },
  { label: 'In 1 Week', days: 7 },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <CampaignProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </CampaignProvider>
  );
}

function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const { activeCampaignId, status, isRelayActive } = useCampaign();
  const percentComplete = status.total > 0 ? Math.round(((status.sent + status.failed) / status.total) * 100) : 0;

  // Global follow-up reminders
  const { dueToday, completeCallback, snoozeCallback } = useJobCallbacks();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [snoozeOpenId, setSnoozeOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleComplete = async (id: string, title: string) => {
    await completeCallback(id);
    setSnoozeOpenId(null);
    showToast(`✓ "${title}" marked complete`);
  };

  const handleSnooze = async (id: string, days: number, label: string) => {
    await snoozeCallback(id, days);
    setSnoozeOpenId(null);
    showToast(`Snoozed — ${label}`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const showBanner = !bannerDismissed && dueToday.length > 0;

  return (
    <div className="min-h-screen pb-16 bg-[#0D0F12] text-zinc-100 selection:bg-[#89295E]/30 selection:text-white">

      {/* Global Toast */}
      {toast && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-[100] bg-[#7FE7C4] text-black px-4 py-2 rounded-lg shadow-xl font-mono text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <Check className="w-3.5 h-3.5" />
          {toast}
        </div>
      )}

      {/* Dev Sticky Top Header */}
      <header className="sticky top-0 z-50 bg-[#0D0F12] border-b border-[#242930] backdrop-blur-md bg-opacity-95">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              {/* Brand */}
              <Link href="/daily-tasks" className="flex items-center gap-2 font-mono group">
                <Terminal className="w-4 h-4 text-[#89295E]" />
                <span className="font-bold text-sm tracking-tight text-zinc-200">daily_deck</span>
              </Link>

              {/* Nav Tabs */}
              <nav className="hidden md:flex gap-1.5 h-14 items-center font-mono">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = pathname === tab.href;
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold tracking-wide transition-colors ${
                        isActive
                          ? 'bg-[#89295E] text-white border border-[#89295E]'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#15181D] border border-transparent'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                      {/* Follow-up badge on schedules tab */}
                      {tab.href === '/todos' && dueToday.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                          {dueToday.length}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="font-mono flex items-center gap-3">
              {/* Campaign Progress */}
              {activeCampaignId && (
                <Link
                  href="/campaigns"
                  className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#15181D] border border-[#242930] hover:border-[#89295E]/60 transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full ${isRelayActive ? 'bg-[#7FE7C4] animate-pulse' : 'bg-[#E8B54D]'}`} />
                  <span className="text-[10px] font-bold text-zinc-300 font-mono tracking-wider uppercase">
                    {isRelayActive ? 'Sending' : 'Paused'}: {percentComplete}%
                  </span>
                  <div className="w-16 h-1 bg-[#1F2329] rounded-full overflow-hidden hidden sm:block">
                    <div className="h-full bg-[#89295E] transition-all duration-500" style={{ width: `${percentComplete}%` }} />
                  </div>
                </Link>
              )}

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-bold text-zinc-400 hover:text-zinc-200 hover:bg-[#15181D] border border-[#242930] transition-colors"
              >
                <LogOut className="w-3 h-3 text-[#89295E]" />
                <span>logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Global Follow-up Reminder Banner ─────────────────────────────── */}
      {showBanner && (
        <div className="border-b border-red-500/30 bg-red-950/30 px-4 py-3">
          <div className="max-w-6xl mx-auto space-y-2">
            {/* Banner Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                <span className="text-xs font-bold text-red-300 font-mono">
                  {dueToday.length} Follow-up{dueToday.length > 1 ? 's' : ''} Due — action required
                </span>
              </div>
              <button
                onClick={() => setBannerDismissed(true)}
                className="p-1 rounded hover:bg-red-900/40 text-red-400 hover:text-red-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Due Items */}
            <div className="flex flex-wrap gap-2">
              {dueToday.map((cb) => (
                <div key={cb.id} className="flex items-center gap-2 bg-[#15181D] border border-red-500/25 rounded-lg px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-zinc-200 font-sans">{cb.title}</span>
                    {cb.company && <span className="text-[10px] text-zinc-500 font-mono ml-1.5">@ {cb.company}</span>}
                  </div>
                  <div className="flex items-center gap-1 ml-1">
                    {/* Snooze dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setSnoozeOpenId(snoozeOpenId === cb.id ? null : cb.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-[#1F2329] border border-[#242930] hover:border-zinc-600 text-zinc-400 text-[9px] font-mono font-bold transition-colors"
                      >
                        <AlarmClock className="w-3 h-3" />
                        Later
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                      {snoozeOpenId === cb.id && (
                        <div className="absolute left-0 top-full mt-1 z-50 bg-[#1F2329] border border-[#242930] rounded-lg shadow-xl overflow-hidden min-w-[130px]">
                          {SNOOZE_OPTIONS.map(({ label, days }) => (
                            <button
                              key={days}
                              onClick={() => handleSnooze(cb.id, days, label)}
                              className="w-full text-left px-3 py-2 text-[11px] font-mono text-zinc-300 hover:bg-[#282D35] hover:text-zinc-100 transition-colors"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleComplete(cb.id, cb.title)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-[#7FE7C4]/15 border border-[#7FE7C4]/35 text-[#7FE7C4] text-[9px] font-mono font-bold hover:bg-[#7FE7C4]/25 transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      Done
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Navigation Dock */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#15181D] border-t border-[#242930] p-1.5 flex justify-around font-mono">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded transition-colors flex-1 ${
                isActive ? 'text-[#7FE7C4] bg-[#1F2329]/50' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="text-[9px] font-bold">{tab.label}</span>
              {tab.href === '/todos' && dueToday.length > 0 && (
                <span className="absolute top-0.5 right-2 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                  {dueToday.length}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <main className="p-4 sm:p-6 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}
