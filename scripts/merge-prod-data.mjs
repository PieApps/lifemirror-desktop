#!/usr/bin/env node
/**
 * LifeMirror Production Data Import/Merge Tool (Cross-platform)
 * 
 * Safely copies or merges the production encrypted database and credentials
 * into the local development environment (~/.local/share/lifemirror-dev/),
 * allowing developers to test features with realistic working data.
 * 
 * Invariants:
 *  - Production database is opened in READ-ONLY mode (never modified).
 *  - Existing development database is backed up before replacement.
 *  - Encryption keys (.vault_key) are safely replicated into dev.
 *  - Stale dev locks are cleaned up.
 * 
 * Usage:
 *   npm run dev:merge-data
 *   npm run dev:import-prod
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

function log(msg) { console.log(msg); }
function ok(msg) { console.log(`  ✅ ${msg}`); }
function warn(msg) { console.warn(`  ⚠️  ${msg}`); }
function err(msg) { console.error(`  ❌ ${msg}`); }

/** Resolves production data directory across OSes. */
function getProdDataDir() {
  const home = os.homedir();
  if (isWindows) {
    const base = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return path.join(base, 'lifemirror-desktop');
  }
  if (isMac) {
    const base = process.env.XDG_DATA_HOME || path.join(home, 'Library', 'Application Support');
    const cand1 = path.join(base, 'lifemirror-desktop');
    if (fs.existsSync(cand1)) return cand1;
    return path.join(home, '.local', 'share', 'lifemirror-desktop');
  }
  // Linux / BSD
  const base = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  return path.join(base, 'lifemirror-desktop');
}

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

/** Resolves Knowledge Vault documents directory. */
function getVaultDirs() {
  const home = os.homedir();
  const docs = path.join(home, 'Documents');

  // Find existing production vault
  let prodVault = null;
  const prodCandidates = [
    path.join(docs, 'LifeMirror Vault'),
    path.join(docs, 'LifeMirrorVault'),
    path.join(home, 'LifeMirror Vault'),
  ];
  for (const c of prodCandidates) {
    if (fs.existsSync(c)) {
      prodVault = c;
      break;
    }
  }

  const devVault = path.join(docs, 'LifeMirror Vault (Dev)');
  return { prodVault, devVault };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function main() {
  log('\n🪞 LifeMirror: Import Production Data to Development\n');

  const prodDir = getProdDataDir();
  const devDir = getDevDataDir();
  const prodDb = path.join(prodDir, 'lifemirror-desktop.db');
  const prodKey = path.join(prodDir, '.vault_key');
  const devDb = path.join(devDir, 'lifemirror-desktop-dev.db');
  const devKey = path.join(devDir, '.vault_key');

  log(`Production directory:  ${prodDir}`);
  log(`Development directory: ${devDir}\n`);

  // 1. Verify production database exists
  if (!fs.existsSync(prodDb)) {
    err(`Production database not found: ${prodDb}`);
    log('   Please launch the production LifeMirror Desktop application first to generate data.');
    process.exit(1);
  }

  const prodStat = fs.statSync(prodDb);
  ok(`Found production database: ${prodDb} (${formatBytes(prodStat.size)})`);

  // 2. Ensure dev directory exists with secure permissions (0700)
  fs.mkdirSync(devDir, { recursive: true, mode: 0o700 });

  // 3. Backup existing dev database if present
  if (fs.existsSync(devDb)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupDb = path.join(devDir, `lifemirror-desktop-dev.pre-merge.${timestamp}.bak`);
    fs.copyFileSync(devDb, backupDb);
    const devStat = fs.statSync(devDb);
    ok(`Preserved existing dev DB (${formatBytes(devStat.size)}) to: ${path.basename(backupDb)}`);
  }

  // 4. Copy database file
  fs.copyFileSync(prodDb, devDb);
  if (!isWindows) {
    fs.chmodSync(devDb, 0o600);
  }
  ok(`Copied production database to: ${devDb}`);

  // 5. Copy WAL and SHM journal files if present (for SQLite WAL consistency)
  const prodWal = path.join(prodDir, 'lifemirror-desktop.db-wal');
  const prodShm = path.join(prodDir, 'lifemirror-desktop.db-shm');
  const devWal = path.join(devDir, 'lifemirror-desktop-dev.db-wal');
  const devShm = path.join(devDir, 'lifemirror-desktop-dev.db-shm');

  if (fs.existsSync(prodWal)) {
    fs.copyFileSync(prodWal, devWal);
    if (!isWindows) fs.chmodSync(devWal, 0o600);
    ok(`Copied active WAL journal: ${path.basename(devWal)}`);
  } else if (fs.existsSync(devWal)) {
    // Remove stale dev WAL if prod has no active WAL
    fs.unlinkSync(devWal);
  }

  if (fs.existsSync(prodShm)) {
    fs.copyFileSync(prodShm, devShm);
    if (!isWindows) fs.chmodSync(devShm, 0o600);
    ok(`Copied active SHM index: ${path.basename(devShm)}`);
  } else if (fs.existsSync(devShm)) {
    fs.unlinkSync(devShm);
  }

  // 6. Copy encryption key mirror (.vault_key)
  if (fs.existsSync(prodKey)) {
    fs.copyFileSync(prodKey, devKey);
    if (!isWindows) {
      fs.chmodSync(devKey, 0o600);
    }
    ok(`Copied encryption key mirror (.vault_key)`);
  } else {
    warn(`No .vault_key mirror file found in production folder (key may be stored solely in OS keyring).`);
  }

  // 7. Clean up any stale development lock file
  const devLock = path.join(devDir, '.vault.lock');
  if (fs.existsSync(devLock)) {
    try {
      fs.unlinkSync(devLock);
      ok(`Cleaned up stale development lock: ${path.basename(devLock)}`);
    } catch (_) {}
  }

  // 8. Optionally sync Knowledge Vault notes
  const { prodVault, devVault } = getVaultDirs();
  if (prodVault && fs.existsSync(prodVault)) {
    try {
      fs.mkdirSync(devVault, { recursive: true });
      const subdirs = ['projects', 'topics', 'sessions', 'periodic'];
      let syncedFiles = 0;

      for (const sub of subdirs) {
        const srcSub = path.join(prodVault, sub);
        const dstSub = path.join(devVault, sub);
        if (fs.existsSync(srcSub)) {
          fs.mkdirSync(dstSub, { recursive: true });
          const files = fs.readdirSync(srcSub);
          for (const f of files) {
            if (f.endsWith('.md')) {
              const srcFile = path.join(srcSub, f);
              const dstFile = path.join(dstSub, f);
              if (!fs.existsSync(dstFile)) {
                fs.copyFileSync(srcFile, dstFile);
                syncedFiles++;
              }
            }
          }
        }
      }

      // Copy core index.md and log.md if dev vault lacks them
      for (const coreFile of ['index.md', 'log.md']) {
        const src = path.join(prodVault, coreFile);
        const dst = path.join(devVault, coreFile);
        if (fs.existsSync(src) && !fs.existsSync(dst)) {
          fs.copyFileSync(src, dst);
          syncedFiles++;
        }
      }

      if (syncedFiles > 0) {
        ok(`Synced ${syncedFiles} Knowledge Vault note(s) from "${path.basename(prodVault)}" to "${path.basename(devVault)}"`);
      } else {
        ok(`Knowledge Vault notes are already up to date`);
      }
    } catch (vErr) {
      warn(`Could not sync Knowledge Vault notes: ${vErr.message}`);
    }
  }

  log('\n🎉 Production data successfully merged into Development environment!');
  log('   Run "npm run tauri:dev" to start testing with your working data.\n');
}

main().catch(e => {
  err(`Import failed: ${e.message}`);
  process.exit(1);
});
