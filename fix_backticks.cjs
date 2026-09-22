const fs = require('fs');
let code = fs.readFileSync('src/components/ExportReportView.tsx', 'utf8');
code = code.replace(/\\`/g, '`');
fs.writeFileSync('src/components/ExportReportView.tsx', code);
