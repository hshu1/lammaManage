/**
 * Llama WebUI 极简设计风格规范与调色盘体系
 * 
 * 规范约束:
 * 1. 全站严格收敛于不多于 10 种单色 (Base Single Colors)。
 * 2. 渐变色仅允许在这 10 种基础单色之间插值生成。
 * 3. 支持系统跟随 (system)、暗色 (dark)、亮色 (light) 三态切换。
 */

export const PALETTE_COLORS = [
  {
    id: 'canvas-dark',
    token: '--c-canvas-dark',
    name: '暗色画布基底',
    hex: '#0B0F17',
    rgb: '11, 15, 23',
    role: 'Dark Mode 主背景画布，深邃无眩光',
    category: 'base'
  },
  {
    id: 'surface-dark',
    token: '--c-surface-dark',
    name: '暗色表面卡片',
    hex: '#151D2A',
    rgb: '21, 29, 42',
    role: 'Dark Mode 卡片/面板/弹窗底色，Light Mode 主文本字色',
    category: 'base'
  },
  {
    id: 'border-slate',
    token: '--c-border-slate',
    name: '暗色边框线条',
    hex: '#283548',
    rgb: '40, 53, 72',
    role: 'Dark Mode 分割线与交互描边，Light Mode 结构边框',
    category: 'border'
  },
  {
    id: 'canvas-light',
    token: '--c-canvas-light',
    name: '亮色画布纯白',
    hex: '#FFFFFF',
    rgb: '255, 255, 255',
    role: 'Light Mode 卡片底色，Dark Mode 主文本字色',
    category: 'base'
  },
  {
    id: 'surface-light',
    token: '--c-surface-light',
    name: '亮色表面卡片',
    hex: '#F4F6F9',
    rgb: '244, 246, 249',
    role: 'Light Mode 主背景画布、输入框与代码块背景',
    category: 'base'
  },
  {
    id: 'muted-slate',
    token: '--c-muted-slate',
    name: '中性文字灰',
    hex: '#64748B',
    rgb: '100, 116, 139',
    role: '次级说明文本、弱化图标、空状态指示',
    category: 'text'
  },
  {
    id: 'llama-sky',
    token: '--c-llama-sky',
    name: 'Llama 天空蓝 (品牌主色)',
    hex: '#0EA5E9',
    rgb: '14, 165, 233',
    role: '核心交互、主按钮、激活指示、焦点光圈',
    category: 'brand'
  },
  {
    id: 'emerald',
    token: '--c-emerald',
    name: '翡翠绿 (成功/就绪)',
    hex: '#10B981',
    rgb: '16, 185, 129',
    role: '服务运行中 (RUNNING)、下载完成、成功通知',
    category: 'status'
  },
  {
    id: 'amber',
    token: '--c-amber',
    name: '琥珀黄 (警示/加载)',
    hex: '#F59E0B',
    rgb: '245, 158, 11',
    role: '服务启动中 (STARTING)、配置覆盖、警告提示',
    category: 'status'
  },
  {
    id: 'rose',
    token: '--c-rose',
    name: '玫瑰红 (危险/停止)',
    hex: '#EF4444',
    rgb: '239, 68, 68',
    role: '服务停止 (STOPPED)、异常报错、危险操作确认',
    category: 'status'
  }
];

export const THEME_OPTIONS = [
  {
    id: 'system',
    label: '跟随系统',
    desc: '自动侦测操作系统颜色偏好（深色/浅色），实时自适应同步。',
    icon: 'Monitor'
  },
  {
    id: 'dark',
    label: '简约暗色',
    desc: '沉浸式深灰 Slate 质感，夜间极简护眼，突出模型参数与日志。',
    icon: 'Moon'
  },
  {
    id: 'light',
    label: '简约亮色',
    desc: '清爽通透的纯白/浅灰设计，高对比度排版，阅读体验如清风徐来。',
    icon: 'Sun'
  }
];

export const GRADIENT_SPECS = [
  {
    id: 'brand-sky',
    name: 'Llama 品牌主渐变',
    from: '#0EA5E9',
    to: '#10B981',
    css: 'linear-gradient(135deg, #0EA5E9 0%, #10B981 100%)',
    usage: '主操作高亮按钮、主要品牌 Logo'
  },
  {
    id: 'success-glow',
    name: '就绪成功渐变',
    from: '#10B981',
    to: '#0EA5E9',
    css: 'linear-gradient(135deg, #10B981 0%, #0EA5E9 100%)',
    usage: '服务启动成功、下载完成徽章'
  },
  {
    id: 'warning-amber',
    name: '警示状态渐变',
    from: '#F59E0B',
    to: '#EF4444',
    css: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
    usage: '服务加载中、参数覆盖警告'
  },
  {
    id: 'danger-rose',
    name: '危险停止渐变',
    from: '#EF4444',
    to: '#F59E0B',
    css: 'linear-gradient(135deg, #EF4444 0%, #F59E0B 100%)',
    usage: '停止服务按钮、删除确认'
  },
  {
    id: 'text-dark',
    name: '暗色标题渐变字',
    from: '#FFFFFF',
    to: '#0EA5E9',
    css: 'linear-gradient(135deg, #FFFFFF 0%, #0EA5E9 100%)',
    usage: '暗色模式大标题'
  },
  {
    id: 'text-light',
    name: '亮色标题渐变字',
    from: '#151D2A',
    to: '#0EA5E9',
    css: 'linear-gradient(135deg, #151D2A 0%, #0EA5E9 100%)',
    usage: '亮色模式大标题'
  }
];

/**
 * 解析实际应渲染的主题 (dark 或 light)
 * @param {string} themePreference - 'system' | 'dark' | 'light'
 * @returns {'dark' | 'light'}
 */
export function resolveActualTheme(themePreference) {
  if (themePreference === 'dark') return 'dark';
  if (themePreference === 'light') return 'light';
  
  if (typeof window !== 'undefined' && window.matchMedia) {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? 'dark' : 'light';
  }
  
  return 'dark';
}
