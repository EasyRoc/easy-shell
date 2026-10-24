import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { api } from '../api'
import { getCurrentTheme, useTheme } from '../theme'
import { getSettings, subscribeSettings } from '../settings'
import FilePanel from './FilePanel'
import TabContextMenu from './TabContextMenu'

export interface TermSession {
  key: string
  connectionId: string
  name: string
  status: 'connecting' | 'connected' | 'closed' | 'error'
}

type SplitDirection = 'horizontal' | 'vertical'
type FocusedPane = 'primary' | 'secondary'

interface SplitLayout {
  direction: SplitDirection
  ratio: number
  primaryKey: string
  secondaryKey: string
  focusedPane: FocusedPane
}

interface Props {
  sessions: TermSession[]
  activeKey: string | null
  onSwitch: (key: string) => void
  onClose: (key: string) => void
  onBack: () => void
  onStateChange: (key: string, status: TermSession['status']) => void
  onReconnect?: (key: string) => void
  onDuplicateKey?: (key: string) => string | null
  onCloseOthers?: (key: string) => void
  onCloseAll?: () => void
}

export default function TerminalView(props: Props): JSX.Element {
  const [sessionIds, setSessionIds] = useState<Record<string, string>>({})
  const [showFiles, setShowFiles] = useState(false)
  const [menu, setMenu] = useState<{ key: string; x: number; y: number } | null>(
    null
  )
  const [splitLayout, setSplitLayout] = useState<SplitLayout | null>(null)
  const splitRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startPos: number; startRatio: number } | null>(null)

  const focusedSessionKey = splitLayout
    ? splitLayout.focusedPane === 'primary'
      ? splitLayout.primaryKey
      : splitLayout.secondaryKey
    : props.activeKey

  const activeSshId = focusedSessionKey ? sessionIds[focusedSessionKey] : null

  // 会话关闭后自动收拢分屏
  useEffect(() => {
    if (!splitLayout) return
    const { primaryKey, secondaryKey } = splitLayout
    const hasPrimary = props.sessions.some((s) => s.key === primaryKey)
    const hasSecondary = props.sessions.some((s) => s.key === secondaryKey)

    if (!hasPrimary && !hasSecondary) {
      setSplitLayout(null)
      return
    }
    if (!hasPrimary) {
      props.onSwitch(secondaryKey)
      setSplitLayout(null)
      return
    }
    if (!hasSecondary) {
      props.onSwitch(primaryKey)
      setSplitLayout(null)
    }
  }, [props.sessions, splitLayout, props.onSwitch])

  const handleTabSwitch = (key: string): void => {
    props.onSwitch(key)
    setSplitLayout((prev) => {
      if (!prev) return prev
      if (key === prev.primaryKey) {
        return { ...prev, focusedPane: 'primary' }
      }
      if (key === prev.secondaryKey) {
        return { ...prev, focusedPane: 'secondary' }
      }
      if (prev.focusedPane === 'primary') {
        return { ...prev, primaryKey: key }
      }
      return { ...prev, secondaryKey: key }
    })
  }

  const startSplit = (
    sourceKey: string,
    direction: SplitDirection
  ): void => {
    const newKey = props.onDuplicateKey?.(sourceKey)
    if (!newKey) return
    setSplitLayout({
      direction,
      ratio: 0.5,
      primaryKey: sourceKey,
      secondaryKey: newKey,
      focusedPane: 'secondary'
    })
    props.onSwitch(newKey)
  }

  const exitSplit = (): void => {
    if (!splitLayout) return
    const keepKey =
      splitLayout.focusedPane === 'primary'
        ? splitLayout.primaryKey
        : splitLayout.secondaryKey
    props.onSwitch(keepKey)
    setSplitLayout(null)
  }

  const onDividerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!splitLayout) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      dragRef.current = {
        startPos: splitLayout.direction === 'horizontal' ? e.clientX : e.clientY,
        startRatio: splitLayout.ratio
      }
    },
    [splitLayout]
  )

  const onDividerPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      const container = splitRef.current
      if (!drag || !container || !splitLayout) return

      const rect = container.getBoundingClientRect()
      const size =
        splitLayout.direction === 'horizontal' ? rect.width : rect.height
      if (size <= 0) return

      const delta =
        (splitLayout.direction === 'horizontal' ? e.clientX : e.clientY) -
        drag.startPos
      const next = drag.startRatio + delta / size
      setSplitLayout((prev) =>
        prev ? { ...prev, ratio: Math.min(0.85, Math.max(0.15, next)) } : prev
      )
    },
    [splitLayout]
  )

  const onDividerPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragRef.current = null
      e.currentTarget.releasePointerCapture(e.pointerId)
    },
    []
  )

  const getSlotLayout = (
    sessionKey: string
  ): 'hidden' | 'full' | 'primary' | 'secondary' => {
    if (!splitLayout) {
      return sessionKey === props.activeKey ? 'full' : 'hidden'
    }
    if (sessionKey === splitLayout.primaryKey) return 'primary'
    if (sessionKey === splitLayout.secondaryKey) return 'secondary'
    return 'hidden'
  }

  const focusPane = (pane: FocusedPane, sessionKey: string): void => {
    props.onSwitch(sessionKey)
    setSplitLayout((prev) => (prev ? { ...prev, focusedPane: pane } : prev))
  }

  const bodiesClass = splitLayout
    ? `term-bodies split-${splitLayout.direction}`
    : 'term-bodies'
  const bodiesStyle = splitLayout
    ? ({ '--split-ratio': `${splitLayout.ratio * 100}%` } as React.CSSProperties)
    : undefined

  return (
    <div className="terminal-page">
      <div className="term-tabs">
        <button className="back-btn" onClick={props.onBack}>
          ← 连接列表
        </button>
        {props.sessions.map((s) => (
          <div
            key={s.key}
            className={`term-tab ${props.activeKey === s.key ? 'active' : ''}`}
            onClick={() => handleTabSwitch(s.key)}
            onContextMenu={(e) => {
              e.preventDefault()
              setMenu({ key: s.key, x: e.clientX, y: e.clientY })
            }}
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
        {props.activeKey && props.onDuplicateKey && (
          <button
            className="back-btn"
            title="复制窗口"
            onClick={() => {
              if (props.activeKey) props.onDuplicateKey?.(props.activeKey)
            }}
          >
            ⧉
          </button>
        )}
        {props.activeKey && props.onDuplicateKey && (
          <>
            <button
              className="back-btn"
              title="向右分屏"
              onClick={() => startSplit(props.activeKey!, 'horizontal')}
            >
              ▥
            </button>
            <button
              className="back-btn"
              title="向下分屏"
              onClick={() => startSplit(props.activeKey!, 'vertical')}
            >
              ▤
            </button>
          </>
        )}
        {splitLayout && (
          <button className="back-btn" title="退出分屏" onClick={exitSplit}>
            ⊟
          </button>
        )}
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
        <div ref={splitRef} className={bodiesClass} style={bodiesStyle}>
          {props.sessions.map((s) => {
            const slot = getSlotLayout(s.key)
            const focused = splitLayout
              ? props.activeKey === s.key &&
                ((slot === 'primary' &&
                  splitLayout.focusedPane === 'primary') ||
                  (slot === 'secondary' &&
                    splitLayout.focusedPane === 'secondary'))
              : props.activeKey === s.key

            return (
              <div
                key={s.key}
                className={`term-slot slot-${slot} ${focused ? 'focused' : ''}`}
                onPointerDown={() => {
                  if (slot === 'primary') focusPane('primary', s.key)
                  if (slot === 'secondary') focusPane('secondary', s.key)
                }}
              >
                <TermBody
                  session={s}
                  visible={slot !== 'hidden'}
                  focused={focused}
                  onStateChange={props.onStateChange}
                  onSessionId={(key, id) =>
                    setSessionIds((prev) => ({ ...prev, [key]: id }))
                  }
                />
                {(s.status === 'closed' || s.status === 'error') && (
                  <div className="term-reconnect">
                    <span>{s.status === 'error' ? '连接失败' : '连接已断开'}</span>
                    <button
                      className="btn primary"
                      onClick={() => props.onReconnect?.(s.key)}
                    >
                      重新连接
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          {splitLayout && (
            <div
              className="term-split-divider"
              onPointerDown={onDividerPointerDown}
              onPointerMove={onDividerPointerMove}
              onPointerUp={onDividerPointerUp}
              onPointerCancel={onDividerPointerUp}
            />
          )}
        </div>
        {showFiles && activeSshId && (
          <FilePanel
            sessionId={activeSshId}
            onClose={() => setShowFiles(false)}
          />
        )}
      </div>
      {menu && (
        <TabContextMenu
          x={menu.x}
          y={menu.y}
          splitActive={!!splitLayout}
          onDuplicate={() => props.onDuplicateKey?.(menu.key)}
          onSplitHorizontal={() => startSplit(menu.key, 'horizontal')}
          onSplitVertical={() => startSplit(menu.key, 'vertical')}
          onExitSplit={splitLayout ? exitSplit : undefined}
          onClose={() => props.onClose(menu.key)}
          onCloseOthers={() => props.onCloseOthers?.(menu.key)}
          onCloseAll={() => props.onCloseAll?.()}
          onDismiss={() => setMenu(null)}
        />
      )}
    </div>
  )
}

function TermBody(props: {
  session: TermSession
  visible: boolean
  focused: boolean
  onStateChange: (key: string, status: TermSession['status']) => void
  onSessionId: (key: string, sessionId: string) => void
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const visibleRef = useRef(props.visible)
  const { session, onStateChange } = props

  useEffect(() => {
    visibleRef.current = props.visible
  }, [props.visible])

  // 初始化终端 + 建立 SSH 连接（每个会话一次）
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const s = getSettings()
    const term = new Terminal({
      cursorBlink: true,
      fontSize: s.fontSize,
      scrollback: s.scrollback,
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
      if (!visibleRef.current) return
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

  // 显示/聚焦变化时重新适配尺寸
  useEffect(() => {
    if (props.visible && fitRef.current && termRef.current) {
      setTimeout(() => {
        try {
          fitRef.current?.fit()
          if (props.focused) termRef.current?.focus()
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
  }, [props.visible, props.focused])

  // 主题切换时实时更新终端配色
  const theme = useTheme()
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = { ...theme.term }
    }
  }, [theme])

  // 显示设置变更时实时应用字号/回滚行数
  useEffect(() => {
    const off = subscribeSettings(() => {
      const term = termRef.current
      const fit = fitRef.current
      if (!term) return
      const s = getSettings()
      term.options.fontSize = s.fontSize
      term.options.scrollback = s.scrollback
      try {
        fit?.fit()
        if (sessionIdRef.current) {
          api.ssh.resize(sessionIdRef.current, term.cols, term.rows)
        }
      } catch {
        /* ignore */
      }
    })
    return off
  }, [])

  return (
    <div ref={containerRef} className="term-body" />
  )
}
