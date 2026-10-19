import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { categoriesApi } from '@/api/endpoints/catalog';
import SEO from '@/components/common/SEO';
import { Breadcrumbs, PageLoader } from '@/components/common/Elements';
import { ProductListing } from '@/components/product/ProductListing';

export default function CategoryPage() {
  const { slug } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['category', slug], queryFn: () => categoriesApi.getBySlug(slug) });

  if (isLoading) return <PageLoader />;
  const category = data?.category;

  return (
    <>
      <SEO title={category?.name} description={category?.description} />
      <div className="container-page">
        <Breadcrumbs items={[{ label: 'Shop', to: '/shop' }, { label: category?.name || slug }]} />
      </div>
      <ProductListing title={category?.name || 'Category'} fixedFilters={{ category: category?._id }} />
    </>
  );
}
