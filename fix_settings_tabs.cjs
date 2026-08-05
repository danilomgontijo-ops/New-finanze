const fs = require('fs');
let code = fs.readFileSync('components/Settings.tsx', 'utf8');
const oldTabs = `      <div className="flex gap-1.5 shrink-0 overflow-x-auto w-fit max-w-full custom-scrollbar">
        {[
          { id: 'general', label: 'Geral & Metas' },
          { id: 'categories', label: 'Categorias' },
          { id: 'cards', label: 'Cartões' },
          { id: 'mappings', label: 'Mapeamento', icon: Replace },
          { id: 'data', label: 'Dados', icon: Database },
          { id: 'assets', label: 'Ativos', icon: TrendingUp }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={\`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-all whitespace-nowrap \${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200/60 dark:shadow-none'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }\`}
          >
            {tab.icon && <tab.icon size={14} />}
            {tab.label}
          </button>
        ))}
      </div>`;

const newTabs = `      <div className="flex gap-2 overflow-x-auto w-full pb-2 hide-scrollbar">
        {[
          { id: 'general', label: 'Geral', icon: SettingsIcon },
          { id: 'categories', label: 'Categorias', icon: LayoutGrid },
          { id: 'cards', label: 'Cartões', icon: CreditCardIcon },
          { id: 'mappings', label: 'Mapeamento', icon: Replace },
          { id: 'data', label: 'Dados', icon: Database },
          { id: 'assets', label: 'Eventos', icon: TrendingUp }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={\`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-2xl transition-all whitespace-nowrap \${
              activeTab === tab.id
                ? 'bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900'
                : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800'
            }\`}
          >
            {tab.icon && <tab.icon size={16} />}
            {tab.label}
          </button>
        ))}
      </div>`;

code = code.replace(oldTabs, newTabs);
fs.writeFileSync('components/Settings.tsx', code, 'utf8');
