import { useState, useEffect } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Search } from "lucide-react";
import { AVATAR, DISPLAY_NAME, GITHUB } from "../../data/profile";
import { buildPrimaryNavItems, getPostSectionByCategory } from "../../data/navigation";
import { getPostBySlug, posts } from "../../data/posts";

// Scroll-direction thresholds.
//
// DEAD_ZONE exists because a single scroll gesture is not monotonic: trackpad
// momentum and phone rubber-banding emit a few pixels the other way mid-flick.
// Reacting to every sign change makes the bar strobe, so a direction has to be
// worth at least this many pixels before it counts.
//
// TOP_ZONE keeps the bar pinned near the top of the page regardless of
// direction. Without it, landing mid-page and flicking down once hides the bar
// while the hero is still on screen. It matches the 68px bar height, so the bar
// is only allowed to hide once it has something to hide behind.
const DEAD_ZONE = 6;
const TOP_ZONE = 68;

export default function Navbar() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const navItems = buildPrimaryNavItems(posts);

  const activeSectionId = (() => {
    if (location.pathname.startsWith("/posts/")) {
      const slug = location.pathname
        .replace(/^\/posts\//, "")
        .split("/")
        .map((segment) => decodeURIComponent(segment))
        .join("/");
      return getPostSectionByCategory(getPostBySlug(slug)?.category)?.id ?? null;
    }

    return null;
  })();

  useEffect(() => {
    let lastY = window.scrollY;
    let queued = false;

    // Scroll fires far more often than the screen repaints. Reading and setting
    // state per event throws away work and can tear the transform mid-frame, so
    // the handler only marks itself dirty and the rAF callback does the reading.
    const read = () => {
      queued = false;
      const y = window.scrollY;
      const delta = y - lastY;

      setScrolled(y > 20);

      if (y <= TOP_ZONE) setHidden(false);
      else if (delta > DEAD_ZONE) setHidden(true);
      else if (delta < -DEAD_ZONE) setHidden(false);

      // Only advance the reference point once the move was decisive enough to
      // act on. Updating it on every event instead would reset the baseline each
      // frame, so a slow drag emitting 1-2px per frame could never accumulate
      // past DEAD_ZONE and the bar would ignore the gesture entirely.
      if (Math.abs(delta) > DEAD_ZONE) lastY = y;
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(read);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    read(); // sync state to a restored scroll position on mount
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the menu on route change, and force the bar back into view.
  //
  // Layout's ScrollReset jumps to the top on navigation, but a programmatic
  // scrollTo does not guarantee a scroll event before the new page paints. So
  // clicking a link while scrolled down (bar hidden) could paint the incoming
  // page with no navbar until the next scroll. Resetting here makes the bar's
  // state match the scroll reset it is paired with.
  useEffect(() => {
    setMenuOpen(false);
    setHidden(false);
  }, [location.pathname]);

  // The mobile menu is a sibling anchored at top-[72px], not a child of the
  // header — so if the bar slid away while the menu was open, the menu would be
  // left floating with nothing above it. Hold the bar in place until the menu
  // closes, which also happens on every route change.
  const barHidden = hidden && !menuOpen;

  return (
    <>
      <header
        // Catches a keyboard user tabbing into the bar while it is hidden:
        // focus would otherwise land on a control sitting above the top of the
        // viewport. React delegates focusin through onFocus, so this fires for
        // any descendant link or input, not just the header itself.
        onFocus={() => setHidden(false)}
        className={`fixed top-0 left-0 right-0 z-50 liquid-glass !rounded-none !border-x-0 !border-t-0 border-b-white/25 nav-slide transition-[transform,box-shadow] duration-300 ${
          barHidden ? "-translate-y-full" : "translate-y-0"
        } ${
          scrolled ? "shadow-[0_2px_16px_rgba(31,38,135,0.14)]" : "!shadow-none"
        }`}
      >
        <div className="page-shell">
          <div className="h-[68px] flex items-center justify-between relative">
            {/* Logo — left */}
            <Link
              to="/"
              className="flex items-center gap-2.5 group shrink-0 relative z-10"
            >
              {/* The GitHub avatar as the mark. Served from /avatar.jpg rather
                  than github.com: an <img> pointing at github.com would make
                  every page load wait on a request that is slow or blocked from
                  mainland China, and a broken logo is the first thing a visitor
                  sees. Same reasoning as self-hosting the fonts.

                  Rendered at 36px against a 200px source, so it stays sharp on
                  2x displays. The ring replaces the old gradient disc, which was
                  the only thing giving the mark an edge against the glass bar. */}
              <img
                src={AVATAR}
                alt=""
                width="36"
                height="36"
                className="w-9 h-9 rounded-full object-cover shadow-md ring-1 ring-white/40 group-hover:scale-105 transition-transform duration-200"
              />
              <span className="font-bold text-xl tracking-wide gradient-text">
                {DISPLAY_NAME}
              </span>
            </Link>

            {/* Nav — absolutely centered, so side widths never shift it */}
            <nav className="hidden md:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
              {navItems.map(({ to, label, sectionId }) => {
                const isActive = sectionId
                  ? activeSectionId === sectionId
                  : to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`relative px-3 py-1.5 rounded-full text-sm md:text-base font-medium transition-colors duration-200 ${
                      isActive
                        ? "text-pink-700"
                        : "text-[var(--text-muted)] hover:text-[var(--text-body)]"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-200/75 to-purple-200/60 shadow-sm"
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 32,
                        }}
                      />
                    )}
                    <span className="relative z-10">{label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Search + theme — right */}
            <div className="flex items-center gap-2 shrink-0 relative z-10">
              <div className="hidden md:block">
                <SearchBox />
              </div>
              {/* GitHub. Inline SVG rather than a lucide icon: lucide-react v1
                  dropped all brand marks, so there is no <Github /> to import.
                  This is the official octocat path. */}
              <a
                href={GITHUB}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                title="GitHub"
                className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--text-body)] hover:text-[var(--color-primary)] hover:bg-white/15 transition-colors duration-200"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="18"
                  height="18"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.07-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.995 7.995 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
                </svg>
              </a>


              {/* Mobile menu button */}
              <button
                className="md:hidden glass-button !p-0 w-9 h-9 flex items-center justify-center !rounded-full"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle menu"
              >
                {menuOpen ? <X size={16} /> : <Menu size={16} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed top-[72px] left-0 right-0 z-40 px-4 md:hidden"
          >
            <div className="liquid-glass rounded-2xl p-4 space-y-1">
              {/* Search */}
              <div className="pb-3 mb-1 border-b border-white/20">
                <SearchBox mobile onSubmitted={() => setMenuOpen(false)} />
              </div>

              {navItems.map(({ to, label, sectionId }) => {
                const isActive = sectionId
                  ? activeSectionId === sectionId
                  : to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMenuOpen(false)}
                    className={`block px-4 py-2.5 rounded-xl text-base md:text-lg font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-pink-200/60 text-pink-700"
                        : "text-[var(--text-muted)] hover:bg-white/20 hover:text-[var(--text-body)]"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
              {/* Theme buttons */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Global search ────────────────────────────────────────────
// URL (`/archive?q=…`) is the source of truth, so results are shareable
// and the back button works. Typing filters live on the archive page;
// from any other page, Enter navigates there.
function SearchBox({ mobile = false, onSubmitted }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const onArchivePage = location.pathname === "/archive";
  const [value, setValue] = useState(urlQuery);

  // Re-sync when the URL changes from outside (back button, category click)
  useEffect(() => {
    setValue(urlQuery);
  }, [urlQuery]);

  const push = (q, replace) => {
    const trimmed = q.trim();
    const next = new URLSearchParams();
    if (trimmed) next.set("q", trimmed);
    navigate(next.toString() ? `/archive?${next.toString()}` : "/archive", { replace });
  };

  const handleChange = (e) => {
    const v = e.target.value;
    setValue(v);
    if (onArchivePage) push(v, true); // replace: don't stack a history entry per keystroke
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    push(value, false);
    onSubmitted?.();
  };

  const clear = () => {
    setValue("");
    if (onArchivePage) push("", true);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative ${mobile ? "w-full" : ""}`}
    >
      <Search
        size={14}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="搜索文章…"
        aria-label="搜索文章"
        className={`${mobile ? "w-full h-11" : "w-36 focus:w-48 h-9"} text-base md:text-lg leading-none pl-9 ${
          value ? "pr-8" : "pr-3"
        } rounded-full bg-white/20 border border-white/25 focus:outline-none focus:ring-2 focus:ring-pink-300/40 text-[var(--text-body)] placeholder:text-[var(--text-muted)] transition-all duration-300`}
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="清除搜索"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors"
        >
          <X size={13} />
        </button>
      )}
    </form>
  );
}
