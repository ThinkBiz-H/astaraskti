import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { dashboardApi } from '@/api/endpoints/dashboard';
import { PageLoader, Badge } from '@/components/common/Elements';
import { formatCurrency, formatDate } from '@/utils/format';
import { Link } from 'react-router-dom';
import {
  IndianRupee, ShoppingBag, Users, Package, Sparkles, Star, AlertTriangle, Clock,
  CheckCircle2, XCircle, TrendingDown, Wallet,
} from 'lucide-react';

function StatCard({ icon: Icon, label, value, tone = 'gold' }) {
  const tones = {
    gold: 'bg-gold-50 text-gold-600',
    maroon: 'bg-maroon-700/10 text-maroon-700',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
  };
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className={`rounded-lg p-3 ${tones[tone]}`}><Icon size={22} /></div>
      <div>
        <p className="text-xs text-night-900/50">{label}</p>
        <p className="font-display text-2xl font-semibold">{value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({ queryKey: ['dashboard-stats'], queryFn: dashboardApi.stats });
  const { data: chart } = useQuery({ queryKey: ['sales-chart'], queryFn: () => dashboardApi.salesChart(30) });
  const { data: recentOrders } = useQuery({ queryKey: ['recent-orders'], queryFn: dashboardApi.recentOrders });
  const { data: recentBookings } = useQuery({ queryKey: ['recent-bookings'], queryFn: dashboardApi.recentConsultationBookings });
  const { data: lowStock } = useQuery({ queryKey: ['low-stock'], queryFn: () => dashboardApi.lowStock() });
  const { data: inventoryStats } = useQuery({ queryKey: ['dashboard-inventory-stats'], queryFn: dashboardApi.inventoryStats });

  if (isLoading) return <PageLoader />;
  const s = stats || {};

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={IndianRupee} label="Total Revenue" value={formatCurrency(s.revenue)} tone="gold" />
        <StatCard icon={ShoppingBag} label="Total Orders" value={s.totalOrders} tone="blue" />
        <StatCard icon={Users} label="Total Customers" value={s.totalCustomers} tone="green" />
        <StatCard icon={Package} label="Total Products" value={s.totalProducts} tone="maroon" />
        <StatCard icon={IndianRupee} label="Today's Sales" value={formatCurrency(s.todaySales)} tone="gold" />
        <StatCard icon={Sparkles} label="Consultation Bookings" value={s.totalConsultationBookings} tone="maroon" />
        <StatCard icon={IndianRupee} label="Consultation Revenue" value={formatCurrency(s.consultationRevenue)} tone="green" />
        <StatCard icon={Star} label="Today's Consultation Revenue" value={formatCurrency(s.todayConsultationRevenue)} tone="blue" />
      </div>

      <div>
        <h2 className="mb-3 flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-night-900/60">
          Inventory
          <Link to="/inventory" className="text-xs font-normal normal-case text-gold-600">View inventory</Link>
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard icon={Package} label="Total Products" value={inventoryStats?.totalProducts ?? '—'} tone="maroon" />
          <StatCard icon={CheckCircle2} label="Active Products" value={inventoryStats?.activeProducts ?? '—'} tone="green" />
          <StatCard icon={XCircle} label="Out of Stock" value={inventoryStats?.outOfStock ?? '—'} tone="maroon" />
          <StatCard icon={TrendingDown} label="Low Stock" value={inventoryStats?.lowStock ?? '—'} tone="gold" />
          <StatCard icon={Package} label="Total Inventory (units)" value={inventoryStats?.totalInventory ?? '—'} tone="blue" />
          <StatCard icon={Wallet} label="Inventory Value" value={inventoryStats ? formatCurrency(inventoryStats.inventoryValue) : '—'} tone="gold" />
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-night-900/60">Sales — Last 30 Days</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={(chart?.salesData || []).map((d) => ({ date: d._id, total: d.totalSales }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
            <XAxis dataKey="date" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Line type="monotone" dataKey="total" stroke="#D4AF52" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-night-900/60">Recent Orders</h2>
            <Link to="/orders" className="text-xs text-gold-600">View all</Link>
          </div>
          <div className="space-y-3">
            {(recentOrders?.orders || []).map((o) => (
              <div key={o._id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">#{o.orderNumber}</p>
                  <p className="text-xs text-night-900/40">{formatDate(o.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="info">{o.orderStatus}</Badge>
                  <span className="font-medium">{formatCurrency(o.grandTotal)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-night-900/60">Recent Consultation Bookings</h2>
            <Link to="/consultations" className="text-xs text-gold-600">View all</Link>
          </div>
          <div className="space-y-3">
            {(recentBookings?.bookings || []).map((b) => (
              <div key={b._id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{b.serviceSnapshot?.name}</p>
                  <p className="text-xs text-night-900/40">{b.user?.name || b.user?.mobile}</p>
                </div>
                <Badge tone={b.bookingStatus === 'Completed' ? 'success' : 'warning'}>{b.bookingStatus}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {lowStock?.products?.length > 0 && (
        <div className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-red-600">
            <AlertTriangle size={15} /> Low Stock Alerts
          </h2>
          <div className="space-y-2">
            {lowStock.products.slice(0, 6).map((p) => (
              <div key={p._id} className="flex items-center justify-between text-sm">
                <span>{p.title}</span>
                <Badge tone="danger">{p.stock} left</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
