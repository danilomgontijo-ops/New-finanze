const fs = require('fs');
let code = fs.readFileSync('components/Analytics.tsx', 'utf8');
code = code.replace(/minimumFractionDigits:\s*0/g, 'minimumFractionDigits: 2');
code = code.replace(/maximumFractionDigits:\s*0/g, 'maximumFractionDigits: 2');
fs.writeFileSync('components/Analytics.tsx', code, 'utf8');
