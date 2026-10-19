import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { consultationBookingsApi } from '@/api/endpoints/consultations';
import { useRazorpay } from '@/hooks/useRazorpay';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { getErrorMessage } from '@/api/axiosClient';
import { RAZORPAY_KEY_ID } from '@/utils/constants';
import { PageLoader } from '@/components/common/Elements';
import { CheckCircle2, PartyPopper } from 'lucide-react';
import SEO from '@/components/common/SEO';
import { formatCurrency, formatDate } from '@/utils/format';

export function BookingPaymentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector(selectCurrentUser);
  const { openCheckout } = useRazorpay();
  const [processing, setProcessing] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['booking', id], queryFn: () => consultationBookingsApi.getById(id) });
  const booking = data?.booking;

  const handlePay = async () => {
    setProcessing(true);
    try {
      const order = await consultationBookingsApi.createPaymentOrder(id, 'razorpay');
      await openCheckout({
        key: RAZORPAY_KEY_ID,
        amount: Math.round(order.amount * 100),
        currency: order.currency,
        order_id: order.gatewayOrderId,
        name: 'Astro Sanatan Shakti',
        description: booking?.serviceSnapshot?.name,
        prefill: { name: user?.name, contact: booking?.contactMobile },
        theme: { color: '#7A1F2B' },
        handler: async (response) => {
          await consultationBookingsApi.verifyPayment(id, {
            gatewayOrderId: response.razorpay_order_id,
            gatewayPaymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          });
          toast.success('Payment successful!');
          navigate(`/consultation/booking/${id}/success`);
        },
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setProcessing(false);
    }
  };

  if (isLoading) return <PageLoader />;
  if (!booking) return null;

  return (
    <>
      <SEO title="Complete Payment" noindex />
      <div className="container-page flex min-h-[60vh] items-center justify-center py-16">
        <div className="card w-full max-w-md p-8 text-center">
          <h1 className="mb-2 font-display text-2xl">Complete Your Payment</h1>
          <p className="mb-6 text-sm text-night-900/60">{booking.serviceSnapshot?.name} · #{booking.bookingNumber}</p>
          <p className="mb-6 font-display text-3xl text-maroon-700">{formatCurrency(booking.amount)}</p>
          <button onClick={handlePay} disabled={processing} className="btn-primary w-full">
            {processing ? 'Processing...' : 'Pay Now'}
          </button>
        </div>
      </div>
    </>
  );
}

export function BookingSuccessPage() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['booking', id], queryFn: () => consultationBookingsApi.getById(id) });
  const booking = data?.booking;

  if (isLoading) return <PageLoader />;

  return (
    <>
      <SEO title="Booking Confirmed" noindex />
      <div className="container-page flex min-h-[60vh] items-center justify-center py-16">
        <div className="card w-full max-w-lg p-8 text-center">
          <PartyPopper className="mx-auto mb-4 text-gold-500" size={48} />
          <h1 className="mb-2 font-display text-3xl">Booking Confirmed!</h1>
          <p className="mb-6 text-sm text-night-900/60">
            Your {booking?.serviceSnapshot?.name} consultation is booked for{' '}
            {booking && formatDate(booking.appointmentDate)} at {booking?.appointmentTime}.
          </p>
          <div className="mb-6 flex items-center justify-center gap-2 text-sm text-green-700">
            <CheckCircle2 size={18} /> Payment received — booking #{booking?.bookingNumber}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/account/consultations" className="btn-primary flex-1">View My Consultations</Link>
            <Link to="/shop" className="btn-outline flex-1">Continue Shopping</Link>
          </div>
        </div>
      </div>
    </>
  );
}
