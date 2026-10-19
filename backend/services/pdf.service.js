const PDFDocument = require("pdfkit");

const COMPANY_NAME = process.env.COMPANY_NAME || "Astro Sanatan Shakti";

/** Collects a PDFKit document's output stream into a single Buffer. */
const collectPdfBuffer = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });

const formatDob = (dob) =>
  new Date(dob).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

/**
 * Renders astrologyapi.com's well-known `/planets` response shape — an
 * array of { name, sign, house, norm_degree, is_retro, ... } — as a table.
 * Returns false (without drawing anything) if the response doesn't match,
 * so the caller can fall back to a generic dump instead of a blank page.
 */
const renderPlanetsTable = (doc, planets) => {
  if (!Array.isArray(planets) || planets.length === 0) return false;
  if (!planets.every((p) => p && typeof p === "object" && "name" in p)) return false;

  const columns = [
    { key: "name", label: "Planet", width: 100 },
    { key: "sign", label: "Sign", width: 90 },
    { key: "house", label: "House", width: 60 },
    { key: "norm_degree", label: "Degree", width: 80 },
    { key: "is_retro", label: "Retrograde", width: 80 },
  ];

  let y = doc.y;
  doc.font("Helvetica-Bold").fontSize(10);
  let x = doc.page.margins.left;
  columns.forEach((col) => {
    doc.text(col.label, x, y, { width: col.width });
    x += col.width;
  });
  y += 18;
  doc.moveTo(doc.page.margins.left, y - 4).lineTo(x, y - 4).strokeColor("#cccccc").stroke();

  doc.font("Helvetica").fontSize(9.5);
  planets.forEach((planet) => {
    x = doc.page.margins.left;
    columns.forEach((col) => {
      const raw = planet[col.key];
      const value = typeof raw === "boolean" ? (raw ? "Yes" : "No") : raw !== undefined && raw !== null ? String(raw) : "—";
      doc.text(value, x, y, { width: col.width });
      x += col.width;
    });
    y += 16;
  });

  doc.y = y + 10;
  return true;
};

/** Generic fallback: pretty-prints whatever the API returned so nothing is ever silently lost. */
const renderGenericJson = (doc, data) => {
  doc.font("Courier").fontSize(8).fillColor("#333").text(JSON.stringify(data, null, 2), {
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
  });
  doc.fillColor("#000").font("Helvetica");
};

/**
 * Builds a Premium Kundli PDF from the order's birth details + whatever
 * AstrologyAPI returned. Always produces a usable PDF — falls back to a
 * generic data dump if the response shape doesn't match the specific
 * `/planets` layout this was written against, since the exact contract
 * depends on which AstrologyAPI report product is configured.
 */
const generateKundliPdf = async (order, { reportTitle = "Premium Kundli Report" } = {}) => {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const bufferPromise = collectPdfBuffer(doc);

  doc.fontSize(20).font("Helvetica-Bold").fillColor("#7A1F2B").text(reportTitle, { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(10).font("Helvetica").fillColor("#666").text(COMPANY_NAME, { align: "center" });
  doc.fillColor("#000");
  doc.moveDown(1.5);

  doc.fontSize(13).font("Helvetica-Bold").text("Birth Details");
  doc.moveDown(0.4);
  doc.fontSize(10.5).font("Helvetica");
  [
    ["Name", order.fullName],
    ["Gender", order.gender],
    ["Date of Birth", formatDob(order.dob)],
    ["Time of Birth", order.birthTime],
    ["Place of Birth", order.birthPlace],
    ["Order Number", order.orderNumber],
  ].forEach(([label, value]) => {
    doc.font("Helvetica-Bold").text(`${label}: `, { continued: true }).font("Helvetica").text(String(value ?? "—"));
  });

  doc.moveDown(1.2);
  doc.fontSize(13).font("Helvetica-Bold").text("Planetary Positions");
  doc.moveDown(0.5);

  const apiResponse = order.apiResponse;
  const planetsArray = Array.isArray(apiResponse) ? apiResponse : apiResponse?.planets;
  const rendered = renderPlanetsTable(doc, planetsArray);
  if (!rendered) {
    doc.fontSize(9).font("Helvetica").fillColor("#666").text(
      "Raw astrological data (report layout will be refined as more report types are added):",
    );
    doc.moveDown(0.3);
    renderGenericJson(doc, apiResponse);
  }

  doc.moveDown(2);
  doc.fontSize(8).fillColor("#999").text(
    "This report is generated for guidance and entertainment purposes based on the birth details provided.",
    { align: "center" },
  );

  return bufferPromise;
};

module.exports = { generateKundliPdf };
