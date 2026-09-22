const fs = require('fs');
let code = fs.readFileSync('src/components/LoginScreen.tsx', 'utf8');

code = code.replace(
  "</form>\n          }\n          {!sheetsConnected",
  "</form>\n          ) : null}\n          {!sheetsConnected"
);
// wait, the actual output is:
//             </form>}\n          {!sheetsConnected && (
code = code.replace(
  "</form>}",
  "</form>\n          ) : null}"
);

fs.writeFileSync('src/components/LoginScreen.tsx', code);
