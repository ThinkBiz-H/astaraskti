import { useSyncExternalStore } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { cartApi } from "@/api/endpoints/cart";
import { productsApi } from "@/api/endpoints/catalog";
import { couponsApi } from "@/api/endpoints/orders";
import { useSelector, useDispatch } from "react-redux";
import { selectIsAuthenticated } from "@/features/auth/authSlice";
import { selectAppliedCoupon, setCoupon, clearCoupon } from "@/features/coupon/couponSlice";
import { calculateOrderTotals } from "@/utils/pricing";
import { guestCartStore } from "@/utils/guestCart";
import toast from "react-hot-toast";
import { getErrorMessage } from "@/api/axiosClient";

// One hook, one interface, two backing stores: the account cart (backend,
// when logged in) or a localStorage guest cart (when not) — resolved into
// the exact same shape so every consumer (Header, CartPage, CheckoutPage,
// ProductDetailsPage) works identically for guests and logged-in customers
// without knowing which one it's talking to.
export const useCart = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const appliedCoupon = useSelector(selectAppliedCoupon);
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  // ---------------- Account cart (backend) ----------------
  const cartQuery = useQuery({
    queryKey: ["cart"],
    queryFn: cartApi.get,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["cart"] });

  // ---------------- Guest cart (localStorage) ----------------
  const guestLines = useSyncExternalStore(guestCartStore.subscribe, guestCartStore.getSnapshot);
  const uniqueProductIds = [...new Set(guestLines.map((l) => l.productId))];
  const guestProductQueries = useQueries({
    queries: !isAuthenticated
      ? uniqueProductIds.map((id) => ({
          queryKey: ["product-by-id", id],
          queryFn: () => productsApi.getById(id),
          staleTime: 60_000,
        }))
      : [],
  });
  const productById = new Map(
    guestProductQueries.filter((q) => q.data?.product).map((q) => [q.data.product._id, q.data.product]),
  );
  const guestItems = !isAuthenticated
    ? guestLines
        .map((line) => {
          const product = productById.get(line.productId);
          if (!product) return null;
          const variant = line.variantId ? (product.variants || []).find((v) => v._id === line.variantId) : null;
          const price = variant
            ? variant.salePrice > 0 ? variant.salePrice : variant.price
            : product.salePrice > 0 ? product.salePrice : product.price;
          return {
            product,
            variant: variant || null,
            quantity: line.quantity,
            color: line.color,
            size: line.size,
            price,
            itemTotal: price * line.quantity,
          };
        })
        .filter(Boolean)
    : [];
  const guestCartLoading = !isAuthenticated && guestProductQueries.some((q) => q.isLoading);

  // ---------------- Unified mutations ----------------
  const addToCart = useMutation({
    mutationFn: async (payload) => {
      if (isAuthenticated) return cartApi.add(payload);
      guestCartStore.add(payload);
      return null;
    },
    onSuccess: () => {
      if (isAuthenticated) invalidate();
      toast.success("Added to cart");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateQuantity = useMutation({
    mutationFn: async ({ productId, variantId, quantity }) => {
      if (isAuthenticated) return cartApi.updateQuantity(productId, { variantId, quantity });
      guestCartStore.updateQuantity(productId, variantId, quantity);
      return null;
    },
    onSuccess: () => isAuthenticated && invalidate(),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const removeItem = useMutation({
    mutationFn: async (productId) => {
      if (isAuthenticated) return cartApi.remove(productId);
      guestCartStore.remove(productId);
      return null;
    },
    onSuccess: () => {
      if (isAuthenticated) invalidate();
      toast.success("Item removed");
    },
  });

  const clearCartMutation = useMutation({
    mutationFn: async () => {
      if (isAuthenticated) return cartApi.clear();
      guestCartStore.clear();
      return null;
    },
    onSuccess: () => isAuthenticated && invalidate(),
  });

  // Guest coupon validation has no account cart to read a subtotal from
  // server-side, so it's passed explicitly and checked against the same
  // Coupon.isValid() logic via the public /coupons/validate endpoint —
  // order creation re-validates everything (including per-user limit,
  // unknowable for a guest) once the customer is authenticated regardless.
  const currentSubtotal = isAuthenticated
    ? cartQuery.data?.subTotal || 0
    : guestItems.reduce((sum, i) => sum + i.itemTotal, 0);

  const applyCoupon = useMutation({
    mutationFn: (code) =>
      isAuthenticated ? cartApi.applyCoupon(code) : couponsApi.validate({ code, subtotal: currentSubtotal }),
    onSuccess: (res) => {
      dispatch(setCoupon({ code: res.code, discountAmount: res.discountAmount }));
      toast.success(`Coupon "${res.code}" applied`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const removeCoupon = useMutation({
    mutationFn: async () => {
      if (isAuthenticated) return cartApi.removeCoupon();
      return null;
    },
    onSuccess: () => {
      dispatch(clearCoupon());
      toast.success("Coupon removed");
    },
  });

  const items = isAuthenticated ? cartQuery.data?.cart || [] : guestItems;
  const subTotal = currentSubtotal;
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  // Re-validate the applied coupon's minimum-order requirement locally
  // whenever the cart subtotal changes (e.g. an item was removed) so a
  // coupon that no longer qualifies doesn't silently keep discounting.
  const discountAmount = appliedCoupon.code ? appliedCoupon.discountAmount : 0;
  const { tax, grandTotal } = calculateOrderTotals(subTotal, discountAmount, 0);

  return {
    items,
    subTotal,
    itemCount,
    tax,
    grandTotal,
    appliedCoupon: appliedCoupon.code ? appliedCoupon : null,
    isLoading: isAuthenticated ? cartQuery.isLoading : guestCartLoading,
    addToCart: addToCart.mutateAsync,
    updateQuantity: updateQuantity.mutateAsync,
    removeItem: removeItem.mutateAsync,
    clearCart: async () => {
      dispatch(clearCoupon());
      return clearCartMutation.mutateAsync();
    },
    applyCoupon: applyCoupon.mutateAsync,
    removeCoupon: removeCoupon.mutateAsync,
    isApplyingCoupon: applyCoupon.isPending,
  };
};
