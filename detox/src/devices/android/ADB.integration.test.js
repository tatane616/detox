jest.mock('../../utils/logger');

const fs = require('fs-extra');
const tempfile = require('tempfile');
const path = require('path');
const ADB = require('./ADB');

const MOCK_DIR = path.join(__dirname, '__mocks__');
const CAT_MOCK = path.join(MOCK_DIR, 'adb-catmock');

describe('ADB', () => {
  let adb;

  describe('.pidof()', () => {
    it(`should work with CRLF endings`, async () => {
      const adb = new ADB({
        adbBin: `${CAT_MOCK} ${path.join(MOCK_DIR, 'ps-crlf.txt')}`,
      });

      expect(await adb.pidof('', 'com.google.android.gms')).toBe(2160);
      expect(await adb.pidof('', 'com.google.android.gms.unstable')).toBe(2504);
      expect(await adb.pidof('', 'com.google.android.gms.persistent')).toBe(1969);
    });

    it(`should work with LF endings`, async () => {
      const adb = new ADB({
        adbBin: `${CAT_MOCK} ${path.join(MOCK_DIR, 'ps-lf.txt')}`,
      });

      expect(await adb.pidof('', 'com.google.android.gms')).toBe(2160);
      expect(await adb.pidof('', 'com.google.android.gms.unstable')).toBe(2504);
      expect(await adb.pidof('', 'com.google.android.gms.persistent')).toBe(1969);
    });

    it(`should return NaN if process was not found`, async () => {
      const adb = new ADB({
        adbBin: `${CAT_MOCK} /dev/null`,
      });

      expect(await adb.pidof('', 'com.google.android.gms')).toBe(NaN);
    });
  });

  describe('unlockScreen', () => {
    const deviceId = 'mockEmulator';
    let tempPath;

    beforeEach(() => {
      tempPath = tempfile();
      adb = new ADB({
        adbBin: `${CAT_MOCK} ${tempPath}`,
      });

      jest.spyOn(adb, 'shell');
    });

    afterEach(async () => {
      await fs.remove(tempPath);
    });

    async function unlockScreenWithPowerStatus(mWakefulness, mUserActivityTimeoutOverrideFromWindowManager) {
      const contents = `
        mWakefulness=${mWakefulness}
        mWakefulnessChanging=false
        mWakeLockSummary=0x0
        mUserActivitySummary=0x1
        mWakeUpWhenPluggedOrUnpluggedConfig=false
        mWakeUpWhenPluggedOrUnpluggedInTheaterModeConfig=false
        mUserActivityTimeoutOverrideFromWindowManager=${mUserActivityTimeoutOverrideFromWindowManager}
        mUserInactiveOverrideFromWindowManager=false
      `;

      await fs.writeFile(tempPath, contents);
      await adb.unlockScreen(deviceId);
    }

    describe('when unlocking an awake and unlocked device', function() {
      beforeEach(async () => unlockScreenWithPowerStatus('Awake', '-1'));

      it('should not press power button', () =>
        expect(adb.shell).not.toHaveBeenCalledWith(deviceId, 'input keyevent KEYCODE_POWER'));

      it('should not press menu button', () =>
        expect(adb.shell).not.toHaveBeenCalledWith(deviceId, 'input keyevent KEYCODE_MENU'));
    });

    describe('when unlocking a sleeping and locked device', function() {
      beforeEach(async () => unlockScreenWithPowerStatus('Asleep', '10000'));

      it('should press power button first', () =>
        expect(adb.shell.mock.calls[1]).toEqual([deviceId, 'input keyevent KEYCODE_POWER']));

      it('should press menu afterwards', () =>
        expect(adb.shell.mock.calls[2]).toEqual([deviceId, 'input keyevent KEYCODE_MENU']));
    });

    describe('when unlocking an awake but locked device', function() {
      beforeEach(async () => unlockScreenWithPowerStatus('Awake', '10000'));

      it('should not press power button', () =>
        expect(adb.shell).not.toHaveBeenCalledWith(deviceId, 'input keyevent KEYCODE_POWER'));

      it('should press menu button', () =>
        expect(adb.shell).toHaveBeenCalledWith(deviceId, 'input keyevent KEYCODE_MENU'));
    });

    describe('when unlocking a sleeping but unlocked device', function() {
      beforeEach(async () => unlockScreenWithPowerStatus('Asleep', '-1'));

      it('should press power button', () =>
        expect(adb.shell).toHaveBeenCalledWith(deviceId, 'input keyevent KEYCODE_POWER'));

      it('should not press menu button', () =>
        expect(adb.shell).not.toHaveBeenCalledWith(deviceId, 'input keyevent KEYCODE_MENU'));
    });
  });
});

