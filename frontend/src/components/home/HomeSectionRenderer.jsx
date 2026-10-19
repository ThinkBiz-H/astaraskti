import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { productsApi, categoriesApi, brandsApi } from '@/api/endpoints/catalog';
import { blogApi, cmsApi, newsletterApi, testimonialsApi, instagramFeedApi } from '@/api/endpoints/misc';
import { ProductGrid } from '@/components/product/ProductCard';
import { StarRating, AppImage } from '@/components/common/Elements';
import { formatCurrency, formatDate } from '@/utils/format';
import { getErrorMessage } from '@/api/axiosClient';

// Every section type below is backed by a real query against an existing
// endpoint — there is no hardcoded/sample content here. A type with no
// query defined simply doesn't render (see the default case), rather than
// showing fabricated data.

function SectionWrapper({ section, children }) {
  const style = {};
  if (section.backgroundColor) style.backgroundColor = section.backgroundColor;
  if (section.textColor) style.color = section.textColor;
  return (
    <section style={style} className="py-16">
      <div className="container-page">{children}</div>
    </section>
  );
}

function SectionHeading({ section }) {
  if (!section.title && !section.subtitle) return null;
  return (
    <div className="mb-8 text-center">
      {section.title && <h2 className="font-display text-3xl">{section.title}</h2>}
      {section.subtitle && <p className="mt-2 text-night-900/60">{section.subtitle}</p>}
    </div>
  );
}

function SectionButton({ section }) {
  if (!section.button?.label || !section.button?.link) return null;
  return (
    <div className="mt-8 text-center">
      <Link to={section.button.link} className="btn-primary">{section.button.label}</Link>
    </div>
  );
}

function HeroSection({ section }) {
  const img = section.image?.url;
  return (
    <section
      className="relative overflow-hidden bg-night-950 bg-star-field text-ivory"
      style={{
        backgroundColor: section.backgroundColor || undefined,
        color: section.textColor || undefined,
        backgroundImage: img ? `url(${img})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-6 py-16 text-center">
        {section.title && <h1 className="font-display text-4xl leading-tight sm:text-5xl lg:text-6xl">{section.title}</h1>}
        {section.subtitle && <p className="max-w-xl text-ivory/70">{section.subtitle}</p>}
        {section.button?.label && section.button?.link && (
          <Link to={section.button.link} className="btn-gold">{section.button.label}</Link>
        )}
      </div>
    </section>
  );
}

function BannerSection({ section }) {
  return (
    <SectionWrapper section={section}>
      <div className="flex flex-col items-center gap-4 rounded-sm bg-night-900/5 p-10 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          {section.title && <h3 className="font-display text-2xl">{section.title}</h3>}
          {section.subtitle && <p className="mt-1 text-night-900/60">{section.subtitle}</p>}
        </div>
        <SectionButton section={section} />
      </div>
    </SectionWrapper>
  );
}

function FeaturedCategoriesSection({ section }) {
  const { data } = useQuery({ queryKey: ['categories', 'root'], queryFn: () => categoriesApi.list({ parent: 'root' }) });
  const categories = (data?.categories || []).slice(0, section.config?.limit || 6);
  if (categories.length === 0) return null;
  return (
    <SectionWrapper section={section}>
      <SectionHeading section={section} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((cat) => (
          <Link key={cat._id} to={`/category/${cat.slug}`} className="group text-center">
            <div className="mx-auto mb-3 aspect-square w-full overflow-hidden rounded-full bg-night-900/5">
              {cat.image?.url && <AppImage src={cat.image.url} alt={cat.name} className="h-full w-full object-cover transition-transform group-hover:scale-110" />}
            </div>
            <span className="text-sm">{cat.name}</span>
          </Link>
        ))}
      </div>
      <SectionButton section={section} />
    </SectionWrapper>
  );
}

const PRODUCT_QUERIES = {
  featured_products: () => productsApi.featured(),
  new_arrivals: () => productsApi.newArrivals(),
  trending_products: () => productsApi.trending(),
  best_sellers: () => productsApi.bestSellers(),
};

function ProductsSection({ section }) {
  const { data, isLoading } = useQuery({ queryKey: ['home-section-products', section.type], queryFn: PRODUCT_QUERIES[section.type] });
  const products = (data?.products || []).slice(0, section.config?.limit || 12);
  return (
    <SectionWrapper section={section}>
      <SectionHeading section={section} />
      <ProductGrid products={products} isLoading={isLoading} />
      <SectionButton section={section} />
    </SectionWrapper>
  );
}

function BrandsSection({ section }) {
  const { data } = useQuery({ queryKey: ['brands'], queryFn: brandsApi.list });
  const brands = data?.brands || [];
  if (brands.length === 0) return null;
  return (
    <SectionWrapper section={section}>
      <SectionHeading section={section} />
      <div className="flex flex-wrap items-center justify-center gap-10">
        {brands.map((b) => (
          <Link key={b._id} to={`/shop?brand=${b.slug}`} className="opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0">
            {b.logo?.url ? <AppImage src={b.logo.url} alt={b.name} className="h-10 object-contain" /> : <span className="text-sm">{b.name}</span>}
          </Link>
        ))}
      </div>
    </SectionWrapper>
  );
}

function BlogPreviewSection({ section }) {
  const { data } = useQuery({ queryKey: ['blogs', 'home'], queryFn: () => blogApi.list({ limit: section.config?.limit || 3 }) });
  const posts = data?.blogs || [];
  if (posts.length === 0) return null;
  return (
    <SectionWrapper section={section}>
      <SectionHeading section={section} />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {posts.map((post) => (
          <Link key={post._id} to={`/blog/${post.slug}`} className="group">
            {post.featuredImage?.url && (
              <div className="mb-3 aspect-video overflow-hidden rounded-sm bg-night-900/5">
                <AppImage src={post.featuredImage.url} alt={post.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              </div>
            )}
            <p className="text-xs text-night-900/40">{formatDate(post.publishedAt || post.createdAt)}</p>
            <h3 className="font-display text-lg">{post.title}</h3>
          </Link>
        ))}
      </div>
      <SectionButton section={section} />
    </SectionWrapper>
  );
}

function FaqPreviewSection({ section }) {
  const { data } = useQuery({ queryKey: ['faqs', 'home'], queryFn: cmsApi.getFaqs });
  const faqs = (data?.faqs || []).slice(0, section.config?.limit || 5);
  const [openId, setOpenId] = useState(null);
  if (faqs.length === 0) return null;
  return (
    <SectionWrapper section={section}>
      <SectionHeading section={section} />
      <div className="mx-auto max-w-2xl divide-y divide-night-900/10">
        {faqs.map((faq) => (
          <button key={faq._id} onClick={() => setOpenId(openId === faq._id ? null : faq._id)} className="w-full py-4 text-left">
            <p className="font-medium">{faq.question}</p>
            {openId === faq._id && <p className="mt-2 text-sm text-night-900/60">{faq.answer}</p>}
          </button>
        ))}
      </div>
      <SectionButton section={section} />
    </SectionWrapper>
  );
}

function NewsletterSection({ section }) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await newsletterApi.subscribe({ email });
      toast.success('Subscribed! Check your inbox for a confirmation.');
      setEmail('');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SectionWrapper section={section}>
      <div className="mx-auto max-w-lg text-center">
        <SectionHeading section={section} />
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email address"
            className="input-field"
          />
          <button type="submit" disabled={submitting} className="btn-primary shrink-0">
            {submitting ? 'Subscribing…' : 'Subscribe'}
          </button>
        </form>
      </div>
    </SectionWrapper>
  );
}

function TestimonialsSection({ section }) {
  const { data } = useQuery({ queryKey: ['testimonials'], queryFn: testimonialsApi.list });
  const testimonials = (data?.testimonials || []).slice(0, section.config?.limit || 10);
  if (testimonials.length === 0) return null;
  return (
    <SectionWrapper section={section}>
      <SectionHeading section={section} />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((t) => (
          <div key={t._id} className="card rounded-sm border border-night-900/10 p-6">
            <StarRating rating={t.rating} size={14} />
            <p className="mt-3 text-sm text-night-900/70">&ldquo;{t.content}&rdquo;</p>
            <div className="mt-4 flex items-center gap-3">
              {t.customerImage?.url ? (
                <AppImage src={t.customerImage.url} alt={t.customerName} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-night-900/10" />
              )}
              <div>
                <p className="text-sm font-medium">{t.customerName}</p>
                {t.designation && <p className="text-xs text-night-900/50">{t.designation}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionWrapper>
  );
}

function InstagramFeedSection({ section }) {
  const { data } = useQuery({ queryKey: ['instagram-feed'], queryFn: instagramFeedApi.list });
  const items = (data?.items || []).slice(0, section.config?.limit || 8);
  if (items.length === 0) return null;
  return (
    <SectionWrapper section={section}>
      <SectionHeading section={section} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {items.map((item) => {
          const img = <AppImage src={item.image.url} alt={item.caption || 'Instagram'} className="aspect-square h-full w-full object-cover transition-transform hover:scale-105" />;
          return item.link ? (
            <a key={item._id} href={item.link} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-sm">{img}</a>
          ) : (
            <div key={item._id} className="overflow-hidden rounded-sm">{img}</div>
          );
        })}
      </div>
    </SectionWrapper>
  );
}

export default function HomeSectionRenderer({ section }) {
  switch (section.type) {
    case 'hero':
      return <HeroSection section={section} />;
    case 'banner':
      return <BannerSection section={section} />;
    case 'featured_categories':
      return <FeaturedCategoriesSection section={section} />;
    case 'featured_products':
    case 'new_arrivals':
    case 'trending_products':
    case 'best_sellers':
      return <ProductsSection section={section} />;
    case 'brands':
      return <BrandsSection section={section} />;
    case 'testimonials':
      return <TestimonialsSection section={section} />;
    case 'instagram':
      return <InstagramFeedSection section={section} />;
    case 'blog_preview':
      return <BlogPreviewSection section={section} />;
    case 'faq_preview':
      return <FaqPreviewSection section={section} />;
    case 'newsletter':
      return <NewsletterSection section={section} />;
    default:
      // Unknown/unsupported section type — skip rather than guess at fake content.
      return null;
  }
}
