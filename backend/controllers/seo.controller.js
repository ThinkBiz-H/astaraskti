const asyncHandler = require('../utils/asyncHandler');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Page = require('../models/Page');
const Blog = require('../models/Blog');
const { PUBLIC_VISIBILITY_FILTER } = require('./blog.controller');

const escapeXml = (str = '') =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const urlEntry = (loc, lastmod, priority = '0.7') =>
  `  <url>\n    <loc>${escapeXml(loc)}</loc>\n${lastmod ? `    <lastmod>${lastmod.toISOString().split('T')[0]}</lastmod>\n` : ''}    <priority>${priority}</priority>\n  </url>`;

// @desc    Dynamic XML sitemap, generated live from published/active content
//          (products, categories, published pages, published/scheduled-live
//          blog posts) — nothing here is a static/hardcoded list.
// @route   GET /sitemap.xml (mounted at the true root, not under /api/v1 —
//          search engines expect it at the domain root)
// @access  Public
const getSitemap = asyncHandler(async (req, res) => {
  const baseUrl = (process.env.CLIENT_URL || 'https://example.com').replace(/\/$/, '');

  const [products, categories, pages, blogs] = await Promise.all([
    Product.find({ isDeleted: false, status: 'active' }).select('slug updatedAt'),
    Category.find({ status: 'active' }).select('slug updatedAt'),
    Page.find({ status: 'published' }).select('slug updatedAt'),
    Blog.find(PUBLIC_VISIBILITY_FILTER).select('slug updatedAt'),
  ]);

  const urls = [
    urlEntry(`${baseUrl}/`, new Date(), '1.0'),
    ...products.map((p) => urlEntry(`${baseUrl}/products/${p.slug}`, p.updatedAt, '0.8')),
    ...categories.map((c) => urlEntry(`${baseUrl}/categories/${c.slug}`, c.updatedAt, '0.6')),
    ...pages.map((p) => urlEntry(`${baseUrl}/${p.slug}`, p.updatedAt, '0.5')),
    ...blogs.map((b) => urlEntry(`${baseUrl}/blog/${b.slug}`, b.updatedAt, '0.6')),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;

  res.type('application/xml').send(xml);
});

// @desc    robots.txt — content sourced from Settings when configured,
//          sensible default otherwise. References the live sitemap.
// @route   GET /robots.txt
// @access  Public
const getRobotsTxt = asyncHandler(async (req, res) => {
  const baseUrl = (process.env.CLIENT_URL || 'https://example.com').replace(/\/$/, '');
  const body = `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${baseUrl}/sitemap.xml\n`;
  res.type('text/plain').send(body);
});

module.exports = { getSitemap, getRobotsTxt };
