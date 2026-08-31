import { forwardRef, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, FileText, Folder } from 'lucide-react';
import NavigationSheet from './NavigationSheet';
import useRailMaxHeight from './useRailMaxHeight';
import { getPostSectionByCategory } from '../../data/navigation';
import { buildPostDirectoryTree, getDirectoryAncestorPaths } from '../../lib/postDirectory';

const postUrl = (slug) => `/posts/${String(slug).split('/').map(encodeURIComponent).join('/')}`;

const getVisibleDirectoryNodes = (tree) => {
  if (tree.children.length === 1 && tree.children[0]?.type === 'folder') {
    return tree.children[0].children;
  }

  return tree.children;
};

function DirectoryNodeList({ nodes, expandedPaths, currentSlug, activeFolderPaths, onToggle, onSelect }) {
  return (
    <>
      {nodes.map((node) => {
        if (node.type === 'folder') {
          const expanded = expandedPaths.has(node.path);
          const active = activeFolderPaths.has(node.path);
          return (
            <div className="directory-tree__folder" key={node.path}>
              <button
                type="button"
                className={`directory-tree__folder-toggle${expanded ? ' is-expanded' : ''}${active ? ' is-current' : ''}`}
                aria-expanded={expanded}
                onClick={() => onToggle(node.path)}
              >
                {expanded ? (
                  <ChevronDown aria-hidden="true" size={15} />
                ) : (
                  <ChevronRight aria-hidden="true" size={15} />
                )}
                <Folder aria-hidden="true" size={15} />
                <span>{node.label}</span>
              </button>
              {expanded && node.children.length > 0 && (
                <div className="directory-tree__children">
                  <DirectoryNodeList
                    nodes={node.children}
                    expandedPaths={expandedPaths}
                    currentSlug={currentSlug}
                    activeFolderPaths={activeFolderPaths}
                    onToggle={onToggle}
                    onSelect={onSelect}
                  />
                </div>
              )}
            </div>
          );
        }

        const current = node.slug === currentSlug;
        return (
          <Link
            key={node.path}
            to={postUrl(node.slug)}
            className={`directory-tree__link${current ? ' is-current' : ''}`}
            aria-current={current ? 'page' : undefined}
            onClick={onSelect}
          >
            <FileText aria-hidden="true" size={14} />
            <span>{node.title}</span>
          </Link>
        );
      })}
    </>
  );
}

function DirectoryTree({ tree, currentSlug, expandedPaths, onToggle, onSelect, label }) {
  const activeFolderPaths = useMemo(() => new Set(getDirectoryAncestorPaths(currentSlug)), [currentSlug]);
  const nodes = useMemo(() => getVisibleDirectoryNodes(tree), [tree]);

  return (
    <nav className="directory-tree" aria-label={`${label} 目录导航`}>
      <DirectoryNodeList
        nodes={nodes}
        expandedPaths={expandedPaths}
        currentSlug={currentSlug}
        activeFolderPaths={activeFolderPaths}
        onToggle={onToggle}
        onSelect={onSelect}
      />
    </nav>
  );
}

export function PostDirectorySidebar({ posts, currentSlug }) {
  const currentPost = useMemo(
    () => posts.find((post) => post.slug === currentSlug) ?? null,
    [posts, currentSlug],
  );
  const section = useMemo(() => {
    if (!currentPost) return null;
    return getPostSectionByCategory(currentPost.category) ?? {
      label: currentPost.categoryLabel,
      categoryIds: [currentPost.category],
    };
  }, [currentPost]);
  const sectionPosts = useMemo(() => {
    if (!section) return posts;
    return posts.filter((post) => section.categoryIds.includes(post.category));
  }, [posts, section]);
  const tree = useMemo(() => buildPostDirectoryTree(sectionPosts), [sectionPosts]);
  const { railRef, maxHeight } = useRailMaxHeight(tree.children.length > 0, '(min-width: 1100px)');
  const topLevelFolderPaths = useMemo(
    () => tree.children.filter((node) => node.type === 'folder').map((node) => node.path),
    [tree],
  );
  const currentAncestorPaths = useMemo(() => getDirectoryAncestorPaths(currentSlug), [currentSlug]);
  const defaultExpandedPaths = useMemo(
    () => new Set([...topLevelFolderPaths, ...currentAncestorPaths]),
    [topLevelFolderPaths, currentAncestorPaths],
  );
  const [expandedPaths, setExpandedPaths] = useState(() => defaultExpandedPaths);

  useEffect(() => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      defaultExpandedPaths.forEach((path) => next.add(path));
      return next;
    });
  }, [defaultExpandedPaths]);

  const togglePath = (path) => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (!tree.children.length) return null;
  const directoryLabel = section?.label ?? '目录';

  return (
    <aside ref={railRef} className="article-rail post-directory" data-post-directory aria-label={`${directoryLabel} 目录导航`}>
      <div className="article-rail__panel" style={maxHeight !== null ? { maxHeight } : undefined}>
        <header className="article-rail__header">
          <span className="article-rail__eyebrow">目录</span>
          <strong>{directoryLabel}</strong>
          <span className="article-rail__position">{sectionPosts.length} 篇</span>
        </header>
        <DirectoryTree
          tree={tree}
          currentSlug={currentSlug}
          expandedPaths={expandedPaths}
          onToggle={togglePath}
          label={directoryLabel}
        />
      </div>
    </aside>
  );
}

export const PostDirectoryTrigger = forwardRef(function PostDirectoryTrigger({ onClick }, ref) {
  return (
    <button ref={ref} type="button" className="article-navigation-trigger directory-trigger" data-directory-trigger onClick={onClick}>
      <Folder aria-hidden="true" size={18} />
      <span>文件目录</span>
    </button>
  );
});

export function PostDirectorySheet({ posts, currentSlug, open, onClose, triggerRef }) {
  const currentPost = useMemo(
    () => posts.find((post) => post.slug === currentSlug) ?? null,
    [posts, currentSlug],
  );
  const section = useMemo(() => {
    if (!currentPost) return null;
    return getPostSectionByCategory(currentPost.category) ?? {
      label: currentPost.categoryLabel,
      categoryIds: [currentPost.category],
    };
  }, [currentPost]);
  const sectionPosts = useMemo(() => {
    if (!section) return posts;
    return posts.filter((post) => section.categoryIds.includes(post.category));
  }, [posts, section]);
  const tree = useMemo(() => buildPostDirectoryTree(sectionPosts), [sectionPosts]);
  const topLevelFolderPaths = useMemo(
    () => tree.children.filter((node) => node.type === 'folder').map((node) => node.path),
    [tree],
  );
  const currentAncestorPaths = useMemo(() => getDirectoryAncestorPaths(currentSlug), [currentSlug]);
  const defaultExpandedPaths = useMemo(
    () => new Set([...topLevelFolderPaths, ...currentAncestorPaths]),
    [topLevelFolderPaths, currentAncestorPaths],
  );
  const [expandedPaths, setExpandedPaths] = useState(() => defaultExpandedPaths);

  useEffect(() => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      defaultExpandedPaths.forEach((path) => next.add(path));
      return next;
    });
  }, [defaultExpandedPaths]);

  const togglePath = (path) => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (!tree.children.length) return null;
  const directoryLabel = section?.label ?? '目录';

  return (
    <NavigationSheet open={open} onClose={onClose} title={directoryLabel} triggerRef={triggerRef}>
      <DirectoryTree
        tree={tree}
        currentSlug={currentSlug}
        expandedPaths={expandedPaths}
        onToggle={togglePath}
        onSelect={onClose}
        label={directoryLabel}
      />
    </NavigationSheet>
  );
}
