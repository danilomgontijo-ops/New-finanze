const fs = require('fs');
const path = 'components/TransactionsList.tsx';
let content = fs.readFileSync(path, 'utf8');

// shadow softening
content = content.replace(/shadow-sm shadow-zinc-200\/20/g, 'shadow-sm shadow-zinc-200/5');
content = content.replace(/bg-white rounded-3xl shadow-sm shadow-zinc-200\/5 border border-zinc-200 overflow-hidden/g, 'bg-white rounded-3xl shadow-sm border border-zinc-200/60 overflow-hidden');

content = content.replace(/bg-white rounded-2xl shadow-sm border border-gray-200/g, 'bg-white rounded-3xl shadow-sm border border-zinc-200/60');
content = content.replace(/bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden/g, 'bg-white rounded-3xl shadow-sm border border-zinc-200/60 overflow-hidden');

// Remove some specific borders for lists
content = content.replace(/bg-white rounded-3xl border border-zinc-200 shadow-sm p-4/g, 'bg-white rounded-3xl border border-zinc-200/60 shadow-sm p-5');

fs.writeFileSync(path, content);
console.log('Typography updated in TransactionsList');
