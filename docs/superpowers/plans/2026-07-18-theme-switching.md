# 主题风格切换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Easy Shell 增加 5 套内置主题（暗夜/纯黑/深蓝/明亮/纸白），顶栏齿轮按钮弹出主题面板，点击即换肤，终端配色跟随，选择持久化。

**Architecture:** CSS 变量换肤：每套主题是一组 CSS 变量值，挂在 `:root[data-theme='xxx']` 下；切换 = 改根节点 `data-theme` 属性。主题注册表（themes.ts）集中定义界面变量和 xterm 配色；主题管理模块（theme.ts）负责状态、持久化、订阅；终端通过订阅实时更新配色。

**Tech Stack:** React 18 + TypeScript + @xterm/xterm，无新增依赖。

**Spec:** `docs/superpowers/specs/2026-07-18-theme-switching-design.md`

**验证说明：** 本项目无单元测试框架，验证手段为 `npx tsc -b` 类型检查 + 浏览器 mock 模式（http://localhost:5173）手动验证 + Electron 实测。

---

### Task 1: 主题注册表 themes.ts

**Files:**
- Create: `src/renderer/src/themes.ts`

- [ ] **Step 1: 创建主题注册表**

现有样式变量在 `src/renderer/src/styles.css` 的 `:root` 中（--bg、--bg-panel、--bg-hover、--bg-active、--border、--text、--text-dim、--green、--green-hover、--red、--radius）。本任务把 5 套主题的完整配色集中定义到一个文件，并补充换肤所需的新变量（--text-faint、--border-soft、--bg-strong、--yellow、--scrollbar、--scrollbar-hover、--green-dim、--mask、--term-bg），供 Task 3 的 CSS 改造使用。

创建 `src/renderer/src/themes.ts`，完整内容：

```ts
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
```

- [ ] **Step 2: 类型检查**

Run: `cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell && npx tsc -b`
Expected: 通过，无错误输出

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/themes.ts
git commit -m "feat: 主题注册表，内置 5 套主题配色"
```

---

### Task 2: 主题管理模块 theme.ts

**Files:**
- Create: `src/renderer/src/theme.ts`

- [ ] **Step 1: 创建主题管理模块**

负责：当前主题状态、localStorage 持久化（key: `easy-shell-theme`）、`data-theme` 属性应用、变化订阅、React hook。容错：存储的 id 失效时回退默认主题。

创建 `src/renderer/src/theme.ts`，完整内容：

```ts
import { useSyncExternalStore } from 'react'
import { DEFAULT_THEME_ID, getThemeById, THEMES } from './themes'
import type { ThemeDef } from './themes'

const STORAGE_KEY = 'easy-shell-theme'

function loadInitialId(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && getThemeById(saved)) return saved
  } catch {
    /* localStorage 不可用时用默认主题 */
  }
  return DEFAULT_THEME_ID
}

let currentId = loadInitialId()
const listeners = new Set<() => void>()

function applyToDom(): void {
  document.documentElement.dataset.theme = currentId
}

/** 启动时在 render 前调用，把当前主题应用到根节点 */
export function initTheme(): void {
  applyToDom()
}

export function getCurrentTheme(): ThemeDef {
  return getThemeById(currentId) ?? THEMES[0]
}

export function setTheme(id: string): void {
  if (!getThemeById(id) || id === currentId) return
  currentId = id
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* 写入失败不阻塞换肤 */
  }
  applyToDom()
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** React hook：返回当前主题，主题变化时触发重渲染 */
export function useTheme(): ThemeDef {
  useSyncExternalStore(subscribe, () => currentId)
  return getCurrentTheme()
}
```

- [ ] **Step 2: 类型检查**

Run: `cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell && npx tsc -b`
Expected: 通过，无错误输出

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/theme.ts
git commit -m "feat: 主题管理模块（状态/持久化/订阅/hook）"
```

---

### Task 3: styles.css 变量化改造

**Files:**
- Modify: `src/renderer/src/styles.css`

- [ ] **Step 1: `:root` 改为按 data-theme 分组，并补齐 5 套主题变量**

把文件开头的 `:root { ... }` 块（第 1-13 行）整体替换为以下内容（变量值与 Task 1 的 themes.ts 完全一致；`--radius` 各主题相同，保留在每个组内）：

```css
:root[data-theme='dark'] {
  --bg: #1b1b1c;
  --bg-panel: #232324;
  --bg-hover: #2c2c2e;
  --bg-active: #343436;
  --bg-strong: #404042;
  --border: #3a3a3c;
  --border-soft: #2a2a2c;
  --text: #e8e8e8;
  --text-dim: #9a9a9e;
  --text-faint: #636366;
  --green: #34c759;
  --green-hover: #2db04e;
  --green-dim: rgba(52, 199, 89, 0.18);
  --red: #ff453a;
  --yellow: #ffd60a;
  --scrollbar: #424244;
  --scrollbar-hover: #4e4e50;
  --mask: rgba(0, 0, 0, 0.55);
  --term-bg: #000000;
  --radius: 8px;
}

:root[data-theme='black'] {
  --bg: #000000;
  --bg-panel: #111113;
  --bg-hover: #1a1a1c;
  --bg-active: #242426;
  --bg-strong: #2e2e30;
  --border: #2c2c2e;
  --border-soft: #1c1c1e;
  --text: #f0f0f0;
  --text-dim: #8e8e93;
  --text-faint: #545456;
  --green: #30d158;
  --green-hover: #28b34c;
  --green-dim: rgba(48, 209, 88, 0.18);
  --red: #ff453a;
  --yellow: #ffd60a;
  --scrollbar: #323234;
  --scrollbar-hover: #3e3e40;
  --mask: rgba(0, 0, 0, 0.6);
  --term-bg: #000000;
  --radius: 8px;
}

:root[data-theme='navy'] {
  --bg: #0f1b2d;
  --bg-panel: #16233a;
  --bg-hover: #1d2d49;
  --bg-active: #24365a;
  --bg-strong: #2e4266;
  --border: #2c3f63;
  --border-soft: #1c2a44;
  --text: #e3ecf7;
  --text-dim: #8ba3c7;
  --text-faint: #54688a;
  --green: #34c759;
  --green-hover: #2db04e;
  --green-dim: rgba(52, 199, 89, 0.2);
  --red: #ff5f57;
  --yellow: #ffd60a;
  --scrollbar: #2c3f63;
  --scrollbar-hover: #3a5078;
  --mask: rgba(4, 10, 20, 0.6);
  --term-bg: #0a1424;
  --radius: 8px;
}

:root[data-theme='light'] {
  --bg: #f5f5f7;
  --bg-panel: #ffffff;
  --bg-hover: #eaeaec;
  --bg-active: #e0e0e2;
  --bg-strong: #d8d8da;
  --border: #d2d2d7;
  --border-soft: #e5e5ea;
  --text: #1d1d1f;
  --text-dim: #6e6e73;
  --text-faint: #aeaeb2;
  --green: #28a745;
  --green-hover: #218838;
  --green-dim: rgba(40, 167, 69, 0.15);
  --red: #d70015;
  --yellow: #b08800;
  --scrollbar: #c7c7cc;
  --scrollbar-hover: #aeaeb2;
  --mask: rgba(0, 0, 0, 0.35);
  --term-bg: #ffffff;
  --radius: 8px;
}

:root[data-theme='paper'] {
  --bg: #f7f3ea;
  --bg-panel: #fffdf7;
  --bg-hover: #efe9dc;
  --bg-active: #e7dfcf;
  --bg-strong: #ded5c0;
  --border: #ddd5c3;
  --border-soft: #eae3d3;
  --text: #3a352a;
  --text-dim: #8a8171;
  --text-faint: #b5ac99;
  --green: #3d9a50;
  --green-hover: #338543;
  --green-dim: rgba(61, 154, 80, 0.15);
  --red: #c9342b;
  --yellow: #9a7b00;
  --scrollbar: #d5ccb8;
  --scrollbar-hover: #c2b8a2;
  --mask: rgba(60, 50, 30, 0.35);
  --term-bg: #fbf7ec;
  --radius: 8px;
}
```

- [ ] **Step 2: 硬编码颜色全部替换为变量**

在 `src/renderer/src/styles.css` 中做以下替换（均为全局替换，注意保留原有选择器结构）：

| 查找 | 替换为 | 出现位置 |
| --- | --- | --- |
| `color: #636366;` | `color: var(--text-faint);` | placeholder、dot.closed、close、count、empty、star、term-tab close 等约 9 处 |
| `background: #636366;` | `background: var(--text-faint);` | `.topbar .session-tab .dot.closed`、`.term-tab .dot.closed` 共 2 处 |
| `border-bottom: 1px solid #2a2a2c;` | `border-bottom: 1px solid var(--border-soft);` | `tbody td` 1 处 |
| `background: #404042;` | `background: var(--bg-strong);` | `.btn:hover` 1 处 |
| `color: #ffd60a;` | `color: var(--yellow);` | `.star.on` 1 处 |
| `background: rgba(52, 199, 89, 0.18);` | `background: var(--green-dim);` | `.group-item.active` 1 处 |
| `background: rgba(0, 0, 0, 0.55);` | `background: var(--mask);` | `.modal-mask` 1 处 |
| `background: #424244;` | `background: var(--scrollbar);` | 滚动条 thumb 1 处 |
| `background: #4e4e50;` | `background: var(--scrollbar-hover);` | 滚动条 thumb hover 1 处 |
| `.term-body` 中的 `background: #000;` | `background: var(--term-bg);` | 1 处 |

- [ ] **Step 3: 浏览器验证默认主题无回归**

启动 dev server（若已在运行则跳过）：

```bash
cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell
nohup npx electron-vite dev --rendererOnly > /tmp/easy-shell-vite.log 2>&1 &
```

在 `index.html`（`src/renderer/index.html`）的 `<html>` 标签上手动加 `data-theme="dark"`（Task 5 会由代码自动设置，此处先手动验证样式）：

```html
<html lang="zh-CN" data-theme="dark">
```

打开 http://localhost:5173 ，确认界面与改造前完全一致（深色主题，无颜色错乱）。

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/styles.css src/renderer/index.html
git commit -m "feat: 样式变量化，5 套主题 CSS 变量组"
```

---

### Task 4: 主题选择面板 ThemePanel.tsx

**Files:**
- Create: `src/renderer/src/components/ThemePanel.tsx`
- Modify: `src/renderer/src/styles.css`（追加面板样式）

- [ ] **Step 1: 创建 ThemePanel 组件**

创建 `src/renderer/src/components/ThemePanel.tsx`，完整内容：

```tsx
import { useEffect, useRef } from 'react'
import { THEMES } from '../themes'
import { setTheme, useTheme } from '../theme'

interface Props {
  onClose: () => void
}

export default function ThemePanel({ onClose }: Props): JSX.Element {
  const theme = useTheme()
  const ref = useRef<HTMLDivElement>(null)

  // 点击面板外部关闭
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  return (
    <div className="theme-panel" ref={ref}>
      <div className="theme-panel-title">主题</div>
      {THEMES.map((t) => (
        <button
          key={t.id}
          className={`theme-card ${t.id === theme.id ? 'active' : ''}`}
          onClick={() => setTheme(t.id)}
        >
          <span className="swatches">
            <i style={{ background: t.vars['--bg'] }} />
            <i style={{ background: t.vars['--bg-panel'] }} />
            <i style={{ background: t.vars['--green'] }} />
          </span>
          {t.name}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 追加面板样式**

在 `src/renderer/src/styles.css` 末尾（滚动条样式之后）追加：

```css
/* ---------- 主题面板 ---------- */
.theme-entry {
  position: relative;
  -webkit-app-region: no-drag;
}

.icon-btn {
  padding: 5px 8px;
  border-radius: 6px;
  color: var(--text-dim);
  font-size: 15px;
  line-height: 1;
}

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.theme-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 200px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px;
  z-index: 200;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.theme-panel-title {
  padding: 4px 8px;
  font-size: 12px;
  color: var(--text-faint);
}

.theme-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  color: var(--text);
  text-align: left;
}

.theme-card:hover {
  background: var(--bg-hover);
}

.theme-card.active {
  border-color: var(--green);
}

.theme-card .swatches {
  display: flex;
}

.theme-card .swatches i {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid var(--border);
  margin-left: -5px;
}

.theme-card .swatches i:first-child {
  margin-left: 0;
}
```

- [ ] **Step 3: 类型检查**

Run: `cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell && npx tsc -b`
Expected: 通过，无错误输出

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/ThemePanel.tsx src/renderer/src/styles.css
git commit -m "feat: 主题选择面板组件"
```

---

### Task 5: App 集成（齿轮入口 + 启动初始化）

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/main.tsx`

- [ ] **Step 1: main.tsx 启动时应用主题**

修改 `src/renderer/src/main.tsx`，在 render 之前调用 `initTheme()`，完整内容：

```tsx
import ReactDOM from 'react-dom/client'
import App from './App'
import { initTheme } from './theme'
import '@xterm/xterm/css/xterm.css'
import './styles.css'

// 注意：不使用 StrictMode，避免开发模式双重挂载导致 SSH 重复连接
initTheme()
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
```

同时把 `src/renderer/index.html` 中 `<html>` 标签上 Task 3 手动加的 `data-theme="dark"` 保留即可（作为首屏防闪烁的默认值，initTheme 会覆盖为实际主题）。

- [ ] **Step 2: App.tsx 顶栏加齿轮入口**

修改 `src/renderer/src/App.tsx`：

1. 顶部 import 区追加：

```tsx
import ThemePanel from './components/ThemePanel'
```

2. state 区（`const [showGroupPrompt, setShowGroupPrompt] = useState(false)` 之后）追加：

```tsx
const [showThemePanel, setShowThemePanel] = useState(false)
```

3. topbar 中 `<div className="spacer" />` 之后追加齿轮按钮和面板：

```tsx
        <div className="spacer" />
        <div className="theme-entry">
          <button
            className="icon-btn"
            title="主题"
            onClick={() => setShowThemePanel((v) => !v)}
          >
            ⚙
          </button>
          {showThemePanel && (
            <ThemePanel onClose={() => setShowThemePanel(false)} />
          )}
        </div>
```

- [ ] **Step 3: 类型检查 + 浏览器验证**

Run: `cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell && npx tsc -b`
Expected: 通过

浏览器打开 http://localhost:5173 验证：
- 顶栏右侧出现齿轮按钮
- 点击齿轮弹出主题面板，5 张主题卡片（色块预览 + 名称），当前主题描边高亮
- 点击"明亮"，界面立即变浅色；点击"暗夜"恢复
- 点击面板外部，面板关闭
- 刷新页面，主题保持为上次选择

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/App.tsx src/renderer/src/main.tsx src/renderer/index.html
git commit -m "feat: 顶栏主题切换入口，启动时应用已保存主题"
```

---

### Task 6: 终端配色跟随主题

**Files:**
- Modify: `src/renderer/src/components/TerminalView.tsx`

- [ ] **Step 1: 终端创建和主题变化时应用配色**

修改 `src/renderer/src/components/TerminalView.tsx`：

1. 顶部 import 区追加：

```tsx
import { getCurrentTheme, useTheme } from '../theme'
```

2. `TermBody` 组件中，创建 Terminal 的 `theme` 选项（原 `theme: { background: '#000000' }`）改为：

```tsx
      theme: { ...getCurrentTheme().term }
```

3. `TermBody` 组件中，在"切换标签时重新适配尺寸"的 effect 之后，新增主题跟随 effect：

```tsx
  // 主题切换时实时更新终端配色
  const theme = useTheme()
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = { ...theme.term }
    }
  }, [theme])
```

注意：`useTheme()` 的调用必须放在 `TermBody` 函数组件顶层（与其它 hook 同级），不能放在条件或回调里。

- [ ] **Step 2: 类型检查 + 浏览器验证**

Run: `cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell && npx tsc -b`
Expected: 通过

浏览器 mock 模式验证（mock 环境可直接打开终端会话）：
- 打开一个连接的终端，黑底正常
- 点齿轮切到"深蓝"，终端背景立即变为深蓝（`#0a1424`），会话不断开、已输出内容保留
- 切到"明亮"，终端变为白底黑字
- 新建一个终端会话，新终端直接使用当前主题配色
- 切回"暗夜"，所有已打开终端一起变回黑底

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/TerminalView.tsx
git commit -m "feat: 终端配色跟随主题实时切换"
```

---

### Task 7: 全量验证

**Files:**
- 无（仅验证）

- [ ] **Step 1: 类型检查与构建**

```bash
cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell
npx tsc -b
npx electron-vite build
```

Expected: 均通过，无错误

- [ ] **Step 2: 浏览器 mock 模式完整走查**

按 spec 的验证清单逐项确认：
- 打开主题面板，逐一点击 5 套主题，界面和终端配色即时变化
- 切换主题后刷新页面，主题保持
- 在 DevTools Console 执行 `localStorage.setItem('easy-shell-theme', 'not-exist')` 后刷新，界面回退到"暗夜"
- 终端打开状态下切换主题，终端配色实时更新且会话不断开

- [ ] **Step 3: Electron 实测**

```bash
cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell
pkill -f "Electron.*easy-shell" 2>/dev/null; sleep 1
nohup npx electron . > /tmp/easy-shell-electron.log 2>&1 &
```

在 Electron 窗口中重复 Step 2 的走查项，确认行为一致。

- [ ] **Step 4: 收尾提交（如有修复）**

```bash
git add -A
git commit -m "fix: 主题切换全量验证修复" || echo "无需提交"
git push
```
