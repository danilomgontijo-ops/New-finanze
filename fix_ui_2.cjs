const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

const filterBar = `
      {/* GLOBAL FILTERS BAR */}
      <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm flex flex-col md:flex-row items-center gap-4 z-10 relative">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Filtros</span>
        </div>
        <div className="flex-1 flex flex-col md:flex-row items-center gap-3 w-full">
          <MultiSelect
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
            <input
              type="text"
              value={globalSearchTerm}
              onChange={(e) => setGlobalSearchTerm(e.target.value)}
              className="w-full px-4 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-full outline-none focus:ring-2 focus:ring-blue-600 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200"
              placeholder="Filtrar tickers (ex: ITSA4, TAEE11)..."
            />
          </div>
        </div>
      </div>
`;

code = code.replace(
  /      \{\/\* DASHBOARD CARDS \*\/\}/g,
  filterBar + '\n      {/* DASHBOARD CARDS */}'
);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log("Updated UI layout again");
