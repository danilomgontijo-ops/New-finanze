const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

const histFilters = `              <div className="flex items-center gap-2">
                <select
                  value={historyFilterCategory}
                  onChange={(e) => setHistoryFilterCategory(e.target.value)}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 text-slate-600 text-[10px] font-bold rounded-xl px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500 max-w-[120px] truncate"
                >
                  <option value="">Todas Categorias</option>
                  {categories
                    .filter((c) => c.type === TransactionType.INVESTMENT)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <select
                  value={historyFilterSubCategory}
                  onChange={(e) => setHistoryFilterSubCategory(e.target.value)}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 text-slate-600 text-[10px] font-bold rounded-xl px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500 max-w-[120px] truncate"
                >
                  <option value="">Todas Subcategorias</option>
                  {subCategories
                    .filter(
                      (s) =>
                        categories.find((c) => c.id === s.categoryId)?.type ===
                        TransactionType.INVESTMENT,
                    )
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={historyStart}
                    onChange={(e) => setHistoryStart(e.target.value)}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 text-slate-600 text-[10px] font-bold rounded-xl px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-zinc-400 text-xs">-</span>
                  <input
                    type="date"
                    value={historyEnd}
                    onChange={(e) => setHistoryEnd(e.target.value)}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 text-slate-600 text-[10px] font-bold rounded-xl px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>`;

code = code.replace(histFilters, `              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={historyStart}
                    onChange={(e) => setHistoryStart(e.target.value)}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 text-slate-600 text-[10px] font-bold rounded-xl px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-zinc-400 text-xs">-</span>
                  <input
                    type="date"
                    value={historyEnd}
                    onChange={(e) => setHistoryEnd(e.target.value)}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 text-slate-600 text-[10px] font-bold rounded-xl px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>`);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log("Updated history filters");
