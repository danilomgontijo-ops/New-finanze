const fs = require('fs');

let code = fs.readFileSync('components/TransactionsList.tsx', 'utf8');

const oldMyPart = `          const myPart = totalItems.reduce((sum, t) => { const isNathy = (nathyCategoryId && t.categoryId === nathyCategoryId) || t.description.toLowerCase().includes('(parte nathy)'); return sum + (isNathy ? 0 : (estimatedFixedExpenses[t.id] !== undefined ? estimatedFixedExpenses[t.id] : t.amount)); }, 0);`;

const newMyPart = `          const myPart = totalItems.reduce((sum, t) => { 
              const isNathy = (nathyCategoryId && t.categoryId === nathyCategoryId) || t.description.toLowerCase().includes('(parte nathy)'); 
              const amountToUse = estimatedFixedExpenses[t.id] !== undefined ? estimatedFixedExpenses[t.id] : t.amount;
              if (t.isShared) {
                  return sum + (amountToUse / 2);
              } else if (isNathy) {
                  return sum;
              } else {
                  return sum + amountToUse;
              }
          }, 0);`;

code = code.replace(oldMyPart, newMyPart);

fs.writeFileSync('components/TransactionsList.tsx', code, 'utf8');
