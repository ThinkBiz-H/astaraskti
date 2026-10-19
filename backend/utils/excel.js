const ExcelJS = require('exceljs');

/**
 * @param {string[]} headers - column headers, in order
 * @param {Array<Object>} rows - each row's keys should match `headers`
 * @param {string} [sheetName]
 * @returns {Promise<Buffer>}
 */
const toExcelBuffer = async (headers, rows, sheetName = 'Report') => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(h.length + 2, 14) }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));

  return workbook.xlsx.writeBuffer();
};

const sendExcel = (res, filename, buffer) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(buffer);
};

module.exports = { toExcelBuffer, sendExcel };
