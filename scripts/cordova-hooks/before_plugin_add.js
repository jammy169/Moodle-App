#!/usr/bin/env node

/**
 * Cordova loads .js hooks via require(); calling process.exit() would terminate
 * the entire Cordova CLI before prepare/build. Export a hook function instead.
 * @see https://cordova.apache.org/docs/en/latest/guide/appdev/hooks.html
 */

const { spawnSync } = require('child_process');
const { join } = require('path');
const { existsSync } = require('fs');

const pluginDir = join(__dirname, '..', '..', 'cordova-plugin-moodleapp');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

module.exports = function beforePluginAdd() {
    if (!existsSync(pluginDir)) {
        console.error('cordova-plugin-moodleapp directory not found:', pluginDir);
        throw new Error('cordova-plugin-moodleapp directory not found');
    }

    console.log('Building cordova-plugin-moodleapp');

    const windowsCommand = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : npmCmd;
    const windowsArgs = process.platform === 'win32' ? ['/c', 'npm', 'run', 'prod'] : ['run', 'prod'];

    const result = spawnSync(windowsCommand, windowsArgs, {
        cwd: pluginDir,
        stdio: 'inherit',
    });

    if (result.error) {
        console.error('Error running npm run prod for cordova-plugin-moodleapp:', result.error);
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(`npm run prod failed with exit code ${result.status}`);
    }
};
