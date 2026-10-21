const fs = require('fs');
let code = fs.readFileSync('components/DividendForm.tsx', 'utf8');

// add transactionToEdit to props
code = code.replace(
  /interface DividendFormProps \{/,
  'interface DividendFormProps {\n  transactionToEdit?: Transaction | null;'
);

code = code.replace(
  /export const DividendForm: React\.FC<DividendFormProps> = \(\{ categories, subCategories = \[\], transactions = \[\], onSave, onClose \}\) => \{/,
  'export const DividendForm: React.FC<DividendFormProps> = ({ categories, subCategories = [], transactions = [], onSave, onClose, transactionToEdit }) => {'
);

// inside component, initialize states from transactionToEdit
code = code.replace(
  /const \[ticker, setTicker\] = useState\(''\);/,
  `const [ticker, setTicker] = useState(transactionToEdit?.investmentDetails?.ticker || '');`
);

code = code.replace(
  /const \[broker, setBroker\] = useState\(''\);/,
  `const [broker, setBroker] = useState(transactionToEdit?.investmentDetails?.broker || '');`
);

code = code.replace(
  /const \[eventType, setEventType\] = useState<'DIVIDEND' \| 'JCP' \| 'RENDIMENTO' \| 'REEMBOLSO'>\('DIVIDEND'\);/,
  `const [eventType, setEventType] = useState<'DIVIDEND' | 'JCP' | 'RENDIMENTO' | 'REEMBOLSO'>((transactionToEdit?.investmentDetails?.event as any) || 'DIVIDEND');`
);

code = code.replace(
  /const \[date, setDate\] = useState\(new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]\);/,
  `const [date, setDate] = useState(transactionToEdit?.date || new Date().toISOString().split('T')[0]);`
);

code = code.replace(
  /const \[grossValue, setGrossValue\] = useState\(''\);/,
  `const [grossValue, setGrossValue] = useState(transactionToEdit?.amount ? String(Math.abs(transactionToEdit.amount) + (transactionToEdit.investmentDetails?.tax || 0)) : '');`
);

code = code.replace(
  /const \[taxValue, setTaxValue\] = useState\(''\);/,
  `const [taxValue, setTaxValue] = useState(transactionToEdit?.investmentDetails?.tax ? String(transactionToEdit.investmentDetails.tax) : '');`
);

code = code.replace(
  /const \[netValue, setNetValue\] = useState\(''\);/,
  `const [netValue, setNetValue] = useState(transactionToEdit?.amount ? String(Math.abs(transactionToEdit.amount)) : '');`
);

code = code.replace(
  /const \[currency, setCurrency\] = useState<'BRL' \| 'USD'>\('BRL'\);/,
  `const [currency, setCurrency] = useState<'BRL' | 'USD'>((transactionToEdit?.currency as any) || 'BRL');`
);

code = code.replace(
  /const \[ptax, setPtax\] = useState\(''\);/,
  `const [ptax, setPtax] = useState(transactionToEdit?.investmentDetails?.ptax ? String(transactionToEdit.investmentDetails.ptax) : '');`
);

code = code.replace(
  /const isEditing = false;/, // Just in case I want to add something about isEditing later
  `const isEditing = !!transactionToEdit;`
);

// inside handleSave, we need to pass back the id if we are editing. Wait, the `onSave` takes `Partial<Transaction>`.
// So if `transactionToEdit` exists, we can pass `id: transactionToEdit.id`.
// Let's find handleSave.
// we can do a replace for the return object
fs.writeFileSync('components/DividendForm.tsx', code, 'utf8');
console.log("Updated DividendForm state initializations.");
