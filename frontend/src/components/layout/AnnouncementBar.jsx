import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { announcementsApi } from '@/api/endpoints/misc';

// Seamless, continuous marquee (Amazon/Flipkart/Apple-style) — every
// announcement scrolls together in one uninterrupted strip, never a
// one-at-a-time JS-driven cycle with a hard cut between items.
//
// Technique: render one "logical copy" (the full announcement list,
// repeated enough times to be at least as wide as the bar — this is what
// makes even a single short announcement fill the width and keep
// scrolling), then render that logical copy TWICE back-to-back and
// animate translate3d(0) -> translate3d(-50%). Since both halves are
// pixel-identical, the instant the loop restarts is visually
// indistinguishable from mid-scroll — no jump, no gap, no flicker.
//
// admin/src/pages/AnnouncementsPage.jsx + the Announcement model/API are
// untouched — this only changes how the frontend renders the existing
// records. `scrollSpeed` keeps its documented meaning ("seconds for one
// full marquee loop; lower = faster") by converting it into a constant
// px/second rate against a reference width, then the REAL animation
// duration is computed from the actual (repeated + doubled) content width
// at that rate — so speed stays visually constant no matter how many
// announcements exist or how long they are.
const REFERENCE_WIDTH_PX = 1920;
const FALLBACK_SCROLL_SPEED = 40;

export default function AnnouncementBar() {
  const { data } = useQuery({
    queryKey: ['announcements'],
    queryFn: announcementsApi.list,
    staleTime: 5 * 60_000,
  });
  const announcements = data?.announcements || [];

  const containerRef = useRef(null);
  const measureRef = useRef(null);
  const [metrics, setMetrics] = useState({ repeatCount: 1, duration: FALLBACK_SCROLL_SPEED });

  const scrollSpeedSeconds = announcements[0]?.scrollSpeed > 0 ? announcements[0].scrollSpeed : FALLBACK_SCROLL_SPEED;
  const pxPerSecond = REFERENCE_WIDTH_PX / scrollSpeedSeconds;

  // useLayoutEffect (not useEffect) so the correctly-sized/duration'd
  // marquee is in place before the browser's first paint — avoids a
  // flash of an under-filled or wrong-speed bar.
  useLayoutEffect(() => {
    if (announcements.length === 0) return undefined;
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return undefined;

    const recalc = () => {
      const containerWidth = container.offsetWidth;
      const oneCopyWidth = measure.scrollWidth; // width of one un-repeated pass through the list
      if (oneCopyWidth === 0) return;

      // Repeat the list enough times that one logical copy is at least as
      // wide as the bar itself — required so a single short announcement
      // still fills the entire width (+1 pass of margin for safety).
      const repeatCount = Math.max(1, Math.ceil(containerWidth / oneCopyWidth) + 1);
      const totalLogicalCopyWidth = oneCopyWidth * repeatCount;
      const duration = totalLogicalCopyWidth / pxPerSecond;

      setMetrics((prev) => (prev.repeatCount === repeatCount && prev.duration === duration ? prev : { repeatCount, duration }));
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(container);
    ro.observe(measure);
    return () => ro.disconnect();
  }, [announcements.length, pxPerSecond]);

  if (announcements.length === 0) return null;

  const backgroundColor = announcements[0]?.backgroundColor || '#1F2937';

  const renderPass = (passKey) => announcements.map((a, i) => (
    <span key={`${passKey}-${i}`} className="mx-6 inline-flex shrink-0 items-center gap-3 align-middle" style={{ color: a.textColor }}>
      {a.text}
      {a.buttonText && a.buttonLink && (
        <Link to={a.buttonLink} className="underline underline-offset-2">{a.buttonText}</Link>
      )}
      <span aria-hidden="true" className="ml-6 opacity-40">•</span>
    </span>
  ));

  const logicalCopy = (copyKey) => (
    <span className="inline-flex shrink-0">
      {Array.from({ length: metrics.repeatCount }).map((_, r) => (
        <span key={`${copyKey}-${r}`} className="inline-flex shrink-0">{renderPass(`${copyKey}-${r}`)}</span>
      ))}
    </span>
  );

  return (
    <div ref={containerRef} className="group relative overflow-hidden py-2 text-sm" style={{ backgroundColor }}>
      {/* Invisible, unduplicated, un-transformed measuring pass — used only
          to read the natural width of one trip through the announcement
          list, which repeatCount/duration above are derived from. */}
      <span ref={measureRef} className="pointer-events-none absolute left-0 top-0 inline-flex whitespace-nowrap" style={{ visibility: 'hidden' }} aria-hidden="true">
        {renderPass('measure')}
      </span>

      <div
        className="flex whitespace-nowrap will-change-transform group-hover:[animation-play-state:paused]"
        style={{ animation: `announcement-marquee ${metrics.duration}s linear infinite` }}
      >
        {logicalCopy('a')}
        {logicalCopy('b')}
      </div>

      <style>{`
        @keyframes announcement-marquee {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
      `}</style>
    </div>
  );
}
