const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

// Inside portfolioData useMemo
code = code.replace(
  /        if \(\n          portfolioSubCategoryFilters\.length > 0 &&\n          !portfolioSubCategoryFilters\.includes\(a\.subCategoryId\)\n        \)\n          return false;\n        return true;\n      \}\)/g,
  `        if (
          portfolioSubCategoryFilters.length > 0 &&
          !portfolioSubCategoryFilters.includes(a.subCategoryId)
        )
          return false;
        if (portfolioSearchTerm) {
          const searchTerms = portfolioSearchTerm.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
          if (searchTerms.length > 0) {
            const matches = searchTerms.some(term => a.ticker.toUpperCase().includes(term));
            if (!matches) return false;
          }
        }
        return true;
      })`
);

// We need to add portfolioSearchTerm to the dependency array of portfolioData
code = code.replace(
  /    portfolioCategoryFilters,\n    portfolioSubCategoryFilters,\n  \]\);/g,
  `    portfolioCategoryFilters,
    portfolioSubCategoryFilters,
    portfolioSearchTerm,
  ]);`
);

// We also should remove the filtering in the render loop so it doesn't double-filter, but double filtering is fine.
// Wait, same for `Object.values(assets).forEach((a: any) => {`
// Inside `Object.values(assets).forEach((a: any) => {` where we calculate `realizedProfit` and `proventosTotal` from ALL filtered assets.
code = code.replace(
  /      if \(\n        portfolioSubCategoryFilters\.length > 0 &&\n        !portfolioSubCategoryFilters\.includes\(a\.subCategoryId\)\n      \)\n        return;/g,
  `      if (
        portfolioSubCategoryFilters.length > 0 &&
        !portfolioSubCategoryFilters.includes(a.subCategoryId)
      )
        return;
      if (portfolioSearchTerm) {
        const searchTerms = portfolioSearchTerm.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
        if (searchTerms.length > 0) {
          const matches = searchTerms.some(term => a.ticker.toUpperCase().includes(term));
          if (!matches) return;
        }
      }`
);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log("Updated portfolioData filtering");
