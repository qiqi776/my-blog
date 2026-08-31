export const POST_SECTION_GROUPS = [
  { id: 'go', label: 'Go', categoryIds: ['go'] },
  { id: 'frontend', label: '前端', categoryIds: ['frontend'] },
  {
    id: 'backend',
    label: '后端',
    categoryIds: ['backend'],
  },
  { id: 'agent', label: 'agent', categoryIds: ['agent'] },
  { id: 'projects', label: '项目', categoryIds: ['projects'] },
  { id: 'exam408', label: '考研408', categoryIds: ['exam408'] },
];

const postUrl = (slug) => `/posts/${String(slug).split('/').map(encodeURIComponent).join('/')}`;

export function getLatestPostForSection(posts, sectionId) {
  const section = getPostSectionById(sectionId);
  if (!section) return null;
  return posts
    .filter((post) => section.categoryIds.includes(post.category))
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))[0] ?? null;
}

export function buildPrimaryNavItems(posts) {
  return [
    { id: 'home', label: '首页', to: '/' },
    ...POST_SECTION_GROUPS.map((section) => {
      const latestPost = getLatestPostForSection(posts, section.id);
      return {
        id: section.id,
        label: section.label,
        to: latestPost ? postUrl(latestPost.slug) : '/archive',
        sectionId: section.id,
      };
    }),
    { id: 'archive', label: '归档', to: '/archive' },
  ];
}

export const getPostSectionById = (sectionId) =>
  POST_SECTION_GROUPS.find((section) => section.id === sectionId) ?? null;

export const getPostSectionByCategory = (categoryId) =>
  POST_SECTION_GROUPS.find((section) => section.categoryIds.includes(categoryId)) ?? null;
