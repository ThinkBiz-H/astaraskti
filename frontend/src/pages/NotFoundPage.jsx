import { Link } from 'react-router-dom';
import SEO from '@/components/common/SEO';
import { Moon } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <>
      <SEO title="Page Not Found" noindex />
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <Moon className="mb-4 text-gold-400" size={48} />
        <h1 className="font-display text-6xl">404</h1>
        <p className="mt-3 text-night-900/60">The stars couldn't find the page you're looking for.</p>
        <Link to="/" className="btn-primary mt-6">Back to Home</Link>
      </div>
    </>
  );
}
