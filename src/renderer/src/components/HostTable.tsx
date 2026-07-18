import { useState } from 'react'
import type { SSHConnection } from '../../../shared/types'
import { api } from '../api'

interface Props {
  connections: SSHConnection[]
  onConnect: (c: SSHConnection) => void
  onEdit: (c: SSHConnection) => void
  onRemove: (c: SSHConnection) => void
  onToggleFav: (c: SSHConnection) => void
}

type LatencyState = Record<string, { ms?: number; fail?: boolean }>

export default function HostTable(props: Props): JSX.Element {
  const [latency, setLatency] = useState<LatencyState>({})
  const [testing, setTesting] = useState<Record<string, boolean>>({})

  const testOne = async (c: SSHConnection): Promise<void> => {
    setTesting((p) => ({ ...p, [c.id]: true }))
    const r = await api.ssh.test(c)
    setLatency((p) => ({
      ...p,
      [c.id]: r.ok ? { ms: r.latency } : { fail: true }
    }))
    setTesting((p) => ({ ...p, [c.id]: false }))
  }

  const copyAddr = (c: SSHConnection): void => {
    navigator.clipboard.writeText(`${c.username}@${c.host}:${c.port}`)
  }

  if (props.connections.length === 0) {
    return <div className="empty">暂无连接，点击左上角「+ SSH」新建一个吧</div>
  }

  return (
    <div className="host-table">
      <table>
        <thead>
          <tr>
            <th style={{ width: 40 }}></th>
            <th style={{ width: 110 }}>延迟</th>
            <th>名称</th>
            <th>地址</th>
            <th style={{ width: 220 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {props.connections.map((c) => {
            const l = latency[c.id]
            return (
              <tr key={c.id} onDoubleClick={() => props.onConnect(c)}>
                <td>
                  <button
                    className={`star ${c.favorite ? 'on' : ''}`}
                    title="收藏"
                    onClick={() => props.onToggleFav(c)}
                  >
                    {c.favorite ? '★' : '☆'}
                  </button>
                </td>
                <td>
                  {testing[c.id] ? (
                    <span className="latency testing">测试中…</span>
                  ) : l?.fail ? (
                    <span className="latency fail">失败</span>
                  ) : l?.ms !== undefined ? (
                    <span className="latency">● {l.ms} ms</span>
                  ) : (
                    <button className="link" onClick={() => testOne(c)}>
                      测延迟
                    </button>
                  )}
                </td>
                <td>
                  <div className="host-name">{c.name || c.host}</div>
                  {c.remark && (
                    <div style={{ fontSize: 12, color: '#636366' }}>
                      {c.remark}
                    </div>
                  )}
                </td>
                <td>
                  <span
                    className="host-addr"
                    title="点击复制"
                    style={{ cursor: 'pointer' }}
                    onClick={() => copyAddr(c)}
                  >
                    {c.host}:{c.port}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="btn primary"
                      onClick={() => props.onConnect(c)}
                    >
                      连接
                    </button>
                    <button className="link" onClick={() => props.onEdit(c)}>
                      编辑
                    </button>
                    <button className="link" onClick={() => props.onRemove(c)}>
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
