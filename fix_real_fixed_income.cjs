const fs = require('fs');
let code = fs.readFileSync('hooks/usePortfolio.ts', 'utf8');

const regex = /if \(isCDI\) \{[\s\S]*?else \{[\s\S]*?const diffDays = Math\.ceil\(diffTime \/ \(1000 \* 60 \* 60 \* 24\)\);\s*const years = diffDays \/ 365\.25;\s*if \(fixedRate > 0\) return principal \* Math\.pow\(1 \+ fixedRate \/ 100, years\);\s*\}\s*return principal;/m;

const replacement = `if (isCDI) {
    if (cdiData.length === 0) return principal;
    const startIso = startDateStr.split("T")[0];
    const endIso = endDateStr ? endDateStr.split("T")[0] : new Date().toISOString().split("T")[0];

    const relevantRates = cdiData.filter((d) => d.date >= startIso && d.date <= endIso);
    let accumulatedFactor = 1;
    for (const day of relevantRates) {
      const dailyFactor = 1 + (day.value / 100) * (pctCDI / 100);
      accumulatedFactor *= dailyFactor;
    }
    return principal * accumulatedFactor;
  } else {
    // Correcting "gambiarra" calendar days to approx business days using CDI history
    const startIso = startDateStr.split("T")[0];
    const endIso = endDateStr ? endDateStr.split("T")[0] : new Date().toISOString().split("T")[0];
    const relevantRates = cdiData.filter((d) => d.date >= startIso && d.date <= endIso);
    
    // Fallback to calendar days if cdiData is missing, else use exact business days
    const businessDays = relevantRates.length > 0 ? relevantRates.length : Math.ceil(Math.abs(new Date(endIso).getTime() - new Date(startIso).getTime()) / (1000 * 60 * 60 * 24)) * (252/365);
    const years = businessDays / 252;
    if (fixedRate > 0) return principal * Math.pow(1 + fixedRate / 100, years);
  }
  return principal;`;

code = code.replace(regex, replacement);
fs.writeFileSync('hooks/usePortfolio.ts', code, 'utf8');
console.log('Fixed calculateRealFixedIncome');
