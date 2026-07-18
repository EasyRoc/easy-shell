# Easy Shell

一款简单好用的 SSH 桌面客户端，深色风格界面，支持连接管理和真实 SSH 终端。

## 功能

- **连接管理**：新建、编辑、删除 SSH 连接，支持收藏和"最近使用"排序
- **分组**：自定义分组，左侧树形结构快速筛选
- **多种登录方式**：密码登录、私钥登录（支持私钥口令）
- **真实终端**：基于 xterm.js，多标签页同时开多个会话，窗口大小变化自动适配
- **测延迟**：一键测试服务器连通性和耗时
- **本地存储**：连接配置保存在本地 JSON 文件，不上传任何数据

## 界面

主界面：左侧分组树 + 右侧连接列表（仿 XTerminal 深色风格）

编辑连接：名称、分组、地址端口、验证方式、备注、超时、心跳，支持先测试再保存

终端页：顶部多标签切换，绿色状态点表示连接中

## 技术栈

- Electron + electron-vite + React + TypeScript
- ssh2（主进程负责真实 SSH 连接）
- xterm.js（终端模拟器）
- JSON 文件本地存储（免数据库）

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发模式（会自动弹出应用窗口）
npm run dev

# 构建
npm run build
```

> 注意：如果你的 npm 开启了安装脚本拦截，Electron 可能装不完整（启动报 `Electron uninstall`）。
> 手动补一下就行：
> ```bash
> cd node_modules/electron && node install.js
> ```

另外，开发模式下用浏览器打开 http://localhost:5173 可以直接预览界面（使用 mock 数据），调样式不用开 Electron。

## 目录结构

```
src/
├── main/              # Electron 主进程
│   ├── index.ts       # 窗口创建、应用入口
│   ├── sshManager.ts  # SSH 会话管理（连接/输入/输出/断开/测速）
│   ├── store.ts       # 连接与分组的 JSON 持久化
│   └── ipc.ts         # 主进程与界面的通信桥
├── preload/index.ts   # 安全暴露给界面的 API
├── shared/types.ts    # 共用类型定义
└── renderer/src/      # React 界面
    ├── App.tsx
    └── components/
        ├── Sidebar.tsx       # 左侧分组树
        ├── HostTable.tsx     # 连接列表
        ├── HostEditModal.tsx # 编辑连接弹窗
        └── TerminalView.tsx  # 终端页（多标签）
```

## 数据存在哪

连接和分组配置保存在系统用户目录下：

- macOS：`~/Library/Application Support/easy-shell/connections.json`

## 后续规划

- 跳板机、代理设置、登录后自动执行初始化脚本
- SFTP 文件管理
- 服务器系统信息展示（CPU / 内存 / 硬盘）
- 配置导入导出
