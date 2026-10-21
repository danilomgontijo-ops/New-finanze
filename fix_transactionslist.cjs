const fs = require('fs');

let code = fs.readFileSync('components/TransactionsList.tsx', 'utf8');

// The formatting in TransactionsList is a bit messy, let's fix the specific ones to use minimumFractionDigits: 2
code = code.replace(/minimumFractionDigits:\s*0/g, 'minimumFractionDigits: 2');
code = code.replace(/maximumFractionDigits:\s*0/g, 'maximumFractionDigits: 2');

fs.writeFileSync('components/TransactionsList.tsx', code, 'utf8');
