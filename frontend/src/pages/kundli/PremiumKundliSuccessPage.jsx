import { useLocation, Link, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import SEO from '@/components/common/SEO';
import { getErrorMessage } from '@/api/axiosClient';
import { CheckCircle2, Download, Clock, AlertTriangle } from 'lucide-react';

const downloadPdf = async (url, filename) => {
  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(objectUrl);
};

// Public — no auth check, no ProtectedRoute. Reads the order handed off by
// PremiumKundliPage's navigate() call (the fresh, post-generation order —
// by the time this page renders, generation has already completed inside
// the single verifyPayment request, and the PDF has already auto-downloaded
// once; this page just confirms that and offers a manual re-download).
export default function PremiumKundliSuccessPage() {
  const { state } = useLocation();
  const order = state?.order;

  if (!order) return <Navigate to="/kundli" replace />;

  const handleRedownload = async () => {
    try {
      await downloadPdf(order.pdfUrl, `Kundli-${order.orderNumber}.pdf`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <SEO title="Order Confirmed" noindex />
      <div className="container-page flex min-h-[60vh] items-center justify-center py-16">
        <div className="w-full max-w-md text-center">
          {order.pdfUrl ? (
            <>
              <CheckCircle2 className="mx-auto mb-4 text-green-600" size={48} />
              <h1 className="font-display text-2xl">Kundli Generated!</h1>
              <div className="card mt-6 space-y-3 p-6 text-left text-sm">
                <div className="flex items-center gap-2"><CheckCircle2 size={16} className="shrink-0 text-green-600" /> Payment Successful</div>
                <div className="flex items-center gap-2"><CheckCircle2 size={16} className="shrink-0 text-green-600" /> Kundli Generated Successfully</div>
                <div className="flex items-center gap-2"><CheckCircle2 size={16} className="shrink-0 text-green-600" /> Your Kundli PDF has been downloaded automatically.</div>
                <div className="flex items-center gap-2"><CheckCircle2 size={16} className="shrink-0 text-green-600" /> A copy of the Kundli has also been sent to your registered email address.</div>
              </div>
              <div className="card mt-4 p-6">
                <button onClick={handleRedownload} className="btn-primary flex w-full items-center justify-center gap-2">
                  <Download size={16} /> Download Again
                </button>
              </div>
            </>
          ) : order.kundliStatus === 'Failed' ? (
            <>
              <AlertTriangle className="mx-auto mb-4 text-red-600" size={48} />
              <h1 className="font-display text-2xl">Payment Received</h1>
              <p className="mt-3 text-sm text-night-900/70">
                Your payment was successful, but we hit a snag generating your Kundli. Our team has been notified and will email your report to <strong>{order.email}</strong> shortly.
              </p>
            </>
          ) : (
            <>
              <CheckCircle2 className="mx-auto mb-4 text-green-600" size={48} />
              <h1 className="font-display text-2xl">Payment Successful!</h1>
              <div className="card mt-6 space-y-3 p-6 text-left">
                <div className="flex items-center gap-2 rounded-sm bg-gold-50 p-3 text-sm text-night-900/70">
                  <Clock size={16} className="shrink-0 text-gold-600" />
                  Your report is being prepared. We'll email it to <strong>{order.email}</strong> as soon as it's ready.
                </div>
              </div>
            </>
          )}

          <p className="mt-4 text-xs text-night-900/50">
            Order <strong>#{order.orderNumber}</strong> — thank you, {order.fullName}.
          </p>

          <Link to="/" className="mt-6 inline-block text-sm text-gold-600 hover:underline">Continue Browsing →</Link>
        </div>
      </div>
    </>
  );
}
