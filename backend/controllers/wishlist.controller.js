const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendResponse } = require("../utils/ApiResponse");
const User = require("../models/User");
const Product = require("../models/Product");
const Variant = require("../models/Variant");

// @desc    Add product to wishlist
// @route   POST /api/v1/wishlist/:productId
// @access  Private
const addToWishlist = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.productId,
    isDeleted: false,
  });
  if (!product) throw new ApiError(404, "Product not found");

  const user = await User.findById(req.user._id);

  if (user.wishlist.includes(product._id)) {
    throw new ApiError(409, "Product already in wishlist");
  }

  user.wishlist.push(product._id);
  await user.save({ validateBeforeSave: false });

  sendResponse(
    res,
    200,
    { wishlist: user.wishlist },
    "Product added to wishlist",
  );
});

// @desc    Remove product from wishlist
// @route   DELETE /api/v1/wishlist/:productId
// @access  Private
const removeFromWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  user.wishlist = user.wishlist.filter(
    (id) => id.toString() !== req.params.productId,
  );
  await user.save({ validateBeforeSave: false });

  sendResponse(
    res,
    200,
    { wishlist: user.wishlist },
    "Product removed from wishlist",
  );
});

// @desc    Get wishlist
// @route   GET /api/v1/wishlist
// @access  Private
const getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: "wishlist",
    match: { isDeleted: false },
    populate: { path: "category", select: "name slug" },
  });

  sendResponse(
    res,
    200,
    { wishlist: user.wishlist },
    "Wishlist fetched successfully",
  );
});

// @desc    Move a wishlist item into the cart (removes it from the wishlist)
// @route   POST /api/v1/wishlist/:productId/move-to-cart
// @access  Private
const moveToCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { quantity = 1, color, size, variantId } = req.body;

  const product = await Product.findOne({
    _id: productId,
    isDeleted: false,
    status: "active",
  });
  if (!product) throw new ApiError(404, "Product not found or unavailable");

  if (variantId) {
    const variant = await Variant.findOne({ _id: variantId, product: productId, status: "active" });
    if (!variant) throw new ApiError(404, "Selected variant not found or unavailable");
    if (variant.stock < quantity) throw new ApiError(400, `Only ${variant.stock} units available in stock`);
  } else if (product.hasVariants) {
    throw new ApiError(400, "This product has variants — please specify variantId");
  } else if (product.stock < quantity) {
    throw new ApiError(400, `Only ${product.stock} units available in stock`);
  }

  const user = await User.findById(req.user._id);

  const inWishlist = user.wishlist.some((id) => id.toString() === productId);
  if (!inWishlist) throw new ApiError(404, "Product not found in wishlist");

  const existingItem = user.cart.find(
    (item) =>
      item.product.toString() === productId &&
      String(item.variant || "") === String(variantId || "") &&
      item.color === color &&
      item.size === size,
  );

  if (existingItem) {
    existingItem.quantity += Number(quantity);
  } else {
    user.cart.push({ product: productId, variant: variantId || null, quantity, color, size });
  }

  user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);

  await user.save({ validateBeforeSave: false });
  await user.populate("cart.product");
  await user.populate("cart.variant");

  sendResponse(
    res,
    200,
    { cart: user.cart, wishlist: user.wishlist },
    "Product moved to cart",
  );
});

module.exports = {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  moveToCart,
};
