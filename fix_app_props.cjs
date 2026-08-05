const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const regex = /<Investments\s+cdiHistory=\{cdiHistory\}\s+transactions=\{transactions\}/;
const replacement = `<Investments\n                     cdiHistory={cdiHistory}\n                     ipcaHistory={ipcaHistory}\n                     ibovHistory={ibovHistory}\n                     transactions={transactions}`;

code = code.replace(regex, replacement);
fs.writeFileSync('App.tsx', code, 'utf8');
