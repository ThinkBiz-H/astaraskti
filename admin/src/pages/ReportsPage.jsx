import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { dashboardApi, reportsApi } from '@/api/endpoints/dashboard';
import { PageHeader, PageLoader } from '@/components/common/Elements';
import { formatCurrency } from '@/utils/format';
import { getErrorMessage } from '@/api/axiosClient';
import { Download } from 'lucide-react';

const REPORT_TYPES = [
  { value: 'sales', label: 'Sales Report' },
  { value: 'revenue', label: 'Revenue Report' },
  { value: 'orders', label: 'Orders Report' },
  { value: 'customers', label: 'Customers Report' },
  { value: 'products', label: 'Products Report' },
  { value: 'inventory', label: 'Inventory Report' },
  { value: 'coupons', label: 'Coupon Report' },
  { value: 'tax', label: 'GST / Tax Report' },
  { value: 'profit', label: 'Profit Report (revenue-only — no cost-price data tracked)' },
  { value: 'refunds', label: 'Refund Report' },
  { value: 'returns', label: 'Return Report' },
];

const DATE_PRESETS = ['Today', 'Yesterday', 'Last 7 Days', 'This Month', 'This Year', 'Custom'];

const toISODate = (d) => d.toISOString().slice(0, 10);

const resolveRange = (preset, customFrom, customTo) => {
  const now = new Date();
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

  switch (preset) {
    case 'Today':
      return { from: toISODate(startOfDay(now)), to: toISODate(now) };
    case 'Yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: toISODate(startOfDay(y)), to: toISODate(y) };
    }
    case 'Last 7 Days': {
      const start = new Date(now); start.setDate(start.getDate() - 6);
      return { from: toISODate(startOfDay(start)), to: toISODate(now) };
    }
    case 'This Month':
      return { from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), to: toISODate(now) };
    case 'This Year':
      return { from: toISODate(new Date(now.getFullYear(), 0, 1)), to: toISODate(now) };
    case 'Custom':
      return { from: customFrom, to: customTo };
    default:
      return {};
  }
};

const PIE_COLORS = ['#D4AF52', '#7A1F2B', '#1F2937', '#6B7280', '#B45309', '#065F46'];

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState('sales');
  const [format, setFormat] = useState('csv');
  const [preset, setPreset] = useState('Last 7 Days');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [downloading, setDownloading] = useState(false);

  const { data: topProductsData, isLoading: loadingTop } = useQuery({ queryKey: ['reports-top-products'], queryFn: dashboardApi.topProducts });
  const { data: topCustomersData } = useQuery({ queryKey: ['reports-top-customers'], queryFn: dashboardApi.topCustomers });
  const { data: categoryData } = useQuery({ queryKey: ['reports-category-analytics'], queryFn: dashboardApi.categoryAnalytics });
  const { data: monthlyData, isLoading: loadingMonthly } = useQuery({ queryKey: ['reports-monthly-revenue'], queryFn: () => dashboardApi.monthlyRevenue(12) });

  const range = useMemo(() => resolveRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const params = { format };
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      const { blob, filename } = await reportsApi.download(reportType, params);
      downloadBlob(blob, filename);
      toast.success('Report downloaded');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const topProducts = topProductsData?.topProducts || [];
  const topCustomers = topCustomersData?.topCustomers || [];
  const categories = categoryData?.categoryAnalytics || [];
  const monthly = (monthlyData?.monthlyRevenue || []).map((m) => ({ month: m._id, revenue: m.totalRevenue }));

  return (
    <div className="space-y-8">
      <PageHeader title="Reports" description="Export detailed reports and review performance analytics — all figures come straight from the database." />

      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-night-900/60">Export Report</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="input-field">
            {REPORT_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <select value={preset} onChange={(e) => setPreset(e.target.value)} className="input-field">
            {DATE_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="input-field">
            <option value="csv">CSV</option>
            <option value="excel">Excel</option>
          </select>
          <button onClick={handleDownload} disabled={downloading} className="btn-primary flex items-center justify-center gap-2">
            <Download size={15} /> {downloading ? 'Downloading…' : 'Download'}
          </button>
        </div>
        {preset === 'Custom' && (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:w-1/2">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="input-field" />
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="input-field" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-night-900/60">Top Products (by units sold)</h2>
          {loadingTop ? <PageLoader /> : topProducts.length === 0 ? <p className="text-sm text-night-900/40">No sales data yet</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topProducts.slice(0, 8)} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="title" fontSize={10} width={120} tickFormatter={(v) => (v.length > 16 ? `${v.slice(0, 16)}…` : v)} />
                <Tooltip />
                <Bar dataKey="totalSold" fill="#D4AF52" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-night-900/60">Revenue by Category</h2>
          {categories.length === 0 ? <p className="text-sm text-night-900/40">No sales data yet</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={categories} dataKey="totalRevenue" nameKey="categoryName" outerRadius={90} label={(d) => d.categoryName}>
                  {categories.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-night-900/60">Monthly Revenue Trend (12 months)</h2>
        {loadingMonthly ? <PageLoader /> : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#7A1F2B" strokeWidth={2} dot={false} name="Revenue" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card overflow-hidden">
        <h2 className="p-6 pb-0 text-sm font-semibold uppercase tracking-wide text-night-900/60">Top Customers (by lifetime spend)</h2>
        {topCustomers.length === 0 ? <p className="p-6 text-sm text-night-900/40">No customer data yet</p> : (
          <table className="mt-4 w-full">
            <thead><tr className="table-head"><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Total Spent</th></tr></thead>
            <tbody>
              {topCustomers.map((c) => (
                <tr key={c.userId} className="table-row">
                  <td className="px-4 py-3">{c.name}<div className="text-xs text-night-900/40">{c.email}</div></td>
                  <td className="px-4 py-3">{c.orderCount}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(c.totalSpent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
