import { useEffect } from 'react'

interface Props {
  title: string
  message: string
  danger?: boolean
  okText?: string
  onOk: () => void
  onCancel: () => void
}

// 应用内确认弹窗（替代 window.confirm，风格与整体一致）
export default function ConfirmModal(props: Props): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') props.onCancel()
    }
    // 捕获阶段监听，避免被聚焦组件拦截
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [props.onCancel])

  return (
    <div
      className="modal-mask"
      onMouseDown={(e) => e.target === e.currentTarget && props.onCancel()}
    >
      <div className="confirm-modal">
        <div className="prompt-title">{props.title}</div>
        <div className="confirm-message">{props.message}</div>
        <div className="prompt-actions">
          <button className="btn" onClick={props.onCancel}>
            取 消
          </button>
          <button
            className={`btn ${props.danger ? 'danger-solid' : 'primary'}`}
            onClick={props.onOk}
          >
            {props.okText ?? '确 定'}
          </button>
        </div>
      </div>
    </div>
  )
}
