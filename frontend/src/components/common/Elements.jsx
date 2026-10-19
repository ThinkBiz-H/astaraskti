import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Star, Loader2, PackageX, ImageOff, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

/** <img> with a graceful fallback when `src` is missing or fails to load (broken/expired Cloudinary URL, network error, etc). */
export function AppImage({ src, alt, className, ...rest }) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div className={clsx('flex items-center justify-center bg-night-900/5 text-night-900/20', className)}>
        <ImageOff size={28} />
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setErrored(true)} {...rest} />;
}

/** Generic error state with a retry button — pass a React Query `refetch` as `onRetry`. */
export function ErrorState({ title = 'Something went wrong', description = 'Please try again in a moment.', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <AlertTriangle size={40} className="text-maroon-700/40" />
      <h3 className="font-display text-xl text-night-900">{title}</h3>
      <p className="max-w-sm text-sm text-night-900/60">{description}</p>
      {onRetry && <button onClick={onRetry} className="btn-outline mt-2">Try Again</button>}
    </div>
  );
}

export function Breadcrumbs({ items }) {
  // items: [{ label, to? }] — last item has no `to` (current page)
  return (
    <nav aria-label="Breadcrumb" className="py-4 text-xs text-night-900/60">
      <ol className="flex flex-wrap items-center gap-1">
        <li><Link to="/" className="hover:text-gold-600">Home</Link></li>
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            <ChevronRight size={12} />
            {item.to ? (
              <Link to={item.to} className="hover:text-gold-600">{item.label}</Link>
            ) : (
              <span className="text-night-900">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  );
  return (
    <div className="mt-10 flex items-center justify-center gap-1">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="h-9 w-9 rounded-sm border border-night-900/15 text-sm disabled:opacity-30"
      >
        ‹
      </button>
      {pages.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && p - pages[i - 1] > 1 && <span className="px-1 text-night-900/40">…</span>}
          <button
            onClick={() => onChange(p)}
            className={clsx(
              'h-9 w-9 rounded-sm text-sm',
              p === page ? 'bg-maroon-700 text-ivory' : 'border border-night-900/15 hover:border-gold-500',
            )}
          >
            {p}
          </button>
        </span>
      ))}
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="h-9 w-9 rounded-sm border border-night-900/15 text-sm disabled:opacity-30"
      >
        ›
      </button>
    </div>
  );
}

export function StarRating({ rating = 0, size = 14, showValue = false }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= Math.round(rating) ? 'fill-gold-400 text-gold-400' : 'fill-night-900/10 text-night-900/10'}
        />
      ))}
      {showValue && <span className="ml-1 text-xs text-night-900/60">({rating.toFixed(1)})</span>}
    </div>
  );
}

export function EmptyState({ icon: Icon = PackageX, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <Icon size={40} className="text-night-900/20" />
      <h3 className="font-display text-xl text-night-900">{title}</h3>
      {description && <p className="max-w-sm text-sm text-night-900/60">{description}</p>}
      {action}
    </div>
  );
}

export function Spinner({ size = 20, className }) {
  return <Loader2 size={size} className={clsx('animate-spin text-gold-500', className)} />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner size={32} />
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="skeleton aspect-[3/4] w-full" />
      <div className="skeleton h-4 w-3/4" />
      <div className="skeleton h-4 w-1/3" />
    </div>
  );
}

const BADGE_TONES = {
  default: 'bg-night-900/10 text-night-900',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  gold: 'bg-gold-50 text-gold-600',
};

export function Badge({ children, tone = 'default', className }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', BADGE_TONES[tone] || BADGE_TONES.default, className)}>
      {children}
    </span>
  );
}

/** Loading placeholder for the order-detail page — mirrors its real layout so there's no layout shift once data arrives. */
export function OrderDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-8 w-64" />
      <div className="skeleton h-16 w-full" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="skeleton h-40 w-full" />
          <div className="skeleton h-64 w-full" />
          <div className="skeleton h-48 w-full" />
        </div>
        <div className="space-y-6">
          <div className="skeleton h-32 w-full" />
          <div className="skeleton h-48 w-full" />
        </div>
      </div>
    </div>
  );
}
