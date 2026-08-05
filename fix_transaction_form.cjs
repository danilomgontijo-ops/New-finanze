const fs = require('fs');
let code = fs.readFileSync('components/TransactionForm.tsx', 'utf8');

// Remove the options
code = code.replace(/<option value="DIVIDEND">Dividendos<\/option>/g, '');
code = code.replace(/<option value="JCP">JCP<\/option>/g, '');
code = code.replace(/<option value="RENDIMENTO">Rendimento \(FII\)<\/option>/g, '');
code = code.replace(/<option value="REEMBOLSO">Reembolso<\/option>/g, '');
// Amortizacao might also be considered provento, but let's keep it if it's not strictly mentioned, wait, the user said "proventos". The ones above are proventos.

// I will also remove `isDividendEvent` block that renders `Valor Bruto` and `Imposto` if it's no longer selectable.
// But wait, if someone is EDITING an old transaction that was created as DIVIDEND before we removed the option, it might break if we completely remove the code?
// Well, we are going to route editing dividends to DividendForm, so TransactionForm will never be opened for editing dividends!
// But just to be safe, I'll keep the `isDividendEvent` logic, but since they can't select it, it won't show for new ones.

fs.writeFileSync('components/TransactionForm.tsx', code, 'utf8');
console.log("Removed dividend options from TransactionForm.");
