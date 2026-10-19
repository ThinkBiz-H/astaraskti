import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cmsApi } from '@/api/endpoints/misc';
import SEO from '@/components/common/SEO';
import { PageLoader } from '@/components/common/Elements';

export default function PolicyPage() {
  const { slug } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['page', slug], queryFn: () => cmsApi.getPageBySlug(slug) });

  if (isLoading) return <PageLoader />;
  const page = data?.page;
  if (!page) return <div className="container-page py-20 text-center">Page not found.</div>;

  return (
    <>
      <SEO title={page.title} />
      <article className="container-page max-w-3xl py-14">
        <h1 className="mb-6 font-display text-4xl">{page.title}</h1>
        <div className="prose max-w-none text-night-900/80" dangerouslySetInnerHTML={{ __html: page.content }} />
      </article>
    </>
  );
}
