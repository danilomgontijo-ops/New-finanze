const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

code = code.replace(
  /className="p-3 border-b border-slate-100 bg-slate-50\/50 flex flex-wrap gap-2 justify-between items-center"/,
  'className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex flex-wrap gap-3 justify-between items-center"'
);

code = code.replace(
  /className="font-bold text-slate-700 text-xs uppercase flex items-center gap-2"/,
  'className="font-bold text-zinc-700 dark:text-zinc-300 text-xs uppercase flex items-center gap-2 tracking-wider"'
);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log('Updated portfolio header');
