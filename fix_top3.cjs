const fs = require('fs');

let code = fs.readFileSync('components/Dashboard.tsx', 'utf8');

const oldTop3 = `  const investmentStats = useMemo(() => {
    const top3 = [...portfolioList].sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 3);`;

const newTop3 = `  const investmentStats = useMemo(() => {
    // Filter out fixed income for highlights, or at least sort by percentage to show real highlights
    const top3 = [...portfolioList]
      .filter(a => !a.isFixedIncome)
      .sort((a, b) => b.totalReturnPct - a.totalReturnPct)
      .slice(0, 3);`;

code = code.replace(oldTop3, newTop3);

const oldLabel = `<span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Destaques da Carteira (Maior Lucro)</span>`;
const newLabel = `<span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Destaques da Carteira (Maior Rentabilidade)</span>`;

code = code.replace(oldLabel, newLabel);

const oldFormat = `{formatCurrency(asset.totalProfit)}`;
const newFormat = `{asset.totalReturnPct > 0 ? '+' : ''}{asset.totalReturnPct.toFixed(2)}%`;

code = code.replace(oldFormat, newFormat);

fs.writeFileSync('components/Dashboard.tsx', code, 'utf8');
