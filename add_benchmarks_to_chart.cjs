const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

const regex = /const monthRates = cdiHistory\.filter\(\(d\) => d\.date\.startsWith\(monthKey\)\);\s*let cdiMonthFactor = 1;\s*monthRates\.forEach\(\(d\) => \{\s*cdiMonthFactor \*= 1 \+ d\.value \/ 100;\s*\}\);\s*const cdiMonthPct = cdiMonthFactor - 1;\s*const prevTwrAccum =/;

const replacement = `const monthRates = cdiHistory.filter((d) => d.date.startsWith(monthKey));
      let cdiMonthFactor = 1;
      monthRates.forEach((d) => {
        cdiMonthFactor *= 1 + d.value / 100;
      });
      const cdiMonthPct = cdiMonthFactor - 1;
      
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

const cdiIndexRegex = /cdiIndex = cdiIndex \* \(1 \+ cdiMonthPct\);/;
const cdiIndexReplacement = `cdiIndex = cdiIndex * (1 + cdiMonthPct);\n      let ibovIndex = prevChartPoint ? (prevChartPoint.ibovAccum + 100) : 100;\n      ibovIndex = ibovIndex * (1 + ibovMonthPct);\n      let ipcaIndex = prevChartPoint ? (prevChartPoint.ipcaAccum + 100) : 100;\n      ipcaIndex = ipcaIndex * (1 + ipcaMonthPct);`;

// Wait, I need prevChartPoint!
// It's just `chartData.length > 0 ? chartData[chartData.length - 1] : null`
