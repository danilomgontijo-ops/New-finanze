const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');
const match = code.match(/console\.log\('chartData point', dataPoint\);/);
if (!match) {
  code = code.replace(/chartData\.push\(dataPoint\);/, 'console.log("dataPoint", {date: dataPoint.date, ibovAccum: dataPoint.ibovAccum, ipcaAccum: dataPoint.ipcaAccum, ibovMonthly: dataPoint.ibovMonthly}); chartData.push(dataPoint);');
  fs.writeFileSync('components/Investments.tsx', code, 'utf8');
}
