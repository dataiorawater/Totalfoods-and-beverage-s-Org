const fs = require('fs');

let settingsCode = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

settingsCode = settingsCode.replace(/\{\/\* TAB 2: LINE NOTIFICATION \*\/\}/, ')}\n\n          {/* TAB 2: LINE NOTIFICATION */}');

fs.writeFileSync('src/components/SettingsModal.tsx', settingsCode);

