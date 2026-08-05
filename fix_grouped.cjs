const fs = require('fs');

let code = fs.readFileSync('components/Dashboard.tsx', 'utf8');

const oldCardData = `  // Card & Installment Data
  const cardData = useMemo(() => {
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

const newCardData = `  // Card & Installment Data
  const cardData = useMemo(() => {
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

fs.writeFileSync('components/Dashboard.tsx', code, 'utf8');
