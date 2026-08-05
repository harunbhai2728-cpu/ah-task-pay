const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
/      const extConfig: any = \{\};\n      \(extSnap \|\| \[\]\)\.forEach\(s => \{\n        if \(s\.setting_key === 'campaign_start_date'\) extConfig\.campaignStartDate = s\.setting_value \|\| null;\n        if \(s\.setting_key === 'referral_domain_url'\) extConfig\.referralDomainUrl = s\.setting_value;\n        if \(s\.setting_key === 'custom_banner_presets'\) \{\n          try \{ extConfig\.customBannerPresets = JSON\.parse\(s\.setting_value\); \} catch\(e\)\{\}\n        \}\n      \}\);/,
""
);

code = code.replace(
/      const \{ data: extSnap \} = await supabase\.from\("system_settings"\)\.select\("setting_key, setting_value"\)\.in\('setting_key', \['campaign_start_date', 'referral_domain_url', 'custom_banner_presets'\]\);/g,
""
);

fs.writeFileSync('server.ts', code);
