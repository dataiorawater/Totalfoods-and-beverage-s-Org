const fs = require('fs');
let code = fs.readFileSync('src/services/googleSheets.ts', 'utf8');

code = code.replace(
  /id: row\[0\] \|\| '', name: row\[2\] \|\| '', email: row\[1\] \|\| '', role: row\[3\] \|\| 'viewer', phone: row\[4\] \|\| '', password: row\[8\] \|\| '', status: row\[5\] \|\| 'active', createdAt: row\[6\] \|\| '', lastLogin: row\[7\] \|\| ''/g,
  "id: String(row[0] || ''), name: String(row[2] || ''), email: String(row[1] || ''), role: String(row[3] || 'viewer'), phone: String(row[4] || ''), password: String(row[8] || ''), status: String(row[5] || 'active'), createdAt: String(row[6] || ''), lastLogin: String(row[7] || '')"
);

fs.writeFileSync('src/services/googleSheets.ts', code);
