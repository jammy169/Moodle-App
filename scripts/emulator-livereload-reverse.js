#!/usr/bin/env node

/**
 * Maps emulator/device localhost:8100 -> host PC port 8100 (adb reverse).
 * Required for livereload when using --public-host=localhost in the WebView.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function resolveAdb() {
    const r = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['adb'], {
        encoding: 'utf8',
        shell: true,
    });
    const first = r.stdout?.trim().split(/\r?\n/)[0];
    if (first && fs.existsSync(first)) {
        return first;
    }
    const local = path.join(
        process.env.LOCALAPPDATA || '',
        'Android',
        'Sdk',
        'platform-tools',
        process.platform === 'win32' ? 'adb.exe' : 'adb',
    );
    if (fs.existsSync(local)) {
        return local;
    }
    return 'adb';
}

function pickDeviceSerial(adb) {
    const r = spawnSync(adb, ['devices'], { encoding: 'utf8' });
    const lines = (r.stdout || '').split(/\r?\n/).filter((l) => /\tdevice$/.test(l));
    if (lines.length === 0) {
        return null;
    }
    const em = lines.find((l) => l.startsWith('emulator-'));
    if (em) {
        return em.split('\t')[0];
    }
    return lines[0].split('\t')[0];
}

const adb = resolveAdb();
const serial = pickDeviceSerial(adb);
if (!serial) {
    console.warn(
        '[emulator-livereload] No adb device in "device" state; skip adb reverse. ' +
            'Start an emulator or connect a phone, then rerun if localhost:8100 fails.',
    );
    process.exit(0);
}

const rr = spawnSync(adb, ['-s', serial, 'reverse', 'tcp:8100', 'tcp:8100'], {
    stdio: 'inherit',
    shell: false,
});
if (rr.status !== 0) {
    console.warn(`[emulator-livereload] adb reverse failed (exit ${rr.status}). Continuing anyway.`);
} else {
    console.log(`[emulator-livereload] adb reverse tcp:8100 -> tcp:8100 on ${serial}`);
}
