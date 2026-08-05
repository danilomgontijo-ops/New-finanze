const lines = [
"BTLG11|05/08/2026|COMPRA|85|100.47|0.65|Inter|0.43|BRL||Renda Variável - BR|FII|",
"3",
"HGRU11|05/08/2026|COMPRA|67|122.09|0.62|Inter|0.41|BRL||Renda Variável - BR|FII|",
"4",
"HSML11|05/08/2026|COMPRA|61|83.89|0.39|Inter|0.26|BRL||Renda Variável - BR|FII|",
"5",
"LVBI11|05/08/2026|COMPRA|46|101.04|0.35|Inter|0.23|BRL||Renda Variável - BR|FII|"
];

let investmentCategories = [{id: 'cat1', name: 'Renda Variável - BR'}];
let subCategories = [{id: 'sub1', categoryId: 'cat1', name: 'FII'}];

const results = [];
for (let i = 0; i < lines.length; i++) {
    let columns = lines[i].split('\t');
    if (columns.length < 5) columns = lines[i].split('|');
    if (columns.length < 5) columns = lines[i].split(';');
    if (columns.length < 5) continue;
    
    try {
        const ticker = columns[0]?.trim().toUpperCase() || '';
        const rawDate = columns[1]?.trim() || '';
        let rawEvent = columns[2]?.trim().toUpperCase() || 'C';
        
        const cleanNum = (val) => {
          if (!val) return "0";
          return val.replace(/\./g, '').replace(',', '.').replace(/[R$\s]/g, '');
        };

        const rawQtyStr = cleanNum(columns[3]);
        const rawPriceStr = cleanNum(columns[4]);
        const rawFeesStr = cleanNum(columns[5]);
        const rawTaxStr = cleanNum(columns[7]);

        let quantity = parseFloat(rawQtyStr);
        let price = parseFloat(rawPriceStr);
        const fees = Math.abs(parseFloat(rawFeesStr)) || 0;
        const tax = Math.abs(parseFloat(rawTaxStr)) || 0;

        const broker = columns[6]?.trim() || '';
        const currency = columns[8]?.trim() || 'BRL';
        const obs = columns[9]?.trim() || '';
        const categoryName = columns[10]?.trim() || '';
        const subCategoryName = columns[11]?.trim() || '';
        const rawPtaxStr = cleanNum(columns[12]);
        const ptax = parseFloat(rawPtaxStr) || 0;

        const dateParts = rawDate.split('/');
        const isoDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : new Date().toISOString().split('T')[0];

        let event = 'BUY';
        if (['V', 'VENDA', 'S', 'SELL'].includes(rawEvent)) event = 'SELL';
        else if (['C', 'COMPRA', 'B', 'BUY'].includes(rawEvent)) event = 'BUY';
        
        const category = investmentCategories.find(c => 
           c.name.toLowerCase().includes(categoryName.toLowerCase()) || 
           categoryName.toLowerCase().includes(c.name.toLowerCase())
        ) || investmentCategories[0];
        
        let subCategoryId = '';
        if (category && subCategoryName) {
            const sub = subCategories.find(s => 
                 s.categoryId === category.id && 
                 s.name.toLowerCase() === subCategoryName.toLowerCase()
            );
            if (sub) subCategoryId = sub.id;
        }
        
        let totalAmount = 0;
        if (event === 'BUY') {
            totalAmount = (quantity * price) + fees + tax;
        } else if (event === 'SELL') {
            totalAmount = (quantity * price) - fees - tax;
        }

        results.push({
            id: Date.now().toString() + i,
            ticker,
            date: isoDate,
            event,
            quantity,
            price,
            fees,
            tax,
            broker,
            currency,
            totalAmount,
            categoryId: category?.id,
            subCategoryId,
            obs,
            isValid: !!(ticker && isoDate && quantity > 0 && price >= 0)
        });
    } catch (err) {
        console.error(err);
    }
}
console.log(results);
