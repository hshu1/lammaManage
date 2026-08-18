import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Trash2, Sparkles, Zap, RefreshCw, AlertCircle } from 'lucide-react';

export default function ChatPlayground({ serverStatus, addToast }) {
  const isRunning = serverStatus?.status === 'RUNNING';
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '你好！我是当前已加载的本地大模型。Llama 服务就绪后，你可以随时在这里向我提问进行推断测试。'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [stats, setStats] = useState(null); // { latency: '120ms', tokens: 45 }
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const quickPrompts = [
    '介绍一下你自己和你的能力',
    '写一个 Python 异步高并发请求的示例',
    '用通俗易懂的语言解释什么是 KV Cache 压缩？',
    '写一首关于 GPU 算力与人工智能的现代诗'
  ];

  const handleSend = async (customPrompt) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || loading) return;

    if (!isRunning) {
      addToast?.({ type: 'warning', title: '服务未启动', message: '请先在服务控制台启动 Llama 服务后再进行测试对话' });
      return;
    }

    const userMsg = { role: 'user', content: textToSend.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setStats(null);

    const startTime = Date.now();

    try {
      // 创建一个空的 assistant 消息
      const assistantMsg = { role: 'assistant', content: '' };
      setMessages([...newMessages, assistantMsg]);

      const response = await fetch('/api/test-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          temperature,
          max_tokens: maxTokens,
          stream: true
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '请求失败');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';
      let firstTokenTime = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (!firstTokenTime) {
          firstTokenTime = Date.now();
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace(/^data: /, '').trim();
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              const token = parsed.choices?.[0]?.delta?.content || '';
              fullText += token;
              setMessages([...newMessages, { role: 'assistant', content: fullText }]);
            } catch (e) {
              // partial json
            }
          }
        }
      }

      const totalTime = (Date.now() - startTime) / 1000;
      const ttft = firstTokenTime ? firstTokenTime - startTime : 0;
      setStats({
        ttft: `${ttft} ms`,
        totalTime: `${totalTime.toFixed(2)} s`
      });

    } catch (err) {
      console.error(err);
      setMessages([...newMessages, { role: 'assistant', content: `❌ 推断出错: ${err.message}` }]);
      addToast?.({ type: 'error', title: '推断失败', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        role: 'assistant',
        content: '对话已清空，请输入新的测试指令。'
      }
    ]);
    setStats(null);
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '460px' }}>
      {/* 顶部工具栏 */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} style={{ color: '#a855f7' }} />
          <span style={{ fontWeight: 700, fontSize: '14px', color: '#f8fafc' }}>
            快速推断对话 Playground
          </span>
          {isRunning ? (
            <span className="badge badge-emerald">已连线</span>
          ) : (
            <span className="badge badge-rose">服务离线</span>
          )}
        </div>

        {/* 性能与参数 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {stats && (
            <div style={{ display: 'flex', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span className="badge badge-primary">TTFT: {stats.ttft}</span>
              <span className="badge badge-purple">耗时: {stats.totalTime}</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <span>Temp:</span>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value) || 0.7)}
              className="input-text"
              style={{ width: '54px', padding: '2px 6px', height: '24px', fontSize: '11px' }}
            />
          </div>

          <button
            onClick={handleClear}
            className="btn btn-ghost"
            style={{ padding: '4px 8px', height: '26px', fontSize: '11px' }}
            title="清空对话"
          >
            <Trash2 size={13} />
            清空
          </button>
        </div>
      </div>

      {/* 消息滚动区 */}
      <div style={{
        flex: 1,
        padding: '16px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        maxHeight: '380px'
      }}>
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
                flexDirection: isUser ? 'row-reverse' : 'row'
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: isUser ? 'linear-gradient(135deg, #0284c7, #38bdf8)' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {isUser ? <User size={16} color="#fff" /> : <Bot size={16} color="#fff" />}
              </div>

              <div style={{
                maxWidth: '82%',
                padding: '10px 14px',
                borderRadius: '12px',
                background: isUser ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.85)',
                border: isUser ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid var(--border-color)',
                color: '#f8fafc',
                fontSize: '13.5px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {msg.content || (loading && idx === messages.length - 1 ? '正在思考生成中...' : '')}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 快捷 Prompt 推荐 */}
      <div style={{
        padding: '6px 16px',
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        background: 'rgba(0,0,0,0.2)',
        borderTop: '1px solid rgba(255,255,255,0.04)'
      }}>
        {quickPrompts.map((p, i) => (
          <button
            key={i}
            onClick={() => handleSend(p)}
            disabled={!isRunning || loading}
            className="btn btn-ghost"
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)'
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* 输入发送栏 */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        gap: '10px',
        background: 'rgba(15, 23, 42, 0.6)'
      }}>
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={isRunning ? "输入测试消息，按 Enter 发送，Shift+Enter 换行..." : "Llama 服务启动后即可开始对话测试..."}
          disabled={!isRunning || loading}
          className="input-text"
          style={{ resize: 'none', fontSize: '13px', lineHeight: '1.4' }}
        />

        <button
          onClick={() => handleSend()}
          disabled={!isRunning || !input.trim() || loading}
          className="btn btn-primary"
          style={{ padding: '0 20px', borderRadius: '10px' }}
        >
          {loading ? <RefreshCw size={16} className="spin-animation" /> : <Send size={16} />}
          发送
        </button>
      </div>
    </div>
  );
}
