import SEO from '@/components/common/SEO';
import { Sparkles, Users, Award } from 'lucide-react';

export default function AboutPage() {
  return (
    <>
      <SEO title="About Us" description="Our story, mission and the astrologers behind Astro Sanatan Shakti." />
      <section className="bg-night-950 bg-star-field py-16 text-center text-ivory">
        <div className="container-page">
          <h1 className="font-display text-4xl">Our Story</h1>
          <p className="mx-auto mt-3 max-w-xl text-ivory/70">
            Rooted in centuries-old Vedic tradition, guided by modern trust and transparency.
          </p>
        </div>
      </section>
      <div className="container-page grid grid-cols-1 gap-10 py-14 sm:grid-cols-3">
        {[
          { icon: Sparkles, title: 'Authentic Wisdom', desc: 'Every reading is grounded in classical Vedic astrology texts.' },
          { icon: Users, title: 'Expert Astrologers', desc: 'Our team brings decades of combined consultation experience.' },
          { icon: Award, title: 'Trusted by Thousands', desc: 'Serving devotees and seekers across India and abroad.' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="text-center">
            <Icon className="mx-auto mb-3 text-gold-500" size={32} />
            <h3 className="font-display text-xl">{title}</h3>
            <p className="mt-2 text-sm text-night-900/60">{desc}</p>
          </div>
        ))}
      </div>
    </>
  );
}
