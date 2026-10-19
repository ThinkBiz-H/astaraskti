const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const Brand = require('../models/Brand');
const { uploadToCloudinary, deleteFromCloudinary } = require('../services/cloudinary.service');

const createBrand = asyncHandler(async (req, res) => {
  const { name, status } = req.body;

  let logo;
  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, 'ecommerce/brands');
    logo = { url: result.url, publicId: result.publicId };
  }

  const brand = await Brand.create({ name, status, logo });
  sendResponse(res, 201, { brand }, 'Brand created successfully');
});

const updateBrand = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) throw new ApiError(404, 'Brand not found');

  if (req.file) {
    if (brand.logo && brand.logo.publicId) await deleteFromCloudinary(brand.logo.publicId);
    const result = await uploadToCloudinary(req.file.buffer, 'ecommerce/brands');
    brand.logo = { url: result.url, publicId: result.publicId };
  }

  ['name', 'status'].forEach((field) => {
    if (req.body[field] !== undefined) brand[field] = req.body[field];
  });

  await brand.save();
  sendResponse(res, 200, { brand }, 'Brand updated successfully');
});

const deleteBrand = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) throw new ApiError(404, 'Brand not found');

  if (brand.logo && brand.logo.publicId) await deleteFromCloudinary(brand.logo.publicId);

  await brand.deleteOne();
  sendResponse(res, 200, {}, 'Brand deleted successfully');
});

const getBrands = asyncHandler(async (req, res) => {
  const brands = await Brand.find(req.query.status ? { status: req.query.status } : {}).sort('-createdAt');
  sendResponse(res, 200, { brands, count: brands.length }, 'Brands fetched successfully');
});

const getBrandBySlug = asyncHandler(async (req, res) => {
  const brand = await Brand.findOne({ slug: req.params.slug });
  if (!brand) throw new ApiError(404, 'Brand not found');
  sendResponse(res, 200, { brand }, 'Brand fetched successfully');
});

module.exports = { createBrand, updateBrand, deleteBrand, getBrands, getBrandBySlug };
