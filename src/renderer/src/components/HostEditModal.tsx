import { useState } from 'react'
import type {
  SSHConnection,
  ConnectionGroup,
  AuthType
} from '../../../shared/types'
import { api } from '../api'

interface Props {
  connection: SSHConnection | null // null 表示新建
  groups: ConnectionGroup[]
  onClose: () => void
  onSave: (data: Omit<SSHConnection, 'id' | 'createdAt'>, id?: string) => void
}

type TabKey = 'basic' | 'advanced'

export default function HostEditModal(props: Props): JSX.Element {
  const c = props.connection
  const [tab, setTab] = useState<TabKey>('basic')
  const [name, setName] = useState(c?.name ?? '')
  const [groupId, setGroupId] = useState(c?.groupId ?? '')
  const [host, setHost] = useState(c?.host ?? '')
  const [port, setPort] = useState(String(c?.port ?? 22))
  const [authType, setAuthType] = useState<AuthType>(c?.authType ?? 'password')
  const [username, setUsername] = useState(c?.username ?? 'root')
  const [password, setPassword] = useState(c?.password ?? '')
  const [privateKeyPath, setPrivateKeyPath] = useState(c?.privateKeyPath ?? '')
  const [passphrase, setPassphrase] = useState(c?.passphrase ?? '')
  const [showPassphrase, setShowPassphrase] = useState(false)
  const [remark, setRemark] = useState(c?.remark ?? '')
  const [timeout, setTimeout_] = useState(String(c?.timeout ?? 10000))
  const [heartbeat, setHeartbeat] = useState(String(c?.heartbeat ?? 5000))
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  )

  const buildData = (): Omit<SSHConnection, 'id' | 'createdAt'> => ({
    name: name.trim(),
    groupId: groupId || null,
    host: host.trim(),
    port: parseInt(port, 10) || 22,
    authType,
    username: username.trim(),
    password: authType === 'password' ? password : undefined,
    privateKeyPath: authType === 'privateKey' ? privateKeyPath.trim() : undefined,
    passphrase: authType === 'privateKey' && passphrase ? passphrase : undefined,
    remark: remark.trim() || undefined,
    timeout: parseInt(timeout, 10) || 10000,
    heartbeat: parseInt(heartbeat, 10) || 5000,
    favorite: c?.favorite ?? false,
    lastConnectedAt: c?.lastConnectedAt
  })

  const valid = host.trim().length > 0 && username.trim().length > 0

  const handleTest = async (): Promise<void> => {
    setTesting(true)
    setTestMsg(null)
    const r = await api.ssh.test(buildData())
    setTesting(false)
    setTestMsg(
      r.ok
        ? { ok: true, text: `连接成功，延迟 ${r.latency} ms` }
        : { ok: false, text: `连接失败：${(r.error || '').slice(0, 120)}` }
    )
  }

  const handleSubmit = (): void => {
    if (!valid) return
    props.onSave(buildData(), c?.id)
  }

  const tabs: { key: TabKey; label: string; disabled?: boolean }[] = [
    { key: 'basic', label: '基本信息' },
    { key: 'advanced', label: '连接设置' }
  ]

  return (
    <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="modal">
        <div className="modal-header">
          {c ? '编辑 SSH 连接' : '新建 SSH 连接'}
          <button className="modal-close" onClick={props.onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-tabs">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`modal-tab ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
            <button className="modal-tab disabled" title="后续版本支持">
              跳板机
            </button>
            <button className="modal-tab disabled" title="后续版本支持">
              代理设置
            </button>
            <button className="modal-tab disabled" title="后续版本支持">
              初始化
            </button>
          </div>
          <div className="modal-form">
            {tab === 'basic' && (
              <div className="form-stack">
                <section className="form-section">
                  <h3 className="form-section-title">连接</h3>
                  <div className="form-grid">
                    <label className="form-field">
                      <span className="form-field-label">名称</span>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="我的服务器"
                      />
                    </label>
                    <label className="form-field">
                      <span className="form-field-label">分组</span>
                      <select
                        value={groupId}
                        onChange={(e) => setGroupId(e.target.value)}
                      >
                        <option value="">未分组</option>
                        {props.groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field form-field-wide">
                      <span className="form-field-label">地址</span>
                      <div className="input-group">
                        <input
                          value={host}
                          onChange={(e) => setHost(e.target.value)}
                          placeholder="192.168.1.1 或 example.com"
                        />
                        <input
                          className="input-port"
                          value={port}
                          onChange={(e) => setPort(e.target.value)}
                          placeholder="22"
                          inputMode="numeric"
                        />
                      </div>
                      <span className="form-field-hint">目标 SSH 主机地址与端口</span>
                    </label>
                  </div>
                </section>

                <section className="form-section">
                  <h3 className="form-section-title">认证</h3>
                  <div className="form-grid">
                    <label className="form-field">
                      <span className="form-field-label">验证方式</span>
                      <select
                        value={authType}
                        onChange={(e) => setAuthType(e.target.value as AuthType)}
                      >
                        <option value="password">密码</option>
                        <option value="privateKey">私钥</option>
                      </select>
                    </label>
                    <label className="form-field">
                      <span className="form-field-label">登录用户</span>
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="root"
                      />
                    </label>
                    {authType === 'password' ? (
                      <label className="form-field form-field-wide">
                        <span className="form-field-label">登录密码</span>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="登录密码"
                        />
                        <span className="form-field-hint">
                          使用用户名和密码完成 SSH 认证
                        </span>
                      </label>
                    ) : (
                      <>
                        <label className="form-field form-field-wide">
                          <span className="form-field-label">私钥</span>
                          <textarea
                            className="private-key-input"
                            value={privateKeyPath}
                            onChange={(e) => setPrivateKeyPath(e.target.value)}
                            placeholder="~/.ssh/id_rsa 或粘贴私钥内容"
                            rows={privateKeyPath.includes('\n') ? 6 : 3}
                          />
                          <span className="form-field-hint">
                            支持文件路径，或直接粘贴 PEM 私钥内容
                          </span>
                        </label>
                        <label className="form-field form-field-wide">
                          <span className="form-field-label">私钥口令</span>
                          <div className="input-password-wrap">
                            <input
                              type={showPassphrase ? 'text' : 'password'}
                              value={passphrase}
                              onChange={(e) => setPassphrase(e.target.value)}
                              placeholder="私钥有密码时填写，可留空"
                            />
                            <button
                              type="button"
                              className="input-visibility-btn"
                              title={showPassphrase ? '隐藏口令' : '显示口令'}
                              aria-label={showPassphrase ? '隐藏口令' : '显示口令'}
                              onClick={() => setShowPassphrase((v) => !v)}
                            >
                              {showPassphrase ? '隐藏' : '显示'}
                            </button>
                          </div>
                        </label>
                      </>
                    )}
                  </div>
                </section>

                <section className="form-section">
                  <h3 className="form-section-title">备注</h3>
                  <label className="form-field form-field-wide">
                    <span className="form-field-label">主机备注</span>
                    <textarea
                      className="remark-input"
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      placeholder="可选，记录用途、环境等信息"
                      rows={3}
                    />
                  </label>
                </section>
              </div>
            )}

            {tab === 'advanced' && (
              <div className="form-stack">
                <section className="form-section">
                  <h3 className="form-section-title">连接参数</h3>
                  <div className="form-grid">
                    <label className="form-field">
                      <span className="form-field-label">超时时间</span>
                      <div className="input-with-unit">
                        <input
                          value={timeout}
                          onChange={(e) => setTimeout_(e.target.value)}
                          inputMode="numeric"
                        />
                        <span className="input-unit">毫秒</span>
                      </div>
                    </label>
                    <label className="form-field">
                      <span className="form-field-label">心跳间隔</span>
                      <div className="input-with-unit">
                        <input
                          value={heartbeat}
                          onChange={(e) => setHeartbeat(e.target.value)}
                          inputMode="numeric"
                        />
                        <span className="input-unit">毫秒</span>
                      </div>
                    </label>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={handleTest} disabled={!valid || testing}>
            {testing ? '测试中…' : '测试连接'}
          </button>
          {testMsg && (
            <span className={`test-result ${testMsg.ok ? 'ok' : 'fail'}`}>
              {testMsg.text}
            </span>
          )}
          <div className="spacer" />
          <button className="btn" onClick={props.onClose}>
            取 消
          </button>
          <button
            className="btn primary"
            onClick={handleSubmit}
            disabled={!valid}
          >
            {c ? '保 存' : '创 建'}
          </button>
        </div>
      </div>
    </div>
  )
}
