const express = require('express');
const router = express.Router();

const {
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  getCart,
  applyCoupon,
  removeCoupon,
} = require('../controllers/cart.controller');

const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

/**
 * @swagger
 * /cart:
 *   get:
 *     summary: Get the logged-in user's cart with computed totals
 *     tags: [Cart]
 *     responses:
 *       200: { description: Cart with resolved per-item pricing (variant-aware) and subTotal }
 *   post:
 *     summary: Add an item to the cart
 *     tags: [Cart]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId]
 *             properties:
 *               productId: { type: string }
 *               variantId: { type: string, description: "Required if the product has variants" }
 *               quantity: { type: integer, default: 1 }
 *               color: { type: string }
 *               size: { type: string }
 *     responses:
 *       200: { description: Item added, updated cart returned }
 *   delete:
 *     summary: Clear the entire cart
 *     tags: [Cart]
 *     responses:
 *       200: { description: Cart cleared }
 */
router.route('/').get(getCart).post(addToCart).delete(clearCart);
router.post('/apply-coupon', applyCoupon);
router.delete('/remove-coupon', removeCoupon);
router.route('/:productId').put(updateCartItem).delete(removeCartItem);

module.exports = router;
