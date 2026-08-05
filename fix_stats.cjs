const fs = require('fs');

let code = fs.readFileSync('components/Dashboard.tsx', 'utf8');

// Update stats to include both
const oldStatsVars = `    let myReinvestedProventos = 0;
    let myReinvestedResgates = 0;
    let creditTotal = 0;
    let debitTotal = 0;`;

const newStatsVars = `    let myReinvestedProventos = 0;
    let myReinvestedResgates = 0;
    let myCreditTotal = 0;
    let totalCredit = 0;
    let debitTotal = 0;`;

code = code.replace(oldStatsVars, newStatsVars);

const oldCreditIf = `        if (t.paymentMethod === PaymentMethod.CREDIT_CARD) {
          creditTotal += t.amount;
        } else {
          debitTotal += t.amount;
        }`;

// We want to calculate totalCredit ignoring isNathy, but this loop has `if (isNathy) return;` at the top!
// So we can't do it in this loop easily. Let's look at the loop.
