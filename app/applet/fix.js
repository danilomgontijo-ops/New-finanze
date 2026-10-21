const fs = require('fs');
let code = fs.readFileSync('./components/Investments.tsx', 'utf-8');

const target1 = `if (!runningAssets[ticker]) { 
                  runningAssets[ticker] = { 
                      qty: 0, 
                      cost: 0, 
                      yieldRate: det.yieldRate, `;

const repl1 = `if (!runningAssets[ticker]) { 
                  const catName = categories.find(c => c.id === t.categoryId)?.name.toLowerCase() || '';
                  const subCatName = subCategories.find(s => s.id === t.subCategoryId)?.name.toLowerCase() || '';
                  const isFixed = catName.includes('renda fixa') || subCatName.includes('renda fixa') || 
                                  catName.includes('tesouro') || subCatName.includes('tesouro') ||
                                  catName.includes('poupança') || subCatName.includes('poupança') ||
                                  ticker.toUpperCase().includes('CDB') || ticker.toUpperCase().includes('LCI') || 
                                  ticker.toUpperCase().includes('LCA') || ticker.toUpperCase().includes('CRI') || 
                                  ticker.toUpperCase().includes('CRA') || ticker.toUpperCase().includes('DEBENTURE');
                  
                  let yRate = det.yieldRate;
                  if (!yRate && isFixed && !ticker.toUpperCase().includes('TESOURO') && !ticker.toUpperCase().startsWith('TD:')) {
                      yRate = (ticker.toUpperCase().includes('POUPA') || catName.includes('poupança')) ? '70% CDI' : '100% CDI';
                  }

                  runningAssets[ticker] = { 
                      qty: 0, 
                      cost: 0, 
                      yieldRate: yRate, `;

if (code.includes(target1)) {
    code = code.replace(target1, repl1);
    fs.writeFileSync('./components/Investments.tsx', code);
    console.log("Replaced successfully!");
} else {
    console.log("Could not find target1!");
}
