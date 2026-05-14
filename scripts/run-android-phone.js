#!/usr/bin/env node

/**
 * Livereload on a physical Android device over Wi‑Fi.
 * Picks this PC's LAN IPv4 (or MOODLE_LIVERELOAD_HOST) for --public-host.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function resolveAdb() {
    const fromPath = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['adb'], {
        encoding: 'utf8',
        shell: true,
    });
    const first = fromPath.stdout?.trim().split(/\r?\n/)[0];
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

/**
 * @returns {{ ok: boolean, message?: string }}
 */
function checkAdbAndroid() {
    const adb = resolveAdb();
    const r = spawnSync(adb, ['devices'], { encoding: 'utf8', shell: false });
    if (r.error && r.error.code === 'ENOENT') {
        return {
            ok: false,
            message:
                '**adb** was not found. Install Android SDK **Platform-Tools** and add them to PATH, or install Android Studio so adb exists under %LOCALAPPDATA%\\Android\\Sdk\\platform-tools\\adb.exe',
        };
    }
    const out = `${r.stdout || ''}\n${r.stderr || ''}`;
    const lines = out.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('List of devices'));
    let authorized = 0;
    let unauthorized = 0;
    let offline = 0;
    for (const line of lines) {
        const parts = line.split(/\s+/);
        const state = parts[parts.length - 1];
        if (state === 'device') {
            authorized++;
        } else if (state === 'unauthorized') {
            unauthorized++;
        } else if (state === 'offline') {
            offline++;
        }
    }
    if (authorized > 0) {
        return { ok: true };
    }
    if (unauthorized > 0) {
        return {
            ok: false,
            message:
                'ADB sees your phone as "unauthorized". Unlock the phone and tap **Allow USB debugging** (check "Always allow" if shown), then run this again.',
        };
    }
    if (offline > 0) {
        return {
            ok: false,
            message:
                'ADB reports the device as offline. Unplug/replug USB, try another cable or USB port, then run **adb kill-server** and retry.',
        };
    }
    return {
        ok: false,
        message: `No Android device detected by ADB.

Do this on the phone:
  • Settings → About phone → tap **Build number** 7× to enable Developer options
  • Settings → Developer options → enable **USB debugging**
  • Plug in USB; when prompted, allow debugging from this computer

On the PC (PowerShell):
  ${adb} devices

You should see a line ending with **device** (not "unauthorized" or empty).
If the list is empty: install your phone vendor **USB driver**, or try **File transfer / MTP** USB mode (not charge-only).`,
    };
}

function ipv4Score(address) {
    if (address.startsWith('192.168.')) {
        return 0;
    }
    if (address.startsWith('10.')) {
        return 1;
    }
    const m = /^172\.(1[6-9]|2\d|3[0-1])\./.exec(address);
    return m ? 2 : 3;
}

function interfacePriority(name) {
    const n = name.toLowerCase();
    if (/wi-?fi|wlan|wireless|802\.11/.test(n)) {
        return 0;
    }
    if (/ethernet|eth|en[0-9]|eno|usb|rndis/.test(n)) {
        return 1;
    }
    return 2;
}

function pickLanIPv4() {
    const fromEnv = (process.env.MOODLE_LIVERELOAD_HOST || '').trim();
    if (fromEnv) {
        return fromEnv;
    }

    const nets = os.networkInterfaces();
    const candidates = [];

    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            const fam = net.family;
            if (fam !== 'IPv4' && fam !== 4) {
                continue;
            }
            if (net.internal) {
                continue;
            }
            const address = net.address;
            if (address.startsWith('169.254.')) {
                continue;
            }
            candidates.push({
                address,
                name,
                ifacePri: interfacePriority(name),
                ipPri: ipv4Score(address),
            });
        }
    }

    candidates.sort((a, b) => {
        if (a.ifacePri !== b.ifacePri) {
            return a.ifacePri - b.ifacePri;
        }
        if (a.ipPri !== b.ipPri) {
            return a.ipPri - b.ipPri;
        }
        return a.address.localeCompare(b.address);
    });

    return candidates[0]?.address;
}

const ip = pickLanIPv4();
if (!ip) {
    console.error(
        'Could not detect a LAN IPv4. Set MOODLE_LIVERELOAD_HOST to your PC Wi‑Fi address (e.g. 192.168.0.107) and retry.',
    );
    process.exit(1);
}

console.log('');
console.log('Physical device livereload');
console.log(`  Using --public-host=${ip}`);
console.log('  Phone and this PC must be on the same Wi‑Fi.');
console.log('  USB: enable Developer options + USB debugging (for install).');
console.log('  If the app cannot load: allow Node.js inbound on port 8100 (Windows Firewall, Private network).');
console.log('  Override IP: set MOODLE_LIVERELOAD_HOST=192.168.x.x');
console.log('  Multiple devices: set MOODLE_ANDROID_TARGET to serial from **adb devices**');
console.log('');

const adbCheck = checkAdbAndroid();
if (!adbCheck.ok) {
    console.error(adbCheck.message);
    console.error('');
    process.exit(1);
}

const projectRoot = path.join(__dirname, '..');
const args = [
    'cordova',
    'run',
    'android',
    '--livereload',
    '--external',
    '--no-native-run',
    `--public-host=${ip}`,
];
const target = (process.env.MOODLE_ANDROID_TARGET || '').trim();
if (target) {
    args.push('--', '--target', target);
}

const cmd = process.platform === 'win32' ? 'ionic.cmd' : 'ionic';
const result = spawnSync(cmd, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true,
    env: process.env,
});

process.exit(result.status === null ? 1 : result.status);
