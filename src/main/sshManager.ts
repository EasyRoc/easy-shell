import { Client, ConnectConfig } from 'ssh2'
import fs from 'fs'
import crypto from 'crypto'
import type { SSHConnection, TestResult } from '../shared/types'

interface Session {
  id: string
  connectionId: string
  client: Client
  stream: NodeJS.ReadWriteStream | null
}

interface PooledConnection {
  client: Client
  sessionIds: Set<string>
  ready: boolean
  readyPromise: Promise<void>
}

const sessions = new Map<string, Session>()
const pools = new Map<string, PooledConnection>()

// 输出/关闭回调由 ipc 层注入，用来把数据推给渲染进程
let outputSink: (sessionId: string, data: string) => void = () => {}
let closeSink: (sessionId: string) => void = () => {}

export function setSinks(
  onOutput: (sessionId: string, data: string) => void,
  onClosed: (sessionId: string) => void
): void {
  outputSink = onOutput
  closeSink = onClosed
}

function buildConfig(conn: SSHConnection): ConnectConfig {
  const cfg: ConnectConfig = {
    host: conn.host,
    port: conn.port || 22,
    username: conn.username,
    readyTimeout: conn.timeout && conn.timeout > 0 ? conn.timeout : 10000,
    keepaliveInterval:
      conn.heartbeat && conn.heartbeat > 0 ? conn.heartbeat : 5000,
    keepaliveCountMax: 3
  }
  if (conn.authType === 'privateKey' && conn.privateKeyPath) {
    const key = conn.privateKeyPath.trim()
    // 支持直接粘贴私钥内容，也支持填文件路径
    if (key.startsWith('-----BEGIN')) {
      cfg.privateKey = key
    } else {
      cfg.privateKey = fs.readFileSync(key)
    }
    if (conn.passphrase) cfg.passphrase = conn.passphrase
  } else {
    cfg.password = conn.password || ''
  }
  return cfg
}

function destroyPool(connectionId: string): void {
  const pool = pools.get(connectionId)
  if (!pool) return

  for (const sessionId of [...pool.sessionIds]) {
    const s = sessions.get(sessionId)
    if (s?.stream) {
      s.stream.removeAllListeners('close')
      try {
        s.stream.close()
      } catch {
        /* ignore */
      }
    }
    finalizeSession(sessionId)
  }

  try {
    pool.client.end()
  } catch {
    /* ignore */
  }
  pools.delete(connectionId)
}

function acquireClient(conn: SSHConnection): Promise<Client> {
  let pool = pools.get(conn.id)
  if (!pool) {
    const client = new Client()
    let readyResolve!: () => void
    let readyReject!: (err: Error) => void
    const readyPromise = new Promise<void>((resolve, reject) => {
      readyResolve = resolve
      readyReject = reject
    })

    pool = {
      client,
      sessionIds: new Set(),
      ready: false,
      readyPromise
    }
    pools.set(conn.id, pool)

    client.once('ready', () => {
      pool!.ready = true
      readyResolve()
    })
    client.once('error', (err) => {
      readyReject(new Error(err.message || '连接失败'))
      destroyPool(conn.id)
    })
    client.once('close', () => {
      destroyPool(conn.id)
    })

    try {
      client.connect(buildConfig(conn))
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      readyReject(err)
      pools.delete(conn.id)
      return Promise.reject(err)
    }
  }

  return pool.readyPromise.then(() => pool!.client)
}

export function connect(
  conn: SSHConnection,
  cols: number,
  rows: number
): Promise<{ sessionId: string }> {
  return new Promise((resolve, reject) => {
    const sessionId = crypto.randomUUID()

    acquireClient(conn)
      .then((client) => {
        const pool = pools.get(conn.id)
        if (!pool) {
          return reject(new Error('连接池不存在'))
        }

        client.shell(
          { term: 'xterm-256color', cols: cols || 80, rows: rows || 24 },
          (err, stream) => {
            if (err) {
              return reject(new Error('打开终端失败: ' + err.message))
            }

            const session: Session = {
              id: sessionId,
              connectionId: conn.id,
              client,
              stream
            }
            sessions.set(sessionId, session)
            pool.sessionIds.add(sessionId)

            stream.on('data', (data: Buffer) => {
              outputSink(sessionId, data.toString('utf-8'))
            })
            stream.stderr?.on('data', (data: Buffer) => {
              outputSink(sessionId, data.toString('utf-8'))
            })
            stream.on('close', () => {
              finalizeSession(sessionId)
            })
            resolve({ sessionId })
          }
        )
      })
      .catch(reject)
  })
}

function finalizeSession(sessionId: string): void {
  const s = sessions.get(sessionId)
  if (!s) return

  const pool = pools.get(s.connectionId)
  cleanup(sessionId)
  pool?.sessionIds.delete(sessionId)
  closeSink(sessionId)

  if (pool && pool.sessionIds.size === 0) {
    try {
      s.client.end()
    } catch {
      /* ignore */
    }
    pools.delete(s.connectionId)
  }
}

export function input(sessionId: string, data: string): void {
  sessions.get(sessionId)?.stream?.write(data)
}

export function resize(sessionId: string, cols: number, rows: number): void {
  const stream = sessions.get(sessionId)?.stream
  if (stream && 'setWindow' in stream) {
    ;(stream as { setWindow: (r: number, c: number) => void }).setWindow(
      rows,
      cols
    )
  }
}

export function disconnect(sessionId: string): void {
  const s = sessions.get(sessionId)
  if (!s) return

  if (s.stream) {
    s.stream.removeAllListeners('close')
    try {
      s.stream.close()
    } catch {
      /* ignore */
    }
  }
  finalizeSession(sessionId)
}

function cleanup(sessionId: string): void {
  sessions.delete(sessionId)
}

export function disconnectAll(): void {
  for (const id of [...sessions.keys()]) disconnect(id)
  pools.clear()
}

export function getClient(sessionId: string): Client | null {
  return sessions.get(sessionId)?.client ?? null
}

export function getClientByConnectionId(connectionId: string): Client | null {
  const pool = pools.get(connectionId)
  if (pool?.ready) return pool.client
  for (const s of sessions.values()) {
    if (s.connectionId === connectionId) return s.client
  }
  return null
}

// 测试连接：建连成功即断开，返回耗时
export function testConnection(conn: Partial<SSHConnection>): Promise<TestResult> {
  return new Promise((resolve) => {
    const start = Date.now()
    const client = new Client()
    let done = false
    const finish = (result: TestResult): void => {
      if (done) return
      done = true
      try {
        client.end()
      } catch {
        /* ignore */
      }
      resolve(result)
    }
    client.once('ready', () => {
      finish({ ok: true, latency: Date.now() - start })
    })
    client.once('error', (err) => {
      finish({ ok: false, error: err.message || '连接失败' })
    })
    try {
      client.connect(buildConfig(conn as SSHConnection))
    } catch (e) {
      finish({ ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  })
}
