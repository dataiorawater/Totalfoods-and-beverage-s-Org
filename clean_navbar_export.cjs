const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

code = code.replace(
  "  onOpenExportExcel: () => void;\n",
  ""
);

code = code.replace(
  "  onOpenExportExcel,\n",
  ""
);

fs.writeFileSync('src/components/Navbar.tsx', code);
