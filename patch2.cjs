const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const extConfigLogic = `
      const { data: configSnap } = await supabase
        .from("system_configuration")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      const { data: extSnap } = await supabase.from("system_settings").select("setting_key, setting_value").in('setting_key', ['campaign_start_date', 'referral_domain_url', 'custom_banner_presets']);
      
      const extConfig: any = {};
      (extSnap || []).forEach(s => {
        if (s.setting_key === 'campaign_start_date') extConfig.campaignStartDate = s.setting_value || null;
        if (s.setting_key === 'referral_domain_url') extConfig.referralDomainUrl = s.setting_value;
        if (s.setting_key === 'custom_banner_presets') {
          try { extConfig.customBannerPresets = JSON.parse(s.setting_value); } catch(e){}
        }
      });
`;

code = code.replace(
  /      const \{ data: configSnap \} = await supabase\n        \.from\("system_configuration"\)\n        \.select\("\*"\)\n        \.eq\("id", 1\)\n        \.maybeSingle\(\);/,
  extConfigLogic
);

// update safeConfig assignments to use extConfig:
code = code.replace(
/campaignStartDate: store\.campaignStartDate \|\| null,/,
`campaignStartDate: extConfig.campaignStartDate !== undefined ? extConfig.campaignStartDate : (store.campaignStartDate || null),`
);

code = code.replace(
/customBannerPresets: store\.customBannerPresets \|\| \[\],/,
`customBannerPresets: extConfig.customBannerPresets !== undefined ? extConfig.customBannerPresets : (store.customBannerPresets || []),`
);

code = code.replace(
/referralDomainUrl: store\.referralDomainUrl \|\| "https:\/\/ahtaskpay\.onrender\.com",/,
`referralDomainUrl: extConfig.referralDomainUrl !== undefined ? extConfig.referralDomainUrl : (store.referralDomainUrl || "https://ahtaskpay.onrender.com"),`
);

fs.writeFileSync('server.ts', code);
