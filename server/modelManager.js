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
 * 在 Windows 资源管理器中高亮定位文件或打开目录
 */
export function openInExplorer(targetPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(targetPath)) {
      return reject(new Error('路径不存在'));
    }

    // 如果是文件，定位选中；如果是目录，打开目录
    const stats = fs.statSync(targetPath);
    let cmd = '';
    if (stats.isDirectory()) {
      cmd = `explorer.exe "${targetPath}"`;
    } else {
      cmd = `explorer.exe /select,"${targetPath}"`;
    }

    exec(cmd, (err) => {
      // explorer.exe exit code is sometimes non-zero even on success, so we resolve
      resolve({ success: true });
    });
  });
}
