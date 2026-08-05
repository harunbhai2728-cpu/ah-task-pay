const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Insert syncSetting helper
const syncSettingHelper = `
  const syncSetting = async (key: string, value: string) => {
    try {
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("setting_key", key)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("system_settings")
          .update({
            setting_value: value,
            updated_at: new Date().toISOString(),
          })
          .eq("setting_key", key);
      } else {
        await supabase
          .from("system_settings")
          .insert([
            {
              setting_key: key,
              setting_value: value,
              updated_at: new Date().toISOString(),
            },
          ]);
      }
    } catch(err) {
      console.error("Failed to sync setting", key, err);
    }
  };
`;

code = code.replace(/const getDataStore = \(\) => \{/, syncSettingHelper + '\n  const getDataStore = () => {');

// Now in /api/proxy upsert logic
code = code.replace(
/          if \(input\.campaignStartDate !== undefined\) \{\n            const store = getDataStore\(\);\n            store\.campaignStartDate = input\.campaignStartDate;\n            saveDataStore\(store\);\n          \}/,
`          if (input.campaignStartDate !== undefined) {
            const store = getDataStore();
            store.campaignStartDate = input.campaignStartDate === "" ? null : input.campaignStartDate;
            saveDataStore(store);
            await syncSetting("campaign_start_date", store.campaignStartDate || "");
          }`);

code = code.replace(
/          if \(input\.referralDomainUrl !== undefined\) \{\n            const store = getDataStore\(\);\n            store\.referralDomainUrl = input\.referralDomainUrl;\n            saveDataStore\(store\);\n          \}/,
`          if (input.referralDomainUrl !== undefined) {
            const store = getDataStore();
            store.referralDomainUrl = input.referralDomainUrl;
            saveDataStore(store);
            await syncSetting("referral_domain_url", store.referralDomainUrl || "");
          }`);

code = code.replace(
/          if \(input\.customBannerPresets !== undefined\) \{\n            const store = getDataStore\(\);\n            store\.customBannerPresets = input\.customBannerPresets;\n            saveDataStore\(store\);\n          \}/,
`          if (input.customBannerPresets !== undefined) {
            const store = getDataStore();
            store.customBannerPresets = input.customBannerPresets;
            saveDataStore(store);
            await syncSetting("custom_banner_presets", JSON.stringify(store.customBannerPresets || []));
          }`);

fs.writeFileSync('server.ts', code);
