import { useLayoutEffect } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar from './Navbar';
import Footer from './Footer';
import SchemeBackdrop from '../SchemeBackdrop';
import Petals from '../Petals';
import MiniPlayer from './MiniPlayer';

// Resets scroll for each incoming page. Lives inside the keyed subtree so it
// runs when the new page mounts — not when the outgoing one starts to exit,
// which would yank the view while it's still fading.
function ScrollReset({ pathname }) {
  useLayoutEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

// Navbar and Footer sit outside AnimatePresence, so they never unmount on
// navigation: no flicker, and the navbar's `layoutId` pill can actually
// animate between routes.
export default function Layout() {
  const location = useLocation();
  const isPostRoute = location.pathname.startsWith('/posts/');

  // Snapshot of the active route's element. AnimatePresence keeps the previous
  // snapshot mounted while it exits, so the outgoing page keeps rendering its
  // own content instead of swapping to the incoming route mid-animation.
  const outlet = useOutlet();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Outside AnimatePresence: the backdrop must not fade with page
          transitions, and it must not remount on navigation (that would
          re-decode the JPEG and flash). */}
      <SchemeBackdrop />

      {/* Also outside AnimatePresence, and for a second reason beyond the
          backdrop's: the canvas seeds its petal field once on mount. Inside the
          keyed subtree it would remount per navigation and the whole field
          would restart from random positions on every click. Out here the drift
          simply continues across route changes. */}
      <Petals />

      <Navbar />

      {isPostRoute ? (
        <main className="flex-1">
          <ScrollReset pathname={location.pathname} />
          {outlet}
        </main>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="flex-1"
          >
            <ScrollReset pathname={location.pathname} />
            {outlet}
          </motion.main>
        </AnimatePresence>
      )}

      <Footer />

      {/* Outside AnimatePresence for the same reason as the backdrop: it must
          not fade out and back in on every navigation. It hides itself on the
          homepage, where the full player card already exists. */}
      <MiniPlayer />
    </div>
  );
}
