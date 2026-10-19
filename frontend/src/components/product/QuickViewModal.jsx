import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { AppImage, StarRating } from '@/components/common/Elements';
import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/utils/format';

export function QuickViewModal({ product, onClose }) {
  const { addToCart } = useCart();

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!product) return null;

  const hasSale = product.salePrice > 0 && product.salePrice < product.price;
  const displayPrice = hasSale ? product.salePrice : product.price;
  const outOfStock = product.stock <= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative grid w-full max-w-2xl grid-cols-1 gap-6 rounded-sm bg-white p-6 sm:grid-cols-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-night-900/5 text-night-900/60 hover:bg-night-900/10"
          aria-label="Close quick view"
        >
          <X size={16} />
        </button>

        <AppImage
          src={product.thumbnail?.url || product.images?.[0]?.url}
          alt={product.title}
          className="aspect-[3/4] w-full rounded-sm object-cover"
        />

        <div className="flex flex-col">
          <h3 className="font-display text-xl text-night-950">{product.title}</h3>
          {product.numReviews > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <StarRating rating={product.rating} size={13} />
              <span className="text-xs text-night-900/50">({product.numReviews} reviews)</span>
            </div>
          )}
          <div className="mt-3 flex items-center gap-2">
            <span className="font-display text-2xl font-semibold text-night-950">{formatCurrency(displayPrice)}</span>
            {hasSale && <span className="text-sm text-night-900/40 line-through">{formatCurrency(product.price)}</span>}
          </div>
          {product.shortDescription && (
            <p className="mt-3 text-sm text-night-900/70">{product.shortDescription}</p>
          )}
          <div className="mt-auto flex flex-col gap-2 pt-6">
            <button
              onClick={() => { addToCart({ productId: product._id, quantity: 1 }); onClose(); }}
              disabled={outOfStock}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
            >
              {outOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
            <Link to={`/product/${product.slug}`} onClick={onClose} className="btn-outline w-full text-center">
              View Full Details
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
