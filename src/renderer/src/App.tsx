import { useCallback, useEffect, useState } from 'react'
import type { SSHConnection, ConnectionGroup } from '../../shared/types'
import { api } from './api'
import Sidebar from './components/Sidebar'
import HostTable from './components/HostTable'
import HostEditModal from './components/HostEditModal'
import PromptModal from './components/PromptModal'
import TerminalView, { TermSession } from './components/TerminalView'
import ThemePanel from './components/ThemePanel'

export type GroupFilter = 'all' | 'favorite' | 'recent' | string

export default function App(): JSX.Element {
  const [connections, setConnections] = useState<SSHConnection[]>([])
  const [groups, setGroups] = useState<ConnectionGroup[]>([])
  const [filter, setFilter] = useState<GroupFilter>('all')
  const [editing, setEditing] = useState<SSHConnection | 'new' | null>(null)
  const [sessions, setSessions] = useState<TermSession[]>([])
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'terminal'>('list')
  const [showGroupPrompt, setShowGroupPrompt] = useState(false)
  const [showThemePanel, setShowThemePanel] = useState(false)

  const reload = useCallback(async () => {
    const [conns, grps] = await Promise.all([
      api.connections.list(),
      api.groups.list()
    ])
    setConnections(conns)
    setGroups(grps)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const off = api.ssh.onConnectionsChanged(() => {
      reload()
    })
    return off
  }, [reload])

  useEffect(() => {
    document.documentElement.dataset.platform = api.platform
  }, [])

  // ---------- 连接管理 ----------
  const handleSave = async (
    data: Omit<SSHConnection, 'id' | 'createdAt'>,
    id?: string
  ): Promise<void> => {
    if (id) {
      await api.connections.update(id, data)
    } else {
      await api.connections.create(data)
    }
    setEditing(null)
    reload()
  }

  const handleRemove = async (conn: SSHConnection): Promise<void> => {
    if (!window.confirm(`确定删除连接「${conn.name}」吗？`)) return
    await api.connections.remove(conn.id)
    reload()
  }

  const handleToggleFav = async (conn: SSHConnection): Promise<void> => {
    await api.connections.update(conn.id, { favorite: !conn.favorite })
    reload()
  }

  // ---------- 分组 ----------
  const handleCreateGroup = async (name: string): Promise<void> => {
    setShowGroupPrompt(false)
    await api.groups.create(name)
    reload()
  }

  const handleRemoveGroup = async (id: string): Promise<void> => {
    const g = groups.find((x) => x.id === id)
    if (!window.confirm(`确定删除分组「${g?.name}」吗？组内连接会移到未分组。`))
      return
    await api.groups.remove(id)
    if (filter === id) setFilter('all')
    reload()
  }

  // ---------- 打开终端 ----------
  const handleConnect = (conn: SSHConnection): void => {
    const key = `${conn.id}-${Date.now()}`
    const session: TermSession = {
      key,
      connectionId: conn.id,
      name: conn.name || conn.host,
      status: 'connecting'
    }
    setSessions((prev) => [...prev, session])
    setActiveSession(key)
    setView('terminal')
    reload() // 刷新最近连接时间
  }

  const handleSessionState = (key: string, status: TermSession['status']): void => {
    setSessions((prev) =>
      prev.map((s) => (s.key === key ? { ...s, status } : s))
    )
  }

  const handleCloseSession = (key: string): void => {
    const next = sessions.filter((s) => s.key !== key)
    setSessions(next)
    if (activeSession === key) {
      const fallback = next.length > 0 ? next[next.length - 1].key : null
      setActiveSession(fallback)
      if (fallback === null) setView('list')
    }
  }

  const handleDuplicateSession = (): void => {
    const src = sessions.find((s) => s.key === activeSession)
    if (!src) return
    const key = `${src.connectionId}-${Date.now()}`
    const session: TermSession = {
      key,
      connectionId: src.connectionId,
      name: src.name,
      status: 'connecting'
    }
    setSessions((prev) => [...prev, session])
    setActiveSession(key)
    setView('terminal')
    void reload()
  }

  const gotoSession = (key: string): void => {
    setActiveSession(key)
    setView('terminal')
  }

  // ---------- 过滤 ----------
  const filtered = connections.filter((c) => {
    if (filter === 'all') return true
    if (filter === 'favorite') return c.favorite
    if (filter === 'recent') return !!c.lastConnectedAt
    return c.groupId === filter
  })
  const sorted =
    filter === 'recent'
      ? [...filtered].sort(
          (a, b) => (b.lastConnectedAt ?? 0) - (a.lastConnectedAt ?? 0)
        )
      : filtered

  return (
    <div className="app">
      <div
        className="topbar"
        style={{ display: view === 'list' ? 'flex' : 'none' }}
      >
        <span className="tab">SSH</span>
        {sessions.map((s) => (
          <span
            key={s.key}
            className="tab session-tab"
            onClick={() => gotoSession(s.key)}
          >
            <span
              className={`dot ${s.status === 'connected' ? '' : 'closed'}`}
            />
            {s.name}
            <button
              className="close"
              onClick={(e) => {
                e.stopPropagation()
                handleCloseSession(s.key)
              }}
            >
              ×
            </button>
          </span>
        ))}
        <div className="spacer" />
        <div className="theme-entry">
          <button
            className="icon-btn"
            title="主题"
            onClick={() => setShowThemePanel((v) => !v)}
          >
            ⚙
          </button>
          {showThemePanel && (
            <ThemePanel onClose={() => setShowThemePanel(false)} />
          )}
        </div>
      </div>
      <div
        className="main"
        style={{ display: view === 'list' ? 'flex' : 'none' }}
      >
        <Sidebar
          groups={groups}
          connections={connections}
          filter={filter}
          onSelect={setFilter}
          onCreateGroup={() => setShowGroupPrompt(true)}
          onRemoveGroup={handleRemoveGroup}
          onNewConnection={() => setEditing('new')}
        />
        <div className="content">
          <div className="content-header">
            <span className="title">
              {filter === 'all'
                ? '全部'
                : filter === 'favorite'
                  ? '收藏'
                  : filter === 'recent'
                    ? '最近'
                    : groups.find((g) => g.id === filter)?.name || '未分组'}
            </span>
            <span style={{ color: 'var(--text-dim)' }}>
              共 {sorted.length} 个连接
            </span>
          </div>
          <HostTable
            connections={sorted}
            onConnect={handleConnect}
            onEdit={(c) => setEditing(c)}
            onRemove={handleRemove}
            onToggleFav={handleToggleFav}
            onRefresh={reload}
          />
        </div>
      </div>
      {sessions.length > 0 && (
        <div
          className="terminal-wrapper"
          style={{ display: view === 'terminal' ? 'flex' : 'none' }}
        >
          <TerminalView
            sessions={sessions}
            activeKey={activeSession}
            onSwitch={setActiveSession}
            onClose={handleCloseSession}
            onBack={() => setView('list')}
            onStateChange={handleSessionState}
            onDuplicate={handleDuplicateSession}
          />
        </div>
      )}
      {editing !== null && (
        <HostEditModal
          connection={editing === 'new' ? null : editing}
          groups={groups}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
      {showGroupPrompt && (
        <PromptModal
          title="新建分组"
          placeholder="分组名称"
          onOk={handleCreateGroup}
          onCancel={() => setShowGroupPrompt(false)}
        />
      )}
    </div>
  )
}
