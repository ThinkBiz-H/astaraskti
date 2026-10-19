import { Outlet, NavLink } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import AnnouncementBar from './AnnouncementBar';
import { User, Package, MapPin, Heart, FileText, Sparkles, Lock, LogOut, Bell, Star } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-ivory">
      <AnnouncementBar />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

const ACCOUNT_NAV = [
  { to: '/account', label: 'Profile', icon: User, end: true },
  { to: '/account/orders', label: 'My Orders', icon: Package },
  { to: '/account/consultations', label: 'Consultations', icon: Sparkles },
  { to: '/account/kundli-reports', label: 'Kundli Reports', icon: FileText },
  { to: '/account/premium-kundli', label: 'Premium Kundli', icon: Star },
  { to: '/account/notifications', label: 'Notifications', icon: Bell },
  { to: '/account/addresses', label: 'Addresses', icon: MapPin },
  { to: '/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/account/change-password', label: 'Change Password', icon: Lock },
];

export function DashboardLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen flex-col bg-ivory">
      <Header />
      <main className="flex-1">
        <div className="container-page grid grid-cols-1 gap-8 py-10 lg:grid-cols-[240px_1fr]">
          <aside className="card h-fit p-4">
            <nav className="space-y-1">
              {ACCOUNT_NAV.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors ${
                      isActive ? 'bg-maroon-700 text-ivory' : 'text-night-800 hover:bg-night-900/5'
                    }`
                  }
                >
                  <Icon size={16} />
                  {label}
                </NavLink>
              ))}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-sm text-maroon-700 hover:bg-maroon-700/5"
              >
                <LogOut size={16} />
                Logout
              </button>
            </nav>
          </aside>
          <div>
            <Outlet />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
