const naturalCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

const basenameFromSlug = (slug) => String(slug).split('/').at(-1);

const compareText = (left, right) => {
  const leftText = String(left ?? '');
  const rightText = String(right ?? '');

  return (
    naturalCollator.compare(leftText, rightText) ||
    (leftText < rightText ? -1 : leftText > rightText ? 1 : 0)
  );
};

const compareTitleAndSlug = (a, b) =>
  compareText(a.title, b.title) || compareText(a.slug, b.slug);

const hasExplicitOrder = ({ order }) => Number.isFinite(order) && order !== 999;

const orderingTier = (post) => {
  if (hasExplicitOrder(post)) return 0;
  if (/\d/.test(basenameFromSlug(post.slug))) return 1;
  return 2;
};

export function compareSeriesPosts(a, b) {
  const tierA = orderingTier(a);
  const tierB = orderingTier(b);

  if (tierA !== tierB) return tierA - tierB;

  if (tierA === 0) {
    return a.order - b.order || compareText(a.slug, b.slug);
  }

  if (tierA === 1) {
    return (
      compareText(basenameFromSlug(a.slug), basenameFromSlug(b.slug)) ||
      compareTitleAndSlug(a, b)
    );
  }

  return (
    String(b.date ?? '').localeCompare(String(a.date ?? '')) ||
    compareTitleAndSlug(a, b)
  );
}

export function buildSeriesNavigation(allPosts, currentPost) {
  const category = currentPost.category;
  const categoryPosts = allPosts.filter((post) => post.category === category);
  const rootItems = categoryPosts
    .filter((post) => String(post.slug).split('/').length <= 2)
    .sort(compareSeriesPosts);
  const groupedItems = new Map();

  categoryPosts
    .filter((post) => String(post.slug).split('/').length > 2)
    .forEach((post) => {
      const groupId = String(post.slug).split('/')[1];
      const items = groupedItems.get(groupId) ?? [];
      items.push(post);
      groupedItems.set(groupId, items);
    });

  const groups = [...groupedItems]
    .sort(([groupA], [groupB]) => compareText(groupA, groupB))
    .map(([id, items]) => ({ id, label: id, items: items.sort(compareSeriesPosts) }));
  const sequence = [...rootItems, ...groups.flatMap(({ items }) => items)];
  const currentIndex = sequence.findIndex(({ slug }) => slug === currentPost.slug);
  const currentSegments = String(currentPost.slug).split('/');

  return {
    category,
    categoryLabel: currentPost.categoryLabel,
    rootItems,
    groups,
    sequence,
    currentGroupId: currentSegments.length > 2 ? currentSegments[1] : null,
    currentIndex,
    position: currentIndex === -1 ? null : currentIndex + 1,
    total: sequence.length,
    previousPost: currentIndex > 0 ? sequence[currentIndex - 1] : null,
    nextPost:
      currentIndex !== -1 && currentIndex < sequence.length - 1
        ? sequence[currentIndex + 1]
        : null,
  };
}
