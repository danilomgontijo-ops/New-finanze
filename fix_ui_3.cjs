const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

// 1. Remove search input from top bar
const oldTopBar = `        <div className="flex items-center gap-2 w-full md:w-auto border-t md:border-t-0 border-zinc-100 dark:border-zinc-800/40 pt-2 md:pt-0">
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
              placeholder="Buscar ativos (ex: ITSA4)..."
            />
          </div>
          <button
            onClick={() => setIsManualHistoryOpen(true)}`;

const newTopBar = `        <div className="flex items-center gap-2 w-full md:w-auto border-t md:border-t-0 border-zinc-100 dark:border-zinc-800/40 pt-2 md:pt-0">
          <button
            onClick={() => setIsManualHistoryOpen(true)}`;

code = code.replace(oldTopBar, newTopBar);

// 2. Add search input back to Global Filters Bar and rename
const oldGlobalFilters = `      {/* GLOBAL FILTERS BAR */}
      <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm flex flex-col md:flex-row items-center gap-4 z-20 relative">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-zinc-400" />
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Filtros de Custódia</span>
        </div>
        <div className="flex-1 flex flex-col md:flex-row items-center gap-3 w-full">
          <MultiSelect
            options={categories.filter(
              (c) => c.type === TransactionType.INVESTMENT,
            )}
            selected={globalCategoryFilters}
            onChange={setGlobalCategoryFilters}
            placeholder="Todas as Categorias"
          />
          <MultiSelect
            options={subCategories.filter(
              (s) =>
                categories.find((c) => c.id === s.categoryId)?.type ===
                TransactionType.INVESTMENT,
            )}
            selected={globalSubCategoryFilters}
            onChange={setGlobalSubCategoryFilters}
            placeholder="Todas as Subcategorias"
          />
        </div>
      </div>`;

const newGlobalFilters = `      {/* GLOBAL FILTERS BAR */}
      <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm flex flex-col md:flex-row items-center gap-4 z-20 relative">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-zinc-400" />
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Filtros</span>
        </div>
        <div className="flex-1 flex flex-col md:flex-row items-center gap-3 w-full">
          <MultiSelect
            options={categories.filter(
              (c) => c.type === TransactionType.INVESTMENT,
            )}
            selected={globalCategoryFilters}
            onChange={setGlobalCategoryFilters}
            placeholder="Todas as Categorias"
          />
          <MultiSelect
            options={subCategories.filter(
              (s) =>
                categories.find((c) => c.id === s.categoryId)?.type ===
                TransactionType.INVESTMENT,
            )}
            selected={globalSubCategoryFilters}
            onChange={setGlobalSubCategoryFilters}
            placeholder="Todas as Subcategorias"
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
              placeholder="Buscar ativos (ex: ITSA4)..."
            />
          </div>
        </div>
      </div>`;

code = code.replace(oldGlobalFilters, newGlobalFilters);

// 3. Overview internal filters logic: We should remove overviewFilterCategory, overviewFilterSubCategory, overviewFilterTicker usage in data logic

const oldOverviewLogic = `    if (overviewFilterCategory) {
      filteredTxs = filteredTxs.filter(
        (t) => t.categoryId === overviewFilterCategory,
      );
    }
    if (overviewFilterSubCategory) {
      filteredTxs = filteredTxs.filter(
        (t) => t.subCategoryId === overviewFilterSubCategory,
      );
    }
    if (overviewFilterTicker) {
      filteredTxs = filteredTxs.filter(
        (t) => t.investmentDetails?.ticker === overviewFilterTicker,
      );
    }`;

code = code.replace(oldOverviewLogic, `
    if (globalCategoryFilters.length > 0) {
      filteredTxs = filteredTxs.filter(
        (t) => globalCategoryFilters.includes(t.categoryId),
      );
    }
    if (globalSubCategoryFilters.length > 0) {
      filteredTxs = filteredTxs.filter(
        (t) => globalSubCategoryFilters.includes(t.subCategoryId || ""),
      );
    }
`);

// 4. Also fix the overview useMemo deps:
const oldOverviewDeps = `[
    investmentTransactions,
    overviewFilterCategory,
    overviewFilterSubCategory,
    overviewFilterTicker,
    overviewSearchTerm,
    overviewFilterDate,
  ]`;
const newOverviewDeps = `[
    investmentTransactions,
    globalCategoryFilters,
    globalSubCategoryFilters,
    overviewSearchTerm,
    overviewFilterDate,
  ]`;
code = code.replace(oldOverviewDeps, newOverviewDeps);

// 5. Remove the overview inner filters UI
const overviewUIOld = `          <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-gray-600" />
              <span className="text-xs font-bold text-slate-600 uppercase">
                Filtros:
              </span>
            </div>
            <select
              value={overviewFilterCategory}
              onChange={(e) => {
                setOverviewFilterCategory(e.target.value);
                setOverviewFilterSubCategory("");
              }}
              className="bg-slate-50 border border-zinc-200/60 dark:border-zinc-800/80 text-slate-600 text-[10px] font-bold rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 max-w-[150px] truncate"
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
              value={overviewFilterSubCategory}
              onChange={(e) => setOverviewFilterSubCategory(e.target.value)}
              className="bg-slate-50 border border-zinc-200/60 dark:border-zinc-800/80 text-slate-600 text-[10px] font-bold rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 max-w-[150px] truncate"
            >
              <option value="">Todas Subcategorias</option>
              {subCategories
                .filter((s) => {
                  const isInvestment =
                    categories.find((c) => c.id === s.categoryId)?.type ===
                    TransactionType.INVESTMENT;
                  return (
                    isInvestment &&
                    (!overviewFilterCategory ||
                      s.categoryId === overviewFilterCategory)
                  );
                })
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
            <select
              value={overviewFilterTicker}
              onChange={(e) => setOverviewFilterTicker(e.target.value)}
              className="bg-slate-50 border border-zinc-200/60 dark:border-zinc-800/80 text-slate-600 text-[10px] font-bold rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 max-w-[150px] truncate"
            >
              <option value="">Todos Ativos</option>
              {Array.from(
                new Set(
                  investmentTransactions
                    .map((t) => t.investmentDetails?.ticker)
                    .filter(Boolean),
                ),
              )
                .sort()
                .map((ticker) => (
                  <option key={ticker} value={ticker}>
                    {ticker}
                  </option>
                ))}
            </select>
            <input`;

const overviewUINew = `          <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-600" />
              <span className="text-xs font-bold text-slate-600 uppercase">
                Período:
              </span>
            </div>
            <input`;

code = code.replace(overviewUIOld, overviewUINew);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log("Removed duplicate overview filters and added search back");
