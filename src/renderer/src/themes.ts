// 主题注册表：每套主题包含界面 CSS 变量 + 终端（xterm）配色
// 新增主题只需在 THEMES 数组中加一条记录，并在 styles.css 中增加对应变量组

export interface TermTheme {
  background: string
  foreground: string
  cursor: string
}

export interface ThemeDef {
  id: string
  name: string
  /** 界面 CSS 变量，键名与 styles.css 中的变量一一对应 */
  vars: Record<string, string>
  /** xterm 终端配色（其余 ANSI 色沿用 xterm 默认） */
  term: TermTheme
}

export const DEFAULT_THEME_ID = 'dark'

export const THEMES: ThemeDef[] = [
  {
    id: 'dark',
    name: '暗夜',
    vars: {
      '--bg': '#1b1b1c',
      '--bg-panel': '#232324',
      '--bg-hover': '#2c2c2e',
      '--bg-active': '#343436',
      '--bg-strong': '#404042',
      '--border': '#3a3a3c',
      '--border-soft': '#2a2a2c',
      '--text': '#e8e8e8',
      '--text-dim': '#9a9a9e',
      '--text-faint': '#636366',
      '--green': '#34c759',
      '--green-hover': '#2db04e',
      '--green-dim': 'rgba(52, 199, 89, 0.18)',
      '--red': '#ff453a',
      '--yellow': '#ffd60a',
      '--scrollbar': '#424244',
      '--scrollbar-hover': '#4e4e50',
      '--mask': 'rgba(0, 0, 0, 0.55)',
      '--term-bg': '#000000'
    },
    term: { background: '#000000', foreground: '#e8e8e8', cursor: '#e8e8e8' }
  },
  {
    id: 'black',
    name: '纯黑',
    vars: {
      '--bg': '#000000',
      '--bg-panel': '#111113',
      '--bg-hover': '#1a1a1c',
      '--bg-active': '#242426',
      '--bg-strong': '#2e2e30',
      '--border': '#2c2c2e',
      '--border-soft': '#1c1c1e',
      '--text': '#f0f0f0',
      '--text-dim': '#8e8e93',
      '--text-faint': '#545456',
      '--green': '#30d158',
      '--green-hover': '#28b34c',
      '--green-dim': 'rgba(48, 209, 88, 0.18)',
      '--red': '#ff453a',
      '--yellow': '#ffd60a',
      '--scrollbar': '#323234',
      '--scrollbar-hover': '#3e3e40',
      '--mask': 'rgba(0, 0, 0, 0.6)',
      '--term-bg': '#000000'
    },
    term: { background: '#000000', foreground: '#f0f0f0', cursor: '#f0f0f0' }
  },
  {
    id: 'navy',
    name: '深蓝',
    vars: {
      '--bg': '#0f1b2d',
      '--bg-panel': '#16233a',
      '--bg-hover': '#1d2d49',
      '--bg-active': '#24365a',
      '--bg-strong': '#2e4266',
      '--border': '#2c3f63',
      '--border-soft': '#1c2a44',
      '--text': '#e3ecf7',
      '--text-dim': '#8ba3c7',
      '--text-faint': '#54688a',
      '--green': '#34c759',
      '--green-hover': '#2db04e',
      '--green-dim': 'rgba(52, 199, 89, 0.2)',
      '--red': '#ff5f57',
      '--yellow': '#ffd60a',
      '--scrollbar': '#2c3f63',
      '--scrollbar-hover': '#3a5078',
      '--mask': 'rgba(4, 10, 20, 0.6)',
      '--term-bg': '#0a1424'
    },
    term: { background: '#0a1424', foreground: '#d7e5f5', cursor: '#d7e5f5' }
  },
  {
    id: 'light',
    name: '明亮',
    vars: {
      '--bg': '#f5f5f7',
      '--bg-panel': '#ffffff',
      '--bg-hover': '#eaeaec',
      '--bg-active': '#e0e0e2',
      '--bg-strong': '#d8d8da',
      '--border': '#d2d2d7',
      '--border-soft': '#e5e5ea',
      '--text': '#1d1d1f',
      '--text-dim': '#6e6e73',
      '--text-faint': '#aeaeb2',
      '--green': '#28a745',
      '--green-hover': '#218838',
      '--green-dim': 'rgba(40, 167, 69, 0.15)',
      '--red': '#d70015',
      '--yellow': '#b08800',
      '--scrollbar': '#c7c7cc',
      '--scrollbar-hover': '#aeaeb2',
      '--mask': 'rgba(0, 0, 0, 0.35)',
      '--term-bg': '#ffffff'
    },
    term: { background: '#ffffff', foreground: '#1d1d1f', cursor: '#1d1d1f' }
  },
  {
    id: 'paper',
    name: '纸白',
    vars: {
      '--bg': '#f7f3ea',
      '--bg-panel': '#fffdf7',
      '--bg-hover': '#efe9dc',
      '--bg-active': '#e7dfcf',
      '--bg-strong': '#ded5c0',
      '--border': '#ddd5c3',
      '--border-soft': '#eae3d3',
      '--text': '#3a352a',
      '--text-dim': '#8a8171',
      '--text-faint': '#b5ac99',
      '--green': '#3d9a50',
      '--green-hover': '#338543',
      '--green-dim': 'rgba(61, 154, 80, 0.15)',
      '--red': '#c9342b',
      '--yellow': '#9a7b00',
      '--scrollbar': '#d5ccb8',
      '--scrollbar-hover': '#c2b8a2',
      '--mask': 'rgba(60, 50, 30, 0.35)',
      '--term-bg': '#fbf7ec'
    },
    term: { background: '#fbf7ec', foreground: '#3a352a', cursor: '#3a352a' }
  }
]

export function getThemeById(id: string): ThemeDef | undefined {
  return THEMES.find((t) => t.id === id)
}
