const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

const targetStr = `              )}
              )}
          {/* TAB 2: LINE NOTIFICATION */}`;
if (code.includes(targetStr)) {
  console.log("Matched exactly");
} else {
  console.log("Not matched exactly");
  // Let's find it by regex
  const rx = /\s+\)\}\n\s+\)\}\n\s+\{\/\* TAB 2: LINE NOTIFICATION \*\/\}/m;
  if(rx.test(code)){
     console.log("Regex matched");
  } else {
     console.log("Regex NOT matched");
  }
}
