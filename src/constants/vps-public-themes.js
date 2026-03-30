export const VPS_PUBLIC_THEME_PRESETS = {
  default: {
    key: 'default',
    label: '默认',
    layout: 'default',
    root: 'bg-[#f7f6f1] text-[#1f1b17] dark:bg-[#0a0d14] dark:text-slate-100',
    heroBadge: 'border-[#e7e1d6] bg-white/80 text-[#8a7f70] dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300',
    heroTitle: 'text-[#1f1b17] dark:text-slate-100',
    heroText: 'text-[#6a5f54] dark:text-slate-400',
    statCard: 'border-[#e9e2d6] bg-white/70 dark:border-slate-800/70 dark:bg-slate-900/60',
    panel: 'border-[#e7e1d6] bg-white/80 dark:border-slate-800/70 dark:bg-slate-900/60',
    panelSoft: 'border-[#efe6db] bg-[#fdfaf6] dark:border-slate-800 dark:bg-slate-900/60',
    pill: 'border-[#efe6db] bg-[#fdfaf6] text-[#6a5f54] dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300',
    accentButton: 'border-[#d9cdbd] bg-[#1f1b17] text-white dark:border-slate-700/60 dark:bg-slate-100 dark:text-slate-900',
    nodeCard: 'border-[#efe6db] bg-[#fdfaf6] dark:border-slate-800 dark:bg-slate-900',
    detailTable: 'text-[#1f1b17] dark:text-slate-200',
    backdrop: 'theme-default'
  },
  komari: {
    key: 'komari',
    label: 'Komari 风',
    layout: 'hero-split',
    root: 'bg-[#f4f7fb] text-slate-900',
    heroBadge: 'border-sky-100 bg-white/90 text-sky-700',
    heroTitle: 'text-slate-900',
    heroText: 'text-slate-600',
    statCard: 'border-sky-100/90 bg-white/92 shadow-[0_20px_42px_-28px_rgba(14,165,233,0.32)]',
    panel: 'border-sky-100/90 bg-white/92 shadow-[0_22px_60px_-40px_rgba(15,23,42,0.16)]',
    panelSoft: 'border-sky-100/90 bg-gradient-to-br from-white via-sky-50/75 to-indigo-50/70',
    pill: 'border-sky-100/90 bg-white/88 text-sky-700 shadow-sm shadow-sky-100/60',
    accentButton: 'border-sky-200 bg-sky-500 text-white shadow-lg shadow-sky-500/20',
    nodeCard: 'border-sky-100 bg-white/95 shadow-[0_20px_40px_-30px_rgba(56,189,248,0.45)]',
    detailTable: 'text-slate-800',
    themeClass: 'vps-theme-komari',
    backdrop: 'theme-komari'
  },
  minimal: {
    key: 'minimal',
    label: '极简',
    layout: 'minimal',
    root: 'bg-white text-slate-900',
    heroBadge: 'border-slate-200 bg-white text-slate-500',
    heroTitle: 'text-slate-900',
    heroText: 'text-slate-500',
    statCard: 'border-slate-200 bg-white shadow-none',
    panel: 'border-slate-200 bg-white shadow-none',
    panelSoft: 'border-slate-200 bg-white shadow-none',
    pill: 'border-slate-200 bg-white text-slate-600',
    accentButton: 'border-slate-200 bg-slate-900 text-white',
    nodeCard: 'border-slate-200 bg-white shadow-none',
    detailTable: 'text-slate-700',
    themeClass: 'vps-theme-minimal',
    backdrop: 'theme-minimal'
  },
  'tech-dark': {
    key: 'tech-dark',
    label: '深色科技',
    layout: 'tech-grid',
    root: 'bg-[#050816] text-slate-100',
    heroBadge: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
    heroTitle: 'text-slate-50',
    heroText: 'text-slate-400',
    statCard: 'border-cyan-400/20 bg-[#0b1226]/96 shadow-[0_22px_52px_-34px_rgba(6,182,212,0.28)]',
    panel: 'border-cyan-400/20 bg-[#0b1226]/94 shadow-[0_28px_65px_-36px_rgba(6,182,212,0.24)]',
    panelSoft: 'border-cyan-400/20 bg-gradient-to-br from-[#091122] via-[#0d1730] to-[#122044]',
    pill: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200',
    accentButton: 'border-cyan-300/30 bg-cyan-300/92 text-slate-950 shadow-lg shadow-cyan-500/16',
    nodeCard: 'border-cyan-500/20 bg-[#08101f] shadow-[0_20px_45px_-30px_rgba(34,211,238,0.35)]',
    detailTable: 'text-slate-200',
    themeClass: 'vps-theme-tech-dark',
    backdrop: 'theme-tech-dark'
  },
  glass: {
    key: 'glass',
    label: '玻璃态',
    layout: 'glass-showcase',
    root: 'bg-[#eef4ff] text-slate-900',
    heroBadge: 'border-white/40 bg-white/30 text-slate-700 backdrop-blur-xl',
    heroTitle: 'text-slate-900',
    heroText: 'text-slate-600',
    statCard: 'border-white/34 bg-white/38 backdrop-blur-2xl shadow-[0_20px_46px_-30px_rgba(99,102,241,0.24)]',
    panel: 'border-white/34 bg-white/38 backdrop-blur-2xl shadow-[0_24px_68px_-40px_rgba(99,102,241,0.24)]',
    panelSoft: 'border-white/34 bg-white/34 backdrop-blur-2xl',
    pill: 'border-white/45 bg-white/46 text-slate-700 backdrop-blur-xl',
    accentButton: 'border-white/40 bg-slate-900/85 text-white backdrop-blur-xl',
    nodeCard: 'border-white/30 bg-white/35 backdrop-blur-2xl shadow-[0_22px_48px_-34px_rgba(148,163,184,0.45)]',
    detailTable: 'text-slate-800',
    themeClass: 'vps-theme-glass',
    backdrop: 'theme-glass'
  }
};

export const VPS_PUBLIC_THEME_PREVIEW_CARDS = [
  {
    key: 'default',
    title: '默认',
    description: '延续 MiSub 现有公开页风格，平衡信息量与视觉层次。',
    previewClass: 'from-stone-100 via-white to-slate-100',
    accentClass: 'bg-stone-800'
  },
  {
    key: 'komari',
    title: 'Komari 风',
    description: '明亮卡片 + 分栏头图，适合做对外展示首页。',
    previewClass: 'from-sky-100 via-white to-indigo-100',
    accentClass: 'bg-sky-500'
  },
  {
    key: 'minimal',
    title: '极简',
    description: '弱化装饰，仅保留核心信息与节点展示。',
    previewClass: 'from-slate-50 via-white to-slate-100',
    accentClass: 'bg-slate-900'
  },
  {
    key: 'tech-dark',
    title: '深色科技',
    description: '偏监控大屏与赛博仪表盘质感。',
    previewClass: 'from-slate-950 via-slate-900 to-cyan-950',
    accentClass: 'bg-cyan-400'
  },
  {
    key: 'glass',
    title: '玻璃态',
    description: '透明卡片与模糊背景，适合高颜值展示。',
    previewClass: 'from-indigo-100 via-white/90 to-sky-100',
    accentClass: 'bg-indigo-500'
  }
];

export const VPS_PUBLIC_THEME_SECTIONS = [
  { key: 'anomalies', label: '异常区' },
  { key: 'nodes', label: '节点列表' },
  { key: 'featured', label: '重点轮播' },
  { key: 'details', label: '明细表' }
];

export function resolveVpsPublicTheme(preset) {
  return VPS_PUBLIC_THEME_PRESETS[preset] || VPS_PUBLIC_THEME_PRESETS.default;
}
