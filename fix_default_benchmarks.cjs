const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

code = code.replace(/useState<string\[\]>\(\['cdiAccum'\]\);/, "useState<string[]>(['cdiAccum', 'ipcaAccum', 'ibovAccum']);");

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
