const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

// We need to insert a useMemo to calculate the filtered dividends and their summary
const summarySnippet = `
  const filteredDividendsList = useMemo(() => {
    return investmentTransactions
      .filter((t) =>
        ["DIVIDEND", "JCP", "RENDIMENTO", "REEMBOLSO"].includes(
          t.investmentDetails?.event || "",
        ),
      )
      .filter((t) => {
        if (proventosYearFilter && !t.date.startsWith(proventosYearFilter))
          return false;
        if (
          proventosTickerFilter &&
          !t.investmentDetails?.ticker.includes(
            proventosTickerFilter.toUpperCase(),
          )
        )
          return false;
        if (proventosCategoryFilter && t.categoryId !== proventosCategoryFilter)
          return false;
        return true;
      });
  }, [investmentTransactions, proventosYearFilter, proventosTickerFilter, proventosCategoryFilter]);

  const filteredProventosSummary = useMemo(() => {
    let total = 0;
    let total12m = 0;
    const oneYearAgoStr = new Date();
    oneYearAgoStr.setFullYear(oneYearAgoStr.getFullYear() - 1);
    const oneYearAgo = oneYearAgoStr.toISOString();

    filteredDividendsList.forEach((t) => {
      total += t.amount;
      if (t.date >= oneYearAgo) {
        total12m += t.amount;
      }
    });

    // Calculate invested value for the filtered items
    // Filter the portfolioData.assets by ticker and category if applicable
    let investedValue = 0;
    Object.values(portfolioData.assets).forEach((asset) => {
      if (proventosTickerFilter && !asset.ticker.includes(proventosTickerFilter.toUpperCase())) return;
      if (proventosCategoryFilter && asset.categoryId !== proventosCategoryFilter) return;
      investedValue += asset.totalCost; // Cost basis
    });

    return { total, total12m, investedValue };
  }, [filteredDividendsList, portfolioData, proventosTickerFilter, proventosCategoryFilter]);
`;

code = code.replace(
  /const proventosChartData = useMemo\(\(\) => \{/,
  summarySnippet + '\n  const proventosChartData = useMemo(() => {'
);

code = code.replace(
  /investmentTransactions\s*\.filter\(\(t\) =>\s*\["DIVIDEND", "JCP", "RENDIMENTO", "REEMBOLSO"\]\.includes\(\s*t\.investmentDetails\?\.event \|\| "",\s*\),\s*\)\s*\.forEach/g,
  'filteredDividendsList.forEach'
);

code = code.replace(
  /investmentTransactions\s*\.filter\(\(t\) =>\s*\["DIVIDEND", "JCP", "RENDIMENTO", "REEMBOLSO"\]\.includes\(\s*t\.investmentDetails\?\.event \|\| "",\s*\),\s*\)\s*\.filter\(\(t\) => \{[\s\S]*?return true;\s*\}\)\s*\.forEach/g,
  'filteredDividendsList.forEach'
);

// We need to fix the dependency arrays for proventosChartData, topPayers, and monthlyDividendsTable
code = code.replace(
  /\}, \[investmentTransactions\]\);/g,
  '}, [filteredDividendsList]);'
);
code = code.replace(
  /\}, \[\s*investmentTransactions,\s*proventosYearFilter,\s*proventosTickerFilter,\s*proventosCategoryFilter,\s*\]\);/g,
  '}, [filteredDividendsList]);'
);

// Now update the UI to use filteredProventosSummary
// Replace portfolioData.summary.proventosTotal in the Proventos tab
// Wait, we have to be careful. The tab check is `{activeTab === "proventos" && (`
code = code.replace(
  /\{formatCurrency\(portfolioData\.summary\.proventosTotal\)\}/g,
  '{formatCurrency(filteredProventosSummary.total)}'
);
code = code.replace(
  /\{formatCurrency\(portfolioData\.summary\.proventos12mTotal \/ 12\)\}/g,
  '{formatCurrency(filteredProventosSummary.total12m / 12)}'
);
code = code.replace(
  /\{calculateYoC\(portfolioData\.summary\.proventos12mTotal, portfolioData\.summary\.investedValue\)\.toFixed\(2\)\}%/g,
  '{calculateYoC(filteredProventosSummary.total12m, filteredProventosSummary.investedValue).toFixed(2)}%'
);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
