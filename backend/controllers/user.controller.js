const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendResponse } = require("../utils/ApiResponse");
const User = require("../models/User");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../services/cloudinary.service");
// @desc    Get logged-in user's profile
// @route   GET /api/v1/users/profile
// @access  Private
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "-password -refreshToken",
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  sendResponse(res, 200, { user }, "Profile fetched successfully");
});
// @desc    Update logged-in user's profile
// @route   PUT /api/v1/users/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = [
    "name",
    "mobile",
    "city",
    "state",
    "country",
    "pincode",
  ];
  const updates = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  sendResponse(res, 200, { user }, "Profile updated successfully");
});

// @desc    Upload/update profile image
// @route   POST /api/v1/users/profile/image
// @access  Private
const uploadProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "Please upload an image file");

  const user = await User.findById(req.user._id);

  if (user.profileImage && user.profileImage.publicId) {
    await deleteFromCloudinary(user.profileImage.publicId);
  }

  const result = await uploadToCloudinary(
    req.file.buffer,
    "ecommerce/profiles",
  );
  user.profileImage = { url: result.url, publicId: result.publicId };
  await user.save({ validateBeforeSave: false });

  sendResponse(
    res,
    200,
    { profileImage: user.profileImage },
    "Profile image updated successfully",
  );
});

// @desc    Delete own account
// @route   DELETE /api/v1/users/account
// @access  Private
const deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, "User not found");

  if (user.profileImage && user.profileImage.publicId) {
    await deleteFromCloudinary(user.profileImage.publicId);
  }

  await User.findByIdAndDelete(req.user._id);
  res.clearCookie("refreshToken");

  sendResponse(res, 200, {}, "Account deleted successfully");
});

// @desc    Add a new address
// @route   POST /api/v1/users/address
// @access  Private
const addAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (req.body.isDefault) {
    user.address.forEach((addr) => (addr.isDefault = false));
  }

  user.address.push(req.body);
  await user.save({ validateBeforeSave: false });

  sendResponse(
    res,
    201,
    { address: user.address },
    "Address added successfully",
  );
});

// @desc    Update an address
// @route   PUT /api/v1/users/address/:addressId
// @access  Private
const updateAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user.address.id(req.params.addressId);

  if (!address) throw new ApiError(404, "Address not found");

  if (req.body.isDefault) {
    user.address.forEach((addr) => (addr.isDefault = false));
  }

  Object.assign(address, req.body);
  await user.save({ validateBeforeSave: false });

  sendResponse(
    res,
    200,
    { address: user.address },
    "Address updated successfully",
  );
});

// @desc    Delete an address
// @route   DELETE /api/v1/users/address/:addressId
// @access  Private
const deleteAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user.address.id(req.params.addressId);

  if (!address) throw new ApiError(404, "Address not found");

  address.deleteOne();
  await user.save({ validateBeforeSave: false });

  sendResponse(
    res,
    200,
    { address: user.address },
    "Address deleted successfully",
  );
});

// @desc    Get all addresses
// @route   GET /api/v1/users/address
// @access  Private
const getAddresses = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  sendResponse(
    res,
    200,
    { addresses: user.address },
    "Addresses fetched successfully",
  );
});

module.exports = {
  getProfile,
  updateProfile,
  uploadProfileImage,
  deleteAccount,
  addAddress,
  updateAddress,
  deleteAddress,
  getAddresses,
};
