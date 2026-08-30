import { forwardRef } from 'react';
import { AlignLeft } from 'lucide-react';
import NavigationSheet from './NavigationSheet';
import useRailMaxHeight from './useRailMaxHeight';

function OutlineLinks({ headings, activeId, onSelect }) {
  const selectHeading = (event, heading) => {
    event.preventDefault();
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    const scrollToHeading = () => {
      document.getElementById(heading.id)?.scrollIntoView({ behavior, block: 'start' });
    };
    if (onSelect) {
      onSelect();
      requestAnimationFrame(scrollToHeading);
    } else {
      scrollToHeading();
    }
  };

  return (
    <nav className="page-outline__links" aria-label="本页目录">
      {headings.map((heading, index) => {
        const active = activeId === heading.id;
        return (
          <a
            key={`${heading.id}-${index}`}
            href={`#${heading.id}`}
            className={`page-outline__link${heading.level === 3 ? ' is-nested' : ''}${active ? ' is-current' : ''}`}
            aria-current={active ? 'location' : undefined}
            onClick={(event) => selectHeading(event, heading)}
          >
            {heading.text}
          </a>
        );
      })}
    </nav>
  );
}

export function PageOutlineRail({ headings, activeId }) {
  const { railRef, maxHeight } = useRailMaxHeight(headings.length > 0, '(min-width: 1440px)');
  if (!headings.length) return null;

  return (
    <aside ref={railRef} className="article-rail page-outline" data-page-outline aria-label="本页目录">
      <div className="article-rail__panel" style={maxHeight !== null ? { maxHeight } : undefined}>
        <header className="article-rail__header page-outline__header">
          <AlignLeft aria-hidden="true" size={17} />
          <strong>本页目录</strong>
        </header>
        <OutlineLinks headings={headings} activeId={activeId} />
      </div>
    </aside>
  );
}

export const PageOutlineTrigger = forwardRef(function PageOutlineTrigger({ headings, onClick }, ref) {
  if (!headings.length) return null;
  return (
    <button ref={ref} type="button" className="article-navigation-trigger outline-trigger" data-outline-trigger onClick={onClick}>
      <AlignLeft aria-hidden="true" size={18} />
      <span>本页目录</span>
    </button>
  );
});

export function PageOutlineSheet({ headings, activeId, open, onClose, triggerRef }) {
  if (!headings.length) return null;
  return (
    <NavigationSheet open={open} onClose={onClose} title="本页目录" triggerRef={triggerRef}>
      <OutlineLinks headings={headings} activeId={activeId} onSelect={onClose} />
    </NavigationSheet>
  );
}
