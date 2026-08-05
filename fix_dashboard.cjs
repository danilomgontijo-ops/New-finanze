const fs = require('fs');

let code = fs.readFileSync('components/Dashboard.tsx', 'utf8');

// 1. Insert formatCurrency
if (!code.includes('const formatCurrency = ')) {
  code = code.replace(
    "const IconRenderer =",
    "const formatCurrency = (val: number, currency: string = 'BRL') => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });\nconst IconRenderer ="
  );
}

// 2. Fix cardData
const oldCardData = `  const cardData = useMemo(() => {
    const groupedCredit = creditCards.map(card => {
      let total = 0;
      filteredTransactions.forEach(t => {
        if (t.paymentMethod === PaymentMethod.CREDIT_CARD && t.creditCardId === card.id && !isNathyTransaction(t)) {
          total += t.amount;
        }
      });
      return { ...card, total };
    });
    return { groupedCredit };
  }, [creditCards, filteredTransactions, categories]);`;

const newCardData = `  const cardData = useMemo(() => {
    const groupedCredit = creditCards.map(card => {
      let total = 0;
      let myTotal = 0;
      filteredTransactions.forEach(t => {
        if (t.paymentMethod === PaymentMethod.CREDIT_CARD && t.creditCardId === card.id) {
          total += t.amount;
          if (!isNathyTransaction(t)) {
            myTotal += t.amount;
          }
        }
      });
      return { ...card, total, myTotal };
    });
    return { groupedCredit };
  }, [creditCards, filteredTransactions, categories]);`;

code = code.replace(oldCardData, newCardData);

// 3. Fix recentTransactions
const oldRecent = `  const recentTransactions = useMemo(() => {
    return [...filteredTransactions]
      .filter(t => !isNathyTransaction(t))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [filteredTransactions, categories]);`;

const newRecent = `  const recentTransactions = useMemo(() => {
    return [...transactions]
      .filter(t => !isNathyTransaction(t) && (!t.currentInstallment || t.currentInstallment === 1))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [transactions, categories]);`;

code = code.replace(oldRecent, newRecent);

fs.writeFileSync('components/Dashboard.tsx', code, 'utf8');
