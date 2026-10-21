const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

const oldHistoryFilter = `      if (
        historySearchTerm &&
        !(
          t.investmentDetails?.ticker.includes(
            historySearchTerm.toUpperCase(),
          ) ||
          (t.investmentDetails?.newTicker &&
            t.investmentDetails.newTicker.includes(
              historySearchTerm.toUpperCase(),
            ))
        )
      )
        return false;`;

const newHistoryFilter = `      if (historySearchTerm) {
        const searchTerms = historySearchTerm.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
        if (searchTerms.length > 0) {
          const matches = searchTerms.some(term => 
            t.investmentDetails?.ticker.includes(term) ||
            (t.investmentDetails?.newTicker && t.investmentDetails.newTicker.includes(term))
          );
          if (!matches) return false;
        }
      }`;

code = code.replace(oldHistoryFilter, newHistoryFilter);
fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log("Updated history search");
