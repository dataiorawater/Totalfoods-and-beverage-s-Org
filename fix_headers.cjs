const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace("await ensureAllSheetsTabs(sheetsConfig.spreadsheetId).catch(e => console.warn('ensureAllSheetsTabs error:', e));", "// await ensureAllSheetsTabs(sheetsConfig.spreadsheetId).catch(e => console.warn('ensureAllSheetsTabs error:', e));");
code = code.replace('await migrateOrderHeaders(sheetsConfig.spreadsheetId, sheetsConfig.sheetName).catch(e => console.warn("migrate error", e));', '// await migrateOrderHeaders(sheetsConfig.spreadsheetId, sheetsConfig.sheetName).catch(e => console.warn("migrate error", e));');
code = code.replace('await migrateRouteHeaders(sheetsConfig.spreadsheetId).catch(e => console.warn("migrateRoute error", e));', '// await migrateRouteHeaders(sheetsConfig.spreadsheetId).catch(e => console.warn("migrateRoute error", e));');

fs.writeFileSync('src/App.tsx', code);
