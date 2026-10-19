const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const Faq = require('../models/Faq');
const { invalidate } = require('../services/cache.service');

// @desc    Get active FAQs, optionally by category (public)
// @route   GET /api/v1/faqs
// @access  Public
const getActiveFaqs = asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.category) filter.category = req.query.category;

  const faqs = await Faq.find(filter).sort({ category: 1, sortOrder: 1 });
  sendResponse(res, 200, { faqs, count: faqs.length }, 'FAQs fetched successfully');
});

// @desc    List all FAQs (admin)
// @route   GET /api/v1/admin/faqs
// @access  Private/Admin
const getAllFaqs = asyncHandler(async (req, res) => {
  const faqs = await Faq.find().sort({ category: 1, sortOrder: 1 });
  sendResponse(res, 200, { faqs, count: faqs.length }, 'FAQs fetched successfully');
});

// @desc    Create an FAQ
// @route   POST /api/v1/admin/faqs
// @access  Private/Admin
const createFaq = asyncHandler(async (req, res) => {
  const { question, answer, category, sortOrder, isActive } = req.body;
  const faq = await Faq.create({ question, answer, category, sortOrder, isActive });
  await invalidate('faqs:*');
  sendResponse(res, 201, { faq }, 'FAQ created successfully');
});

// @desc    Update an FAQ
// @route   PUT /api/v1/admin/faqs/:id
// @access  Private/Admin
const updateFaq = asyncHandler(async (req, res) => {
  const faq = await Faq.findById(req.params.id);
  if (!faq) throw new ApiError(404, 'FAQ not found');

  ['question', 'answer', 'category', 'sortOrder', 'isActive'].forEach((field) => {
    if (req.body[field] !== undefined) faq[field] = req.body[field];
  });

  await faq.save();
  await invalidate('faqs:*');
  sendResponse(res, 200, { faq }, 'FAQ updated successfully');
});

// @desc    Reorder FAQs — { order: [id1, id2, ...] }
// @route   PATCH /api/v1/admin/faqs/reorder
// @access  Private/Admin
const reorderFaqs = asyncHandler(async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order) || order.length === 0) {
    throw new ApiError(400, 'order must be a non-empty array of FAQ ids');
  }
  await Promise.all(order.map((id, index) => Faq.findByIdAndUpdate(id, { sortOrder: index })));
  const faqs = await Faq.find().sort({ category: 1, sortOrder: 1 });
  await invalidate('faqs:*');
  sendResponse(res, 200, { faqs }, 'FAQs reordered successfully');
});

// @desc    Delete an FAQ
// @route   DELETE /api/v1/admin/faqs/:id
// @access  Private/Admin
const deleteFaq = asyncHandler(async (req, res) => {
  const faq = await Faq.findById(req.params.id);
  if (!faq) throw new ApiError(404, 'FAQ not found');
  await faq.deleteOne();
  await invalidate('faqs:*');
  sendResponse(res, 200, {}, 'FAQ deleted successfully');
});

module.exports = { getActiveFaqs, getAllFaqs, createFaq, updateFaq, reorderFaqs, deleteFaq };
