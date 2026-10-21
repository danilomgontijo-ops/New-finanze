const fs = require('fs');
const file = 'components/DuplicateRulesAnalyzerModal.tsx';

if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/text-gray-900/g, 'text-gray-900 dark:text-zinc-50');
    code = code.replace(/text-gray-700/g, 'text-gray-700 dark:text-zinc-300');
    code = code.replace(/text-gray-500/g, 'text-gray-500 dark:text-zinc-400');
    code = code.replace(/text-gray-400/g, 'text-gray-400 dark:text-zinc-500');
    code = code.replace(/bg-gray-50/g, 'bg-gray-50 dark:bg-zinc-800/50');
    code = code.replace(/bg-gray-100/g, 'bg-gray-100 dark:bg-zinc-800');
    code = code.replace(/border-gray-200/g, 'border-gray-200 dark:border-zinc-700');
    code = code.replace(/border-gray-300/g, 'border-gray-300 dark:border-zinc-600');
    
    // remove duplicates if they existed
    code = code.replace(/dark:text-zinc-50 dark:text-zinc-50/g, 'dark:text-zinc-50');
    code = code.replace(/dark:text-zinc-400 dark:text-zinc-400/g, 'dark:text-zinc-400');
    code = code.replace(/dark:text-zinc-300 dark:text-zinc-300/g, 'dark:text-zinc-300');
    code = code.replace(/dark:border-zinc-700 dark:border-zinc-700/g, 'dark:border-zinc-700');
    fs.writeFileSync(file, code, 'utf8');
}
