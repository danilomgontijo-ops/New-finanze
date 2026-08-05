const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const regex = /const \[cdiHistory, setCdiHistory\] = useState<\{ date: string; value: number \}\[\]>\(\[\]\);\s*const \[hasFetchedCdi, setHasFetchedCdi\] = useState\(false\);\s*useEffect\(\(\) => \{\s*if \(\!hasFetchedCdi\) \{\s*BrapiService\.fetchCdiHistory\(\)\.then\(\(data\) => \{\s*setCdiHistory\(data\);\s*setHasFetchedCdi\(true\);\s*\}\);\s*\}\s*\}, \[hasFetchedCdi\]\);/;

const replacement = `const [cdiHistory, setCdiHistory] = useState<{ date: string; value: number }[]>([]);
  const [ipcaHistory, setIpcaHistory] = useState<{ date: string; value: number }[]>([]);
  const [ibovHistory, setIbovHistory] = useState<{ date: string; value: number }[]>([]);
  const [hasFetchedCdi, setHasFetchedCdi] = useState(false);

  useEffect(() => {
    if (!hasFetchedCdi) {
      Promise.all([
        BrapiService.fetchCdiHistory(),
        BrapiService.fetchIpcaHistory(),
        BrapiService.fetchIbovHistory()
      ]).then(([cdiData, ipcaData, ibovData]) => {
        setCdiHistory(cdiData);
        setIpcaHistory(ipcaData);
        setIbovHistory(ibovData);
        setHasFetchedCdi(true);
      });
    }
  }, [hasFetchedCdi]);`;

code = code.replace(regex, replacement);

const investmentsRegex = /<Investments\s+transactions=\{investmentTransactions\}\s+assetPrices=\{assetPrices\}\s+categories=\{categories\}\s+subCategories=\{subCategories\}\s+cdiHistory=\{cdiHistory\}\s*\/>/;
const investmentsReplacement = `<Investments\n          transactions={investmentTransactions}\n          assetPrices={assetPrices}\n          categories={categories}\n          subCategories={subCategories}\n          cdiHistory={cdiHistory}\n          ipcaHistory={ipcaHistory}\n          ibovHistory={ibovHistory}\n        />`;

code = code.replace(investmentsRegex, investmentsReplacement);

fs.writeFileSync('App.tsx', code, 'utf8');
console.log('Updated App.tsx');
