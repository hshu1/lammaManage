import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

/**
 * 格式化字节大小为人类可读字符串
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 从文件名解析模型特征（量化等级、参数量、模型家族）
 */
export function parseModelMetadata(filename) {
  // 量化级别正则
  const quantMatch = filename.match(/(?:[-_.])(Q[0-9]_[KMA0-9_]+|IQ[0-9]_[A-Z0-9_]+|BF16|F16|F32|Q4_0|Q4_1|Q5_0|Q5_1|Q8_0)(?:[-_.]|$)/i);
  const quant = quantMatch ? quantMatch[1].toUpperCase() : '未知量化';

  // 参数量正则
  const paramMatch = filename.match(/(?:[-_.])([0-9]+(?:\.[0-9]+)?B)(?:[-_.]|$)/i);
  const params = paramMatch ? paramMatch[1].toUpperCase() : '';

  // 模型系列识别
  let family = 'LLM';
  const lower = filename.toLowerCase();
  if (lower.includes('qwen')) family = 'Qwen';
  else if (lower.includes('deepseek')) family = 'DeepSeek';
  else if (lower.includes('llama')) family = 'Llama';
  else if (lower.includes('mistral') || lower.includes('mixtral')) family = 'Mistral';
  else if (lower.includes('gemma')) family = 'Gemma';
  else if (lower.includes('phi')) family = 'Phi';
  else if (lower.includes('minicpm')) family = 'MiniCPM';
  else if (lower.includes('glm') || lower.includes('chatglm')) family = 'GLM';

  return { quant, params, family };
}

/**
 * 扫描指定目录下的所有 GGUF 模型文件
 */
export async function getLocalModels(modelsDir) {
  try {
    if (!fs.existsSync(modelsDir)) {
      return { success: true, models: [], totalSize: 0, totalSizeBytes: 0, modelsDir };
    }

    const entries = await fs.promises.readdir(modelsDir, { withFileTypes: true });
    const models = [];
    let totalSizeBytes = 0;

    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.gguf')) {
        const fullPath = path.join(modelsDir, entry.name);
        try {
          const stats = await fs.promises.stat(fullPath);
          totalSizeBytes += stats.size;
          const { quant, params, family } = parseModelMetadata(entry.name);

          models.push({
            filename: entry.name,
            fullPath: fullPath,
            sizeBytes: stats.size,
            sizeFormatted: formatBytes(stats.size),
            modifiedTime: stats.mtime.toISOString(),
            quant,
            params,
            family
          });
        } catch (e) {
          console.error(`Error getting stats for ${entry.name}:`, e);
        }
      }
    }

    // 按修改时间倒序排列
    models.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));

    return {
      success: true,
      models,
      count: models.length,
      totalSizeBytes,
      totalSizeFormatted: formatBytes(totalSizeBytes),
      modelsDir
    };
  } catch (error) {
    console.error('Error scanning models directory:', error);
    return {
      success: false,
      error: error.message,
      models: [],
      count: 0
    };
  }
}

/**
 * 删除模型文件
 */
export async function deleteModelFile(modelsDir, filename) {
  // 安全校验防穿越
  const safeFilename = path.basename(filename);
  const targetPath = path.join(modelsDir, safeFilename);

  if (!fs.existsSync(targetPath)) {
    throw new Error('模型文件不存在');
  }

  await fs.promises.unlink(targetPath);
  return { success: true, message: `模型 ${safeFilename} 已删除` };
}

/**
 * 在系统资源管理器中打开目录或高亮定位文件（若目录不存在自动递归创建）
 */
export function openInExplorer(rawPath) {
  return new Promise((resolve, reject) => {
    if (!rawPath || typeof rawPath !== 'string') {
      return reject(new Error('未指定有效路径'));
    }

    let target = rawPath.trim().replace(/^['"]+|['"]+$/g, '');
    if (!path.isAbsolute(target)) {
      target = path.resolve(process.cwd(), target);
    }
    target = path.normalize(target);

    // 如果路径不存在且不是显式文件扩展名，自动递归创建该目录
    if (!fs.existsSync(target)) {
      try {
        if (!path.extname(target)) {
          fs.mkdirSync(target, { recursive: true });
        } else {
          return reject(new Error(`指定的文件不存在: ${target}`));
        }
      } catch (e) {
        return reject(new Error(`路径不存在且创建失败: ${target}`));
      }
    }

    const stats = fs.statSync(target);
    let cmd = '';
    if (process.platform === 'win32') {
      if (stats.isDirectory()) {
        cmd = `explorer.exe "${target}"`;
      } else {
        cmd = `explorer.exe /select,"${target}"`;
      }
    } else if (process.platform === 'darwin') {
      cmd = stats.isDirectory() ? `open "${target}"` : `open -R "${target}"`;
    } else {
      cmd = `xdg-open "${target}"`;
    }

    exec(cmd, () => {
      resolve({ success: true, path: target });
    });
  });
}

function runPowerShellPicker(script) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve({ success: false, error: '非 Windows 环境' });
    }
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const ps = spawn('powershell.exe', ['-NoProfile', '-STA', '-EncodedCommand', encoded], {
      windowsHide: false
    });
    let stdout = '';
    let stderr = '';
    ps.stdout.on('data', (d) => stdout += d.toString());
    ps.stderr.on('data', (d) => stderr += d.toString());
    ps.on('close', (code) => {
      const selected = stdout ? stdout.trim().split(/\r?\n/).pop().trim() : '';
      if (code === 0 && selected) {
        resolve({ success: true, path: selected });
      } else {
        resolve({ success: false, cancelled: true });
      }
    });
    ps.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * 调用 Windows 原生文件选择对话框
 */
export function openNativeFilePicker(title = '请选择 llama-server.exe 文件', filter = '可执行文件 (*.exe)|*.exe|所有文件 (*.*)|*.*') {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Title = "${title.replace(/"/g, '`"')}"
$d.Filter = "${filter.replace(/"/g, '`"')}"
$d.CheckFileExists = $true
$f = New-Object System.Windows.Forms.Form
$f.TopMost = $true
if ($d.ShowDialog($f) -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  [Console]::WriteLine($d.FileName)
}
`;
  return runPowerShellPicker(script);
}

/**
 * 调用 Windows 原生文件夹选择对话框
 */
export function openNativeFolderPicker(title = '请选择本地 GGUF 模型存储目录') {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description = "${title.replace(/"/g, '`"')}"
$d.ShowNewFolderButton = $true
$f = New-Object System.Windows.Forms.Form
$f.TopMost = $true
if ($d.ShowDialog($f) -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  [Console]::WriteLine($d.SelectedPath)
}
`;
  return runPowerShellPicker(script);
}

/**
 * 获取本地磁盘与目录树节点信息（供前端在网页内部可视化浏览与选择）
 */
export async function browseFilesystem(targetPath = '') {
  try {
    let current = targetPath ? path.resolve(targetPath) : '';
    
    // 如果未提供路径或路径无效，返回盘符列表 (Windows) 或根目录
    if (!current || !fs.existsSync(current)) {
      if (process.platform === 'win32') {
        const drives = ['C:\\', 'D:\\', 'E:\\', 'F:\\', 'G:\\', 'H:\\'].filter(d => fs.existsSync(d));
        return {
          success: true,
          isRoot: true,
          currentPath: '',
          parentPath: '',
          items: drives.map(d => ({ name: d, path: d, isDir: true, isDrive: true }))
        };
      } else {
        current = '/';
      }
    }

    const stat = await fs.promises.stat(current);
    if (!stat.isDirectory()) {
      current = path.dirname(current);
    }

    const parentPath = path.dirname(current) !== current ? path.dirname(current) : '';
    const entries = await fs.promises.readdir(current, { withFileTypes: true });

    const items = [];
    for (const entry of entries) {
      if (entry.name.startsWith('$') || entry.name.startsWith('System Volume') || entry.name === 'node_modules') continue;
      const full = path.join(current, entry.name);
      const isDir = entry.isDirectory();
      items.push({
        name: entry.name,
        path: full,
        isDir,
        isExe: entry.name.toLowerCase().endsWith('.exe'),
        isGguf: entry.name.toLowerCase().endsWith('.gguf')
      });
    }

    // 目录排在前，文件排在后
    items.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return {
      success: true,
      currentPath: current,
      parentPath,
      items
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      currentPath: targetPath,
      items: []
    };
  }
}
