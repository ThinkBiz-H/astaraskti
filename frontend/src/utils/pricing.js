// Mirrors backend/services/order.service.js `calculateTotals` exactly, so
// the cart/checkout UI shows the same numbers the order will actually be
// created with. GST applies to the discounted product subtotal only, never
// to shipping.
export const calculateOrderTotals = (subTotal = 0, discountAmount = 0, shippingCharge = 0) => {
  const discountedSubTotal = Math.max(subTotal - discountAmount, 0);
  const tax = Math.round(discountedSubTotal * 0.18);
  const grandTotal = discountedSubTotal + shippingCharge + tax;
  return { tax, grandTotal, discountedSubTotal };
};
