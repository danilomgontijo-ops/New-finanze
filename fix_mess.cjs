const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

const correctCode = `  const filteredDividendsList = useMemo(() => {
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

    let investedValue = 0;
    Object.values(portfolioData.assets).forEach((asset) => {
      if (proventosTickerFilter && !asset.ticker.includes(proventosTickerFilter.toUpperCase())) return;
      if (proventosCategoryFilter && asset.categoryId !== proventosCategoryFilter) return;
      investedValue += asset.totalCost;
    });

    return { total, total12m, investedValue };
  }, [filteredDividendsList, portfolioData, proventosTickerFilter, proventosCategoryFilter]);

  const proventosChartData = useMemo(() => {
    const data: Record<string, number> = {};
    filteredDividendsList.forEach((t) => {
      const key = t.date.slice(0, 7);
      data[key] = (data[key] || 0) + t.amount;
    });
    return Object.entries(data)
      .sort()
      .map(([date, amount]) => ({ date, amount }));
  }, [filteredDividendsList]);

  const topPayers = useMemo(() => {
    const data: Record<string, number> = {};
    filteredDividendsList.forEach((t) => {
      const ticker = t.investmentDetails?.ticker || "Outros";
      data[ticker] = (data[ticker] || 0) + t.amount;
    });
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredDividendsList]);

  const monthlyDividendsTable = useMemo(() => {
    const grouped: Record<
      string,
      { date: string; total: number; items: Transaction[] }
    > = {};
    filteredDividendsList.forEach((t) => {
      const monthKey = t.date.slice(0, 7);
      if (!grouped[monthKey])
        grouped[monthKey] = { date: monthKey, total: 0, items: [] };
      grouped[monthKey].total += t.amount;
      grouped[monthKey].items.push(t);
    });
    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredDividendsList]);`;

// find the bad lines
// from `  const filteredDividendsList = useMemo(() => {`
// to `  }, [filteredDividendsList]);` right before `  return (`

code = code.replace(
  /const filteredDividendsList = useMemo\(\(\) => \{[\s\S]*?\}, \[filteredDividendsList\]\);/,
  correctCode
);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log("Fixed mess");
