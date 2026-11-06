import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COUNTDOWN_MS, MAX_REACTION_MS, NETWORK_SLACK_MS, NICKNAME_WINDOW_MS,
  validReaction, normalizedNickname, hitStartWindow,
} from '../lib/attempt-validation.mjs';

test('0ms to 30000ms are valid; negative, fractional and forged types are rejected', () => {
  for (const n of [0, 1, 42, 100, 101, 30000]) assert.equal(validReaction(n), true);
  for (const n of [-1, 30001, 1.5, NaN, Infinity, '0', null, undefined]) {
    assert.equal(validReaction(n), false);
  }
});

test('server hit window requires 10 seconds plus the claimed reaction', () => {
  assert.equal(COUNTDOWN_MS, 10000);
  assert.equal(NETWORK_SLACK_MS, 15000);
  assert.deepEqual(hitStartWindow(30000, 0), { earliest: 5000, latest: 20000 });
  assert.deepEqual(hitStartWindow(30000, 100), { earliest: 4900, latest: 19900 });
  assert.deepEqual(hitStartWindow(30000, MAX_REACTION_MS), { earliest: -25000, latest: -10000 });
  assert.equal(hitStartWindow(30000, -1), null);
  assert.equal(hitStartWindow(NaN, 0), null);
});

test('nickname validation blocks control characters and oversized values', () => {
  assert.equal(normalizedNickname('  해적  '), '해적');
  assert.equal(normalizedNickname('신비한가루'), '신비한가루');
  assert.equal(normalizedNickname(''), null);
  assert.equal(normalizedNickname(' '.repeat(4)), null);
  assert.equal(normalizedNickname('1234567890123'), null);
  assert.equal(normalizedNickname('<script>'), null);
  assert.equal(normalizedNickname('a\nname'), null);
  assert.equal(normalizedNickname(123), null);
  assert.equal(NICKNAME_WINDOW_MS, 60000);
});
