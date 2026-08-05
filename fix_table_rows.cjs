const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

code = code.replace(
  /className="divide-y divide-slate-100"/,
  'className="divide-y divide-zinc-100 dark:divide-zinc-800"'
);

code = code.replace(
  /className="bg-slate-100\/50"/,
  'className="bg-zinc-100/50 dark:bg-zinc-800/50"'
);

code = code.replace(
  /className="px-4 py-1\.5 font-bold text-slate-600 uppercase text-\[10px\] tracking-widest border-b border-slate-100"/g,
  'className="px-4 py-1.5 font-bold text-zinc-600 dark:text-zinc-400 uppercase text-[10px] tracking-widest border-b border-zinc-100 dark:border-zinc-800"'
);

code = code.replace(
  /className="bg-blue-50 dark:bg-blue-950\/60\/20"/,
  'className="bg-blue-50/50 dark:bg-blue-900/10"'
);

code = code.replace(
  /className="px-4 py-2 border-l-4 border-l-blue-400 bg-blue-50 dark:bg-blue-950\/60\/30"/,
  'className="px-4 py-2 border-l-4 border-l-blue-400 bg-blue-50 dark:bg-blue-950/20"'
);

code = code.replace(
  /className="font-bold text-blue-900 text-\[10px\] uppercase tracking-wider"/,
  'className="font-bold text-blue-900 dark:text-blue-300 text-[10px] uppercase tracking-wider"'
);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log('Fixed table rows');
