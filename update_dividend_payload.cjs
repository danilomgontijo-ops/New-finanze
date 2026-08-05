const fs = require('fs');
let code = fs.readFileSync('components/DividendForm.tsx', 'utf8');

code = code.replace(
  /const payload: Partial<Transaction> = \{/,
  'const payload: Partial<Transaction> = {\n          id: transactionToEdit?.id,'
);

code = code.replace(
  /<div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">/,
  '<div className="bg-slate-50 dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">'
);
code = code.replace(
  /<h2 className="text-xl font-bold text-gray-800">Novo Provento<\/h2>/,
  '<h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{transactionToEdit ? "Editar Provento" : "Novo Provento"}</h2>'
);

fs.writeFileSync('components/DividendForm.tsx', code, 'utf8');
console.log("Updated DividendForm payload and title.");
