import { useSyncExternalStore } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { wishlistApi } from '@/api/endpoints/cart';
import { productsApi } from '@/api/endpoints/catalog';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '@/features/auth/authSlice';
import { guestWishlistStore } from '@/utils/guestWishlist';
import { useCart } from '@/hooks/useCart';
import toast from 'react-hot-toast';

// Same dual-backend pattern as useCart.js: the account wishlist (backend,
// when logged in) or a localStorage guest wishlist (when not), resolved
// into the same { items, ids, toggle, ... } shape so ProductCard,
// ProductDetailsPage and WishlistPage work identically either way.
export const useWishlist = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const queryClient = useQueryClient();
  const { addToCart } = useCart();

  // ---------------- Account wishlist (backend) ----------------
  const wishlistQuery = useQuery({
    queryKey: ['wishlist'],
    queryFn: wishlistApi.get,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['wishlist'] });

  // ---------------- Guest wishlist (localStorage) ----------------
  const guestIds = useSyncExternalStore(guestWishlistStore.subscribe, guestWishlistStore.getSnapshot);
  const guestProductQueries = useQueries({
    queries: !isAuthenticated
      ? guestIds.map((id) => ({
          queryKey: ['product-by-id', id],
          queryFn: () => productsApi.getById(id),
          staleTime: 60_000,
        }))
      : [],
  });
  const guestItems = !isAuthenticated ? guestProductQueries.map((q) => q.data?.product).filter(Boolean) : [];
  const guestWishlistLoading = !isAuthenticated && guestProductQueries.some((q) => q.isLoading);

  const items = isAuthenticated ? wishlistQuery.data?.wishlist || [] : guestItems;
  const ids = new Set(isAuthenticated ? items.map((p) => p._id) : guestIds);

  // ---------------- Unified mutations ----------------
  const add = useMutation({
    mutationFn: async (productId) => {
      if (isAuthenticated) return wishlistApi.add(productId);
      guestWishlistStore.add(productId);
      return null;
    },
    onSuccess: () => {
      if (isAuthenticated) invalidate();
      toast.success('Added to wishlist');
    },
  });
  const remove = useMutation({
    mutationFn: async (productId) => {
      if (isAuthenticated) return wishlistApi.remove(productId);
      guestWishlistStore.remove(productId);
      return null;
    },
    onSuccess: () => {
      if (isAuthenticated) invalidate();
      toast.success('Removed from wishlist');
    },
  });
  // Guest has no server-side wishlist to move an item "from" — this just
  // adds to the (guest) cart and drops it out of the guest wishlist store,
  // same net effect as the account version.
  const moveToCart = useMutation({
    mutationFn: async ({ productId, ...payload }) => {
      if (isAuthenticated) return wishlistApi.moveToCart(productId, payload);
      await addToCart({ productId, quantity: payload.quantity || 1, variantId: payload.variantId });
      guestWishlistStore.remove(productId);
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      if (isAuthenticated) {
        invalidate();
        toast.success('Moved to cart');
      }
    },
  });

  const toggle = (productId) => {
    if (ids.has(productId)) remove.mutate(productId);
    else add.mutate(productId);
  };

  return {
    items,
    ids,
    isLoading: isAuthenticated ? wishlistQuery.isLoading : guestWishlistLoading,
    toggle,
    add: add.mutateAsync,
    remove: remove.mutateAsync,
    moveToCart: moveToCart.mutateAsync,
  };
};
