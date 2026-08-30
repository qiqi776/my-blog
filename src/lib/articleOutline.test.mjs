import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addHeadingIds,
  parseArticleOutline,
  slugifyHeading,
  stripLeadingHeading,
} from './articleOutline.js';

test('slugifyHeading preserves CJK and removes Latin punctuation', () => {
  assert.equal(slugifyHeading('  Hello, TCP/IP!  '), 'hello-tcpip');
  assert.equal(slugifyHeading('1.1 IP 地址'), '11-ip-地址');
});

test('parseArticleOutline extracts only level-two and level-three headings', () => {
  const content = '# 标题\n\n## 网络层基础\n\n### 1.1 IP 地址\n\n#### 不进入目录';

  assert.deepEqual(parseArticleOutline(content), [
    { level: 2, text: '网络层基础', id: '网络层基础' },
    { level: 3, text: '1.1 IP 地址', id: '11-ip-地址' },
  ]);
});

test('parseArticleOutline preserves duplicate IDs for duplicate heading text', () => {
  assert.deepEqual(parseArticleOutline('## Repeated\n\n### Repeated'), [
    { level: 2, text: 'Repeated', id: 'repeated' },
    { level: 3, text: 'Repeated', id: 'repeated' },
  ]);
});

test('parseArticleOutline requires an exact unindented heading prefix', () => {
  const content = '##NoSpace\n  ### Indented\n## Valid';

  assert.deepEqual(parseArticleOutline(content), [
    { level: 2, text: 'Valid', id: 'valid' },
  ]);
});

test('stripLeadingHeading removes a heading that is the first nonblank line', () => {
  const content = '\n\n# Article title\n\nBody paragraph.\n';

  assert.equal(stripLeadingHeading(content), '\n\n\nBody paragraph.\n');
});

test('stripLeadingHeading preserves a later heading after body text', () => {
  const content = '\nBody paragraph.\n\n## Later heading\n';

  assert.equal(stripLeadingHeading(content), content);
});

test('addHeadingIds adds IDs to H2 and H3 without changing other HTML', () => {
  const html = '<p>Intro</p><h2>网络层 <em>基础</em></h2><h3>1.1 IP 地址</h3><h4>不进入目录</h4>';

  assert.equal(
    addHeadingIds(html),
    '<p>Intro</p><h2 id="网络层-基础">网络层 <em>基础</em></h2><h3 id="11-ip-地址">1.1 IP 地址</h3><h4>不进入目录</h4>',
  );
});

test('addHeadingIds preserves duplicate IDs for duplicate rendered headings', () => {
  assert.equal(
    addHeadingIds('<h2>重复</h2><h2>重复</h2>'),
    '<h2 id="重复">重复</h2><h2 id="重复">重复</h2>',
  );
});
