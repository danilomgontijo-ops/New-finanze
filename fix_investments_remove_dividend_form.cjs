const fs = require('fs');
let code = fs.readFileSync('components/Investments.tsx', 'utf8');

// Add onOpenDividendForm to props
code = code.replace(
  /onOpenBulkImport: \(\) => void;\n\}/,
  'onOpenBulkImport: () => void;\n  onOpenDividendForm: () => void;\n}'
);

code = code.replace(
  /onOpenBulkImport,\n\}\) => \{/,
  'onOpenBulkImport,\n  onOpenDividendForm,\n}) => {'
);

// We previously added local state, let's remove it
code = code.replace(/const \[isDividendFormOpen, setIsDividendFormOpen\] = useState\(false\);\n  const \[editingDividend, setEditingDividend\] = useState<Transaction \| null>\(null\);/, '');

// We added `handleEditClick(t)`. We can remove it, because `onEditTransaction(t)` handles it now in `App.tsx`!
code = code.replace(
  /const handleEditClick = \(t: Transaction\) => \{[\s\S]*?const handleToggleSelect = \(id: string\) => \{/,
  `const handleToggleSelect = (id: string) => {`
);
code = code.replace(/onClick=\{\(\) => handleEditClick\(t\)\}/g, 'onClick={() => onEditTransaction(t)}');
code = code.replace(/onClick=\{\(\) => handleEditClick\(p\)\}/g, 'onClick={() => onEditTransaction(p)}');

// We replaced the "+ Novo Provento" click handler with setEditingDividend(null) and setIsDividendFormOpen(true). Let's change it to onOpenDividendForm()
code = code.replace(
  /onClick=\{\(\) => \{ setEditingDividend\(null\); setIsDividendFormOpen\(true\); \}\}/,
  'onClick={() => onOpenDividendForm()}'
);

// We added handleSaveDividend, remove it
code = code.replace(/const handleSaveDividend = async \(data: Partial<Transaction>\) => \{[\s\S]*?await StorageService.addTransaction\(data as Transaction\);\n    \}/, '');

// We added DividendForm rendering, remove it
code = code.replace(
  /<DividendForm\s+transactionToEdit=\{editingDividend\}\s+categories=\{categories\}\s+subCategories=\{subCategories\}\s+transactions=\{transactions\}\s+onSave=\{handleSaveDividend\}\s+onClose=\{\(\) => setIsDividendFormOpen\(false\)\}\s+\/>/,
  ''
);

// Remove the DividendForm import
code = code.replace(/import \{ DividendForm \} from ".\/DividendForm";\n/, '');
code = code.replace(/\{isDividendFormOpen && \([\s\S]*?\)\}/, '');


fs.writeFileSync('components/Investments.tsx', code, 'utf8');
console.log("Removed DividendForm local usage from Investments.tsx.");
