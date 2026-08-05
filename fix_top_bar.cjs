const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

const oldTopBarFilters = `        <div className="flex items-center gap-2 w-full md:w-auto border-t md:border-t-0 border-zinc-100 dark:border-zinc-800/40 pt-2 md:pt-0">
          <div className="relative flex-1 md:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              size={14}
            />
            <input
              type="text"
              value={
                activeTab === "portfolio"
                  ? portfolioSearchTerm
                  : activeTab === "history"
                    ? historySearchTerm
                    : activeTab === "overview"
                      ? overviewSearchTerm
                      : proventosSearch
              }
              onChange={(e) => {
                if (activeTab === "portfolio")
                  setPortfolioSearchTerm(e.target.value);
                else if (activeTab === "history")
                  setHistorySearchTerm(e.target.value);
                else if (activeTab === "overview")
                  setOverviewSearchTerm(e.target.value);
                else setProventosSearch(e.target.value);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-full outline-none focus:ring-2 focus:ring-blue-600 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200"
              placeholder="Filtrar por ticker..."
            />
          </div>`;

const newTopBarFilters = `        <div className="flex items-center gap-2 w-full md:w-auto border-t md:border-t-0 border-zinc-100 dark:border-zinc-800/40 pt-2 md:pt-0">
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

code = code.replace(oldTopBarFilters, newTopBarFilters);
fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log("Updated top bar");
