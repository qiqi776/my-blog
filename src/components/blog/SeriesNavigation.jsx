import {
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, ChevronDown, Library } from 'lucide-react';
import NavigationSheet from './NavigationSheet';
import useRailMaxHeight from './useRailMaxHeight';

const postUrl = (slug) => `/posts/${String(slug).split('/').map(encodeURIComponent).join('/')}`;
const scrollStorageKey = (category) => `article-series-scroll:${category}`;

function ActiveMarker({ layoutId }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.span
      className="series-navigation__active-marker"
      layoutId={layoutId}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
      aria-hidden="true"
    />
  );
}

function ChapterLink({ post, currentSlug, markerId, onNavigate }) {
  const current = post.slug === currentSlug;
  return (
    <Link
      to={postUrl(post.slug)}
      className={`series-navigation__link${current ? ' is-current' : ''}`}
      aria-current={current ? 'page' : undefined}
      onClick={onNavigate}
    >
      {current && <ActiveMarker layoutId={markerId} />}
      <span className="series-navigation__link-label">{post.title}</span>
    </Link>
  );
}

function SeriesChapterList({ model, onNavigate, scrollRef, revealCurrent = false }) {
  const controlPrefix = useId().replaceAll(':', '');
  const markerId = `${controlPrefix}-current-chapter`;
  const localScrollRef = useRef(null);
  const listRef = scrollRef ?? localScrollRef;
  const [expandedGroups, setExpandedGroups] = useState(
    () => new Set(model.currentGroupId ? [model.currentGroupId] : []),
  );

  useEffect(() => {
    setExpandedGroups(new Set(model.currentGroupId ? [model.currentGroupId] : []));
  }, [model.category]);

  useEffect(() => {
    if (!model.currentGroupId) return;
    setExpandedGroups((current) => {
      if (current.has(model.currentGroupId)) return current;
      const next = new Set(current);
      next.add(model.currentGroupId);
      return next;
    });
  }, [model.currentGroupId]);

  useLayoutEffect(() => {
    if (!revealCurrent) return undefined;

    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      const viewport = list?.closest('.navigation-sheet__body');
      const active = list?.querySelector('[aria-current="page"]');
      if (!viewport || !active) return;

      const viewportRect = viewport.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      if (activeRect.top >= viewportRect.top && activeRect.bottom <= viewportRect.bottom) return;

      const centeredOffset = activeRect.top
        - viewportRect.top
        - Math.max(0, (viewportRect.height - activeRect.height) / 2);
      viewport.scrollTop += centeredOffset;
    });

    return () => cancelAnimationFrame(frame);
  }, [listRef, model.category, model.currentGroupId, model.currentIndex, revealCurrent]);

  const toggleGroup = (groupId) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <nav ref={listRef} className="series-navigation" aria-label="系列章节">
      {model.rootItems.map((post) => (
        <ChapterLink
          key={post.slug}
          post={post}
          currentSlug={model.sequence[model.currentIndex]?.slug}
          markerId={markerId}
          onNavigate={onNavigate}
        />
      ))}

      {model.groups.map((group) => {
        const expanded = expandedGroups.has(group.id);
        const controlsId = `${controlPrefix}-group-${encodeURIComponent(group.id)}`;
        return (
          <div className="series-navigation__group" key={group.id}>
            <button
              type="button"
              className="series-navigation__group-toggle"
              aria-expanded={expanded}
              aria-controls={controlsId}
              onClick={() => toggleGroup(group.id)}
            >
              <ChevronDown className={expanded ? 'is-expanded' : ''} aria-hidden="true" size={16} />
              <span>{group.label}</span>
            </button>
            {expanded && (
              <div id={controlsId} className="series-navigation__group-items">
                {group.items.map((post) => (
                  <ChapterLink
                    key={post.slug}
                    post={post}
                    currentSlug={model.sequence[model.currentIndex]?.slug}
                    markerId={markerId}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function SeriesSidebar({ model }) {
  const { railRef, maxHeight } = useRailMaxHeight(true, '(min-width: 1100px)');
  const scrollRef = useRef(null);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return undefined;

    const key = scrollStorageKey(model.category);
    const desktop = window.matchMedia('(min-width: 1100px)');
    let deactivate = null;

    const activate = () => {
      if (!desktop.matches || deactivate) return;
      try {
        scroller.scrollTop = Number(sessionStorage.getItem(key)) || 0;
      } catch {
        scroller.scrollTop = 0;
      }

      const frame = requestAnimationFrame(() => {
        const active = scroller.querySelector('[aria-current="page"]');
        if (!active) return;
        const scrollerRect = scroller.getBoundingClientRect();
        const activeRect = active.getBoundingClientRect();
        if (activeRect.top < scrollerRect.top) {
          scroller.scrollTop -= scrollerRect.top - activeRect.top;
        } else if (activeRect.bottom > scrollerRect.bottom) {
          scroller.scrollTop += activeRect.bottom - scrollerRect.bottom;
        }
      });

      const rememberScroll = () => {
        try {
          sessionStorage.setItem(key, String(scroller.scrollTop));
        } catch {
          // Storage can be disabled without affecting navigation.
        }
      };
      scroller.addEventListener('scroll', rememberScroll, { passive: true });
      deactivate = () => {
        cancelAnimationFrame(frame);
        scroller.removeEventListener('scroll', rememberScroll);
        rememberScroll();
        deactivate = null;
      };
    };

    const handleBreakpointChange = () => {
      if (desktop.matches) activate();
      else deactivate?.();
    };
    activate();
    desktop.addEventListener('change', handleBreakpointChange);
    return () => {
      desktop.removeEventListener('change', handleBreakpointChange);
      deactivate?.();
    };
  }, [model.category, model.currentIndex]);

  return (
    <aside ref={railRef} className="article-rail series-sidebar" data-series-sidebar aria-label="系列导航">
      <div className="article-rail__panel" style={maxHeight !== null ? { maxHeight } : undefined}>
        <header className="article-rail__header">
          <span className="article-rail__eyebrow">系列</span>
          <strong>{model.categoryLabel}</strong>
          {model.position != null && (
            <span className="article-rail__position">{model.position}/{model.total || 1}</span>
          )}
        </header>
        <SeriesChapterList model={model} scrollRef={scrollRef} />
      </div>
    </aside>
  );
}

export const SeriesTrigger = forwardRef(function SeriesTrigger({ model, onClick }, ref) {
  return (
    <button ref={ref} type="button" className="article-navigation-trigger series-trigger" data-series-trigger onClick={onClick}>
      <Library aria-hidden="true" size={18} />
      <span>{model.categoryLabel}</span>
      {model.position != null && (
        <span className="article-navigation-trigger__position">{model.position}/{model.total || 1}</span>
      )}
    </button>
  );
});

export function SeriesSheet({ model, open, onClose, triggerRef }) {
  return (
    <NavigationSheet open={open} onClose={onClose} title="系列章节" triggerRef={triggerRef}>
      <div className="navigation-sheet__summary">
        <BookOpen aria-hidden="true" size={18} />
        <span>{model.categoryLabel}</span>
        {model.position != null && (
          <span className="navigation-sheet__position">{model.position}/{model.total || 1}</span>
        )}
      </div>
      <SeriesChapterList model={model} onNavigate={onClose} revealCurrent />
    </NavigationSheet>
  );
}
