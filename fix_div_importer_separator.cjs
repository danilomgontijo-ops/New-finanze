const fs = require('fs');
const file = 'components/DividendBulkImporter.tsx';

let code = fs.readFileSync(file, 'utf8');

const search = `        let columns = lines[i].split('\\t');
        if (columns.length < 4) columns = lines[i].split(';');
        
        if (columns.length < 4) continue;`;
const replacement = `        let columns = lines[i].split('\\t');
        if (columns.length < 4) columns = lines[i].split('|');
        if (columns.length < 4) columns = lines[i].split(';');
        
        if (columns.length < 4) continue;`;

code = code.replace(search, replacement);
fs.writeFileSync(file, code, 'utf8');
