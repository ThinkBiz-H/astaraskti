import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { MainLayout, DashboardLayout } from '@/components/layout/Layouts';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { PageLoader } from '@/components/common/Elements';

const HomePage = lazy(() => import('@/pages/HomePage'));
const ShopPage = lazy(() => import('@/pages/ShopPage'));
const CategoryPage = lazy(() => import('@/pages/CategoryPage'));
const SearchPage = lazy(() => import('@/pages/SearchPage'));
const ProductDetailsPage = lazy(() => import('@/pages/ProductDetailsPage'));
const CartPage = lazy(() => import('@/pages/CartPage'));
const WishlistPage = lazy(() => import('@/pages/WishlistPage'));
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));
const PolicyPage = lazy(() => import('@/pages/PolicyPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const BlogListPage = lazy(() => import('@/pages/BlogPage').then((m) => ({ default: m.BlogListPage })));
const BlogDetailPage = lazy(() => import('@/pages/BlogPage').then((m) => ({ default: m.BlogDetailPage })));

const AuthLayout = lazy(() => import('@/pages/auth/AuthLayout'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));

const ProfilePage = lazy(() => import('@/pages/account/ProfilePage'));
const OrdersListPage = lazy(() => import('@/pages/account/OrdersPages').then((m) => ({ default: m.OrdersListPage })));
const OrderDetailsPage = lazy(() => import('@/pages/account/OrdersPages').then((m) => ({ default: m.OrderDetailsPage })));
const AddressesPage = lazy(() => import('@/pages/account/AddressesAndPasswordPages').then((m) => ({ default: m.AddressesPage })));
const ChangePasswordPage = lazy(() => import('@/pages/account/AddressesAndPasswordPages').then((m) => ({ default: m.ChangePasswordPage })));
const ConsultationsListPage = lazy(() => import('@/pages/account/ConsultationsPages').then((m) => ({ default: m.ConsultationsListPage })));
const KundliReportsPage = lazy(() => import('@/pages/account/ConsultationsPages').then((m) => ({ default: m.KundliReportsPage })));
const AccountNotificationsPage = lazy(() => import('@/pages/account/NotificationsPage'));
const PremiumKundliPage = lazy(() => import('@/pages/account/PremiumKundliPage'));

const ConsultationServicesPage = lazy(() => import('@/pages/consultation/ConsultationServicesPage'));
const BookingFormPage = lazy(() => import('@/pages/consultation/BookingFormPage'));
const BookingPaymentPage = lazy(() => import('@/pages/consultation/BookingStatusPages').then((m) => ({ default: m.BookingPaymentPage })));
const BookingSuccessPage = lazy(() => import('@/pages/consultation/BookingStatusPages').then((m) => ({ default: m.BookingSuccessPage })));

// Public guest-checkout flow — distinct names from the /account/premium-kundli
// dashboard page above (both happen to be called "PremiumKundliPage" in
// their own files, aliased here to avoid confusion).
const PremiumKundliPurchasePage = lazy(() => import('@/pages/kundli/PremiumKundliPage'));
const PremiumKundliSuccessPage = lazy(() => import('@/pages/kundli/PremiumKundliSuccessPage'));

// Premium Horoscope — cloned from the Premium Kundli purchase flow above.
const PremiumHoroscopePage = lazy(() => import('@/pages/horoscope/PremiumHoroscopePage'));
const PremiumHoroscopeSuccessPage = lazy(() => import('@/pages/horoscope/PremiumHoroscopeSuccessPage'));

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/product/:slug" element={<ProductDetailsPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/blog" element={<BlogListPage />} />
          <Route path="/blog/:slug" element={<BlogDetailPage />} />
          <Route path="/policies/:slug" element={<PolicyPage />} />

          <Route path="/consultation" element={<ConsultationServicesPage />} />
          <Route path="/consultation/:slug" element={<BookingFormPage />} />

          {/* Premium Kundli — full guest checkout, deliberately NOT behind
              ProtectedRoute and no isAuthenticated check anywhere in this
              flow. No login/OTP required at all (unlike Checkout above,
              which still requires OTP at Place Order — this is simpler:
              purely a guest order, no account created). */}
          <Route path="/kundli" element={<PremiumKundliPurchasePage />} />
          <Route path="/kundli/success" element={<PremiumKundliSuccessPage />} />

          {/* Premium Horoscope — same guest-checkout pattern as Kundli above. */}
          <Route path="/horoscope" element={<PremiumHoroscopePage />} />
          <Route path="/horoscope/success" element={<PremiumHoroscopeSuccessPage />} />

          {/* Checkout is deliberately NOT behind ProtectedRoute — guest
              checkout only requires OTP verification at "Place Order" time,
              not an existing login (see CheckoutPage.jsx). */}
          <Route path="/checkout" element={<CheckoutPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/consultation/booking/:id/pay" element={<BookingPaymentPage />} />
            <Route path="/consultation/booking/:id/success" element={<BookingSuccessPage />} />
          </Route>
        </Route>

        <Route element={<AuthLayout />}>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/account" element={<ProfilePage />} />
            <Route path="/account/orders" element={<OrdersListPage />} />
            <Route path="/account/orders/:id" element={<OrderDetailsPage />} />
            <Route path="/account/consultations" element={<ConsultationsListPage />} />
            <Route path="/account/kundli-reports" element={<KundliReportsPage />} />
            <Route path="/account/premium-kundli" element={<PremiumKundliPage />} />
            <Route path="/account/notifications" element={<AccountNotificationsPage />} />
            <Route path="/account/addresses" element={<AddressesPage />} />
            <Route path="/account/change-password" element={<ChangePasswordPage />} />
          </Route>
        </Route>

        <Route element={<MainLayout />}>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
