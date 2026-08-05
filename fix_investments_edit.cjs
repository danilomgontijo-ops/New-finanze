const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

code = code.replace(
  /const \[isDividendFormOpen, setIsDividendFormOpen\] = useState\(false\);/,
  'const [isDividendFormOpen, setIsDividendFormOpen] = useState(false);\n  const [editingDividend, setEditingDividend] = useState<Transaction | null>(null);'
);

code = code.replace(
  /onClick=\{\(\) => setIsDividendFormOpen\(true\)\}/,
  'onClick={() => { setEditingDividend(null); setIsDividendFormOpen(true); }}'
);

code = code.replace(
  /const handleSaveDividend = async \(data: Partial<Transaction>\) => \{/,
  `const handleSaveDividend = async (data: Partial<Transaction>) => {
    if (editingDividend) {
      await StorageService.saveTransaction({ ...data, id: editingDividend.id } as Transaction);
    } else {
      await StorageService.addTransaction(data as Transaction);
    }`
);

// We need to replace all `onEditTransaction(t)` or `onEditTransaction(p)` with our custom handler, OR we can define a proxy function.
// Let's create `handleEditClick(t)`:
code = code.replace(
  /const handleToggleSelect = \(id: string\) => \{/,
  `const handleEditClick = (t: Transaction) => {
    if (t.type === TransactionType.INVESTMENT && t.investmentDetails?.event && ['DIVIDEND', 'JCP', 'RENDIMENTO', 'REEMBOLSO'].includes(t.investmentDetails.event)) {
      setEditingDividend(t);
      setIsDividendFormOpen(true);
    } else {
      onEditTransaction(t);
    }
  };

  const handleToggleSelect = (id: string) => {`
);

// Replace onEditTransaction calls with handleEditClick inside Investments.tsx.
// Be careful not to replace the props destructuring `onEditTransaction` itself.
// The calls are like `onClick={() => onEditTransaction(t)}` and `onClick={() => onEditTransaction(p)}`
code = code.replace(/onEditTransaction\(t\)/g, 'handleEditClick(t)');
code = code.replace(/onEditTransaction\(p\)/g, 'handleEditClick(p)');

// Also pass `editingDividend` to `DividendForm`
code = code.replace(
  /<DividendForm\s+categories=\{categories\}\s+subCategories=\{subCategories\}\s+transactions=\{transactions\}\s+onSave=\{handleSaveDividend\}\s+onClose=\{\(\) => setIsDividendFormOpen\(false\)\}\s+\/>/,
  `<DividendForm
          transactionToEdit={editingDividend}
          categories={categories}
          subCategories={subCategories}
          transactions={transactions}
          onSave={handleSaveDividend}
          onClose={() => setIsDividendFormOpen(false)}
        />`
);

fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log("Updated Investments.tsx for dividend editing.");
