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
  const overview = post('network/overview', { title: '网络概览', categoryLabel: '计算机网络' });
  const ch01 = post('network/408/ch01', { title: '第一章', categoryLabel: '计算机网络' });
  const ch02 = post('network/408/ch02', { title: '第二章', categoryLabel: '计算机网络' });
  const tcpip = post('network/tcpip/ch03', { title: 'TCP/IP 第三章', categoryLabel: '计算机网络' });
  const go = post('go/concurrency', { title: 'Go Concurrency', categoryLabel: 'Go' });

  const navigation = buildSeriesNavigation(
    [ch02, go, tcpip, overview, ch01],
    ch02,
  );

  assert.equal(navigation.category, 'network');
  assert.equal(navigation.categoryLabel, '计算机网络');
  assert.deepEqual(slugs(navigation.rootItems), ['network/overview']);
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
      ['408', ['network/408/ch01', 'network/408/ch02']],
      ['tcpip', ['network/tcpip/ch03']],
    ],
  );
  assert.deepEqual(slugs(navigation.sequence), [
    'network/overview',
    'network/408/ch01',
    'network/408/ch02',
    'network/tcpip/ch03',
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
    post('network/reference', { title: '乙', date: '2026-03-01' }),
    post('network/ch10', { title: 'Chapter 10', date: '2026-05-01' }),
    post('network/z-explicit', { title: 'Z', order: 2 }),
    post('network/ch2', { title: 'Chapter 2', date: '2026-01-01' }),
    post('network/a-explicit', { title: 'A', order: 2 }),
    post('network/guide-z', { title: '甲', date: '2026-03-01' }),
    post('network/guide-a', { title: '甲', date: '2026-03-01' }),
    post('network/ignored-sentinel', { title: '丙', date: '2026-04-01', order: 999 }),
    post('network/non-finite', { title: '丁', date: '2026-06-01', order: Infinity }),
    post('network/first', { title: 'First', order: 1 }),
  ];

  assert.deepEqual(slugs(candidates.sort(compareSeriesPosts)), [
    'network/first',
    'network/a-explicit',
    'network/z-explicit',
    'network/ch2',
    'network/ch10',
    'network/non-finite',
    'network/ignored-sentinel',
    'network/guide-a',
    'network/guide-z',
    'network/reference',
  ]);
});

test('orders collator-equivalent posts deterministically', () => {
  const uppercase = post('network/A', { title: 'ARTICLE', order: 1 });
  const lowercase = post('network/a', { title: 'article', order: 1 });

  assert.ok(compareSeriesPosts(uppercase, lowercase) < 0);
  assert.ok(compareSeriesPosts(lowercase, uppercase) > 0);
  assert.deepEqual(
    slugs([uppercase, lowercase].sort(compareSeriesPosts)),
    slugs([lowercase, uppercase].sort(compareSeriesPosts)),
  );
});

test('orders numbered directory group ids naturally', () => {
  const group10 = post('network/group10/ch01');
  const group2 = post('network/group2/ch01');

  const navigation = buildSeriesNavigation([group10, group2], group10);

  assert.deepEqual(navigation.groups.map(({ id }) => id), ['group2', 'group10']);
});

test('previous and next posts follow the visible sidebar sequence', () => {
  const root = post('network/start');
  const groupA = post('network/a/ch01');
  const groupB = post('network/b/ch01');

  const navigation = buildSeriesNavigation([groupB, root, groupA], groupA);

  assert.deepEqual(slugs(navigation.sequence), [
    'network/start',
    'network/a/ch01',
    'network/b/ch01',
  ]);
  assert.equal(navigation.previousPost, root);
  assert.equal(navigation.nextPost, groupB);
});

test('handles singleton categories and current posts missing from the supplied index', () => {
  const onlyPost = post('network/only');
  const singleton = buildSeriesNavigation([onlyPost], onlyPost);

  assert.equal(singleton.currentIndex, 0);
  assert.equal(singleton.position, 1);
  assert.equal(singleton.total, 1);
  assert.equal(singleton.previousPost, null);
  assert.equal(singleton.nextPost, null);

  const missing = buildSeriesNavigation(
    [onlyPost, post('go/intro')],
    post('network/not-indexed'),
  );

  assert.equal(missing.currentIndex, -1);
  assert.equal(missing.position, null);
  assert.equal(missing.total, 1);
  assert.equal(missing.previousPost, null);
  assert.equal(missing.nextPost, null);
});
