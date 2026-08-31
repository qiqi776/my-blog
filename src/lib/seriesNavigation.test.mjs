import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSeriesNavigation,
  compareSeriesPosts,
} from './seriesNavigation.js';

const post = (slug, overrides = {}) => ({
  slug,
  title: slug,
  category: slug.split('/')[0],
  categoryLabel: slug.split('/')[0],
  date: '2026-01-01',
  order: 999,
  ...overrides,
});

const slugs = (posts) => posts.map(({ slug }) => slug);

test('groups category roots and second-level directories into one visible sequence', () => {
  const overview = post('backend/overview', { title: '概览', category: 'backend', categoryLabel: '后端' });
  const ch01 = post('backend/408/ch01', { title: '第一章', category: 'backend', categoryLabel: '后端' });
  const ch02 = post('backend/408/ch02', { title: '第二章', category: 'backend', categoryLabel: '后端' });
  const tcpip = post('backend/tcpip/ch03', { title: 'TCP/IP 第三章', category: 'backend', categoryLabel: '后端' });
  const go = post('go/concurrency', { title: 'Go Concurrency', categoryLabel: 'Go' });

  const navigation = buildSeriesNavigation(
    [ch02, go, tcpip, overview, ch01],
    ch02,
  );

  assert.equal(navigation.category, 'backend');
  assert.equal(navigation.categoryLabel, '后端');
  assert.deepEqual(slugs(navigation.rootItems), ['backend/overview']);
  assert.deepEqual(
    navigation.groups.map(({ id, label }) => ({ id, label })),
    [
      { id: '408', label: '408' },
      { id: 'tcpip', label: 'tcpip' },
    ],
  );
  assert.deepEqual(
    navigation.groups.map(({ id, items }) => [id, slugs(items)]),
    [
      ['408', ['backend/408/ch01', 'backend/408/ch02']],
      ['tcpip', ['backend/tcpip/ch03']],
    ],
  );
  assert.deepEqual(slugs(navigation.sequence), [
    'backend/overview',
    'backend/408/ch01',
    'backend/408/ch02',
    'backend/tcpip/ch03',
  ]);
  assert.equal(navigation.currentGroupId, '408');
  assert.equal(navigation.currentIndex, 2);
  assert.equal(navigation.position, 3);
  assert.equal(navigation.total, 4);
  assert.equal(navigation.previousPost, ch01);
  assert.equal(navigation.nextPost, tcpip);
});

test('orders explicit positions, numbered basenames, then dated posts with stable fallbacks', () => {
  const candidates = [
    post('backend/reference', { title: '乙', date: '2026-03-01', category: 'backend' }),
    post('backend/ch10', { title: 'Chapter 10', date: '2026-05-01', category: 'backend' }),
    post('backend/z-explicit', { title: 'Z', order: 2, category: 'backend' }),
    post('backend/ch2', { title: 'Chapter 2', date: '2026-01-01', category: 'backend' }),
    post('backend/a-explicit', { title: 'A', order: 2, category: 'backend' }),
    post('backend/guide-z', { title: '甲', date: '2026-03-01', category: 'backend' }),
    post('backend/guide-a', { title: '甲', date: '2026-03-01', category: 'backend' }),
    post('backend/ignored-sentinel', { title: '丙', date: '2026-04-01', order: 999, category: 'backend' }),
    post('backend/non-finite', { title: '丁', date: '2026-06-01', order: Infinity, category: 'backend' }),
    post('backend/first', { title: 'First', order: 1, category: 'backend' }),
  ];

  assert.deepEqual(slugs(candidates.sort(compareSeriesPosts)), [
    'backend/first',
    'backend/a-explicit',
    'backend/z-explicit',
    'backend/ch2',
    'backend/ch10',
    'backend/non-finite',
    'backend/ignored-sentinel',
    'backend/guide-a',
    'backend/guide-z',
    'backend/reference',
  ]);
});

test('orders collator-equivalent posts deterministically', () => {
  const uppercase = post('backend/A', { title: 'ARTICLE', order: 1, category: 'backend' });
  const lowercase = post('backend/a', { title: 'article', order: 1, category: 'backend' });

  assert.ok(compareSeriesPosts(uppercase, lowercase) < 0);
  assert.ok(compareSeriesPosts(lowercase, uppercase) > 0);
  assert.deepEqual(
    slugs([uppercase, lowercase].sort(compareSeriesPosts)),
    slugs([lowercase, uppercase].sort(compareSeriesPosts)),
  );
});

test('orders numbered directory group ids naturally', () => {
  const group10 = post('backend/group10/ch01', { category: 'backend' });
  const group2 = post('backend/group2/ch01', { category: 'backend' });

  const navigation = buildSeriesNavigation([group10, group2], group10);

  assert.deepEqual(navigation.groups.map(({ id }) => id), ['group2', 'group10']);
});

test('previous and next posts follow the visible sidebar sequence', () => {
  const root = post('backend/start', { category: 'backend' });
  const groupA = post('backend/a/ch01', { category: 'backend' });
  const groupB = post('backend/b/ch01', { category: 'backend' });

  const navigation = buildSeriesNavigation([groupB, root, groupA], groupA);

  assert.deepEqual(slugs(navigation.sequence), [
    'backend/start',
    'backend/a/ch01',
    'backend/b/ch01',
  ]);
  assert.equal(navigation.previousPost, root);
  assert.equal(navigation.nextPost, groupB);
});

test('handles singleton categories and current posts missing from the supplied index', () => {
  const onlyPost = post('backend/only', { category: 'backend' });
  const singleton = buildSeriesNavigation([onlyPost], onlyPost);

  assert.equal(singleton.currentIndex, 0);
  assert.equal(singleton.position, 1);
  assert.equal(singleton.total, 1);
  assert.equal(singleton.previousPost, null);
  assert.equal(singleton.nextPost, null);

  const missing = buildSeriesNavigation(
    [onlyPost, post('go/intro')],
    post('backend/not-indexed', { category: 'backend' }),
  );

  assert.equal(missing.currentIndex, -1);
  assert.equal(missing.position, null);
  assert.equal(missing.total, 1);
  assert.equal(missing.previousPost, null);
  assert.equal(missing.nextPost, null);
});
