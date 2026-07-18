import { Client } from 'ssh2'
import fs from 'fs'
import type { SSHConnection } from '../shared/types'
import * as store from './store'
import * as ssh from './sshManager'

interface SysInfoResult {
  os: string
  cpuCores: number
  memTotal: string
  diskTotal: string
  collectedAt: number
}

// 在 client 上执行一条命令，返回 stdout 文本；失败抛错
function execOn(client: Client, cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    client.exec(cmd, (err, stream) => {
      if (err) return reject(err)
      let out = ''
      let errOut = ''
      stream.on('data', (d: Buffer) => {
        out += d.toString('utf-8')
      })
      stream.stderr?.on('data', (d: Buffer) => {
        errOut += d.toString('utf-8')
      })
      stream.on('close', (code: number) => {
        if (code !== 0) {
          return reject(new Error(errOut.trim() || `命令退出码 ${code}`))
        }
        resolve(out)
      })
    })
  })
}

function parseOs(text: string): string {
  const m = text.match(/PRETTY_NAME="?([^"\n]+)"?/)
  return m ? m[1].trim() : '-'
}

function parseCpu(text: string): number {
  const n = parseInt(text.trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function parseMem(text: string): string {
  const line = text.split('\n').find((l) => l.startsWith('Mem:'))
  if (!line) return '-'
  const mb = parseInt(line.split(/\s+/)[1], 10)
  if (!Number.isFinite(mb)) return '-'
  const gb = mb / 1024
  return gb >= 1 ? `${Math.round(gb)}G` : `${mb}M`
}

function parseDisk(text: string): string {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return '-'
  const parts = lines[1].split(/\s+/)
  return parts[1] || '-'
}

async function runCollect(client: Client): Promise<SysInfoResult> {
  const [osRaw, cpuRaw, memRaw, diskRaw] = await Promise.all([
    execOn(client, 'cat /etc/os-release').catch(() => ''),
    execOn(client, 'nproc').catch(() => ''),
    execOn(client, 'free -m').catch(() => ''),
    execOn(client, 'df -h /').catch(() => '')
  ])
  return {
    os: osRaw ? parseOs(osRaw) : '-',
    cpuCores: cpuRaw ? parseCpu(cpuRaw) : 0,
    memTotal: memRaw ? parseMem(memRaw) : '-',
    diskTotal: diskRaw ? parseDisk(diskRaw) : '-',
    collectedAt: Date.now()
  }
}

// 复用现有连接执行采集；没有则建临时连接
export async function collectSystemInfo(
  conn: SSHConnection
): Promise<{ ok: boolean; error?: string }> {
  let client: Client | null = ssh.getClientByConnectionId(conn.id)
  let ownClient = false
  if (!client) {
    client = new Client()
    ownClient = true
    await new Promise<void>((resolve, reject) => {
      const cfg = buildClientConfig(conn)
      client!.once('ready', () => resolve())
      client!.once('error', (err) =>
        reject(new Error(err.message || '连接失败'))
      )
      try {
        client!.connect(cfg)
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    })
  }
  try {
    const info = await runCollect(client)
    store.updateConnection(conn.id, { sysInfo: info })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  } finally {
    if (ownClient) {
      try {
        client.end()
      } catch {
        /* ignore */
      }
    }
  }
}

// 与 sshManager.buildConfig 保持一致（避免循环依赖，此处复制一份）
function buildClientConfig(
  conn: SSHConnection
): Parameters<Client['connect']>[0] {
  const cfg: Parameters<Client['connect']>[0] = {
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
