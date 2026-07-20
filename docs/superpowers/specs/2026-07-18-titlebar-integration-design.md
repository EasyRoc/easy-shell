# 标题栏整合 + 标签右键菜单 设计文档

日期：2026-07-18

## 背景

目前应用用的是系统原生标题栏：红绿灯（关闭/缩小/放大）和 "Easy Shell" 标题在**上面一行**（系统画的），SSH 标签栏在**下面单独一行**，两行分开、占地方，"Easy Shell" 标题也没什么用。用户想要 Chrome / VS Code 那种"标签栏即标题栏"的样式：红绿灯和 SSH 标签排在同一行，去掉标题，空白处可拖动窗口。另外希望在标签上点右键弹出操作菜单（复制窗口、关闭等）。

应用同时打包 macOS 和 Windows，两个平台都要支持。

## 目标

1. 标题栏与标签栏整合成一行：红绿灯 + SSH 标签并排，去掉 "Easy Shell" 标题显示。
2. 标签栏空白处可拖动窗口；标签和按钮点击不受影响。
3. 标签上右键弹出菜单：复制窗口 / 关闭 / 关闭其他 / 关闭全部。
4. macOS 和 Windows 两个平台都用各自原生方式实现，体验一致。

非目标（YAGNI）：
- Windows 覆盖层按钮颜色随主题动态变化（先用固定色，跟默认主题一致）
- 标签拖拽排序、分屏
- 终端区域右键菜单（只做标签）
- Linux 平台适配（项目只打包 mac + win）

## 设计方案

### 1. 窗口外壳（主进程 `src/main/index.ts`）

按平台设置不同的标题栏样式：

- **macOS**：`titleBarStyle: 'hiddenInset'` —— 隐藏系统标题栏，红绿灯保留并"嵌"进窗口内容左上角；用 `trafficLightPosition: { x: 12, y: 13 }` 固定红绿灯位置，让它跟 40px 高的标签栏垂直对齐。
- **Windows**：`titleBarStyle: 'hidden'` + `titleBarOverlay: { color: '#232324', symbolColor: '#e8e8e8', height: 40 }` —— 隐藏标题栏，系统的最小化/最大化/关闭按钮由系统画在右上角（覆盖层），不用自己写按钮。`#232324` 与默认深色主题的标签栏底色一致。
- 标签栏统一 **40px 高**，两个平台对齐。
- `title: 'Easy Shell'` 保留（给程序坞/任务栏用），但不再显示在窗口上。

### 2. 平台识别（preload + 类型 + mock）

渲染层需要知道当前平台，才能给标签栏留出红绿灯/系统按钮的位置：

- `src/shared/types.ts` 的 `EasyShellApi` 加一个字段：`platform: string`。
- `src/preload/index.ts`：`platform: process.platform`。
- `src/renderer/src/mockApi.ts`：mock 也要实现这个字段（浏览器调试时按 `navigator` 判断返回 `'darwin'` 或 `'win32'`，方便两种布局都能预览）。
- `src/renderer/src/App.tsx`：启动时把平台写到页面根节点 `document.documentElement.dataset.platform`，CSS 据此切换留白。

### 3. 拖动 + 留白（`src/renderer/src/styles.css`）

两个标签栏（列表页 `.topbar`、终端页 `.term-tabs`）统一处理：

- 整条标签栏设为可拖动窗口区域：`-webkit-app-region: drag`（`.topbar` 已有，`.term-tabs` 需新增）。
- 标签和按钮设为不可拖动，保证点击正常：`.term-tab` 需新增 `no-drag`；`.back-btn`、`.topbar .tab`、`.topbar .session-tab`、`.theme-entry` 已有。
- 统一 40px 高、内容垂直居中。
- 平台留白（用 `:root[data-platform=...]` 选择器）：
  - macOS：标签栏左侧留 ~78px 给红绿灯。
  - Windows：标签栏右侧留 ~138px 给系统覆盖层按钮。
- 激活标签的发光描边保留；若 40px 高度下底部辉光被裁剪，微调辉光范围（延续上一个任务的做法）。

### 4. 标签右键菜单（新组件 + App 新操作）

**新组件 `src/renderer/src/components/TabContextMenu.tsx`：**

- 在鼠标位置（`clientX/clientY`）固定定位弹出，做简单的边界收拢（靠右/靠下时往回收，避免超出窗口）。
- 四个选项：复制窗口 / 关闭 / 关闭其他 / 关闭全部；中间有分隔线；悬停高亮跟随主题绿；"关闭全部"用红色提示防误触。
- 点空白处（透明遮罩或全局 mousedown 监听）或按 Esc 关闭。
- 弹出时带轻微淡入动画。

**`TerminalView.tsx`：**

- 每个 `.term-tab` 上加 `onContextMenu`：阻止默认菜单，记录 `{ key, x, y }` 并弹出菜单。
- Props 调整：把现有的 `onDuplicate?: () => void` 改成 `onDuplicateKey?: (key: string) => void`（可指定复制哪个标签）。⧉ 按钮调 `onDuplicateKey(activeKey)`；菜单的"复制窗口"调 `onDuplicateKey(菜单对应的 key)`。
- 新增 Props：`onCloseOthers?: (key: string) => void`、`onCloseAll?: () => void`；"关闭"复用现有 `onClose(key)`。

**`App.tsx`：**

- `handleDuplicateSession(key: string)`：复制指定 key 的会话（原来只能复制激活的）。
- 新增 `handleCloseOthers(key: string)`：只保留这个会话并设为激活。
- 新增 `handleCloseAll()`：关掉所有会话，回到 SSH 列表页。
- 关闭会话复用现有逻辑（从 sessions 移除 → 对应终端卸载时自动断开 SSH）。

## 数据流

```
右键标签
  → .term-tab onContextMenu → 记录 {key, x, y}
  → 渲染 TabContextMenu
  → 点"复制窗口" → onDuplicateKey(key) → App.handleDuplicateSession(key)
     → 新建 connecting 会话 → TermBody 挂载自动连接
  → 点"关闭其他" → onCloseOthers(key) → 只留该会话
  → 点"关闭全部" → onCloseAll() → 清空会话、回列表页
```

主进程只改窗口创建配置（titleBarStyle 等），SSH / SFTP 逻辑零改动。

## 错误处理 / 边界

- 菜单打开时切换/关闭标签：菜单仍指向原 key，操作时若该 key 已不存在，`handleDuplicateSession` 里 `find` 不到直接 return（沿用现有保护）。
- "关闭全部"/"关闭其他"后激活会话和视图状态要同步（关完回列表页）。
- 浏览器 mock 模式下平台按 navigator 判断，布局可预览但无真实窗口拖动（正常）。

## 验证

1. `npx tsc --noEmit` 编译通过；`npm run build` 构建通过。
2. 浏览器 mock 模式：标签栏单行、平台留白正确、右键菜单弹出/悬停/关闭交互正常、四个操作都生效。
3. Electron（macOS）实机：红绿灯与标签同行、可拖动窗口、点标签不触发拖动、右键菜单好用、复制/关闭操作正常。
4. Windows 布局：浏览器里临时把 `data-platform` 设成 `win32` 检查右侧留白；真实 Windows 效果靠代码审查 + 覆盖层配置确认。
