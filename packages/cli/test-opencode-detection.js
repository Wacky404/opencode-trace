#!/usr/bin/env node

// Quick test script to verify opencode detection and basic wrapper functionality
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import chalk from 'chalk';

console.log(chalk.blue('🔍 Testing opencode detection and integration...'));

async function testOpenCodeDetection() {
  console.log(chalk.yellow('\n1. Testing opencode binary detection...'));
  
  // Test if opencode is accessible
  try {
    const result = await new Promise((resolve, reject) => {
      const proc = spawn('opencode', ['--version'], { stdio: 'pipe' });
      let output = '';
      
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      proc.on('exit', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`opencode exited with code ${code}`));
        }
      });
      
      proc.on('error', (error) => {
        reject(error);
      });
    });
    
    console.log(chalk.green(`✅ opencode detected: version ${result}`));
    return true;
    
  } catch (error) {
    console.error(chalk.red('❌ opencode not found or not working:'), error.message);
    return false;
  }
}

async function testTracingDirectorySetup() {
  console.log(chalk.yellow('\n2. Testing tracing directory setup...'));
  
  const traceDir = '.opencode-trace';
  
  try {
    // Create trace directory structure
    const { mkdir } = await import('node:fs/promises');
    await mkdir(traceDir, { recursive: true });
    await mkdir(`${traceDir}/sessions`, { recursive: true });
    
    console.log(chalk.green(`✅ Trace directory created: ${traceDir}`));
    return true;
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to create trace directory:'), error.message);
    return false;
  }
}

async function testCLIWrapperBuild() {
  console.log(chalk.yellow('\n3. Testing CLI wrapper build...'));
  
  const distPath = './dist/index.js';
  const rootDistPath = './packages/cli/dist/index.js';
  
  if (existsSync(distPath)) {
    console.log(chalk.green('✅ CLI wrapper built successfully'));
    return true;
  } else if (existsSync(rootDistPath)) {
    console.log(chalk.green('✅ CLI wrapper built successfully (from root)'));
    return true;
  } else {
    console.error(chalk.red('❌ CLI wrapper not built - run npm run build:cli first'));
    return false;
  }
}

async function testBasicConfiguration() {
  console.log(chalk.yellow('\n4. Testing basic configuration...'));
  
  try {
    // Test environment variable setup
    process.env.OPENCODE_TRACE = 'true';
    process.env.OPENCODE_TRACE_MODE = 'wrapper';
    process.env.OPENCODE_TRACE_SESSION_ID = 'test-session';
    process.env.OPENCODE_TRACE_DIR = '.opencode-trace';
    
    console.log(chalk.green('✅ Environment variables configured'));
    console.log(chalk.gray(`   OPENCODE_TRACE=${process.env.OPENCODE_TRACE}`));
    console.log(chalk.gray(`   OPENCODE_TRACE_MODE=${process.env.OPENCODE_TRACE_MODE}`));
    console.log(chalk.gray(`   OPENCODE_TRACE_SESSION_ID=${process.env.OPENCODE_TRACE_SESSION_ID}`));
    console.log(chalk.gray(`   OPENCODE_TRACE_DIR=${process.env.OPENCODE_TRACE_DIR}`));
    
    return true;
    
  } catch (error) {
    console.error(chalk.red('❌ Configuration test failed:'), error.message);
    return false;
  }
}

async function runTests() {
  console.log(chalk.blue('🧪 Running opencode integration tests...\n'));
  
  const tests = [
    testOpenCodeDetection,
    testTracingDirectorySetup,
    testCLIWrapperBuild,
    testBasicConfiguration
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(chalk.red('❌ Test error:'), error.message);
      failed++;
    }
  }
  
  console.log(chalk.blue('\n📊 Test Results:'));
  console.log(chalk.green(`✅ Passed: ${passed}`));
  console.log(chalk.red(`❌ Failed: ${failed}`));
  
  if (failed === 0) {
    console.log(chalk.green('\n🎉 All tests passed! Ready for CLI wrapper testing.'));
    console.log(chalk.yellow('\nNext steps:'));
    console.log(chalk.gray('  1. Run: node packages/cli/dist/index.js "test prompt" --debug'));
    console.log(chalk.gray('  2. Test with real opencode session'));
    console.log(chalk.gray('  3. Verify trace files are generated'));
  } else {
    console.log(chalk.red('\n❌ Some tests failed. Please fix issues before proceeding.'));
  }
  
  return failed === 0;
}

// Run the tests
runTests().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});