import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cmsApi } from '@/api/endpoints/misc';
import { Facebook, Instagram, Youtube, Mail, Phone } from 'lucide-react';

export default function Footer() {
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: cmsApi.getSettings, staleTime: 5 * 60_000 });
  const s = settings?.settings;

  return (
    <footer className="bg-night-950 text-ivory/80">
      <div className="container-page grid grid-cols-1 gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h3 className="mb-3 font-display text-xl text-ivory">{s?.general?.siteName || 'Astro Sanatan Shakti'}</h3>
          <p className="text-sm text-ivory/60">
            {s?.general?.tagline || 'Authentic Vedic astrology consultations and sacred products, rooted in tradition.'}
          </p>
          <div className="mt-4 flex gap-3 text-ivory/60">
            {s?.social?.facebook && <a href={s.social.facebook} aria-label="Facebook"><Facebook size={18} /></a>}
            {s?.social?.instagram && <a href={s.social.instagram} aria-label="Instagram"><Instagram size={18} /></a>}
            {s?.social?.youtube && <a href={s.social.youtube} aria-label="YouTube"><Youtube size={18} /></a>}
          </div>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gold-300">Shop</h4>
          <ul className="space-y-2 text-sm text-ivory/60">
            <li><Link to="/shop?category=rudraksha">Rudraksha</Link></li>
            <li><Link to="/shop?category=gemstones">Gemstones</Link></li>
            <li><Link to="/shop?category=malas">Malas</Link></li>
            <li><Link to="/shop?category=bracelets">Bracelets</Link></li>
            <li><Link to="/shop?category=yantras">Yantras</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gold-300">Consultation</h4>
          <ul className="space-y-2 text-sm text-ivory/60">
            <li><Link to="/kundli">Kundli Reading</Link></li>
            <li><Link to="/consultation/horoscope-matching">Horoscope Matching</Link></li>
            <li><Link to="/consultation/gemstone-consultation">Gemstone Consultation</Link></li>
            <li><Link to="/consultation/vastu-consultation">Vastu Consultation</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gold-300">Company</h4>
          <ul className="space-y-2 text-sm text-ivory/60">
            <li><Link to="/about">About Us</Link></li>
            <li><Link to="/contact">Contact</Link></li>
            <li><Link to="/blog">Blog</Link></li>
            <li><Link to="/policies/privacy-policy">Privacy Policy</Link></li>
            <li><Link to="/policies/terms">Terms &amp; Conditions</Link></li>
            <li><Link to="/policies/refund-policy">Refund Policy</Link></li>
            <li><Link to="/policies/shipping-policy">Shipping Policy</Link></li>
          </ul>
          <div className="mt-4 space-y-1.5 text-sm text-ivory/60">
            {s?.contact?.supportEmail && (
              <p className="flex items-center gap-2"><Mail size={14} /> {s.contact.supportEmail}</p>
            )}
            {s?.contact?.supportPhone && (
              <p className="flex items-center gap-2"><Phone size={14} /> {s.contact.supportPhone}</p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 py-4 text-center text-xs text-ivory/40">
        © {new Date().getFullYear()} {s?.general?.siteName || 'Astro Sanatan Shakti'}. All rights reserved.
      </div>
    </footer>
  );
}
