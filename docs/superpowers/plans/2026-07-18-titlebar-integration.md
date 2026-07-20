# 标题栏整合 + 标签右键菜单 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把系统标题栏和 SSH 标签栏整合成一行（mac 嵌红绿灯、win 用系统按钮覆盖层），去掉 "Easy Shell" 标题，并给标签加右键菜单（复制窗口/关闭/关闭其他/关闭全部）。

**Architecture:** 主进程只改窗口创建配置（titleBarStyle 等）；preload 暴露 `platform` 让渲染层按平台给标签栏留白；标签栏整条设为窗口拖动区、标签按钮设 no-drag；新增独立 `TabContextMenu` 组件，由 `TerminalView` 管理弹出状态，`App.tsx` 提供"复制指定标签/关闭其他/关闭全部"三个操作。SSH/SFTP 逻辑零改动。

**Tech Stack:** Electron 31（titleBarStyle / titleBarOverlay / trafficLightPosition / -webkit-app-region）+ React 18 + TypeScript + CSS 变量主题。

**依据 spec:** `docs/superpowers/specs/2026-07-18-titlebar-integration-design.md`

**验证约定：** 本项目无测试框架，沿用既定模式——`npx tsc --noEmit` + `npm run build` + 浏览器 mock（http://localhost:5173）+ Electron 实机。重启开发服务用子 shell：
`(cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell && nohup npm run dev > /tmp/easy-shell.log 2>&1 &) 2>/dev/null`，重启前先 `pkill -f electron`。

---

### Task 1: 主进程窗口配置（标题栏样式）

**Files:**
- Modify: `src/main/index.ts`（`createWindow` 函数，约 8-23 行）

- [ ] **Step 1: 按平台设置 titleBarStyle**

把 `createWindow` 里的 `new BrowserWindow({...})` 改成按平台分支。macOS 用 `hiddenInset`（红绿灯嵌入内容区），其他平台（Windows）用 `hidden` + `titleBarOverlay`（系统按钮覆盖在右上角）：

```ts
function createWindow(): void {
  const isMac = process.platform === 'darwin'
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Easy Shell',
    backgroundColor: '#1e1e1e',
    autoHideMenuBar: true,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac
      ? { trafficLightPosition: { x: 12, y: 13 } }
      : {
          titleBarOverlay: {
            color: '#232324',
            symbolColor: '#e8e8e8',
            height: 40
          }
        }),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
```

说明：
- `trafficLightPosition: { x: 12, y: 13 }` 把红绿灯固定在标签栏左侧（标签栏 40px 高，红绿灯 12px，y=13 基本垂直居中）。
- `titleBarOverlay` 的 `color: '#232324'` 与默认深色主题标签栏底色一致，`height: 40` 与标签栏同高。
- `title: 'Easy Shell'` 保留（程序坞/任务栏用），但不再显示在窗口标题栏。

- [ ] **Step 2: 编译验证**

```bash
cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell
npx tsc --noEmit
```

Expected: 无输出（编译通过）

- [ ] **Step 3: Commit**

```bash
cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell
git add src/main/index.ts
git commit -m "feat: 标题栏整合 - 主进程按平台设置 hiddenInset/hidden+overlay"
```

---

### Task 2: 平台信息暴露（types + preload + mock + App）

**Files:**
- Modify: `src/shared/types.ts`（`EasyShellApi` 接口，约 62 行）
- Modify: `src/preload/index.ts`（`api` 对象，约 4 行）
- Modify: `src/renderer/src/mockApi.ts`（`createMockApi` 的 return，约 153 行）
- Modify: `src/renderer/src/App.tsx`（在现有 useEffect 之后，约 42 行）

- [ ] **Step 1: types.ts 的 EasyShellApi 加 platform 字段**

在 `export interface EasyShellApi {` 的第一行（`connections:` 之前）加：

```ts
export interface EasyShellApi {
  platform: string
  connections: {
```

- [ ] **Step 2: preload/index.ts 暴露 process.platform**

在 `const api: EasyShellApi = {` 的第一行（`connections:` 之前）加：

```ts
const api: EasyShellApi = {
  platform: process.platform,
  connections: {
```

- [ ] **Step 3: mockApi.ts 的 return 加 platform（浏览器调试用）**

在 `createMockApi()` 的 `return {` 第一行（`connections:` 之前）加。浏览器里按 userAgent 判断，方便 mac/win 两种布局都能预览：

```ts
  return {
    platform: navigator.userAgent.includes('Mac') ? 'darwin' : 'win32',
    connections: {
```

- [ ] **Step 4: App.tsx 启动时把平台写到根节点**

在 `App.tsx` 第二个 `useEffect`（监听 `onConnectionsChanged` 那个，约 37-42 行）之后新增：

```tsx
  useEffect(() => {
    document.documentElement.dataset.platform = api.platform
  }, [])
```

- [ ] **Step 5: 编译验证**

```bash
cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell
npx tsc --noEmit
```

Expected: 无输出（编译通过）

- [ ] **Step 6: Commit**

```bash
cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell
git add src/shared/types.ts src/preload/index.ts src/renderer/src/mockApi.ts src/renderer/src/App.tsx
git commit -m "feat: 标题栏整合 - preload 暴露平台信息供渲染层留白"
```

---

### Task 3: CSS 标题栏整合（拖动 + 高度 + 平台留白）

**Files:**
- Modify: `src/renderer/src/styles.css`（`.topbar` 约 178 行、`.term-tabs` 约 697 行、`.term-tab` 约 716 行、`.term-tab.active` 约 733 行）

- [ ] **Step 1: `.topbar`（列表页标签栏）改 40px 高**

```css
.topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 14px;
  border-bottom: 1px solid var(--border);
  -webkit-app-region: drag;
}
```

（`.topbar` 原本就有 `drag`，保留；高度从内容撑开改为固定 40px，padding 从 `10px 14px` 改为 `0 14px`。）

- [ ] **Step 2: `.term-tabs`（终端页标签栏）改 40px 高 + 加 drag**

```css
.term-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 10px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  -webkit-app-region: drag;
}
```

（新增 `-webkit-app-region: drag` 让整条可拖动窗口；padding 从 `8px 10px 10px` 改为 `0 10px`。）

- [ ] **Step 3: `.term-tab` 加 no-drag（保证标签可点击）**

在 `.term-tab` 规则第一行加 `-webkit-app-region: no-drag;`：

```css
.term-tab {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 8px;
  background: var(--bg-hover);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  color: var(--text-dim);
  cursor: pointer;
  white-space: nowrap;
}
```

（`.term-tab` 内部的 `.close` 按钮默认继承 no-drag，不用单独加。`.back-btn` 已有 no-drag。）

- [ ] **Step 4: 激活标签辉光微调（适配 40px 高度，避免被 overflow 裁剪）**

把 `.term-tab.active` 的第二层辉光从 `0 2px 8px` 改为居中的 `0 0 6px`：

```css
.term-tab.active {
  background: var(--bg-active);
  color: var(--text);
  box-shadow:
    0 0 0 1px var(--green-dim),
    0 0 6px var(--green-dim);
}
```

- [ ] **Step 5: 文件末尾追加平台留白规则**

在 `styles.css` 末尾追加（mac 左侧给红绿灯留 78px，win 右侧给系统按钮留 138px）：

```css
/* ---------- 标题栏平台留白 ---------- */
:root[data-platform='darwin'] .topbar,
:root[data-platform='darwin'] .term-tabs {
  padding-left: 78px;
}

:root[data-platform='win32'] .topbar,
:root[data-platform='win32'] .term-tabs {
  padding-right: 138px;
}
```

- [ ] **Step 6: Commit**

```bash
cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell
git add src/renderer/src/styles.css
git commit -m "feat: 标题栏整合 - 标签栏可拖动+40px高+平台留白"
```

---

### Task 4: TabContextMenu 组件 + 菜单样式

**Files:**
- Create: `src/renderer/src/components/TabContextMenu.tsx`
- Modify: `src/renderer/src/styles.css`（末尾追加菜单样式）

- [ ] **Step 1: 创建 TabContextMenu.tsx**

```tsx
import { useEffect } from 'react'

interface Props {
  x: number
  y: number
  onDuplicate: () => void
  onClose: () => void
  onCloseOthers: () => void
  onCloseAll: () => void
  onDismiss: () => void
}

const MENU_W = 168
const MENU_H = 150

export default function TabContextMenu(props: Props): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') props.onDismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [props.onDismiss])

  // 边界收拢：靠右/靠下时往回收，避免超出窗口
  const left = Math.min(props.x, window.innerWidth - MENU_W - 8)
  const top = Math.min(props.y, window.innerHeight - MENU_H - 8)

  const click = (fn: () => void) => (): void => {
    props.onDismiss()
    fn()
  }

  return (
    <>
      <div
        className="ctx-overlay"
        onClick={props.onDismiss}
        onContextMenu={(e) => {
          e.preventDefault()
          props.onDismiss()
        }}
      />
      <div className="ctx-menu" style={{ left, top }}>
        <div className="ctx-item" onClick={click(props.onDuplicate)}>
          <span className="ctx-ic">⧉</span>复制窗口
        </div>
        <div className="ctx-sep" />
        <div className="ctx-item" onClick={click(props.onClose)}>
          <span className="ctx-ic">×</span>关闭
        </div>
        <div className="ctx-item" onClick={click(props.onCloseOthers)}>
          <span className="ctx-ic">⊘</span>关闭其他
        </div>
        <div className="ctx-item danger" onClick={click(props.onCloseAll)}>
          <span className="ctx-ic">⊗</span>关闭全部
        </div>
      </div>
    </>
  )
}
```

说明：
- `ctx-overlay` 是透明全屏遮罩，点空白处关闭菜单；`onContextMenu` 防止在遮罩上右键弹出系统默认菜单。
- 菜单 `z-index` 比遮罩高，点菜单项不会触发遮罩关闭。
- 悬停高亮、分隔线、危险操作红色都在下面的 CSS 里。

- [ ] **Step 2: styles.css 末尾追加菜单样式**

```css
/* ---------- 标签右键菜单 ---------- */
.ctx-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
}

.ctx-menu {
  position: fixed;
  z-index: 91;
  width: 168px;
  background: var(--bg-active);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 5px;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.5);
  animation: ctx-pop 0.16s ease-out;
}

@keyframes ctx-pop {
  from {
    opacity: 0;
    transform: translateY(-5px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 12.5px;
  color: var(--text);
  cursor: default;
  transition: background 0.1s;
}

.ctx-item .ctx-ic {
  width: 15px;
  text-align: center;
  color: var(--text-dim);
  font-size: 12px;
}

.ctx-item:hover {
  background: var(--green-dim);
}

.ctx-item:hover .ctx-ic {
  color: var(--green);
}

.ctx-item.danger:hover {
  background: rgba(255, 69, 58, 0.16);
}

.ctx-item.danger:hover .ctx-ic {
  color: var(--red);
}

.ctx-sep {
  height: 1px;
  background: var(--border);
  margin: 5px 7px;
}
```

（全部用主题变量，5 套主题自动适配；"关闭全部"悬停用红色防误触。）

- [ ] **Step 3: 编译验证**

```bash
cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell
npx tsc --noEmit
```

Expected: 无输出（编译通过）。此时组件还没被引用，属正常（下一个任务接线）。

- [ ] **Step 4: Commit**

```bash
cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell
git add src/renderer/src/components/TabContextMenu.tsx src/renderer/src/styles.css
git commit -m "feat: 新增标签右键菜单组件（复制/关闭/关闭其他/关闭全部）"
```

---

### Task 5: 接线（TerminalView 右键 + App 三个操作）

**Files:**
- Modify: `src/renderer/src/components/TerminalView.tsx`（Props、state、标签 onContextMenu、⧉ 按钮、菜单渲染、import）
- Modify: `src/renderer/src/App.tsx`（`handleDuplicateSession` 改造 + 新增两个 handler + 传 props）

- [ ] **Step 1: TerminalView.tsx 引入组件并加 Props**

顶部 import 区加：

```tsx
import TabContextMenu from './TabContextMenu'
```

`Props` 接口把 `onDuplicate?: () => void` 替换为三个新回调：

```tsx
interface Props {
  sessions: TermSession[]
  activeKey: string | null
  onSwitch: (key: string) => void
  onClose: (key: string) => void
  onBack: () => void
  onStateChange: (key: string, status: TermSession['status']) => void
  onDuplicateKey?: (key: string) => void
  onCloseOthers?: (key: string) => void
  onCloseAll?: () => void
}
```

- [ ] **Step 2: TerminalView.tsx 加菜单 state**

在 `const [showFiles, setShowFiles] = useState(false)` 之后加：

```tsx
  const [menu, setMenu] = useState<{ key: string; x: number; y: number } | null>(null)
```

- [ ] **Step 3: TerminalView.tsx 给每个标签加 onContextMenu**

把 `.term-tab` 的 div（约 38-56 行）加上右键处理：

```tsx
          <div
            key={s.key}
            className={`term-tab ${props.activeKey === s.key ? 'active' : ''}`}
            onClick={() => props.onSwitch(s.key)}
            onContextMenu={(e) => {
              e.preventDefault()
              setMenu({ key: s.key, x: e.clientX, y: e.clientY })
            }}
          >
```

- [ ] **Step 4: TerminalView.tsx 改 ⧉ 按钮调用**

把原来的 `onDuplicate` 按钮（约 59-67 行）改为：

```tsx
        {props.activeKey && props.onDuplicateKey && (
          <button
            className="back-btn"
            title="复制窗口"
            onClick={() => {
              if (props.activeKey) props.onDuplicateKey?.(props.activeKey)
            }}
          >
            ⧉
          </button>
        )}
```

- [ ] **Step 5: TerminalView.tsx 渲染菜单**

在组件 return 的最后一个 `</div>`（`.terminal-page` 的闭合标签）之前插入：

```tsx
      {menu && (
        <TabContextMenu
          x={menu.x}
          y={menu.y}
          onDuplicate={() => props.onDuplicateKey?.(menu.key)}
          onClose={() => props.onClose(menu.key)}
          onCloseOthers={() => props.onCloseOthers?.(menu.key)}
          onCloseAll={() => props.onCloseAll?.()}
          onDismiss={() => setMenu(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 6: App.tsx 改造 handleDuplicateSession 接收 key**

把现有的 `handleDuplicateSession`（约 116-129 行）改为接收指定 key：

```tsx
  const handleDuplicateSession = (key: string): void => {
    const src = sessions.find((s) => s.key === key)
    if (!src) return
    const newKey = `${src.connectionId}-${Date.now()}`
    const session: TermSession = {
      key: newKey,
      connectionId: src.connectionId,
      name: src.name,
      status: 'connecting'
    }
    setSessions((prev) => [...prev, session])
    setActiveSession(newKey)
    setView('terminal')
    void reload()
  }
```

- [ ] **Step 7: App.tsx 新增 handleCloseOthers 和 handleCloseAll**

在 `handleDuplicateSession` 之后新增：

```tsx
  const handleCloseOthers = (key: string): void => {
    const kept = sessions.filter((s) => s.key === key)
    setSessions(kept)
    if (kept.length > 0) {
      setActiveSession(key)
    } else {
      setActiveSession(null)
      setView('list')
    }
  }

  const handleCloseAll = (): void => {
    setSessions([])
    setActiveSession(null)
    setView('list')
  }
```

（被移除的会话对应的终端卸载时会自动断开 SSH，复用现有 TermBody 生命周期。）

- [ ] **Step 8: App.tsx 把三个回调传给 TerminalView**

把 `<TerminalView ...>`（约 236-244 行）的 props 更新为：

```tsx
          <TerminalView
            sessions={sessions}
            activeKey={activeSession}
            onSwitch={setActiveSession}
            onClose={handleCloseSession}
            onBack={() => setView('list')}
            onStateChange={handleSessionState}
            onDuplicateKey={handleDuplicateSession}
            onCloseOthers={handleCloseOthers}
            onCloseAll={handleCloseAll}
          />
```

- [ ] **Step 9: 编译验证**

```bash
cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell
npx tsc --noEmit
```

Expected: 无输出（编译通过）

- [ ] **Step 10: Commit**

```bash
cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell
git add src/renderer/src/components/TerminalView.tsx src/renderer/src/App.tsx
git commit -m "feat: 标签右键菜单接线 + 复制指定标签/关闭其他/关闭全部"
```

---

### Task 6: 全量验证

**Files:** 无新增改动，纯验证

- [ ] **Step 1: 编译 + 构建**

```bash
cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell
npx tsc --noEmit && npm run build
```

Expected: tsc 无输出；build 输出 main / preload / renderer 三段 `✓ built in`

- [ ] **Step 2: 重启开发服务**

```bash
pkill -f "electron" 2>/dev/null; sleep 1
(cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell && nohup npm run dev > /tmp/easy-shell.log 2>&1 &) 2>/dev/null
```

- [ ] **Step 3: 浏览器 mock 模式检查**

打开 http://localhost:5173 ，连接一个服务器进入终端页：
- 标签栏单行，mac 布局下左侧有留白（浏览器在 mac 上，`data-platform=darwin`）
- 右键任意标签 → 菜单在鼠标位置弹出，4 个选项，悬停高亮（"关闭全部"红色）
- 点"复制窗口" → 新增同名标签
- 点"关闭其他" → 只剩右键的那个标签
- 再开几个标签，点"关闭全部" → 回到 SSH 列表页
- 点空白处 / 按 Esc → 菜单关闭
- 靠窗口右下角右键标签 → 菜单自动收拢不越界

- [ ] **Step 4: 临时验证 win32 布局**

在浏览器控制台执行 `document.documentElement.dataset.platform = 'win32'`，检查标签栏右侧出现 ~138px 留白；执行 `document.documentElement.dataset.platform = 'darwin'` 恢复。

- [ ] **Step 5: Electron（macOS）实机检查**

- 红绿灯与 SSH 标签排在同一行，"Easy Shell" 标题消失
- 拖标签栏空白处可移动窗口；点标签/按钮不会拖动窗口
- 红绿灯三个按钮（关闭/最小化/全屏）正常
- 右键菜单各操作正常，复制出的会话可正常输入输出

- [ ] **Step 6: 如有问题修复后提交；无问题则本次无 commit**

```bash
cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell
git status
```

Expected: 工作区干净（或仅有验证中修复的改动）
