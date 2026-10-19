import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { premiumKundliApi } from '@/api/endpoints/consultations';
import { formatCurrency } from '@/utils/format';
import { Sparkles, CheckCircle2 } from 'lucide-react';

// Pure teaser — no auth check, no form, no payment logic here at all.
// Clicking through always goes to the public /kundli page (see
// pages/kundli/PremiumKundliPage.jsx), which is where the actual guest
// checkout flow lives. Premium Kundli is a FIXED service — title/
// description/features are hardcoded here, not admin-editable; only the
// price is fetched.
const FEATURES = ['Detailed planetary positions', 'Personalised birth chart', 'Instant PDF, emailed automatically'];

export default function PremiumKundliSection() {
  const { data } = useQuery({ queryKey: ['premium-kundli-settings'], queryFn: premiumKundliApi.getSettings });
  const settings = data?.settings;
  if (!settings) return null;

  const price = settings.salePrice > 0 ? settings.salePrice : settings.originalPrice;
  const hasDiscount = settings.salePrice > 0 && settings.salePrice < settings.originalPrice;

  return (
    <section className="container-page py-16">
      <div className="overflow-hidden rounded-xl border border-gold-400/30 bg-gradient-to-br from-night-950 via-night-900 to-maroon-900 text-ivory shadow-lg">
        <div className="grid grid-cols-1 items-center gap-8 p-8 lg:grid-cols-2 lg:p-14">
          <div>
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-gold-400/20 px-3 py-1 text-xs font-medium text-gold-300">
              <Sparkles size={12} /> Premium AI Kundli
            </span>
            <h2 className="font-display text-3xl leading-tight sm:text-4xl">Your Kundli, Generated Instantly</h2>
            <p className="mt-3 text-ivory/70">An AI-generated Vedic Kundli report — delivered as a PDF within minutes.</p>
            <ul className="mt-6 grid grid-cols-1 gap-2.5 text-sm text-ivory/80 sm:grid-cols-1">
              {FEATURES.map((f, i) => (
                <li key={i} className="flex items-center gap-2"><CheckCircle2 size={15} className="shrink-0 text-gold-400" /> {f}</li>
              ))}
            </ul>
            <div className="mt-7 flex items-baseline gap-3">
              <span className="font-display text-3xl text-gold-300">{formatCurrency(price)}</span>
              {hasDiscount && <span className="text-ivory/40 line-through">{formatCurrency(settings.originalPrice)}</span>}
            </div>
            <Link to="/kundli" className="btn-gold mt-6 inline-block">Get Premium Kundli</Link>
          </div>
          <div className="relative mx-auto flex aspect-square w-full max-w-xs items-center justify-center rounded-full border border-gold-400/20 bg-white/5 lg:max-w-sm">
            <div className="absolute inset-6 rounded-full border border-gold-400/15" />
            <Sparkles size={64} className="text-gold-400/60" />
          </div>
        </div>
      </div>
    </section>
  );
}
