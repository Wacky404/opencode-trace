#!/usr/bin/env node

// Integration test runner
// Placeholder - will be implemented in Phase 5

console.log('🧪 Running opencode-trace integration tests...')

// Basic smoke test
try {
  // Test that packages can be imported
  const tracer = await import('../../packages/tracer/dist/index.js')
  console.log('✅ Tracer package loads successfully')
  
  const viewer = await import('../../packages/viewer/dist/index.js')
  console.log('✅ Viewer package loads successfully')
  
  console.log('🎉 All integration tests passed!')
  process.exit(0)
} catch (error) {
  console.error('❌ Integration tests failed:', error.message)
  process.exit(1)
}