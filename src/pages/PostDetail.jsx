import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { marked } from 'marked';
import { Calendar, Clock } from 'lucide-react';
import {
  PostDirectorySidebar,
  PostDirectorySheet,
  PostDirectoryTrigger,
} from '../components/blog/PostDirectory';
import {
  PageOutlineRail,
  PageOutlineSheet,
  PageOutlineTrigger,
} from '../components/blog/PageOutline';
import { getPostBySlug, posts } from '../data/posts';
import {
  addHeadingIds,
  parseArticleOutline,
  stripLeadingHeading,
} from '../lib/articleOutline';
import { renderCodeBlock } from '../lib/highlight';
import { withBasePath } from '../lib/paths';

marked.setOptions({ gfm: true, breaks: false });
marked.use({ renderer: { code: renderCodeBlock } });

const addBasePathToRootRelativeAttrs = (html) =>
  html.replace(/\b(src|href)=(["'])(\/(?!\/)[^"']*)\2/g, (_, attr, quote, path) => {
    return `${attr}=${quote}${withBasePath(path)}${quote}`;
  });

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
  const [html, setHtml] = useState('');
  const [headings, setHeadings] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [openSheet, setOpenSheet] = useState(null);
  const directoryTriggerRef = useRef(null);
  const outlineTriggerRef = useRef(null);

  const closeDirectory = useCallback(() => setOpenSheet(null), []);
  const closeOutline = useCallback(() => setOpenSheet(null), []);
  const openDirectory = useCallback(() => setOpenSheet('directory'), []);
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

  if (!post) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center flex-col gap-4 text-[var(--text-muted)]">
        <div className="text-5xl">404</div>
        <p className="text-base md:text-lg">文章不存在</p>
        <button onClick={() => navigate('/archive')} className="glass-button text-base md:text-lg">返回归档</button>
      </div>
    );
  }

  return (
    <div className="post-shell">
      <div className="post-layout">
        <PostDirectorySidebar posts={posts} currentSlug={post.slug} />

        <AnimatePresence mode="wait" initial={false}>
          <motion.article
            key={post.slug}
            className="post-article"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <div className="post-toolbar">
              <div className="post-toolbar__triggers">
                <PostDirectoryTrigger ref={directoryTriggerRef} onClick={openDirectory} />
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
          </motion.article>
        </AnimatePresence>

        <PageOutlineRail headings={headings} activeId={activeId} />
      </div>

      <PostDirectorySheet
        posts={posts}
        currentSlug={post.slug}
        open={openSheet === 'directory'}
        onClose={closeDirectory}
        triggerRef={directoryTriggerRef}
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
