import { Helmet } from 'react-helmet-async';

const SITE_NAME = import.meta.env.VITE_SITE_NAME || 'Astro Sanatan Shakti';

export default function SEO({ title, description, image, canonical, noindex = false }) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {canonical && <link rel="canonical" href={canonical} />}
      <meta name="robots" content={noindex ? 'noindex,nofollow' : 'index,follow'} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      {image && <meta property="og:image" content={image} />}
      <meta property="og:type" content="website" />
    </Helmet>
  );
}
