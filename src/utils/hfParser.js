/**
 * 前端即时解析 HuggingFace 输入
 */
export function parseHfCommand(input) {
  if (!input || typeof input !== 'string') return null;
  const text = input.trim().replace(/^['"]+|['"]+$/g, '').trim();

  let repoId = '';
  let filename = '';

  // 模式 1: "hf download hf://owner/repo/filename.gguf" 或 "hf://owner/repo/filename.gguf"
  const hfProtocolMatch = text.match(/(?:hf\s+download\s+)?hf:\/\/([a-zA-Z0-9_\-.]+\/[a-zA-Z0-9_\-.]+)\/([^\s?#]+\.gguf)/i);
  if (hfProtocolMatch) {
    repoId = hfProtocolMatch[1];
    filename = hfProtocolMatch[2];
  }

  // 模式 2: "huggingface-cli download owner/repo filename.gguf"
  if (!repoId) {
    const cliMatch = text.match(/huggingface-cli\s+download\s+([a-zA-Z0-9_\-.]+\/[a-zA-Z0-9_\-.]+)\s+([^\s]+\.gguf)/i);
    if (cliMatch) {
      repoId = cliMatch[1];
      filename = cliMatch[2];
    }
  }

  // 模式 3: "https://huggingface.co/owner/repo/blob/main/filename.gguf" 或 resolve/main 或 hf-mirror.com
  if (!repoId) {
    const webUrlMatch = text.match(/https?:\/\/(?:huggingface\.co|hf-mirror\.com)\/([a-zA-Z0-9_\-.]+\/[a-zA-Z0-9_\-.]+)\/(?:blob|resolve)\/[^/]+\/([^\s?#]+\.gguf)/i);
    if (webUrlMatch) {
      repoId = webUrlMatch[1];
      filename = webUrlMatch[2];
    }
  }

  // 模式 4: "owner/repo/filename.gguf"
  if (!repoId) {
    const directMatch = text.match(/^([a-zA-Z0-9_\-.]+\/[a-zA-Z0-9_\-.]+)\/([^\s?#]+\.gguf)$/i);
    if (directMatch) {
      repoId = directMatch[1];
      filename = directMatch[2];
    }
  }

  if (!repoId) return null;

  return {
    repoId,
    filename,
    suggestedName: filename ? filename.replace(/\.gguf$/i, '') : repoId.split('/')[1]
  };
}
