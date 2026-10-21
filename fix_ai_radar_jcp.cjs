const fs = require('fs');
let code = fs.readFileSync('components/AiDividendRadar.tsx', 'utf8');

code = code.replace(
  /if \(div\.currency === 'USD'\) \{\n\s+\/\/ US Law: 30% tax on dividends for non-residents\n\s+taxUnit = grossUnit \* 0\.30;\n\s+netUnit = grossUnit - taxUnit;\n\s+\}/,
  `if (div.currency === 'USD') {
                  // US Law: 30% tax on dividends for non-residents
                  taxUnit = grossUnit * 0.30;
                  netUnit = grossUnit - taxUnit;
              } else if (div.type === 'JCP') {
                  // JCP (Juros sobre Capital Próprio) in Brazil has 15% IRRF (Imposto de Renda Retido na Fonte)
                  taxUnit = grossUnit * 0.15;
                  netUnit = grossUnit - taxUnit;
              }`
);

fs.writeFileSync('components/AiDividendRadar.tsx', code, 'utf8');
console.log("Fixed JCP tax calculation in AiDividendRadar");
