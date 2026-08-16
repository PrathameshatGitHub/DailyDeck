'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFinance, FinanceEntryWithCalculations, FinanceEntry } from '@/lib/hooks/useFinance';
import { Plus, Trash2, Edit2, Calendar, Coins, DollarSign, Wallet, ArrowUpRight, ArrowDownRight, X, Info, TrendingUp } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function FinancePage() {
  const { calculatedEntries, loading, addEntry, deleteEntry, entries } = useFinance();
  
  // Currency setting (INR ₹ by default, toggleable to USD $)
  const [currency, setCurrency] = useState<'₹' | '$'>('₹');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // Form Fields
  const [date, setDate] = useState('');
  const [bankMoney, setBankMoney] = useState('');
  const [udhar, setUdhar] = useState('');
  const [bankReason, setBankReason] = useState('');
  const [udharReason, setUdharReason] = useState('');
  
  // Real-time Difference calculations in modal
  const [prevBankVal, setPrevBankVal] = useState(0);
  const [prevUdharVal, setPrevUdharVal] = useState(0);

  // Timezone-safe local date string helpers
  const getLocalDateString = (daysOffset = 0) => {
    const local = new Date();
    if (daysOffset !== 0) {
      local.setDate(local.getDate() + daysOffset);
    }
    const offset = local.getTimezoneOffset();
    const adjusted = new Date(local.getTime() - (offset * 60 * 1000));
    return adjusted.toISOString().split('T')[0];
  };

  const getTodayDateString = () => getLocalDateString(0);
  const getYesterdayDateString = () => getLocalDateString(-1);
  const getTomorrowDateString = () => getLocalDateString(1);

  // Set default values when opening modal
  const openAddModal = () => {
    setEditingEntry(null);
    setDate(getTodayDateString());
    setBankMoney('');
    setUdhar('');
    setBankReason('');
    setUdharReason('');
    setIsModalOpen(true);
  };

  const openEditModal = (entry: FinanceEntry) => {
    setEditingEntry(entry);
    setDate(entry.entry_date);
    setBankMoney(entry.bank_money.toString());
    setUdhar(entry.udhar.toString());
    setBankReason(entry.bank_change_reason || '');
    setUdharReason(entry.udhar_change_reason || '');
    setIsModalOpen(true);
  };

  // Find previous entry chronologically relative to a given date
  const getPrevEntryForDate = (selectedDate: string, excludeId?: string) => {
    if (!selectedDate) return null;
    const selectedTime = new Date(selectedDate).getTime();
    
    let closestPrev: FinanceEntry | null = null;
    let closestPrevTime = 0;

    for (const entry of entries) {
      if (excludeId && entry.id === excludeId) continue;
      const entryTime = new Date(entry.entry_date).getTime();
      if (entryTime < selectedTime) {
        if (entryTime > closestPrevTime) {
          closestPrev = entry;
          closestPrevTime = entryTime;
        }
      }
    }
    return closestPrev;
  };

  // Recalculate baseline values when inputs change in the modal
  useEffect(() => {
    const prev = getPrevEntryForDate(date, editingEntry?.id);
    if (prev) {
      setPrevBankVal(prev.bank_money);
      setPrevUdharVal(prev.udhar);
    } else {
      setPrevBankVal(0);
      setPrevUdharVal(0);
    }
  }, [date, entries, editingEntry]);

  // Calculate current deltas for visual helper in modal
  const currentBankMoneyNum = parseFloat(bankMoney) || 0;
  const currentUdharNum = parseFloat(udhar) || 0;

  const bankDelta = bankMoney !== '' ? currentBankMoneyNum - prevBankVal : 0;
  const udharDelta = udhar !== '' ? currentUdharNum - prevUdharVal : 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || bankMoney === '' || udhar === '') return;

    await addEntry(
      date,
      parseFloat(bankMoney),
      parseFloat(udhar),
      bankReason,
      udharReason
    );

    setIsModalOpen(false);
  };

  // Build the SVG Chart Data chronologically (oldest to newest)
  const svgChart = useMemo(() => {
    if (calculatedEntries.length < 2) return null;

    const chartData = [...calculatedEntries].sort((a, b) => 
      new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
    );

    const width = 600;
    const height = 150;
    const paddingX = 50;
    const paddingY = 25;

    const totals = chartData.map(d => d.total);
    const maxVal = Math.max(...totals);
    const minVal = Math.min(...totals, 0); // Baseline at 0, unless there's negative net assets
    const range = maxVal - minVal || 1;

    const times = chartData.map(d => new Date(d.entry_date).getTime());
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    const timeRange = maxTime - minTime || 1;

    // Map data to SVG points
    const points = chartData.map((d) => {
      const t = new Date(d.entry_date).getTime();
      const x = paddingX + ((t - minTime) / timeRange) * (width - 2 * paddingX);
      const y = height - paddingY - ((d.total - minVal) / range) * (height - 2 * paddingY);
      return { x, y, entry: d };
    });

    // Create Path commands
    let linePath = '';
    let areaPath = '';
    
    if (points.length > 0) {
      linePath = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        linePath += ` L ${points[i].x} ${points[i].y}`;
      }

      // Close path to draw filled gradient under the line
      areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;
    }

    return {
      width,
      height,
      paddingX,
      paddingY,
      points,
      linePath,
      areaPath,
      minVal,
      maxVal,
      chartData
    };
  }, [calculatedEntries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] font-mono text-xs text-zinc-500">
        <span className="animate-pulse">&gt; loading_ledger...</span>
      </div>
    );
  }

  // Dashboard Stats (extracted from latest entry)
  const latestCalculated = calculatedEntries[0];
  const currentBank = latestCalculated ? latestCalculated.bank_money : 0;
  const currentUdhar = latestCalculated ? latestCalculated.udhar : 0;
  const currentTotal = latestCalculated ? latestCalculated.total : 0;

  // Calculate Net Delta over last 2 entries
  const latestDelta = latestCalculated ? latestCalculated.total_diff : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans">
      {/* Dev Header section - Monospace */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#242930] gap-3 font-mono text-xs text-zinc-400">
        <div className="flex items-center gap-1">
          <span className="text-[#89295E] font-bold">&gt;</span>
          <span>finance_ledger:</span>
          <span className="text-zinc-200 ml-1">
            {calculatedEntries.length} entries_logged
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Currency Toggle */}
          <div className="flex items-center bg-[#15181D] border border-[#242930] rounded p-0.5 text-[10px]">
            <button
              onClick={() => setCurrency('₹')}
              className={`px-2 py-0.5 rounded transition-colors ${
                currency === '₹' ? 'bg-[#89295E] text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              ₹ INR
            </button>
            <button
              onClick={() => setCurrency('$')}
              className={`px-2 py-0.5 rounded transition-colors ${
                currency === '$' ? 'bg-[#89295E] text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              $ USD
            </button>
          </div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-widest hidden sm:block">
            ledger_verified
          </div>
        </div>
      </div>

      {/* Top Level Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bank & Cash Card */}
        <div className="bg-[#15181D] border border-[#242930] rounded p-4 flex items-center justify-between group hover:border-[#89295E]/50 transition-colors">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
              Liquid Cash (Bank/Hand)
            </span>
            <span className="text-xl font-mono font-bold text-zinc-100">
              {currency}{currentBank.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-2 rounded bg-blue-500/10 text-blue-400">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        {/* Udhar Card */}
        <div className="bg-[#15181D] border border-[#242930] rounded p-4 flex items-center justify-between group hover:border-[#89295E]/50 transition-colors">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
              Udhar (Receivable Loans)
            </span>
            <span className="text-xl font-mono font-bold text-zinc-100">
              {currency}{currentUdhar.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-2 rounded bg-amber-500/10 text-amber-400">
            <Coins className="w-5 h-5" />
          </div>
        </div>

        {/* Net Worth Card */}
        <div className="bg-[#15181D] border border-[#242930] rounded p-4 flex items-center justify-between group hover:border-[#89295E]/50 transition-colors">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider block flex items-center gap-1.5">
              Net Assets
              {latestDelta !== 0 && (
                <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold ${latestDelta > 0 ? 'text-[#7FE7C4]' : 'text-red-400'}`}>
                  {latestDelta > 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                  {latestDelta > 0 ? '+' : ''}{currency}{Math.abs(latestDelta).toLocaleString('en-IN')}
                </span>
              )}
            </span>
            <span className="text-xl font-mono font-bold text-zinc-100">
              {currency}{currentTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-2 rounded bg-[#89295E]/20 text-[#89295E]">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Visual Assets Trend Line Chart */}
      <div className="bg-[#15181D] border border-[#242930] rounded-xl p-5 flex flex-col gap-4 font-mono">
        <div className="flex items-center justify-between border-b border-[#242930] pb-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
            <TrendingUp className="w-4 h-4 text-[#89295E]" />
            <span>net_assets_trend_line</span>
          </div>
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
            chronological_history
          </span>
        </div>

        <div className="w-full flex justify-center items-center">
          {svgChart ? (
            <div className="w-full overflow-x-auto select-none">
              <svg 
                viewBox={`0 0 ${svgChart.width} ${svgChart.height}`} 
                className="w-full min-w-[500px] h-[180px]"
              >
                <defs>
                  {/* Linear Gradient under the area path */}
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#89295E" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#89295E" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Guide Lines */}
                <line 
                  x1={svgChart.paddingX} 
                  y1={svgChart.paddingY} 
                  x2={svgChart.width - svgChart.paddingX} 
                  y2={svgChart.paddingY} 
                  stroke="#242930" 
                  strokeWidth="1" 
                  strokeDasharray="4 4" 
                />
                <line 
                  x1={svgChart.paddingX} 
                  y1={svgChart.height - svgChart.paddingY} 
                  x2={svgChart.width - svgChart.paddingX} 
                  y2={svgChart.height - svgChart.paddingY} 
                  stroke="#242930" 
                  strokeWidth="1" 
                />

                {/* Axis Labels (Monospace Y values) */}
                <text 
                  x={svgChart.paddingX - 10} 
                  y={svgChart.paddingY + 4} 
                  fill="#52525b" 
                  fontSize="8" 
                  textAnchor="end" 
                  className="font-bold"
                >
                  {currency}{svgChart.maxVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </text>
                <text 
                  x={svgChart.paddingX - 10} 
                  y={svgChart.height - svgChart.paddingY + 3} 
                  fill="#52525b" 
                  fontSize="8" 
                  textAnchor="end" 
                  className="font-bold"
                >
                  {currency}{svgChart.minVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </text>

                {/* Area under the line */}
                <path d={svgChart.areaPath} fill="url(#areaGrad)" />

                {/* Main Line path */}
                <path 
                  d={svgChart.linePath} 
                  fill="none" 
                  stroke="#89295E" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />

                {/* Data point nodes */}
                {svgChart.points.map((pt, idx) => (
                  <g key={pt.entry.id} className="group/node">
                    <circle 
                      cx={pt.x} 
                      cy={pt.y} 
                      r="4" 
                      fill="#0D0F12" 
                      stroke="#89295E" 
                      strokeWidth="2" 
                      className="transition-all duration-300 hover:scale-150 hover:fill-[#89295E] cursor-pointer"
                    />
                    {/* Tooltip on hover */}
                    <text 
                      x={pt.x} 
                      y={pt.y - 10} 
                      fill="#e4e4e7" 
                      fontSize="9" 
                      textAnchor="middle" 
                      className="opacity-0 group-hover/node:opacity-100 transition-opacity bg-black pointer-events-none font-bold"
                    >
                      {currency}{pt.entry.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </text>
                  </g>
                ))}

                {/* Timeline X-Axis Dates */}
                {svgChart.points.map((pt, idx) => {
                  // Only label first, last, and middle to avoid crowding
                  const showLabel = 
                    idx === 0 || 
                    idx === svgChart.points.length - 1 || 
                    (svgChart.points.length > 2 && idx === Math.floor(svgChart.points.length / 2));
                  
                  if (!showLabel) return null;

                  const dateParts = pt.entry.entry_date.split('-');
                  const label = `${dateParts[1]}/${dateParts[2]}`; // MM/DD

                  return (
                    <text 
                      key={`lbl-${pt.entry.id}`}
                      x={pt.x} 
                      y={svgChart.height - 8} 
                      fill="#52525b" 
                      fontSize="8" 
                      textAnchor="middle" 
                      className="font-bold"
                    >
                      {label}
                    </text>
                  );
                })}
              </svg>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-550 border border-dashed border-[#242930] w-full rounded font-mono">
              <span className="text-[10px] uppercase font-bold tracking-wider mb-1">
                trend_chart_inactive
              </span>
              <p className="text-[9px] text-zinc-650 max-w-sm">
                Logging balance checkpoints for 2 or more separate dates will generate your asset trend chart here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action / Add button */}
      <div className="flex justify-end">
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#89295E] hover:bg-[#a03672] text-white text-xs font-bold font-mono tracking-wide transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          ADD BALANCE CHECKPOINT
        </button>
      </div>

      {/* Asymmetrical timeline feed */}
      <div className="space-y-8 relative">
        {/* Timeline bar (hidden on mobile, sticky to left on md+) */}
        {calculatedEntries.length > 0 && (
          <div className="absolute left-[14px] md:left-[148px] top-6 bottom-6 w-[1px] bg-[#242930] pointer-events-none" />
        )}

        {calculatedEntries.map((entry) => {
          const dateObj = new Date(entry.entry_date);
          const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
          const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const year = dateObj.getFullYear();

          const hasBankReason = entry.bank_change_reason && entry.bank_diff !== 0;
          const hasUdharReason = entry.udhar_change_reason && entry.udhar_diff !== 0;

          return (
            <div key={entry.id} className="relative grid grid-cols-1 md:grid-cols-[140px_1fr] gap-4 items-start pl-8 md:pl-0">
              {/* Timeline dot */}
              <div 
                className={`absolute left-[9px] md:left-[143px] top-1.5 w-[11px] h-[11px] rounded-full border-2 bg-[#0D0F12] transition-colors z-10 ${
                  entry.total_diff > 0 
                    ? 'border-[#7FE7C4]' 
                    : entry.total_diff < 0 
                    ? 'border-red-400' 
                    : 'border-[#242930]'
                }`}
              />

              {/* Left Column: Monospace Date */}
              <div className="md:sticky md:top-20 space-y-0.5 font-mono text-left md:text-right md:pr-6">
                <div className="flex items-baseline md:flex-col md:items-end gap-1.5 md:gap-0">
                  <span className="text-[10px] font-bold text-[#89295E] uppercase tracking-wider">{weekday}</span>
                  <span className="text-xs font-bold text-zinc-300">{monthDay}</span>
                </div>
                <span className="block text-[9px] text-zinc-600 font-bold">{year}</span>
              </div>

              {/* Right Column: Content Card */}
              <div className="group bg-[#15181D] hover:bg-[#15181D]/90 border border-[#242930] hover:border-zinc-800 rounded p-4 space-y-3 transition-colors relative">
                {/* Header Row: Net worth + change */}
                <div className="flex items-center justify-between border-b border-[#242930]/40 pb-2">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">Net Balance</span>
                    <span className="text-sm font-mono font-bold text-zinc-200">
                      {currency}{entry.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Net worth change badge */}
                    {entry.total_diff !== 0 ? (
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                        entry.total_diff > 0 ? 'bg-[#7FE7C4]/10 text-[#7FE7C4]' : 'bg-red-400/10 text-red-400'
                      }`}>
                        {entry.total_diff > 0 ? '+' : ''}
                        {currency}{entry.total_diff.toLocaleString('en-IN')}
                      </span>
                    ) : (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 text-zinc-500">
                        no change
                      </span>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(entry)}
                        className="p-1.5 hover:bg-[#1F2329] text-zinc-550 hover:text-[#89295E] rounded transition-colors"
                        title="Edit entry"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setNoteToDelete(entry.id)}
                        className="p-1.5 hover:bg-[#1F2329] text-zinc-555 hover:text-red-400 rounded transition-colors"
                        title="Delete entry"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sub-breakdown Row */}
                <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                  <div className="p-2 rounded bg-[#0D0F12]/40 border border-[#242930]/40">
                    <span className="text-[9px] text-zinc-500 block uppercase font-bold">Bank Balance</span>
                    <div className="flex justify-between items-baseline mt-1">
                      <span className="font-bold text-zinc-300">
                        {currency}{entry.bank_money.toLocaleString('en-IN')}
                      </span>
                      {entry.bank_diff !== 0 && (
                        <span className={`text-[9.5px] font-bold ${entry.bank_diff > 0 ? 'text-[#7FE7C4]' : 'text-red-400'}`}>
                          {entry.bank_diff > 0 ? '+' : ''}{entry.bank_diff.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-2 rounded bg-[#0D0F12]/40 border border-[#242930]/40">
                    <span className="text-[9px] text-zinc-500 block uppercase font-bold">Udhar (Lent)</span>
                    <div className="flex justify-between items-baseline mt-1">
                      <span className="font-bold text-zinc-300">
                        {currency}{entry.udhar.toLocaleString('en-IN')}
                      </span>
                      {entry.udhar_diff !== 0 && (
                        <span className={`text-[9.5px] font-bold ${entry.udhar_diff > 0 ? 'text-amber-400' : 'text-zinc-550'}`}>
                          {entry.udhar_diff > 0 ? '+' : ''}{entry.udhar_diff.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Change reasons timeline descriptions */}
                {(hasBankReason || hasUdharReason) && (
                  <div className="border-t border-[#242930]/40 pt-2.5 space-y-2">
                    {hasBankReason && (
                      <div className="flex items-start gap-2 text-xs">
                        <span className={`inline-flex shrink-0 px-1 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider font-bold ${
                          entry.bank_diff > 0 ? 'bg-[#7FE7C4]/10 text-[#7FE7C4]' : 'bg-red-400/10 text-red-400'
                        }`}>
                          {entry.bank_diff > 0 ? 'earned' : 'spent'}
                        </span>
                        <p className="text-zinc-400 text-[11px] leading-normal font-sans italic">
                          "{entry.bank_change_reason}"
                        </p>
                      </div>
                    )}
                    {hasUdharReason && (
                      <div className="flex items-start gap-2 text-xs">
                        <span className={`inline-flex shrink-0 px-1 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider font-bold ${
                          entry.udhar_diff > 0 ? 'bg-amber-400/10 text-amber-400' : 'bg-zinc-800 text-zinc-500'
                        }`}>
                          {entry.udhar_diff > 0 ? 'lent' : 'repaid'}
                        </span>
                        <p className="text-zinc-400 text-[11px] leading-normal font-sans italic">
                          "{entry.udhar_change_reason}"
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {calculatedEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[#242930] rounded font-mono">
            <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-wider mb-2">
              No entries logged in your ledger yet.
            </p>
            <button
              onClick={openAddModal}
              className="text-[#89295E] hover:text-[#a03672] text-[11px] font-bold underline transition-colors"
            >
              + Log your first balance checkpoint
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#15181D] border border-[#242930] rounded shadow-2xl overflow-hidden font-mono flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#242930]">
              <span className="text-[11px] font-bold text-zinc-355 uppercase tracking-widest flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-[#89295E]" />
                {editingEntry ? 'modify_checkpoint' : 'log_checkpoint'}
              </span>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSave} className="p-4 space-y-4 text-xs">
              {/* Date field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                    Entry Date
                  </label>
                  
                  {/* Quick Select Buttons */}
                  <div className="flex gap-1 font-mono text-[8.5px]">
                    <button
                      type="button"
                      onClick={() => setDate(getYesterdayDateString())}
                      className="px-1.5 py-0.5 rounded border border-[#242930] bg-[#0D0F12] text-zinc-400 hover:text-zinc-200"
                    >
                      yesterday
                    </button>
                    <button
                      type="button"
                      onClick={() => setDate(getTodayDateString())}
                      className="px-1.5 py-0.5 rounded border border-[#242930] bg-[#0D0F12] text-zinc-400 hover:text-zinc-200"
                    >
                      today
                    </button>
                    <button
                      type="button"
                      onClick={() => setDate(getTomorrowDateString())}
                      className="px-1.5 py-0.5 rounded border border-[#242930] bg-[#0D0F12] text-zinc-400 hover:text-zinc-200"
                    >
                      tomorrow
                    </button>
                  </div>
                </div>

                <div className="flex items-center bg-[#0D0F12] border border-[#242930] rounded px-3 py-2 mt-1">
                  <Calendar className="w-3.5 h-3.5 text-zinc-600 mr-2" />
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-transparent text-zinc-200 outline-none border-none text-xs"
                  />
                </div>
              </div>

              {/* Bank Balance field */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                  Bank / Cash Money ({currency})
                </label>
                <div className="flex items-center bg-[#0D0F12] border border-[#242930] rounded px-3 py-2">
                  <span className="text-zinc-600 mr-2">{currency}</span>
                  <input
                    type="number"
                    required
                    step="any"
                    placeholder="e.g. 50000"
                    value={bankMoney}
                    onChange={(e) => setBankMoney(e.target.value)}
                    className="w-full bg-transparent text-zinc-200 outline-none border-none text-xs font-mono"
                  />
                </div>
              </div>

              {/* Udhar (Lent) field */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                  Udhar / Lent to Others ({currency})
                </label>
                <div className="flex items-center bg-[#0D0F12] border border-[#242930] rounded px-3 py-2">
                  <span className="text-zinc-600 mr-2">{currency}</span>
                  <input
                    type="number"
                    required
                    step="any"
                    placeholder="e.g. 2000"
                    value={udhar}
                    onChange={(e) => setUdhar(e.target.value)}
                    className="w-full bg-transparent text-zinc-200 outline-none border-none text-xs font-mono"
                  />
                </div>
              </div>

              {/* Dynamic prompts for BANK changes */}
              {bankMoney !== '' && bankDelta !== 0 && (
                <div className="p-3 bg-[#0D0F12]/60 border border-[#242930] rounded space-y-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500 uppercase font-bold flex items-center gap-1">
                      <Info className="w-3 h-3 text-zinc-500" />
                      Bank Change Detected
                    </span>
                    <span className={`font-bold font-mono ${bankDelta > 0 ? 'text-[#7FE7C4]' : 'text-red-400'}`}>
                      {bankDelta > 0 ? 'Earned' : 'Spent'}: {currency}{Math.abs(bankDelta).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={bankReason}
                    onChange={(e) => setBankReason(e.target.value)}
                    placeholder={
                      bankDelta > 0 
                        ? 'Where did you get this money? (e.g. Salary, Gift)' 
                        : 'Where did you spend this money? (e.g. Rent, Groceries)'
                    }
                    className="w-full px-2.5 py-1.5 bg-[#15181D] border border-[#242930] rounded text-zinc-300 outline-none placeholder:text-zinc-650 text-[11px]"
                  />
                </div>
              )}

              {/* Dynamic prompts for UDHAR changes */}
              {udhar !== '' && udharDelta !== 0 && (
                <div className="p-3 bg-[#0D0F12]/60 border border-[#242930] rounded space-y-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500 uppercase font-bold flex items-center gap-1">
                      <Info className="w-3 h-3 text-zinc-500" />
                      Udhar Change Detected
                    </span>
                    <span className={`font-bold font-mono ${udharDelta > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                      {udharDelta > 0 ? 'Lent More' : 'Repaid/Written off'}: {currency}{Math.abs(udharDelta).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={udharReason}
                    onChange={(e) => setUdharReason(e.target.value)}
                    placeholder={
                      udharDelta > 0 
                        ? 'Who did you lend this money to?' 
                        : 'Who repaid this money? / Why was it adjusted?'
                    }
                    className="w-full px-2.5 py-1.5 bg-[#15181D] border border-[#242930] rounded text-zinc-300 outline-none placeholder:text-zinc-650 text-[11px]"
                  />
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 border-t border-[#242930]/40 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 border border-[#242930] hover:bg-[#1C2026] text-zinc-400 hover:text-zinc-200 rounded font-bold transition-all text-[11px]"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#89295E] hover:bg-[#a03672] text-white rounded font-bold transition-all text-[11px]"
                >
                  {editingEntry ? 'UPDATE LEDGER' : 'SAVE LEDGER'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!noteToDelete}
        onConfirm={() => {
          if (noteToDelete) deleteEntry(noteToDelete);
          setNoteToDelete(null);
        }}
        onCancel={() => setNoteToDelete(null)}
      />
    </div>
  );
}
