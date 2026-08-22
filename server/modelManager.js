import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec, spawn } from 'child_process';

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
    ps.stdout.on('data', (d) => stdout += d.toString('utf8'));
    ps.stderr.on('data', (d) => stderr += d.toString('utf8'));
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
 * 解析有效的基础目录（如果传入的路径有效且存在，则取该目录或文件所在目录；否则默认返回系统“我的文档”目录）
 */
export function resolveInitialDir(rawPath) {
  try {
    if (rawPath && typeof rawPath === 'string') {
      const cleanPath = rawPath.trim().replace(/^['"]+|['"]+$/g, '');
      if (cleanPath && fs.existsSync(cleanPath)) {
        const stat = fs.statSync(cleanPath);
        if (stat.isDirectory()) {
          return cleanPath;
        } else {
          return path.dirname(cleanPath);
        }
      }
    }
  } catch (e) {}

  // 默认回退到系统“我的文档”目录
  const docDir = path.join(os.homedir(), 'Documents');
  if (fs.existsSync(docDir)) {
    return docDir;
  }
  return os.homedir();
}

/**
 * 调用 Windows 原生文件选择对话框
 */
export function openNativeFilePicker(
  title = '请选择 llama-server.exe 文件', 
  filter = '可执行文件 (*.exe)|*.exe|所有文件 (*.*)|*.*',
  initialPath = ''
) {
  const initialDir = resolveInitialDir(initialPath);
  let initialFile = '';
  if (initialPath && typeof initialPath === 'string' && fs.existsSync(initialPath)) {
    try {
      const stat = fs.statSync(initialPath);
      if (stat.isFile()) {
        initialFile = path.basename(initialPath);
      }
    } catch (e) {}
  }

  const script = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Title = "${title.replace(/"/g, '`"')}"
$d.Filter = "${filter.replace(/"/g, '`"')}"
$d.CheckFileExists = $true
$d.RestoreDirectory = $true
$initDir = "${initialDir.replace(/"/g, '`"')}"
if (Test-Path -Path $initDir) {
  $d.InitialDirectory = $initDir
} else {
  $d.InitialDirectory = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::MyDocuments)
}
${initialFile ? `$d.FileName = "${initialFile.replace(/"/g, '`"')}"` : ''}
$f = New-Object System.Windows.Forms.Form
$f.TopMost = $true
if ($d.ShowDialog($f) -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::WriteLine($d.FileName)
}
$f.Dispose()
$d.Dispose()
`;
  return runPowerShellPicker(script);
}

/**
 * 调用 Windows 原生文件夹选择对话框（采用与文件选择相同的新版 Windows 资源管理器风格对话框）
 */
export function openNativeFolderPicker(
  title = '请选择本地 GGUF 模型存储目录',
  initialPath = ''
) {
  const initialDir = resolveInitialDir(initialPath);

  const script = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$code = @"
using System;
using System.Runtime.InteropServices;
using System.IO;

namespace ModernDialog {
    public class FolderPicker {
        [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
        public static extern void SHCreateItemFromParsingName(
            [In, MarshalAs(UnmanagedType.LPWStr)] string pszPath,
            [In] IntPtr pbc,
            [In, MarshalAs(UnmanagedType.LPStruct)] Guid riid,
            [Out, MarshalAs(UnmanagedType.Interface)] out IShellItem ppv);

        [ComImport]
        [Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IShellItem {
            void BindToHandler([In] IntPtr pbc, [In, MarshalAs(UnmanagedType.LPStruct)] Guid bhid, [In, MarshalAs(UnmanagedType.LPStruct)] Guid riid, out IntPtr ppv);
            void GetParent([MarshalAs(UnmanagedType.Interface)] out IShellItem ppsi);
            void GetDisplayName([In] uint sigdnName, [MarshalAs(UnmanagedType.LPWStr)] out string ppszName);
            void GetAttributes([In] uint sfgaoMask, out uint psfgaoAttribs);
            void Compare([In, MarshalAs(UnmanagedType.Interface)] IShellItem psi, [In] uint hint, out int piOrder);
        }

        [ComImport]
        [Guid("42f85136-db7e-439c-85f1-e4075d135fc8")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IFileOpenDialog {
            [PreserveSig] int Show([In] IntPtr parent);
            void SetFileTypes([In] uint cFileTypes, [In] IntPtr rgFilterSpec);
            void SetFileTypeIndex([In] uint iFileType);
            void GetFileTypeIndex(out uint piFileType);
            void Advise([In, MarshalAs(UnmanagedType.Interface)] IntPtr pfde, out uint pdwCookie);
            void Unadvise([In] uint dwCookie);
            void SetOptions([In] uint fos);
            void GetOptions(out uint pfos);
            void SetDefaultFolder([In, MarshalAs(UnmanagedType.Interface)] IShellItem psi);
            void SetFolder([In, MarshalAs(UnmanagedType.Interface)] IShellItem psi);
            void GetFolder([MarshalAs(UnmanagedType.Interface)] out IShellItem ppsi);
            void GetCurrentSelection([MarshalAs(UnmanagedType.Interface)] out IShellItem ppsi);
            void SetFileName([In, MarshalAs(UnmanagedType.LPWStr)] string pszName);
            void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string pszName);
            void SetTitle([In, MarshalAs(UnmanagedType.LPWStr)] string pszTitle);
            void SetOkButtonLabel([In, MarshalAs(UnmanagedType.LPWStr)] string pszText);
            void SetFileNameLabel([In, MarshalAs(UnmanagedType.LPWStr)] string pszLabel);
            void GetResult([MarshalAs(UnmanagedType.Interface)] out IShellItem ppsi);
            void AddPlace([In, MarshalAs(UnmanagedType.Interface)] IShellItem psi, int fdap);
            void SetDefaultExtension([In, MarshalAs(UnmanagedType.LPWStr)] string pszDefaultExtension);
            void Close([MarshalAs(UnmanagedType.Error)] int hr);
            void SetClientGuid([In, MarshalAs(UnmanagedType.LPStruct)] Guid guid);
            void ClearClientData();
            void SetFilter([MarshalAs(UnmanagedType.Interface)] IntPtr pFilter);
            void GetResults([MarshalAs(UnmanagedType.Interface)] out IntPtr ppenum);
            void GetSelectedItems([MarshalAs(UnmanagedType.Interface)] out IntPtr ppsai);
        }

        [ComImport]
        [Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7")]
        [ClassInterface(ClassInterfaceType.None)]
        public class FileOpenDialogRCW {}

        public static string ShowDialog(string title, string initialDir) {
            var dialog = (IFileOpenDialog)new FileOpenDialogRCW();
            try {
                uint options;
                dialog.GetOptions(out options);
                // FOS_PICKFOLDERS = 0x20, FOS_FORCEFILESYSTEM = 0x40, FOS_PATHMUSTEXIST = 0x800
                dialog.SetOptions(options | 0x00000020 | 0x00000040 | 0x00000800);
                
                if (!string.IsNullOrEmpty(title)) {
                    dialog.SetTitle(title);
                }

                string targetDir = initialDir;
                if (string.IsNullOrEmpty(targetDir) || !Directory.Exists(targetDir)) {
                    targetDir = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
                }

                if (!string.IsNullOrEmpty(targetDir) && Directory.Exists(targetDir)) {
                    Guid riid = new Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE");
                    IShellItem folderItem;
                    SHCreateItemFromParsingName(targetDir, IntPtr.Zero, riid, out folderItem);
                    if (folderItem != null) {
                        dialog.SetFolder(folderItem);
                        dialog.SetDefaultFolder(folderItem);
                    }
                }

                int hr = dialog.Show(IntPtr.Zero);
                if (hr == 0) {
                    IShellItem item;
                    dialog.GetResult(out item);
                    if (item != null) {
                        string path;
                        item.GetDisplayName(0x80058000, out path); // SIGDN_FILESYSPATH
                        return path;
                    }
                }
                return null;
            } catch {
                return null;
            } finally {
                try {
                    Marshal.ReleaseComObject(dialog);
                } catch {}
            }
        }
    }
}
"@

try {
    Add-Type -TypeDefinition $code -ErrorAction Stop
    $result = [ModernDialog.FolderPicker]::ShowDialog("${title.replace(/"/g, '`"')}", "${initialDir.replace(/"/g, '`"')}")
    if ($result) {
        [Console]::WriteLine($result)
    }
} catch {
    # 兼容性降级
    Add-Type -AssemblyName System.Windows.Forms
    $d = New-Object System.Windows.Forms.FolderBrowserDialog
    $d.Description = "${title.replace(/"/g, '`"')}"
    $d.ShowNewFolderButton = $true
    $initDir = "${initialDir.replace(/"/g, '`"')}"
    if (Test-Path -Path $initDir) {
        $d.SelectedPath = $initDir
    } else {
        $d.SelectedPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::MyDocuments)
    }
    $f = New-Object System.Windows.Forms.Form
    $f.TopMost = $true
    if ($d.ShowDialog($f) -eq [System.Windows.Forms.DialogResult]::OK) {
        [Console]::WriteLine($d.SelectedPath)
    }
    $f.Dispose()
    $d.Dispose()
}
`;
  return runPowerShellPicker(script);
}

/**
 * 获取本地磁盘与目录树节点信息（供前端在网页内部可视化浏览与选择）
 */
export async function browseFilesystem(targetPath = '') {
  try {
    let current = '';

    // 特殊指令或无效路径处理
    if (targetPath === '__DOCUMENTS__') {
      current = path.join(os.homedir(), 'Documents');
    } else if (targetPath && fs.existsSync(targetPath)) {
      current = path.resolve(targetPath);
    } else if (targetPath) {
      // 传入了非空但不存在的路径，回退到系统“文档”目录
      const docDir = path.join(os.homedir(), 'Documents');
      if (fs.existsSync(docDir)) {
        current = docDir;
      }
    }

    // 如果仍未解析到有效路径，默认定位到系统“文档”目录，再回退到盘符列表
    if (!current || !fs.existsSync(current)) {
      const docDir = path.join(os.homedir(), 'Documents');
      if (fs.existsSync(docDir)) {
        current = docDir;
      } else if (process.platform === 'win32') {
        const drives = ['C:\\', 'D:\\', 'E:\\', 'F:\\', 'G:\\', 'H:\\'].filter(d => fs.existsSync(d));
        return {
          success: true,
          isRoot: true,
          currentPath: '',
          parentPath: '',
          items: drives.map(d => ({ name: d, path: d, isDir: true, isDrive: true }))
        };
      } else {
        current = os.homedir() || '/';
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
