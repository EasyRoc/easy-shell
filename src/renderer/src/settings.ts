import { useSyncExternalStore } from 'react'

// 终端显示设置：localStorage 持久化，变更实时通知订阅者（已打开的终端也会应用）
export interface AppSettings {
  fontSize: number
  scrollback: number
}

export const FONT_SIZE_MIN = 10
export const FONT_SIZE_MAX = 24
export const SCROLLBACK_OPTIONS = [1000, 5000, 10000, 50000]

const STORAGE_KEY = 'easy-shell-settings'
const DEFAULTS: AppSettings = { fontSize: 13, scrollback: 1000 }

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      fontSize: clampFontSize(parsed.fontSize ?? DEFAULTS.fontSize),
      scrollback: clampScrollback(parsed.scrollback ?? DEFAULTS.scrollback)
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function clampFontSize(n: number): number {
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(n) || DEFAULTS.fontSize))
}

function clampScrollback(n: number): number {
  return SCROLLBACK_OPTIONS.includes(n) ? n : DEFAULTS.scrollback
}

let current: AppSettings = load()
const listeners = new Set<() => void>()

export function getSettings(): AppSettings {
  return current
}

export function setSettings(patch: Partial<AppSettings>): void {
  const next: AppSettings = {
    fontSize: patch.fontSize !== undefined ? clampFontSize(patch.fontSize) : current.fontSize,
    scrollback: patch.scrollback !== undefined ? clampScrollback(patch.scrollback) : current.scrollback
  }
  if (next.fontSize === current.fontSize && next.scrollback === current.scrollback) return
  current = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    /* 写入失败不阻塞 */
  }
  listeners.forEach((fn) => fn())
}

export function subscribeSettings(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** React hook：返回当前设置，变更时触发重渲染 */
export function useSettings(): AppSettings {
  useSyncExternalStore(subscribeSettings, () => current)
  return current
}
