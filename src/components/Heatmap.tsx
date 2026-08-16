'use client';

import { useMemo } from 'react';

type HeatmapProps = {
  activityMap: Record<string, number>;
  days?: number;
};

export default function Heatmap({ activityMap, days = 90 }: HeatmapProps) {
  // Generate the last `days` dates
  const gridData = useMemo(() => {
    const data = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start `days` ago
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const count = activityMap[dateStr] || 0;
      data.push({ dateStr, count, dateObj: d });
    }
    return data;
  }, [activityMap, days]);

  // Determine color based on intensity
  const getColor = (count: number) => {
    if (count === 0) return 'bg-[#15181D] border-[#242930]'; // Empty
    if (count <= 2) return 'bg-[#89295E]/50 border-[#89295E]/30'; // Low (Faded Maroon)
    if (count <= 4) return 'bg-[#89295E] border-[#a03672] shadow-[0_0_8px_rgba(137,41,94,0.4)]'; // Medium (Bright Maroon)
    return 'bg-[#7FE7C4] border-[#7FE7C4] shadow-[0_0_10px_rgba(127,231,196,0.4)]'; // High (Mint)
  };

  // Weeks format for CSS grid (column flow)
  // We want days to go top-to-bottom, then left-to-right.
  const weeks: { dateStr: string; count: number; dateObj: Date }[][] = [];
  let currentWeek: { dateStr: string; count: number; dateObj: Date }[] = [];
  
  gridData.forEach((day) => {
    currentWeek.push(day);
    // If it's a Saturday (6) or the last day, end the week column
    if (day.dateObj.getDay() === 6 || day === gridData[gridData.length - 1]) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  return (
    <div className="bg-[#0D0F12] border border-[#242930] rounded-xl p-5 flex flex-col gap-3 font-mono">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
        <span className="text-[#89295E]">&gt;</span>
        <span>contribution_matrix [{days}_days]</span>
      </div>
      
      <div className="flex overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#242930] scrollbar-track-transparent">
        <div className="flex gap-1.5 min-w-max">
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-1.5">
              {/* If it's the first week, we might need offset empty boxes to align days correctly */}
              {wIdx === 0 && week.length < 7 && week[0].dateObj.getDay() !== 0 ? (
                Array.from({ length: week[0].dateObj.getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="w-3.5 h-3.5 rounded-sm bg-transparent" />
                ))
              ) : null}
              
              {week.map((day) => (
                <div
                  key={day.dateStr}
                  title={`${day.count} activities on ${day.dateStr}`}
                  className={`w-3.5 h-3.5 rounded-sm border cursor-pointer transition-colors ${getColor(day.count)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-2 text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
        <span>Less</span>
        <div className="flex items-center gap-1.5 mx-2">
          <div className="w-3 h-3 rounded-sm border bg-[#15181D] border-[#242930]" />
          <div className="w-3 h-3 rounded-sm border bg-[#89295E]/50 border-[#89295E]/30" />
          <div className="w-3 h-3 rounded-sm border bg-[#89295E] border-[#a03672]" />
          <div className="w-3 h-3 rounded-sm border bg-[#7FE7C4] border-[#7FE7C4]" />
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
