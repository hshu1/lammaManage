import re
import io

with io.open('src/components/HomeView.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace export default function DashboardTab with HomeView
content = content.replace("export default function DashboardTab(", "export default function HomeView(")

# Find the start of the configuration area
start_marker = "{/* 1. 模型选择器 */}"
# Find the end of the configuration area
end_marker = "{/* 底部功能分区：实时终端日志 vs 测试对话 Playground */}"

if start_marker in content and end_marker in content:
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    
    new_block = """
        {/* 新版极简模型列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          {models.length === 0 ? (
            <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              未检测到本地模型，请点击右上角下载图标添加
            </div>
          ) : (
            models.map(m => {
              const isExpanded = selectedModel === m.filename;
              return (
                <div key={m.filename} className="glass-panel glass-panel-hover" style={{ padding: '20px', transition: 'all 0.3s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <HardDrive size={24} style={{ color: 'var(--c-llama-sky)' }} />
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>{m.filename}</h3>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {m.sizeFormatted} · {m.quant} · {m.family}
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {(isRunning && serverStatus?.activeModel === m.filename) ? (
                        <button onClick={onStopServer} className="btn btn-danger" style={{ padding: '6px 16px' }}>
                          <Square size={14} /> 停止运行
                        </button>
                      ) : (
                        <button 
                          onClick={() => {
                            if (isRunning) return;
                            setSelectedModel(isExpanded ? null : m.filename);
                          }} 
                          className={isExpanded ? "btn btn-secondary" : "btn btn-primary"}
                          style={{ padding: '6px 16px' }}
                          disabled={isRunning}
                        >
                          {isExpanded ? '收起配置' : (isRunning ? '服务被占用' : '▶ 展开并启动')}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {isExpanded && !isRunning && (
                    <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
"""

    original_config_block = content[start_idx:end_idx]
    preset_start = original_config_block.find("{/* 2. 预设方案选择卡片网格与下拉框双维度筛选 */}")
    
    if preset_start != -1:
        extracted_advanced = original_config_block[preset_start:]
        
        start_btn = """
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
               <button onClick={() => onStartServer({ modelFilename: m.filename, params })} className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '16px' }}>
                 🚀 确认参数并启动服务
               </button>
            </div>
        """
        
        new_block += extracted_advanced + start_btn + """
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        """
        
        content = content[:start_idx] + new_block + content[end_idx:]

with io.open('src/components/HomeView.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
