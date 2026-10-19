import { useCallback } from 'react';
import { RAZORPAY_CHECKOUT_SRC } from '@/utils/constants';

const loadScript = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = RAZORPAY_CHECKOUT_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout script'));
    document.body.appendChild(script);
  });

/**
 * Opens the Razorpay Checkout widget. `options` follows Razorpay's own API
 * (https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/)
 * — key, amount, order_id, prefill, theme, handler, modal.ondismiss.
 */
export const useRazorpay = () => {
  const openCheckout = useCallback(async (options) => {
    await loadScript();
    const rzp = new window.Razorpay(options);
    rzp.open();
    return rzp;
  }, []);

  return { openCheckout };
};
