// 主进程与渲染进程共享的类型定义

export type AuthType = 'password' | 'privateKey'

export interface SSHConnection {
  id: string
  name: string
  groupId: string | null
  host: string
  port: number
  authType: AuthType
  username: string
  password?: string
  privateKeyPath?: string
  passphrase?: string
  remark?: string
  timeout?: number // 毫秒
  heartbeat?: number // 毫秒
  favorite?: boolean
  lastConnectedAt?: number
  createdAt: number
}

export interface ConnectionGroup {
  id: string
  name: string
  createdAt: number
}

export interface ConnectResult {
  sessionId: string
}

export interface TestResult {
  ok: boolean
  latency?: number
  error?: string
}

export interface SftpFileEntry {
  name: string
  isDir: boolean
  size: number
  mtime: number // 秒级时间戳
}

export interface SftpProgress {
  file: string
  percent: number // 0-100
  done: boolean
  error?: string
}

// preload 暴露给渲染进程的 API 形状
export interface EasyShellApi {
  connections: {
    list(): Promise<SSHConnection[]>
    create(conn: Omit<SSHConnection, 'id' | 'createdAt'>): Promise<SSHConnection>
    update(id: string, patch: Partial<SSHConnection>): Promise<SSHConnection | null>
    remove(id: string): Promise<void>
  }
  groups: {
    list(): Promise<ConnectionGroup[]>
    create(name: string): Promise<ConnectionGroup>
    remove(id: string): Promise<void>
  }
  ssh: {
    connect(connectionId: string, cols?: number, rows?: number): Promise<ConnectResult>
    input(sessionId: string, data: string): void
    resize(sessionId: string, cols: number, rows: number): void
    disconnect(sessionId: string): void
    test(conn: Partial<SSHConnection>): Promise<TestResult>
    onOutput(sessionId: string, cb: (data: string) => void): () => void
    onClosed(sessionId: string, cb: () => void): () => void
  }
  sftp: {
    open(sessionId: string): Promise<void>
    close(sessionId: string): Promise<void>
    list(sessionId: string, path: string): Promise<SftpFileEntry[]>
    mkdir(sessionId: string, path: string): Promise<void>
    remove(sessionId: string, path: string, isDir: boolean): Promise<void>
    rename(sessionId: string, oldPath: string, newPath: string): Promise<void>
    upload(sessionId: string, localPaths: string[], remoteDir: string): Promise<void>
    download(sessionId: string, remotePath: string, defaultName: string): Promise<string | null>
    cancel(sessionId: string): Promise<void>
    onProgress(sessionId: string, cb: (p: SftpProgress) => void): () => void
  }
}
