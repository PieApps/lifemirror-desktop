#!/usr/bin/env node
/**
 * LifeMirror Development Data Reset Tool (Cross-platform)
 * 
 * Safely resets/clears the local development data folder across Windows,
 * macOS, and Linux, ensuring production data (~/.local/share/lifemirror-desktop)
 * is never touched.
 * 
 * Usage:
 *   npm run dev:reset-data
 *   node scripts/reset-dev-data.mjs [--all]
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

function log(msg) { console.log(msg); }
function ok(msg) { console.log(`  ✅ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function err(msg) { console.error(`  ❌ ${msg}`); }

/** Resolves development data directory across OSes. */
function getDevDataDir() {
  const home = os.homedir();
  if (isWindows) {
    const base = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return path.join(base, 'lifemirror-dev');
  }
  if (isMac) {
    const base = process.env.XDG_DATA_HOME || path.join(home, 'Library', 'Application Support');
    const cand1 = path.join(base, 'lifemirror-dev');
    if (fs.existsSync(cand1)) return cand1;
    return path.join(home, '.local', 'share', 'lifemirror-dev');
  }
  // Linux / BSD
  const base = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  return path.join(base, 'lifemirror-dev');
}

/** Resolves development Knowledge Vault documents directory. */
function getDevVaultDir() {
  const home = os.homedir();
  return path.join(home, 'Documents', 'LifeMirror Vault (Dev)');
}

function getDirSize(dirPath) {
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += getDirSize(fullPath);
      } else if (entry.isFile()) {
        total += fs.statSync(fullPath).size;
      }
    }
  } catch (_) {}
  return total;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function main() {
  const args = process.argv.slice(2);
  const resetVault = args.includes('--all') || args.includes('--vault');

  log('\n🧹 LifeMirror: Reset Development Data\n');

  const devDir = getDevDataDir();
  log(`Target Development directory: ${devDir}`);

  // Safety invariant check: NEVER allow resetting production folder
  if (devDir.endsWith('lifemirror-desktop') || devDir.endsWith('lifemirror')) {
    err(`CRITICAL SAFETY ABORT: Refusing to delete directory matching production name: ${devDir}`);
    process.exit(1);
  }

  let cleanedAny = false;

  if (fs.existsSync(devDir)) {
    const size = getDirSize(devDir);
    fs.rmSync(devDir, { recursive: true, force: true });
    ok(`Cleared development data directory (${formatBytes(size)})`);
    cleanedAny = true;
  } else {
    info(`Development data directory is already empty or does not exist.`);
  }

  // Also reset dev webview cache if present (~/.local/share/com.lifemirror.desktop.dev)
  const home = os.homedir();
  const webviewDevDirs = [
    path.join(home, '.local', 'share', 'com.lifemirror.desktop.dev'),
    isWindows ? path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'com.lifemirror.desktop.dev') : null,
  ].filter(Boolean);

  for (const wDir of webviewDevDirs) {
    if (fs.existsSync(wDir)) {
      try {
        fs.rmSync(wDir, { recursive: true, force: true });
        ok(`Cleared development webview cache: ${path.basename(wDir)}`);
        cleanedAny = true;
      } catch (_) {}
    }
  }

  if (resetVault) {
    const devVault = getDevVaultDir();
    if (fs.existsSync(devVault)) {
      const vSize = getDirSize(devVault);
      fs.rmSync(devVault, { recursive: true, force: true });
      ok(`Cleared development Knowledge Vault (${formatBytes(vSize)})`);
      cleanedAny = true;
    }
  }

  if (cleanedAny) {
    log('\n✨ Development data has been reset successfully!');
  } else {
    log('\n✨ Development environment is already clean.');
  }

  log('   • Start clean development:   npm run tauri:dev');
  log('   • Import production data:    npm run dev:merge-data\n');
}

main().catch(e => {
  err(`Reset failed: ${e.message}`);
  process.exit(1);
});
