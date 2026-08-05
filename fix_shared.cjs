const fs = require('fs');

let code = fs.readFileSync('components/Dashboard.tsx', 'utf8');

// Fix stats calculation
const oldStatsLoop = `    filteredTransactions.forEach(t => {
      const isNathy = isNathyTransaction(t);
      if (t.type === TransactionType.EXPENSE && t.paymentMethod === PaymentMethod.CREDIT_CARD) {
          totalCredit += t.amount;
      }
      if (isNathy) return;

      if (t.type === TransactionType.INCOME) {
        myIncome += t.amount;
        if (!t.excludeFromBudget) {
          myIncomeForBudget += t.amount;
        }
      } else if (t.type === TransactionType.EXPENSE) {
        myExpense += t.amount;
        if (t.fundedByResgate) {
          myResgateExpense += t.amount;
        }
        if (t.paymentMethod === PaymentMethod.CREDIT_CARD) {
          myCreditTotal += t.amount;
        } else {
          debitTotal += t.amount;
        }
      } else if (t.type === TransactionType.INVESTMENT) {`;

const newStatsLoop = `    filteredTransactions.forEach(t => {
      const isNathy = isNathyTransaction(t);
      const isShared = t.isShared;
      
      if (t.type === TransactionType.EXPENSE && t.paymentMethod === PaymentMethod.CREDIT_CARD) {
          totalCredit += t.amount;
      }
      
      if (isNathy && !isShared) return;

      if (t.type === TransactionType.INCOME) {
        myIncome += t.amount;
        if (!t.excludeFromBudget) {
          myIncomeForBudget += t.amount;
        }
      } else if (t.type === TransactionType.EXPENSE) {
        myExpense += isShared ? (t.amount / 2) : t.amount;
        if (t.fundedByResgate) {
          myResgateExpense += isShared ? (t.amount / 2) : t.amount;
        }
        if (t.paymentMethod === PaymentMethod.CREDIT_CARD) {
          myCreditTotal += isShared ? (t.amount / 2) : t.amount;
        } else {
          debitTotal += isShared ? (t.amount / 2) : t.amount;
        }
      } else if (t.type === TransactionType.INVESTMENT) {`;

code = code.replace(oldStatsLoop, newStatsLoop);

const oldGrouped = `      let total = 0;
      let myTotal = 0;
      filteredTransactions.forEach(t => {
        if (t.paymentMethod === PaymentMethod.CREDIT_CARD && t.creditCardId === card.id) {
          total += t.amount;
          if (!isNathyTransaction(t)) {
            myTotal += t.amount;
          }
        }
      });`;

const newGrouped = `      let total = 0;
      let myTotal = 0;
      filteredTransactions.forEach(t => {
        if (t.paymentMethod === PaymentMethod.CREDIT_CARD && t.creditCardId === card.id) {
          total += t.amount;
          if (t.isShared) {
            myTotal += (t.amount / 2);
          } else if (!isNathyTransaction(t)) {
            myTotal += t.amount;
          }
        }
      });`;

code = code.replace(oldGrouped, newGrouped);

fs.writeFileSync('components/Dashboard.tsx', code, 'utf8');
