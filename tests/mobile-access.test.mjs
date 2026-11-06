import test from 'node:test';
import assert from 'node:assert/strict';
import { isMobilePlatformUserAgent, supportsMobilePlay, isMobileRequest } from '../lib/mobile-access.mjs';

const android = 'Mozilla/5.0 (Linux; Android 17; SM-S948N) AppleWebKit/537.36 Chrome/143 Mobile Safari/537.36';
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1 Mobile/15E148';
const ipad = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1 Mobile/15E148';
const windows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/143 Safari/537.36';
const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/605.1 Safari/605.1';

test('Android phones and tablets, iPhone and iPad user agents qualify', () => {
  for (const ua of [android, iphone, ipad, 'Mozilla/5.0 (Linux; Android 14; Tablet)']) {
    assert.equal(isMobilePlatformUserAgent(ua), true);
    assert.equal(supportsMobilePlay({ userAgent: ua, touchPoints: 5, coarsePointer: true }), true);
    assert.equal(isMobileRequest({ headers: new Headers({ 'user-agent': ua }) }), true);
  }
});

test('Windows, Mac, ChromeOS, missing UA and touchscreen PCs are blocked', () => {
  for (const ua of [windows, mac, 'Mozilla/5.0 (X11; CrOS x86_64)', '', null]) {
    assert.equal(isMobilePlatformUserAgent(ua), false);
    assert.equal(supportsMobilePlay({ userAgent: ua, touchPoints: 10, coarsePointer: true }), false);
  }
  assert.equal(isMobileRequest({ headers: new Headers({ 'user-agent': windows, 'sec-ch-ua-mobile': '?1' }) }), false);
});

test('A mobile UA without a touch-capable input is blocked in the UI', () => {
  assert.equal(supportsMobilePlay({ userAgent: android, touchPoints: 0, coarsePointer: false }), false);
  assert.equal(supportsMobilePlay({ userAgent: android, touchPoints: 0, coarsePointer: true }), true);
});
