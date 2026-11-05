#!/usr/bin/env node
/**
 * LifeMirror Companion Extension Packager & Archiver
 *
 * Validates and packages the Chrome companion extension into a clean,
 * production-ready .zip archive suitable for the Chrome Web Store and manual distribution.
 *
 * Key features:
 * - Cross-platform (works seamlessly on Linux, macOS, and Windows)
 * - Zero external dependencies (uses Node.js native zlib & buffers)
 * - Validates manifest.json (Manifest V3 compliance, icons, service worker)
 * - Strictly excludes host manifests (com.lifemirror.desktop.json*), docs (*.md), and dev artifacts
 *
 * Usage:
 *   node scripts/archive-extension.mjs
 *   node scripts/archive-extension.mjs --out my-extension.zip
 *   node scripts/archive-extension.mjs --dry-run
 *
 * Or via npm:
 *   npm run archive-extension
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ── Colors & Logging ──────────────────────────────────────────────────────────

const isColorSupported = process.stdout.isTTY && !process.env.NO_COLOR;
const color = {
  green: (s) => (isColorSupported ? `\x1b[32m${s}\x1b[0m` : s),
  red: (s) => (isColorSupported ? `\x1b[31m${s}\x1b[0m` : s),
  yellow: (s) => (isColorSupported ? `\x1b[33m${s}\x1b[0m` : s),
  cyan: (s) => (isColorSupported ? `\x1b[36m${s}\x1b[0m` : s),
  bold: (s) => (isColorSupported ? `\x1b[1m${s}\x1b[0m` : s),
  dim: (s) => (isColorSupported ? `\x1b[2m${s}\x1b[0m` : s),
};

function log(msg = '') {
  console.log(msg);
}
function ok(msg) {
  console.log(`  ${color.green('✔')} ${msg}`);
}
function warn(msg) {
  console.warn(`  ${color.yellow('⚠')} ${msg}`);
}
function err(msg) {
  console.error(`  ${color.red('✖')} ${msg}`);
}

// ── Zip Archive Engine (Pure Node.js, 0 dependencies) ─────────────────────────

function toDosDateTime(date = new Date()) {
  const d = new Date(date);
  const dosTime =
    ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) &
    0xffff;
  const dosDate =
    (((d.getFullYear() - 1980) << 9) |
      ((d.getMonth() + 1) << 5) |
      d.getDate()) &
    0xffff;
  return { dosTime, dosDate };
}

function buildZipArchive(entries) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const entry of entries) {
    const isDir = entry.isDirectory || entry.name.endsWith('/');
    const nameStr = entry.name.replace(/\\/g, '/');
    const filenameBuf = Buffer.from(nameStr, 'utf8');

    const data = isDir ? Buffer.alloc(0) : Buffer.from(entry.content);
    const uncompressedSize = data.length;
    const crc = isDir ? 0 : zlib.crc32(data) >>> 0;
    const compressed = isDir ? Buffer.alloc(0) : zlib.deflateRawSync(data);
    const compressedSize = compressed.length;
    const method = isDir ? 0 : 8; // 0=store, 8=deflate
    const { dosTime, dosDate } = toDosDateTime(entry.mtime || new Date());

    // Local file header (30 bytes)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed (2.0)
    localHeader.writeUInt16LE(0, 6); // general flags
    localHeader.writeUInt16LE(method, 8); // compression method
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14); // crc32
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(filenameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field len

    const fileRecord = Buffer.concat([localHeader, filenameBuf, compressed]);
    localHeaders.push(fileRecord);

    // Central directory header (46 bytes)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(0x0314, 4); // version made by (UNIX 2.0)
    centralHeader.writeUInt16LE(20, 6); // version needed (2.0)
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(method, 10); // compression method
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16); // crc32
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(filenameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra len
    centralHeader.writeUInt16LE(0, 32); // comment len
    centralHeader.writeUInt16LE(0, 34); // disk num
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    const mode = isDir ? 0o040755 : 0o100644;
    centralHeader.writeUInt32LE((mode * 0x10000) >>> 0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42); // offset of local header

    centralHeaders.push(Buffer.concat([centralHeader, filenameBuf]));
    offset += fileRecord.length;
  }

  const centralDir = Buffer.concat(centralHeaders);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0); // end of central dir signature
  endRecord.writeUInt16LE(0, 4); // disk number
  endRecord.writeUInt16LE(0, 6); // disk with central dir
  endRecord.writeUInt16LE(entries.length, 8); // total entries on disk
  endRecord.writeUInt16LE(entries.length, 10); // total entries
  endRecord.writeUInt32LE(centralDir.length, 12); // size of central dir
  endRecord.writeUInt32LE(offset, 16); // offset of start of central dir
  endRecord.writeUInt16LE(0, 20); // zip comment length

  return Buffer.concat([...localHeaders, centralDir, endRecord]);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

// ── Exclusion Rules ───────────────────────────────────────────────────────────

const EXCLUDE_PATTERNS = [
  /^\.git/,
  /\.DS_Store$/i,
  /Thumbs\.db$/i,
  /\.env(\..+)?$/i,
  /\.zip$/i,
  /^dist[\\/]/,
  /^node_modules[\\/]/,
  /\.md$/i, // Markdown documentation (CHROMEWEBSTORE.md, PRIVACY_POLICY.md, README.md)
  /^com\.lifemirror\.desktop\.json(\.template)?$/i, // Native messaging host manifests
  /^[\\/]com\.lifemirror\.desktop\.json(\.template)?$/i,
];

function shouldExclude(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(normalized));
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateExtension(extDir, manifest) {
  const issues = [];

  if (manifest.manifest_version !== 3) {
    issues.push(`Expected "manifest_version": 3, got ${manifest.manifest_version}`);
  }

  if (!manifest.name || typeof manifest.name !== 'string') {
    issues.push('Missing or invalid "name" in manifest.json');
  }

  if (!manifest.version || !/^\d+(\.\d+)*$/.test(manifest.version)) {
    issues.push(`Invalid "version" in manifest.json: "${manifest.version}"`);
  }

  // Validate service worker
  const swPath = manifest.background?.service_worker;
  if (!swPath) {
    issues.push('Missing "background.service_worker" in manifest.json');
  } else {
    const swFullPath = path.join(extDir, swPath);
    if (!fs.existsSync(swFullPath)) {
      issues.push(`Service worker not found: ${swPath}`);
    }
  }

  // Validate icons
  const iconGroups = [manifest.icons, manifest.action?.default_icon].filter(Boolean);
  for (const group of iconGroups) {
    for (const [size, iconRelPath] of Object.entries(group)) {
      const fullPath = path.join(extDir, iconRelPath);
      if (!fs.existsSync(fullPath)) {
        issues.push(`Referenced icon not found (${size}px): ${iconRelPath}`);
      }
    }
  }

  // Validate action popup if defined
  if (manifest.action?.default_popup) {
    const popupFullPath = path.join(extDir, manifest.action.default_popup);
    if (!fs.existsSync(popupFullPath)) {
      issues.push(`Referenced action popup not found: ${manifest.action.default_popup}`);
    }
  }

  return issues;
}

// ── Gather Files ──────────────────────────────────────────────────────────────

function gatherExtensionFiles(dir, baseDir = dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (shouldExclude(relPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      results.push(...gatherExtensionFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const stat = fs.statSync(fullPath);
      results.push({
        relPath,
        fullPath,
        size: stat.size,
        mtime: stat.mtime,
      });
    }
  }

  return results;
}

// ── CLI Parsing ───────────────────────────────────────────────────────────────

function parseArgs(args) {
  const options = {
    source: null,
    out: null,
    dryRun: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--out' || arg === '-o') {
      options.out = args[++i];
    } else if (arg === '--source' || arg === '-s') {
      options.source = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  log(`
${color.bold('LifeMirror Extension Archiver')}

Usage:
  node scripts/archive-extension.mjs [options]

Options:
  -o, --out <path>     Target output .zip file path
  -s, --source <path>  Path to extension directory (default: companion-extension)
  --dry-run            Simulate archive creation without writing to disk
  -v, --verbose        Show detailed processing output
  -h, --help           Show this help message
`);
}

// ── Main Execution ────────────────────────────────────────────────────────────

async function main() {
  const options = parseArgs(process.argv.slice(2));

  log(color.bold('\n📦 LifeMirror Companion Extension Archiver'));
  log(color.dim('──────────────────────────────────────────────────────'));

  // 1. Locate extension directory
  let extDir = options.source;
  if (!extDir) {
    const candidatePaths = [
      path.join(PROJECT_ROOT, 'companion-extension'),
      path.resolve(process.cwd(), 'companion-extension'),
      process.cwd(),
    ];
    for (const cand of candidatePaths) {
      if (fs.existsSync(path.join(cand, 'manifest.json'))) {
        extDir = cand;
        break;
      }
    }
  }

  if (!extDir || !fs.existsSync(path.join(extDir, 'manifest.json'))) {
    err(`Could not find companion-extension directory containing manifest.json`);
    process.exit(1);
  }

  ok(`Found extension at: ${color.cyan(path.relative(process.cwd(), extDir) || '.')}`);

  // 2. Read and parse manifest.json
  const manifestPath = path.join(extDir, 'manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    ok(`Loaded manifest.json: ${color.bold(manifest.name)} v${manifest.version}`);
  } catch (e) {
    err(`Failed to parse manifest.json: ${e.message}`);
    process.exit(1);
  }

  // 3. Validate extension requirements
  const validationIssues = validateExtension(extDir, manifest);
  if (validationIssues.length > 0) {
    err('Extension validation failed:');
    for (const issue of validationIssues) {
      log(`    ${color.red('•')} ${issue}`);
    }
    process.exit(1);
  }
  ok('Extension structure and Manifest V3 fields validated');

  // 4. Gather extension files to archive
  const filesToPackage = gatherExtensionFiles(extDir);

  if (filesToPackage.length === 0) {
    err('No files found to package into archive');
    process.exit(1);
  }

  // Sort files for deterministic archives
  filesToPackage.sort((a, b) => a.relPath.localeCompare(b.relPath));

  log('\n📄 Files to be packaged:');
  let totalRawSize = 0;
  for (const file of filesToPackage) {
    totalRawSize += file.size;
    log(`  ${color.cyan('+')} ${file.relPath.padEnd(28)} ${color.dim(formatBytes(file.size))}`);
  }

  // 5. Determine output destination
  const defaultFilename = `lifemirror-desktop-v${manifest.version}.zip`;
  const defaultDistDir = path.join(PROJECT_ROOT, 'dist');
  const outPath = options.out
    ? path.resolve(process.cwd(), options.out)
    : path.join(defaultDistDir, defaultFilename);

  if (options.dryRun) {
    log(color.yellow('\n[Dry Run] Archive not written to disk.'));
    log(`  Target path would be: ${outPath}`);
    log(`  Total uncompressed:   ${formatBytes(totalRawSize)}`);
    return;
  }

  // 6. Build zip entries
  log('\n⚡ Compressing files...');
  const zipEntries = [];
  const addedDirs = new Set();

  for (const file of filesToPackage) {
    // Ensure parent directory entry is added
    const dirName = path.dirname(file.relPath).replace(/\\/g, '/');
    if (dirName && dirName !== '.' && !addedDirs.has(dirName)) {
      addedDirs.add(dirName);
      zipEntries.push({
        name: `${dirName}/`,
        isDirectory: true,
        mtime: file.mtime,
      });
    }

    const content = fs.readFileSync(file.fullPath);
    zipEntries.push({
      name: file.relPath,
      content,
      isDirectory: false,
      mtime: file.mtime,
    });
  }

  const zipBuffer = buildZipArchive(zipEntries);

  // 7. Ensure output directory exists and write archive
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, zipBuffer);

  // Also create a stable non-versioned alias copy in dist/ if using default location
  if (!options.out) {
    const aliasPath = path.join(defaultDistDir, 'lifemirror-desktop.zip');
    fs.copyFileSync(outPath, aliasPath);
  }

  log('\n✨ Archive created successfully!');
  ok(`Output file : ${color.bold(color.green(path.relative(process.cwd(), outPath)))}`);
  ok(`Raw size    : ${formatBytes(totalRawSize)}`);
  ok(`Zip size    : ${formatBytes(zipBuffer.length)} (saved ${(
    (1 - zipBuffer.length / totalRawSize) *
    100
  ).toFixed(1)}%)`);
  log(color.dim('──────────────────────────────────────────────────────'));
  log(`Ready for Chrome Web Store upload or manual unpacked distribution.\n`);
}

main().catch((e) => {
  err(`Fatal error: ${e.stack || e.message}`);
  process.exit(1);
});

