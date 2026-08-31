import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPrimaryNavItems,
  getLatestPostForSection,
  getPostSectionByCategory,
} from './navigation.js';

const post = (slug, category, date) => ({ slug, category, date });

test('getLatestPostForSection returns the newest post in the mapped section', () => {
  const posts = [
    post('go/old', 'go', '2024-01-01'),
    post('go/new', 'go', '2026-01-01'),
    post('frontend/intro', 'frontend', '2025-02-01'),
  ];

  assert.equal(getLatestPostForSection(posts, 'go')?.slug, 'go/new');
  assert.equal(getLatestPostForSection(posts, 'frontend')?.slug, 'frontend/intro');
  assert.equal(getLatestPostForSection(posts, 'missing'), null);
});

test('buildPrimaryNavItems points section entries at the latest post', () => {
  const posts = [
    post('go/old', 'go', '2024-01-01'),
    post('go/new', 'go', '2026-01-01'),
    post('projects/pans/ch01', 'projects', '2026-02-01'),
  ];

  const items = buildPrimaryNavItems(posts);

  assert.equal(items.find((item) => item.id === 'go')?.to, '/posts/go/new');
  assert.equal(items.find((item) => item.id === 'projects')?.to, '/posts/projects/pans/ch01');
  assert.equal(items.find((item) => item.id === 'home')?.to, '/');
});

test('getPostSectionByCategory maps top-level categories into navigation sections', () => {
  assert.equal(getPostSectionByCategory('go')?.id, 'go');
  assert.equal(getPostSectionByCategory('frontend')?.id, 'frontend');
  assert.equal(getPostSectionByCategory('backend')?.id, 'backend');
  assert.equal(getPostSectionByCategory('exam408')?.id, 'exam408');
});
