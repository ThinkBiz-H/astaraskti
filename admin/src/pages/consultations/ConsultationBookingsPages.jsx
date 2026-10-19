import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { consultationBookingsAdminApi } from '@/api/endpoints/orders';
import { PageHeader, PageLoader, Badge, EmptyState } from '@/components/common/Elements';
import { formatCurrency, formatDate } from '@/utils/format';
import { getErrorMessage } from '@/api/axiosClient';
import { Clock, User as UserIcon } from 'lucide-react';

const BOOKING_STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];
const STATUS_TONE = { Pending: 'warning', Confirmed: 'info', Completed: 'success', Cancelled: 'danger' };

function BookingCard({ booking, onUpdated, showBirthDetails = false }) {
  const queryClient = useQueryClient();
  const [meetingLink, setMeetingLink] = useState(booking.meetingLink || '');

  const statusMutation = useMutation({
    mutationFn: (payload) => consultationBookingsAdminApi.updateStatus(booking._id, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }); toast.success('Status updated'); onUpdated?.(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const paymentMutation = useMutation({
    mutationFn: (payload) => consultationBookingsAdminApi.updatePayment(booking._id, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }); toast.success('Payment status updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const kundli = booking.kundliDetails;

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{booking.serviceSnapshot?.name} — #{booking.bookingNumber}</p>
          <p className="flex items-center gap-1 text-xs text-night-900/50">
            <UserIcon size={12} /> {booking.user?.name || '—'} · {booking.user?.mobile}
          </p>
          <p className="flex items-center gap-1 text-xs text-night-900/50">
            <Clock size={12} /> {formatDate(booking.appointmentDate)} at {booking.appointmentTime} · {booking.meetingMode}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={booking.paymentStatus === 'Paid' ? 'success' : 'warning'}>{booking.paymentStatus}</Badge>
          <Badge tone={STATUS_TONE[booking.bookingStatus]}>{booking.bookingStatus}</Badge>
          <span className="font-display font-semibold">{formatCurrency(booking.amount)}</span>
        </div>
      </div>

      {showBirthDetails && kundli && (
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-md bg-night-900/[0.03] p-3 text-xs sm:grid-cols-4">
          <div><span className="text-night-900/40">Name:</span> {kundli.fullName}</div>
          <div><span className="text-night-900/40">Gender:</span> {kundli.gender}</div>
          <div><span className="text-night-900/40">DOB:</span> {formatDate(kundli.dob)}</div>
          <div><span className="text-night-900/40">Birth Time:</span> {kundli.birthTime}</div>
          <div className="col-span-2 sm:col-span-4"><span className="text-night-900/40">Birth Place:</span> {kundli.birthPlace}</div>
        </div>
      )}

      {booking.customerNotes && (
        <p className="mb-3 text-xs text-night-900/50"><strong>Notes:</strong> {booking.customerNotes}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={booking.bookingStatus}
          onChange={(e) => statusMutation.mutate({ bookingStatus: e.target.value })}
          className="input-field w-auto py-1.5 text-xs"
        >
          {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={booking.paymentStatus}
          onChange={(e) => paymentMutation.mutate({ paymentStatus: e.target.value })}
          className="input-field w-auto py-1.5 text-xs"
        >
          {['Pending', 'Paid', 'Failed', 'Refunded'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          value={meetingLink}
          onChange={(e) => setMeetingLink(e.target.value)}
          placeholder="Meeting link (Zoom/Google Meet)"
          className="input-field w-56 py-1.5 text-xs"
        />
        <button
          onClick={() => statusMutation.mutate({ bookingStatus: booking.bookingStatus, meetingLink })}
          className="btn-outline px-3 py-1.5 text-xs"
        >
          Save Link
        </button>
        {/* TODO(backend): no endpoint exists to upload/attach a Kundli PDF report
            to a booking, and no "assign astrologer" / "send WhatsApp" / "send
            email" actions exist either. Wire these buttons once the backend
            adds e.g. POST /admin/consultation-bookings/:id/report,
            PUT .../assign-astrologer, POST .../notify-whatsapp. */}
        <button disabled title="Not available — backend has no report-upload endpoint yet" className="btn-outline px-3 py-1.5 text-xs opacity-40">
          Upload Report (TODO)
        </button>
      </div>
    </div>
  );
}

function BookingsList({ filterFn, showBirthDetails }) {
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-bookings', statusFilter],
    queryFn: () => consultationBookingsAdminApi.list({ bookingStatus: statusFilter || undefined, limit: 100 }),
  });

  const bookings = (data?.bookings || []).filter(filterFn || (() => true));

  return (
    <div>
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field mb-4 max-w-xs">
        <option value="">All Statuses</option>
        {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {isLoading ? <PageLoader /> : bookings.length === 0 ? <EmptyState title="No bookings found" /> : (
        <div className="space-y-4">
          {bookings.map((b) => <BookingCard key={b._id} booking={b} showBirthDetails={showBirthDetails} />)}
        </div>
      )}
    </div>
  );
}

export function ConsultationBookingsPage() {
  return (
    <div>
      <PageHeader title="Consultation Bookings" description="Every booking across all services" />
      <BookingsList />
    </div>
  );
}

export function KundliRequestsPage() {
  return (
    <div>
      <PageHeader title="Kundli Requests" description="Every Kundli Reading booking, with full birth details" />
      <BookingsList filterFn={(b) => b.serviceSnapshot?.type === 'kundli'} showBirthDetails />
    </div>
  );
}
