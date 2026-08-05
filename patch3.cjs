const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const rehydrateLogic = `
      if (!checkErr) {
        hasSupabaseSettingsTable = true;
        console.log("Supabase system_settings table is available.");
        
        // Re-hydrate store from system_settings
        try {
           const { data: extSnap } = await supabase.from("system_settings").select("setting_key, setting_value").in('setting_key', ['campaign_start_date', 'referral_domain_url', 'custom_banner_presets']);
           if (extSnap && extSnap.length > 0) {
              const store = getDataStore();
              let changed = false;
              extSnap.forEach((s: any) => {
                 if (s.setting_key === 'campaign_start_date') { store.campaignStartDate = s.setting_value || null; changed = true; }
                 if (s.setting_key === 'referral_domain_url') { store.referralDomainUrl = s.setting_value; changed = true; }
                 if (s.setting_key === 'custom_banner_presets') { 
                    try { store.customBannerPresets = JSON.parse(s.setting_value); changed = true; } catch(e){} 
                 }
              });
              if (changed) saveDataStore(store);
           }
        } catch(e) {
           console.error("Failed to re-hydrate store", e);
        }
      } else {
`;

code = code.replace(
/      if \(\!checkErr\) \{\n        hasSupabaseSettingsTable = true;\n        console\.log\("Supabase system_settings table is available\."\);\n      \} else \{/,
rehydrateLogic
);

fs.writeFileSync('server.ts', code);
