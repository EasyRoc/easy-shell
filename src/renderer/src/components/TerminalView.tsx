import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { api } from '../api'
import { getCurrentTheme, useTheme } from '../theme'
import FilePanel from './FilePanel'

export interface TermSession {
  key: string
  connectionId: string
  name: string
  status: 'connecting' | 'connected' | 'closed' | 'error'
}

interface Props {
  sessions: TermSession[]
  activeKey: string | null
  onSwitch: (key: string) => void
  onClose: (key: string) => void
  onBack: () => void
  onStateChange: (key: string, status: TermSession['status']) => void
}

export default function TerminalView(props: Props): JSX.Element {
  const [sessionIds, setSessionIds] = useState<Record<string, string>>({})
  const [showFiles, setShowFiles] = useState(false)

  const activeSshId = props.activeKey ? sessionIds[props.activeKey] : null

  return (
    <div className="terminal-page">
      <div className="term-tabs">
        <button className="back-btn" onClick={props.onBack}>
          ← SSH
        </button>
        {props.sessions.map((s) => (
          <div
            key={s.key}
            className={`term-tab ${props.activeKey === s.key ? 'active' : ''}`}
            onClick={() => props.onSwitch(s.key)}
          >
            <span
              className={`dot ${s.status === 'connected' ? '' : 'closed'}`}
            />
            <span>{s.name}</span>
            <button
              className="close"
              onClick={(e) => {
                e.stopPropagation()
                props.onClose(s.key)
              }}
            >
              ×
            </button>
          </div>
        ))}
        <div className="spacer" />
        {activeSshId && (
          <button
            className={`back-btn ${showFiles ? 'active' : ''}`}
            onClick={() => setShowFiles((v) => !v)}
          >
            文件
          </button>
        )}
      </div>
      <div className="term-main">
        <div className="term-bodies">
          {props.sessions.map((s) => (
            <TermBody
              key={s.key}
              session={s}
              active={props.activeKey === s.key}
              onStateChange={props.onStateChange}
              onSessionId={(key, id) =>
                setSessionIds((prev) => ({ ...prev, [key]: id }))
              }
            />
          ))}
        </div>
        {showFiles && activeSshId && (
          <FilePanel
            servers={props.sessions
              .filter((s) => sessionIds[s.key])
              .map((s) => ({ sessionId: sessionIds[s.key], name: s.name }))}
            defaultSessionId={activeSshId}
            onClose={() => setShowFiles(false)}
          />
        )}
      </div>
    </div>
  )
}

function TermBody(props: {
  session: TermSession
  active: boolean
  onStateChange: (key: string, status: TermSession['status']) => void
  onSessionId: (key: string, sessionId: string) => void
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const { session, onStateChange } = props

  // 初始化终端 + 建立 SSH 连接（每个会话一次）
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', Menlo, Monaco, 'Courier New', monospace",
      theme: { ...getCurrentTheme().term }
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(el)
    fit.fit()
    termRef.current = term
    fitRef.current = fit

    term.writeln(`\x1b[32m正在连接 ${session.name} ...\x1b[0m`)

    let offOutput: (() => void) | null = null
    let offClosed: (() => void) | null = null
    let disposed = false

    const { cols, rows } = term
    api.ssh
      .connect(session.connectionId, cols, rows)
      .then(({ sessionId }) => {
        if (disposed) {
          api.ssh.disconnect(sessionId)
          return
        }
        sessionIdRef.current = sessionId
        props.onSessionId(session.key, sessionId)
        onStateChange(session.key, 'connected')
        term.focus()

        offOutput = api.ssh.onOutput(sessionId, (data) => term.write(data))
        offClosed = api.ssh.onClosed(sessionId, () => {
          term.writeln('\r\n\x1b[31m[连接已断开]\x1b[0m')
          onStateChange(session.key, 'closed')
        })
      })
      .catch((err: Error) => {
        term.writeln(`\r\n\x1b[31m连接失败：${err.message}\x1b[0m`)
        onStateChange(session.key, 'error')
      })

    const sub = term.onData((data) => {
      if (sessionIdRef.current) api.ssh.input(sessionIdRef.current, data)
    })

    const observer = new ResizeObserver(() => {
      try {
        fit.fit()
        if (sessionIdRef.current) {
          api.ssh.resize(sessionIdRef.current, term.cols, term.rows)
        }
      } catch {
        /* ignore */
      }
    })
    observer.observe(el)

    return () => {
      disposed = true
      observer.disconnect()
      sub.dispose()
      offOutput?.()
      offClosed?.()
      if (sessionIdRef.current) api.ssh.disconnect(sessionIdRef.current)
      term.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.key])

  // 切换标签时重新适配尺寸
  useEffect(() => {
    if (props.active && fitRef.current && termRef.current) {
      setTimeout(() => {
        try {
          fitRef.current?.fit()
          termRef.current?.focus()
          if (sessionIdRef.current && termRef.current) {
            api.ssh.resize(
              sessionIdRef.current,
              termRef.current.cols,
              termRef.current.rows
            )
          }
        } catch {
          /* ignore */
        }
      }, 0)
    }
  }, [props.active])

  // 主题切换时实时更新终端配色
  const theme = useTheme()
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = { ...theme.term }
    }
  }, [theme])

  return (
    <div
      ref={containerRef}
      className={`term-body ${props.active ? 'active' : ''}`}
    />
  )
}
