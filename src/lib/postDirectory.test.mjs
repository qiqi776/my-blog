import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPostDirectoryTree,
  getDirectoryAncestorPaths,
} from './postDirectory.js';

const post = (slug, title) => ({ slug, title });

const childPaths = (node) =>
  node.children.map((child) => (child.type === 'folder' ? child.path : child.slug));

test('buildPostDirectoryTree groups nested folders and keeps folders before files', () => {
  const tree = buildPostDirectoryTree([
    post('go/2-advanced', 'Beta'),
    post('go/1-intro', 'Alpha'),
    post('go/底层/gmp', 'GMP'),
    post('backend/os/threads/lock', '锁'),
  ]);

  const go = tree.children.find((node) => node.path === 'go');
  const backend = tree.children.find((node) => node.path === 'backend');
  assert.ok(go);
  assert.ok(backend);
  assert.equal(go.label, 'Go');
  assert.equal(backend.label, '后端');
  assert.deepEqual(childPaths(go), ['go/底层', 'go/1-intro', 'go/2-advanced']);

  const lowLevel = go.children[0];
  assert.equal(lowLevel.label, '底层');
  assert.deepEqual(childPaths(lowLevel), ['go/底层/gmp']);
});

test('getDirectoryAncestorPaths returns every folder leading to the post', () => {
  assert.deepEqual(getDirectoryAncestorPaths('go/底层/gmp'), ['go', 'go/底层']);
  assert.deepEqual(getDirectoryAncestorPaths('backend/network/overview'), ['backend', 'backend/network']);
  assert.deepEqual(getDirectoryAncestorPaths('standalone'), []);
});
