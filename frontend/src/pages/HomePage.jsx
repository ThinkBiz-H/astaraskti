import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import SEO from "@/components/common/SEO";
import {
  AppImage,
  ErrorState,
  EmptyState,
  StarRating,
} from "@/components/common/Elements";
import { ProductGrid } from "@/components/product/ProductCard";
import { productsApi, categoriesApi } from "@/api/endpoints/catalog";
import { consultationServicesApi } from "@/api/endpoints/consultations";
import { cmsApi, testimonialsApi, blogApi } from "@/api/endpoints/misc";
import { formatDate } from "@/utils/format";
import HomeSectionRenderer from "@/components/home/HomeSectionRenderer";
import PremiumKundliSection from "@/components/home/PremiumKundliSection";
import PremiumHoroscopeSection from "@/components/home/PremiumHoroscopeSection";
import {
  Sparkles,
  ShieldCheck,
  Truck,
  Gem,
  Quote,
  PackageX,
  FileText,
  ArrowRight,
} from "lucide-react";

/** Shared heading treatment for every product/content rail below — kept in
 * one place so the new sections (Best Sellers, New Arrivals, Testimonials,
 * Blog) read as one consistent system rather than ad-hoc headers. */
function SectionHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <span className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold-600">
            <Sparkles size={12} /> {eyebrow}
          </span>
        )}
        <h2 className="font-display text-3xl text-night-950">{title}</h2>
        {subtitle && (
          <p className="mt-1.5 text-sm text-night-900/55">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/** A product rail: fetch -> loading skeleton (via ProductGrid) -> error ->
 * empty -> grid. Reused for Featured/Best Sellers/New Arrivals so each of
 * the three "NEW" sections is a 3-line call, not duplicated query/render
 * logic. */
function ProductRail({ queryKey, queryFn, eyebrow, title, subtitle }) {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey, queryFn });
  const products = data?.products || [];

  return (
    <section className="container-page py-16">
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        action={
          <Link
            to="/shop"
            className="shrink-0 text-sm font-medium text-gold-600 hover:underline"
          >
            View All →
          </Link>
        }
      />
      {isError ? (
        <ErrorState
          description={`We couldn't load ${title.toLowerCase()}.`}
          onRetry={refetch}
        />
      ) : !isLoading && products.length === 0 ? (
        <EmptyState
          icon={PackageX}
          title="Nothing here yet"
          description="Check back soon — new products are added regularly."
        />
      ) : (
        <ProductGrid products={products} isLoading={isLoading} />
      )}
    </section>
  );
}

export default function HomePage() {
  const { data: categories } = useQuery({
    queryKey: ["categories", "root"],
    queryFn: () => categoriesApi.list({ parent: "root" }),
  });
  const { data: services } = useQuery({
    queryKey: ["consultation-services", "home"],
    queryFn: () => consultationServicesApi.list({ limit: 4 }),
  });
  const { data: testimonialsData } = useQuery({
    queryKey: ["testimonials"],
    queryFn: testimonialsApi.list,
  });
  const { data: blogData } = useQuery({
    queryKey: ["blogs", "home"],
    queryFn: () => blogApi.list({ limit: 3 }),
  });
  const { data: homeSections, isLoading: loadingSections } = useQuery({
    queryKey: ["home-sections"],
    queryFn: cmsApi.getHomeSections,
  });

  const sections = homeSections?.sections || [];
  // ROOT CAUSE FIX: this used to be "if ANY home section exists, render
  // ONLY the admin-configured sections and discard the entire rest of the
  // page" — so uploading a single Home Banner (which creates exactly one
  // HomeSection record) made the whole static homepage (Hero, Categories,
  // Premium Kundli/Horoscope, Featured Products, everything) vanish,
  // leaving just that one banner. Uploading one banner must never replace
  // the complete Home Page, so the static homepage below now ALWAYS
  // renders in full; admin-configured sections are merged in on top of it
  // instead of replacing it:
  //   - a 'hero'-type section replaces only the hardcoded Hero visual
  //     (that's clearly its purpose — customizing the hero banner), and
  //   - every other section type (promo banners, etc.) renders as
  //     additional content right after the hero, in configured order.
  // Nothing below this point can ever disappear because of a CMS upload.
  const heroSection = !loadingSections ? sections.find((s) => s.type === "hero") : null;
  const otherSections = !loadingSections ? sections.filter((s) => s.type !== "hero") : [];
  const testimonials = (testimonialsData?.testimonials || []).slice(0, 6);
  const blogPosts = blogData?.blogs || [];

  const seo = (
    <SEO
      title="Vedic Astrology, Kundli & Sacred Products"
      description="Authentic Kundli readings, Vastu & Gemstone consultations, Rudraksha, Malas and sacred products — guided by Vedic tradition."
    />
  );

  return (
    <>
      {seo}

      {/* Hero — an admin-configured 'hero' HomeSection takes over this slot
          (and only this slot) when one exists; otherwise the default. */}
      {heroSection ? (
        <HomeSectionRenderer section={heroSection} />
      ) : (
      <section className="relative overflow-hidden bg-night-950 bg-star-field text-ivory">
        <div className="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full bg-gold-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-maroon-700/20 blur-3xl" />
        <div className="container-page relative grid min-h-[75vh] items-center gap-12 py-20 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-400/10 px-3 py-1 text-xs font-medium tracking-wide text-gold-300">
              <Sparkles size={12} /> Trusted Vedic Guidance
            </span>
            <p className="mb-4 font-deva text-lg text-gold-300">
              || सर्वे भवन्तु सुखिनः ||
            </p>
            <h1 className="font-display text-4xl leading-tight sm:text-5xl lg:text-[3.5rem]">
              Discover Your Path Through{" "}
              <span className="text-gold-400">Ancient Vedic Wisdom</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-ivory/70">
              Personalised Kundli readings, Vastu guidance, and hand-selected
              sacred products — blessed and delivered with authenticity you can
              trust.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link to="/kundli" className="btn-gold">
                Book Kundli Reading
              </Link>
              <Link
                to="/shop"
                className="btn-outline border-ivory/30 text-ivory hover:border-ivory"
              >
                Explore Shop
              </Link>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative mx-auto aspect-square w-full max-w-sm rounded-full border border-gold-400/30"
          >
            <div className="absolute inset-6 rounded-full border border-gold-400/20" />
            <div className="absolute inset-12 rounded-full border border-gold-400/10" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles size={80} className="text-gold-400/70" />
            </div>
          </motion.div>
        </div>
      </section>
      )}

      {/* Any other admin-configured HomeSection (promo banners, etc.) —
          rendered as extra content, never in place of what's below. */}
      {otherSections.map((section) => (
        <HomeSectionRenderer key={section._id} section={section} />
      ))}

      {/* Trust bar */}
      <section className="border-b border-night-900/10 bg-white py-8">
        <div className="container-page grid grid-cols-2 gap-8 text-center sm:grid-cols-4">
          {[
            { icon: ShieldCheck, label: "Authentic & Certified" },
            { icon: Gem, label: "Hand-selected Gemstones" },
            { icon: Sparkles, label: "Vedic-trained Astrologers" },
            { icon: Truck, label: "Pan-India Delivery" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-50">
                <Icon className="text-gold-600" size={22} />
              </span>
              <span className="text-xs font-medium text-night-900/70">
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      {categories?.categories?.length > 0 && (
        <section className="container-page py-16">
          <h2 className="mb-2 text-center font-display text-3xl">
            Shop by Category
          </h2>
          <p className="mx-auto mb-10 max-w-md text-center text-sm text-night-900/50">
            Explore our range of sacred and spiritual products
          </p>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
            {categories.categories.slice(0, 6).map((cat) => (
              <Link
                key={cat._id}
                to={`/category/${cat.slug}`}
                className="group text-center"
              >
                <div className="mx-auto mb-3 aspect-square w-full overflow-hidden rounded-full bg-night-900/5 ring-1 ring-night-900/5 transition-shadow group-hover:shadow-md">
                  <AppImage
                    src={cat.image?.url}
                    alt={cat.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform group-hover:scale-110"
                  />
                </div>
                <span className="text-sm font-medium text-night-900">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Premium Kundli & Premium Horoscope — dedicated banner cards. */}
      <PremiumKundliSection />
      <PremiumHoroscopeSection />

      {/* Consultation services teaser — "kundli"/"horoscope" are excluded
          here since they already get their own dedicated cards above;
          without this filter they'd show up twice once an admin creates
          those service records in Consultation Services. */}
      {services?.services?.filter(
        (svc) => svc.type !== "kundli" && svc.type !== "horoscope",
      ).length > 0 && (
        <section className="bg-maroon-700 py-16 text-ivory">
          <div className="container-page">
            <h2 className="mb-2 text-center font-display text-3xl">
              Consult Our Astrologers
            </h2>
            <p className="mx-auto mb-10 max-w-lg text-center text-ivory/70">
              Personalised readings for every stage of life — Horoscope
              Matching, Gemstone &amp; Vastu guidance.
            </p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {services.services
                .filter(
                  (svc) => svc.type !== "kundli" && svc.type !== "horoscope",
                )
                .map((svc) => (
                  <Link
                    key={svc._id}
                    to={`/consultation/${svc.slug}`}
                    className="rounded-sm border border-gold-400/30 bg-white/5 p-6 text-center transition-all hover:-translate-y-1 hover:bg-white/10 hover:shadow-lg"
                  >
                    <Sparkles
                      className="mx-auto mb-3 text-gold-400"
                      size={26}
                    />
                    <h3 className="font-display text-lg">{svc.name}</h3>
                    <p className="mt-1 text-xs text-ivory/60">
                      {svc.duration} mins
                    </p>
                    <p className="mt-3 font-display text-xl text-gold-300">
                      ₹{svc.price}
                    </p>
                  </Link>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Products */}
      <ProductRail
        queryKey={["products", "featured"]}
        queryFn={productsApi.featured}
        eyebrow="Curated Picks"
        title="Featured Products"
        subtitle="Hand-selected Rudraksha, gemstones and sacred essentials."
      />

      {/* Best Sellers (NEW) */}
      <section className="bg-night-900/[0.03] py-2">
        <ProductRail
          queryKey={["products", "bestsellers"]}
          queryFn={productsApi.bestSellers}
          eyebrow="Customer Favourites"
          title="Best Sellers"
          subtitle="The products our customers come back for, again and again."
        />
      </section>

      {/* New Arrivals (NEW) */}
      <ProductRail
        queryKey={["products", "new-arrivals"]}
        queryFn={productsApi.newArrivals}
        eyebrow="Just In"
        title="New Arrivals"
        subtitle="The latest additions to our sacred collection."
      />

      {/* Testimonials (NEW) */}
      {testimonials.length > 0 && (
        <section className="bg-night-950 py-16 text-ivory">
          <div className="container-page">
            <SectionHeader
              eyebrow="What Our Customers Say"
              title="Loved Across India"
              subtitle="Real stories from people we've guided."
            />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t) => (
                <div
                  key={t._id}
                  className="rounded-lg border border-gold-400/20 bg-white/5 p-6 transition-colors hover:border-gold-400/40"
                >
                  <Quote className="mb-3 text-gold-400/50" size={22} />
                  <StarRating rating={t.rating} size={13} />
                  <p className="mt-3 text-sm leading-relaxed text-ivory/75">
                    &ldquo;{t.content}&rdquo;
                  </p>
                  <div className="mt-5 flex items-center gap-3">
                    {t.customerImage?.url ? (
                      <AppImage
                        src={t.customerImage.url}
                        alt={t.customerName}
                        loading="lazy"
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-400/20 text-sm font-semibold text-gold-300">
                        {t.customerName?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">{t.customerName}</p>
                      {t.designation && (
                        <p className="text-xs text-ivory/50">{t.designation}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Blog (NEW) */}
      {blogPosts.length > 0 && (
        <section className="container-page py-16">
          <SectionHeader
            eyebrow="From the Journal"
            title="Vedic Wisdom & Guidance"
            subtitle="Articles to help you understand astrology, rituals and sacred living."
            action={
              <Link
                to="/blog"
                className="shrink-0 text-sm font-medium text-gold-600 hover:underline"
              >
                View All →
              </Link>
            }
          />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {blogPosts.map((post) => (
              <Link key={post._id} to={`/blog/${post.slug}`} className="group">
                <div className="mb-3 aspect-video overflow-hidden rounded-lg bg-night-900/5">
                  {post.featuredImage?.url ? (
                    <AppImage
                      src={post.featuredImage.url}
                      alt={post.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-night-900/20">
                      <FileText size={32} />
                    </div>
                  )}
                </div>
                <p className="text-xs text-night-900/40">
                  {formatDate(post.publishedAt || post.createdAt)}
                </p>
                <h3 className="mt-1 font-display text-lg leading-snug text-night-950 transition-colors group-hover:text-gold-600">
                  {post.title}
                </h3>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA (NEW) */}
      <section className="relative overflow-hidden bg-gradient-to-br from-maroon-800 to-night-950 py-20 text-center text-ivory">
        <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-gold-400/10 blur-3xl" />
        <div className="container-page relative">
          <Sparkles className="mx-auto mb-4 text-gold-400" size={32} />
          <h2 className="font-display text-3xl sm:text-4xl">
            Begin Your Vedic Journey Today
          </h2>
          <p className="mx-auto mt-3 max-w-md text-ivory/70">
            Get your personalised Kundli, explore sacred products, or consult an
            expert astrologer.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/kundli"
              className="btn-gold inline-flex items-center gap-2"
            >
              Get Your Kundli <ArrowRight size={16} />
            </Link>
            <Link
              to="/shop"
              className="btn-outline border-ivory/30 text-ivory hover:border-ivory"
            >
              Explore Shop
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
  