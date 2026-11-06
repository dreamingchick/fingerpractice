import test from 'node:test';
import assert from 'node:assert/strict';
import { judge, remaining, MIN_REACTION_MS } from '../lib/timing.mjs';

test('all touches before zero are ignored without failing the attempt', () => {
  assert.equal(MIN_REACTION_MS, 0);
  for (const elapsed of [-10000, -1, -0.01]) {
    assert.deepEqual(judge(10000, 10000 + elapsed), { kind: 'ignored' });
  }
});

test('zero itself and all later touches are accepted to millisecond precision', () => {
  for (const [elapsed, ms] of [[0, 0], [0.2, 0], [0.999, 0], [1, 1],
                               [25.4, 25], [99.999, 99], [100, 100],
                               [101, 101], [153.8, 153]]) {
    assert.deepEqual(judge(10000, 10000 + elapsed), { kind: 'success', ms });
  }
});

test('earlier ignored touches never change the deadline', () => {
  for (const at of [0, 5000, 9999, 9999.99]) {
    assert.equal(judge(10000, at).kind, 'ignored');
  }
  assert.deepEqual(judge(10000, 10000), { kind: 'success', ms: 0 });
  assert.deepEqual(judge(10000, 10235), { kind: 'success', ms: 235 });
});

test('invalid timestamps cannot produce a successful score', () => {
  for (const at of [Number.NaN, Infinity, -Infinity]) {
    assert.deepEqual(judge(10000, at), { kind: 'ignored' });
  }
  assert.deepEqual(judge(Number.NaN, 10000), { kind: 'ignored' });
});

test('countdown stays at zero after its deadline', () => {
  assert.equal(remaining(10000, 0), 10);
  assert.equal(remaining(10000, 1250), 9);
  assert.equal(remaining(10000, 9999), 1);
  assert.equal(remaining(10000, 10000), 0);
  assert.equal(remaining(10000, 10050), 0);
  assert.equal(remaining(10000, 12000), 0);
});
