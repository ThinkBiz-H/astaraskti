const Page = require('../models/Page');
const Faq = require('../models/Faq');
const HomeSection = require('../models/HomeSection');
const logger = require('../utils/logger');

/**
 * These are ordinary Page documents — nothing here is a hardcoded model.
 * An admin can rename, unpublish, or delete any of them, or add entirely
 * new pages, through the normal /admin/pages API.
 */
const standardPages = [
  { title: 'About Us', slug: 'about', content: '<p>Tell your story here.</p>', status: 'published' },
  { title: 'Contact Us', slug: 'contact', content: '<p>Contact details go here.</p>', status: 'published' },
  { title: 'Privacy Policy', slug: 'privacy-policy', content: '<p>Your privacy policy goes here.</p>', status: 'published' },
  { title: 'Terms & Conditions', slug: 'terms-conditions', content: '<p>Your terms go here.</p>', status: 'published' },
  { title: 'Shipping Policy', slug: 'shipping-policy', content: '<p>Your shipping policy goes here.</p>', status: 'published' },
  { title: 'Refund Policy', slug: 'refund-policy', content: '<p>Your refund policy goes here.</p>', status: 'published' },
];

const starterFaqs = [
  { question: 'What payment methods do you accept?', answer: 'We accept Razorpay (cards, UPI, netbanking, wallets) and Cash on Delivery.', category: 'Payments', sortOrder: 0 },
  { question: 'How long does delivery take?', answer: 'Delivery times vary by location and are shown at checkout after you enter your pincode.', category: 'Shipping', sortOrder: 0 },
  { question: 'Can I return a product?', answer: 'Yes, most products can be returned within the window stated on the product page.', category: 'Returns', sortOrder: 0 },
];

const starterSections = [
  { type: 'hero', title: 'Welcome', subtitle: 'Shop the collection', sortOrder: 0, isActive: true },
  { type: 'featured_products', title: 'Featured Products', sortOrder: 1, isActive: true },
  { type: 'categories', title: 'Shop by Category', sortOrder: 2, isActive: true },
];

const seedCms = async () => {
  const existingPages = await Page.countDocuments();
  if (existingPages === 0) {
    await Page.insertMany(standardPages);
    logger.info(`${standardPages.length} standard pages seeded`);
  } else {
    logger.info('Pages already exist, skipping page seeding');
  }

  const existingFaqs = await Faq.countDocuments();
  if (existingFaqs === 0) {
    await Faq.insertMany(starterFaqs);
    logger.info(`${starterFaqs.length} FAQs seeded`);
  } else {
    logger.info('FAQs already exist, skipping FAQ seeding');
  }

  const existingSections = await HomeSection.countDocuments();
  if (existingSections === 0) {
    await HomeSection.insertMany(starterSections);
    logger.info(`${starterSections.length} home sections seeded`);
  } else {
    logger.info('Home sections already exist, skipping home section seeding');
  }
};

module.exports = seedCms;
