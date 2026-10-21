const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

code = code.replace(
  /className="bg-slate-50\/80 text-gray-900 font-bold uppercase text-\[10px\] border-b"/,
  'className="bg-zinc-50/80 dark:bg-zinc-900/80 text-zinc-900 dark:text-zinc-100 font-bold uppercase text-[10px] border-b border-zinc-200 dark:border-zinc-800"'
);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log('Fixed table header');
