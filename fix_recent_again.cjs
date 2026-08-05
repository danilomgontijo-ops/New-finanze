const fs = require('fs');

let code = fs.readFileSync('components/Dashboard.tsx', 'utf8');

const oldRecent = `  const recentTransactions = useMemo(() => {
    return [...filteredTransactions]
      .filter(t => !isNathyTransaction(t) && (!t.installmentIndex || t.installmentIndex === 1))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [filteredTransactions, categories]);`;

const newRecent = `  const recentTransactions = useMemo(() => {
    return [...transactions]
      .filter(t => !isNathyTransaction(t) && (!t.installmentIndex || t.installmentIndex === 1))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [transactions, categories]);`;

code = code.replace(oldRecent, newRecent);

fs.writeFileSync('components/Dashboard.tsx', code, 'utf8');
