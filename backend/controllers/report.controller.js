const asyncHandler = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/ApiResponse');
const { toCSV, sendCSV } = require('../utils/csv');
const { toExcelBuffer, sendExcel } = require('../utils/excel');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Variant = require('../models/Variant');
const WarehouseStock = require('../models/WarehouseStock');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const Settings = require('../models/Settings');
const PaymentTransaction = require('../models/PaymentTransaction');

/**
 * Shared export step for every report below — branches on ?format=csv
 * (default, unchanged from before this phase) or ?format=excel. Adding
 * this wrapper is the only change to the pre-existing report functions;
 * their row-building logic (what actually goes in the report) is untouched.
 */
const exportReport = async (req, res, filenamePrefix, headers, rows, sheetName) => {
  if (req.query.format === 'excel') {
    const buffer = await toExcelBuffer(headers, rows, sheetName);
    return sendExcel(res, `${filenamePrefix}-${Date.now()}.xlsx`, buffer);
  }
  const csv = toCSV(headers, rows);
  return sendCSV(res, `${filenamePrefix}-${Date.now()}.csv`, csv);
};

// Shared date-range parser: ?from=YYYY-MM-DD&to=YYYY-MM-DD, defaults to
// "all time" if not provided.
const buildDateFilter = (req) => {
  const filter = {};
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }
  return filter;
};

// @desc    Export a sales report (one row per order item) as CSV
// @route   GET /api/v1/admin/reports/sales?from=&to=
// @access  Private/Admin
const getSalesReportCSV = asyncHandler(async (req, res) => {
  const filter = { paymentStatus: 'Paid', ...buildDateFilter(req) };
  const orders = await Order.find(filter).select('orderNumber items createdAt').lean();

  const rows = [];
  orders.forEach((order) => {
    order.items.forEach((item) => {
      rows.push({
        orderNumber: order.orderNumber,
        date: order.createdAt.toISOString().slice(0, 10),
        productTitle: item.title,
        quantity: item.quantity,
        price: item.price,
        lineTotal: (item.price * item.quantity).toFixed(2),
      });
    });
  });

  await exportReport(req, res, 'sales-report', ['orderNumber', 'date', 'productTitle', 'quantity', 'price', 'lineTotal'], rows, 'Sales');
});

// @desc    Export a revenue report (one row per day) as CSV
// @route   GET /api/v1/admin/reports/revenue?from=&to=
// @access  Private/Admin
const getRevenueReportCSV = asyncHandler(async (req, res) => {
  const filter = { paymentStatus: 'Paid', ...buildDateFilter(req) };

  const daily = await Order.aggregate([
    { $match: filter },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$grandTotal' },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const rows = daily.map((d) => ({ date: d._id, revenue: d.revenue.toFixed(2), orderCount: d.orderCount }));
  await exportReport(req, res, 'revenue-report', ['date', 'revenue', 'orderCount'], rows, 'Revenue');
});

// @desc    Export an order report (one row per order) as CSV
// @route   GET /api/v1/admin/reports/orders?from=&to=&status=
// @access  Private/Admin
const getOrdersReportCSV = asyncHandler(async (req, res) => {
  const filter = buildDateFilter(req);
  if (req.query.status) filter.orderStatus = req.query.status;

  const orders = await Order.find(filter)
    .populate('user', 'name email')
    .select('orderNumber user orderStatus paymentStatus paymentMethod grandTotal createdAt')
    .lean();

  const rows = orders.map((o) => ({
    orderNumber: o.orderNumber,
    customerName: o.user?.name || 'Deleted user',
    customerEmail: o.user?.email || '',
    orderStatus: o.orderStatus,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    grandTotal: o.grandTotal,
    date: o.createdAt.toISOString().slice(0, 10),
  }));

  await exportReport(
    req,
    res,
    'orders-report',
    ['orderNumber', 'customerName', 'customerEmail', 'orderStatus', 'paymentStatus', 'paymentMethod', 'grandTotal', 'date'],
    rows,
    'Orders'
  );
});

// @desc    Export a customer report (one row per customer, lifetime stats) as CSV
// @route   GET /api/v1/admin/reports/customers
// @access  Private/Admin
const getCustomersReportCSV = asyncHandler(async (req, res) => {
  const stats = await Order.aggregate([
    { $match: { paymentStatus: 'Paid' } },
    {
      $group: {
        _id: '$user',
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: '$grandTotal' },
        lastOrderAt: { $max: '$createdAt' },
      },
    },
  ]);
  const statsByUser = new Map(stats.map((s) => [s._id.toString(), s]));

  const users = await User.find({ role: 'user' }).select('name email createdAt').lean();

  const rows = users.map((u) => {
    const s = statsByUser.get(u._id.toString());
    return {
      name: u.name,
      email: u.email,
      joinedAt: u.createdAt.toISOString().slice(0, 10),
      totalOrders: s?.totalOrders || 0,
      totalSpent: (s?.totalSpent || 0).toFixed(2),
      lastOrderAt: s?.lastOrderAt ? s.lastOrderAt.toISOString().slice(0, 10) : '',
    };
  });

  await exportReport(req, res, 'customers-report', ['name', 'email', 'joinedAt', 'totalOrders', 'totalSpent', 'lastOrderAt'], rows, 'Customers');
});

// @desc    Export a product report (inventory + performance) as CSV
// @route   GET /api/v1/admin/reports/products
// @access  Private/Admin
const getProductsReportCSV = asyncHandler(async (req, res) => {
  const products = await Product.find({ isDeleted: false })
    .populate('category', 'name')
    .populate('brand', 'name')
    .select('title SKU category brand price salePrice stock salesCount viewCount rating numReviews status')
    .lean();

  const rows = products.map((p) => ({
    title: p.title,
    SKU: p.SKU || '',
    category: p.category?.name || '',
    brand: p.brand?.name || '',
    price: p.price,
    salePrice: p.salePrice || '',
    stock: p.stock,
    unitsSold: p.salesCount,
    views: p.viewCount,
    rating: p.rating,
    numReviews: p.numReviews,
    status: p.status,
  }));

  await exportReport(
    req,
    res,
    'products-report',
    ['title', 'SKU', 'category', 'brand', 'price', 'salePrice', 'stock', 'unitsSold', 'views', 'rating', 'numReviews', 'status'],
    rows,
    'Products'
  );
});

// @desc    Export an inventory report (stock levels across all warehouses,
//          one row per product-or-variant per warehouse) as CSV/Excel
// @route   GET /api/v1/admin/reports/inventory?format=csv|excel&warehouseId=
// @access  Private/Admin
const getInventoryReportCSV = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.warehouseId) filter.warehouse = req.query.warehouseId;

  const records = await WarehouseStock.find(filter)
    .populate('product', 'title SKU')
    .populate('variant', 'sku')
    .populate('warehouse', 'name code')
    .lean();

  const rows = records
    .filter((r) => r.product)
    .map((r) => ({
      product: r.product?.title || '',
      sku: r.variant?.sku || r.product?.SKU || '',
      warehouse: r.warehouse?.name || '',
      available: r.available,
      reserved: r.reserved,
      damaged: r.damaged,
      incoming: r.incoming,
      lowStockThreshold: r.lowStockThreshold,
      status: r.available <= 0 ? 'Out of stock' : r.available <= r.lowStockThreshold ? 'Low stock' : 'OK',
    }));

  await exportReport(
    req,
    res,
    'inventory-report',
    ['product', 'sku', 'warehouse', 'available', 'reserved', 'damaged', 'incoming', 'lowStockThreshold', 'status'],
    rows,
    'Inventory'
  );
});

// @desc    Export a coupon usage report (one row per coupon, redemption + discount totals from real orders) as CSV/Excel
// @route   GET /api/v1/admin/reports/coupons?format=csv|excel
// @access  Private/Admin
const getCouponReportCSV = asyncHandler(async (req, res) => {
  const [coupons, usage] = await Promise.all([
    Coupon.find().lean(),
    Order.aggregate([
      { $match: { 'coupon.code': { $ne: null }, paymentStatus: 'Paid' } },
      { $group: { _id: '$coupon.code', orders: { $sum: 1 }, totalDiscount: { $sum: '$coupon.discountAmount' } } },
    ]),
  ]);
  const usageByCode = new Map(usage.map((u) => [u._id, u]));

  const rows = coupons.map((c) => {
    const u = usageByCode.get(c.code);
    return {
      code: c.code,
      type: c.type,
      discount: c.discount,
      usageLimit: c.usageLimit,
      usedCount: c.usedCount,
      ordersUsedOn: u?.orders || 0,
      totalDiscountGiven: (u?.totalDiscount || 0).toFixed(2),
      isActive: c.isActive,
      expiry: c.expiry.toISOString().slice(0, 10),
    };
  });

  await exportReport(
    req,
    res,
    'coupon-report',
    ['code', 'type', 'discount', 'usageLimit', 'usedCount', 'ordersUsedOn', 'totalDiscountGiven', 'isActive', 'expiry'],
    rows,
    'Coupons'
  );
});

// @desc    Export a tax report (tax collected per order, using Settings.tax as the reference rate) as CSV/Excel
// @route   GET /api/v1/admin/reports/tax?from=&to=&format=csv|excel
// @access  Private/Admin
const getTaxReportCSV = asyncHandler(async (req, res) => {
  const filter = { paymentStatus: 'Paid', ...buildDateFilter(req) };
  const [orders, settings] = await Promise.all([
    Order.find(filter).select('orderNumber subTotal tax grandTotal createdAt').lean(),
    Settings.findOne().select('tax'),
  ]);

  const rows = orders.map((o) => ({
    orderNumber: o.orderNumber,
    date: o.createdAt.toISOString().slice(0, 10),
    subTotal: o.subTotal.toFixed(2),
    taxCollected: (o.tax || 0).toFixed(2),
    grandTotal: o.grandTotal.toFixed(2),
  }));

  const totalTax = rows.reduce((sum, r) => sum + Number(r.taxCollected), 0);
  rows.push({ orderNumber: 'TOTAL', date: '', subTotal: '', taxCollected: totalTax.toFixed(2), grandTotal: '' });
  if (settings?.tax) {
    rows.push({ orderNumber: `Reference rate: ${settings.tax.defaultTaxPercent}% (${settings.tax.pricesIncludeTax ? 'tax-inclusive' : 'tax-exclusive'} pricing)`, date: '', subTotal: '', taxCollected: '', grandTotal: '' });
  }

  await exportReport(req, res, 'tax-report', ['orderNumber', 'date', 'subTotal', 'taxCollected', 'grandTotal'], rows, 'Tax');
});

// @desc    Export a profit report — revenue minus each item's product cost,
//          IF cost price is tracked; otherwise reports revenue only and
//          says so explicitly rather than fabricating a margin number.
// @route   GET /api/v1/admin/reports/profit?from=&to=&format=csv|excel
// @access  Private/Admin
const getProfitReportCSV = asyncHandler(async (req, res) => {
  const filter = { paymentStatus: 'Paid', ...buildDateFilter(req) };
  const orders = await Order.find(filter).select('orderNumber items createdAt').lean();

  // The Product schema (see models/Product.js) does not track a cost/COGS
  // field — only `price`/`salePrice` (what the customer pays). Without a
  // real cost basis, "profit" cannot be honestly computed; this report is
  // revenue-only and says so in every row rather than inventing a margin.
  const rows = [];
  orders.forEach((order) => {
    order.items.forEach((item) => {
      rows.push({
        orderNumber: order.orderNumber,
        date: order.createdAt.toISOString().slice(0, 10),
        productTitle: item.title,
        quantity: item.quantity,
        revenue: (item.price * item.quantity).toFixed(2),
        note: 'No cost-price field exists on Product — add one to enable true profit/margin reporting',
      });
    });
  });

  await exportReport(req, res, 'profit-report', ['orderNumber', 'date', 'productTitle', 'quantity', 'revenue', 'note'], rows, 'Profit (revenue-only)');
});

// @desc    Export a refund report (one row per refund transaction) as CSV/Excel
// @route   GET /api/v1/admin/reports/refunds?from=&to=&format=csv|excel
// @access  Private/Admin
const getRefundReportCSV = asyncHandler(async (req, res) => {
  const filter = { type: 'refund', ...buildDateFilter(req) };
  const transactions = await PaymentTransaction.find(filter)
    .populate('order', 'orderNumber')
    .populate('user', 'name email')
    .sort('-createdAt')
    .lean();

  const rows = transactions.map((t) => ({
    orderNumber: t.order?.orderNumber || '',
    customerName: t.user?.name || '',
    customerEmail: t.user?.email || '',
    amount: t.amount.toFixed(2),
    status: t.status,
    razorpayRefundId: t.razorpayRefundId || '',
    date: t.createdAt.toISOString().slice(0, 10),
  }));

  await exportReport(
    req,
    res,
    'refund-report',
    ['orderNumber', 'customerName', 'customerEmail', 'amount', 'status', 'razorpayRefundId', 'date'],
    rows,
    'Refunds',
  );
});

// @desc    Export a return report (one row per order with a return request) as CSV/Excel
// @route   GET /api/v1/admin/reports/returns?from=&to=&format=csv|excel
// @access  Private/Admin
const getReturnReportCSV = asyncHandler(async (req, res) => {
  const filter = { returnRequest: { $ne: null } };
  const dateFilter = buildDateFilter(req);
  if (dateFilter.createdAt) filter['returnRequest.requestedAt'] = dateFilter.createdAt;
  const orders = await Order.find(filter)
    .populate('user', 'name email')
    .select('orderNumber user returnRequest createdAt')
    .lean();

  const rows = orders.map((o) => ({
    orderNumber: o.orderNumber,
    customerName: o.user?.name || '',
    customerEmail: o.user?.email || '',
    reason: o.returnRequest?.reason || '',
    status: o.returnRequest?.status || '',
    refundStatus: o.returnRequest?.refund?.status || 'Not Applicable',
    refundAmount: (o.returnRequest?.refund?.amount || 0).toFixed(2),
    requestedAt: o.returnRequest?.requestedAt ? new Date(o.returnRequest.requestedAt).toISOString().slice(0, 10) : '',
  }));

  await exportReport(
    req,
    res,
    'return-report',
    ['orderNumber', 'customerName', 'customerEmail', 'reason', 'status', 'refundStatus', 'refundAmount', 'requestedAt'],
    rows,
    'Returns',
  );
});

// @desc    Export a consultation bookings report (one row per booking) as CSV/Excel
// @route   GET /api/v1/admin/reports/consultations?from=&to=&format=csv|excel
// @access  Private/Admin
const getConsultationReportCSV = asyncHandler(async (req, res) => {
  const ConsultationBooking = require('../models/ConsultationBooking');
  const filter = buildDateFilter(req);
  const bookings = await ConsultationBooking.find(filter)
    .populate('user', 'name email')
    .populate('assignedAstrologer', 'name')
    .select('bookingNumber serviceSnapshot bookingStatus paymentStatus amount appointmentDate createdAt user assignedAstrologer')
    .lean();

  const rows = bookings.map((b) => ({
    bookingNumber: b.bookingNumber,
    customerName: b.user?.name || '',
    customerEmail: b.user?.email || '',
    service: b.serviceSnapshot?.name || '',
    astrologer: b.assignedAstrologer?.name || 'Unassigned',
    appointmentDate: b.appointmentDate ? new Date(b.appointmentDate).toISOString().slice(0, 10) : '',
    bookingStatus: b.bookingStatus,
    paymentStatus: b.paymentStatus,
    amount: b.amount,
    createdAt: b.createdAt.toISOString().slice(0, 10),
  }));

  await exportReport(
    req,
    res,
    'consultation-report',
    ['bookingNumber', 'customerName', 'customerEmail', 'service', 'astrologer', 'appointmentDate', 'bookingStatus', 'paymentStatus', 'amount', 'createdAt'],
    rows,
    'Consultations',
  );
});

// @desc    Consultation analytics summary (revenue, completion rate, top
//          services/astrologers) for the admin Reports page widgets —
//          JSON, not a CSV row-export, same split as the coupon overview
//          endpoint uses elsewhere in this app.
// @route   GET /api/v1/admin/reports/consultations/analytics?from=&to=
// @access  Private/Admin
const getConsultationAnalytics = asyncHandler(async (req, res) => {
  const ConsultationBooking = require('../models/ConsultationBooking');
  const filter = buildDateFilter(req);

  const [totals, byStatus, topServices, topAstrologers] = await Promise.all([
    ConsultationBooking.aggregate([
      { $match: { ...filter, paymentStatus: 'Paid' } },
      { $group: { _id: null, revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    ConsultationBooking.aggregate([
      { $match: filter },
      { $group: { _id: '$bookingStatus', count: { $sum: 1 } } },
    ]),
    ConsultationBooking.aggregate([
      { $match: filter },
      { $group: { _id: '$serviceSnapshot.name', bookings: { $sum: 1 }, revenue: { $sum: '$amount' } } },
      { $sort: { bookings: -1 } },
      { $limit: 5 },
    ]),
    ConsultationBooking.aggregate([
      { $match: { ...filter, assignedAstrologer: { $ne: null } } },
      { $group: { _id: '$assignedAstrologer', bookings: { $sum: 1 } } },
      { $sort: { bookings: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'astrologers', localField: '_id', foreignField: '_id', as: 'astrologer' } },
      { $unwind: '$astrologer' },
      { $project: { _id: 0, astrologerId: '$_id', name: '$astrologer.name', bookings: 1 } },
    ]),
  ]);

  const totalBookings = byStatus.reduce((sum, s) => sum + s.count, 0);
  const completed = byStatus.find((s) => s._id === 'Completed')?.count || 0;

  sendResponse(
    res,
    200,
    {
      revenue: totals[0]?.revenue || 0,
      paidBookings: totals[0]?.count || 0,
      totalBookings,
      completionRate: totalBookings > 0 ? Math.round((completed / totalBookings) * 1000) / 10 : 0,
      byStatus,
      topServices: topServices.map((s) => ({ name: s._id, bookings: s.bookings, revenue: s.revenue })),
      topAstrologers,
    },
    'Consultation analytics fetched successfully',
  );
});

module.exports = {
  getSalesReportCSV,
  getRevenueReportCSV,
  getOrdersReportCSV,
  getCustomersReportCSV,
  getProductsReportCSV,
  getInventoryReportCSV,
  getCouponReportCSV,
  getTaxReportCSV,
  getProfitReportCSV,
  getRefundReportCSV,
  getReturnReportCSV,
  getConsultationReportCSV,
  getConsultationAnalytics,
};
