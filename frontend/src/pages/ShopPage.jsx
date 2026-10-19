import SEO from '@/components/common/SEO';
import { ProductListing } from '@/components/product/ProductListing';

export default function ShopPage() {
  return (
    <>
      <SEO title="Shop" description="Browse Rudraksha, Gemstones, Malas, Bracelets, Yantras and more sacred products." />
      <ProductListing title="Shop All Products" />
    </>
  );
}
