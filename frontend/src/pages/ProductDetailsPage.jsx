import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '@/features/auth/authSlice';
import { productsApi } from '@/api/endpoints/catalog';
import SEO from '@/components/common/SEO';
import { Breadcrumbs, PageLoader, StarRating, ErrorState } from '@/components/common/Elements';
import { ProductGallery } from '@/components/product/ProductGallery';
import { ProductGrid } from '@/components/product/ProductCard';
import { ReviewsSection } from '@/components/product/ReviewsSection';
import { useCart } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
import { formatCurrency } from '@/utils/format';
import { setBuyNowItem } from '@/utils/buyNow';
import { Heart, Share2, Minus, Plus, Truck, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';

export default function ProductDetailsPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [tab, setTab] = useState('description');

  const isAuthenticated = useSelector(selectIsAuthenticated);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['product', slug], queryFn: () => productsApi.getBySlug(slug) });
  const product = data?.product;

  const { data: variantsData } = useQuery({
    queryKey: ['variants', product?._id],
    queryFn: () => productsApi.variants(product._id),
    enabled: Boolean(product?.hasVariants),
  });
  const { data: relatedData } = useQuery({
    queryKey: ['related', product?._id],
    queryFn: () => productsApi.related(product._id),
    enabled: Boolean(product?._id),
  });

  const { addToCart } = useCart();
  const { ids, toggle } = useWishlist();

  useEffect(() => {
    // View tracking (recently-viewed / view-count) requires an account —
    // a guest has no such state to attach it to, and calling this
    // protected endpoint as a guest is exactly what used to trigger a
    // false "session expired" redirect (see axiosClient.js).
    if (product?._id && isAuthenticated) productsApi.trackView(product._id).catch(() => {});
  }, [product?._id, isAuthenticated]);

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState description="We couldn't load this product." onRetry={refetch} />;
  if (!product) return <div className="container-page py-20 text-center">Product not found.</div>;

  const variants = variantsData?.variants || [];
  const activePrice = selectedVariant
    ? (selectedVariant.salePrice > 0 ? selectedVariant.salePrice : selectedVariant.price)
    : (product.salePrice > 0 ? product.salePrice : product.price);
  const activeStock = selectedVariant ? selectedVariant.stock : product.stock;

  const handleAddToCart = () => {
    addToCart({
      productId: product._id,
      variantId: selectedVariant?._id,
      quantity,
    });
  };

  const handleBuyNow = () => {
    setBuyNowItem({
      productId: product._id,
      variantId: selectedVariant?._id || null,
      quantity,
    });
    navigate('/checkout?mode=buyNow');
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: product.title, url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <>
      <SEO title={product.title} description={product.shortDescription} image={product.thumbnail?.url} />
      <div className="container-page">
        <Breadcrumbs items={[{ label: 'Shop', to: '/shop' }, { label: product.title }]} />
      </div>

      <div className="container-page grid grid-cols-1 gap-10 pb-16 lg:grid-cols-2">
        <ProductGallery images={product.images} title={product.title} />

        <div>
          <h1 className="font-display text-3xl">{product.title}</h1>
          {product.numReviews > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <StarRating rating={product.rating} />
              <span className="text-sm text-night-900/50">({product.numReviews} reviews)</span>
            </div>
          )}

          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-display text-3xl text-maroon-700">{formatCurrency(activePrice)}</span>
            {(selectedVariant?.salePrice > 0 || product.salePrice > 0) && (
              <span className="text-night-900/40 line-through">
                {formatCurrency(selectedVariant ? selectedVariant.price : product.price)}
              </span>
            )}
          </div>

          {product.shortDescription && <p className="mt-4 text-sm text-night-900/70">{product.shortDescription}</p>}

          {variants.length > 0 && (
            <div className="mt-6">
              <h3 className="label-field">Select Option</h3>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v._id}
                    onClick={() => setSelectedVariant(v)}
                    className={clsx(
                      'rounded-sm border px-4 py-2 text-sm',
                      selectedVariant?._id === v._id ? 'border-gold-500 bg-gold-50' : 'border-night-900/15',
                    )}
                  >
                    {v.sku}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center rounded-sm border border-night-900/15">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="p-3"><Minus size={14} /></button>
              <span className="w-10 text-center text-sm">{quantity}</span>
              <button onClick={() => setQuantity((q) => Math.min(activeStock, q + 1))} className="p-3"><Plus size={14} /></button>
            </div>
            <button onClick={() => toggle(product._id)} className="rounded-sm border border-night-900/15 p-3.5" aria-label="Wishlist">
              <Heart size={18} className={ids.has(product._id) ? 'fill-maroon-700 text-maroon-700' : ''} />
            </button>
            <button onClick={handleShare} className="rounded-sm border border-night-900/15 p-3.5" aria-label="Share">
              <Share2 size={18} />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-4">
            <button onClick={handleAddToCart} disabled={activeStock <= 0} className="btn-outline flex-1">
              {activeStock > 0 ? 'Add to Cart' : 'Out of Stock'}
            </button>
            <button onClick={handleBuyNow} disabled={activeStock <= 0} className="btn-primary flex-1">
              Buy Now
            </button>
          </div>

          <div className="mt-6 space-y-2 border-t border-night-900/10 pt-4 text-sm text-night-900/60">
            <p className="flex items-center gap-2"><Truck size={15} /> Free shipping on orders above ₹999</p>
            <p className="flex items-center gap-2"><ShieldCheck size={15} /> 100% authentic, hand-blessed products</p>
          </div>

          {/* Tabs: Description / Specifications / FAQ */}
          <div className="mt-8">
            <div className="flex gap-6 border-b border-night-900/10 text-sm">
              {['description', 'specifications', 'faq'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={clsx('border-b-2 py-3 capitalize', tab === t ? 'border-gold-500 text-night-950' : 'border-transparent text-night-900/50')}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="py-5 text-sm leading-relaxed text-night-900/75">
              {tab === 'description' && <div dangerouslySetInnerHTML={{ __html: product.description || 'No description available.' }} />}
              {tab === 'specifications' && (
                <table className="w-full text-sm">
                  <tbody>
                    {(product.attributes || []).map((attr) => (
                      <tr key={attr.key} className="border-b border-night-900/5">
                        <td className="py-2 font-medium capitalize">{attr.key}</td>
                        <td className="py-2 text-night-900/60">{attr.value}</td>
                      </tr>
                    ))}
                    {product.weight && (
                      <tr className="border-b border-night-900/5"><td className="py-2 font-medium">Weight</td><td className="py-2 text-night-900/60">{product.weight} kg</td></tr>
                    )}
                  </tbody>
                </table>
              )}
              {tab === 'faq' && <p className="text-night-900/50">No FAQs added for this product yet.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="container-page border-t border-night-900/10 py-14">
        <ReviewsSection productId={product._id} />
      </div>

      {relatedData?.products?.length > 0 && (
        <div className="container-page border-t border-night-900/10 py-14">
          <h2 className="mb-8 font-display text-2xl">You May Also Like</h2>
          <ProductGrid products={relatedData.products} />
        </div>
      )}
    </>
  );
}
