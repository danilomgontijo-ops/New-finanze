const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

code = code.replace(/cdiHistory\?: \{ date: string; value: number \}\[\];/, 'cdiHistory?: { date: string; value: number }[];\n  ipcaHistory?: { date: string; value: number }[];\n  ibovHistory?: { date: string; value: number }[];');
code = code.replace(/cdiHistory = \[\],/, 'cdiHistory = [],\n  ipcaHistory = [],\n  ibovHistory = [],');

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log('Fixed Investments signature');
