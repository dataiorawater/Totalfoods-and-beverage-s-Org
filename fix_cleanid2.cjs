const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

const derivedIdLogic = `  // Derived cleanId for display
  let currentCleanId = spreadsheetId.trim();
  if (currentCleanId.includes('/d/')) {
    const match = currentCleanId.match(/\\/d\\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      currentCleanId = match[1];
    }
  }

  const handleSaveSheetsConfig = () => {`;

code = code.replace(/  const handleSaveSheetsConfig = \(\) => \{/, derivedIdLogic);
code = code.replace(/\{cleanId && \(/g, '{currentCleanId && (');
code = code.replace(/\$\{cleanId\}/g, '${currentCleanId}');

fs.writeFileSync('src/components/SettingsModal.tsx', code);
