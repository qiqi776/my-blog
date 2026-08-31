import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { posts } from '../data/posts';

// Group posts by year. The old version grouped by year-month, which the
// reference doesn't do: with one row per post and no card around each row, the
// month headers outnumbered the rows they introduced on sparse months.
function groupByYear(list) {
  const map = {};
  list.forEach((post) => {
    const year = post.date.slice(0, 4);
    if (!map[year]) map[year] = { year, posts: [] };
    map[year].posts.push(post);
  });
  return Object.values(map)
    .sort((a, b) => b.year.localeCompare(a.year))
    .map((g) => ({
      ...g,
      posts: [...g.posts].sort((a, b) => b.date.localeCompare(a.date)),
    }));
}

// MM-DD. The year is already the group header, so repeating it per row is noise.
const monthDay = (date) => date.slice(5);

// Slug may contain '/' and CJK (e.g. 'go/底层/gmp') — encode each segment
const postHref = (slug) => '/posts/' + slug.split('/').map(encodeURIComponent).join('/');

export default function Archive() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((post) =>
      post.title.toLowerCase().includes(q) ||
      post.excerpt.toLowerCase().includes(q) ||
      post.categoryLabel.toLowerCase().includes(q) ||
      post.date.includes(q)
    );
  }, [searchQuery]);

  const grouped = groupByYear(filtered);

  const clearSearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="page-shell pt-28 pb-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-black text-[var(--text-heading)] mb-2">归档</h1>
        <p className="text-[var(--text-muted)] text-base md:text-lg">
          共 <span className="font-semibold text-[var(--color-primary)]">{posts.length}</span> 篇文章
          {searchQuery && (
            <> · 当前筛选 <span className="font-semibold text-[var(--color-primary)]">{filtered.length}</span> 篇</>
          )}
        </p>
      </motion.div>

      {searchQuery && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-5 flex items-center gap-2 text-base md:text-lg"
        >
          <span className="text-[var(--text-muted)]">搜索</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-200/50 text-pink-700 font-medium">
            {searchQuery}
            <button
              onClick={clearSearch}
              aria-label="清除搜索"
              className="hover:opacity-70 transition-opacity"
            >
              <X size={12} />
            </button>
          </span>
        </motion.div>
      )}

      {/* The list. Capped narrower than the shell: the shell width exists so this
          page's left edge lines up with the navbar and every other page, but the
          columns below are percentages, and at 1104px the date and the category
          end up marooned at opposite ends of the row. */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
        className="max-w-4xl"
      >
        {grouped.length > 0 ? grouped.map(({ year, posts: yearPosts }) => (
          <div key={year}>
            {/* Year header. The hollow ring sits in the same 10% column as the
                row dots below it, so the dashed line threads through it. */}
            <div className="flex flex-row w-full items-center h-[3.75rem]">
              <div className="w-[15%] md:w-[10%] text-right text-2xl md:text-3xl font-bold text-[var(--text-heading)]">
                {year}
              </div>
              <div className="w-[15%] md:w-[10%]">
                <div className="h-3 w-3 mx-auto rounded-full outline outline-2 -outline-offset-[2px] outline-[var(--color-primary)]" />
              </div>
              <div className="w-[70%] md:w-[80%] text-left text-base md:text-lg text-[var(--text-muted)]">
                {yearPosts.length} 篇
              </div>
            </div>

            {/* Rows. No card, border, radius or shadow — the only decoration is
                the hover tint. This is the "去掉框框" part: text sits directly on
                the photo backdrop, which is also why the muted colour matters
                (bare #c79ab5 measures 4.54:1 there, only just over AA) and why
                the date/category stay at text-sm md:text-base rather than smaller. */}
            {yearPosts.map((post) => (
              <Link
                key={post.slug}
                to={postHref(post.slug)}
                className="group block h-10 w-full rounded-lg hover:bg-white/10 transition-colors duration-200"
              >
                <div className="flex flex-row justify-start items-center h-full">
                  <div className="w-[15%] md:w-[10%] text-right text-sm md:text-base tabular-nums text-[var(--text-muted)] transition-colors">
                    {monthDay(post.date)}
                  </div>

                  {/* Dot + dashed connector. The reference punches a hole in the
                      line with an outline coloured like its flat card; over a
                      photo there is no single colour to match, so the line runs
                      behind the dot instead. */}
                  <div className="w-[15%] md:w-[10%] relative dash-line h-full flex items-center">
                    <div className="mx-auto w-1 h-1 rounded-full bg-[var(--text-muted)] group-hover:h-5 group-hover:bg-[var(--color-primary)] transition-all duration-200 z-10" />
                  </div>

                  <div className="w-[70%] md:w-[65%] text-left text-base md:text-lg font-semibold text-[var(--text-body)] whitespace-nowrap overflow-hidden text-ellipsis pr-6 group-hover:translate-x-1 group-hover:text-[var(--color-primary)] transition-all duration-200">
                    {post.title}
                  </div>

                  {/* The reference's 4th column is tags; none of my 74 posts
                      carry frontmatter tags, so it carries the category instead.
                      Hidden below md, same as the reference. */}
                  <div className="hidden md:block md:w-[15%] text-left text-sm md:text-base text-[var(--text-muted)] whitespace-nowrap overflow-hidden text-ellipsis transition-colors">
                    {post.categoryLabel}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )) : (
          <div className="text-center py-20 text-[var(--text-muted)]">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-base md:text-lg">没有找到匹配的文章</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
