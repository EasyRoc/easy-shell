import type {
  EasyShellApi,
  SSHConnection,
  ConnectionGroup,
  SftpFileEntry,
  SftpProgress
} from '../../shared/types'

// 仅在纯浏览器环境（无 Electron preload）下使用的 UI 调试 mock。
// 数据存 localStorage，SSH 为模拟输出，方便不开 Electron 也能预览界面。

const KEY = 'easy-shell-mock'

interface MockData {
  connections: SSHConnection[]
  groups: ConnectionGroup[]
}

function load(): MockData {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || '{}') as MockData
    return {
      connections: d.connections ?? [],
      groups: d.groups ?? []
    }
  } catch {
    return { connections: [], groups: [] }
  }
}

function save(d: MockData): void {
  localStorage.setItem(KEY, JSON.stringify(d))
}

const delay = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms))

// ---------- mock 文件系统 ----------
interface MockNode {
  isDir: boolean
  size: number
  mtime: number
  children?: Record<string, MockNode>
}

const now = Math.floor(Date.now() / 1000)
const MOCK_FS: Record<string, MockNode> = {
  Documents: {
    isDir: true,
    size: 4096,
    mtime: now - 86400,
    children: {
      'report.pdf': { isDir: false, size: 245760, mtime: now - 3600 },
      pics: {
        isDir: true,
        size: 4096,
        mtime: now - 7200,
        children: {
          'photo.jpg': { isDir: false, size: 1048576, mtime: now - 1800 }
        }
      }
    }
  },
  app: {
    isDir: true,
    size: 4096,
    mtime: now - 43200,
    children: {
      'server.js': { isDir: false, size: 8192, mtime: now - 4000 },
      'package.json': { isDir: false, size: 1024, mtime: now - 4000 },
      logs: { isDir: true, size: 4096, mtime: now - 100, children: {} }
    }
  },
  'notes.txt': { isDir: false, size: 2048, mtime: now - 600 },
  'backup.tar.gz': { isDir: false, size: 15728640, mtime: now - 172800 }
}

function resolveDir(dir: string): Record<string, MockNode> {
  const parts = dir.split('/').filter((p) => p && p !== '.')
  let cur: Record<string, MockNode> = MOCK_FS
  for (const p of parts) {
    const node = cur[p]
    if (!node || !node.isDir || !node.children) throw new Error('目录不存在: ' + dir)
    cur = node.children
  }
  return cur
}

function toEntries(nodes: Record<string, MockNode>): SftpFileEntry[] {
  return Object.entries(nodes).map(([name, n]) => ({
    name,
    isDir: n.isDir,
    size: n.size,
    mtime: n.mtime
  }))
}

function mockProgress(
  sessionId: string,
  file: string,
  listeners: Map<string, Set<(p: SftpProgress) => void>>
): void {
  let pct = 0
  const timer = setInterval(() => {
    pct += 10
    const done = pct >= 100
    listeners.get(sessionId)?.forEach((cb) =>
      cb({ file, percent: Math.min(pct, 100), done })
    )
    if (done) clearInterval(timer)
  }, 100)
}

const progressListeners = new Map<string, Set<(p: SftpProgress) => void>>()

export function createMockApi(): EasyShellApi {
  // 首次启动塞两个带 sysInfo 的 mock 连接，方便调试
  if (load().connections.length === 0) {
    save({
      groups: [],
      connections: [
        {
          id: crypto.randomUUID(),
          name: 'Ubuntu 生产机',
          groupId: null,
          host: '10.0.0.8',
          port: 22,
          authType: 'password',
          username: 'root',
          createdAt: Date.now(),
          sysInfo: {
            os: 'Ubuntu 22.04',
            cpuCores: 8,
            memTotal: '15G',
            diskTotal: '39G',
            collectedAt: Date.now() - 3600_000
          }
        },
        {
          id: crypto.randomUUID(),
          name: 'CentOS 测试机',
          groupId: null,
          host: '10.0.0.9',
          port: 22,
          authType: 'password',
          username: 'root',
          createdAt: Date.now(),
          sysInfo: null
        }
      ]
    })
  }
  return {
    connections: {
      list: async () => load().connections,
      create: async (conn) => {
        const d = load()
        const full: SSHConnection = {
          ...conn,
          id: crypto.randomUUID(),
          createdAt: Date.now()
        }
        d.connections.push(full)
        save(d)
        return full
      },
      update: async (id, patch) => {
        const d = load()
        const i = d.connections.findIndex((c) => c.id === id)
        if (i === -1) return null
        d.connections[i] = { ...d.connections[i], ...patch, id }
        save(d)
        return d.connections[i]
      },
      remove: async (id) => {
        const d = load()
        d.connections = d.connections.filter((c) => c.id !== id)
        save(d)
      }
    },
    groups: {
      list: async () => load().groups,
      create: async (name) => {
        const d = load()
        const g: ConnectionGroup = {
          id: crypto.randomUUID(),
          name,
          createdAt: Date.now()
        }
        d.groups.push(g)
        save(d)
        return g
      },
      remove: async (id) => {
        const d = load()
        d.groups = d.groups.filter((g) => g.id !== id)
        d.connections = d.connections.map((c) =>
          c.groupId === id ? { ...c, groupId: null } : c
        )
        save(d)
      }
    },
    ssh: {
      connect: async () => {
        await delay(600)
        return { sessionId: 'mock-' + crypto.randomUUID() }
      },
      input: () => {},
      resize: () => {},
      disconnect: () => {},
      test: async () => {
        await delay(500)
        return { ok: true, latency: 42 }
      },
      collectInfo: async (connectionId) => {
        await delay(800)
        const d = load()
        const idx = d.connections.findIndex((c) => c.id === connectionId)
        if (idx === -1) return { ok: false, error: '连接不存在' }
        d.connections[idx] = {
          ...d.connections[idx],
          sysInfo: {
            os: 'Ubuntu 22.04',
            cpuCores: 4,
            memTotal: '7G',
            diskTotal: '19G',
            collectedAt: Date.now()
          }
        }
        save(d)
        return { ok: true }
      },
      onConnectionsChanged: () => () => {},
      onOutput: (_sessionId, cb) => {
        const lines = [
          'Welcome to Ubuntu 22.04 LTS (mock)\r\n',
          'Last login: Sat Jul 18 13:00:00 2026\r\n',
          'root@mock-server:~# '
        ]
        let i = 0
        const timer = setInterval(() => {
          if (i < lines.length) cb(lines[i++])
          else clearInterval(timer)
        }, 300)
        return () => clearInterval(timer)
      },
      onClosed: () => () => {}
    },
    sftp: {
      open: async () => {
        await delay(300)
      },
      close: async () => {},
      list: async (_sessionId, path) => {
        await delay(200)
        return toEntries(resolveDir(path))
      },
      mkdir: async (_sessionId, path) => {
        await delay(150)
        const parts = path.split('/').filter((p) => p && p !== '.')
        const name = parts.pop()
        if (!name) throw new Error('路径无效')
        const parent = resolveDir(parts.join('/'))
        parent[name] = { isDir: true, size: 4096, mtime: now, children: {} }
      },
      remove: async (_sessionId, path, isDir) => {
        await delay(150)
        const parts = path.split('/').filter((p) => p && p !== '.')
        const name = parts.pop()
        if (!name) throw new Error('路径无效')
        const parent = resolveDir(parts.join('/'))
        const node = parent[name]
        if (!node) throw new Error('文件不存在')
        if (isDir && node.children && Object.keys(node.children).length > 0) {
          throw new Error('文件夹不为空，无法删除')
        }
        delete parent[name]
      },
      rename: async (_sessionId, oldPath, newPath) => {
        await delay(150)
        const parts = oldPath.split('/').filter((p) => p && p !== '.')
        const oldName = parts.pop()
        const newName = newPath.split('/').pop()
        if (!oldName || !newName) throw new Error('路径无效')
        const parent = resolveDir(parts.join('/'))
        const node = parent[oldName]
        if (!node) throw new Error('文件不存在')
        parent[newName] = node
        delete parent[oldName]
      },
      upload: async (sessionId, localPaths, remoteDir) => {
        const dir = resolveDir(remoteDir)
        for (const p of localPaths) {
          const name = p.split('/').pop() || p
          mockProgress(sessionId, name, progressListeners)
          await delay(1100)
          dir[name] = { isDir: false, size: 102400, mtime: now }
        }
      },
      download: async (sessionId, remotePath) => {
        const name = remotePath.split('/').pop() || remotePath
        mockProgress(sessionId, name, progressListeners)
        await delay(1100)
        return '/mock/downloads/' + name
      },
      cancel: async () => {},
      onProgress: (sessionId, cb) => {
        let set = progressListeners.get(sessionId)
        if (!set) {
          set = new Set()
          progressListeners.set(sessionId, set)
        }
        set.add(cb)
        return () => {
          set.delete(cb)
        }
      }
    }
  }
}
