const fs = require('fs');
let code = fs.readFileSync('src/services/googleSheets.ts', 'utf8');

code = code.replace(/if \(!res \|\| !res\.values \|\| res\.values\.length === 0\) \{\s+await gasRequest\(spreadsheetId, 'appendRow', tab\.name, undefined, tab\.headers\);\s+\}/g, '');

code = code.replace(/if \(!res \|\| !res\.values \|\| res\.values\.length === 0\) \{\s+const headers = \['id', 'orderNumber', 'createdAt', 'salespersonId', 'salespersonName', 'customerName', 'items', 'freebies', 'totalAmount', 'discount', 'netAmount', 'paymentMethod', 'note', 'status', 'requestedDeliveryDate', 'location', 'updatedAt'\];\s+await gasRequest\(id, 'appendRow', ORDERS_TAB_NAME, undefined, headers\);\s+\}/g, '');

code = code.replace(/if \(!res \|\| !res\.values \|\| res\.values\.length === 0\) \{\s+const headers = \['id', 'name', 'salesrepName', 'notes'\];\s+await gasRequest\(id, 'appendRow', ROUTES_TAB_NAME, undefined, headers\);\s+\}/g, '');

fs.writeFileSync('src/services/googleSheets.ts', code);
