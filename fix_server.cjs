const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace("import { createServer as createViteServer } from 'vite';", "");

const viteDevStr = `  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({`;

code = code.replace(/  \/\/ Vite middleware for development\n  if \(process\.env\.NODE_ENV !== 'production'\) \{\n    const vite = await createViteServer\(\{/, viteDevStr);

// Also let's fix PORT just in case the system allows it (if we use process.env.PORT, but maybe we shouldn't). Wait.
// If the prompt explicitly says "Do NOT attempt to Read or set the PORT environment variable", I should NOT do it. I'll just keep PORT=3000.
// Let's just remove Vite from production.

fs.writeFileSync('server.ts', code);
