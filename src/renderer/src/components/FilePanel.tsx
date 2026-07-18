import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { SftpFileEntry, SftpProgress } from '../../../shared/types'

interface Props {
  sessionId: string
  onClose: () => void
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} K`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} M`
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} G`
}

function formatTime(sec: number): string {
  const d = new Date(sec * 1000)
  const pad = (x: number): string => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function joinPath(dir: string, name: string): string {
  if (dir === '.') return `./${name}`
  return dir.endsWith('/') ? dir + name : `${dir}/${name}`
}

const QUICK_DIRS = [
  { label: '家目录', path: '.' },
  { label: '根目录', path: '/' },
  { label: '/etc', path: '/etc' },
  { label: '/opt', path: '/opt' },
  { label: '/tmp', path: '/tmp' },
  { label: '/var/log', path: '/var/log' },
  { label: '/usr/local', path: '/usr/local' }
]

export default function FilePanel({
  sessionId,
  onClose
}: Props): JSX.Element {
  const [path, setPath] = useState('.')
  const [entries, setEntries] = useState<SftpFileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<SftpProgress | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [creating, setCreating] = useState(false)
  const [createValue, setCreateValue] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [pathInput, setPathInput] = useState('.')
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(
    async (dir: string) => {
      setLoading(true)
      setError(null)
      try {
        const list = await api.sftp.list(sessionId, dir)
        list.sort((a, b) =>
          a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1
        )
        setEntries(list)
        setPath(dir)
        setPathInput(dir === '.' ? '.' : dir)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    },
    [sessionId]
  )

  useEffect(() => {
    api.sftp
      .open(sessionId)
      .then(() => refresh('.'))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    const off = api.sftp.onProgress(sessionId, (p) => setProgress(p))
    return () => {
      off()
      api.sftp.close(sessionId)
    }
  }, [sessionId, refresh])

  useEffect(() => {
    if (progress?.done && !progress.error) refresh(path)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress?.done])

  const handleUpload = async (localPaths: string[]): Promise<void> => {
    if (localPaths.length === 0) return
    setError(null)
    try {
      await api.sftp.upload(sessionId, localPaths, path)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleDownload = async (entry: SftpFileEntry): Promise<void> => {
    setError(null)
    try {
      await api.sftp.download(sessionId, joinPath(path, entry.name), entry.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleRemove = async (entry: SftpFileEntry): Promise<void> => {
    const kind = entry.isDir ? '文件夹' : '文件'
    if (!window.confirm(`确定删除${kind}「${entry.name}」吗？`)) return
    setError(null)
    try {
      await api.sftp.remove(sessionId, joinPath(path, entry.name), entry.isDir)
      refresh(path)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const submitRename = async (oldName: string): Promise<void> => {
    const newName = renameValue.trim()
    setRenaming(null)
    if (!newName || newName === oldName) return
    setError(null)
    try {
      await api.sftp.rename(
        sessionId,
        joinPath(path, oldName),
        joinPath(path, newName)
      )
      refresh(path)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const submitCreate = async (): Promise<void> => {
    const name = createValue.trim()
    setCreating(false)
    setCreateValue('')
    if (!name) return
    setError(null)
    try {
      await api.sftp.mkdir(sessionId, joinPath(path, name))
      refresh(path)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const crumbs = path.split('/').filter((p) => p !== '')

  return (
    <div
      className={`file-panel ${dragOver ? 'drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const paths = Array.from(e.dataTransfer.files)
          .map((f) => (f as File & { path?: string }).path || f.name)
          .filter(Boolean)
        handleUpload(paths)
      }}
    >
      <div className="fp-nav">
        <select
          className="fp-quick-dir"
          value=""
          onChange={(e) => {
            if (e.target.value) {
              refresh(e.target.value)
              setPathInput(e.target.value)
            }
          }}
        >
          <option value="" disabled>
            快捷目录 ▾
          </option>
          {QUICK_DIRS.map((d) => (
            <option key={d.path} value={d.path}>
              {d.label}
            </option>
          ))}
        </select>
        <form
          className="fp-path-form"
          onSubmit={(e) => {
            e.preventDefault()
            refresh(pathInput.trim() || '.')
          }}
        >
          <input
            className="fp-path-input"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            placeholder="输入路径，回车跳转"
          />
        </form>
        <div className="fp-crumbs">
          <span className="crumb" onClick={() => { refresh('.'); setPathInput('.') }}>
            家目录
          </span>
          {crumbs.map((c, i) =>
            c === '.' ? null : (
              <span key={i}>
                <span className="sep">/</span>
                <span
                  className="crumb"
                  onClick={() => {
                    const p = crumbs.slice(0, i + 1).join('/')
                    refresh(p)
                    setPathInput(p)
                  }}
                >
                  {c}
                </span>
              </span>
            )
          )}
        </div>
        <button className="fp-btn" title="刷新" onClick={() => refresh(path)}>
          ⟳
        </button>
        <button
          className="fp-btn"
          title="新建文件夹"
          onClick={() => setCreating(true)}
        >
          ＋
        </button>
        <button
          className="fp-btn"
          title="上传"
          onClick={() => uploadInputRef.current?.click()}
        >
          ↑
        </button>
        <button className="fp-btn" title="关闭面板" onClick={onClose}>
          ×
        </button>
        <input
          ref={uploadInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const paths = Array.from(e.target.files ?? [])
              .map((f) => (f as File & { path?: string }).path || f.name)
              .filter(Boolean)
            handleUpload(paths)
            e.target.value = ''
          }}
        />
      </div>

      {error && <div className="fp-error">{error}</div>}

      <div className="fp-list">
        {creating && (
          <div className="fp-row">
            <span className="fp-icon">📁</span>
            <input
              className="fp-rename-input"
              autoFocus
              placeholder="文件夹名称"
              value={createValue}
              onChange={(e) => setCreateValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCreate()
                if (e.key === 'Escape') setCreating(false)
              }}
              onBlur={submitCreate}
            />
          </div>
        )}
        {entries.map((entry) => (
          <div
            key={entry.name}
            className="fp-row"
            onDoubleClick={() => {
              if (entry.isDir) refresh(joinPath(path, entry.name))
              else handleDownload(entry)
            }}
          >
            <span className="fp-icon">{entry.isDir ? '📁' : '📄'}</span>
            {renaming === entry.name ? (
              <input
                className="fp-rename-input"
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRename(entry.name)
                  if (e.key === 'Escape') setRenaming(null)
                }}
                onBlur={() => submitRename(entry.name)}
              />
            ) : (
              <span className="fp-name" title={entry.name}>
                {entry.name}
              </span>
            )}
            <span className="fp-size">
              {entry.isDir ? '' : formatSize(entry.size)}
            </span>
            <span className="fp-time">{formatTime(entry.mtime)}</span>
            <span className="fp-actions">
              {!entry.isDir && (
                <button
                  className="fp-op"
                  title="下载"
                  onClick={() => handleDownload(entry)}
                >
                  ↓
                </button>
              )}
              <button
                className="fp-op"
                title="重命名"
                onClick={() => {
                  setRenaming(entry.name)
                  setRenameValue(entry.name)
                }}
              >
                ✎
              </button>
              <button
                className="fp-op danger"
                title="删除"
                onClick={() => handleRemove(entry)}
              >
                🗑
              </button>
            </span>
          </div>
        ))}
        {!loading && entries.length === 0 && !creating && (
          <div className="fp-empty">空目录</div>
        )}
        {loading && <div className="fp-empty">加载中...</div>}
      </div>

      {progress && !progress.done && (
        <div className="fp-progress">
          <span className="fp-progress-file" title={progress.file}>
            {progress.file}
          </span>
          <div className="fp-progress-bar">
            <div
              className="fp-progress-inner"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <span className="fp-progress-pct">{progress.percent}%</span>
          <button
            className="fp-op danger"
            title="取消传输"
            onClick={() => api.sftp.cancel(sessionId)}
          >
            ×
          </button>
        </div>
      )}
      {progress?.done && progress.error && (
        <div className="fp-error">传输失败：{progress.error}</div>
      )}
    </div>
  )
}
