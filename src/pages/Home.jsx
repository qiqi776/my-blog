import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  FileText,
  Disc3,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ExternalLink,
  PenLine,
  CalendarDays,
  Music2,
  Hash,
} from "lucide-react";
import { posts, categories } from "../data/posts";
import { HANDLE } from "../data/profile";
import { tracks } from "../data/personal";
import { TiltCard } from "../components/ui/TiltCard";

// ── Ambient glow ─────────────────────────────────────────────
function Glow() {
  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none z-0"
      aria-hidden="true"
    >
      <div
        className="absolute rounded-full animate-gradient-drift"
        style={{
          top: "-14%",
          right: "-6%",
          width: "540px",
          height: "540px",
          background:
            "radial-gradient(circle, rgba(244,114,182,0.26) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="absolute rounded-full animate-gradient-drift"
        style={{
          top: "45%",
          left: "-8%",
          width: "420px",
          height: "420px",
          background:
            "radial-gradient(circle, rgba(192,132,252,0.2) 0%, transparent 70%)",
          filter: "blur(65px)",
          animationDelay: "-4s",
        }}
      />
    </div>
  );
}

// ── Card shell ───────────────────────────────────────────────
// Every widget below sits in one of these, so padding and header
// rhythm stay identical without repeating the class string.
function Card({
  icon: Icon,
  title,
  aside,
  className = "",
  delay = 0,
  tilt = 4,
  tiltScale = 1.01,
  tiltSpeed = 0.2,
  children,
}) {
  return (
    // Three nested elements, one transform each. The reveal (motion.section)
    // and the tilt (TiltCard) both animate `transform`, so putting them on the
    // same node means the last writer wins: TiltCard's inline style would clip
    // the slide-up mid-flight, and the reveal would then stomp the tilt back to
    // identity. Splitting them lets each own its own node and compose.
    //
    // The visual card is innermost so `liquid-glass` and its padding are not on
    // a node being transformed by two parents — the backdrop-filter is cheaper
    // to composite when its own box is static.
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <TiltCard
        tiltAmount={tilt}
        scaleAmount={tiltScale}
        speed={tiltSpeed}
        className="h-full"
      >
        <div className={`liquid-glass rounded-2xl p-5 h-full ${className}`}>
          {title && (
            <header className="flex items-center gap-2 mb-4">
              {Icon && (
                <Icon
                  size={15}
                  className="text-[var(--color-primary)] shrink-0"
                />
              )}
              <h2 className="text-base md:text-lg font-bold text-[var(--text-heading)]">
                {title}
              </h2>
              {aside && (
                <span className="ml-auto text-sm text-[var(--text-muted)]">
                  {aside}
                </span>
              )}
            </header>
          )}
          {children}
        </div>
      </TiltCard>
    </motion.section>
  );
}

// ── Now playing ──────────────────────────────────────────────
// A real <audio> player, not a mock. Whether it can actually play depends
// on the `src` field in src/data/personal.js:
//   src filled  → full playback: seek, prev/next, mute, auto-advance
//   src empty   → play button disabled, links out to a search instead
// The degraded path exists because this repo ships no audio files, and a
// player that looks live but does nothing when clicked is worse than one
// that says plainly it has no file.
const searchUrl = (t) =>
  "https://music.163.com/#/search/m/?s=" +
  encodeURIComponent(`${t.title} ${t.artist}`);

const fmt = (s) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

function NowPlaying() {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [at, setAt] = useState(0);
  const [len, setLen] = useState(0);
  const ref = useRef(null);

  const current = tracks[idx] ?? { title: "—", artist: "—", src: "" };
  const playable = Boolean(current.src);

  // Track changed while playing — carry playback over to the new source.
  // Safe against autoplay policy: `playing` only becomes true via a click.
  useEffect(() => {
    const el = ref.current;
    if (!el || !playable) return;
    if (playing) el.play().catch(() => setPlaying(false));
    else el.pause();
  }, [idx, playing, playable]);

  const step = (n) => {
    setIdx((i) => (i + n + tracks.length) % tracks.length);
    setAt(0);
    setLen(0);
  };

  const seek = (e) => {
    const v = Number(e.target.value);
    setAt(v);
    if (ref.current) ref.current.currentTime = v;
  };

  return (
    <Card className="flex flex-col" delay={0.1}>
      <div className="flex items-start gap-5">
        {/* Vinyl — spins only while audio is actually advancing */}
        <div className="relative shrink-0">
          <div
            className={`w-[104px] h-[104px] rounded-full grid place-items-center ${
              playing && playable ? "animate-vinyl-spin" : ""
            }`}
            style={{
              background:
                "repeating-radial-gradient(circle at 50% 50%, #2a1220 0 3px, #3d1a2e 3px 5px)",
              boxShadow: "0 6px 22px rgba(0,0,0,0.45)",
            }}
            aria-hidden="true"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 grid place-items-center">
              <Disc3 size={16} className="text-white/90" />
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1.5 text-sm text-[var(--text-muted)]">
            <Music2 size={12} className="text-[var(--color-primary)]" />
            <span className="tracking-[0.14em] uppercase">
              {playing && playable ? "Now Playing" : "Playlist"}
            </span>
          </div>

          <div className="text-lg md:text-xl font-bold text-[var(--text-heading)] truncate">
            {current.title}
          </div>
          <div className="text-sm md:text-base text-[var(--text-muted)] truncate mb-3">
            {current.artist}
          </div>

          {/* Seek — native range so keyboard and screen readers work for free */}
          <input
            type="range"
            min={0}
            max={len || 1}
            value={at}
            step={0.5}
            onChange={seek}
            disabled={!playable || !len}
            aria-label="播放进度"
            className="seek-range w-full"
          />
          <div className="flex justify-between font-mono text-xs tabular-nums text-[var(--text-muted)] mt-1">
            <span>{fmt(at)}</span>
            <span>{len ? fmt(len) : "--:--"}</span>
          </div>

          <div className="flex items-center gap-1 mt-2.5">
            <button
              onClick={() => step(-1)}
              aria-label="上一首"
              className="p-2 rounded-full text-[var(--text-body)] hover:bg-white/15 transition-colors duration-200"
            >
              <SkipBack size={15} />
            </button>

            <button
              onClick={() => setPlaying((p) => !p)}
              disabled={!playable}
              aria-label={playing ? "暂停" : "播放"}
              title={playable ? undefined : "这首没有本地音频文件"}
              className="p-2.5 rounded-full bg-[var(--color-primary)]/85 text-white hover:bg-[var(--color-primary)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>

            <button
              onClick={() => step(1)}
              aria-label="下一首"
              className="p-2 rounded-full text-[var(--text-body)] hover:bg-white/15 transition-colors duration-200"
            >
              <SkipForward size={15} />
            </button>

            {/* No local file — the play button is disabled, so this is the
                only thing here that actually goes anywhere. */}
            {!playable && (
              <a
                href={searchUrl(current)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--color-primary)] transition-colors duration-200"
              >
                去听 <ExternalLink size={10} />
              </a>
            )}

            <button
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? "取消静音" : "静音"}
              className={`p-2 rounded-full text-[var(--text-muted)] hover:bg-white/15 hover:text-[var(--text-body)] transition-colors duration-200 ${
                playable ? "ml-auto" : "ml-1.5"
              }`}
            >
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
          </div>
        </div>
      </div>

      {playable && (
        <audio
          ref={ref}
          src={current.src}
          muted={muted}
          preload="metadata"
          onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setLen(e.currentTarget.duration)}
          onEnded={() => step(1)}
          onError={() => setPlaying(false)}
        />
      )}
    </Card>
  );
}

// ── Tag cloud ────────────────────────────────────────────────
// Built from categories, not from post `tags`. Not one of the 88 markdown
// files carries a `tags:` key — the frontmatter is only title/date/order/draft
// — so a cloud fed by `p.tags` would render an empty box on every build.
// Categories are real: each post's top-level directory under /posts/ becomes
// one, CATEGORY_MAP gives it a Chinese label, and the count comes with it.
const CLOUD = categories.filter((c) => c.id !== "all");
const CLOUD_MAX = Math.max(1, ...CLOUD.map((c) => c.count));
const CLOUD_MIN = Math.min(...CLOUD.map((c) => c.count));

// Five discrete sizes instead of a continuous px ramp: arbitrary sizes on a
// wrapping flex row never settle onto a shared baseline, so the rows read as
// ragged. Size carries the coarse signal and opacity the fine one, so two
// tags landing on the same step still separate.
const CLOUD_STEPS = ["text-sm", "text-base", "text-lg", "text-xl", "text-2xl"];

// The opacity floor is 0.7 for contrast, not taste. --text-heading (#fce7f3)
// at 0.7 over this background is ~7.8:1, and the count inside it — which
// multiplies by another 0.85 — still clears 4.5:1. Dropping the floor to 0.58
// looked better and put that count at 3.5:1, which fails AA at text-xs.
const cloudOpacity = (step) => 0.7 + step * 0.075;

const cloudStep = (count) => {
  if (CLOUD_MAX === CLOUD_MIN) return 2;
  const t = (count - CLOUD_MIN) / (CLOUD_MAX - CLOUD_MIN);
  return Math.round(t * (CLOUD_STEPS.length - 1));
};

function TagCloud() {
  return (
    <Card icon={Hash} title="标签云" aside={`${CLOUD.length} 个`} delay={0.06}>
      <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-3">
        {CLOUD.map((c, i) => {
          const step = cloudStep(c.count);
          const latestPost = posts.find((post) => post.category === c.id);
          return (
            <motion.span
              key={c.id}
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.035 * i }}
            >
              <Link
                to={latestPost ? `/posts/${latestPost.slug.split('/').map(encodeURIComponent).join('/')}` : '/archive'}
                className={`${CLOUD_STEPS[step]} font-bold leading-none text-[var(--text-heading)] hover:!opacity-100 hover:text-[var(--color-primary)] transition-all duration-200`}
                style={{ opacity: cloudOpacity(step) }}
              >
                {c.label}
                <span className="ml-1 align-super font-mono text-xs tabular-nums opacity-85">
                  {c.count}
                </span>
              </Link>
            </motion.span>
          );
        })}
      </div>
    </Card>
  );
}

// ── Writing pulse ────────────────────────────────────────────
// Twelve real months from real post dates. This is not the Archive list
// re-run: Archive answers "what did I write", this answers "when was I
// actually writing" — the gaps are the point.
function buildPulse() {
  const now = new Date();
  const months = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.getMonth() + 1,
      count: 0,
    });
  }

  const byKey = new Map(months.map((m) => [m.key, m]));
  posts.forEach((p) => {
    const m = byKey.get(String(p.date).slice(0, 7));
    if (m) m.count++;
  });

  return months;
}

// Bar heights are px, not %. The count now sits directly above each bar
// inside the same column, so a percentage height would resolve against a
// box that includes that text and the tallest bar would overflow. Fixed
// px keeps the peak bar exactly at the top of the plot area.
const BAR_MAX = 76;
const BAR_EMPTY = 3;

function WritingPulse() {
  const months = useMemo(buildPulse, []);
  const peak = Math.max(1, ...months.map((m) => m.count));
  const inWindow = months.reduce((s, m) => s + m.count, 0);

  return (
    // 3deg against the other two cards' 4: this is the widest card on the
    // page, and a given angle over a longer edge sweeps the far corner much
    // further. It is also the only card whose content is quantitative —
    // tilting shears the bars, so comparing two months' heights gets harder
    // the further it rotates.
    <Card
      icon={PenLine}
      title="写作节奏"
      aside={`近 12 个月 ${inWindow} 篇 · 共 ${posts.length} 篇`}
      delay={0.12}
      tilt={3}
      tiltScale={1.005}
    >
      {/* Two 12-column grids rather than one flex row: the bars and the month
          labels have to line up column-for-column, and a shared grid template
          guarantees that without either row knowing the other's widths. */}
      <div className="grid grid-cols-12 gap-1 sm:gap-1.5 items-end">
        {months.map((m, i) => (
          <div key={m.key} className="flex flex-col items-center min-w-0">
            {/* A zero here is information, not filler — it says "nothing that
                month". So it stays at full --text-muted rather than being
                dimmed further; stacking opacity on 10px text put it near
                1.5:1 against this card, which is not readable. */}
            <span
              className={`font-mono text-[10px] sm:text-xs tabular-nums leading-none mb-1 ${
                m.count
                  ? "font-bold text-[var(--color-primary)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              {m.count}
            </span>

            <motion.div
              className={`w-full rounded-t-[3px] ${
                m.count
                  ? "bg-gradient-to-t from-pink-500/50 to-pink-300/85"
                  : "bg-white/[0.07]"
              }`}
              initial={{ height: BAR_EMPTY }}
              whileInView={{
                height: m.count
                  ? Math.max(5, (m.count / peak) * BAR_MAX)
                  : BAR_EMPTY,
              }}
              viewport={{ once: true }}
              transition={{
                duration: 0.55,
                delay: i * 0.035,
                ease: [0.22, 1, 0.36, 1],
              }}
              title={`${m.key} · ${m.count} 篇`}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-1 sm:gap-1.5 border-t border-white/15 pt-1.5">
        {months.map((m) => (
          <span
            key={m.key}
            className="text-center font-mono text-[10px] sm:text-xs tabular-nums text-[var(--text-muted)]"
          >
            {m.label}
          </span>
        ))}
      </div>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────
// Left column stacks the hero and the tag cloud; the player sits beside them,
// bottom-aligned to the tag cloud rather than to the top of the hero. The
// pulse spans the full width because twelve columns need the room.
// The three entry buttons are the only navigation the page offers, so they
// stay — without them the homepage is a dead end.
export default function Home() {
  const latestPost = posts[0] ?? null;

  return (
    <>
      <Glow />
      <div className="relative z-10 page-shell pt-28 pb-10 space-y-5">
        {/* ── Hero + tag cloud | Now playing ────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-6 items-start mb-4">
          <div className="space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <h1 className="text-4xl sm:text-5xl font-black leading-tight tracking-tight mb-3">
                <span className="text-[var(--text-heading)]">Hi, I'm </span>
                <span className="gradient-text gradient-text-animate">
                  {HANDLE}
                </span>
                <span className="text-[var(--color-primary)]">.</span>
              </h1>

              <p className="text-lg md:text-xl text-[var(--text-body)] mb-1">
                全栈开发 · 分布式存储
              </p>
              <p className="text-base md:text-lg text-[var(--text-muted)]">
                欢迎来到我的个人博客
              </p>
            </motion.div>

            <TagCloud />
          </div>

          {/* `self-end` on the player alone, not `items-end` on the grid: the
              left column is the taller one today, but if the player ever grew
              past it, `items-end` would drop the hero down the page to match.
              This way only the player moves, and the hero stays pinned. */}
          <div className="lg:self-end">
            <NowPlaying />
          </div>
        </div>

        {/* ── Writing pulse ────────────────────────────────── */}
        <WritingPulse />

        {/* ── Entry points ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-center justify-center gap-3 pt-2"
        >
          <Link to={latestPost ? `/posts/${latestPost.slug.split('/').map(encodeURIComponent).join('/')}` : '/archive'}>
            <button className="btn-primary group flex items-center gap-2 text-base md:text-lg font-semibold !px-6 !py-3 !rounded-full">
              <FileText size={15} />
              开始阅读
              <ArrowRight
                size={14}
                className="group-hover:translate-x-1 transition-transform duration-200"
              />
            </button>
          </Link>

          <Link to="/archive">
            <button className="group flex items-center gap-2 px-6 py-3 rounded-full text-base md:text-lg font-semibold text-[var(--text-body)] border border-white/25 hover:border-[var(--color-primary)]/50 hover:bg-white/10 transition-all duration-200">
              <CalendarDays size={15} />
              归档
              <ArrowRight
                size={14}
                className="opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200"
              />
            </button>
          </Link>

        </motion.div>
      </div>
    </>
  );
}
