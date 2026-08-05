const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

code = code.replace(
  /className="text-gray-700 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"/g,
  'className="text-zinc-500 dark:text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"'
);

code = code.replace(
  /className="text-\[10px\] text-gray-600 truncate leading-tight font-medium"/g,
  'className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate leading-tight font-medium"'
);

code = code.replace(
  /className="text-\[10px\] bg-slate-100 px-1\.5 py-0\.5 rounded text-gray-900 font-bold border border-zinc-200\/60 dark:border-zinc-800\/80 inline-block mt-0\.5"/g,
  'className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-900 dark:text-zinc-100 font-bold border border-zinc-200 dark:border-zinc-700 inline-block mt-0.5"'
);

code = code.replace(
  /className="px-3 py-2\.5 text-right font-mono font-bold text-slate-600"/g,
  'className="px-3 py-2.5 text-right font-mono font-bold text-zinc-600 dark:text-zinc-400"'
);

code = code.replace(
  /className="text-\[10px\] text-gray-600 italic"/g,
  'className="text-[10px] text-zinc-500 dark:text-zinc-400 italic"'
);

code = code.replace(
  /className="font-semibold text-slate-700"/g,
  'className="font-semibold text-zinc-700 dark:text-zinc-300"'
);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log('Fixed more table items');
