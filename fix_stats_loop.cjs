const fs = require('fs');

let code = fs.readFileSync('components/Dashboard.tsx', 'utf8');

const oldVars = `    let myReinvestedProventos = 0;
    let myReinvestedResgates = 0;
    let creditTotal = 0;
    let debitTotal = 0;`;

const newVars = `    let myReinvestedProventos = 0;
    let myReinvestedResgates = 0;
    let myCreditTotal = 0;
    let totalCredit = 0;
    let debitTotal = 0;`;

code = code.replace(oldVars, newVars);

const oldLoopStart = `    filteredTransactions.forEach(t => {
      const isNathy = isNathyTransaction(t);
      if (isNathy) return;`;

const newLoopStart = `    filteredTransactions.forEach(t => {
      const isNathy = isNathyTransaction(t);
      if (t.type === TransactionType.EXPENSE && t.paymentMethod === PaymentMethod.CREDIT_CARD) {
          totalCredit += t.amount;
      }
      if (isNathy) return;`;

code = code.replace(oldLoopStart, newLoopStart);

const oldCreditCheck = `        if (t.paymentMethod === PaymentMethod.CREDIT_CARD) {
          creditTotal += t.amount;
        } else {
          debitTotal += t.amount;
        }`;

const newCreditCheck = `        if (t.paymentMethod === PaymentMethod.CREDIT_CARD) {
          myCreditTotal += t.amount;
        } else {
          debitTotal += t.amount;
        }`;

code = code.replace(oldCreditCheck, newCreditCheck);

const oldReturn = `      targetSavings,
      creditTotal,
      debitTotal`;

const newReturn = `      targetSavings,
      myCreditTotal,
      totalCredit,
      debitTotal`;

code = code.replace(oldReturn, newReturn);

fs.writeFileSync('components/Dashboard.tsx', code, 'utf8');
