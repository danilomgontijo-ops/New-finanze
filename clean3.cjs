const fs = require('fs');
const path = 'components/Dashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/text-sm font-bold/g, 'text-sm font-semibold');
content = content.replace(/text-\[10px\] font-bold/g, 'text-[10px] font-semibold');
content = content.replace(/border-zinc-200/g, 'border-zinc-200/60');
content = content.replace(/bg-zinc-50\/50/g, 'bg-zinc-50/40');
content = content.replace(/shadow-xl shadow-zinc-200\/40/g, 'shadow-lg shadow-zinc-200/10');
content = content.replace(/shadow-xl shadow-zinc-200\/50/g, 'shadow-lg shadow-zinc-200/10');
content = content.replace(/text-4xl font-bold/g, 'text-4xl font-semibold tracking-tight');

fs.writeFileSync(path, content);
console.log('Typography updated in Dashboard');
