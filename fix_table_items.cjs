const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

code = code.replace(
  /className="hover:bg-slate-50\/80 transition-colors group border-b border-slate-50 last:border-0"/g,
  'className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group border-b border-zinc-100 dark:border-zinc-800 last:border-0"'
);

code = code.replace(
  /className="w-7 h-7 rounded bg-white dark:bg-zinc-900 border border-slate-100 flex items-center justify-center p-1 shadow-sm shrink-0 overflow-hidden"/g,
  'className="w-7 h-7 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center p-1 shadow-sm shrink-0 overflow-hidden"'
);

code = code.replace(
  /className="font-bold text-slate-800 text-sm leading-none mb-0.5 truncate"/g,
  'className="font-bold text-zinc-900 dark:text-zinc-100 text-sm leading-none mb-0.5 truncate"'
);

code = code.replace(
  /className="text-\[10px\] bg-emerald-100 text-emerald-700 px-1\.5 rounded font-bold border border-emerald-200 flex items-center gap-0\.5"/g,
  'className="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-1.5 rounded font-bold border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-0.5"'
);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log('Fixed table items');
