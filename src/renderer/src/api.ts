import type { EasyShellApi } from '../../shared/types'
import { createMockApi } from './mockApi'

declare global {
  interface Window {
    easyShell?: EasyShellApi
  }
}

// Electron 环境用 preload 注入的真实 API；纯浏览器环境（UI 调试）用 mock
export const api: EasyShellApi = window.easyShell ?? createMockApi()
