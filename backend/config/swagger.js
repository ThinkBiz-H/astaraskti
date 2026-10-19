const swaggerJsdoc = require('swagger-jsdoc');

/**
 * Scope note (deliberate, not an oversight): this documents the CORE flows
 * with real JSDoc annotations (auth, products, categories, cart, orders) —
 * a representative, accurate subset, not an exhaustive annotation of every
 * endpoint across all 20 phases. Exhaustively annotating 150+ endpoints by
 * hand is a large undertaking on its own; extending coverage is mechanical
 * from here — add a `@swagger` JSDoc block above any route using the same
 * pattern as the annotated files listed in `apis` below, then add that
 * file to the `apis` array.
 */
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'E-Commerce Backend API',
      version: require('../package.json').version,
      description:
        'REST API for the e-commerce backend. Base path: /api/v1. This documentation covers core flows in full detail (auth, products, categories, cart, orders) — see docs/API.md for the complete endpoint reference across every module.',
    },
    servers: [{ url: '/api/v1', description: 'API base path' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
            error: { type: 'object', nullable: true },
          },
        },
        Product: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            slug: { type: 'string' },
            SKU: { type: 'string' },
            price: { type: 'number' },
            salePrice: { type: 'number', nullable: true },
            stock: { type: 'number' },
            category: { type: 'string' },
            hasVariants: { type: 'boolean' },
          },
        },
        Category: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            parent: { type: 'string', nullable: true },
            level: { type: 'number' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            orderNumber: { type: 'string' },
            orderStatus: { type: 'string' },
            paymentStatus: { type: 'string' },
            grandTotal: { type: 'number' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./routes/auth.routes.js', './routes/product.routes.js', './routes/category.routes.js', './routes/cart.routes.js', './routes/order.routes.js'],
};

module.exports = swaggerJsdoc(options);
