const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

const oldDivFilter = `        if (
          proventosTickerFilter &&
          !t.investmentDetails?.ticker.includes(
            proventosTickerFilter.toUpperCase(),
          )
        )
          return false;`;

const newDivFilter = `        if (proventosTickerFilter) {
          const searchTerms = proventosTickerFilter.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
          if (searchTerms.length > 0) {
            const matches = searchTerms.some(term => t.investmentDetails?.ticker.includes(term));
            if (!matches) return false;
          }
        }`;

code = code.replace(oldDivFilter, newDivFilter);

// Same for `investedValue` inside `filteredProventosSummary`
const oldDivInv = `      if (proventosTickerFilter && !asset.ticker.includes(proventosTickerFilter.toUpperCase())) return;`;
const newDivInv = `      if (proventosTickerFilter) {
        const searchTerms = proventosTickerFilter.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
        if (searchTerms.length > 0) {
          const matches = searchTerms.some(term => asset.ticker.toUpperCase().includes(term));
          if (!matches) return;
        }
      }`;

code = code.replace(oldDivInv, newDivInv);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log("Updated dividends search");
