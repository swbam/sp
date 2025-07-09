#!/usr/bin/env node

/**
 * MySetlist Testing Framework Verification Script
 * 
 * Validates the complete testing setup and configuration
 */

import { readFileSync, existsSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('🧪 MySetlist Testing Framework Verification')
console.log('==========================================\n')

let verificationResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
}

function checkFile(filePath, description, required = true) {
  const exists = existsSync(filePath)
  
  if (exists) {
    verificationResults.passed++
    verificationResults.details.push({
      type: 'success',
      message: `✅ ${description}: ${filePath}`
    })
    return true
  } else {
    if (required) {
      verificationResults.failed++
      verificationResults.details.push({
        type: 'error',
        message: `❌ ${description}: ${filePath} - MISSING`
      })
    } else {
      verificationResults.warnings++
      verificationResults.details.push({
        type: 'warning',
        message: `⚠️ ${description}: ${filePath} - OPTIONAL`
      })
    }
    return false
  }
}

function checkDirectory(dirPath, description, required = true) {
  const exists = existsSync(dirPath)
  
  if (exists) {
    const stats = statSync(dirPath)
    if (stats.isDirectory()) {
      verificationResults.passed++
      verificationResults.details.push({
        type: 'success',
        message: `✅ ${description}: ${dirPath}`
      })
      return true
    }
  }
  
  if (required) {
    verificationResults.failed++
    verificationResults.details.push({
      type: 'error',
      message: `❌ ${description}: ${dirPath} - MISSING`
    })
  } else {
    verificationResults.warnings++
    verificationResults.details.push({
      type: 'warning',
      message: `⚠️ ${description}: ${dirPath} - OPTIONAL`
    })
  }
  return false
}

function checkPackageJson() {
  console.log('📦 Checking package.json configuration...')
  
  const packageJsonPath = join(__dirname, 'package.json')
  
  if (!checkFile(packageJsonPath, 'Package.json file')) {
    return false
  }
  
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    
    // Check test scripts
    const requiredScripts = [
      'test',
      'test:unit',
      'test:integration',
      'test:e2e',
      'test:mobile',
      'test:accessibility',
      'test:visual',
      'test:security',
      'test:load',
      'test:coverage',
      'test:all',
      'test:ci'
    ]
    
    const missingScripts = requiredScripts.filter(script => 
      !packageJson.scripts || !packageJson.scripts[script]
    )
    
    if (missingScripts.length === 0) {
      verificationResults.passed++
      verificationResults.details.push({
        type: 'success',
        message: '✅ All required test scripts present'
      })
    } else {
      verificationResults.failed++
      verificationResults.details.push({
        type: 'error',
        message: `❌ Missing test scripts: ${missingScripts.join(', ')}`
      })
    }
    
    // Check testing dependencies
    const requiredDeps = [
      'vitest',
      '@playwright/test',
      '@testing-library/react',
      '@testing-library/jest-dom',
      '@vitest/coverage-v8',
      'jsdom'
    ]
    
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies }
    const missingDeps = requiredDeps.filter(dep => !allDeps[dep])
    
    if (missingDeps.length === 0) {
      verificationResults.passed++
      verificationResults.details.push({
        type: 'success',
        message: '✅ All required testing dependencies present'
      })
    } else {
      verificationResults.failed++
      verificationResults.details.push({
        type: 'error',
        message: `❌ Missing testing dependencies: ${missingDeps.join(', ')}`
      })
    }
    
    return true
    
  } catch (error) {
    verificationResults.failed++
    verificationResults.details.push({
      type: 'error',
      message: `❌ Error parsing package.json: ${error.message}`
    })
    return false
  }
}

function checkTestConfigurations() {
  console.log('⚙️ Checking test configuration files...')
  
  // Vitest configurations
  checkFile(join(__dirname, 'vitest.config.ts'), 'Main Vitest configuration')
  checkFile(join(__dirname, 'vitest.config.unit.ts'), 'Unit test configuration')
  checkFile(join(__dirname, 'vitest.config.integration.ts'), 'Integration test configuration')
  
  // Playwright configurations
  checkFile(join(__dirname, 'playwright.config.ts'), 'Main Playwright configuration')
  checkFile(join(__dirname, 'playwright.mobile.config.ts'), 'Mobile test configuration')
  checkFile(join(__dirname, 'playwright.a11y.config.ts'), 'Accessibility test configuration')
  checkFile(join(__dirname, 'playwright.visual.config.ts'), 'Visual test configuration')
  
  // Test setup files
  checkFile(join(__dirname, 'tests/setup.ts'), 'Global test setup')
  checkFile(join(__dirname, 'tests/integration-setup.ts'), 'Integration test setup')
  checkFile(join(__dirname, 'tests/e2e/global-setup.ts'), 'E2E global setup')
  checkFile(join(__dirname, 'tests/e2e/global-teardown.ts'), 'E2E global teardown')
  checkFile(join(__dirname, 'tests/e2e/auth.setup.ts'), 'Authentication setup')
}

function checkTestDirectories() {
  console.log('📁 Checking test directory structure...')
  
  // Main test directories
  checkDirectory(join(__dirname, 'tests'), 'Tests directory')
  checkDirectory(join(__dirname, 'tests/unit'), 'Unit tests directory')
  checkDirectory(join(__dirname, 'tests/integration'), 'Integration tests directory')
  checkDirectory(join(__dirname, 'tests/e2e'), 'E2E tests directory')
  checkDirectory(join(__dirname, 'tests/mobile'), 'Mobile tests directory')
  checkDirectory(join(__dirname, 'tests/a11y'), 'Accessibility tests directory')
  checkDirectory(join(__dirname, 'tests/visual'), 'Visual tests directory')
  checkDirectory(join(__dirname, 'tests/security'), 'Security tests directory')
  checkDirectory(join(__dirname, 'tests/load'), 'Load tests directory')
  
  // E2E auth directory
  checkDirectory(join(__dirname, 'tests/e2e/.auth'), 'E2E authentication directory')
}

function checkTestFiles() {
  console.log('📄 Checking test files...')
  
  // Unit test files
  checkFile(join(__dirname, 'tests/unit/components/VoteButton.test.tsx'), 'VoteButton unit test')
  
  // Integration test files
  checkFile(join(__dirname, 'tests/integration/api/search.test.ts'), 'Search API integration test')
  
  // E2E test files
  checkFile(join(__dirname, 'tests/e2e/homepage.spec.ts'), 'Homepage E2E test')
  checkFile(join(__dirname, 'tests/e2e/search.spec.ts'), 'Search E2E test')
  checkFile(join(__dirname, 'tests/e2e/voting.spec.ts'), 'Voting E2E test')
  
  // Load test files
  checkFile(join(__dirname, 'tests/load/load-test.js'), 'Load test file')
  checkFile(join(__dirname, 'tests/load/stress-test.js'), 'Stress test file')
  checkFile(join(__dirname, 'tests/load/spike-test.js'), 'Spike test file')
  checkFile(join(__dirname, 'tests/load/volume-test.js'), 'Volume test file')
  
  // Security test files
  checkFile(join(__dirname, 'tests/security/security-scan.mjs'), 'Security scan test')
}

function checkCIConfiguration() {
  console.log('🔄 Checking CI/CD configuration...')
  
  // GitHub Actions
  checkDirectory(join(__dirname, '.github'), 'GitHub directory')
  checkDirectory(join(__dirname, '.github/workflows'), 'GitHub workflows directory')
  checkFile(join(__dirname, '.github/workflows/comprehensive-testing.yml'), 'Comprehensive testing workflow')
}

function checkDocumentation() {
  console.log('📚 Checking documentation...')
  
  checkFile(join(__dirname, 'SUB-AGENT-QA-COMPREHENSIVE-TESTING-FRAMEWORK.md'), 'Testing framework documentation')
  checkFile(join(__dirname, 'README.md'), 'Main README file', false)
}

function checkEnvironmentSupport() {
  console.log('🌍 Checking environment support...')
  
  try {
    // Check Node.js version
    const nodeVersion = process.version
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0])
    
    if (majorVersion >= 18) {
      verificationResults.passed++
      verificationResults.details.push({
        type: 'success',
        message: `✅ Node.js version: ${nodeVersion} (supported)`
      })
    } else {
      verificationResults.failed++
      verificationResults.details.push({
        type: 'error',
        message: `❌ Node.js version: ${nodeVersion} (requires Node.js 18+)`
      })
    }
    
    // Check for environment file
    const envExists = existsSync(join(__dirname, '.env.local'))
    if (envExists) {
      verificationResults.passed++
      verificationResults.details.push({
        type: 'success',
        message: '✅ Environment file: .env.local found'
      })
    } else {
      verificationResults.warnings++
      verificationResults.details.push({
        type: 'warning',
        message: '⚠️ Environment file: .env.local not found (create from .env.example)'
      })
    }
    
  } catch (error) {
    verificationResults.failed++
    verificationResults.details.push({
      type: 'error',
      message: `❌ Environment check failed: ${error.message}`
    })
  }
}

function generateReport() {
  console.log('\n📊 Verification Report')
  console.log('=====================')
  
  // Display results by type
  const successResults = verificationResults.details.filter(d => d.type === 'success')
  const errorResults = verificationResults.details.filter(d => d.type === 'error')
  const warningResults = verificationResults.details.filter(d => d.type === 'warning')
  
  if (successResults.length > 0) {
    console.log('\n✅ Passed Checks:')
    successResults.forEach(result => console.log(`  ${result.message}`))
  }
  
  if (warningResults.length > 0) {
    console.log('\n⚠️ Warnings:')
    warningResults.forEach(result => console.log(`  ${result.message}`))
  }
  
  if (errorResults.length > 0) {
    console.log('\n❌ Failed Checks:')
    errorResults.forEach(result => console.log(`  ${result.message}`))
  }
  
  console.log('\n📈 Summary:')
  console.log(`  ✅ Passed: ${verificationResults.passed}`)
  console.log(`  ⚠️ Warnings: ${verificationResults.warnings}`)
  console.log(`  ❌ Failed: ${verificationResults.failed}`)
  console.log(`  📊 Total: ${verificationResults.passed + verificationResults.warnings + verificationResults.failed}`)
  
  const successRate = ((verificationResults.passed / (verificationResults.passed + verificationResults.failed)) * 100).toFixed(1)
  console.log(`  📊 Success Rate: ${successRate}%`)
  
  if (verificationResults.failed === 0) {
    console.log('\n🎉 All critical checks passed! Testing framework is ready.')
  } else {
    console.log('\n⚠️ Some critical checks failed. Please address the issues above.')
  }
  
  console.log('\n🚀 Next Steps:')
  console.log('  1. Run: npm install')
  console.log('  2. Run: npx playwright install')
  console.log('  3. Create .env.local from .env.example')
  console.log('  4. Run: npm run test:unit')
  console.log('  5. Run: npm run test:e2e')
  console.log('  6. Run: npm run test:all')
  
  return verificationResults.failed === 0
}

async function main() {
  try {
    // Run all verification checks
    checkPackageJson()
    checkTestConfigurations()
    checkTestDirectories()
    checkTestFiles()
    checkCIConfiguration()
    checkDocumentation()
    checkEnvironmentSupport()
    
    // Generate final report
    const success = generateReport()
    
    // Exit with appropriate code
    process.exit(success ? 0 : 1)
    
  } catch (error) {
    console.error('❌ Verification failed:', error)
    process.exit(1)
  }
}

main()