#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);

// If running 'dev' command and no --config is specified, inject tauri.dev.conf.json
if (args[0] === 'dev') {
  const hasConfig = args.includes('-c') || args.includes('--config');
  if (!hasConfig) {
    const devConfigPath = path.join('src-tauri', 'tauri.dev.conf.json');
    args.splice(1, 0, '--config', devConfigPath);
  }
}

const tauriBin = path.join(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? 'tauri.cmd' : 'tauri');

const child = spawn(tauriBin, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  cwd: rootDir,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error('Failed to execute tauri:', err);
  process.exit(1);
});
