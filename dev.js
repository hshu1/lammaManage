import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\x1b[36m====================================================\x1b[0m');
console.log('\x1b[36m  🚀 正在同时启动后端 API 服务 (5175) 与前端 Vite (5173)... \x1b[0m');
console.log('\x1b[36m====================================================\x1b[0m\n');

const isWin = process.platform === 'win32';
const nodeExec = process.execPath;

const serverScript = path.join(__dirname, 'server', 'index.js');
let viteScript = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');

if (!fs.existsSync(viteScript)) {
  viteScript = 'vite';
}

// 1. 启动 Express 后端 API (Port 5175)
const serverProcess = spawn(nodeExec, [serverScript], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, PORT: '5175' }
});

// 2. 启动 Vite 前端服务 (Port 5173) 直接通过 node 调用 vite.js，避免 Windows 下 .cmd spawn EINVAL 错误
const viteProcess = fs.existsSync(viteScript)
  ? spawn(nodeExec, [viteScript], { cwd: __dirname, stdio: 'inherit' })
  : spawn(isWin ? 'npx.cmd' : 'npx', ['vite'], { cwd: __dirname, stdio: 'inherit', shell: isWin });

let isShuttingDown = false;
function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n\x1b[33m[INFO] 正在安全停止所有服务...\x1b[0m');

  if (isWin) {
    if (serverProcess && serverProcess.pid) {
      try {
        spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/T', '/F'], { stdio: 'ignore' });
      } catch (e) {}
    }
    if (viteProcess && viteProcess.pid) {
      try {
        spawn('taskkill', ['/pid', viteProcess.pid.toString(), '/T', '/F'], { stdio: 'ignore' });
      } catch (e) {}
    }
  } else {
    try {
      if (serverProcess && !serverProcess.killed) serverProcess.kill('SIGTERM');
      if (viteProcess && !viteProcess.killed) viteProcess.kill('SIGTERM');
    } catch (e) {}
  }
}

serverProcess.on('exit', (code) => {
  if (code !== null && code !== 0 && !isShuttingDown) {
    console.error(`\x1b[31m[ERROR] 后端服务异常退出 (code: ${code})\x1b[0m`);
  }
});

viteProcess.on('exit', (code) => {
  if (code !== null && code !== 0 && !isShuttingDown) {
    console.error(`\x1b[31m[ERROR] Vite 服务异常退出 (code: ${code})\x1b[0m`);
  }
});

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

process.on('exit', () => {
  cleanup();
});
