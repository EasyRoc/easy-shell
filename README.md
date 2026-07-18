# Easy Shell

一款简单好用的 SSH 桌面客户端，深色风格界面，支持连接管理、真实终端、文件管理和服务器信息查看。

## 功能

- **连接管理**：新建、编辑、删除 SSH 连接，支持收藏和"最近使用"排序
- **分组**：自定义分组，左侧树形结构快速筛选
- **多种登录方式**：密码登录、私钥登录（支持私钥口令）
- **真实终端**：基于 xterm.js，多标签页同时开多个会话，窗口大小变化自动适配
- **测延迟**：一键测试服务器连通性和耗时
- **主题切换**：5 套配色方案（暗夜 / 纯黑 / 深蓝 / 明亮 / 纸白），终端配色跟随主题
- **SFTP 文件管理**：右侧弹出文件面板，浏览目录、上传下载、新建/重命名/删除，支持拖拽上传
- **系统信息展示**：连接列表直接显示服务器的系统、CPU、内存、硬盘（连接后自动采集，支持手动刷新）
- **本地存储**：连接配置保存在本地 JSON 文件，不上传任何数据

## 界面预览

| 连接列表（含系统信息） | 终端页 + 文件面板 |
|:---:|:---:|
| 左侧分组 + 右侧列表 | 多标签切换 + 右侧 SFTP |
| 多套主题可切换 | 快捷目录 / 路径跳转 / 拖拽上传 |

## 技术栈

- Electron 31 + electron-vite + React 18 + TypeScript 5.5
- ssh2（主进程负责真实 SSH 连接与 SFTP 通道）
- xterm.js（终端模拟器）
- JSON 文件本地存储（免数据库）

## 下载

去 [Releases](https://github.com/EasyRoc/easy-shell/releases) 页面下载最新版本：

| 平台 | 文件 |
| --- | --- |
| macOS (Apple Silicon M1/M2/M3/M4) | `Easy-Shell-*-arm64.dmg` |
| macOS (Intel) | `Easy-Shell-*-x64.dmg` |
| Windows 64 位 | `Easy-Shell-Setup-*-x64.exe` |
| Windows 32 位 | `Easy-Shell-Setup-*-ia32.exe` |

> 不确定选哪个？
> - Mac 用户：点左上角苹果 → "关于本机"，看处理器是"Apple"还是"Intel"
> - Windows 用户：设置 → 系统 → 关于，看"系统类型"

## 开发

```bash
# 安装依赖
npm install

# 启动开发模式（会自动弹出应用窗口）
npm run dev

# 构建
npm run build

# 打包当前平台
npm run pack
```

> 注意：如果你的 npm 开启了安装脚本拦截，Electron 可能装不完整（启动报 `Electron uninstall`）。
> 手动补一下：
> ```bash
> cd node_modules/electron && node install.js
> ```

开发模式下浏览器打开 http://localhost:5173 可以直接预览界面（mock 数据），调样式不用开 Electron。

## 目录结构

```
src/
├── main/                    # Electron 主进程
│   ├── index.ts             # 窗口创建、应用入口
│   ├── sshManager.ts        # SSH 会话管理
│   ├── sftpManager.ts       # SFTP 通道管理
│   ├── sysInfoCollector.ts  # 系统信息采集
│   ├── store.ts             # 连接与分组的 JSON 持久化
│   └── ipc.ts               # 主进程与界面的通信桥
├── preload/index.ts         # 安全暴露给界面的 API
├── shared/types.ts          # 共用类型定义
└── renderer/src/            # React 界面
    ├── App.tsx
    ├── theme.ts             # 主题管理
    ├── themes.ts            # 5 套主题配置
    └── components/
        ├── Sidebar.tsx       # 左侧分组树
        ├── HostTable.tsx     # 连接列表（含系统信息列）
        ├── HostEditModal.tsx # 编辑连接弹窗
        ├── TerminalView.tsx  # 终端页（多标签）
        ├── FilePanel.tsx     # SFTP 文件面板
        └── ThemePanel.tsx    # 主题切换面板
```

## 数据存在哪

连接和分组配置保存在系统用户目录下：

- **macOS**：`~/Library/Application Support/easy-shell/connections.json`
- **Windows**：`%APPDATA%\easy-shell\connections.json`

## 许可证

MIT
