import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Heart, ShoppingBag, User, Menu, X, Moon } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { toggleMobileMenu, closeMobileMenu } from "@/features/ui/uiSlice";
import { selectIsAuthenticated } from "@/features/auth/authSlice";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { categoriesApi } from "@/api/endpoints/catalog";
import NotificationBell from "@/components/notifications/NotificationBell";

const NAV_LINKS = [
  { label: "Shop", to: "/shop" },
  { label: "Consultation", to: "/consultation" },
  { label: "Kundli", to: "/kundli" },
  { label: "Rudraksha", to: "/shop?category=rudraksha" },
  { label: "Gemstones", to: "/shop?category=gemstones" },
  { label: "Blog", to: "/blog" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
];

export default function Header() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isMobileMenuOpen = useSelector((s) => s.ui.isMobileMenuOpen);
  const { itemCount } = useCart();
  const { items: wishlistItems } = useWishlist();
  const [searchTerm, setSearchTerm] = useState("");
  const { data: categoriesData } = useQuery({
    queryKey: ["categories", "root"],
    queryFn: () => categoriesApi.list({ parent: "root" }),
    staleTime: 5 * 60_000,
  });
  const shopCategories = categoriesData?.categories || [];

  const submitSearch = (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gold-400/20 bg-night-950 text-ivory">
      {/* Top bar */}

      <div className="container-page flex h-16 items-center justify-between gap-4 md:h-20">
        <button
          className="md:hidden"
          onClick={() => dispatch(toggleMobileMenu())}
          aria-label="Menu"
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>

        <Link
          to="/"
          className="flex items-center gap-2 font-display text-xl font-semibold tracking-wide md:text-2xl"
        >
          <Moon className="text-gold-400" size={22} />
          Astro Sanatan Shakti
        </Link>

        <nav className="hidden items-center gap-7 text-sm tracking-wide lg:flex">
          {NAV_LINKS.map((link) =>
            link.to === "/shop" && shopCategories.length > 0 ? (
              <div key={link.to} className="group relative py-2">
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    `transition-colors hover:text-gold-300 ${isActive ? "text-gold-400" : "text-ivory/85"}`
                  }
                >
                  {link.label}
                </NavLink>
                <div className="invisible absolute left-1/2 top-full z-50 grid w-64 -translate-x-1/2 grid-cols-2 gap-x-4 gap-y-2 rounded-sm border border-gold-400/20 bg-night-900 p-4 opacity-0 shadow-xl transition-opacity duration-150 group-hover:visible group-hover:opacity-100">
                  {shopCategories.map((cat) => (
                    <Link
                      key={cat._id}
                      to={`/category/${cat.slug}`}
                      className="text-xs text-ivory/75 transition-colors hover:text-gold-300"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `transition-colors hover:text-gold-300 ${isActive ? "text-gold-400" : "text-ivory/85"}`
                }
              >
                {link.label}
              </NavLink>
            ),
          )}
        </nav>

        <div className="flex items-center gap-4">
          <form
            onSubmit={submitSearch}
            className="hidden items-center rounded-sm bg-white/10 px-3 py-1.5 md:flex"
          >
            <Search size={16} className="text-ivory/60" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products, services..."
              className="ml-2 w-40 bg-transparent text-sm text-ivory placeholder:text-ivory/40 focus:outline-none lg:w-56"
            />
          </form>

          {isAuthenticated && <NotificationBell />}

          <Link to="/wishlist" className="relative" aria-label="Wishlist">
            <Heart size={20} />
            {wishlistItems.length > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-gold-400 text-[10px] font-bold text-night-950">
                {wishlistItems.length}
              </span>
            )}
          </Link>

          <Link to="/cart" className="relative" aria-label="Cart">
            <ShoppingBag size={20} />
            {itemCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-gold-400 text-[10px] font-bold text-night-950">
                {itemCount}
              </span>
            )}
          </Link>

          <Link
            to={isAuthenticated ? "/account" : "/login"}
            aria-label="Account"
          >
            <User size={20} />
          </Link>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="border-t border-white/10 bg-night-900 px-4 py-4 lg:hidden">
          <form
            onSubmit={submitSearch}
            className="mb-4 flex items-center rounded-sm bg-white/10 px-3 py-2"
          >
            <Search size={16} className="text-ivory/60" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="ml-2 w-full bg-transparent text-sm text-ivory placeholder:text-ivory/40 focus:outline-none"
            />
          </form>
          <nav className="flex flex-col gap-3 text-sm">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => dispatch(closeMobileMenu())}
                className="py-1 text-ivory/85"
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
