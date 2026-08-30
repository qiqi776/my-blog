import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Disc3,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useAudioPlayer } from "../../context/AudioPlayerContext";
import { formatTime } from "../../lib/format";

// ── 右下角迷你播放器 ─────────────────────────────────────────
// 首页不显示：那里已经有完整的播放器卡片，两个控件叠在同一页上只会让人
// 疑惑哪个是"真的"。除首页外的每一页都挂它。
//
// 它不持有任何播放状态，全部读写 AudioPlayerContext，所以在首页按下播放
// 后切页,这里显示的就是同一条音频的实时进度，不会重头开始。
export default function MiniPlayer() {
  const { pathname } = useLocation();
  const {
    current,
    playable,
    hasTracks,
    playing,
    muted,
    at,
    len,
    step,
    toggle,
    toggleMute,
    seek,
  } = useAudioPlayer();

  const [expanded, setExpanded] = useState(false);
  const playerRef = useRef(null);

  const onHome = pathname === "/";
  const visible = !onHome && hasTracks;

  // 这个浮层会盖住右下角的东西 —— 实测在 1280×800 下它压住了目录的 3 个
  // 条目，那几个链接直接点不到。所以把它占用的高度作为一个全局变量公布
  // 出去，由目录和页脚各自让出空间；不显示时移除变量，首页不会凭空多出
  // 一截留白。
  useLayoutEffect(() => {
    const root = document.documentElement;
    const player = playerRef.current;
    if (!visible || !player) {
      root.style.removeProperty("--mini-player-reserve");
      return undefined;
    }

    const publishHeight = () => {
      root.style.setProperty("--mini-player-reserve", `${player.offsetHeight}px`);
    };
    const observer = new ResizeObserver(publishHeight);
    observer.observe(player);
    publishHeight();
    window.addEventListener("resize", publishHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", publishHeight);
      root.style.removeProperty("--mini-player-reserve");
    };
  }, [visible]);

  // 回到首页时收起。展开态留着的话，下次离开首页会突然弹出一个大卡片，
  // 而用户并没有在这一页展开过它。
  useEffect(() => {
    if (onHome) setExpanded(false);
  }, [onHome]);

  const progress = len ? Math.min(100, (at / len) * 100) : 0;

  // 没有曲库就整个不渲染，而不是渲染一个点不动的空壳。
  // AnimatePresence 本身始终挂载，条件放在它的子节点上 —— 否则进首页时
  // 连同 AnimatePresence 一起被移除，退场动画根本没机会播。
  return (
    <AnimatePresence>
      {visible && (
      <motion.aside
        ref={playerRef}
        key="mini-player"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        // z-40：低于导航栏的 z-50（移动端下拉菜单展开时应当压在它上面），
        // 高于页面内容。`bottom` 留出 Footer 之上的呼吸空间。
        className="fixed right-4 bottom-4 z-40 print:hidden"
        aria-label="音乐播放器"
      >
        <div className="liquid-glass rounded-2xl shadow-lg shadow-black/25 overflow-hidden">
          {/* ── 收起态：一行 ── */}
          <div className="flex items-center gap-2.5 p-2.5">
            <div
              className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${
                playing && playable ? "animate-vinyl-spin" : ""
              }`}
              style={{
                background:
                  "repeating-radial-gradient(circle at 50% 50%, #2a1220 0 2px, #3d1a2e 2px 4px)",
              }}
              aria-hidden="true"
            >
              <Disc3 size={13} className="text-white/85" />
            </div>

            <div className="min-w-0 w-28 sm:w-36">
              <div className="text-xs font-semibold text-[var(--text-heading)] truncate">
                {current.title}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] truncate">
                {current.artist}
              </div>
            </div>

            <button
              onClick={toggle}
              disabled={!playable}
              aria-label={playing ? "暂停" : "播放"}
              title={playable ? undefined : "这首没有本地音频文件"}
              className="p-2 rounded-full bg-[var(--color-primary)]/85 text-white hover:bg-[var(--color-primary)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors duration-200 shrink-0"
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>

            <button
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "收起播放器" : "展开播放器"}
              aria-expanded={expanded}
              className="p-1.5 rounded-full text-[var(--text-muted)] hover:bg-white/15 hover:text-[var(--text-body)] transition-colors duration-200 shrink-0"
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>

          {/* 收起态下的细进度条：不占高度，但仍然看得出播到哪了 */}
          {!expanded && (
            <div
              className="h-[3px] bg-white/12"
              role="presentation"
              aria-hidden="true"
            >
              <div
                className="h-full bg-[var(--color-primary)] transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* ── 展开态：进度条 + 完整控件 ── */}
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="px-2.5 pb-2.5 pt-0.5 border-t border-white/10">
                  <input
                    type="range"
                    min={0}
                    max={len || 1}
                    value={at}
                    step={0.5}
                    onChange={(e) => seek(e.target.value)}
                    disabled={!playable || !len}
                    aria-label="播放进度"
                    className="seek-range w-full mt-2"
                  />
                  <div className="flex justify-between font-mono text-[10px] tabular-nums text-[var(--text-muted)] mt-1">
                    <span>{formatTime(at)}</span>
                    <span>{len ? formatTime(len) : "--:--"}</span>
                  </div>

                  <div className="flex items-center justify-center gap-1 mt-1">
                    <button
                      onClick={() => step(-1)}
                      aria-label="上一首"
                      className="p-1.5 rounded-full text-[var(--text-body)] hover:bg-white/15 transition-colors duration-200"
                    >
                      <SkipBack size={13} />
                    </button>
                    <button
                      onClick={() => step(1)}
                      aria-label="下一首"
                      className="p-1.5 rounded-full text-[var(--text-body)] hover:bg-white/15 transition-colors duration-200"
                    >
                      <SkipForward size={13} />
                    </button>
                    <button
                      onClick={toggleMute}
                      aria-label={muted ? "取消静音" : "静音"}
                      className="p-1.5 rounded-full text-[var(--text-muted)] hover:bg-white/15 hover:text-[var(--text-body)] transition-colors duration-200"
                    >
                      {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>
      )}
    </AnimatePresence>
  );
}
