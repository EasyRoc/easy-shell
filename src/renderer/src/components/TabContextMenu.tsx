import { useEffect } from 'react'

interface Props {
  x: number
  y: number
  onDuplicate: () => void
  onClose: () => void
  onCloseOthers: () => void
  onCloseAll: () => void
  onDismiss: () => void
}

// 需与 styles.css 中 .ctx-menu 的 width/实际渲染高度保持同步
const MENU_W = 168
const MENU_H = 150

export default function TabContextMenu(props: Props): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') props.onDismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [props.onDismiss])

  // 边界收拢：靠右/靠下时往回收，避免超出窗口
  const left = Math.min(props.x, window.innerWidth - MENU_W - 8)
  const top = Math.min(props.y, window.innerHeight - MENU_H - 8)

  const click = (fn: () => void) => (): void => {
    props.onDismiss()
    fn()
  }

  return (
    <>
      <div
        className="ctx-overlay"
        onClick={props.onDismiss}
        onContextMenu={(e) => {
          e.preventDefault()
          props.onDismiss()
        }}
      />
      <div
        className="ctx-menu"
        style={{ left, top }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="ctx-item" onClick={click(props.onDuplicate)}>
          <span className="ctx-ic">⧉</span>复制窗口
        </div>
        <div className="ctx-sep" />
        <div className="ctx-item" onClick={click(props.onClose)}>
          <span className="ctx-ic">×</span>关闭
        </div>
        <div className="ctx-item" onClick={click(props.onCloseOthers)}>
          <span className="ctx-ic">⊘</span>关闭其他
        </div>
        <div className="ctx-item danger" onClick={click(props.onCloseAll)}>
          <span className="ctx-ic">⊗</span>关闭全部
        </div>
      </div>
    </>
  )
}
