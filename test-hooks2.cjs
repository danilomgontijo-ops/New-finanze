const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');
const match = code.match(/console\.log\('App ibovHistory length', ibovHistory\.length\);/);
if (!match) {
  code = code.replace(/setHasFetchedCdi\(true\);/, 'setHasFetchedCdi(true); console.log("App ipcaHistory", ipcaData.length, "ibovHistory", ibovData.length, ibovData[0]);');
  fs.writeFileSync('App.tsx', code, 'utf8');
}
