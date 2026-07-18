import { ipcMain, BrowserWindow, dialog } from 'electron'
import * as store from './store'
import * as ssh from './sshManager'
import * as sftp from './sftpManager'
import * as sysInfo from './sysInfoCollector'
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

  // SFTP 进度推给渲染进程
  sftp.setProgressSink((sessionId, p) => {
    getWindow()?.webContents.send(`sftp:progress:${sessionId}`, p)
  })

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
      sysInfo.collectSystemInfo(conn).then(() => {
        getWindow()?.webContents.send('connections:changed')
      })
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
  ipcMain.handle('ssh:collectInfo', async (_e, connectionId: string) => {
    const conn = store.getConnection(connectionId)
    if (!conn) throw new Error('连接不存在')
    const result = await sysInfo.collectSystemInfo(conn)
    getWindow()?.webContents.send('connections:changed')
    return result
  })

  // ---------- SFTP ----------
  ipcMain.handle('sftp:open', async (_e, sessionId: string) => {
    const client = ssh.getClient(sessionId)
    if (!client) throw new Error('SSH 会话不存在')
    return sftp.open(sessionId, client)
  })
  ipcMain.handle('sftp:close', (_e, sessionId: string) =>
    sftp.close(sessionId)
  )
  ipcMain.handle('sftp:list', (_e, sessionId: string, path: string) =>
    sftp.list(sessionId, path)
  )
  ipcMain.handle('sftp:mkdir', (_e, sessionId: string, path: string) =>
    sftp.mkdir(sessionId, path)
  )
  ipcMain.handle(
    'sftp:remove',
    (_e, sessionId: string, path: string, isDir: boolean) =>
      sftp.remove(sessionId, path, isDir)
  )
  ipcMain.handle(
    'sftp:rename',
    (_e, sessionId: string, oldPath: string, newPath: string) =>
      sftp.rename(sessionId, oldPath, newPath)
  )
  ipcMain.handle(
    'sftp:upload',
    (_e, sessionId: string, localPaths: string[], remoteDir: string) =>
      sftp.upload(sessionId, localPaths, remoteDir)
  )
  ipcMain.handle(
    'sftp:download',
    async (_e, sessionId: string, remotePath: string, defaultName: string) => {
      const win = getWindow()
      if (!win) throw new Error('窗口不存在')
      const result = await dialog.showSaveDialog(win, {
        defaultPath: defaultName
      })
      if (result.canceled || !result.filePath) return null
      await sftp.download(sessionId, remotePath, result.filePath)
      return result.filePath
    }
  )
  ipcMain.handle('sftp:cancel', (_e, sessionId: string) =>
    sftp.cancel(sessionId)
  )
}
