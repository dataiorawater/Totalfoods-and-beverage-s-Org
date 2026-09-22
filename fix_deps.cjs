const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

pkg.dependencies = pkg.dependencies || {};
for (const [k, v] of Object.entries(pkg.devDependencies || {})) {
  pkg.dependencies[k] = v;
}
pkg.devDependencies = {};

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
