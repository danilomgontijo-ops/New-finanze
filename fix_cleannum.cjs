const fs = require('fs');

function fixCleanNum(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');
    const oldCleanNum = `        // Limpeza de números: remove pontos de milhar e converte vírgula decimal
        const cleanNum = (val: string) => {
          if (!val) return "0";
          return val.replace(/\\./g, '').replace(',', '.').replace(/[R$\\s]/g, '');
        };`;
    const newCleanNum = `        // Limpeza de números inteligente: suporta formato BR (1.000,00) e formato US (1000.00)
        const cleanNum = (val: string) => {
          if (!val) return "0";
          let clean = val.replace(/[R$\\s]/g, '').trim();
          // Se tiver vírgula e ponto, assumimos que o último é o decimal
          const lastComma = clean.lastIndexOf(',');
          const lastDot = clean.lastIndexOf('.');
          
          if (lastComma > lastDot) {
              // Formato BR: 1.000,00
              clean = clean.replace(/\\./g, '').replace(',', '.');
          } else if (lastDot > lastComma) {
              // Formato US: 1,000.00
              clean = clean.replace(/,/g, '');
          } else if (lastComma !== -1) {
              // Apenas vírgula: 1000,00
              clean = clean.replace(',', '.');
          }
          // Se tiver apenas ponto, e tiver mais de 2 casas decimais após ele (ex: 1.000), pode ser milhar.
          // Mas normalmente assumimos que é decimal se tiver apenas 1 ponto.
          
          return clean;
        };`;
    
    code = code.replace(oldCleanNum, newCleanNum);
    fs.writeFileSync(filePath, code, 'utf8');
}

fixCleanNum('components/InvestmentBulkImporter.tsx');
fixCleanNum('components/DividendBulkImporter.tsx');
