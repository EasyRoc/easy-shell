import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { EasyShellApi, SSHConnection } from '../shared/types'

const api: EasyShellApi = {
  connections: {
    list: () => ipcRenderer.invoke('connections:list'),
    create: (conn) => ipcRenderer.invoke('connections:create', conn),
    update: (id, patch) => ipcRenderer.invoke('connections:update', id, patch),
    remove: (id) => ipcRenderer.invoke('connections:remove', id)
  },
  groups: {
    list: () => ipcRenderer.invoke('groups:list'),
    create: (name) => ipcRenderer.invoke('groups:create', name),
    remove: (id) => ipcRenderer.invoke('groups:remove', id)
  },
  ssh: {
    connect: (connectionId: string, cols?: number, rows?: number) =>
      ipcRenderer.invoke('ssh:connect', connectionId, cols ?? 80, rows ?? 24),
    input: (sessionId, data) => ipcRenderer.send('ssh:input', sessionId, data),
    resize: (sessionId, cols, rows) =>
      ipcRenderer.send('ssh:resize', sessionId, cols, rows),
    disconnect: (sessionId) => ipcRenderer.send('ssh:disconnect', sessionId),
    test: (conn: Partial<SSHConnection>) =>
      ipcRenderer.invoke('ssh:test', conn),
    onOutput: (sessionId, cb) => {
      const channel = `ssh:output:${sessionId}`
      const listener = (_e: IpcRendererEvent, data: string): void => cb(data)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    onClosed: (sessionId, cb) => {
      const channel = `ssh:closed:${sessionId}`
      const listener = (): void => cb()
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    }
  }
}

contextBridge.exposeInMainWorld('easyShell', api)
