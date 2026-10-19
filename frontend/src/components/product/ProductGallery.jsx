import { useState } from 'react';
import { AppImage } from '@/components/common/Elements';

export function ProductGallery({ images = [], title }) {
  const [active, setActive] = useState(0);
  const [zoomStyle, setZoomStyle] = useState({});
  const [isZooming, setIsZooming] = useState(false);

  const handleMouseMove = (e) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomStyle({ transformOrigin: `${x}% ${y}%` });
  };

  if (!images.length) {
    return <div className="aspect-square w-full bg-night-900/5" />;
  }

  return (
    <div className="flex flex-col-reverse gap-4 sm:flex-row">
      <div className="flex gap-3 overflow-x-auto sm:w-20 sm:flex-col sm:overflow-visible">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`h-16 w-16 shrink-0 overflow-hidden border-2 ${active === i ? 'border-gold-500' : 'border-transparent'}`}
          >
            <AppImage src={img.url} alt={`${title} ${i + 1}`} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      <div
        className="relative flex-1 overflow-hidden bg-night-900/5"
        onMouseEnter={() => setIsZooming(true)}
        onMouseLeave={() => setIsZooming(false)}
        onMouseMove={handleMouseMove}
      >
        <AppImage
          src={images[active]?.url}
          alt={title}
          className={`aspect-square w-full object-cover transition-transform duration-200 ${isZooming ? 'scale-[1.8]' : 'scale-100'}`}
          style={isZooming ? zoomStyle : undefined}
        />
      </div>
    </div>
  );
}
