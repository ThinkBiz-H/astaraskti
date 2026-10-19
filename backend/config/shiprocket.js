const axios = require("axios");

const SHIPROCKET_BASE_URL =
  process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in/v1/external";

const isShiprocketEnabled = () =>
  String(process.env.SHIPROCKET_ENABLED).toLowerCase() === "true";

const shiprocketClient = axios.create({
  baseURL: SHIPROCKET_BASE_URL,
  timeout: 15000,
});

module.exports = { shiprocketClient, isShiprocketEnabled, SHIPROCKET_BASE_URL };
