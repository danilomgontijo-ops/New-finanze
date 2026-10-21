const fs = require('fs');
let code = fs.readFileSync('components/Settings.tsx', 'utf8');

// replace outline-none" with outline-none bg-white dark:bg-zinc-900" for inputs that don't have bg-white already.
// simple regex:
code = code.replace(/outline-none" \/>/g, 'outline-none bg-white dark:bg-zinc-900" />');
code = code.replace(/outline-none"/g, 'outline-none bg-white dark:bg-zinc-900"');
code = code.replace(/bg-white dark:bg-zinc-900 bg-white dark:bg-zinc-900/g, 'bg-white dark:bg-zinc-900');

fs.writeFileSync('components/Settings.tsx', code, 'utf8');
