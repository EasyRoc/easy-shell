import { Client, ConnectConfig } from 'ssh2'
import fs from 'fs'
import crypto from 'crypto'
import type { SSHConnection, TestResult } from '../shared/types'

interface Session {
  id: string
  client: Client
  stream: NodeJS.ReadWriteStream | null
}

const sessions = new Map<string, Session>()

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
    cfg.privateKey = fs.readFileSync(conn.privateKeyPath)
    if (conn.passphrase) cfg.passphrase = conn.passphrase
  } else {
    cfg.password = conn.password || ''
  }
  return cfg
}

export function connect(
  conn: SSHConnection,
  cols: number,
  rows: number
): Promise<{ sessionId: string }> {
  return new Promise((resolve, reject) => {
    const client = new Client()
    const sessionId = crypto.randomUUID()
    const session: Session = { id: sessionId, client, stream: null }

    const onReady = (): void => {
      client.shell(
        { term: 'xterm-256color', cols: cols || 80, rows: rows || 24 },
        (err, stream) => {
          if (err) {
            client.end()
            return reject(new Error('打开终端失败: ' + err.message))
          }
          session.stream = stream
          sessions.set(sessionId, session)

          stream.on('data', (data: Buffer) => {
            outputSink(sessionId, data.toString('utf-8'))
          })
          stream.stderr?.on('data', (data: Buffer) => {
            outputSink(sessionId, data.toString('utf-8'))
          })
          stream.on('close', () => {
            cleanup(sessionId)
            closeSink(sessionId)
          })
          resolve({ sessionId })
        }
      )
    }

    client.once('ready', onReady)
    client.once('error', (err) => {
      cleanup(sessionId)
      reject(new Error(err.message || '连接失败'))
    })
    client.once('close', () => {
      if (sessions.has(sessionId)) {
        cleanup(sessionId)
        closeSink(sessionId)
      }
    })

    try {
      client.connect(buildConfig(conn))
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })
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
  if (s) {
    try {
      s.stream?.end()
    } catch {
      /* ignore */
    }
    try {
      s.client.end()
    } catch {
      /* ignore */
    }
    cleanup(sessionId)
  }
}

function cleanup(sessionId: string): void {
  sessions.delete(sessionId)
}

export function disconnectAll(): void {
  for (const id of [...sessions.keys()]) disconnect(id)
}

export function getClient(sessionId: string): Client | null {
  return sessions.get(sessionId)?.client ?? null
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
