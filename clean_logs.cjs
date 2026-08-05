const fs = require('fs');

let appCode = fs.readFileSync('App.tsx', 'utf8');
appCode = appCode.replace(/console\.log\("App ipcaHistory", ipcaData\.length, "ibovHistory", ibovData\.length, ibovData\[0\]\);\s*/, '');
appCode = appCode.replace(/\.catch\(e => \{\s*console\.error\("Error fetching benchmarks", e\);\s*setHasFetchedCdi\(true\);\s*\}\);/, '');
fs.writeFileSync('App.tsx', appCode, 'utf8');

let invCode = fs.readFileSync('components/Investments.tsx', 'utf8');
invCode = invCode.replace(/ window\.TEST_CHART = dataPoint;/, '');
fs.writeFileSync('components/Investments.tsx', invCode, 'utf8');
