import type {
  EasyShellApi,
  SSHConnection,
  ConnectionGroup
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

export function createMockApi(): EasyShellApi {
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
    }
  }
}
