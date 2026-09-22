const fs = require('fs');
let code = fs.readFileSync('src/services/googleSheets.ts', 'utf8');

// Update fetchUsersFromSheets mapping
code = code.replace(
  /id: row\[0\] \|\| '',\s*name: row\[1\] \|\| '',\s*email: row\[2\] \|\| '',\s*role: row\[3\] \|\| 'viewer',\s*phone: row\[4\] \|\| '',\s*password: row\[5\] \|\| '',\s*status: row\[6\] \|\| 'active',\s*createdAt: row\[7\] \|\| '',\s*lastLogin: row\[8\] \|\| ''/g,
  "id: row[0] || '', name: row[2] || '', email: row[1] || '', role: row[3] || 'viewer', phone: row[4] || '', password: row[8] || '', status: row[5] || 'active', createdAt: row[6] || '', lastLogin: row[7] || ''"
);

// Update saveUserToSheet rowData
code = code.replace(
  /const rowData = \[u\.id \|\| Date\.now\(\)\.toString\(\), u\.name \|\| '', u\.email \|\| '', u\.role \|\| 'viewer', u\.phone \|\| '', u\.password \|\| '', u\.status \|\| 'active', u\.createdAt \|\| new Date\(\)\.toISOString\(\), u\.lastLogin \|\| ''\];/,
  "const rowData = [u.id || Date.now().toString(), u.email || '', u.name || '', u.role || 'viewer', u.phone || '', u.status || 'active', u.createdAt || new Date().toISOString(), u.lastLogin || '', u.password || ''];"
);

fs.writeFileSync('src/services/googleSheets.ts', code);
