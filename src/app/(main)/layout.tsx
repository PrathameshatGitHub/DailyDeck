'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CheckSquare, FileText, Calendar, LogOut, Terminal, Mail, ListTodo, Send, Coins } from 'lucide-react';
import { CampaignProvider, useCampaign } from '@/lib/context/CampaignContext';

const tabs = [
  { href: '/daily-tasks', label: 'tasks', icon: CheckSquare },
  { href: '/notes', label: 'notes', icon: FileText },
  { href: '/task-date', label: 'logs', icon: Calendar },
  { href: '/emails', label: 'keep', icon: Mail },
  { href: '/todos', label: 'todos', icon: ListTodo },
  { href: '/finance', label: 'finance', icon: Coins },
  // { href: '/campaigns', label: 'campaigns', icon: Send },
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen pb-16 bg-[#0D0F12] text-zinc-100 selection:bg-[#89295E]/30 selection:text-white">
      {/* Dev Sticky Top Header */}
      <header className="sticky top-0 z-50 bg-[#0D0F12] border-b border-[#242930] backdrop-blur-md bg-opacity-95">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              {/* Brand Logo - Monospace */}
              <Link href="/daily-tasks" className="flex items-center gap-2 font-mono group">
                <Terminal className="w-4 h-4 text-[#89295E]" />
                <span className="font-bold text-sm tracking-tight text-zinc-200">
                  daily_deck
                </span>
              </Link>

              {/* Navigation Tabs - Monospace Tab Labels */}
              <nav className="hidden md:flex gap-1.5 h-14 items-center font-mono">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = pathname === tab.href;
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold tracking-wide transition-colors ${
                        isActive
                          ? 'bg-[#89295E] text-white border border-[#89295E]'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#15181D] border border-transparent'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="font-mono flex items-center gap-3">
              {/* Ongoing Campaign Progress Banner */}
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
                    <div 
                      className="h-full bg-[#89295E] transition-all duration-500" 
                      style={{ width: `${percentComplete}%` }} 
                    />
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

      {/* Mobile Navigation Dock */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#15181D] border-t border-[#242930] p-1.5 flex justify-around font-mono">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded transition-colors flex-1 ${
                isActive ? 'text-[#7FE7C4] bg-[#1F2329]/50' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="text-[9px] font-bold">{tab.label}</span>
            </Link>
          );
        })}
      </div>

      <main className="p-4 sm:p-6 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}


