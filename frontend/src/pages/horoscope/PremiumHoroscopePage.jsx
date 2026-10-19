import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { premiumHoroscopeApi } from '@/api/endpoints/consultations';
import { useRazorpay } from '@/hooks/useRazorpay';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { getErrorMessage } from '@/api/axiosClient';
import { formatCurrency } from '@/utils/format';
import { RAZORPAY_KEY_ID } from '@/utils/constants';
import { PageLoader, AppImage } from '@/components/common/Elements';
import SEO from '@/components/common/SEO';
import { Sparkles, CheckCircle2, Circle, Loader2 } from 'lucide-react';

// Cloned from pages/kundli/PremiumKundliPage.jsx — same architecture,
// coding style and flow, sourcing all content dynamically from
// GET /horoscope/settings (same GET/UPDATE API pattern as Premium Kundli's
// settings — see horoscope.controller.js). Nothing here is hardcoded.
const EMPTY_FORM = { fullName: '', gender: '', email: '', mobile: '', dob: '', birthTime: '', birthPlace: '' };

// /horoscope must never render "not available" or an empty page — if the
// settings API call itself fails, the form still renders using these
// defaults so a customer can still pay and the order still gets created.
const DEFAULT_SETTINGS = {
  isActive: true,
  title: 'Premium AI Horoscope',
  subtitle: '',
  description: '',
  features: [],
  originalPrice: 999,
  salePrice: null,
  gstPercent: 0,
  deliveryText: '',
  buttonText: 'Get Premium Horoscope',
  banner: null,
  seo: {},
};

const PROGRESS_STEPS = [
  'Payment Verified',
  'Preparing Birth Chart',
  'Calculating Planetary Positions',
  'Generating PDF',
  'Sending Email',
];
const STEP_INTERVAL_MS = 1400;

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

function GeneratingScreen({ stepIndex }) {
  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-sm text-center">
        <Loader2 className="mx-auto mb-6 animate-spin text-gold-500" size={40} />
        <h1 className="font-display text-2xl">Generating Your Horoscope…</h1>
        <p className="mt-2 text-sm text-night-900/50">This usually takes under a minute. Please don't close this page.</p>

        <div className="card mt-8 space-y-3 p-6 text-left">
          {PROGRESS_STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              {i < stepIndex ? (
                <CheckCircle2 size={18} className="shrink-0 text-green-600" />
              ) : i === stepIndex ? (
                <Loader2 size={18} className="shrink-0 animate-spin text-gold-500" />
              ) : (
                <Circle size={18} className="shrink-0 text-night-900/20" />
              )}
              <span className={i <= stepIndex ? 'text-night-900' : 'text-night-900/40'}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PremiumHoroscopePage() {
  const navigate = useNavigate();
  const user = useSelector(selectCurrentUser); // only ever read for prefill — never gates anything
  const { openCheckout } = useRazorpay();
  const { data, isLoading } = useQuery({ queryKey: ['premium-horoscope-settings'], queryFn: premiumHoroscopeApi.getSettings, retry: 2 });
  const settings = data?.settings || DEFAULT_SETTINGS;

  const [form, setForm] = useState({ ...EMPTY_FORM, fullName: user?.name || '', email: user?.email || '', mobile: user?.mobile || '' });
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const stepTimerRef = useRef(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  useEffect(() => () => clearInterval(stepTimerRef.current), []);

  // Resolves birthPlace -> lat/lon/timezone BEFORE payment (debounced) —
  // reuses the exact same /kundli/geocode endpoint PremiumKundliPage.jsx
  // uses, since place resolution has nothing Kundli-specific about it.
  const [placeStatus, setPlaceStatus] = useState('idle'); // idle | checking | verified | error
  const [placeError, setPlaceError] = useState('');
  const resolvedCoordsRef = useRef(null);

  useEffect(() => {
    setPlaceStatus('idle');
    setPlaceError('');
    resolvedCoordsRef.current = null;
    if (!form.birthPlace?.trim() || !form.dob || !form.birthTime) return;

    const timer = setTimeout(async () => {
      setPlaceStatus('checking');
      try {
        const result = await premiumHoroscopeApi.geocode({ birthPlace: form.birthPlace, dob: form.dob, birthTime: form.birthTime });
        resolvedCoordsRef.current = { latitude: result.latitude, longitude: result.longitude, timezoneOffset: result.timezoneOffset };
        setPlaceStatus('verified');
      } catch (err) {
        setPlaceStatus('error');
        setPlaceError(getErrorMessage(err));
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [form.birthPlace, form.dob, form.birthTime]);

  if (isLoading) return <PageLoader />;

  if (generating) return <GeneratingScreen stepIndex={stepIndex} />;

  const basePrice = settings.salePrice > 0 ? settings.salePrice : settings.originalPrice;
  const hasDiscount = settings.salePrice > 0 && settings.salePrice < settings.originalPrice;
  const gst = Math.round(basePrice * (settings.gstPercent / 100) * 100) / 100;
  const total = Math.round((basePrice + gst) * 100) / 100;

  const requiredOk = form.fullName && form.gender && form.email && /^[0-9]{10}$/.test(form.mobile) && form.dob && form.birthTime && form.birthPlace && placeStatus === 'verified';

  const finishWithOrder = async (freshOrder) => {
    clearInterval(stepTimerRef.current);
    setStepIndex(PROGRESS_STEPS.length);

    if (freshOrder.pdfUrl) {
      try {
        await downloadPdf(freshOrder.pdfUrl, `Horoscope-${freshOrder.orderNumber}.pdf`);
      } catch {
        // Non-fatal — the customer still has the email copy.
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    navigate('/horoscope/success', { state: { order: freshOrder } });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (placeStatus === 'checking') return toast.error('Still verifying your birth place — one moment');
    if (!requiredOk) return toast.error('Please fill all required fields correctly');

    const payload = { ...form, ...(resolvedCoordsRef.current || {}) };

    // Real Razorpay only — no test-mode bypass of any kind on this page.
    setSubmitting(true);
    try {
      const { order, gatewayOrder } = await premiumHoroscopeApi.createOrder(payload);

      await openCheckout({
        key: RAZORPAY_KEY_ID,
        amount: Math.round(gatewayOrder.amount * 100),
        currency: gatewayOrder.currency,
        order_id: gatewayOrder.gatewayOrderId,
        name: 'Astro Sanatan Shakti',
        description: settings.title,
        prefill: { name: form.fullName, email: form.email, contact: form.mobile },
        theme: { color: '#7A1F2B' },
        handler: async (response) => {
          setGenerating(true);
          setStepIndex(1);
          stepTimerRef.current = setInterval(() => {
            setStepIndex((i) => Math.min(i + 1, PROGRESS_STEPS.length - 1));
          }, STEP_INTERVAL_MS);

          try {
            const { order: freshOrder } = await premiumHoroscopeApi.verifyPayment({
              orderId: order._id,
              gatewayOrderId: response.razorpay_order_id,
              gatewayPaymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });

            await finishWithOrder(freshOrder);
          } catch (err) {
            clearInterval(stepTimerRef.current);
            setGenerating(false);
            toast.error(getErrorMessage(err));
          }
        },
        modal: {
          ondismiss: () => toast.error('Payment not completed — you can try again anytime.'),
        },
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEO title={settings.seo?.metaTitle || settings.title} description={settings.seo?.metaDescription || settings.subtitle} />
      <div className="container-page py-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
          <div>
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-gold-50 px-3 py-1 text-xs font-medium text-gold-600">
              <Sparkles size={12} /> Premium AI Horoscope
            </span>
            <h1 className="font-display text-3xl">{settings.title}</h1>
            {settings.subtitle && <p className="mt-2 text-night-900/60">{settings.subtitle}</p>}
            {settings.description && <p className="mt-4 text-sm text-night-900/70">{settings.description}</p>}
            {settings.features?.length > 0 && (
              <ul className="mt-6 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {settings.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-1.5"><CheckCircle2 size={14} className="shrink-0 text-gold-500" /> {f}</li>
                ))}
              </ul>
            )}
            {settings.banner?.url && <AppImage src={settings.banner.url} alt={settings.title} className="mt-8 w-full rounded-lg object-cover" />}
          </div>

          <div className="card h-fit space-y-4 p-6">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-2xl text-maroon-700">{formatCurrency(total)}</span>
              {hasDiscount && <span className="text-night-900/40 line-through">{formatCurrency(settings.originalPrice)}</span>}
            </div>
            {gst > 0 && <p className="text-xs text-night-900/40">Incl. GST ({settings.gstPercent}%) — {formatCurrency(gst)}</p>}
            {settings.deliveryText && <p className="text-xs text-night-900/50">{settings.deliveryText}</p>}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3">
              <input value={form.fullName} onChange={set('fullName')} placeholder="Full Name *" className="input-field" required />
              <select value={form.gender} onChange={set('gender')} className="input-field" required>
                <option value="">Gender *</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={form.dob} onChange={set('dob')} className="input-field" required />
                <input type="time" value={form.birthTime} onChange={set('birthTime')} className="input-field" required />
              </div>
              <div>
                <input value={form.birthPlace} onChange={set('birthPlace')} placeholder="Place of Birth *" className="input-field" required />
                {placeStatus === 'checking' && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-night-900/50"><Loader2 size={12} className="animate-spin" /> Verifying place…</p>
                )}
                {placeStatus === 'verified' && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-green-600"><CheckCircle2 size={12} /> Place verified</p>
                )}
                {placeStatus === 'error' && (
                  <p className="mt-1 text-xs text-maroon-700">{placeError}</p>
                )}
              </div>
              <input type="email" value={form.email} onChange={set('email')} placeholder="Email *" className="input-field" required />
              <input value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="Mobile *" className="input-field" required />

              <button type="submit" disabled={submitting || placeStatus === 'checking'} className="btn-primary mt-1 disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? 'Processing…' : 'Pay ' + formatCurrency(total)}
              </button>
              <p className="text-center text-xs text-night-900/40">No account needed — pay as a guest.</p>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
