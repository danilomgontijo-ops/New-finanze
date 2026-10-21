const fs = require('fs');
let code = fs.readFileSync('components/CreditCardManager.tsx', 'utf8');

// Replace standard tailwind grays with dark mode variants
code = code.replace(/text-gray-500/g, 'text-gray-500 dark:text-zinc-400');
code = code.replace(/text-gray-900/g, 'text-gray-900 dark:text-zinc-50');
code = code.replace(/text-gray-700/g, 'text-gray-700 dark:text-zinc-300');
code = code.replace(/bg-gray-50/g, 'bg-gray-50 dark:bg-zinc-800/50');
code = code.replace(/border-gray-200/g, 'border-gray-200 dark:border-zinc-700');
code = code.replace(/border-gray-300/g, 'border-gray-300 dark:border-zinc-600');
code = code.replace(/border-gray-500/g, 'border-gray-500 dark:border-zinc-500');

code = code.replace(/bg-white dark:bg-zinc-900 dark:bg-zinc-900/g, 'bg-white dark:bg-zinc-900');
code = code.replace(/text-gray-500 dark:text-zinc-400 dark:text-zinc-400/g, 'text-gray-500 dark:text-zinc-400');
code = code.replace(/text-gray-900 dark:text-zinc-50 dark:text-zinc-50/g, 'text-gray-900 dark:text-zinc-50');

fs.writeFileSync('components/CreditCardManager.tsx', code, 'utf8');
