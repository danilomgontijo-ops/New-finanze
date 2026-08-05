const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

const depsOld = `  }, [
    investmentTransactions,
    cdiHistory,
    assetPrices,
    portfolioData,
    assetHistory,
    overviewFilterCategory,
    overviewFilterSubCategory,
    overviewFilterTicker,
    overviewSearchTerm,
    categories,
    subCategories,
    settings.historyStartDate,
    overviewFilterDate,
  ]);`;

const depsNew = `  }, [
    investmentTransactions,
    cdiHistory,
    assetPrices,
    portfolioData,
    assetHistory,
    globalCategoryFilters,
    globalSubCategoryFilters,
    overviewSearchTerm,
    categories,
    subCategories,
    settings.historyStartDate,
    overviewFilterDate,
  ]);`;

code = code.replace(depsOld, depsNew);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log("Fixed overviewData dependencies");
