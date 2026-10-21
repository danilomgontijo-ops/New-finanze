const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

// Remove category and ticker filters from Histórico Detalhado
const histDetailOld = `<select
                  value={proventosCategoryFilter}
                  onChange={(e) => setProventosCategoryFilter(e.target.value)}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 text-slate-600 text-[10px] font-bold rounded-xl px-2 py-1 outline-none focus:ring-2 focus:ring-emerald-500 max-w-[120px] truncate"
                >
                  <option value="">Todas Categorias</option>
                  {categories
                    .filter((c) => c.type === TransactionType.INVESTMENT)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>`;

code = code.replace(histDetailOld, "");

const histDetailInput = `<input
                  type="text"
                  placeholder="Filtrar Ticker..."
                  value={proventosTickerFilter}
                  onChange={(e) => setProventosTickerFilter(e.target.value)}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 text-slate-600 text-[10px] font-bold rounded-xl px-2 py-1 w-24 outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
                />`;

code = code.replace(histDetailInput, "");

// Relocate filters
const topBarBoth = `<MultiSelect
            options={categories.filter(
              (c) => c.type === TransactionType.INVESTMENT,
            )}
            selected={globalCategoryFilters}
            onChange={setGlobalCategoryFilters}
            placeholder="Categorias"
          />
          <MultiSelect
            options={subCategories.filter(
              (s) =>
                categories.find((c) => c.id === s.categoryId)?.type ===
                TransactionType.INVESTMENT,
            )}
            selected={globalSubCategoryFilters}
            onChange={setGlobalSubCategoryFilters}
            placeholder="Subcategorias"
          />
          <div className="relative flex-1 md:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              size={14}
            />
            <input
              type="text"
              value={globalSearchTerm}
              onChange={(e) => setGlobalSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-full outline-none focus:ring-2 focus:ring-blue-600 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200"
              placeholder="Filtrar tickers (ex: ITSA4, TAEE11)..."
            />
          </div>`;

code = code.replace(topBarBoth, "");

// Find where to insert them. Right after the top bar:
// `          </button>\n        </div>\n      </div>\n      {/* DASHBOARD CARDS */}`

const filterBar = `
      {/* GLOBAL FILTERS BAR */}
      <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm flex flex-col md:flex-row items-center gap-4 z-10 relative">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-zinc-400" />
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Filtros</span>
        </div>
        <div className="flex-1 flex flex-col md:flex-row items-center gap-3 w-full">
          ${topBarBoth}
        </div>
      </div>
`;

code = code.replace(
  `          </button>\n        </div>\n      </div>\n      {/* DASHBOARD CARDS */}`,
  `          </button>\n        </div>\n      </div>\n${filterBar}\n      {/* DASHBOARD CARDS */}`
);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log("Updated UI layout");
