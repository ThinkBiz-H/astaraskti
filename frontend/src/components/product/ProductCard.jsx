import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { StarRating, ProductCardSkeleton, AppImage } from '@/components/common/Elements';
import { QuickViewModal } from '@/components/product/QuickViewModal';
import { useWishlist } from '@/hooks/useWishlist';
import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/utils/format';
import clsx from 'clsx';

export function ProductCard({ product }) {
  const { ids, toggle } = useWishlist();
  const { addToCart } = useCart();
  const [quickView, setQuickView] = useState(false);
  const isWishlisted = ids.has(product._id);
  const hasSale = product.salePrice > 0 && product.salePrice < product.price;
  const displayPrice = hasSale ? product.salePrice : product.price;
  const outOfStock = product.stock <= 0;

  const handleAdd = (e) => {
    e.preventDefault();
    addToCart({ productId: product._id, quantity: 1 });
  };

  return (
    <>
      <motion.div whileHover={{ y: -4 }} className="group relative">
        <Link to={`/product/${product.slug}`} className="block">
          <div className="relative aspect-[3/4] overflow-hidden bg-night-900/5">
            <AppImage
              src={product.thumbnail?.url || product.images?.[0]?.url}
              alt={product.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {outOfStock ? (
              <span className="absolute left-2 top-2 rounded-sm bg-night-900/80 px-2 py-1 text-[10px] font-semibold text-ivory">
                OUT OF STOCK
              </span>
            ) : hasSale && (
              <span className="absolute left-2 top-2 rounded-sm bg-maroon-700 px-2 py-1 text-[10px] font-semibold text-ivory">
                {Math.round(((product.price - product.salePrice) / product.price) * 100)}% OFF
              </span>
            )}
            <div className="absolute right-2 top-2 flex flex-col gap-2">
              <button
                onClick={(e) => { e.preventDefault(); toggle(product._id); }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow"
                aria-label="Toggle wishlist"
              >
                <Heart size={15} className={clsx(isWishlisted ? 'fill-maroon-700 text-maroon-700' : 'text-night-900/60')} />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); setQuickView(true); }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 opacity-0 shadow transition-opacity duration-300 group-hover:opacity-100"
                aria-label="Quick view"
              >
                <Eye size={15} className="text-night-900/60" />
              </button>
            </div>
            {!outOfStock && (
              <button
                onClick={handleAdd}
                className="absolute inset-x-2 bottom-2 translate-y-10 rounded-sm bg-night-950/90 py-2 text-xs font-medium text-ivory opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
              >
                Add to Cart
              </button>
            )}
          </div>
          <div className="mt-3 space-y-1">
            <h3 className="truncate text-sm text-night-900">{product.title}</h3>
            {product.numReviews > 0 && <StarRating rating={product.rating} size={12} />}
            <div className="flex items-center gap-2">
              <span className="font-display text-base font-semibold text-night-950">{formatCurrency(displayPrice)}</span>
              {hasSale && <span className="text-xs text-night-900/40 line-through">{formatCurrency(product.price)}</span>}
            </div>
          </div>
        </Link>
      </motion.div>
      {quickView && <QuickViewModal product={product} onClose={() => setQuickView(false)} />}
    </>
  );
}

export function ProductGrid({ products, isLoading, skeletonCount = 8 }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: skeletonCount }).map((_, i) => <ProductCardSkeleton key={i} />)}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => <ProductCard key={p._id} product={p} />)}
    </div>
  );
}
