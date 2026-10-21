const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

code = code.replace(
  /className="px-3 py-2\.5 text-right font-medium text-slate-600"/g,
  'className="px-3 py-2.5 text-right font-medium text-zinc-600 dark:text-zinc-400"'
);

code = code.replace(
  /className="font-bold text-slate-800"/g,
  'className="font-bold text-zinc-800 dark:text-zinc-200"'
);

code = code.replace(
  /className="px-3 py-2\.5 text-right font-bold text-slate-900 bg-slate-50\/20"/g,
  'className="px-3 py-2.5 text-right font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-50/20 dark:bg-zinc-800/20"'
);

code = code.replace(
  /className="text-\[10px\] font-semibold text-gray-500"/g,
  'className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400"'
);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log('Fixed final table items');
