import { Link, Outlet } from 'react-router-dom';
import { Moon } from 'lucide-react';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-night-950 bg-star-field px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display text-2xl text-ivory">
          <Moon className="text-gold-400" /> Astro Sanatan Shakti
        </Link>
        <div className="card p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
