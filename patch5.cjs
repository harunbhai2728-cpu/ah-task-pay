const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
/referralDomainUrl: extConfig\.referralDomainUrl !== undefined \? extConfig\.referralDomainUrl : \(store\.referralDomainUrl \|\| "https:\/\/ahtaskpay\.onrender\.com"\),/g,
`referralDomainUrl: store.referralDomainUrl || "https://ahtaskpay.onrender.com",`
);

fs.writeFileSync('server.ts', code);
