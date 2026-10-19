import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { blogApi } from '@/api/endpoints/misc';
import SEO from '@/components/common/SEO';
import { PageLoader, EmptyState, Pagination, AppImage } from '@/components/common/Elements';
import { formatDate } from '@/utils/format';
import { Newspaper, Search, Facebook, Twitter, Link2, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const estimateReadingTime = (html = '') => {
  const words = html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
};

export function BlogListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;
  const keyword = searchParams.get('keyword') || '';
  const tag = searchParams.get('tag') || '';
  const category = searchParams.get('category') || '';
  const [keywordInput, setKeywordInput] = useState(keyword);

  const { data: categoryData } = useQuery({ queryKey: ['blog-categories'], queryFn: blogApi.categories });
  const { data, isLoading } = useQuery({
    queryKey: ['blogs', page, keyword, tag, category],
    queryFn: () => blogApi.list({ page, limit: 9, keyword: keyword || undefined, tag: tag || undefined, category: category || undefined }),
  });

  const categories = categoryData?.categories || [];
  const blogs = data?.blogs || [];
  const totalPages = data?.totalPages || 1;

  const updateParams = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (v) next.set(k, v); else next.delete(k);
    });
    next.delete('page');
    setSearchParams(next);
  };

  return (
    <>
      <SEO title="Blog" description="Astrology insights, Vedic wisdom, and guidance from our experts." />
      <div className="container-page py-12">
        <h1 className="mb-8 font-display text-3xl">Blog</h1>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <form
            onSubmit={(e) => { e.preventDefault(); updateParams({ keyword: keywordInput }); }}
            className="flex max-w-sm flex-1 items-center gap-2"
          >
            <input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="Search articles…"
              className="input-field"
            />
            <button type="submit" className="btn-outline shrink-0"><Search size={15} /></button>
          </form>

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c._id}
                  onClick={() => updateParams({ category: category === c._id ? '' : c._id })}
                  className={`rounded-full border px-3 py-1 text-xs ${category === c._id ? 'border-gold-400 bg-gold-50 text-gold-600' : 'border-night-900/15 hover:border-gold-400'}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {(tag || category) && (
          <p className="mb-6 text-sm text-night-900/60">
            {tag && <>Filtering by tag: <strong>{tag}</strong>{' '}</>}
            <button onClick={() => updateParams({ tag: '', category: '' })} className="text-gold-600 underline">Clear filters</button>
          </p>
        )}

        {isLoading ? <PageLoader /> : blogs.length === 0 ? (
          <EmptyState icon={Newspaper} title="No articles found" />
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {blogs.map((post) => (
              <Link key={post._id} to={`/blog/${post.slug}`} className="group">
                {post.featuredImage?.url && (
                  <div className="mb-3 aspect-video overflow-hidden rounded-sm bg-night-900/5">
                    <AppImage src={post.featuredImage.url} alt={post.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  </div>
                )}
                <p className="text-xs text-gold-600">{post.category?.name} · {formatDate(post.publishedAt || post.createdAt)}</p>
                <h2 className="mt-1 font-display text-lg">{post.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-night-900/60">{post.excerpt}</p>
              </Link>
            ))}
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={(p) => setSearchParams({ ...Object.fromEntries(searchParams), page: p })} />
      </div>
    </>
  );
}

function TableOfContents({ html }) {
  const headings = useMemo(() => {
    if (!html || typeof window === 'undefined') return [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return Array.from(doc.querySelectorAll('h2, h3')).map((el, i) => ({
      id: `heading-${i}`,
      text: el.textContent,
      level: el.tagName,
    }));
  }, [html]);

  if (headings.length < 2) return null;

  return (
    <div className="card mb-8 p-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-night-900/50">Table of Contents</p>
      <ul className="space-y-1.5 text-sm">
        {headings.map((h) => (
          <li key={h.id} className={h.level === 'H3' ? 'ml-4' : ''}>
            <a href={`#${h.id}`} className="text-night-900/70 hover:text-gold-600">{h.text}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Injects matching `id` attributes onto the actual rendered headings so the
// TOC's anchor links work, without needing the backend to store them.
function addHeadingIds(html) {
  if (!html || typeof window === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('h2, h3').forEach((el, i) => el.setAttribute('id', `heading-${i}`));
  return doc.body.innerHTML;
}

function ShareButtons({ title }) {
  const url = typeof window !== 'undefined' ? window.location.href : '';

  const copyLink = () => {
    navigator.clipboard?.writeText(url);
    toast.success('Link copied to clipboard');
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-night-900/50">Share:</span>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer" className="text-night-900/50 hover:text-gold-600"><Facebook size={17} /></a>
      <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`} target="_blank" rel="noreferrer" className="text-night-900/50 hover:text-gold-600"><Twitter size={17} /></a>
      <button onClick={copyLink} className="text-night-900/50 hover:text-gold-600"><Link2 size={17} /></button>
    </div>
  );
}

export function BlogDetailPage() {
  const { slug } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['blog', slug], queryFn: () => blogApi.getBySlug(slug) });

  if (isLoading) return <PageLoader />;
  const post = data?.blog;
  const related = data?.related || [];
  if (!post) return <div className="container-page py-20 text-center">Article not found.</div>;

  const contentWithIds = addHeadingIds(post.content);

  return (
    <>
      <SEO
        title={post.seo?.metaTitle || post.title}
        description={post.seo?.metaDescription || post.excerpt}
        image={post.seo?.ogImage || post.featuredImage?.url}
        canonical={post.seo?.canonicalUrl}
      />
      <article className="container-page max-w-3xl py-12">
        <nav className="mb-6 flex items-center gap-1.5 text-xs text-night-900/50">
          <Link to="/" className="hover:text-gold-600">Home</Link>
          <ChevronRight size={12} />
          <Link to="/blog" className="hover:text-gold-600">Blog</Link>
          <ChevronRight size={12} />
          <span className="text-night-900/70">{post.title}</span>
        </nav>

        <p className="text-xs text-gold-600">
          {post.category?.name && <Link to={`/blog?category=${post.category._id}`}>{post.category.name}</Link>} · {formatDate(post.publishedAt || post.createdAt)} · {estimateReadingTime(post.content)} min read
        </p>
        <h1 className="mt-2 font-display text-4xl">{post.title}</h1>

        {post.author?.name && <p className="mt-2 text-sm text-night-900/50">By {post.author.name}</p>}

        <div className="mt-4"><ShareButtons title={post.title} /></div>

        {post.featuredImage?.url && <AppImage src={post.featuredImage.url} alt={post.title} className="my-6 aspect-video w-full rounded-sm object-cover" />}

        <TableOfContents html={post.content} />

        <div className="prose max-w-none text-night-900/80" dangerouslySetInnerHTML={{ __html: contentWithIds }} />

        {post.tags?.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link key={tag} to={`/blog?tag=${encodeURIComponent(tag)}`} className="rounded-full bg-night-900/5 px-3 py-1 text-xs text-night-900/60 hover:bg-gold-50 hover:text-gold-600">
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {related.length > 0 && (
          <div className="mt-12 border-t border-night-900/10 pt-8">
            <h2 className="mb-6 font-display text-2xl">Related Posts</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {related.map((r) => (
                <Link key={r._id} to={`/blog/${r.slug}`} className="group">
                  {r.featuredImage?.url && (
                    <div className="mb-2 aspect-video overflow-hidden rounded-sm bg-night-900/5">
                      <AppImage src={r.featuredImage.url} alt={r.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    </div>
                  )}
                  <p className="text-sm font-medium">{r.title}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </>
  );
}
