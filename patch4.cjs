const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Revert in /api/proxy select
code = code.replace(
/campaignStartDate: extConfig\.campaignStartDate !== undefined \? extConfig\.campaignStartDate : \(store\.campaignStartDate \|\| null\),/,
`campaignStartDate: store.campaignStartDate || null,`
);

code = code.replace(
/customBannerPresets: extConfig\.customBannerPresets !== undefined \? extConfig\.customBannerPresets : \(store\.customBannerPresets \|\| \[\]\),/,
`customBannerPresets: store.customBannerPresets || [],`
);

// We should be careful since it might revert in /api/admin/data as well. Let's do it specifically:
fs.writeFileSync('server.ts', code);
