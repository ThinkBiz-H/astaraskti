const { body, query } = require('express-validator');
const { ORDER_STATUSES } = require('../utils/orderStatusMachine');

const createOrderValidator = [
  body('shippingAddress').notEmpty().withMessage('Shipping address is required'),
  body('shippingAddress.addressLine1').notEmpty().withMessage('Address line 1 is required'),
  body('shippingAddress.city').notEmpty().withMessage('City is required'),
  body('shippingAddress.state').notEmpty().withMessage('State is required'),
  body('shippingAddress.pincode').notEmpty().withMessage('Pincode is required'),
  body('paymentMethod').isIn(['razorpay', 'cod']).withMessage('Payment method must be razorpay or cod'),
  body('couponCode').optional().isString().trim(),
  body('shippingNotes').optional().isString().isLength({ max: 500 }).withMessage('Shipping notes must be under 500 characters'),
  // Optional — only sent for Buy Now / guest checkout (see createOrder in
  // order.controller.js); omitted entirely for the normal logged-in
  // account-cart checkout, which is unaffected by this.
  body('items').optional().isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.productId').if(body('items').exists()).isMongoId().withMessage('Each item requires a valid productId'),
  body('items.*.variantId').optional({ checkFalsy: true }).isMongoId().withMessage('variantId must be a valid id'),
  body('items.*.quantity').if(body('items').exists()).isInt({ min: 1 }).withMessage('Each item requires a quantity of at least 1'),
];

const updateOrderStatusValidator = [
  body('orderStatus').optional().isIn(ORDER_STATUSES).withMessage('Invalid order status'),
  body('note').optional().isString().isLength({ max: 500 }),
  body('adminNote').optional().isString().isLength({ max: 1000 }),
  body('shippingNotes').optional().isString().isLength({ max: 500 }),
  body('trackingNumber').optional().isString().trim(),
  body('trackingUrl').optional().isURL().withMessage('trackingUrl must be a valid URL'),
  body('estimatedDeliveryDate').optional().isISO8601().withMessage('estimatedDeliveryDate must be a valid date'),
  body('courierPartner').optional().isString().trim(),
  body('courierName').optional().isString().trim(),
  body('deliveryFailed').optional().isBoolean(),
  body().custom((value) => {
    const hasAnyField = [
      'orderStatus', 'note', 'adminNote', 'shippingNotes', 'trackingNumber',
      'trackingUrl', 'estimatedDeliveryDate', 'courierPartner', 'courierName',
    ].some((key) => value[key] !== undefined);
    if (!hasAnyField) throw new Error('At least one field must be provided');
    return true;
  }),
];

const createShipmentValidator = [
  body('courierId').optional().isString().trim(),
];

const getAllOrdersValidator = [
  query('status').optional().isIn(ORDER_STATUSES),
  query('paymentStatus').optional().isIn(['Pending', 'Paid', 'Failed', 'Refunded', 'Partially Refunded']),
  query('paymentMethod').optional().isIn(['razorpay', 'cod']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
];

module.exports = {
  createOrderValidator,
  updateOrderStatusValidator,
  createShipmentValidator,
  getAllOrdersValidator,
};
