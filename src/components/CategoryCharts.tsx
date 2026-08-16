'use client';

type CategoryChartsProps = {
  title: string;
  data: { label: string; count: number }[];
  colorClass?: string;
};

export default function CategoryCharts({ title, data, colorClass = 'bg-[#89295E]' }: CategoryChartsProps) {
  // Sort descending and take top 5
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 5);
  const maxCount = sorted.length > 0 ? sorted[0].count : 1;

  return (
    <div className="bg-[#0D0F12] border border-[#242930] rounded-xl p-5 flex flex-col gap-4 font-mono">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-[#242930] pb-2">
        <span className="text-[#89295E]">&gt;</span>
        <span>{title}</span>
      </div>

      <div className="space-y-3">
        {sorted.length === 0 ? (
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">no_data_found</p>
        ) : (
          sorted.map((item, idx) => {
            const percentage = Math.max((item.count / maxCount) * 100, 2); // Minimum 2% width
            return (
              <div key={idx} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-zinc-300">
                  <span className="truncate pr-2">[{item.label}]</span>
                  <span className="text-zinc-500">{item.count}</span>
                </div>
                <div className="w-full h-1.5 bg-[#15181D] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${colorClass}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
