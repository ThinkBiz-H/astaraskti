import { Link } from 'react-router-dom';
import { useWishlist } from '@/hooks/useWishlist';
import SEO from '@/components/common/SEO';
import { EmptyState, AppImage } from '@/components/common/Elements';
import { formatCurrency } from '@/utils/format';
import { Heart, Trash2 } from 'lucide-react';

export default function WishlistPage() {
  const { items, isLoading, remove, moveToCart } = useWishlist();

  if (!isLoading && items.length === 0) {
    return (
      <div className="container-page py-20">
        <EmptyState icon={Heart} title="Your wishlist is empty" action={<Link to="/shop" className="btn-primary mt-2">Browse Products</Link>} />
      </div>
    );
  }

  return (
    <>
      <SEO title="Wishlist" noindex />
      <div className="container-page py-10">
        <h1 className="mb-8 font-display text-3xl">My Wishlist</h1>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((product) => (
            <div key={product._id} className="card flex gap-4 p-4">
              <AppImage src={product.thumbnail?.url} alt={product.title} className="h-20 w-20 rounded-sm object-cover" />
              <div className="flex-1">
                <Link to={`/product/${product.slug}`} className="text-sm font-medium">{product.title}</Link>
                <p className="mt-1 font-display text-base text-maroon-700">
                  {formatCurrency(product.salePrice > 0 ? product.salePrice : product.price)}
                </p>
                <div className="mt-2 flex gap-3 text-xs">
                  <button onClick={() => moveToCart({ productId: product._id, quantity: 1 })} className="font-medium text-gold-600">Move to Cart</button>
                  <button onClick={() => remove(product._id)} className="flex items-center gap-1 text-night-900/50"><Trash2 size={12} /> Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
