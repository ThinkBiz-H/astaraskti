const express = require('express');
const router = express.Router();

const {
  getStats,
  getRecentOrders,
  getRecentConsultationBookings,
  getTopProducts,
  getLowStockProducts,
  getInventoryWidgets,
  getSalesChart,
  getTopCustomers,
  getCategoryAnalytics,
  getMonthlyRevenue,
} = require('../controllers/dashboard.controller');

const { getUsers, getUserById, updateUserStatus, updateUserPermissions, deleteUser } = require('../controllers/admin.controller');
const { getAuditLogs, getPermissionCatalog } = require('../controllers/auditLog.controller');

const {
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
} = require('../controllers/report.controller');

const {
  getAllPages,
  getPageById,
  createPage,
  updatePage,
  setPageStatus,
  deletePage,
} = require('../controllers/page.controller');

const {
  getAllSections,
  createSection,
  updateSection,
  reorderSections,
  deleteSection,
} = require('../controllers/homeSection.controller');

const { getAllFaqs, createFaq, updateFaq, reorderFaqs, deleteFaq } = require('../controllers/faq.controller');

const {
  getAllBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  setBlogStatus,
  deleteBlog,
  createBlogCategory,
  updateBlogCategory,
  deleteBlogCategory,
} = require('../controllers/blog.controller');
const { blogValidator, blogUpdateValidator, blogCategoryValidator } = require('../validators/blog.validator');

const {
  getAllSettings,
  updateSettings,
  updateLogo,
  updateFavicon,
  getEnvironmentStatus,
} = require('../controllers/settings.controller');
const { settingsUpdateValidator } = require('../validators/settings.validator');

const {
  createFolder,
  getFolders,
  updateFolder,
  deleteFolder,
  uploadMedia,
  getMedia,
  updateMedia,
  replaceMedia,
  deleteMedia,
} = require('../controllers/media.controller');
const { mediaUpload } = require('../middlewares/mediaUpload.middleware');
const { folderValidator } = require('../validators/media.validator');

const {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  broadcastNotification,
} = require('../controllers/notificationAdmin.controller');
const { templateValidator, broadcastValidator } = require('../validators/notificationAdmin.validator');
const {
  createCampaign,
  getCampaigns,
  cancelCampaign,
  getNotificationJobs,
  retryNotificationJob,
} = require('../controllers/notificationCampaign.controller');

const upload = require('../middlewares/upload.middleware');
const validate = require('../middlewares/validate.middleware');
const { pageValidator, pageUpdateValidator, sectionValidator, faqValidator, faqUpdateValidator } = require('../validators/cms.validator');

const { protect, authorize } = require('../middlewares/auth.middleware');
const auditLog = require('../middlewares/auditLog.middleware');
const { requirePermission } = require('../middlewares/permission.middleware');

router.use(protect, authorize('admin'));
router.use(auditLog);

// Dashboard / analytics
router.get('/dashboard/stats', getStats);
router.get('/dashboard/recent-orders', getRecentOrders);
router.get('/dashboard/recent-consultation-bookings', getRecentConsultationBookings);
router.get('/dashboard/top-products', getTopProducts);
router.get('/dashboard/low-stock', getLowStockProducts);
router.get('/dashboard/inventory-stats', getInventoryWidgets);
router.get('/dashboard/charts', getSalesChart);
router.get('/dashboard/top-customers', getTopCustomers);
router.get('/dashboard/category-analytics', getCategoryAnalytics);
router.get('/dashboard/monthly-revenue', getMonthlyRevenue);

// CSV/Excel reports (?format=csv|excel, default csv)
router.get('/reports/sales', requirePermission('view_reports'), getSalesReportCSV);
router.get('/reports/revenue', requirePermission('view_reports'), getRevenueReportCSV);
router.get('/reports/orders', requirePermission('view_reports'), getOrdersReportCSV);
router.get('/reports/customers', requirePermission('view_reports'), getCustomersReportCSV);
router.get('/reports/products', requirePermission('view_reports'), getProductsReportCSV);
router.get('/reports/inventory', requirePermission('view_reports'), getInventoryReportCSV);
router.get('/reports/coupons', requirePermission('view_reports'), getCouponReportCSV);
router.get('/reports/tax', requirePermission('view_reports'), getTaxReportCSV);
router.get('/reports/profit', requirePermission('view_reports'), getProfitReportCSV);
router.get('/reports/refunds', requirePermission('view_reports'), getRefundReportCSV);
router.get('/reports/returns', requirePermission('view_reports'), getReturnReportCSV);
router.get('/reports/consultations', requirePermission('view_reports'), getConsultationReportCSV);
router.get('/reports/consultations/analytics', requirePermission('view_reports'), getConsultationAnalytics);

// User management
router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id/status', updateUserStatus);
router.patch('/users/:id/permissions', requirePermission('manage_users'), updateUserPermissions);
router.delete('/users/:id', deleteUser);

router.get('/permissions', getPermissionCatalog);
router.get('/audit-logs', getAuditLogs);

// CMS — Pages (Phase 10)
router.get('/pages', getAllPages);
router.get('/pages/:id', getPageById);
router.post('/pages', upload.single('featuredImage'), pageValidator, validate, createPage);
router.put('/pages/:id', upload.single('featuredImage'), pageUpdateValidator, validate, updatePage);
router.patch('/pages/:id/status', setPageStatus);
router.delete('/pages/:id', deletePage);

// CMS — Home sections (Phase 10)
router.get('/home-sections', getAllSections);
const homeSectionUpload = upload.fields([{ name: 'image', maxCount: 1 }, { name: 'mobileImage', maxCount: 1 }]);
router.post('/home-sections', homeSectionUpload, sectionValidator, validate, createSection);
router.put('/home-sections/:id', homeSectionUpload, updateSection);
router.patch('/home-sections/reorder', reorderSections);
router.delete('/home-sections/:id', deleteSection);

// CMS — FAQs (Phase 10)
router.get('/faqs', getAllFaqs);
router.post('/faqs', faqValidator, validate, createFaq);
router.put('/faqs/:id', faqUpdateValidator, validate, updateFaq);
router.patch('/faqs/reorder', reorderFaqs);
router.delete('/faqs/:id', deleteFaq);

// Blog (Phase 11)
router.get('/blogs', getAllBlogs);
router.get('/blogs/:id', getBlogById);
router.post('/blogs', upload.single('featuredImage'), blogValidator, validate, createBlog);
router.put('/blogs/:id', upload.single('featuredImage'), blogUpdateValidator, validate, updateBlog);
router.patch('/blogs/:id/status', setBlogStatus);
router.delete('/blogs/:id', deleteBlog);

router.post('/blog-categories', blogCategoryValidator, validate, createBlogCategory);
router.put('/blog-categories/:id', updateBlogCategory);
router.delete('/blog-categories/:id', deleteBlogCategory);

// Settings (Phase 15)
router.get('/settings', requirePermission('manage_settings'), getAllSettings);
router.put('/settings', requirePermission('manage_settings'), settingsUpdateValidator, validate, updateSettings);
router.put('/settings/logo', requirePermission('manage_settings'), upload.single('logo'), updateLogo);
router.put('/settings/favicon', requirePermission('manage_settings'), upload.single('favicon'), updateFavicon);
router.get('/settings/environment-status', requirePermission('manage_settings'), getEnvironmentStatus);

// Media Manager (Phase 12)
router.get('/media/folders', getFolders);
router.post('/media/folders', folderValidator, validate, createFolder);
router.put('/media/folders/:id', updateFolder);
router.delete('/media/folders/:id', deleteFolder);

router.get('/media', getMedia);
router.post('/media/upload', mediaUpload.array('files', 20), uploadMedia);
router.put('/media/:id', updateMedia);
router.put('/media/:id/replace', mediaUpload.single('file'), replaceMedia);
router.delete('/media/:id', deleteMedia);

// Notifications (Phase 16)
router.get('/notification-templates', getTemplates);
router.post('/notification-templates', templateValidator, validate, createTemplate);
router.put('/notification-templates/:id', updateTemplate);
router.delete('/notification-templates/:id', deleteTemplate);
router.post('/notifications/broadcast', broadcastValidator, validate, broadcastNotification);

// Notification Center — campaigns (compose/schedule/history) + delivery logs
router.get('/notification-campaigns', getCampaigns);
router.post('/notification-campaigns', upload.single('image'), createCampaign);
router.delete('/notification-campaigns/:id', cancelCampaign);
router.get('/notification-jobs', getNotificationJobs);
router.post('/notification-jobs/:id/retry', retryNotificationJob);

// Contact Enquiries
const {
  getAllEnquiries: getAdminEnquiries,
  getEnquiryById: getAdminEnquiryById,
  updateEnquiry: updateAdminEnquiry,
  deleteEnquiry: deleteAdminEnquiry,
} = require('../controllers/contactEnquiry.controller');

router.get('/contact-enquiries', getAdminEnquiries);
router.get('/contact-enquiries/:id', getAdminEnquiryById);
router.patch('/contact-enquiries/:id', updateAdminEnquiry);
router.delete('/contact-enquiries/:id', deleteAdminEnquiry);

// Newsletter Management
const {
  getAllSubscribers: getNewsletterSubscribers,
  exportSubscribers: exportNewsletterSubscribers,
  deleteSubscriber: deleteNewsletterSubscriber,
  getStats: getNewsletterStats,
} = require('../controllers/newsletter.controller');

router.get('/newsletter/stats', getNewsletterStats);
router.get('/newsletter/subscribers', getNewsletterSubscribers);
router.get('/newsletter/subscribers/export', exportNewsletterSubscribers);
router.delete('/newsletter/subscribers/:id', deleteNewsletterSubscriber);

// Consultation Bookings (Astrology add-on) — admin management. Service
// catalog CRUD lives under /consultations/services (see
// routes/consultationService.routes.js) since it's public-readable and
// doesn't need this file's `protect + authorize('admin')` gate on GET.
const {
  getAllBookings,
  updateBookingStatus,
  updateBookingPayment,
  assignAstrologer,
  moderateReview,
  uploadDeliverable,
} = require('../controllers/consultationBooking.controller');
const {
  updateBookingStatusValidator,
  assignAstrologerValidator,
  moderateReviewValidator,
} = require('../validators/consultation.validator');

router.get('/consultation-bookings', requirePermission('manage_consultations'), getAllBookings);
router.put(
  '/consultation-bookings/:id/status',
  requirePermission('manage_consultations'),
  updateBookingStatusValidator,
  validate,
  updateBookingStatus,
);
router.put('/consultation-bookings/:id/payment', requirePermission('manage_consultations'), updateBookingPayment);
router.put(
  '/consultation-bookings/:id/assign',
  requirePermission('manage_consultations'),
  assignAstrologerValidator,
  validate,
  assignAstrologer,
);
router.patch(
  '/consultation-bookings/:id/review',
  requirePermission('manage_consultations'),
  moderateReviewValidator,
  validate,
  moderateReview,
);
router.post(
  '/consultation-bookings/:id/deliverables',
  requirePermission('manage_consultations'),
  mediaUpload.array('files', 10),
  uploadDeliverable,
);

// Astrologer profile CRUD already lives at /api/v1/astrologers
// (routes/astrologer.routes.js, protect+authorize('admin')+requirePermission
// gated for writes) — not duplicated here.
const { getAvailabilityConfig, updateAvailabilityConfig } = require('../controllers/availability.controller');
router.get('/consultation-availability/:serviceId', requirePermission('manage_consultations'), getAvailabilityConfig);
router.put('/consultation-availability/:serviceId', requirePermission('manage_consultations'), updateAvailabilityConfig);

// Premium AI Kundli — settings write only; everything else (orders,
// customer flow) lives at /api/v1/kundli/* (routes/premiumKundli.routes.js).
const { updateSettings: updatePremiumKundliSettings } = require('../controllers/premiumKundli.controller');
const { updateSettingsValidator: premiumKundliSettingsValidator } = require('../validators/premiumKundli.validator');
const premiumKundliImageFields = upload.fields([
  { name: 'banner', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);
router.put(
  '/premium-kundli/settings',
  requirePermission('manage_consultations'),
  premiumKundliImageFields,
  premiumKundliSettingsValidator,
  validate,
  updatePremiumKundliSettings,
);

// Premium AI Horoscope — same settings-write pattern as Premium Kundli
// above, reusing the same generic validator (premiumKundli.validator.js's
// updateSettingsValidator has no Kundli-specific logic — it only checks
// originalPrice/salePrice/gstPercent/isActive). Everything else (orders,
// customer flow) lives at /api/v1/horoscope/* (routes/horoscope.routes.js).
const { updateHoroscopeSettings } = require('../controllers/horoscope.controller');
router.put(
  '/premium-horoscope/settings',
  requirePermission('manage_consultations'),
  premiumKundliImageFields,
  premiumKundliSettingsValidator,
  validate,
  updateHoroscopeSettings,
);

module.exports = router;
