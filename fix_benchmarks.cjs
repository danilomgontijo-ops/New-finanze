const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

const regex = /const cdiMonthPct = cdiMonthFactor - 1;\s*const prevTwrAccum =/;

const replacement = `const cdiMonthPct = cdiMonthFactor - 1;
      const ipcaMonthObj = ipcaHistory.find(d => d.date.startsWith(monthKey));
      const ipcaMonthPct = ipcaMonthObj ? ipcaMonthObj.value / 100 : 0;
      
      const ibovMonthRates = ibovHistory.filter(d => d.date.startsWith(monthKey)).sort((a,b) => a.date.localeCompare(b.date));
      let ibovMonthPct = 0;
      if (ibovMonthRates.length > 0) {
        const first = ibovMonthRates[0];
        const last = ibovMonthRates[ibovMonthRates.length - 1];
        ibovMonthPct = (last.value / first.value) - 1;
      }
      const prevTwrAccum =`;

code = code.replace(regex, replacement);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log('Fixed benchmarks variables');
