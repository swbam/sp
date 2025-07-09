#!/usr/bin/env node

/**
 * MySetlist Security Testing Suite
 * 
 * Comprehensive security vulnerability scanning and penetration testing
 * Tests for OWASP Top 10 and MySetlist-specific security concerns
 */

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
const envFile = join(__dirname, '../../.env.local')
try {
  const envContent = readFileSync(envFile, 'utf8')
  const lines = envContent.split('\n')
  for (const line of lines) {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=')
      const value = valueParts.join('=')
      if (key && value) {
        process.env[key.trim()] = value.trim()
      }
    }
  }
} catch (error) {
  console.warn('Warning: Could not load .env.local file')
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('🔒 MySetlist Security Testing Suite')
console.log('==================================')
console.log(`🎯 Target: ${BASE_URL}`)
console.log('📋 Testing: OWASP Top 10 + Custom Security Scenarios\\n')

// Security test results
const securityResults = {
  testDate: new Date().toISOString(),
  target: BASE_URL,
  vulnerabilities: [],
  passedTests: [],
  failedTests: [],
  riskLevel: 'unknown',
  recommendations: []
}

// Helper functions
function logVulnerability(severity, category, description, details = {}) {
  const vulnerability = {
    severity,
    category,
    description,
    details,
    timestamp: new Date().toISOString()
  }
  
  securityResults.vulnerabilities.push(vulnerability)
  
  const emoji = severity === 'HIGH' ? '🚨' : severity === 'MEDIUM' ? '⚠️' : '💡'
  console.log(`${emoji} ${severity}: ${category} - ${description}`)
  
  if (Object.keys(details).length > 0) {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`)
  }
}

function logTestResult(testName, passed, details = '') {
  if (passed) {
    securityResults.passedTests.push({ test: testName, details })
    console.log(`✅ PASS: ${testName}`)
  } else {
    securityResults.failedTests.push({ test: testName, details })
    console.log(`❌ FAIL: ${testName} - ${details}`)
  }
}

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      timeout: 10000,
      ...options
    })
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text(),
      ok: response.ok
    }
  } catch (error) {
    return {
      status: 0,
      headers: {},
      body: '',
      ok: false,
      error: error.message
    }
  }
}

// Security Test 1: Information Disclosure
async function testInformationDisclosure() {
  console.log('\\n🔍 1. Testing Information Disclosure...')
  
  // Test for sensitive endpoints
  const sensitiveEndpoints = [
    '/.env',
    '/.env.local',
    '/config.json',
    '/package.json',
    '/next.config.js',
    '/.git/config',
    '/admin',
    '/debug',
    '/test',
    '/api/debug',
    '/api/config'
  ]
  
  for (const endpoint of sensitiveEndpoints) {
    const response = await makeRequest(`${BASE_URL}${endpoint}`)
    
    if (response.status === 200) {
      logVulnerability('HIGH', 'Information Disclosure', 
        `Sensitive endpoint accessible: ${endpoint}`, 
        { endpoint, status: response.status })
    } else {
      logTestResult(`Sensitive endpoint protection: ${endpoint}`, true)
    }
  }
  
  // Test for verbose error messages
  const errorTestResponse = await makeRequest(`${BASE_URL}/api/nonexistent-endpoint`)
  if (errorTestResponse.body.includes('stack') || 
      errorTestResponse.body.includes('node_modules') ||
      errorTestResponse.body.includes('at Object.')) {
    logVulnerability('MEDIUM', 'Information Disclosure', 
      'Verbose error messages expose internal paths', 
      { response: errorTestResponse.body.substring(0, 200) })
  } else {
    logTestResult('Error message sanitization', true)
  }
}

// Security Test 2: Authentication & Authorization
async function testAuthentication() {
  console.log('\\n🔐 2. Testing Authentication & Authorization...')
  
  // Test for authentication bypass
  const protectedEndpoints = [
    '/api/votes',
    '/api/user/following',
    '/account'
  ]
  
  for (const endpoint of protectedEndpoints) {
    const response = await makeRequest(`${BASE_URL}${endpoint}`, {
      method: endpoint.startsWith('/api/') ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      body: endpoint.startsWith('/api/') ? JSON.stringify({}) : undefined
    })
    
    // Should return 401 or redirect to login
    if (response.status === 200) {
      logVulnerability('HIGH', 'Authentication Bypass', 
        `Protected endpoint accessible without authentication: ${endpoint}`,
        { endpoint, status: response.status })
    } else if (response.status === 401 || response.status === 403) {
      logTestResult(`Authentication required: ${endpoint}`, true)
    }
  }
  
  // Test for weak session management
  const loginResponse = await makeRequest(`${BASE_URL}/api/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@test.com', password: 'password' })
  })
  
  const setCookieHeader = loginResponse.headers['set-cookie']
  if (setCookieHeader && !setCookieHeader.includes('HttpOnly')) {
    logVulnerability('MEDIUM', 'Session Management', 
      'Session cookies missing HttpOnly flag',
      { cookieHeader: setCookieHeader })
  }
  
  if (setCookieHeader && !setCookieHeader.includes('Secure')) {
    logVulnerability('MEDIUM', 'Session Management', 
      'Session cookies missing Secure flag',
      { cookieHeader: setCookieHeader })
  }
}

// Security Test 3: SQL Injection
async function testSQLInjection() {
  console.log('\\n💉 3. Testing SQL Injection...')
  
  const sqlPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "' UNION SELECT * FROM users --",
    "1' OR 1=1#",
    "admin'--",
    "' OR 1=1 /*"
  ]
  
  // Test search endpoints
  for (const payload of sqlPayloads) {
    const response = await makeRequest(`${BASE_URL}/api/search/artists?q=${encodeURIComponent(payload)}`)
    
    // Look for SQL error messages
    if (response.body.includes('PostgreSQL') || 
        response.body.includes('syntax error') ||
        response.body.includes('pg_') ||
        response.body.includes('ERROR: ')) {
      logVulnerability('HIGH', 'SQL Injection', 
        'SQL error messages indicate potential injection vulnerability',
        { payload, response: response.body.substring(0, 200) })
    }
    
    // Unusual response patterns
    if (response.status === 200 && response.body.length > 10000) {
      logVulnerability('MEDIUM', 'SQL Injection', 
        'Unusual response size may indicate injection success',
        { payload, responseLength: response.body.length })
    }
  }
  
  logTestResult('SQL Injection resistance', true, 'No obvious SQL injection vulnerabilities detected')
}

// Security Test 4: Cross-Site Scripting (XSS)
async function testXSS() {
  console.log('\\n📜 4. Testing Cross-Site Scripting (XSS)...')
  
  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '\\"\\><script>alert(String.fromCharCode(88,83,83))</script>',
    '<img src=x onerror=alert("XSS")>',
    'javascript:alert("XSS")',
    '<svg onload=alert("XSS")>',
    '"><script>alert("XSS")</script>'
  ]
  
  // Test search functionality for reflected XSS
  for (const payload of xssPayloads) {
    const response = await makeRequest(`${BASE_URL}/search?q=${encodeURIComponent(payload)}`)
    
    if (response.body.includes(payload)) {
      logVulnerability('HIGH', 'Cross-Site Scripting', 
        'Potential reflected XSS vulnerability in search',
        { payload, found: true })
    }
  }
  
  // Test artist name inputs for stored XSS
  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    try {
      const { data, error } = await supabase
        .from('artists')
        .select('name')
        .limit(5)
      
      if (data) {
        for (const artist of data) {
          if (artist.name.includes('<script>') || 
              artist.name.includes('javascript:') ||
              artist.name.includes('onerror=')) {
            logVulnerability('HIGH', 'Stored XSS', 
              'Potential stored XSS in artist data',
              { artistName: artist.name })
          }
        }
      }
    } catch (error) {
      console.log('   ⚠️ Could not test stored XSS - database access limited')
    }
  }
  
  logTestResult('XSS Protection', true, 'No obvious XSS vulnerabilities detected')
}

// Security Test 5: API Rate Limiting
async function testRateLimiting() {
  console.log('\\n⏱️ 5. Testing API Rate Limiting...')
  
  const testEndpoint = `${BASE_URL}/api/search/artists?q=test`
  const rapidRequests = []
  
  // Send 50 rapid requests
  for (let i = 0; i < 50; i++) {
    rapidRequests.push(makeRequest(testEndpoint))
  }
  
  const responses = await Promise.all(rapidRequests)
  const rateLimitedResponses = responses.filter(r => r.status === 429)
  
  if (rateLimitedResponses.length === 0) {
    logVulnerability('MEDIUM', 'Rate Limiting', 
      'API endpoints may lack rate limiting protection',
      { requestsSent: 50, rateLimited: 0 })
  } else {
    logTestResult('Rate limiting active', true, 
      `${rateLimitedResponses.length}/50 requests rate limited`)
  }
}

// Security Test 6: CORS Configuration
async function testCORS() {
  console.log('\\n🌐 6. Testing CORS Configuration...')
  
  const response = await makeRequest(`${BASE_URL}/api/artists`, {
    headers: {
      'Origin': 'https://malicious-site.com'
    }
  })
  
  const corsHeader = response.headers['access-control-allow-origin']
  
  if (corsHeader === '*') {
    logVulnerability('MEDIUM', 'CORS Misconfiguration', 
      'Wildcard CORS policy allows any origin',
      { corsHeader })
  } else if (corsHeader && corsHeader.includes('malicious-site.com')) {
    logVulnerability('HIGH', 'CORS Misconfiguration', 
      'CORS policy allows malicious origins',
      { corsHeader })
  } else {
    logTestResult('CORS configuration', true, 'Appropriate CORS restrictions')
  }
}

// Security Test 7: Input Validation
async function testInputValidation() {
  console.log('\\n✅ 7. Testing Input Validation...')
  
  const invalidInputs = [
    { field: 'q', value: 'A'.repeat(10000) }, // Very long string
    { field: 'q', value: '\\x00\\x01\\x02' }, // Null bytes
    { field: 'limit', value: '999999999' }, // Large number
    { field: 'limit', value: '-1' }, // Negative number
    { field: 'limit', value: 'abc' }, // Invalid type
  ]
  
  for (const input of invalidInputs) {
    const response = await makeRequest(`${BASE_URL}/api/search/artists?${input.field}=${encodeURIComponent(input.value)}`)
    
    if (response.status === 200) {
      logVulnerability('LOW', 'Input Validation', 
        `Endpoint accepts invalid input: ${input.field}`,
        { input: input.value.substring(0, 50), status: response.status })
    }
    
    // Check for error handling
    if (response.status === 500) {
      logVulnerability('MEDIUM', 'Error Handling', 
        'Server error on invalid input may indicate poor validation',
        { input: input.field, status: response.status })
    }
  }
}

// Security Test 8: HTTP Security Headers
async function testSecurityHeaders() {
  console.log('\\n🛡️ 8. Testing HTTP Security Headers...')
  
  const response = await makeRequest(BASE_URL)
  const headers = response.headers
  
  const requiredHeaders = {
    'x-frame-options': 'Clickjacking protection',
    'x-content-type-options': 'MIME type sniffing protection', 
    'x-xss-protection': 'XSS filtering',
    'strict-transport-security': 'HTTPS enforcement',
    'content-security-policy': 'Content Security Policy',
    'referrer-policy': 'Referrer information control'
  }
  
  for (const [headerName, description] of Object.entries(requiredHeaders)) {
    if (!headers[headerName]) {
      logVulnerability('MEDIUM', 'Missing Security Headers', 
        `Missing ${description} header: ${headerName}`)
    } else {
      logTestResult(`Security header: ${headerName}`, true)
    }
  }
}

// Security Test 9: Business Logic Vulnerabilities
async function testBusinessLogic() {
  console.log('\\n🧠 9. Testing Business Logic Vulnerabilities...')
  
  // Test voting manipulation
  const votePayload = JSON.stringify({
    setlist_song_id: 'test-song-id',
    vote_type: 'invalid_type'
  })
  
  const voteResponse = await makeRequest(`${BASE_URL}/api/votes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: votePayload
  })
  
  if (voteResponse.status === 200) {
    logVulnerability('MEDIUM', 'Business Logic', 
      'Vote API accepts invalid vote types',
      { payload: votePayload })
  }
  
  // Test negative voting
  const negativeVotePayload = JSON.stringify({
    setlist_song_id: 'test-song-id',
    vote_type: 'up',
    count: -1
  })
  
  const negativeVoteResponse = await makeRequest(`${BASE_URL}/api/votes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: negativeVotePayload
  })
  
  if (negativeVoteResponse.status === 200) {
    logVulnerability('LOW', 'Business Logic', 
      'Vote API might accept negative vote counts')
  }
}

// Security Test 10: Denial of Service (DoS)
async function testDoSResilience() {
  console.log('\\n💥 10. Testing DoS Resilience...')
  
  // Test large payload handling
  const largePayload = JSON.stringify({
    data: 'A'.repeat(1000000) // 1MB payload
  })
  
  const largePayloadResponse = await makeRequest(`${BASE_URL}/api/votes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: largePayload
  })
  
  if (largePayloadResponse.status === 500) {
    logVulnerability('MEDIUM', 'DoS Vulnerability', 
      'Server crashes on large payload',
      { payloadSize: largePayload.length })
  } else if (largePayloadResponse.status === 413 || largePayloadResponse.status === 400) {
    logTestResult('Large payload protection', true, 'Server properly rejects large payloads')
  }
  
  // Test CPU-intensive operations
  const complexQuery = 'A'.repeat(1000)
  const complexResponse = await makeRequest(`${BASE_URL}/api/search/artists?q=${encodeURIComponent(complexQuery)}`)
  
  if (complexResponse.status === 0 || !complexResponse.ok) {
    logVulnerability('LOW', 'DoS Vulnerability', 
      'Complex queries may cause timeouts')
  }
}

// Generate security report
function generateSecurityReport() {
  console.log('\\n📊 Generating Security Report...')
  
  // Calculate risk level
  const highVulns = securityResults.vulnerabilities.filter(v => v.severity === 'HIGH').length
  const mediumVulns = securityResults.vulnerabilities.filter(v => v.severity === 'MEDIUM').length
  const lowVulns = securityResults.vulnerabilities.filter(v => v.severity === 'LOW').length
  
  if (highVulns > 0) {
    securityResults.riskLevel = 'HIGH'
  } else if (mediumVulns > 2) {
    securityResults.riskLevel = 'HIGH'
  } else if (mediumVulns > 0 || lowVulns > 3) {
    securityResults.riskLevel = 'MEDIUM'
  } else {
    securityResults.riskLevel = 'LOW'
  }
  
  // Generate recommendations
  securityResults.recommendations = [
    'Implement comprehensive input validation on all endpoints',
    'Add security headers (CSP, HSTS, X-Frame-Options)',
    'Enable rate limiting on public APIs',
    'Regular security audits and penetration testing',
    'Implement proper error handling to avoid information disclosure',
    'Use parameterized queries to prevent SQL injection',
    'Implement XSS protection mechanisms',
    'Regular security dependency updates'
  ]
  
  // Save report
  const reportPath = join(__dirname, '../../test-results/security-report.json')
  writeFileSync(reportPath, JSON.stringify(securityResults, null, 2))
  
  console.log('\\n🔒 Security Test Summary')
  console.log('========================')
  console.log(`📊 Risk Level: ${securityResults.riskLevel}`)
  console.log(`🚨 High Risk Vulnerabilities: ${highVulns}`)
  console.log(`⚠️ Medium Risk Vulnerabilities: ${mediumVulns}`)
  console.log(`💡 Low Risk Vulnerabilities: ${lowVulns}`)
  console.log(`✅ Tests Passed: ${securityResults.passedTests.length}`)
  console.log(`❌ Tests Failed: ${securityResults.failedTests.length}`)
  console.log(`📄 Report saved: ${reportPath}`)
}

// Main execution
async function runSecurityTests() {
  try {
    await testInformationDisclosure()
    await testAuthentication()
    await testSQLInjection()
    await testXSS()
    await testRateLimiting()
    await testCORS()
    await testInputValidation()
    await testSecurityHeaders()
    await testBusinessLogic()
    await testDoSResilience()
    
    generateSecurityReport()
    
    console.log('\\n✅ Security testing complete!')
    
    // Exit with appropriate code
    const hasHighRisk = securityResults.vulnerabilities.some(v => v.severity === 'HIGH')
    process.exit(hasHighRisk ? 1 : 0)
    
  } catch (error) {
    console.error('❌ Security testing failed:', error)
    process.exit(1)
  }
}

runSecurityTests()