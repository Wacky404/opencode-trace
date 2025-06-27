import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import { FileSystemManager } from '../filesystem'

// Mock fs/promises module
vi.mock('fs/promises')
vi.mock('graceful-fs', () => ({
  promises: vi.importActual('fs/promises')
}))

describe('FileSystemManager', () => {
  let fsManager: FileSystemManager
  let testDir: string

  beforeEach(() => {
    testDir = '/tmp/test-opencode-trace'
    fsManager = new FileSystemManager(testDir)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('ensureDirectoryStructure', () => {
    test('creates directory structure when it does not exist', async () => {
      // Mock fs.access to throw ENOENT (directory doesn't exist)
      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' })
      
      // Mock successful directory creation
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)

      const result = await fsManager.ensureDirectoryStructure()

      expect(result.success).toBe(true)
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(testDir, 'sessions'),
        { recursive: true }
      )
    })

    test('handles permission denied errors gracefully', async () => {
      const permissionError = new Error('Permission denied')
      ;(permissionError as any).code = 'EACCES'
      
      vi.mocked(fs.access).mockRejectedValue(permissionError)

      const result = await fsManager.ensureDirectoryStructure()

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('Permission denied')
    })

    test('handles disk full errors', async () => {
      const diskFullError = new Error('No space left on device')
      ;(diskFullError as any).code = 'ENOSPC'
      
      vi.mocked(fs.access).mockResolvedValue(undefined) // Directory exists
      vi.mocked(fs.mkdir).mockRejectedValue(diskFullError)

      const result = await fsManager.ensureDirectoryStructure()

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('No space left on device')
    })

    test('returns success when directory already exists', async () => {
      // Mock successful access check (directory exists)
      vi.mocked(fs.access).mockResolvedValue(undefined)

      const result = await fsManager.ensureDirectoryStructure()

      expect(result.success).toBe(true)
      expect(fs.mkdir).not.toHaveBeenCalled()
    })
  })

  describe('writeAtomicFile', () => {
    const fileName = 'test-session.jsonl'
    const content = JSON.stringify({ type: 'test', data: 'example' })

    test('writes file atomically using temp file', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)
      vi.mocked(fs.rename).mockResolvedValue(undefined)

      const result = await fsManager.writeAtomicFile(fileName, content)

      expect(result.success).toBe(true)
      
      // Should write to temp file first
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/\.tmp$/),
        content,
        'utf8'
      )
      
      // Then rename to final location
      expect(fs.rename).toHaveBeenCalledWith(
        expect.stringMatching(/\.tmp$/),
        path.join(testDir, 'sessions', fileName)
      )
    })

    test('cleans up temp file on write failure', async () => {
      const writeError = new Error('Write failed')
      vi.mocked(fs.writeFile).mockRejectedValue(writeError)
      vi.mocked(fs.unlink).mockResolvedValue(undefined)

      const result = await fsManager.writeAtomicFile(fileName, content)

      expect(result.success).toBe(false)
      expect(result.error).toBe(writeError)
      
      // Should attempt to clean up temp file
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringMatching(/\.tmp$/)
      )
    })

    test('handles cleanup failure gracefully', async () => {
      const writeError = new Error('Write failed')
      const unlinkError = new Error('Unlink failed')
      
      vi.mocked(fs.writeFile).mockRejectedValue(writeError)
      vi.mocked(fs.unlink).mockRejectedValue(unlinkError)

      const result = await fsManager.writeAtomicFile(fileName, content)

      expect(result.success).toBe(false)
      expect(result.error).toBe(writeError) // Original error preserved
    })
  })

  describe('appendToFile', () => {
    const fileName = 'session.jsonl'
    const content = JSON.stringify({ type: 'event' }) + '\n'

    test('appends content to existing file', async () => {
      vi.mocked(fs.appendFile).mockResolvedValue(undefined)

      const result = await fsManager.appendToFile(fileName, content)

      expect(result.success).toBe(true)
      expect(fs.appendFile).toHaveBeenCalledWith(
        path.join(testDir, 'sessions', fileName),
        content,
        'utf8'
      )
    })

    test('handles append errors', async () => {
      const appendError = new Error('Cannot append')
      vi.mocked(fs.appendFile).mockRejectedValue(appendError)

      const result = await fsManager.appendToFile(fileName, content)

      expect(result.success).toBe(false)
      expect(result.error).toBe(appendError)
    })
  })

  describe('cleanupOldSessions', () => {
    test('removes sessions older than retention period', async () => {
      const now = Date.now()
      const oldFile = {
        name: 'old-session.jsonl',
        isFile: () => true,
        isDirectory: () => false,
        birthtime: new Date(now - 8 * 24 * 60 * 60 * 1000) // 8 days old
      }
      const recentFile = {
        name: 'recent-session.jsonl', 
        isFile: () => true,
        isDirectory: () => false,
        birthtime: new Date(now - 1 * 24 * 60 * 60 * 1000) // 1 day old
      }

      vi.mocked(fs.readdir).mockResolvedValue([oldFile, recentFile] as any)
      vi.mocked(fs.stat).mockImplementation(async (filePath) => {
        if (filePath.includes('old-session')) {
          return { birthtime: oldFile.birthtime } as any
        }
        return { birthtime: recentFile.birthtime } as any
      })
      vi.mocked(fs.unlink).mockResolvedValue(undefined)

      const result = await fsManager.cleanupOldSessions(7) // 7 day retention

      expect(result.success).toBe(true)
      expect(result.data?.cleaned).toBe(1)
      
      // Should only delete old file
      expect(fs.unlink).toHaveBeenCalledTimes(1)
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('old-session.jsonl')
      )
    })

    test('continues cleanup even if individual file deletion fails', async () => {
      const files = [
        {
          name: 'session1.jsonl',
          isFile: () => true,
          isDirectory: () => false,
          birthtime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
        },
        {
          name: 'session2.jsonl',
          isFile: () => true,
          isDirectory: () => false,
          birthtime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
        }
      ]

      vi.mocked(fs.readdir).mockResolvedValue(files as any)
      vi.mocked(fs.stat).mockResolvedValue({ 
        birthtime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) 
      } as any)
      
      // First deletion fails, second succeeds
      vi.mocked(fs.unlink)
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockResolvedValueOnce(undefined)

      const result = await fsManager.cleanupOldSessions(7)

      expect(result.success).toBe(true)
      expect(result.data?.cleaned).toBe(1)
      expect(result.data?.failed).toBe(1)
    })

    test('handles empty directory', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([])

      const result = await fsManager.cleanupOldSessions(7)

      expect(result.success).toBe(true)
      expect(result.data?.cleaned).toBe(0)
      expect(fs.unlink).not.toHaveBeenCalled()
    })
  })

  describe('listSessions', () => {
    test('returns list of session files', async () => {
      const files = [
        { name: 'session1.jsonl', isFile: () => true, isDirectory: () => false },
        { name: 'session2.jsonl', isFile: () => true, isDirectory: () => false },
        { name: 'not-a-session.txt', isFile: () => true, isDirectory: () => false },
        { name: 'subdir', isFile: () => false, isDirectory: () => true }
      ]

      vi.mocked(fs.readdir).mockResolvedValue(files as any)

      const result = await fsManager.listSessions()

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.data).toContain('session1.jsonl')
      expect(result.data).toContain('session2.jsonl')
      expect(result.data).not.toContain('not-a-session.txt')
      expect(result.data).not.toContain('subdir')
    })

    test('handles directory read errors', async () => {
      const readError = new Error('Cannot read directory')
      vi.mocked(fs.readdir).mockRejectedValue(readError)

      const result = await fsManager.listSessions()

      expect(result.success).toBe(false)
      expect(result.error).toBe(readError)
    })
  })

  describe('getSessionPath', () => {
    test('returns correct path for session file', () => {
      const sessionId = 'test-session-123'
      const expectedPath = path.join(testDir, 'sessions', sessionId + '.jsonl')

      const result = fsManager.getSessionPath(sessionId)

      expect(result).toBe(expectedPath)
    })

    test('handles session IDs with .jsonl extension', () => {
      const sessionId = 'test-session.jsonl'
      const expectedPath = path.join(testDir, 'sessions', sessionId)

      const result = fsManager.getSessionPath(sessionId)

      expect(result).toBe(expectedPath)
    })
  })
})