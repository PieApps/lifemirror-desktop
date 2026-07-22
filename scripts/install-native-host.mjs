#!/usr/bin/env node
/**
 * LifeMirror Native Messaging Host Installer (Cross-platform)
 * Works on Windows, macOS, and Linux — requires only Node.js.
 *
 * Usage:
 *   node scripts/install-native-host.mjs
 *   node scripts/install-native-host.mjs --release
 *   EXTENSION_ID=abc... node scripts/install-native-host.mjs
 *
 * Or via npm:
 *   npm run install-host
 *   npm run install-host -- --release
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ── Helpers ───────────────────────────────────────────────────────────────────

const isWindows = process.platform === 'win32';
const isMac     = process.platform === 'darwin';

function log(msg)  { console.log(msg); }
function ok(msg)   { console.log(`  ✅ ${msg}`); }
function err(msg)  { console.error(`  ❌ ${msg}`); }
function warn(msg) { console.warn(`  ⚠️  ${msg}`); }

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

/** Read KEY=value pairs from a .env file (no external dep needed). */
function readEnvFile(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    result[key] = val;
  }
  return result;
}

/** Returns the Chrome NativeMessagingHosts directory for the current OS. */
function getNativeHostDir(browser = 'chrome') {
  const home = os.homedir();
  if (isWindows) {
    // On Windows the path is registered via the registry (handled below),
    // but we still write the JSON to a known location first.
    return path.join(home, 'AppData', 'Local', 'LifeMirror', 'NativeMessagingHosts');
  }
  if (isMac) {
    return browser === 'chrome'
      ? path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts')
      : path.join(home, 'Library', 'Application Support', 'Chromium', 'NativeMessagingHosts');
  }
  // Linux
  return browser === 'chrome'
    ? path.join(home, '.config', 'google-chrome', 'NativeMessagingHosts')
    : path.join(home, '.config', 'chromium', 'NativeMessagingHosts');
}

/** On Windows, Chrome finds the native host via a registry key, not a directory.
 *  We write the key pointing at the JSON file path. */
function registerWindowsRegistry(manifestPath) {
  const regKey = 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.lifemirror.desktop';
  try {
    // Use reg.exe which is always available on Windows
    execSync(`reg add "${regKey}" /ve /t REG_SZ /d "${manifestPath}" /f`, { stdio: 'pipe' });
    ok(`Registry key set: ${regKey}`);
    ok(`Points to: ${manifestPath}`);
  } catch (e) {
    warn('Could not write registry key automatically.');
    log(`     Run this manually in Command Prompt (as Admin):`);
    log(`     reg add "${regKey}" /ve /t REG_SZ /d "${manifestPath}" /f`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const buildType = args.includes('--release') ? 'release' : 'debug';

  // Binary path differs by OS
  const binaryName = isWindows ? 'lifemirror.exe' : 'lifemirror';
  const binaryPath = path.join(PROJECT_ROOT, 'src-tauri', 'target', buildType, binaryName);

  log('======================================================');
  log(' LifeMirror Native Messaging Host - Install & Diagnose');
  log('======================================================');
  log(`  Platform   : ${process.platform}`);
  log(`  Build type : ${buildType}`);
  log(`  Binary path: ${binaryPath}`);

  // ── Resolve Extension ID ─────────────────────────────────────────────────────
  log('\n▶ Resolving Chrome Extension ID...');

  let extensionId = process.env.EXTENSION_ID;

  if (!extensionId) {
    const envVars = readEnvFile(path.join(PROJECT_ROOT, '.env'));
    extensionId = envVars['EXTENSION_ID'];
  }

  if (!extensionId) {
    log('\n  No EXTENSION_ID found in env or .env file.');
    log('  Find it at: chrome://extensions → enable Developer Mode → your extension ID');
    log('  Tip: add EXTENSION_ID=yourId to .env so you never need to type it again.\n');
    extensionId = await prompt('  Enter your Chrome Extension ID: ');
  }

  // Validate: 32 lowercase letters
  if (!/^[a-z]{32}$/.test(extensionId)) {
    err(`'${extensionId}' is not a valid Chrome extension ID (must be 32 lowercase letters).`);
    err('Example: hcpagmeofngagbmahpccoajilpndckab');
    process.exit(1);
  }
  ok(`Extension ID: ${extensionId}`);

  // ── Generate manifest from template ─────────────────────────────────────────
  log('\n▶ Generating manifest from template...');
  const templatePath = path.join(PROJECT_ROOT, 'companion-extension', 'com.lifemirror.desktop.json.template');
  const manifestOut  = path.join(PROJECT_ROOT, 'companion-extension', 'com.lifemirror.desktop.json');

  if (!fs.existsSync(templatePath)) {
    err(`Template not found: ${templatePath}`);
    process.exit(1);
  }

  const generated = fs.readFileSync(templatePath, 'utf8')
    .replaceAll('{{EXTENSION_ID}}', extensionId)
    .replaceAll('{{BINARY_PATH}}',  binaryPath);

  fs.writeFileSync(manifestOut, generated, 'utf8');
  ok(`Generated: ${manifestOut}`);

  // ── Verify binary ────────────────────────────────────────────────────────────
  log('\n▶ Checking binary...');
  if (fs.existsSync(binaryPath)) {
    ok(`Binary found: ${binaryPath}`);
    if (!isWindows) {
      // chmod is a no-op on Windows
      fs.chmodSync(binaryPath, 0o755);
      ok('Executable bit set');
    }
  } else {
    err(`Binary NOT found at: ${binaryPath}`);
    err(`Run: npm run tauri dev   (for debug)  or  npm run tauri build   (for release)`);
    process.exit(1);
  }

  // ── Install manifest ─────────────────────────────────────────────────────────
  if (isWindows) {
    log('\n▶ Installing manifest for Google Chrome (Windows registry)...');
    const winHostDir = getNativeHostDir('chrome');
    fs.mkdirSync(winHostDir, { recursive: true });
    const winManifestPath = path.join(winHostDir, 'com.lifemirror.desktop.json');
    fs.copyFileSync(manifestOut, winManifestPath);
    ok(`Copied to: ${winManifestPath}`);
    registerWindowsRegistry(winManifestPath);
  } else {
    // Linux / macOS
    const chromeDir = getNativeHostDir('chrome');
    log(`\n▶ Installing manifest for Google Chrome...`);
    fs.mkdirSync(chromeDir, { recursive: true });
    fs.copyFileSync(manifestOut, path.join(chromeDir, 'com.lifemirror.desktop.json'));
    ok(`Installed to: ${path.join(chromeDir, 'com.lifemirror.desktop.json')}`);

    const chromiumBase = isMac
      ? path.join(os.homedir(), 'Library', 'Application Support', 'Chromium')
      : path.join(os.homedir(), '.config', 'chromium');

    if (fs.existsSync(chromiumBase)) {
      const chromiumDir = getNativeHostDir('chromium');
      log('\n▶ Chromium detected — installing there too...');
      fs.mkdirSync(chromiumDir, { recursive: true });
      fs.copyFileSync(manifestOut, path.join(chromiumDir, 'com.lifemirror.desktop.json'));
      ok(`Installed to: ${path.join(chromiumDir, 'com.lifemirror.desktop.json')}`);
    }
  }

  // ── Show installed manifest ──────────────────────────────────────────────────
  log('\n▶ Installed manifest contents:');
  log(generated);

  log('======================================================');
  log(' Done! Next steps:');
  log('   1. Reload the Chrome extension at chrome://extensions');
  log("   2. Click 'Service Worker' inspect link → check Console for errors");
  log('   3. Browse a few tabs, then refresh the LifeMirror app');
  log('======================================================');
}

main().catch(e => { console.error(e); process.exit(1); });
