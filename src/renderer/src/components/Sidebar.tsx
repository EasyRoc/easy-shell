import type { SSHConnection, ConnectionGroup } from '../../../shared/types'
import type { GroupFilter } from '../App'

interface Props {
  groups: ConnectionGroup[]
  connections: SSHConnection[]
  filter: GroupFilter
  onSelect: (f: GroupFilter) => void
  onCreateGroup: () => void
  onRemoveGroup: (id: string) => void
  onNewConnection: () => void
}

export default function Sidebar(props: Props): JSX.Element {
  const { groups, connections, filter, onSelect } = props
  const favCount = connections.filter((c) => c.favorite).length
  const recentCount = connections.filter((c) => c.lastConnectedAt).length
  const countOf = (gid: string): number =>
    connections.filter((c) => c.groupId === gid).length

  return (
    <div className="sidebar">
      <div className="sidebar-actions">
        <button className="btn" onClick={props.onCreateGroup}>
          + 分组
        </button>
        <button className="btn primary" onClick={props.onNewConnection}>
          + SSH
        </button>
      </div>
      <div className="group-tree">
        <div
          className={`group-item ${filter === 'all' ? 'active' : ''}`}
          onClick={() => onSelect('all')}
        >
          <span className="name">全部</span>
          <span className="count">{connections.length}</span>
        </div>
        <div
          className={`group-item ${filter === 'favorite' ? 'active' : ''}`}
          onClick={() => onSelect('favorite')}
        >
          <span className="name">收藏</span>
          <span className="count">{favCount}</span>
        </div>
        <div
          className={`group-item ${filter === 'recent' ? 'active' : ''}`}
          onClick={() => onSelect('recent')}
        >
          <span className="name">最近</span>
          <span className="count">{recentCount}</span>
        </div>

        {groups.map((g) => (
          <div key={g.id}>
            <div
              className={`group-item ${filter === g.id ? 'active' : ''}`}
              onClick={() => onSelect(g.id)}
            >
              <span className="name">📁 {g.name}</span>
              <span className="count">{countOf(g.id)}</span>
              <button
                className="del"
                title="删除分组"
                onClick={(e) => {
                  e.stopPropagation()
                  props.onRemoveGroup(g.id)
                }}
              >
                ×
              </button>
            </div>
            {filter === g.id && (
              <div className="group-children">
                {connections
                  .filter((c) => c.groupId === g.id)
                  .map((c) => (
                    <div key={c.id} className="host-leaf">
                      {c.name || c.host}
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
