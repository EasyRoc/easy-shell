# 终端页顶部栏美化 + 复制窗口功能 设计文档

日期：2026-07-18

## 背景

终端页顶部栏当前是朴素的"标签块"样式，视觉层次不足；同时用户需要"基于当前会话快速复制一个新 SSH 窗口"的能力（类似 Tabby 的 Duplicate Tab）。

## 目标

1. 顶部栏改为"浮动卡片"风格（方案 B），提升精致感，且 5 套主题自动适配。
2. 新增"复制窗口"按钮，一键基于当前激活会话复制出新会话。

非目标（YAGNI）：
- 标签右键菜单
- 标签悬停小复制按钮
- 拖拽排序标签
- 分屏

## 设计方案

### 1. 顶部栏视觉（浮动卡片风格）

改动文件：`src/renderer/src/styles.css`

- `.term-tabs`：底色微调（与终端区拉开层次），padding 调整为 `8px 10px 6px`。
- `.term-tab`（卡片化）：
  - 背景：`var(--bg-hover)` 级别的卡片底色
  - 圆角：8px（不再是只在顶部的 `8px 8px 0 0`）
  - 投影：`0 1px 3px rgba(0,0,0,.4)`
  - hover：底色变亮一档
- `.term-tab.active`：
  - 背景：更亮一档
  - 发光描边：`box-shadow: 0 2px 8px var(--green-dim), 0 0 0 1px var(--green-dim)`
  - 说明：`--green-dim` 在 5 套主题中均已定义，发光色随主题自动切换，无需为每套主题单独写样式。
- 连接状态圆点（绿=已连接 / 灰=断开）保留不动。
- "← SSH"返回、"文件"、"⧉ 复制窗口"按钮统一为图标按钮风格，hover 显示底色。

### 2. 复制窗口功能

改动文件：
- `src/renderer/src/components/TerminalView.tsx`
- `src/renderer/src/App.tsx`

交互：
- 标签栏右侧（"文件"按钮左侧）新增 ⧉ 按钮，tooltip "复制窗口"。
- 仅当存在激活会话时显示该按钮。
- 点击行为：取当前激活会话的 `connectionId` → 新建 `TermSession`（新 key、状态 connecting）→ 追加到 sessions 并设为激活 → 由现有 `TermBody` 挂载逻辑自动发起 SSH 连接。

实现要点：
- `App.tsx` 新增 `handleDuplicateSession()`：
  - 从 `sessions` 中找到 `activeSession` 对应的会话，取其 `connectionId` 与名称
  - 复用 `handleConnect` 的会话创建逻辑（新 key、connecting 状态、追加、激活、切到终端视图）
  - 不需要调主进程新接口；真实连接由 `TermBody` 的 `api.ssh.connect(connectionId, ...)` 完成
- `TerminalView.tsx`：
  - Props 新增 `onDuplicate?: () => void`
  - 在"文件"按钮左侧渲染 ⧉ 按钮（有激活会话时），点击调 `props.onDuplicate`

### 3. 错误处理

复制出的会话连接失败时，表现与正常连接失败一致：终端内红字输出失败原因，标签圆点变灰，状态置为 `error`。无额外弹窗。

### 4. 数据流

```
用户点 ⧉
  → TerminalView.onDuplicate
  → App.handleDuplicateSession
  → setSessions(追加新 connecting 会话) + setActiveSession(新 key)
  → TermBody 挂载 → api.ssh.connect(connectionId) → 正常连接流程
```

主进程（sshManager / ipc / preload）零改动。

## 验证

1. `npx tsc --noEmit` 编译通过
2. `npm run build` 构建通过
3. 浏览器 mock 模式（localhost:5173）：检查卡片样式、激活发光、hover 反馈、⧉ 按钮交互
4. Electron 实连：复制出的会话可正常输入输出；5 套主题下发光描边颜色跟随
