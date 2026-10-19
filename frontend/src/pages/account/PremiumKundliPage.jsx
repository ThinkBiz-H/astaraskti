import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { premiumKundliApi } from '@/api/endpoints/consultations';
import { EmptyState, PageLoader, Badge } from '@/components/common/Elements';
import { formatDate } from '@/utils/format';
import SEO from '@/components/common/SEO';
import { Star, Download } from 'lucide-react';

const PAYMENT_TONE = { Pending: 'warning', Paid: 'success', Failed: 'danger' };
const KUNDLI_TONE = { Pending: 'default', Processing: 'info', Generated: 'success', Failed: 'danger' };

export default function PremiumKundliPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-premium-kundli-orders'],
    queryFn: () => premiumKundliApi.myOrders(),
    // Polls while any order is still in flight — same short-interval
    // pattern already established for Orders/Consultations this session.
    refetchInterval: (query) => {
      const orders = query.state.data?.orders || [];
      const hasActive = orders.some((o) => o.kundliStatus === 'Pending' || o.kundliStatus === 'Processing');
      return hasActive ? 8_000 : false;
    },
  });
  const orders = data?.orders || [];

  if (isLoading) return <PageLoader />;

  return (
    <>
      <SEO title="My Premium Kundli" noindex />
      <h1 className="mb-6 font-display text-2xl">My Premium Kundli</h1>

      {orders.length === 0 ? (
        <EmptyState icon={Star} title="No Premium Kundli orders yet" description="Get your personalized AI Kundli from the home page." action={<Link to="/" className="btn-primary mt-2">Explore</Link>} />
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o._id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">#{o.orderNumber}</p>
                  <p className="text-xs text-night-900/50">{formatDate(o.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={PAYMENT_TONE[o.paymentStatus] || 'default'}>{o.paymentStatus}</Badge>
                  <Badge tone={KUNDLI_TONE[o.kundliStatus] || 'default'}>{o.kundliStatus}</Badge>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-night-900/5 pt-3">
                <p className="text-xs text-night-900/50">
                  {o.kundliStatus === 'Generated' ? 'Your report is ready.' : o.kundliStatus === 'Processing' ? 'Your report is being prepared.' : o.kundliStatus === 'Failed' ? 'Generation failed — our team will follow up.' : 'Awaiting processing.'}
                </p>
                {o.pdfUrl ? (
                  <a href={o.pdfUrl} target="_blank" rel="noreferrer" className="btn-outline flex items-center gap-1.5 text-xs"><Download size={13} /> Download PDF</a>
                ) : (
                  <button disabled className="btn-outline flex items-center gap-1.5 text-xs opacity-40"><Download size={13} /> Not ready yet</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
