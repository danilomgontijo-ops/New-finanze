const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');
const regex = /chartData\.push\(dataPoint\);/;
if (!code.includes('window.TEST_CHART = dataPoint;')) {
  code = code.replace(regex, 'chartData.push(dataPoint); window.TEST_CHART = dataPoint;');
  fs.writeFileSync('components/Investments.tsx', code, 'utf8');
}
