const PDFDocument = require("pdfkit");

const money = (n) => `Rs. ${Number(n || 0).toFixed(2)}`;

const COMPANY = {
  name: process.env.COMPANY_NAME || "My Shop Pvt. Ltd.",
  address: process.env.COMPANY_ADDRESS || "",
  gstin: process.env.COMPANY_GSTIN || "",
  phone: process.env.COMPANY_PHONE || "",
  email: process.env.COMPANY_EMAIL || "",
};

/**
 * Streams a professional PDF invoice for the given order directly to the
 * provided writable stream (typically the HTTP response).
 * `order` should be populated with `user` (name, email) if available.
 */
const streamInvoicePDF = (order, res) => {
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=invoice-${order.invoiceNumber}.pdf`,
  );

  doc.pipe(res);

  // ---------- Header ----------
  doc.fontSize(18).font("Helvetica-Bold").text(COMPANY.name, { continued: false });
  doc.fontSize(9).font("Helvetica").fillColor("#555");
  if (COMPANY.address) doc.text(COMPANY.address);
  const contactLine = [COMPANY.phone, COMPANY.email].filter(Boolean).join("  |  ");
  if (contactLine) doc.text(contactLine);
  if (COMPANY.gstin) doc.text(`GSTIN: ${COMPANY.gstin}`);
  doc.fillColor("#000");

  doc.moveDown(1);
  doc.fontSize(16).font("Helvetica-Bold").text("TAX INVOICE", { align: "right" });
  doc.moveDown(0.3);
  doc.fontSize(10).font("Helvetica");
  doc.text(`Invoice #: ${order.invoiceNumber}`, { align: "right" });
  doc.text(`Order #: ${order.orderNumber}`, { align: "right" });
  doc.text(`Invoice Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`, {
    align: "right",
  });

  doc.moveDown(1);
  doc
    .moveTo(40, doc.y)
    .lineTo(555, doc.y)
    .strokeColor("#ddd")
    .stroke();
  doc.moveDown(0.8);

  // ---------- Billing / Shipping ----------
  const addr = order.shippingAddress || {};
  const billStartY = doc.y;

  doc.fontSize(10).font("Helvetica-Bold").text("Billed To:", 40, billStartY);
  doc.font("Helvetica").fontSize(9.5);
  doc.text(addr.fullName || order.user?.name || "Customer", 40);
  if (order.user?.email || addr.email) doc.text(order.user?.email || addr.email, 40);
  if (addr.mobile) doc.text(addr.mobile, 40);

  doc.fontSize(10).font("Helvetica-Bold").text("Ship To:", 320, billStartY);
  doc.font("Helvetica").fontSize(9.5);
  const shipLines = [
    addr.addressLine1,
    addr.addressLine2,
    [addr.city, addr.state, addr.pincode].filter(Boolean).join(", "),
    addr.country,
  ].filter(Boolean);
  shipLines.forEach((line) => doc.text(line, 320));

  doc.moveDown(2);

  // ---------- Items table ----------
  const tableTop = doc.y + 5;
  const cols = {
    item: 40,
    qty: 330,
    price: 390,
    tax: 460,
    total: 500,
  };

  doc.font("Helvetica-Bold").fontSize(9.5);
  doc.text("Item", cols.item, tableTop);
  doc.text("Qty", cols.qty, tableTop);
  doc.text("Price", cols.price, tableTop);
  doc.text("Total", cols.total, tableTop, { width: 55, align: "right" });
  doc
    .moveTo(40, tableTop + 15)
    .lineTo(555, tableTop + 15)
    .strokeColor("#ddd")
    .stroke();

  let y = tableTop + 22;
  doc.font("Helvetica").fontSize(9.5);

  order.items.forEach((item) => {
    const lineTotal = item.price * item.quantity;
    if (y > 700) {
      doc.addPage();
      y = 40;
    }
    doc.text(item.title, cols.item, y, { width: 280 });
    doc.text(String(item.quantity), cols.qty, y);
    doc.text(money(item.price), cols.price, y);
    doc.text(money(lineTotal), cols.total, y, { width: 55, align: "right" });
    y += 20;
  });

  doc
    .moveTo(40, y + 5)
    .lineTo(555, y + 5)
    .strokeColor("#ddd")
    .stroke();
  y += 15;

  // ---------- Totals ----------
  const totalsX = 390;
  const printTotalRow = (label, value, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
    doc.text(label, totalsX, y, { width: 90 });
    doc.text(value, totalsX + 90, y, { width: 65, align: "right" });
    y += 16;
  };

  printTotalRow("Subtotal", money(order.subTotal));
  if (order.coupon?.discountAmount) {
    printTotalRow(`Discount (${order.coupon.code || "Coupon"})`, `- ${money(order.coupon.discountAmount)}`);
  }
  printTotalRow("Shipping", money(order.shippingCharge));
  printTotalRow("Tax (GST)", money(order.tax));
  y += 4;
  doc
    .moveTo(totalsX, y)
    .lineTo(555, y)
    .strokeColor("#000")
    .stroke();
  y += 8;
  printTotalRow("Grand Total", money(order.grandTotal), true);

  doc.moveDown(3);
  doc.fontSize(9).fillColor("#777").text(
    `Payment Method: ${order.paymentMethod === "cod" ? "Cash on Delivery" : "Online (Razorpay)"}   |   Payment Status: ${order.paymentStatus}`,
    40,
  );
  doc.moveDown(1);
  doc.fontSize(8.5).fillColor("#999").text(
    "This is a computer-generated invoice and does not require a physical signature.",
    40,
  );

  doc.end();
};

module.exports = { streamInvoicePDF };
