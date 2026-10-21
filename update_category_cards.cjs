const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

const regex = /<div\s+key=\{cls\.name\}\s+onClick=\{\(\) => setExpandedClass\(isExpanded \? null : cls\.name\)\}\s+className=\{\`bg-white dark:bg-zinc-900 p-3 rounded-xl border shadow-sm transition-all cursor-pointer \$\{isExpanded \? "border-blue-200 ring-2 ring-blue-500\/10" : "border-slate-100 hover:shadow-md"\}\`\}\s+>[\s\S]*?\{cls\.count\} ativos<\/span>\s*<\/div>\s*\)\}\s*<\/div>\s*<\/div>/;

const replacement = `<div
                  key={cls.name}
                  onClick={() => setExpandedClass(isExpanded ? null : cls.name)}
                  className={\`bg-white dark:bg-zinc-900 p-4 rounded-2xl border shadow-sm transition-all cursor-pointer \${isExpanded ? "border-blue-300 dark:border-blue-500/50 ring-4 ring-blue-500/10 dark:ring-blue-500/20" : "border-zinc-200/80 dark:border-zinc-800 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md dark:shadow-none"}\`}
                >
                  <div className="flex justify-between items-start mb-2.5">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase truncate pr-2 flex items-center gap-1">
                      {cls.name}
                      {isExpanded ? (
                        <ChevronUp size={12} className="text-zinc-400 dark:text-zinc-500" />
                      ) : (
                        <ChevronDown size={12} className="text-zinc-400 dark:text-zinc-500" />
                      )}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md">
                      {share.toFixed(1)}%
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                        {formatCurrency(cls.market)}
                      </span>
                      <span
                        className={\`text-[10px] font-bold px-1 py-0.5 rounded-sm \${cls.dailyProfit >= 0 ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10" : "text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/10"}\`}
                      >
                        {cls.dailyProfit >= 0 ? "+" : ""}
                        {dailyProfitPct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 dark:bg-blue-600 transition-all duration-1000"
                        style={{ width: \`\${share}%\` }}
                      ></div>
                    </div>
                    {isExpanded ? (
                      <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-3 animate-in slide-in-from-top-2">
                        {subcats.map((sub: any) => {
                          const subTotalProfitPct =
                            sub.invested > 0
                              ? (sub.totalProfit / sub.invested) * 100
                              : 0;
                          const subDailyProfitPct =
                            sub.value - sub.dailyProfit > 0
                              ? (sub.dailyProfit /
                                  (sub.value - sub.dailyProfit)) *
                                100
                              : 0;
                          return (
                            <div
                              key={sub.name}
                              className="flex flex-col gap-1 bg-zinc-50 dark:bg-zinc-800/30 p-2 rounded-lg"
                            >
                              <div className="flex justify-between text-[11px]">
                                <span className="text-zinc-700 dark:text-zinc-300 font-bold truncate pr-2">
                                  {sub.name}
                               </span>
                                <span className="text-zinc-900 dark:text-zinc-100 font-mono font-medium">
                                  {formatCurrency(sub.value)}
                                </span>
                              </div>
                              <div className="flex justify-between text-[10px] font-medium">
                                <span
                                  className={
                                    sub.dailyProfit >= 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  }
                                >
                                  Dia: {formatCurrency(sub.dailyProfit)} (
                                  {subDailyProfitPct >= 0 ? "+" : ""}
                                  {subDailyProfitPct.toFixed(2)}%)
                                </span>
                                <span
                                  className={
                                    sub.totalProfit >= 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  }
                                >
                                  Total: {formatCurrency(sub.totalProfit)} (
                                  {subTotalProfitPct >= 0 ? "+" : ""}
                                  {subTotalProfitPct.toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex justify-between text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                        <span className="flex gap-1">
                          Dia:{" "}
                          <span
                            className={
                              cls.dailyProfit >= 0
                                ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                : "text-rose-600 dark:text-rose-400 font-bold"
                            }
                          >
                            {cls.dailyProfit >= 0 ? "+" : ""}
                            {dailyProfitPct.toFixed(2)}%
                          </span>
                        </span>
                        <span>{cls.count} ativos</span>
                      </div>
                    )}
                  </div>
                </div>`;

const newCode = code.replace(regex, replacement);
if (newCode === code) {
  console.log("NOT REPLACED");
} else {
  fs.writeFileSync('components/Investments.tsx', newCode, 'utf8');
  console.log("Replaced successfully!");
}
