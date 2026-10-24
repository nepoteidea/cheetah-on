// Works out whether tilt control can work on this device and, when it can't, tells the
// player why and how to fix it. Pure functions: main.js gathers the facts from the browser.

/**
 * @param {object} facts
 * @param {boolean} facts.hasApi       window.DeviceOrientationEvent exists
 * @param {boolean} facts.isTouch      touch-first device (a phone or tablet)
 * @param {string}  facts.permission   'granted' | 'denied' | 'prompt' | 'unsupported'
 * @param {boolean} facts.needsTap     iOS-style: access is only granted from a tap
 * @param {string}  facts.reading      'none' | 'empty' (event without values) | 'values'
 * @param {boolean} facts.timedOut     we've waited long enough for a first reading
 * @returns {'ok'|'checking'|'needs-permission'|'blocked'|'silent'|'unavailable'}
 */
export function classifySensor({ hasApi, isTouch, permission, needsTap, reading, timedOut }) {
  if (!hasApi) return 'unavailable';
  if (reading === 'values') return 'ok';
  if (permission === 'denied') return 'blocked';
  if (reading === 'empty') return 'unavailable'; // the browser says there's no sensor
  if (needsTap) return 'needs-permission';
  if (!timedOut) return 'checking';
  // Desktops just don't have one; a silent phone almost always means it's blocked.
  return isTouch ? 'silent' : 'unavailable';
}

/** Which browser the player is on, as far as the instructions are concerned. */
export function detectBrowser(userAgent, { isBrave = false, maxTouchPoints = 0 } = {}) {
  if (isBrave) return 'brave';
  const ios =
    /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (ios) return 'ios';
  if (/SamsungBrowser/.test(userAgent)) return 'samsung';
  if (/Firefox/.test(userAgent)) return 'firefox';
  if (/EdgA?\//.test(userAgent)) return 'edge';
  if (/Chrome|CriOS/.test(userAgent)) return 'chrome';
  return 'other';
}

const HOW_TO_ENABLE = {
  brave: 'In Brave: menu ⋮ → Settings → Site and Shields settings → Motion sensors → Allow.',
  chrome:
    'In Chrome: tap the icon left of the address → Permissions → Motion sensors → Allow. Or menu ⋮ → Settings → Site settings → Motion sensors.',
  edge: 'In Edge: menu → Settings → Privacy and security → Site permissions → Motion sensors → Allow.',
  samsung:
    'In Samsung Internet: menu → Settings → Sites and downloads → Site permissions → Motion sensors → Allow.',
  ios: 'On iPhone: close this tab, open the site again and tap Allow when asked for motion access.',
  firefox: "Firefox doesn't let you turn motion sensors off, so try another browser like Chrome.",
  other: "Allow Motion sensors in your browser's site settings, or try Chrome.",
};

export function howToEnable(browser) {
  return HOW_TO_ENABLE[browser] ?? HOW_TO_ENABLE.other;
}

/** What to tell the player. `tone` is 'ok', 'info' or 'warn'. */
export function sensorMessage(status, browser, isTouch) {
  switch (status) {
    case 'ok':
      return { tone: 'ok', text: 'Tilt sensor ready.' };
    case 'checking':
      return { tone: 'info', text: 'Checking the tilt sensor…' };
    case 'needs-permission':
      return { tone: 'info', text: 'When you tap Play, allow motion access so tilting works.' };
    case 'blocked':
      return {
        tone: 'warn',
        text: `Motion sensors are blocked, so tilting won't move the ball. ${howToEnable(browser)}`,
      };
    case 'silent':
      return {
        tone: 'warn',
        text: `Your phone isn't sending tilt data. Motion sensors are probably blocked. ${howToEnable(browser)}`,
      };
    default:
      return isTouch
        ? { tone: 'warn', text: "This device doesn't have a tilt sensor the browser can use." }
        : { tone: 'info', text: 'No tilt sensor on this device. Use the arrow keys or WASD.' };
  }
}
