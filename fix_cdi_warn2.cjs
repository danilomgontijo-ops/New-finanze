const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  "console.warn(`BCB CDI returned error/warning ${response.status}. Serving generated CDI database.`);",
  "// console.warn(`BCB CDI returned error/warning ${response.status}. Serving generated CDI database.`);"
);
fs.writeFileSync('server.ts', code, 'utf8');
