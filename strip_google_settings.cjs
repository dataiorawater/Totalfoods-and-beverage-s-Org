const fs = require('fs');

let settingsCode = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

// Remove import
settingsCode = settingsCode.replace(/import \{ googleSignIn, logoutGoogle \} from '\.\.\/services\/auth';\n/g, '');

// Remove the block
settingsCode = settingsCode.replace(/\{\/\* Google Account Status \*\/\}[\s\S]*?\{\/\* TAB 2: LINE NOTIFICATION \*\/\}/m, '{/* TAB 2: LINE NOTIFICATION */}');

fs.writeFileSync('src/components/SettingsModal.tsx', settingsCode);

