const PremiumKundliSettings = require("../models/PremiumKundliSettings");

/**
 * Always returns the single settings document, creating it with defaults
 * on first use — mirrors services/settings.service.js's singleton pattern.
 * Deliberately no caching (unlike Settings, which caches for 10s) — price
 * changes must reflect on the home page instantly per the spec, and this
 * is a single small document read, cheap enough to hit on every request.
 */
const getSettings = async () => {
  let settings = await PremiumKundliSettings.findOne();
  if (!settings) {
    settings = await PremiumKundliSettings.create({});
  }
  return settings;
};

const updateSettings = async (patch) => {
  const settings = await getSettings();

  // Deep-merge one level into the two sub-objects so a partial update
  // (e.g. just { seo: { metaTitle: '...' } }) doesn't wipe the rest —
  // same approach as services/settings.service.js.
  Object.keys(patch).forEach((key) => {
    if (key === "banner" || key === "thumbnail" || key === "seo") {
      settings[key] = { ...(settings[key]?.toObject?.() ?? settings[key]), ...patch[key] };
    } else {
      settings[key] = patch[key];
    }
  });

  await settings.save();
  return settings;
};

module.exports = { getSettings, updateSettings };
