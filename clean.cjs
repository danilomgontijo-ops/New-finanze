const fs = require('fs');
const path = 'components/TransactionForm.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace specific background boxes styling to make it cleaner
content = content.replace(/bg-zinc-50\/80 p-5 rounded-3xl border border-zinc-200\/80 shadow-sm shadow-zinc-200\/20/g, 'bg-zinc-50/40 p-5 rounded-3xl border border-zinc-200/60');
content = content.replace(/shadow-sm shadow-zinc-200\/20/g, 'shadow-sm shadow-zinc-200/5');

// Make inputs have less heavy borders
content = content.replace(/border border-zinc-200 rounded-2xl/g, 'border border-zinc-200/60 rounded-xl');
content = content.replace(/bg-zinc-50 border border-zinc-200/g, 'bg-zinc-50/50 border border-zinc-200/60');

// Make sticky headers softer
content = content.replace(/bg-zinc-50\/50 sticky top-0 z-10 backdrop-blur-md/g, 'bg-white/80 sticky top-0 z-10 backdrop-blur-xl border-b border-zinc-100');

// Buttons / Modals
content = content.replace(/bg-zinc-100\/80 p-1.5 rounded-2xl/g, 'bg-zinc-100/50 p-1 rounded-xl');
content = content.replace(/bg-white text-rose-600 shadow-sm shadow-zinc-200\/5 ring-1 ring-zinc-200\/50/g, 'bg-white text-rose-600 shadow-sm ring-1 ring-zinc-900/5');
content = content.replace(/bg-white text-emerald-600 shadow-sm shadow-zinc-200\/5 ring-1 ring-zinc-200\/50/g, 'bg-white text-emerald-600 shadow-sm ring-1 ring-zinc-900/5');
content = content.replace(/bg-white text-indigo-600 shadow-sm shadow-zinc-200\/5 ring-1 ring-zinc-200\/50/g, 'bg-white text-indigo-600 shadow-sm ring-1 ring-zinc-900/5');

content = content.replace(/rounded-2xl transition-all duration-200/g, 'rounded-lg transition-all duration-200');

fs.writeFileSync(path, content);
console.log('Typography updated in TransactionForm');
