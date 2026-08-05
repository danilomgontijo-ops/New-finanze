const fs = require('fs');
const file = 'components/InvestmentBulkImporter.tsx';

let code = fs.readFileSync(file, 'utf8');

// Replace:
// const columns = lines[i].split('\t');
// if (columns.length < 5) continue;
// With:
const search = `      const columns = lines[i].split('\\t');\n      if (columns.length < 5) continue;`;
const replacement = `      let columns = lines[i].split('\\t');
      if (columns.length < 5) columns = lines[i].split('|');
      if (columns.length < 5) columns = lines[i].split(';');
      if (columns.length < 5) continue;`;

code = code.replace(search, replacement);
fs.writeFileSync(file, code, 'utf8');
