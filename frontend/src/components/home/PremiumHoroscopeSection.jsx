import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { premiumHoroscopeApi } from '@/api/endpoints/consultations';
import { AppImage } from '@/components/common/Elements';
import { formatCurrency } from '@/utils/format';
import { Moon, CheckCircle2 } from 'lucide-react';

// Structurally identical to components/home/PremiumKundliSection.jsx —
// same classes/spacing/layout/hover/shadow, reused as-is. Unlike Kundli's
// card (which still hardcodes its title/description/features), every piece
// of content here comes from GET /horoscope/settings — nothing hardcoded
// except the icon (Moon, vs Kundli's Sparkles — the one deliberate
// per-service difference) and the fallback copy used only while settings
// are loading/unavailable. Pure teaser — no auth check, no form, no
// payment logic; clicking through always goes to /horoscope.
export default function PremiumHoroscopeSection() {
  const { data } = useQuery({ queryKey: ['premium-horoscope-settings'], queryFn: premiumHoroscopeApi.getSettings });
  const settings = data?.settings;
  if (!settings) return null;

  const price = settings.salePrice > 0 ? settings.salePrice : settings.originalPrice;
  const hasDiscount = settings.salePrice > 0 && settings.salePrice < settings.originalPrice;
  const description = settings.subtitle || settings.description;

  return (
    <section className="container-page py-16">
      <div className="overflow-hidden rounded-xl border border-gold-400/30 bg-gradient-to-br from-night-950 via-night-900 to-maroon-900 text-ivory shadow-lg">
        <div className="grid grid-cols-1 items-center gap-8 p-8 lg:grid-cols-2 lg:p-14">
          <div>
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-gold-400/20 px-3 py-1 text-xs font-medium text-gold-300">
              <Moon size={12} /> Premium AI Horoscope
            </span>
            <h2 className="font-display text-3xl leading-tight sm:text-4xl">{settings.title}</h2>
            {description && <p className="mt-3 text-ivory/70">{description}</p>}
            {settings.features?.length > 0 && (
              <ul className="mt-6 grid grid-cols-1 gap-2.5 text-sm text-ivory/80 sm:grid-cols-1">
                {settings.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2"><CheckCircle2 size={15} className="shrink-0 text-gold-400" /> {f}</li>
                ))}
              </ul>
            )}
            <div className="mt-7 flex items-baseline gap-3">
              <span className="font-display text-3xl text-gold-300">{formatCurrency(price)}</span>
              {hasDiscount && <span className="text-ivory/40 line-through">{formatCurrency(settings.originalPrice)}</span>}
            </div>
            <Link to="/horoscope" className="btn-gold mt-6 inline-block">{settings.buttonText || 'Get Premium Horoscope'}</Link>
          </div>
          {settings.banner?.url ? (
            <AppImage
              src={settings.banner.url}
              alt={settings.title}
              className="mx-auto aspect-square w-full max-w-xs rounded-full object-cover lg:max-w-sm"
            />
          ) : (
            <div className="relative mx-auto flex aspect-square w-full max-w-xs items-center justify-center rounded-full border border-gold-400/20 bg-white/5 lg:max-w-sm">
              <div className="absolute inset-6 rounded-full border border-gold-400/15" />
              <Moon size={64} className="text-gold-400/60" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
