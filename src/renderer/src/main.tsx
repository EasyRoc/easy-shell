import ReactDOM from 'react-dom/client'
import App from './App'
import { initTheme } from './theme'
import '@xterm/xterm/css/xterm.css'
import './styles.css'

// 注意：不使用 StrictMode，避免开发模式双重挂载导致 SSH 重复连接
initTheme()
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
