// Admission policy for the smartphone/tablet browser version of the game.
// This is an abuse deterrent, not cryptographic proof of a physical device.
// Do not treat viewport size, a touch-screen laptop, or UA-CH mobile preference
// by themselves as sufficient evidence of a mobile platform.
const MOBILE_UA = /Android|iPhone|iPad|iPod|Windows Phone|IEMobile/i;
const DESKTOP_UA = /Windows NT|CrOS|Linux x86_64|X11|Macintosh/i;

export function isMobilePlatformUserAgent(userAgent) {
  return typeof userAgent === "string"
    && MOBILE_UA.test(userAgent)
    && !DESKTOP_UA.test(userAgent);
}

export function supportsMobilePlay({ userAgent, touchPoints, coarsePointer }) {
  return isMobilePlatformUserAgent(userAgent)
    && (Number(touchPoints) > 0 || coarsePointer === true);
}

export function isMobileRequest(request) {
  return isMobilePlatformUserAgent(request.headers.get("user-agent"));
}
