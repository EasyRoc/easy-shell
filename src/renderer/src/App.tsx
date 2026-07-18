import { useCallback, useEffect, useState } from 'react'
import type { SSHConnection, ConnectionGroup } from '../../shared/types'
import { api } from './api'
import Sidebar from './components/Sidebar'
import HostTable from './components/HostTable'
import HostEditModal from './components/HostEditModal'
import TerminalView, { TermSession } from './components/TerminalView'

export type GroupFilter = 'all' | 'favorite' | 'recent' | string

export default function App(): JSX.Element {
  const [connections, setConnections] = useState<SSHConnection[]>([])
  const [groups, setGroups] = useState<ConnectionGroup[]>([])
  const [filter, setFilter] = useState<GroupFilter>('all')
  const [editing, setEditing] = useState<SSHConnection | 'new' | null>(null)
  const [sessions, setSessions] = useState<TermSession[]>([])
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'terminal'>('list')

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
  const handleCreateGroup = async (): Promise<void> => {
    const name = window.prompt('分组名称：')
    if (!name?.trim()) return
    await api.groups.create(name.trim())
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
    setSessions((prev) => {
      const next = prev.filter((s) => s.key !== key)
      if (activeSession === key) {
        setActiveSession(next.length > 0 ? next[next.length - 1].key : null)
        if (next.length === 0) setView('list')
      }
      return next
    })
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

  if (view === 'terminal') {
    return (
      <div className="app">
        <TerminalView
          sessions={sessions}
          activeKey={activeSession}
          onSwitch={setActiveSession}
          onClose={handleCloseSession}
          onBack={() => setView('list')}
          onStateChange={handleSessionState}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <div className="topbar">
        <span className="tab">SSH</span>
        <div className="spacer" />
      </div>
      <div className="main">
        <Sidebar
          groups={groups}
          connections={connections}
          filter={filter}
          onSelect={setFilter}
          onCreateGroup={handleCreateGroup}
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
          />
        </div>
      </div>
      {editing !== null && (
        <HostEditModal
          connection={editing === 'new' ? null : editing}
          groups={groups}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
