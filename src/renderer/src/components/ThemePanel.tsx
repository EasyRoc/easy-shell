import { useEffect, useRef } from 'react'
import { THEMES } from '../themes'
import { setTheme, useTheme } from '../theme'

interface Props {
  onClose: () => void
}

export default function ThemePanel({ onClose }: Props): JSX.Element {
  const theme = useTheme()
  const ref = useRef<HTMLDivElement>(null)

  // 点击面板外部关闭
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  return (
    <div className="theme-panel" ref={ref}>
      <div className="theme-panel-title">主题</div>
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
    </div>
  )
}
