import { ipcMain, BrowserWindow } from 'electron'
import * as store from './store'
import * as ssh from './sshManager'
import type { SSHConnection } from '../shared/types'

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  // SSH 输出/关闭事件推给渲染进程
  ssh.setSinks(
    (sessionId, data) => {
      getWindow()?.webContents.send(`ssh:output:${sessionId}`, data)
    },
    (sessionId) => {
      getWindow()?.webContents.send(`ssh:closed:${sessionId}`)
    }
  )

  // ---------- 连接 CRUD ----------
  ipcMain.handle('connections:list', () => store.listConnections())
  ipcMain.handle(
    'connections:create',
    (_e, conn: Omit<SSHConnection, 'id' | 'createdAt'>) =>
      store.createConnection(conn)
  )
  ipcMain.handle(
    'connections:update',
    (_e, id: string, patch: Partial<SSHConnection>) =>
      store.updateConnection(id, patch)
  )
  ipcMain.handle('connections:remove', (_e, id: string) =>
    store.removeConnection(id)
  )

  // ---------- 分组 ----------
  ipcMain.handle('groups:list', () => store.listGroups())
  ipcMain.handle('groups:create', (_e, name: string) => store.createGroup(name))
  ipcMain.handle('groups:remove', (_e, id: string) => store.removeGroup(id))

  // ---------- SSH ----------
  ipcMain.handle(
    'ssh:connect',
    async (_e, connectionId: string, cols: number, rows: number) => {
      const conn = store.getConnection(connectionId)
      if (!conn) throw new Error('连接不存在')
      const result = await ssh.connect(conn, cols, rows)
      // 记录最近连接时间
      store.updateConnection(connectionId, { lastConnectedAt: Date.now() })
      return result
    }
  )
  ipcMain.on('ssh:input', (_e, sessionId: string, data: string) =>
    ssh.input(sessionId, data)
  )
  ipcMain.on(
    'ssh:resize',
    (_e, sessionId: string, cols: number, rows: number) =>
      ssh.resize(sessionId, cols, rows)
  )
  ipcMain.on('ssh:disconnect', (_e, sessionId: string) =>
    ssh.disconnect(sessionId)
  )
  ipcMain.handle('ssh:test', (_e, conn: Partial<SSHConnection>) =>
    ssh.testConnection(conn)
  )
}
