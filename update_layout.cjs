const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

const originalTopBarEnd = `        <div className="flex items-center gap-2 w-full md:w-auto border-t md:border-t-0 border-zinc-100 dark:border-zinc-800/40 pt-2 md:pt-0">
          
          <button
            onClick={() => setIsManualHistoryOpen(true)}`;

const newTopBarEnd = `        <div className="flex items-center gap-2 w-full md:w-auto border-t md:border-t-0 border-zinc-100 dark:border-zinc-800/40 pt-2 md:pt-0">
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

code = code.replace(originalTopBarEnd, newTopBarEnd);

const oldGlobalFilters = `      {/* GLOBAL FILTERS BAR */}
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
      </div>`;

const newGlobalFilters = `      {/* GLOBAL FILTERS BAR */}
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

code = code.replace(oldGlobalFilters, newGlobalFilters);
fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log("Layout updated!");
