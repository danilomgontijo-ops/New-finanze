const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const regex = /\.then\(\(\[cdiData, ipcaData, ibovData\]\) => \{[\s\S]*?\}\);/;
const replacement = `.then(([cdiData, ipcaData, ibovData]) => {
        setCdiHistory(cdiData);
        setIpcaHistory(ipcaData);
        setIbovHistory(ibovData);
        setHasFetchedCdi(true);
      }).catch(e => {
        console.error("Error fetching benchmarks", e);
        setHasFetchedCdi(true);
      });`;
code = code.replace(regex, replacement);
fs.writeFileSync('App.tsx', code, 'utf8');
