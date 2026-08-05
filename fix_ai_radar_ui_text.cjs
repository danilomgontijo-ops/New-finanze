const fs = require('fs');
let code = fs.readFileSync('components/AiDividendRadar.tsx', 'utf8');

code = code.replace(
  /calculando impostos \(30% EUA\)/g,
  'calculando impostos (30% EUA, 15% JCP BR)'
);

fs.writeFileSync('components/AiDividendRadar.tsx', code, 'utf8');
console.log("Fixed UI text");
