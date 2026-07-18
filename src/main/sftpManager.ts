import { Client, SFTPWrapper } from 'ssh2'
import path from 'path'
import type { SftpFileEntry, SftpProgress } from '../shared/types'

interface SftpChannel {
  sftp: SFTPWrapper
  cancelled: boolean
}

const channels = new Map<string, SftpChannel>()

// 进度推送回调由 ipc 层注入
let progressSink: (sessionId: string, p: SftpProgress) => void = () => {}

export function setProgressSink(
  fn: (sessionId: string, p: SftpProgress) => void
): void {
  progressSink = fn
}

// 幂等：已存在的通道先关闭再开
export function open(sessionId: string, client: Client): Promise<void> {
  close(sessionId)
  return new Promise((resolve, reject) => {
    client.sftp((err, sftp) => {
      if (err) return reject(new Error('打开文件通道失败: ' + err.message))
      channels.set(sessionId, { sftp, cancelled: false })
      sftp.on('close', () => channels.delete(sessionId))
      resolve()
    })
  })
}

export function close(sessionId: string): void {
  const ch = channels.get(sessionId)
  if (ch) {
    try {
      ch.sftp.end()
    } catch {
      /* ignore */
    }
    channels.delete(sessionId)
  }
}

function get(sessionId: string): SftpChannel {
  const ch = channels.get(sessionId)
  if (!ch) throw new Error('文件通道未打开')
  return ch
}

export function list(sessionId: string, dir: string): Promise<SftpFileEntry[]> {
  return new Promise((resolve, reject) => {
    get(sessionId).sftp.readdir(dir, (err, entries) => {
      if (err) return reject(new Error(err.message))
      resolve(
        entries.map((f) => ({
          name: f.filename,
          isDir: f.attrs.isDirectory(),
          size: f.attrs.size,
          mtime: f.attrs.mtime
        }))
      )
    })
  })
}

export function mkdir(sessionId: string, dir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    get(sessionId).sftp.mkdir(dir, (err) =>
      err ? reject(new Error(err.message)) : resolve()
    )
  })
}

export function remove(
  sessionId: string,
  target: string,
  isDir: boolean
): Promise<void> {
  return new Promise((resolve, reject) => {
    const sftp = get(sessionId).sftp
    const cb = (err?: Error | null): void =>
      err ? reject(new Error(err.message)) : resolve()
    if (isDir) sftp.rmdir(target, cb)
    else sftp.unlink(target, cb)
  })
}

export function rename(
  sessionId: string,
  oldPath: string,
  newPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    get(sessionId).sftp.rename(oldPath, newPath, (err) =>
      err ? reject(new Error(err.message)) : resolve()
    )
  })
}

function joinRemote(dir: string, name: string): string {
  return dir.endsWith('/') ? dir + name : dir + '/' + name
}

export async function upload(
  sessionId: string,
  localPaths: string[],
  remoteDir: string
): Promise<void> {
  const ch = get(sessionId)
  ch.cancelled = false
  for (const localPath of localPaths) {
    if (ch.cancelled) return
    const name = path.basename(localPath)
    const remotePath = joinRemote(remoteDir, name)
    await new Promise<void>((resolve, reject) => {
      ch.sftp.fastPut(
        localPath,
        remotePath,
        {
          step: (transferred: number, _chunk: number, total: number) => {
            progressSink(sessionId, {
              file: name,
              percent: total > 0 ? Math.round((transferred / total) * 100) : 0,
              done: false
            })
          }
        },
        (err) => {
          if (err) {
            progressSink(sessionId, {
              file: name,
              percent: 0,
              done: true,
              error: err.message
            })
            return reject(new Error(`上传 ${name} 失败: ${err.message}`))
          }
          progressSink(sessionId, { file: name, percent: 100, done: true })
          resolve()
        }
      )
    })
  }
}

export function download(
  sessionId: string,
  remotePath: string,
  localPath: string
): Promise<void> {
  const ch = get(sessionId)
  ch.cancelled = false
  const name = remotePath.split('/').pop() || remotePath
  return new Promise((resolve, reject) => {
    ch.sftp.fastGet(
      remotePath,
      localPath,
      {
        step: (transferred: number, _chunk: number, total: number) => {
          progressSink(sessionId, {
            file: name,
            percent: total > 0 ? Math.round((transferred / total) * 100) : 0,
            done: false
          })
        }
      },
      (err) => {
        if (err) {
          progressSink(sessionId, {
            file: name,
            percent: 0,
            done: true,
            error: err.message
          })
          return reject(new Error(`下载 ${name} 失败: ${err.message}`))
        }
        progressSink(sessionId, { file: name, percent: 100, done: true })
        resolve()
      }
    )
  })
}

// 取消：标记并销毁通道以中断当前传输；渲染端后续操作前需重新 open
export function cancel(sessionId: string): void {
  const ch = channels.get(sessionId)
  if (ch) {
    ch.cancelled = true
    try {
      ch.sftp.end()
    } catch {
      /* ignore */
    }
    channels.delete(sessionId)
  }
}
