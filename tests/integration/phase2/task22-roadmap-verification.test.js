// Task 2.2 roadmap verification test - exactly as specified in implementation-roadmap.md
import { describe, test, expect } from 'vitest'
import { WebSocketServer } from 'ws'

describe('Task 2.2 Roadmap Verification - WebSocket Message Capture', () => {
  test('Test that must pass from roadmap', async () => {
    // Create a mock WebSocket server
    const mockServer = new WebSocketServer({ port: 0 })
    const serverPort = mockServer.address().port
    
    let messageReceived = false

    mockServer.on('connection', (ws) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString())
        if (message.type === 'tool_call' && message.data === 'test') {
          messageReceived = true
        }
      })
    })

    // Exactly as specified in the roadmap:
    const { TracingWebSocket } = await import('../../../packages/tracer/dist/index.js')
    
    // Create mock session and logger
    const sessionId = 'test-session-roadmap'
    const capturedEvents = []
    const mockLogger = {
      logEvent: async (event) => {
        capturedEvents.push(event)
      }
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Test timeout'))
      }, 5000)

      const ws = new TracingWebSocket({
        sessionId,
        logger: mockLogger,
        url: `ws://localhost:${serverPort}`,
        captureMessages: true,
        enablePerformanceMetrics: true
      })

      ws.onopen = () => {
        // Exactly as in roadmap specification:
        ws.send(JSON.stringify({ type: 'tool_call', data: 'test' }))
      }
      
      ws.onmessage = (event) => {
        // Verify message capture - as specified in roadmap
        expect(event).toBeDefined()
        expect(event.data).toBeDefined()
      }

      // Let the test run for a moment then verify results
      setTimeout(async () => {
        await ws.cleanup()
        await mockServer.close()

        // Verify bidirectional message logging - as specified in roadmap
        const messageEvents = capturedEvents.filter(e => e.type === 'websocket_message')
        const sentMessages = messageEvents.filter(e => e.direction === 'sent')
        const receivedMessages = messageEvents.filter(e => e.direction === 'received')
        
        expect(sentMessages.length).toBeGreaterThan(0)
        expect(receivedMessages.length).toBeGreaterThan(0)

        // Verify timing and size metrics - as specified in roadmap
        const messageWithMetrics = messageEvents.find(e => e.timing && e.size !== undefined)
        expect(messageWithMetrics).toBeDefined()
        expect(messageWithMetrics.timing.duration).toBeGreaterThanOrEqual(0)
        expect(messageWithMetrics.size).toBeGreaterThan(0)

        // Verify connection state tracking - as specified in roadmap
        const connectionEvents = capturedEvents.filter(e => e.type === 'websocket_connection')
        const states = connectionEvents.map(e => e.state)
        expect(states).toContain('connecting')
        expect(states).toContain('open')

        console.log('✅ Task 2.2 Roadmap Verification PASSED:')
        console.log('   - WebSocket wrapper created successfully')
        console.log('   - Bidirectional message logging verified')
        console.log('   - Timing and size metrics collected')
        console.log('   - Connection state tracking working')
        console.log(`   - Message events captured: ${messageEvents.length}`)
        console.log(`   - Connection events captured: ${connectionEvents.length}`)

        clearTimeout(timeout)
        resolve()
      }, 1000)

      ws.onerror = (error) => {
        clearTimeout(timeout)
        reject(error)
      }
    })
  })
})