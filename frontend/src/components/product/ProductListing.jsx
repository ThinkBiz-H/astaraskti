import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { productsApi, categoriesApi, brandsApi } from '@/api/endpoints/catalog';
import { ProductGrid } from '@/components/product/ProductCard';
import { Pagination, EmptyState, ErrorState } from '@/components/common/Elements';
import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest' },
  { value: 'price', label: 'Price: Low to High' },
  { value: '-price', label: 'Price: High to Low' },
  { value: '-rating', label: 'Top Rated' },
];

/**
 * Generic product listing block, backed directly by GET /products.
 * `fixedFilters` lets the page (Category/Search) pin a query param the user
 * can't clear from the UI (e.g. { category: id }).
 */
export function ProductListing({ fixedFilters = {}, title }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const page = Number(searchParams.get('page')) || 1;
  const sort = searchParams.get('sort') || '-createdAt';
  const category = searchParams.get('category') || '';
  const brand = searchParams.get('brand') || '';
  const keyword = searchParams.get('q') || '';

  const params = { page, limit: 12, sort, ...fixedFilters };
  if (category) params.category = category;
  if (brand) params.brand = brand;
  if (keyword) params.keyword = keyword;

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['products', params], queryFn: () => productsApi.list(params) });
  const { data: categories } = useQuery({ queryKey: ['categories', 'flat'], queryFn: () => categoriesApi.list() });
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: brandsApi.list });

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.set('page', '1');
    setSearchParams(next);
  };

  const products = data?.products || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / 12));

  return (
    <div className="container-page py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">{title}</h1>
          <p className="text-sm text-night-900/50">{total} products</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowFilters((v) => !v)} className="btn-outline lg:hidden">
            <SlidersHorizontal size={16} /> Filters
          </button>
          <select value={sort} onChange={(e) => updateParam('sort', e.target.value)} className="input-field w-auto">
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        <aside className={`space-y-6 ${showFilters ? 'block' : 'hidden'} lg:block`}>
          {!fixedFilters.category && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-night-900/70">Category</h3>
              <div className="space-y-1.5 text-sm">
                {categories?.categories?.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => updateParam('category', category === c._id ? '' : c._id)}
                    className={`block w-full text-left ${category === c._id ? 'font-semibold text-gold-600' : 'text-night-900/70'}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {brands?.brands?.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-night-900/70">Brand</h3>
              <div className="space-y-1.5 text-sm">
                {brands.brands.map((b) => (
                  <button
                    key={b._id}
                    onClick={() => updateParam('brand', brand === b._id ? '' : b._id)}
                    className={`block w-full text-left ${brand === b._id ? 'font-semibold text-gold-600' : 'text-night-900/70'}`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <div>
          {isError ? (
            <ErrorState description="We couldn't load these products." onRetry={refetch} />
          ) : !isLoading && products.length === 0 ? (
            <EmptyState title="No products found" description="Try adjusting your filters or search terms." />
          ) : (
            <>
              <ProductGrid products={products} isLoading={isLoading} />
              <Pagination page={page} totalPages={totalPages} onChange={(p) => updateParam('page', p)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
