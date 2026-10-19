import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Layers, ShoppingCart, Sparkles, FileText, Tag,
  Image, HelpCircle, Users, Settings, LogOut, Moon, Star, Mail, Bell,
  Quote, Instagram, BarChart3, Megaphone, Boxes, BadgeCheck,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/products', label: 'Products', icon: Package },
      { to: '/inventory', label: 'Inventory', icon: Boxes },
      { to: '/categories', label: 'Categories', icon: Layers },
      { to: '/brands', label: 'Brands', icon: BadgeCheck },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/orders', label: 'Orders', icon: ShoppingCart },
      { to: '/coupons', label: 'Coupons', icon: Tag },
      { to: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Consultations',
    items: [
      { to: '/consultations', label: 'All Bookings', icon: Sparkles },
      { to: '/consultations/kundli', label: 'Kundli Requests', icon: Star },
      { to: '/consultation-services', label: 'Services', icon: Sparkles },
    ],
  },
  {
    label: 'Premium Kundli',
    items: [
      { to: '/premium-kundli/orders', label: 'Orders', icon: Star },
      { to: '/premium-kundli/settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    label: 'Premium Horoscope',
    items: [
      { to: '/premium-horoscope/settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/blog', label: 'Blog', icon: FileText },
      { to: '/pages', label: 'CMS Pages', icon: FileText },
      { to: '/banners', label: 'Home Sections / Banners', icon: Image },
      { to: '/announcements', label: 'Announcement Bar', icon: Megaphone },
      { to: '/testimonials', label: 'Testimonials', icon: Quote },
      { to: '/instagram-feed', label: 'Instagram Feed', icon: Instagram },
      { to: '/faq', label: 'FAQ', icon: HelpCircle },
      { to: '/enquiries', label: 'Contact Enquiries', icon: Mail },
      { to: '/newsletter', label: 'Newsletter', icon: Bell },
      { to: '/notifications', label: 'Notification Center', icon: Bell },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/users', label: 'Users', icon: Users },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-night-900/10 bg-night-950 text-white">
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5 font-display text-lg">
          <Moon className="text-gold-400" size={20} /> ASS Admin
        </div>
        <nav className="space-y-6 overflow-y-auto px-3 py-5" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">{section.label}</p>
              <div className="space-y-0.5">
                {section.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                        isActive ? 'bg-gold-400 text-night-950 font-medium' : 'text-white/70 hover:bg-white/5'
                      }`
                    }
                  >
                    <Icon size={16} /> {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex-1">
        <header className="flex h-16 items-center justify-between border-b border-night-900/10 bg-white px-6">
          <div />
          <div className="flex items-center gap-4">
            <span className="text-sm text-night-900/70">{user?.name || user?.email}</span>
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-maroon-700">
              <LogOut size={15} /> Logout
            </button>
          </div>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
