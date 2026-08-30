import { useEffect, useRef, useState } from 'react';

export default function useRailMaxHeight(enabled = true, mediaQuery = null) {
  const railRef = useRef(null);
  const [maxHeight, setMaxHeight] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const media = mediaQuery ? window.matchMedia(mediaQuery) : null;
    let listening = false;
    let frame = null;
    let rootStyleObserver = null;

    const recalculate = () => {
      const rail = railRef.current;
      if (!rail) return;
      const top = rail.getBoundingClientRect().top;
      const reserve = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--mini-player-reserve'),
      ) || 0;
      setMaxHeight(Math.max(0, window.innerHeight - top - reserve - 16));
    };

    const scheduleRecalculation = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        recalculate();
      });
    };

    const activate = () => {
      if (listening || (media && !media.matches) || !railRef.current) return;
      listening = true;
      recalculate();
      scheduleRecalculation();
      window.addEventListener('scroll', scheduleRecalculation, { passive: true });
      window.addEventListener('resize', scheduleRecalculation);
      rootStyleObserver = new MutationObserver(scheduleRecalculation);
      rootStyleObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['style'],
      });
    };

    const deactivate = () => {
      if (!listening) return;
      listening = false;
      window.removeEventListener('scroll', scheduleRecalculation);
      window.removeEventListener('resize', scheduleRecalculation);
      rootStyleObserver?.disconnect();
      rootStyleObserver = null;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    };

    const handleBreakpointChange = () => {
      if (media?.matches) activate();
      else deactivate();
    };

    activate();
    media?.addEventListener('change', handleBreakpointChange);
    return () => {
      media?.removeEventListener('change', handleBreakpointChange);
      deactivate();
    };
  }, [enabled, mediaQuery]);

  return { railRef, maxHeight };
}
