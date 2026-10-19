const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const categoryRoutes = require('./category.routes');
const brandRoutes = require('./brand.routes');
const unitRoutes = require('./unit.routes');
const warehouseRoutes = require('./warehouse.routes');
const inventoryRoutes = require('./inventory.routes');
const pageRoutes = require('./page.routes');
const homeSectionRoutes = require('./homeSection.routes');
const faqRoutes = require('./faq.routes');
const settingsRoutes = require('./settings.routes');
const blogRoutes = require('./blog.routes');
const productRoutes = require('./product.routes');
const wishlistRoutes = require('./wishlist.routes');
const cartRoutes = require('./cart.routes');
const couponRoutes = require('./coupon.routes');
const orderRoutes = require('./order.routes');
const paymentRoutes = require('./payment.routes');
const adminRoutes = require('./admin.routes');
const webhookRoutes = require('./webhook.routes');
const notificationRoutes = require('./notification.routes');
const consultationServiceRoutes = require('./consultationService.routes');
const consultationBookingRoutes = require('./consultationBooking.routes');
const astrologerRoutes = require('./astrologer.routes');
const premiumKundliRoutes = require('./premiumKundli.routes');
const horoscopeRoutes = require('./horoscope.routes');
const contactEnquiryRoutes = require('./contactEnquiry.routes');
const newsletterRoutes = require('./newsletter.routes');
const testimonialRoutes = require('./testimonial.routes');
const instagramFeedRoutes = require('./instagramFeed.routes');
const announcementBarRoutes = require('./announcementBar.routes');
const maintenanceMode = require('../middlewares/maintenance.middleware');

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'E-Commerce API v1 is running',
    data: { version: '1.0.0' },
    error: null,
  });
});

// Mounted BEFORE the maintenance-mode gate, deliberately: an admin must
// always be able to log in and manage the store (and turn maintenance mode
// back off) while it's active, warehouse/inventory operations are internal
// (not storefront-facing), and payment/shipping webhooks must never be
// dropped mid-maintenance.
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/warehouses', warehouseRoutes);
router.use('/inventory', inventoryRoutes);

// Everything below is customer/storefront-facing and honors maintenance mode.
router.use(maintenanceMode);

router.use('/users', userRoutes);
router.use('/categories', categoryRoutes);
router.use('/brands', brandRoutes);
router.use('/units', unitRoutes);
router.use('/pages', pageRoutes);
router.use('/home-sections', homeSectionRoutes);
router.use('/faqs', faqRoutes);
router.use('/settings', settingsRoutes);
router.use('/blogs', blogRoutes);
router.use('/products', productRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/cart', cartRoutes);
router.use('/coupons', couponRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/contact', contactEnquiryRoutes);
router.use('/newsletter', newsletterRoutes);
router.use('/testimonials', testimonialRoutes);
router.use('/instagram-feed', instagramFeedRoutes);
router.use('/announcements', announcementBarRoutes);

// Astrology consultation module — kept entirely separate from the product
// catalog/orders above. Public service catalog + admin CRUD:
router.use('/consultations/services', consultationServiceRoutes);
// Customer booking flow (admin management lives under /admin/consultation-bookings):
router.use('/consultations/bookings', consultationBookingRoutes);
// Astrologer profile records — public listing (for display) + admin CRUD.
router.use('/astrologers', astrologerRoutes);
// Premium AI Kundli purchase system — standalone from the Consultation
// module above (self-serve purchase + placeholder generation, not a
// booked reading). Admin settings write lives under /admin (see admin.routes.js).
router.use('/kundli', premiumKundliRoutes);
// Premium Horoscope purchase system — cloned from the Premium Kundli
// architecture above, own collection/env flags, reuses Kundli's geocoding
// endpoint + the shared pdf/email/payment services. See horoscope.routes.js.
router.use('/horoscope', horoscopeRoutes);

module.exports = router;
