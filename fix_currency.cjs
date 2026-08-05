const fs = require('fs');

let code = fs.readFileSync('components/Dashboard.tsx', 'utf8');

// Use regex to replace variations of toLocaleString with formatCurrency.
// For example: (stats.creditTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
// will become formatCurrency(stats.creditTotal || 0)

// A simple regex might be hard because of nested brackets. 
// Since we only want to ensure formatCurrency is used:
code = code.replace(/R\$\s*\{([^}]+)\.toLocaleString\([^)]*\)\}/g, "{formatCurrency($1)}");
code = code.replace(/R\$\s*\{\(([^)]+)\)\.toLocaleString\([^)]*\)\}/g, "{formatCurrency($1)}");

// For cases without R$ inside {}
code = code.replace(/\{([^}]+)\.toLocaleString\([^)]*\)\}/g, "{formatCurrency($1)}");
code = code.replace(/\{\(([^)]+)\)\.toLocaleString\([^)]*\)\}/g, "{formatCurrency($1)}");


fs.writeFileSync('components/Dashboard.tsx', code, 'utf8');
