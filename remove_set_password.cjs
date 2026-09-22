const fs = require('fs');
let code = fs.readFileSync('src/components/LoginScreen.tsx', 'utf8');

// 1. Remove Tabs section completely
const tabsRegex = /\s*\{\/\* Tabs \*\/\}\s*<div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold">[\s\S]*?<\/div>\s*<div className="p-5 sm:p-6 bg-white">/;
code = code.replace(tabsRegex, '\n        <div className="p-5 sm:p-6 bg-white">');

// 2. Remove handleSaveNewPassword function
const handleSaveNewRegex = /const handleSaveNewPassword = async \([\s\S]*?\}\s*catch \(err: any\) \{[\s\S]*?\} finally \{[\s\S]*?\}\s*\};\s*const handleForgotPassword = async /;
code = code.replace(handleSaveNewRegex, 'const handleForgotPassword = async ');

// 3. Remove the form for set_password
// The render block looks like this:
// ) : activeMode === 'signin' ? (
// ...
// ) : (
//   <form onSubmit={handleSaveNewPassword} className="space-y-4">
// ...
//   </form>
// )}
const setPasswordFormRegex = /\s*\) : \(\s*<form onSubmit=\{handleSaveNewPassword\}[\s\S]*?<\/form>\s*\)/;
code = code.replace(setPasswordFormRegex, '');

// Update State definition
code = code.replace(
  "const [activeMode, setActiveMode] = useState<'signin' | 'set_password' | 'forgot_password'>('signin');",
  "const [activeMode, setActiveMode] = useState<'signin' | 'forgot_password'>('signin');"
);

fs.writeFileSync('src/components/LoginScreen.tsx', code);
