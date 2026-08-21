/**
 * 估算模型在特定启动参数及满上下文 (Full Context) 下的显存与内存占用
 * 
 * @param {Object} options
 * @param {number} options.modelSizeBytes 模型文件大小 (字节数, 若未知则默认以 9B Q4 模型约 5.5GB 计算)
 * @param {number} options.nGpuLayers GPU 卸载层数 (0~99, 99为全层)
 * @param {number} options.ctxSize 上下文 Token 数 (如 8000, 32768, 65536)
 * @param {string} options.cacheTypeK KV 缓存 K 量化格式 ('f16' | 'q8_0' | 'q4_0' | 'q4_1')
 * @param {string} options.cacheTypeV KV 缓存 V 量化格式 ('f16' | 'q8_0' | 'q4_0' | 'q4_1')
 * @param {boolean} options.flashAttn 是否开启闪光注意力
 * @param {boolean} options.mcpProxy 是否开启 MCP 代理
 * @returns {Object} 显存与内存估算分析结果
 */
export function estimateFullContextVram({
  modelSizeBytes = 0,
  nGpuLayers = 99,
  ctxSize = 8000,
  cacheTypeK = 'f16',
  cacheTypeV = 'f16',
  flashAttn = true,
  mcpProxy = false
}) {
  // 1. 模型基础权重显存估算 (以标准 32~40 层大模型为例)
  const defaultModelSizeGB = 5.5; // 默认 8B~9B Q4 模型大小
  const actualModelSizeGB = modelSizeBytes > 0 ? (modelSizeBytes / (1024 * 1024 * 1024)) : defaultModelSizeGB;
  
  const totalLayers = 36; // 常见 7B~14B 模型的典型层数
  const offloadRatio = nGpuLayers >= 99 ? 1.0 : Math.min(1.0, Math.max(0, nGpuLayers / totalLayers));
  
  const modelVramGB = actualModelSizeGB * offloadRatio;
  const modelRamGB = actualModelSizeGB * (1.0 - offloadRatio);

  // 2. 满上下文 KV Cache 显存计算
  // 基础标准 f16 缓存: 1K context 约占用 0.16 GB (对于 8B~9B 级别模型)
  let bytesPerTokenK = 2; // f16 = 2 bytes
  if (cacheTypeK === 'q8_0') bytesPerTokenK = 1.0625;
  else if (cacheTypeK === 'q4_0' || cacheTypeK === 'q4_1') bytesPerTokenK = 0.5625;

  let bytesPerTokenV = 2;
  if (cacheTypeV === 'q8_0') bytesPerTokenV = 1.0625;
  else if (cacheTypeV === 'q4_0' || cacheTypeV === 'q4_1') bytesPerTokenV = 0.5625;

  // 标准 8B~9B (32 layers, 8 KV heads, 128 dim) 单 token KV cache 大小:
  // 2 * 32 * 8 * 128 * bytes = 65,536 * bytes / token
  const singleTokenBytes = 32 * 8 * 128 * (bytesPerTokenK + bytesPerTokenV);
  const totalKvCacheBytes = singleTokenBytes * ctxSize;
  let kvCacheGB = totalKvCacheBytes / (1024 * 1024 * 1024);

  // Flash Attention 闪光注意力可以优化显存峰值约 10%~15%
  if (flashAttn) {
    kvCacheGB = kvCacheGB * 0.92;
  }

  // 3. CUDA 运行时开销与上下文计算 Scratch Buffer
  let cudaOverheadGB = 0.6 + (ctxSize > 32768 ? 0.5 : ctxSize > 16384 ? 0.3 : 0.15);
  if (mcpProxy) {
    cudaOverheadGB += 0.2;
  }

  // 若部分层卸载，部分 KV Cache 或在 CPU 内存中计算，主要显存按比例分担
  const totalVramGB = (modelVramGB + (kvCacheGB * (offloadRatio > 0 ? (0.5 + 0.5 * offloadRatio) : 0)) + (offloadRatio > 0 ? cudaOverheadGB : 0.1));
  const totalRamGB = modelRamGB + (offloadRatio < 1.0 ? (kvCacheGB * (1.0 - offloadRatio) + 1.5) : 0.8);

  return {
    totalVram: totalVramGB.toFixed(1),
    totalVramNumber: Number(totalVramGB.toFixed(1)),
    modelWeightVram: modelVramGB.toFixed(1),
    kvCacheVram: kvCacheGB.toFixed(1),
    overheadVram: cudaOverheadGB.toFixed(1),
    systemRam: totalRamGB.toFixed(1),
    isPartialOffload: offloadRatio > 0 && offloadRatio < 1.0,
    isPureCpu: offloadRatio === 0,
    offloadPercentage: Math.round(offloadRatio * 100)
  };
}
