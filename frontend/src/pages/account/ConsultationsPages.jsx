import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { consultationBookingsApi } from '@/api/endpoints/consultations';
import { EmptyState, PageLoader } from '@/components/common/Elements';
import { formatCurrency, formatDate } from '@/utils/format';
import SEO from '@/components/common/SEO';
import { Sparkles, FileText, Clock } from 'lucide-react';

const STATUS_COLORS = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Confirmed: 'bg-blue-100 text-blue-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700',
};

export function ConsultationsListPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['my-bookings'], queryFn: () => consultationBookingsApi.myBookings() });
  const bookings = data?.bookings || [];

  const cancelMutation = useMutation({
    mutationFn: (id) => consultationBookingsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      toast.success('Booking cancelled');
    },
  });

  if (isLoading) return <PageLoader />;
  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No consultations booked yet"
        action={<Link to="/consultation" className="btn-primary mt-2">Explore Services</Link>}
      />
    );
  }

  return (
    <>
      <SEO title="My Consultations" noindex />
      <h1 className="mb-6 font-display text-2xl">My Consultations</h1>
      <div className="space-y-4">
        {bookings.map((b) => (
          <div key={b._id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{b.serviceSnapshot?.name}</p>
                <p className="text-xs text-night-900/50">
                  #{b.bookingNumber} · {formatDate(b.appointmentDate)} at {b.appointmentTime} · {b.meetingMode}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[b.bookingStatus] || 'bg-night-900/10'}`}>
                  {b.bookingStatus}
                </span>
                <span className="font-display font-semibold">{formatCurrency(b.amount)}</span>
              </div>
            </div>
            {b.meetingLink && (
              <a href={b.meetingLink} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-gold-600">
                Join Meeting →
              </a>
            )}
            <div className="mt-3 flex gap-3 text-xs">
              {['Pending', 'Confirmed'].includes(b.bookingStatus) && (
                <button onClick={() => cancelMutation.mutate(b._id)} className="text-maroon-700">Cancel</button>
              )}
              {b.paymentStatus !== 'Paid' && (
                <Link to={`/consultation/booking/${b._id}/pay`} className="font-medium text-gold-600">Complete Payment</Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function KundliReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings', 'kundli'],
    queryFn: () => consultationBookingsApi.myBookings({ }),
  });
  const kundliBookings = (data?.bookings || []).filter((b) => b.serviceSnapshot?.type === 'kundli');

  if (isLoading) return <PageLoader />;
  if (kundliBookings.length === 0) {
    return <EmptyState icon={FileText} title="No Kundli reports yet" action={<Link to="/kundli" className="btn-primary mt-2">Book Kundli Reading</Link>} />;
  }

  return (
    <>
      <SEO title="Kundli Reports" noindex />
      <h1 className="mb-6 font-display text-2xl">Kundli Reports</h1>
      <div className="space-y-4">
        {kundliBookings.map((b) => (
          <div key={b._id} className="card flex items-center justify-between p-5">
            <div>
              <p className="font-medium">{b.kundliDetails?.fullName}</p>
              <p className="text-xs text-night-900/50">Booked on {formatDate(b.createdAt)} · #{b.bookingNumber}</p>
            </div>
            {/* TODO(backend): ConsultationBooking has no reportUrl/reportFiles field yet
                and no PDF-generation pipeline exists. Once the backend adds one
                (see API_DOCUMENTATION.md "Missing APIs" #6 / Kundli PDF Generation),
                swap this block for a real download button, e.g.:
                <a href={b.reportUrl} className="btn-outline"><Download size={14}/> Download PDF</a> */}
            {b.bookingStatus === 'Completed' ? (
              <span className="flex items-center gap-2 text-xs text-night-900/50">
                <Clock size={14} /> Report pending upload by admin
              </span>
            ) : (
              <span className="text-xs text-night-900/40">Awaiting consultation</span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
