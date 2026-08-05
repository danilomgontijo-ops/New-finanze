const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

// import DividendForm
code = code.replace(
  /import \{ Investments \} from '.\/components\/Investments';/,
  `import { Investments } from './components/Investments';\nimport { DividendForm } from './components/DividendForm';`
);

// add state for dividend form
code = code.replace(
  /const \[isTransactionFormOpen, setIsTransactionFormOpen\] = useState\(false\);/,
  `const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [isDividendFormOpen, setIsDividendFormOpen] = useState(false);
  const [editingDividend, setEditingDividend] = useState<Transaction | null>(null);`
);

// create a unified handleEditTransaction
code = code.replace(
  /const \[editingTransaction, setEditingTransaction\] = useState<Transaction \| null>\(null\);/,
  `const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const handleEditTransaction = (t: Transaction) => {
    if (t.type === TransactionType.INVESTMENT && t.investmentDetails?.event && ['DIVIDEND', 'JCP', 'RENDIMENTO', 'REEMBOLSO'].includes(t.investmentDetails.event)) {
      setEditingDividend(t);
      setIsDividendFormOpen(true);
    } else {
      setEditingTransaction(t);
      setIsTransactionFormOpen(true);
    }
  };`
);

// replace all `onEditTransaction={(t) => { setEditingTransaction(t); setIsTransactionFormOpen(true); }}` with `onEditTransaction={handleEditTransaction}`
code = code.replace(/onEditTransaction=\{\(t\) => \{ setEditingTransaction\(t\); setIsTransactionFormOpen\(true\); \}\}/g, 'onEditTransaction={handleEditTransaction}');

// add onOpenDividendForm to Investments props
// First we need to update Investments interface and usage
code = code.replace(
  /<Investments\s+transactions=\{transactions\}/,
  `<Investments\n                     onOpenDividendForm={() => { setEditingDividend(null); setIsDividendFormOpen(true); }}\n                     transactions={transactions}`
);

// Add the Modal rendering
code = code.replace(
  /\{isTransactionFormOpen && \(/,
  `{isDividendFormOpen && (
          <DividendForm
            transactionToEdit={editingDividend}
            categories={categories}
            subCategories={subCategories}
            transactions={transactions}
            onSave={handleSaveTransaction}
            onClose={() => { setIsDividendFormOpen(false); setEditingDividend(null); }}
          />
       )}
       {isTransactionFormOpen && (`
);

fs.writeFileSync('App.tsx', code, 'utf8');
console.log("Updated App.tsx with DividendForm logic.");
