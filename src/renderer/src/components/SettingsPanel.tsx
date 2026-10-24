import { useEffect, useRef, useState } from 'react'
import { THEMES } from '../themes'
import { setTheme, useTheme } from '../theme'
import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  SCROLLBACK_OPTIONS,
  getSettings,
  setSettings,
  subscribeSettings
} from '../settings'
import type { AppSettings } from '../settings'

interface Props {
  onClose: () => void
}

// 设置面板：主题 + 终端字号/回滚行数（点击面板外部关闭）
export default function SettingsPanel({ onClose }: Props): JSX.Element {
  const theme = useTheme()
  const [settings, applySettings] = useState<AppSettings>(getSettings())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(
    () => subscribeSettings(() => applySettings(getSettings())),
    []
  )

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      const target = e.target as Node | null
      if (!ref.current || !target) return
      if (ref.current.contains(target)) return
      // 点在开关按钮上时交给按钮自己的 toggle，避免“外部关闭后又被点开”
      if (target instanceof Element && target.closest('.theme-entry')) return
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  return (
    <div className="theme-panel settings-panel" ref={ref}>
      <div className="theme-panel-title">外观</div>
      {THEMES.map((t) => (
        <button
          key={t.id}
          className={`theme-card ${t.id === theme.id ? 'active' : ''}`}
          onClick={() => setTheme(t.id)}
        >
          <span className="swatches">
            <i style={{ background: t.vars['--bg'] }} />
            <i style={{ background: t.vars['--bg-panel'] }} />
            <i style={{ background: t.vars['--green'] }} />
          </span>
          {t.name}
        </button>
      ))}

      <div className="theme-panel-title">终端</div>
      <div className="settings-row">
        <span>字号</span>
        <div className="settings-stepper">
          <button
            type="button"
            aria-label="减小字号"
            disabled={settings.fontSize <= FONT_SIZE_MIN}
            onClick={() => setSettings({ fontSize: settings.fontSize - 1 })}
          >
            −
          </button>
          <span>{settings.fontSize}</span>
          <button
            type="button"
            aria-label="增大字号"
            disabled={settings.fontSize >= FONT_SIZE_MAX}
            onClick={() => setSettings({ fontSize: settings.fontSize + 1 })}
          >
            ＋
          </button>
        </div>
      </div>
      <div className="settings-row">
        <span>回滚行数</span>
        <select
          value={settings.scrollback}
          onChange={(e) => setSettings({ scrollback: Number(e.target.value) })}
        >
          {SCROLLBACK_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n >= 10000 ? `${n / 10000} 万行` : `${n} 行`}
            </option>
          ))}
        </select>
      </div>
      <div className="settings-hint">设置实时生效，新建终端也会使用当前设置</div>
    </div>
  )
}
