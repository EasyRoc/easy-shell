# 终端页顶部栏美化 + 复制窗口功能 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 终端页标签改为浮动卡片样式（激活卡带主题色发光描边），并新增"复制窗口"按钮一键复制当前会话。

**Architecture:** 纯渲染进程改动。样式集中在 `styles.css` 的终端页区块；复制窗口只是在 `App.tsx` 里基于现有会话状态新建一个 `TermSession`，真实连接由现有 `TermBody` 挂载逻辑自动发起，主进程零改动。

**Tech Stack:** React 18 + TypeScript + CSS 变量主题（5 套主题均已定义 `--bg-hover` / `--bg-active` / `--green-dim`）。

**依据 spec:** `docs/superpowers/specs/2026-07-18-terminal-topbar-design.md`

**验证约定：** 本项目无测试框架，沿用既定验证模式——`npx tsc --noEmit` 编译 + `npm run build` 构建 + 浏览器 mock 模式（http://localhost:5173）人工检查。启动开发服务用子 shell：`(cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell && nohup npm run dev > /tmp/easy-shell.log 2>&1 &) 2>/dev/null`。

---

### Task 1: 顶部栏浮动卡片样式

**Files:**
- Modify: `src/renderer/src/styles.css`（`.term-tabs`、`.term-tab`、`.term-tab:hover`、`.term-tab.active` 四处规则，约在 697-734 行）

- [ ] **Step 1: 修改 `.term-tabs` 容器**

把 padding 从 `8px 10px 0` 改为 `8px 10px`，gap 从 `4px` 改为 `6px`（卡片之间需要更大间距）：

```css
.term-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}
```

- [ ] **Step 2: 修改 `.term-tab` 为浮动卡片**

把原来的 `border-radius: 8px 8px 0 0` 改为全圆角卡片，加卡片底色和投影：

```css
.term-tab {
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

- [ ] **Step 3: 修改 hover 和 active 样式**

```css
.term-tab:hover {
  background: var(--bg-active);
}

.term-tab.active {
  background: var(--bg-active);
  color: var(--text);
  box-shadow:
    0 0 0 1px var(--green-dim),
    0 2px 8px var(--green-dim);
}
```

说明：`--green-dim` 是带透明度的主题绿，5 套主题（dark/black/navy/light/paper）均已定义，发光色随主题自动切换。

- [ ] **Step 4: 启动开发服务，浏览器检查样式**

```bash
pkill -f "electron" 2>/dev/null; sleep 1
(cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell && nohup npm run dev > /tmp/easy-shell.log 2>&1 &) 2>/dev/null
```

等 5 秒后打开 http://localhost:5173 ，在 mock 模式下连接任意服务器进入终端页，检查：
- 标签是悬浮卡片（有底色、圆角、轻微投影）
- 激活标签有绿色发光描边
- hover 非激活标签底色变亮
- 切换主题（右上角 ⚙）后发光色跟随主题

- [ ] **Step 5: Commit**

```bash
cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell
git add src/renderer/src/styles.css
git commit -m "feat: 终端标签改为浮动卡片样式，激活卡带主题色发光描边"
```

---

### Task 2: 复制窗口功能

**Files:**
- Modify: `src/renderer/src/components/TerminalView.tsx`（Props 接口 + 标签栏右侧按钮）
- Modify: `src/renderer/src/App.tsx`（新增 `handleDuplicateSession` 并传给 TerminalView）

- [ ] **Step 1: TerminalView.tsx 的 Props 接口加 `onDuplicate`**

在 [TerminalView.tsx](file:///Users/zhouqiantalaogong/Downloads/qoder/easy-shell/src/renderer/src/components/TerminalView.tsx) 的 `Props` 接口（约 15-22 行）末尾加一个可选回调：

```tsx
interface Props {
  sessions: TermSession[]
  activeKey: string | null
  onSwitch: (key: string) => void
  onClose: (key: string) => void
  onBack: () => void
  onStateChange: (key: string, status: TermSession['status']) => void
  onDuplicate?: () => void
}
```

- [ ] **Step 2: TerminalView.tsx 标签栏右侧加 ⧉ 按钮**

找到标签栏里 `<div className="spacer" />` 之后的"文件"按钮（约 57-65 行），在 spacer 和文件按钮之间插入复制按钮。显示条件是"有激活标签"（`props.activeKey`），不要求 SSH 已连通——connecting 状态的会话也允许复制：

```tsx
        <div className="spacer" />
        {props.activeKey && props.onDuplicate && (
          <button
            className="back-btn"
            title="复制窗口"
            onClick={props.onDuplicate}
          >
            ⧉
          </button>
        )}
        {activeSshId && (
          <button
            className={`back-btn ${showFiles ? 'active' : ''}`}
            onClick={() => setShowFiles((v) => !v)}
          >
            文件
          </button>
        )}
```

- [ ] **Step 3: App.tsx 新增 `handleDuplicateSession`**

在 [App.tsx](file:///Users/zhouqiantalaogong/Downloads/qoder/easy-shell/src/renderer/src/App.tsx) 的 `handleCloseSession` 函数之后（约 114 行后）新增：

```tsx
  const handleDuplicateSession = (): void => {
    const src = sessions.find((s) => s.key === activeSession)
    if (!src) return
    const key = `${src.connectionId}-${Date.now()}`
    const session: TermSession = {
      key,
      connectionId: src.connectionId,
      name: src.name,
      status: 'connecting'
    }
    setSessions((prev) => [...prev, session])
    setActiveSession(key)
    setView('terminal')
  }
```

- [ ] **Step 4: App.tsx 把 `onDuplicate` 传给 TerminalView**

在 `<TerminalView ...>`（约 220-227 行）的 props 里加一行：

```tsx
          <TerminalView
            sessions={sessions}
            activeKey={activeSession}
            onSwitch={setActiveSession}
            onClose={handleCloseSession}
            onBack={() => setView('list')}
            onStateChange={handleSessionState}
            onDuplicate={handleDuplicateSession}
          />
```

- [ ] **Step 5: 编译验证**

```bash
cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell
npx tsc --noEmit
```

Expected: 无输出（编译通过）

- [ ] **Step 6: 浏览器 mock 模式验证交互**

开发服务已在跑（Task 1 启动过，electron-vite 有热更新，直接刷新页面即可）。打开 http://localhost:5173 ：
- 连接一个服务器进入终端页 → 标签栏右侧出现 ⧉ 按钮（"文件"按钮左边），悬停显示"复制窗口"
- 点 ⧉ → 出现一个同名新标签并自动切换过去
- 再点几次 → 标签继续增加，各自独立
- 回到 SSH 列表页（← SSH）→ 顶部栏的会话标签不受影响

- [ ] **Step 7: Commit**

```bash
cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell
git add src/renderer/src/components/TerminalView.tsx src/renderer/src/App.tsx
git commit -m "feat: 新增复制窗口按钮，一键复制当前SSH会话"
```

---

### Task 3: 全量验证 + Electron 实连检查

**Files:** 无新增改动，纯验证

- [ ] **Step 1: 编译 + 构建**

```bash
cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell
npx tsc --noEmit && npm run build
```

Expected: tsc 无输出；build 输出 `✓ built in` 三段（main / preload / renderer）

- [ ] **Step 2: 重启 Electron 应用**

```bash
pkill -f "electron" 2>/dev/null; sleep 1
(cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell && nohup npm run dev > /tmp/easy-shell.log 2>&1 &) 2>/dev/null
```

- [ ] **Step 3: Electron 窗口里人工检查**

- 真实连接一台服务器，终端可正常输入输出
- 点 ⧉ 复制窗口 → 新标签出现并自动连接同一台服务器，两个会话互不影响（在一个里 `cd /tmp`，另一个目录不变）
- 切换 5 套主题，激活标签的发光描边颜色跟随主题
- 文件面板打开/关闭正常，⧉ 按钮不受文件面板状态影响

- [ ] **Step 4: 如有问题修复后提交；无问题则本次无 commit**

```bash
cd /Users/zhouqiantalaogong/Downloads/qoder/easy-shell
git status
```

Expected: 工作区干净（或仅有验证中发现并修复的问题对应的改动）
