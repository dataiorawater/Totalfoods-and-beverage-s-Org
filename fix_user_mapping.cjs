const fs = require('fs');
let code = fs.readFileSync('src/services/googleSheets.ts', 'utf8');

// Fix fetchUsersFromSheets
const oldFetchLine = "id: row[0] ? String(row[0]) : 'user-' + idx, name: String(row[2] || ''), email: String(row[1] || ''), role: String(row[3] || 'viewer'), phone: String(row[4] || ''), password: String(row[8] || ''), status: String(row[5] || 'active'), createdAt: String(row[6] || ''), lastLogin: String(row[7] || '')";
const newFetchLine = "id: row[0] ? String(row[0]) : 'user-' + idx, name: String(row[1] || ''), email: String(row[2] || ''), role: String(row[3] || 'viewer'), phone: String(row[4] || ''), password: String(row[5] || ''), status: String(row[6] || 'active'), createdAt: String(row[7] || ''), lastLogin: String(row[8] || '')";
code = code.replace(oldFetchLine, newFetchLine);

// Fix saveUserToSheet
const oldSaveLine = "const rowData = [u.id || Date.now().toString(), u.email || '', u.name || '', u.role || 'viewer', u.phone || '', u.status || 'active', u.createdAt || new Date().toISOString(), u.lastLogin || '', u.password || ''];";
const newSaveLine = "const rowData = [u.id || Date.now().toString(), u.name || '', u.email || '', u.role || 'viewer', u.phone || '', u.password || '', u.status || 'active', u.createdAt || new Date().toISOString(), u.lastLogin || ''];";
code = code.replace(oldSaveLine, newSaveLine);

fs.writeFileSync('src/services/googleSheets.ts', code);
