import { categoryFromPath } from './markdown.js';

const naturalCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

const compareText = (left, right) => {
  const leftText = String(left ?? '');
  const rightText = String(right ?? '');

  return (
    naturalCollator.compare(leftText, rightText) ||
    (leftText < rightText ? -1 : leftText > rightText ? 1 : 0)
  );
};

const compareNodes = (left, right) => {
  if (left.type !== right.type) {
    return left.type === 'folder' ? -1 : 1;
  }

  return compareText(left.label ?? left.title, right.label ?? right.title)
    || compareText(left.path, right.path);
};

const createFolderNode = (path, label) => ({
  type: 'folder',
  path,
  label,
  children: [],
});

const getTopLevelFolderLabel = (segment, path) => {
  const meta = categoryFromPath(`/posts/${path}/placeholder.md`);
  return meta.label || segment;
};

const normalizeNode = (node) => {
  if (!node.children?.length) return node;
  node.children.sort(compareNodes);
  node.children.forEach((child) => {
    if (child.type === 'folder') normalizeNode(child);
  });
  return node;
};

export const getDirectoryAncestorPaths = (slug) => {
  const segments = String(slug).split('/').filter(Boolean);
  return segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join('/'));
};

export function buildPostDirectoryTree(posts) {
  const root = { type: 'root', children: [] };
  const folderIndex = new Map();

  for (const post of posts) {
    const segments = String(post.slug).split('/').filter(Boolean);
    if (!segments.length) continue;

    let parent = root;
    for (let depth = 0; depth < segments.length - 1; depth += 1) {
      const path = segments.slice(0, depth + 1).join('/');
      let folder = folderIndex.get(path);
      if (!folder) {
        const segment = segments[depth];
        folder = createFolderNode(
          path,
          depth === 0 ? getTopLevelFolderLabel(segment, path) : segment,
        );
        folderIndex.set(path, folder);
        parent.children.push(folder);
      }
      parent = folder;
    }

    parent.children.push({
      type: 'post',
      slug: post.slug,
      title: post.title,
      path: segments.join('/'),
    });
  }

  return normalizeNode(root);
}
