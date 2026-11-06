import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeMobileRanking, MOBILE_RANKING_RELEASE } from '../lib/mobile-ranking.mjs';

function fakeDb() {
  const log = [];
  const markers = new Map();
  const attempts = [1000, 1999, 2000, 2500];
  return {
    log, attempts,
    prepare(sql) {
      const call = { sql, params: [] };
      log.push(call);
      return {
        bind(...params) { call.params = params; return this; },
        async run() {
          if (sql.startsWith('INSERT OR IGNORE')) {
            if (!markers.has(call.params[0])) markers.set(call.params[0], call.params[1]);
          }
          if (sql.startsWith('DELETE FROM attempts')) {
            for (let i = attempts.length - 1; i >= 0; i--) {
              if (attempts[i] < call.params[0]) attempts.splice(i, 1);
            }
          }
        },
        async first() {
          if (sql.startsWith('SELECT reset_at')) {
            return { reset_at: markers.get(call.params[0]) };
          }
        }
      };
    }
  };
}

test('first mobile visit resets previous attempts but retains new entries', async () => {
  const db = fakeDb();
  assert.equal(await initializeMobileRanking(db, 2000), 2000);
  assert.deepEqual(db.attempts, [2000, 2500]);
  assert.equal(db.log.some(e => e.sql.startsWith('DELETE FROM attempts') && e.params[0] === 2000), true);
});

test('subsequent Worker initialization cannot erase new records', async () => {
  const db = fakeDb();
  await initializeMobileRanking(db, 2000);
  assert.equal(await initializeMobileRanking(db, 9999), 2000);
  assert.deepEqual(db.attempts, [2000, 2500]);
  assert.equal(MOBILE_RANKING_RELEASE, 'mobile-only-v1');
});
