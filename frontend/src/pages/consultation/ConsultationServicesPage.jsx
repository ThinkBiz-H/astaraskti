import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { consultationServicesApi } from '@/api/endpoints/consultations';
import SEO from '@/components/common/SEO';
import { PageLoader, AppImage } from '@/components/common/Elements';
import { Sparkles, Clock } from 'lucide-react';

export default function ConsultationServicesPage() {
  const { data, isLoading } = useQuery({ queryKey: ['consultation-services'], queryFn: () => consultationServicesApi.list({ limit: 50 }) });

  if (isLoading) return <PageLoader />;
  const services = data?.services || [];

  return (
    <>
      <SEO title="Astrology Consultations" description="Book Kundli Reading, Horoscope Matching, Gemstone and Vastu consultations with our expert astrologers." />
      <section className="bg-night-950 bg-star-field py-16 text-center text-ivory">
        <div className="container-page">
          <h1 className="font-display text-4xl">Consult Our Vedic Astrologers</h1>
          <p className="mx-auto mt-3 max-w-xl text-ivory/70">
            Personalised guidance rooted in tradition — choose a service below to get started.
          </p>
        </div>
      </section>

      <div className="container-page py-14">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((svc) => (
            <Link
              key={svc._id}
              // "kundli"/"horoscope" are instant guest-checkout PDF
              // purchases, not appointment bookings — send them straight to
              // their own flow rather than the consultation booking form
              // (which also requires login).
              to={svc.type === 'kundli' ? '/kundli' : svc.type === 'horoscope' ? '/horoscope' : `/consultation/${svc.slug}`}
              className="card group overflow-hidden"
            >
              {svc.image?.url && (
                <div className="aspect-video overflow-hidden bg-night-900/5">
                  <AppImage src={svc.image.url} alt={svc.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                </div>
              )}
              <div className="p-6">
                <Sparkles className="mb-3 text-gold-500" size={22} />
                <h2 className="font-display text-xl">{svc.name}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-night-900/60">{svc.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-night-900/50"><Clock size={13} /> {svc.duration} mins</span>
                  <span className="font-display text-xl font-semibold text-maroon-700">₹{svc.price}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
