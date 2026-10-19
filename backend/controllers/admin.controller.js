const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const User = require('../models/User');
const ApiFeatures = require('../utils/ApiFeatures');
const { PERMISSIONS } = require('../middlewares/permission.middleware');

// @desc    Get all users (admin)
// @route   GET /api/v1/admin/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  const baseQuery = User.find({ role: 'user' });
  const features = new ApiFeatures(baseQuery, req.query).search(['name', 'email']).filter().sort().limitFields();

  const total = await User.countDocuments({ role: 'user' });
  features.paginate();

  const users = await features.query;

  sendResponse(
    res,
    200,
    { users, pagination: { total, page: features.pagination.page, limit: features.pagination.limit } },
    'Users fetched successfully'
  );
});

// @desc    Get single user by id
// @route   GET /api/v1/admin/users/:id
// @access  Private/Admin
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  sendResponse(res, 200, { user }, 'User fetched successfully');
});

// @desc    Activate/Deactivate a user account
// @route   PATCH /api/v1/admin/users/:id/status
// @access  Private/Admin
const updateUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
  if (!user) throw new ApiError(404, 'User not found');
  sendResponse(res, 200, { user }, `User ${isActive ? 'activated' : 'deactivated'} successfully`);
});

// @desc    Set an admin's granular permissions — [] or omitted means
//          unrestricted (full admin access, the default for every admin
//          created before this feature existed)
// @route   PATCH /api/v1/admin/users/:id/permissions
// @access  Private/Admin
const updateUserPermissions = asyncHandler(async (req, res) => {
  const { permissions } = req.body;
  if (!Array.isArray(permissions)) throw new ApiError(400, 'permissions must be an array');

  const invalid = permissions.filter((p) => !PERMISSIONS.includes(p));
  if (invalid.length > 0) throw new ApiError(400, `Unknown permission(s): ${invalid.join(', ')}`);

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  if (user.role !== 'admin') throw new ApiError(400, 'Permissions only apply to admin accounts');

  user.permissions = permissions;
  await user.save();
  sendResponse(res, 200, { user }, 'Permissions updated successfully');
});

// @desc    Delete a user (admin)
// @route   DELETE /api/v1/admin/users/:id
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  sendResponse(res, 200, {}, 'User deleted successfully');
});

module.exports = { getUsers, getUserById, updateUserStatus, updateUserPermissions, deleteUser };
