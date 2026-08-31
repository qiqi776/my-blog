import assert from 'node:assert/strict';
import test from 'node:test';

import {
  audioPlayerReducer,
  createAudioPlayerState,
} from './audioPlayerState.js';

const tracks = [
  { title: 'Spring Is Coming', src: '/music/spring-is-coming-gum-tapes.m4a' },
  { title: 'Too Timid', src: '/music/too-timid-holdan-sutton.m4a' },
];

test('route navigation preserves track and playback intent', () => {
  const playing = audioPlayerReducer(createAudioPlayerState(tracks), {
    type: 'toggle-playback',
  });

  const afterNavigation = audioPlayerReducer(playing, {
    type: 'route-changed',
    pathname: '/posts/backend/DistributedSystem/raft',
  });

  assert.equal(afterNavigation.idx, 0);
  assert.equal(afterNavigation.playing, true);
  assert.equal(afterNavigation.at, playing.at);
  assert.equal(afterNavigation.len, playing.len);
});

test('only explicit track actions or natural ended events change track', () => {
  let state = audioPlayerReducer(createAudioPlayerState(tracks), {
    type: 'toggle-playback',
  });

  state = audioPlayerReducer(state, { type: 'route-changed', pathname: '/archive' });
  state = audioPlayerReducer(state, { type: 'metadata-loaded', duration: 308.1 });
  state = audioPlayerReducer(state, { type: 'time-updated', currentTime: 42 });

  assert.equal(state.idx, 0);
  assert.equal(state.playing, true);
  assert.equal(state.at, 42);
  assert.equal(state.len, 308.1);

  const next = audioPlayerReducer(state, { type: 'track-step', delta: 1 });
  assert.equal(next.idx, 1);
  assert.equal(next.playing, true);
  assert.equal(next.at, 0);
  assert.equal(next.len, 0);

  const ended = audioPlayerReducer(next, { type: 'ended' });
  assert.equal(ended.idx, 0);
  assert.equal(ended.playing, true);
});
