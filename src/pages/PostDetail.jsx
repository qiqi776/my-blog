import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { marked } from 'marked';
import { ArrowLeft, ArrowRight, Calendar, Clock } from 'lucide-react';
import {
  PageOutlineRail,
  PageOutlineSheet,
  PageOutlineTrigger,
} from '../components/blog/PageOutline';
import {
  SeriesSheet,
  SeriesSidebar,
  SeriesTrigger,
} from '../components/blog/SeriesNavigation';
import { getPostBySlug, posts } from '../data/posts';
import {
  addHeadingIds,
  parseArticleOutline,
  stripLeadingHeading,
} from '../lib/articleOutline';
import { renderCodeBlock } from '../lib/highlight';
import { withBasePath } from '../lib/paths';
import { buildSeriesNavigation } from '../lib/seriesNavigation';

marked.setOptions({ gfm: true, breaks: false });
marked.use({ renderer: { code: renderCodeBlock } });

const addBasePathToRootRelativeAttrs = (html) =>
  html.replace(/\b(src|href)=(["'])(\/(?!\/)[^"']*)\2/g, (_, attr, quote, path) => {
    return `${attr}=${quote}${withBasePath(path)}${quote}`;
  });

const postUrl = (slug) => `/posts/${String(slug).split('/').map(encodeURIComponent).join('/')}`;

async function copyCode(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export default function PostDetail() {
  const params = useParams();
  const slug = params['*'] ?? '';
  const navigate = useNavigate();
  const post = getPostBySlug(decodeURIComponent(slug));
  const seriesModel = useMemo(
    () => (post ? buildSeriesNavigation(posts, post) : null),
    [post],
  );
  const [html, setHtml] = useState('');
  const [headings, setHeadings] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [openSheet, setOpenSheet] = useState(null);
  const seriesTriggerRef = useRef(null);
  const outlineTriggerRef = useRef(null);

  const closeSeries = useCallback(() => setOpenSheet(null), []);
  const closeOutline = useCallback(() => setOpenSheet(null), []);
  const openSeries = useCallback(() => setOpenSheet('series'), []);
  const openOutline = useCallback(() => setOpenSheet('outline'), []);

  useEffect(() => {
    setActiveId('');
    setOpenSheet(null);
    if (!post) {
      setHtml('');
      setHeadings([]);
      return;
    }

    const articleMarkdown = stripLeadingHeading(post.content);
    setHtml(addBasePathToRootRelativeAttrs(addHeadingIds(marked.parse(articleMarkdown))));
    setHeadings(parseArticleOutline(articleMarkdown));
  }, [post?.slug]);

  useEffect(() => {
    if (!html) return undefined;
    const elements = document.querySelectorAll('.prose-content h2, .prose-content h3');
    if (!elements.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [html]);

  useEffect(() => {
    if (!html) return undefined;
    const root = document.querySelector('.prose-content');
    if (!root) return undefined;

    const onClick = async (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest('.code-block__copy');
      if (!button || !root.contains(button)) return;

      const code = button.closest('.code-block')?.querySelector('.code-block__code')?.textContent?.replace(/\n$/, '');
      if (!code) return;

      try {
        await copyCode(code);
        button.textContent = '已复制';
        window.setTimeout(() => {
          button.textContent = '复制';
        }, 1400);
      } catch {
        button.textContent = '复制失败';
        window.setTimeout(() => {
          button.textContent = '复制';
        }, 1400);
      }
    };

    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [html]);

  if (!post || !seriesModel) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center flex-col gap-4 text-[var(--text-muted)]">
        <div className="text-5xl">404</div>
        <p className="text-base md:text-lg">文章不存在</p>
        <button onClick={() => navigate('/posts')} className="glass-button text-base md:text-lg">返回列表</button>
      </div>
    );
  }

  const { previousPost, nextPost } = seriesModel;

  return (
    <div className="post-shell">
      <div className="post-layout">
        <SeriesSidebar model={seriesModel} />

        <motion.article
          className="post-article"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="post-toolbar">
            <Link to="/posts" className="post-back-link">
              <ArrowLeft aria-hidden="true" size={16} />
              <span>返回列表</span>
            </Link>
            <div className="post-toolbar__triggers">
              <SeriesTrigger ref={seriesTriggerRef} model={seriesModel} onClick={openSeries} />
              <PageOutlineTrigger ref={outlineTriggerRef} headings={headings} onClick={openOutline} />
            </div>
          </div>

          <div className="article-surface" data-article-surface>
            <header className="article-header">
              <div className="article-meta">
                <span className={`article-category ${post.categoryColor}`}>{post.categoryLabel}</span>
                <span><Clock aria-hidden="true" size={13} /> {post.readTime}</span>
                <span><Calendar aria-hidden="true" size={13} /> {post.date}</span>
              </div>
              <h1>{post.title}</h1>
            </header>
            <div className="article-body prose-content" dangerouslySetInnerHTML={{ __html: html }} />
          </div>

          {(previousPost || nextPost) && (
            <motion.nav
              className="article-pagination"
              aria-label="系列文章章节导航"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              {previousPost ? (
                <Link to={postUrl(previousPost.slug)} className="article-pagination__link is-previous" aria-label={`上一篇：${previousPost.title}`}>
                  <ArrowLeft aria-hidden="true" size={18} />
                  <span>
                    <small>上一篇</small>
                    <strong>{previousPost.title}</strong>
                  </span>
                </Link>
              ) : <span />}
              {nextPost ? (
                <Link to={postUrl(nextPost.slug)} className="article-pagination__link is-next" aria-label={`下一篇：${nextPost.title}`}>
                  <span>
                    <small>下一篇</small>
                    <strong>{nextPost.title}</strong>
                  </span>
                  <ArrowRight aria-hidden="true" size={18} />
                </Link>
              ) : <span />}
            </motion.nav>
          )}
        </motion.article>

        <PageOutlineRail headings={headings} activeId={activeId} />
      </div>

      <SeriesSheet
        model={seriesModel}
        open={openSheet === 'series'}
        onClose={closeSeries}
        triggerRef={seriesTriggerRef}
      />
      <PageOutlineSheet
        headings={headings}
        activeId={activeId}
        open={openSheet === 'outline'}
        onClose={closeOutline}
        triggerRef={outlineTriggerRef}
      />
    </div>
  );
}
