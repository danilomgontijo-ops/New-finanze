const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

// Replace top bar again
const topBarMulti = `<MultiSelect
            options={subCategories.filter(
              (s) =>
                categories.find((c) => c.id === s.categoryId)?.type ===
                TransactionType.INVESTMENT,
            )}
            selected={globalSubCategoryFilters}
            onChange={setGlobalSubCategoryFilters}
            placeholder="Subcategorias"
          />`;
const topBarBoth = `<MultiSelect
            options={categories.filter(
              (c) => c.type === TransactionType.INVESTMENT,
            )}
            selected={globalCategoryFilters}
            onChange={setGlobalCategoryFilters}
            placeholder="Categorias"
          />
          <MultiSelect
            options={subCategories.filter(
              (s) =>
                categories.find((c) => c.id === s.categoryId)?.type ===
                TransactionType.INVESTMENT,
            )}
            selected={globalSubCategoryFilters}
            onChange={setGlobalSubCategoryFilters}
            placeholder="Subcategorias"
          />`;

code = code.replace(topBarMulti, topBarBoth);

// Remove from portfolio tab
const portTab = `<MultiSelect
                  options={categories.filter(
                    (c) => c.type === TransactionType.INVESTMENT,
                  )}
                  selected={portfolioCategoryFilters}
                  onChange={setPortfolioCategoryFilters}
                  placeholder="Categorias"
                />
                <MultiSelect
                  options={subCategories.filter(
                    (s) =>
                      categories.find((c) => c.id === s.categoryId)?.type ===
                      TransactionType.INVESTMENT,
                  )}
                  selected={portfolioSubCategoryFilters}
                  onChange={setPortfolioSubCategoryFilters}
                  placeholder="Subcategorias"
                />`;

code = code.replace(portTab, '');

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log("Moved both to top bar");
