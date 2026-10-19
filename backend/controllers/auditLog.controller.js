const asyncHandler = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/ApiResponse');
const AuditLog = require('../models/AuditLog');
const { PERMISSIONS } = require('../middlewares/permission.middleware');

// @desc    List audit log entries, filterable by admin user / route / method, paginated
// @route   GET /api/v1/admin/audit-logs?userId=&route=&method=&page=&limit=
// @access  Private/Admin
const getAuditLogs = asyncHandler(async (req, res) => {
  const { userId, route, method, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (userId) filter.user = userId;
  if (route) filter.route = { $regex: route, $options: 'i' };
  if (method) filter.method = method.toUpperCase();

  const skip = (Number(page) - 1) * Number(limit);
  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort('-createdAt').skip(skip).limit(Number(limit)),
    AuditLog.countDocuments(filter),
  ]);

  sendResponse(res, 200, { logs, total, page: Number(page), totalPages: Math.ceil(total / limit) }, 'Audit logs fetched successfully');
});

// @desc    The full list of grantable permissions, for building an admin-user-edit UI
// @route   GET /api/v1/admin/permissions
// @access  Private/Admin
const getPermissionCatalog = asyncHandler(async (req, res) => {
  sendResponse(res, 200, { permissions: PERMISSIONS }, 'Permission catalog fetched successfully');
});

module.exports = { getAuditLogs, getPermissionCatalog };
