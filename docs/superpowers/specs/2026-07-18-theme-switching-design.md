# 主题风格切换 设计文档

日期：2026-07-18
状态：已确认

## 背景

Easy Shell 目前只有一套深色主题（暗夜）。用户希望提供多套配色方案，可以按喜好随时切换界面和终端的配色。

## 目标

- 内置多套主题，界面和终端配色一起切换
- 切换即时生效，不刷新页面、不断开已建立的 SSH 连接
- 记住用户选择，下次启动保持

## 需求范围

### 做

1. 内置 5 套主题：暗夜（当前默认）、纯黑、深蓝、明亮、纸白
2. 每套主题包含两部分配色：界面配色 + 终端（xterm）配色
3. 顶栏右侧增加设置（齿轮）按钮，点击弹出主题选择面板
4. 主题面板中每套主题一张卡片（色块预览 + 名称），点击立即换肤
5. 切换主题时，所有已打开的终端实时更新配色，连接不断开
6. 选择结果持久化到 localStorage，启动时自动应用
7. 容错：本地存储的主题标识失效时，回退到默认主题"暗夜"

### 不做

- 用户自定义配色（只在内置主题中选择）
- 界面主题与终端配色分开设置（终端强制跟随界面主题）
- 跟随系统自动切换（手动选择即可）
- 字体、字号等其它外观设置（后续单独立项）

## 技术设计

### 方案

采用 CSS 变量换肤。现有样式已基于 CSS 变量（`--bg`、`--bg-panel`、`--border`、`--text`、`--green` 等），每套主题就是一组变量值，挂在 `:root[data-theme='xxx']` 选择器下。切换主题 = 修改根节点的 `data-theme` 属性，界面即时换肤，无闪烁。

### 新增/改动文件

| 文件 | 说明 |
| --- | --- |
| `src/renderer/src/themes.ts`（新增） | 主题注册表：每套主题一条记录，含 id、名称、界面变量值、xterm 配色值 |
| `src/renderer/src/theme.ts`（新增） | 主题管理：当前主题状态、切换函数、localStorage 读写、`data-theme` 应用、主题变化订阅 |
| `src/renderer/src/components/ThemePanel.tsx`（新增） | 顶栏齿轮弹出的主题选择面板 |
| `src/renderer/src/App.tsx`（改动） | 顶栏右侧加齿轮按钮；启动时应用已保存的主题 |
| `src/renderer/src/components/TerminalView.tsx`（改动） | 终端创建时使用当前主题配色；订阅主题变化，实时更新所有存活终端实例 |
| `src/renderer/src/styles.css`（改动） | 现有 `:root` 变量改为 `:root[data-theme='dark']`；新增其余 4 套主题的变量定义 |

### 主题数据结构

```ts
interface ThemeDef {
  id: string            // 如 'dark'、'black'、'navy'、'light'、'paper'
  name: string          // 显示名称：暗夜 / 纯黑 / 深蓝 / 明亮 / 纸白
  vars: Record<string, string>  // 界面 CSS 变量（--bg、--bg-panel、--border、--text、--text-dim、--green 等）
  term: {               // xterm 配色
    background: string
    foreground: string
    cursor: string
    // 其余 ANSI 色沿用 xterm 默认，不逐一定义
  }
}
```

### 数据流

启动：
1. `theme.ts` 读取 localStorage 的 `easy-shell-theme`
2. 校验主题 id 是否存在于注册表，不存在则回退 `'dark'`
3. 设置根节点 `data-theme`，界面应用对应变量
4. 之后创建的终端使用该主题的 `term` 配色

切换：
1. 用户在主题面板点击某套主题卡片
2. `theme.ts` 更新当前主题：写 localStorage、改 `data-theme`（界面即时变化）
3. 通知所有订阅者；TerminalView 对每个存活终端实例执行 `term.options.theme = ...`
4. 面板可保持打开继续预览，关闭后不影响已应用的主题

### 主题面板

- 入口：顶栏右侧齿轮按钮（`-webkit-app-region: no-drag`）
- 形态：点击后在按钮下方弹出浮层（非模态），点击面板外任意处关闭
- 内容：5 张主题卡片纵向排列，每张卡片左侧为三色预览块（背景色/面板色/主色），右侧为主题名；当前主题高亮描边
- 行为：点击卡片即切换；不设"确认/取消"按钮

### 错误处理

| 场景 | 处理 |
| --- | --- |
| localStorage 中主题 id 不存在于注册表 | 回退默认主题 `'dark'` |
| localStorage 读取异常（如被禁用） | 使用默认主题，切换时静默失败不阻塞界面 |
| 终端实例已销毁时收到主题变化 | 订阅回调内做空值判断，跳过 |

### 测试与验证

1. `npx tsc -b` 类型检查通过
2. 浏览器 mock 模式（http://localhost:5173）验证：
   - 打开主题面板，逐一点击 5 套主题，界面和终端配色即时变化
   - 切换主题后刷新页面，主题保持
   - localStorage 手动写入非法主题 id，刷新后回退默认
   - 终端打开状态下切换主题，终端配色实时更新且会话不断开
3. Electron 实际运行验证：kill 重启应用后走一遍上述流程

## 后续主题扩展

新增主题只需在 `themes.ts` 注册表中加一条记录，并在 `styles.css` 中增加对应 `:root[data-theme='xxx']` 变量组，无需改动其它代码。
