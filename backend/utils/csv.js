// utils/csv.js
/**
 * Minimal, dependency-free CSV builder. Handles the common cases well
 * enough for admin export reports: quotes any value containing a comma,
 * quote character, or newline, and escapes embedded quotes.
 */
const escapeCell = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * @param {string[]} headers - column headers, in order
 * @param {Array<Object>} rows - each row's keys should match `headers` (or use a mapper)
 * @returns {string} CSV text (with header row)
 */
const toCSV = (headers, rows) => {
  const headerLine = headers.map(escapeCell).join(',');
  const lines = rows.map((row) => headers.map((h) => escapeCell(row[h])).join(','));
  return [headerLine, ...lines].join('\n');
};

/**
 * Streams a CSV string to the client as a file download.
 */
const sendCSV = (res, filename, csvText) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csvText);
};

module.exports = { toCSV, sendCSV };
