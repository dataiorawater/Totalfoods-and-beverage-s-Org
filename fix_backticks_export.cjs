const fs = require('fs');
let code = fs.readFileSync('src/services/excelExport.ts', 'utf8');
code = code.replace(/\\`/g, '`');
code = code.replace(/\\\$/g, '$');
fs.writeFileSync('src/services/excelExport.ts', code);
