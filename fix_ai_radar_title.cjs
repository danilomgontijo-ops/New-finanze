const fs = require('fs');
let code = fs.readFileSync('components/AiDividendRadar.tsx', 'utf8');

code = code.replace(
  /Busca automática com regras tributárias \(30% EUA\)/g,
  'Busca automática com regras tributárias (30% EUA, 15% JCP BR)'
);

fs.writeFileSync('components/AiDividendRadar.tsx', code, 'utf8');
console.log("Fixed AI Radar description");
