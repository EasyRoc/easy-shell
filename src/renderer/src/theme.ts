import { useSyncExternalStore } from 'react'
import { DEFAULT_THEME_ID, getThemeById, THEMES } from './themes'
import type { ThemeDef } from './themes'

const STORAGE_KEY = 'easy-shell-theme'

function loadInitialId(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && getThemeById(saved)) return saved
  } catch {
    /* localStorage 不可用时用默认主题 */
  }
  return DEFAULT_THEME_ID
}

let currentId = loadInitialId()
const listeners = new Set<() => void>()

function applyToDom(): void {
  document.documentElement.dataset.theme = currentId
}

/** 启动时在 render 前调用，把当前主题应用到根节点 */
export function initTheme(): void {
  applyToDom()
}

export function getCurrentTheme(): ThemeDef {
  return getThemeById(currentId) ?? THEMES[0]
}

export function setTheme(id: string): void {
  if (!getThemeById(id) || id === currentId) return
  currentId = id
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* 写入失败不阻塞换肤 */
  }
  applyToDom()
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** React hook：返回当前主题，主题变化时触发重渲染 */
export function useTheme(): ThemeDef {
  useSyncExternalStore(subscribe, () => currentId)
  return getCurrentTheme()
}
