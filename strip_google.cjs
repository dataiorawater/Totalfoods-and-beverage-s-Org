const fs = require('fs');

// 1. App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(/import \{ onAuthChange, logoutGoogle \} from '\.\/services\/auth';/g, '');
appCode = appCode.replace(/const \[isGoogleAuthenticated, setIsGoogleAuthenticated\] = useState[^\)]+\)[^;]*;/g, '');
appCode = appCode.replace(/const \[googleUser, setGoogleUser\] = useState<any>\(null\);/g, '');
appCode = appCode.replace(/\/\/ Initialize Google Auth listener[\s\S]*?return \(\) => unsubscribe\(\);\n  \}, \[\]\);/g, '');
appCode = appCode.replace(/isGoogleAuthenticated=\{isGoogleAuthenticated\}/g, '');
appCode = appCode.replace(/googleUser=\{googleUser\}/g, '');
appCode = appCode.replace(/isGoogleAuthenticated, /g, '');
appCode = appCode.replace(/isGoogleAuthenticated/g, 'true'); // just in case
fs.writeFileSync('src/App.tsx', appCode);

// 2. LoginScreen.tsx
let loginCode = fs.readFileSync('src/components/LoginScreen.tsx', 'utf8');
loginCode = loginCode.replace(/isGoogleAuthenticated\?: boolean;/g, '');
fs.writeFileSync('src/components/LoginScreen.tsx', loginCode);

// 3. SettingsModal.tsx
let settingsCode = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');
settingsCode = settingsCode.replace(/isGoogleAuthenticated: boolean;/g, '');
settingsCode = settingsCode.replace(/googleUser: any;/g, '');
settingsCode = settingsCode.replace(/isGoogleAuthenticated,/g, '');
settingsCode = settingsCode.replace(/googleUser,/g, '');
settingsCode = settingsCode.replace(/\{isGoogleAuthenticated && googleUser\?\.email/g, '{false');
settingsCode = settingsCode.replace(/\{!isGoogleAuthenticated \? \(/g, '{false ? (');
fs.writeFileSync('src/components/SettingsModal.tsx', settingsCode);

