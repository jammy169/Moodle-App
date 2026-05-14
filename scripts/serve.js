#!/usr/bin/env node

/**
 * Cross-platform serve script for Windows, Mac, and Linux
 * Replaces serve.sh for compatibility
 */

const { spawn } = require('child_process');
const path = require('path');

// Start gulp watch in background
console.log('> gulp watch &');
spawn('gulp', ['watch'], {
    stdio: 'inherit',
    shell: true,
    detached: true,
});

// Give gulp a moment to start
setTimeout(() => {
    // Parse arguments
    const args = process.argv.slice(2);
    let angularTarget = 'serve';
    const filteredArgs = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--project=')) {
            // Skip project argument - not needed for ng run
            continue;
        } else if (arg.startsWith('--platform=')) {
            angularTarget = 'ionic-cordova-serve';
            filteredArgs.push(arg);
        } else {
            filteredArgs.push(arg);
        }
    }

    // Run ng serve
    const ngArgs = ['run', `app:${angularTarget}`, ...filteredArgs];
    console.log(`> NODE_OPTIONS=--max-old-space-size=4096 ng ${ngArgs.join(' ')}`);

    const ngProcess = spawn('npm', ['run', 'ng', '--', ...ngArgs], {
        stdio: 'inherit',
        shell: true,
    });

    ngProcess.on('exit', (code) => {
        process.exit(code);
    });
}, 1000);
