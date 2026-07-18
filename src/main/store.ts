import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { SSHConnection, ConnectionGroup } from '../shared/types'

interface StoreData {
  connections: SSHConnection[]
  groups: ConnectionGroup[]
}

function dataFile(): string {
  return path.join(app.getPath('userData'), 'connections.json')
}

function load(): StoreData {
  try {
    const raw = fs.readFileSync(dataFile(), 'utf-8')
    const data = JSON.parse(raw) as StoreData
    return {
      connections: Array.isArray(data.connections) ? data.connections : [],
      groups: Array.isArray(data.groups) ? data.groups : []
    }
  } catch {
    return { connections: [], groups: [] }
  }
}

function save(data: StoreData): void {
  const file = dataFile()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

function genId(): string {
  return crypto.randomUUID()
}

// ---------- 连接 ----------

export function listConnections(): SSHConnection[] {
  return load().connections
}

export function createConnection(
  conn: Omit<SSHConnection, 'id' | 'createdAt'>
): SSHConnection {
  const data = load()
  const full: SSHConnection = { ...conn, id: genId(), createdAt: Date.now() }
  data.connections.push(full)
  save(data)
  return full
}

export function updateConnection(
  id: string,
  patch: Partial<SSHConnection>
): SSHConnection | null {
  const data = load()
  const idx = data.connections.findIndex((c) => c.id === id)
  if (idx === -1) return null
  data.connections[idx] = { ...data.connections[idx], ...patch, id }
  save(data)
  return data.connections[idx]
}

export function removeConnection(id: string): void {
  const data = load()
  data.connections = data.connections.filter((c) => c.id !== id)
  save(data)
}

export function getConnection(id: string): SSHConnection | null {
  return load().connections.find((c) => c.id === id) ?? null
}

// ---------- 分组 ----------

export function listGroups(): ConnectionGroup[] {
  return load().groups
}

export function createGroup(name: string): ConnectionGroup {
  const data = load()
  const group: ConnectionGroup = { id: genId(), name, createdAt: Date.now() }
  data.groups.push(group)
  save(data)
  return group
}

export function removeGroup(id: string): void {
  const data = load()
  data.groups = data.groups.filter((g) => g.id !== id)
  // 组内连接移到"未分组"
  data.connections = data.connections.map((c) =>
    c.groupId === id ? { ...c, groupId: null } : c
  )
  save(data)
}
