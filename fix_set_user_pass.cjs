const fs = require('fs');

let fileCode = fs.readFileSync('src/services/googleSheets.ts', 'utf8');

const newCode = `export const setUserPasswordInSheet = async (id: string, email: string, p: string): Promise<boolean> => {
  const existing = await fetchUsersFromSheets(id);
  const found = existing.find(x => x.email.trim().toLowerCase() === email.trim().toLowerCase());
  if (found) {
    found.password = p;
    await saveUserToSheet(id, found);
    return true;
  }
  return false;
};`;

fileCode = fileCode.replace(/export const setUserPasswordInSheet = async[\s\S]*?return false;\n\};\n/m, newCode + '\n');
fs.writeFileSync('src/services/googleSheets.ts', fileCode);
