import { useSearchParams } from 'react-router-dom';
import SEO from '@/components/common/SEO';
import { ProductListing } from '@/components/product/ProductListing';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  return (
    <>
      <SEO title={`Search results for "${q}"`} noindex />
      <ProductListing title={`Search results for "${q}"`} />
    </>
  );
}
