import { useEffect, useRef, useState } from 'react'

interface Props {
  title: string
  placeholder?: string
  defaultValue?: string
  onOk: (value: string) => void
  onCancel: () => void
}

// 简单的输入弹窗（Electron 不支持 window.prompt，用这个替代）
export default function PromptModal(props: Props): JSX.Element {
  const [value, setValue] = useState(props.defaultValue ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = (): void => {
    const v = value.trim()
    if (v) props.onOk(v)
  }

  return (
    <div
      className="modal-mask"
      onMouseDown={(e) => e.target === e.currentTarget && props.onCancel()}
    >
      <div className="prompt-modal">
        <div className="prompt-title">{props.title}</div>
        <input
          ref={inputRef}
          value={value}
          placeholder={props.placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') props.onCancel()
          }}
        />
        <div className="prompt-actions">
          <button className="btn" onClick={props.onCancel}>
            取 消
          </button>
          <button
            className="btn primary"
            disabled={!value.trim()}
            onClick={submit}
          >
            确 定
          </button>
        </div>
      </div>
    </div>
  )
}
