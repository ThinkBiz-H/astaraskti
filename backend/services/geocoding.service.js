const { find: findTimezones } = require("geo-tz");
const logger = require("../utils/logger");

/**
 * Resolves a free-text birth place (e.g. "Jaipur, Rajasthan, India") into
 * the lat/lon/UTC-offset a real astrology API needs — the intake form only
 * ever asks for a place name (per spec, the checkout flow doesn't change),
 * so this fills the gap server-side, not client-side.
 *
 * Uses OpenStreetMap's Nominatim (free, no API key) for geocoding and the
 * offline `geo-tz` package (no network call, ships its own timezone
 * boundary data) to resolve the IANA timezone, then the UTC offset for the
 * specific birth date/time (so DST-observing regions resolve correctly for
 * historical dates, not just "today").
 */
const geocodePlace = async (placeName) => {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(placeName)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Nominatim's usage policy requires a descriptive User-Agent
        // identifying the application, not a browser-like string.
        "User-Agent": "AstroSanatanShakti-KundliService/1.0 (support@astrosanatanshakti.com)",
      },
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Geocoding request failed with status ${response.status}`);
  }

  const results = await response.json();
  if (!results || results.length === 0) {
    throw new Error(`Could not resolve coordinates for birth place "${placeName}"`);
  }

  const { lat, lon, display_name: displayName } = results[0];
  return { latitude: Number(lat), longitude: Number(lon), displayName };
};

/** UTC offset in decimal hours (e.g. 5.5 for IST) for a specific date/time — not "now", since DST varies by date. */
const resolveTimezoneOffset = (latitude, longitude, atDate) => {
  const zones = findTimezones(latitude, longitude);
  const timezone = zones[0] || "UTC";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
  }).formatToParts(atDate);

  const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+00:00";
  const match = offsetPart.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return { timezone, offset: 0 };

  const [, sign, hours, minutes] = match;
  const offset = (Number(hours) + Number(minutes) / 60) * (sign === "-" ? -1 : 1);
  return { timezone, offset };
};

/**
 * Full resolution: birth place text + birth date/time -> everything an
 * astrology API needs. Never throws to the caller for logging purposes —
 * logs and rethrows, since the caller (kundliGeneration.service.js) decides
 * how to handle a failed resolution (mark the order Failed, notify, etc.).
 */
const resolveBirthCoordinates = async (placeName, birthDateTime) => {
  try {
    const { latitude, longitude, displayName } = await geocodePlace(placeName);
    const { timezone, offset } = resolveTimezoneOffset(latitude, longitude, birthDateTime);
    return { latitude, longitude, timezone, timezoneOffset: offset, resolvedPlaceName: displayName };
  } catch (error) {
    logger.error(`Geocoding failed for birth place "${placeName}": ${error.message}`);
    throw error;
  }
};

module.exports = { resolveBirthCoordinates };
