const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

const regex = /const currentTwrAccum = \(1 \+ prevTwrAccum\) \* \(1 \+ monthlyReturnPct\) - 1;\s*cdiIndex = cdiIndex \* \(1 \+ cdiMonthPct\);/;

const replacement = `const currentTwrAccum = (1 + prevTwrAccum) * (1 + monthlyReturnPct) - 1;
      cdiIndex = cdiIndex * (1 + cdiMonthPct);
      
      const prevChartPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null;
      let ibovIndex = prevChartPoint ? (prevChartPoint.ibovAccum + 100) : 100;
      ibovIndex = ibovIndex * (1 + ibovMonthPct);
      let ipcaIndex = prevChartPoint ? (prevChartPoint.ipcaAccum + 100) : 100;
      ipcaIndex = ipcaIndex * (1 + ipcaMonthPct);`;

code = code.replace(regex, replacement);

const dataPointRegex = /cdiAccum: cdiIndex - 100,\s*cdiMonthly: cdiMonthPct \* 100,/;
const dataPointReplacement = `cdiAccum: cdiIndex - 100,
        cdiMonthly: cdiMonthPct * 100,
        ibovAccum: ibovIndex - 100,
        ibovMonthly: ibovMonthPct * 100,
        ipcaAccum: ipcaIndex - 100,
        ipcaMonthly: ipcaMonthPct * 100,`;

code = code.replace(dataPointRegex, dataPointReplacement);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log('Added benchmarks to chartData');
