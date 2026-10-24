import { describe, expect, it } from 'vitest';
import { classifySensor, detectBrowser, howToEnable, sensorMessage } from '../../src/sensor.js';

const phone = {
  hasApi: true,
  isTouch: true,
  permission: 'prompt',
  needsTap: false,
  reading: 'none',
  timedOut: false,
};

describe('classifySensor', () => {
  it('is ok as soon as real readings arrive, whatever else is going on', () => {
    expect(classifySensor({ ...phone, reading: 'values' })).toBe('ok');
    expect(classifySensor({ ...phone, reading: 'values', permission: 'denied' })).toBe('ok');
  });

  it('is unavailable without the DeviceOrientation API', () => {
    expect(classifySensor({ ...phone, hasApi: false })).toBe('unavailable');
  });

  it('is blocked when the browser reports sensor permission denied', () => {
    expect(classifySensor({ ...phone, permission: 'denied' })).toBe('blocked');
  });

  it('is unavailable when the browser sends an empty event (no sensor hardware)', () => {
    expect(classifySensor({ ...phone, reading: 'empty' })).toBe('unavailable');
  });

  it('waits for a tap on iOS before it can know', () => {
    expect(classifySensor({ ...phone, needsTap: true, timedOut: true })).toBe('needs-permission');
  });

  it('keeps checking until the first reading has had time to arrive', () => {
    expect(classifySensor(phone)).toBe('checking');
  });

  it('a silent phone after the timeout is probably blocked; a silent desktop has no sensor', () => {
    expect(classifySensor({ ...phone, timedOut: true })).toBe('silent');
    expect(classifySensor({ ...phone, isTouch: false, timedOut: true })).toBe('unavailable');
  });
});

describe('detectBrowser', () => {
  const UA = {
    chrome:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36',
    samsung:
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36',
    edge: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36 EdgA/141.0',
    firefox: 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
    iphone:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  };

  it.each([
    ['chrome', UA.chrome],
    ['samsung', UA.samsung],
    ['edge', UA.edge],
    ['firefox', UA.firefox],
    ['ios', UA.iphone],
    ['other', 'SomethingElse/1.0'],
  ])('recognises %s', (expected, ua) => {
    expect(detectBrowser(ua)).toBe(expected);
  });

  it('spots iPads that pretend to be Macs by their touch points', () => {
    expect(detectBrowser(UA.ipad, { maxTouchPoints: 5 })).toBe('ios');
    expect(detectBrowser(UA.ipad, { maxTouchPoints: 0 })).toBe('other');
  });

  it('trusts navigator.brave over the (Chrome-looking) user agent', () => {
    expect(detectBrowser(UA.chrome, { isBrave: true })).toBe('brave');
  });
});

describe('howToEnable', () => {
  it('gives browser-specific steps', () => {
    expect(howToEnable('brave')).toContain('Site and Shields settings');
    expect(howToEnable('chrome')).toContain('Motion sensors');
    expect(howToEnable('samsung')).toContain('Samsung Internet');
    expect(howToEnable('edge')).toContain('Edge');
    expect(howToEnable('ios')).toContain('tap Allow');
    expect(howToEnable('firefox')).toContain('Chrome');
  });

  it('falls back to generic steps', () => {
    expect(howToEnable('other')).toContain('site settings');
    expect(howToEnable('netscape')).toBe(howToEnable('other'));
  });
});

describe('sensorMessage', () => {
  it('reassures when ready and informs while checking or before the iOS prompt', () => {
    expect(sensorMessage('ok', 'chrome', true).tone).toBe('ok');
    expect(sensorMessage('checking', 'chrome', true).tone).toBe('info');
    expect(sensorMessage('needs-permission', 'ios', true)).toMatchObject({ tone: 'info' });
  });

  it('warns with fix-it steps when blocked or silent', () => {
    const blocked = sensorMessage('blocked', 'brave', true);
    expect(blocked.tone).toBe('warn');
    expect(blocked.text).toContain('blocked');
    expect(blocked.text).toContain(howToEnable('brave'));
    const silent = sensorMessage('silent', 'chrome', true);
    expect(silent.tone).toBe('warn');
    expect(silent.text).toContain(howToEnable('chrome'));
  });

  it('points desktops at the keyboard and tells phones there is no sensor', () => {
    expect(sensorMessage('unavailable', 'chrome', false)).toMatchObject({ tone: 'info' });
    expect(sensorMessage('unavailable', 'chrome', false).text).toContain('arrow keys');
    expect(sensorMessage('unavailable', 'chrome', true).tone).toBe('warn');
  });
});
