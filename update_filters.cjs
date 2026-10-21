const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

// replace the state declarations for filters with global ones, but keep names for compatibility if we want, or just add global ones and map the old names to the global ones.
code = code.replace(
  /const \[portfolioSearchTerm, setPortfolioSearchTerm\] = useState\(""\);/g,
  `const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [globalCategoryFilters, setGlobalCategoryFilters] = useState<string[]>([]);
  const [globalSubCategoryFilters, setGlobalSubCategoryFilters] = useState<string[]>([]);
  const portfolioSearchTerm = globalSearchTerm;
  const setPortfolioSearchTerm = setGlobalSearchTerm;`
);

code = code.replace(
  /const \[portfolioCategoryFilters, setPortfolioCategoryFilters\] = useState<\n\s*string\[\]\n\s*>\(\[\]\);/g,
  `const portfolioCategoryFilters = globalCategoryFilters;
  const setPortfolioCategoryFilters = setGlobalCategoryFilters;`
);

code = code.replace(
  /const \[portfolioSubCategoryFilters, setPortfolioSubCategoryFilters\] =\n\s*useState<string\[\]>\(\[\]\);/g,
  `const portfolioSubCategoryFilters = globalSubCategoryFilters;
  const setPortfolioSubCategoryFilters = setGlobalSubCategoryFilters;`
);

code = code.replace(
  /const \[historySearchTerm, setHistorySearchTerm\] = useState\(""\);/g,
  `const historySearchTerm = globalSearchTerm;
  const setHistorySearchTerm = setGlobalSearchTerm;`
);

code = code.replace(
  /const \[overviewSearchTerm, setOverviewSearchTerm\] = useState\(""\);/g,
  `const overviewSearchTerm = globalSearchTerm;
  const setOverviewSearchTerm = setGlobalSearchTerm;`
);

code = code.replace(
  /const \[proventosSearch, setProventosSearch\] = useState\(""\);/g,
  `const proventosSearch = globalSearchTerm;
  const setProventosSearch = setGlobalSearchTerm;`
);

code = code.replace(
  /const \[proventosTickerFilter, setProventosTickerFilter\] = useState\(""\);/g,
  `const proventosTickerFilter = globalSearchTerm;
  const setProventosTickerFilter = setGlobalSearchTerm;`
);

code = code.replace(
  /const \[proventosCategoryFilter, setProventosCategoryFilter\] = useState\(""\);/g,
  `const proventosCategoryFilter = globalCategoryFilters[0] || "";
  const setProventosCategoryFilter = (val: string) => setGlobalCategoryFilters(val ? [val] : []);`
);

code = code.replace(
  /const \[historyFilterCategory, setHistoryFilterCategory\] = useState\(""\);/g,
  `const historyFilterCategory = globalCategoryFilters[0] || "";
  const setHistoryFilterCategory = (val: string) => setGlobalCategoryFilters(val ? [val] : []);`
);

code = code.replace(
  /const \[historyFilterSubCategory, setHistoryFilterSubCategory\] = useState\(""\);/g,
  `const historyFilterSubCategory = globalSubCategoryFilters[0] || "";
  const setHistoryFilterSubCategory = (val: string) => setGlobalSubCategoryFilters(val ? [val] : []);`
);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log("Replaced filter state definitions");
