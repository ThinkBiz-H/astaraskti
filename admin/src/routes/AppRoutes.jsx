import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ProtectedRoute, PageLoader } from '@/components/common/Elements';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));

const ProductsListPage = lazy(() => import('@/pages/products/ProductsListPage'));
const ProductFormPage = lazy(() => import('@/pages/products/ProductFormPage'));
const CategoriesPage = lazy(() => import('@/pages/categories/CategoriesPage'));
const BrandsPage = lazy(() => import('@/pages/brands/BrandsPage'));
const InventoryPage = lazy(() => import('@/pages/inventory/InventoryPage'));

const OrdersListPage = lazy(() => import('@/pages/orders/OrdersPages').then((m) => ({ default: m.OrdersListPage })));
const OrderDetailPage = lazy(() => import('@/pages/orders/OrdersPages').then((m) => ({ default: m.OrderDetailPage })));

const ConsultationBookingsPage = lazy(() => import('@/pages/consultations/ConsultationBookingsPages').then((m) => ({ default: m.ConsultationBookingsPage })));
const KundliRequestsPage = lazy(() => import('@/pages/consultations/ConsultationBookingsPages').then((m) => ({ default: m.KundliRequestsPage })));
const ConsultationServicesAdminPage = lazy(() => import('@/pages/consultations/ConsultationServicesAdminPage'));

const PremiumKundliOrdersPage = lazy(() => import('@/pages/premiumKundli/PremiumKundliOrdersPage'));
const PremiumKundliSettingsPage = lazy(() => import('@/pages/premiumKundli/PremiumKundliSettingsPage'));
const PremiumHoroscopeSettingsPage = lazy(() => import('@/pages/premiumHoroscope/PremiumHoroscopeSettingsPage'));

const CouponsPage = lazy(() => import('@/pages/coupons/CouponsPage'));
const BlogAdminPage = lazy(() => import('@/pages/blog/BlogAdminPage'));
const BannersPage = lazy(() => import('@/pages/BannersPage'));
const PagesPage = lazy(() => import('@/pages/PagesPage'));
const AnnouncementsPage = lazy(() => import('@/pages/AnnouncementsPage'));
const TestimonialsPage = lazy(() => import('@/pages/TestimonialsPage'));
const InstagramFeedPage = lazy(() => import('@/pages/InstagramFeedPage'));
const FaqAdminPage = lazy(() => import('@/pages/FaqAdminPage'));
const EnquiriesPage = lazy(() => import('@/pages/EnquiriesPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const NewsletterPage = lazy(() => import('@/pages/NewsletterPage'));
const UsersPage = lazy(() => import('@/pages/UsersPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<DashboardPage />} />

            <Route path="/products" element={<ProductsListPage />} />
            <Route path="/products/new" element={<ProductFormPage />} />
            <Route path="/products/:id/edit" element={<ProductFormPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/brands" element={<BrandsPage />} />
            <Route path="/inventory" element={<InventoryPage />} />

            <Route path="/orders" element={<OrdersListPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />

            <Route path="/consultations" element={<ConsultationBookingsPage />} />
            <Route path="/consultations/kundli" element={<KundliRequestsPage />} />
            <Route path="/consultation-services" element={<ConsultationServicesAdminPage />} />

            <Route path="/premium-kundli/orders" element={<PremiumKundliOrdersPage />} />
            <Route path="/premium-kundli/settings" element={<PremiumKundliSettingsPage />} />
            <Route path="/premium-horoscope/settings" element={<PremiumHoroscopeSettingsPage />} />

            <Route path="/coupons" element={<CouponsPage />} />
            <Route path="/blog" element={<BlogAdminPage />} />
            <Route path="/banners" element={<BannersPage />} />
            <Route path="/pages" element={<PagesPage />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/testimonials" element={<TestimonialsPage />} />
            <Route path="/instagram-feed" element={<InstagramFeedPage />} />
            <Route path="/faq" element={<FaqAdminPage />} />
            <Route path="/enquiries" element={<EnquiriesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/newsletter" element={<NewsletterPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
