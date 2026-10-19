const logger = require("../utils/logger");

/**
 * Production client for astrologyapi.com. This account actually spans TWO
 * different documented auth schemes depending on which endpoint family is
 * called — this is not a mistake, both are real and intentional here:
 *   - json.astrologyapi.com/v1/{planets,premium_kundli_report,...}: HTTP
 *     Basic auth with a `user_id` + `api_key` pair.
 *   - json.astrologyapi.com/v1/sun_sign_prediction/...: a single
 *     `x-astrologyapi-key` header, no user_id involved.
 * Credentials required in .env (see .env.example):
 *   ASTROLOGY_API_USER_ID, ASTROLOGY_API_KEY,
 *   ASTROLOGY_API_BASE_URL, ASTROLOGY_PDF_BASE_URL,
 *   ASTROLOGY_API_KUNDLI_ENDPOINT, ASTROLOGY_PDF_KUNDLI_ENDPOINT,
 *   HOROSCOPE_API_ENDPOINT
 * None of these are ever logged or returned to any caller.
 */
const BASE_URL = process.env.ASTROLOGY_API_BASE_URL || "https://json.astrologyapi.com/v1";
// Separate base URL — astrologyapi.com's ready-made PDF report products
// (e.g. premium_kundli_report) are served from a different host than the
// plain-JSON data endpoints.
const PDF_BASE_URL = process.env.ASTROLOGY_PDF_BASE_URL || "https://pdf.astrologyapi.com/v1";

const KUNDLI_ENDPOINT = process.env.ASTROLOGY_API_KUNDLI_ENDPOINT || "/planets";
// The official ready-made Premium Kundli PDF report endpoint.
const PREMIUM_KUNDLI_PDF_ENDPOINT = process.env.ASTROLOGY_PDF_KUNDLI_ENDPOINT || "/premium_kundli_report";
// Base path for the Horoscope module's sun-sign prediction endpoint — the
// zodiac sign is appended at call time (see getHoroscopePrediction below),
// so this should end just before the sign segment, e.g. ".../daily" to hit
// ".../daily/aries", ".../daily/taurus", etc. Change the period segment
// here (daily/weekly/monthly) to switch what Horoscope reports on.
const HOROSCOPE_ENDPOINT_BASE = process.env.HOROSCOPE_API_ENDPOINT || "/sun_sign_prediction/daily";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [500, 1500]; // delay before attempt 2, attempt 3

// Treats the .env.example placeholder values as "not configured" too, so a
// fresh checkout doesn't fail with a confusing "invalid credentials" error
// from the live API — it fails clearly with "not configured yet" instead.
const PLACEHOLDER_VALUES = new Set(["your_astrologyapi_user_id", "your_astrologyapi_api_key"]);
const hasRealValue = (v) => !!v && !PLACEHOLDER_VALUES.has(v);

/** Basic-auth endpoints (planets, premium_kundli_report) need BOTH user_id and api_key. */
const isConfigured = () => hasRealValue(process.env.ASTROLOGY_API_USER_ID) && hasRealValue(process.env.ASTROLOGY_API_KEY);
/** Header-auth endpoints (horoscope_prediction) only ever need the api_key. */
const isKeyConfigured = () => hasRealValue(process.env.ASTROLOGY_API_KEY);

const basicAuthHeader = () => {
  const userId = process.env.ASTROLOGY_API_USER_ID;
  const apiKey = process.env.ASTROLOGY_API_KEY;
  return `Basic ${Buffer.from(`${userId}:${apiKey}`).toString("base64")}`;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Whether a failure is worth retrying — network errors and 5xx, never 4xx (bad input won't fix itself on retry). */
const isRetryable = (error) => {
  if (error.name === "AbortError") return true; // timeout
  if (!error.status) return true; // network-level failure, no response at all
  return error.status >= 500;
};

/**
 * Shared low-level request-with-timeout-retry-logging loop. `buildRequest`
 * returns the fetch() init object (method/headers/body) for one attempt —
 * kept as a callback (not a fixed shape) so JSON/Basic-auth, form-encoded/
 * Basic-auth, and JSON/header-auth callers can all reuse this exact retry
 * behavior without duplicating it, despite having different request shapes.
 */
const requestWithRetry = async (url, buildRequest) => {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, { ...buildRequest(), signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        const error = new Error(`AstrologyAPI request to ${url} failed with status ${response.status}: ${bodyText.slice(0, 300)}`);
        error.status = response.status;
        throw error;
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      const willRetry = attempt < MAX_ATTEMPTS && isRetryable(error);
      logger.error(
        `AstrologyAPI request to ${url} failed on attempt ${attempt}/${MAX_ATTEMPTS}: ${error.message}${willRetry ? " — retrying" : ""}`,
      );

      if (!willRetry) break;
      await sleep(RETRY_BACKOFF_MS[attempt - 1] || RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]);
    }
  }

  throw lastError;
};

const postJsonBasicAuth = (path, payload) =>
  requestWithRetry(`${BASE_URL}${path}`, () => ({
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: basicAuthHeader() },
    body: JSON.stringify(payload),
  }));

const postFormBasicAuth = (baseUrl, path, fields) =>
  requestWithRetry(`${baseUrl}${path}`, () => ({
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basicAuthHeader() },
    body: new URLSearchParams(
      Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== null)),
    ).toString(),
  }));

const postJsonHeaderAuth = (path, payload) =>
  requestWithRetry(`${BASE_URL}${path}`, () => ({
    method: "POST",
    headers: { "Content-Type": "application/json", "x-astrologyapi-key": process.env.ASTROLOGY_API_KEY },
    body: JSON.stringify(payload),
  }));

/**
 * Fetches raw astrological data (planetary positions / chart data,
 * depending on ASTROLOGY_API_KUNDLI_ENDPOINT) for a birth date/time/place.
 * All fields are numeric per astrologyapi.com's documented contract.
 */
const getKundliData = async ({ day, month, year, hour, min, latitude, longitude, timezoneOffset }) => {
  if (!isConfigured()) {
    throw new Error("AstrologyAPI credentials are not configured (ASTROLOGY_API_USER_ID / ASTROLOGY_API_KEY missing in .env)");
  }

  return postJsonBasicAuth(KUNDLI_ENDPOINT, {
    day, month, year, hour, min,
    lat: latitude,
    lon: longitude,
    tzone: timezoneOffset,
  });
};

/**
 * Calls astrologyapi.com's official ready-made Premium Kundli PDF report
 * product (POST .../premium_kundli_report, form-urlencoded, Basic auth).
 * Field names below are sent exactly as documented (latitude/longitude/
 * language/timezone, not the lat/lon/tzone/lang shorthand getKundliData
 * above uses for /planets — the two endpoints have separate contracts).
 * Returns the raw parsed response — kundliGeneration.service.js is
 * responsible for reading `pdf_url` off it (the exact wrapping — top-level
 * vs nested under `response` — isn't firmly documented, so that's handled
 * defensively there rather than assumed here).
 */
const getPremiumKundliPdf = async ({
  name, gender, day, month, year, hour, min, latitude, longitude, timezone, place, language,
  chartStyle, footerLink, logoUrl, companyName, companyInfo, domainUrl, companyEmail, companyLandline, companyMobile,
}) => {
  if (!isConfigured()) {
    throw new Error("AstrologyAPI credentials are not configured (ASTROLOGY_API_USER_ID / ASTROLOGY_API_KEY missing in .env)");
  }

  return postFormBasicAuth(PDF_BASE_URL, PREMIUM_KUNDLI_PDF_ENDPOINT, {
    name, gender, day, month, year, hour, min, latitude, longitude, timezone, place,
    language: language || "en",
    chart_style: chartStyle,
    footer_link: footerLink,
    logo_url: logoUrl,
    company_name: companyName,
    company_info: companyInfo,
    domain_url: domainUrl,
    company_email: companyEmail,
    company_landline: companyLandline,
    company_mobile: companyMobile,
  });
};

const ZODIAC_SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
];

/**
 * Sun-sign prediction endpoint (POST .../sun_sign_prediction/{period}/{sign}).
 * Deliberately NOT a personalized birth-chart report — astrologyapi.com
 * documents this family as a generic prediction per zodiac sign/period,
 * the same for everyone born under that sign in that window. The only
 * input is `timezone`; day/month/year/lat/lon are not part of this
 * endpoint's contract and are intentionally not sent.
 */
const getHoroscopePrediction = async ({ sign, timezoneOffset }) => {
  if (!isKeyConfigured()) {
    throw new Error("AstrologyAPI key is not configured (ASTROLOGY_API_KEY missing in .env)");
  }
  if (!ZODIAC_SIGNS.includes(sign)) {
    throw new Error(`Unknown zodiac sign "${sign}"`);
  }

  return postJsonHeaderAuth(`${HOROSCOPE_ENDPOINT_BASE}/${sign}`, { timezone: timezoneOffset });
};

module.exports = {
  getKundliData,
  getPremiumKundliPdf,
  getHoroscopePrediction,
  ZODIAC_SIGNS,
  isConfigured,
  isKeyConfigured,
};
