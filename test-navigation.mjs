#!/usr/bin/env node

/**
 * Navigation System Test Script
 * Tests all navigation paths and error handling
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TIMEOUT = 30000;

// Navigation test cases
const testCases = [
  {
    name: 'Homepage',
    path: '/',
    description: 'Main homepage with hero search',
    expectedElements: ['hero', 'search']
  },
  {
    name: 'Search Page',
    path: '/search',
    description: 'Artist search functionality',
    expectedElements: ['search', 'artists']
  },
  {
    name: 'Shows Page',
    path: '/shows',
    description: 'Upcoming shows listing',
    expectedElements: ['shows', 'upcoming']
  },
  {
    name: 'Account Page',
    path: '/account',
    description: 'User account management',
    expectedElements: ['account', 'profile']
  },
  {
    name: 'Invalid Route',
    path: '/invalid-route-test',
    description: 'Test 404 not found handling',
    expectedElements: ['not-found', '404']
  }
];

// Helper function to test a URL
async function testUrl(url) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      timeout: TIMEOUT
    });
    
    return {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    };
  } catch (error) {
    return {
      status: 0,
      statusText: error.message,
      ok: false,
      error: error.message
    };
  }
}

// Test navigation links
async function testNavigation() {
  console.log('🧪 Testing Navigation System...\n');
  
  const results = [];
  
  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    console.log(`URL: ${BASE_URL}${testCase.path}`);
    console.log(`Description: ${testCase.description}`);
    
    const result = await testUrl(`${BASE_URL}${testCase.path}`);
    
    console.log(`Status: ${result.status} ${result.statusText}`);
    console.log(`Success: ${result.ok ? '✅' : '❌'}`);
    
    if (result.error) {
      console.log(`Error: ${result.error}`);
    }
    
    results.push({
      ...testCase,
      ...result
    });
    
    console.log('-'.repeat(50));
  }
  
  return results;
}

// Test component existence
async function testComponents() {
  console.log('\n🔍 Testing Navigation Components...\n');
  
  const componentTests = [
    {
      name: 'ErrorBoundary',
      path: './components/ErrorBoundary.tsx',
      description: 'Global error boundary component'
    },
    {
      name: 'SafeNavigation',
      path: './components/SafeNavigation.tsx',
      description: 'Safe navigation utilities'
    },
    {
      name: 'Sidebar',
      path: './components/Sidebar.tsx',
      description: 'Main sidebar navigation'
    },
    {
      name: 'Header',
      path: './components/Header.tsx',
      description: 'Page header with navigation'
    },
    {
      name: 'Not Found',
      path: './app/not-found.tsx',
      description: 'Custom 404 page'
    }
  ];
  
  const results = [];
  
  for (const component of componentTests) {
    const exists = fs.existsSync(component.path);
    console.log(`${component.name}: ${exists ? '✅' : '❌'}`);
    console.log(`Path: ${component.path}`);
    console.log(`Description: ${component.description}`);
    
    if (exists) {
      const stats = fs.statSync(component.path);
      console.log(`Size: ${stats.size} bytes`);
      console.log(`Modified: ${stats.mtime.toISOString()}`);
    }
    
    results.push({
      ...component,
      exists,
      status: exists ? 'found' : 'missing'
    });
    
    console.log('-'.repeat(50));
  }
  
  return results;
}

// Test error pages
async function testErrorPages() {
  console.log('\n🚨 Testing Error Pages...\n');
  
  const errorPageTests = [
    {
      name: 'Homepage Error',
      path: './app/(site)/error.tsx',
      description: 'Homepage specific error boundary'
    },
    {
      name: 'Search Error',
      path: './app/search/error.tsx',
      description: 'Search page specific error boundary'
    },
    {
      name: 'Shows Error',
      path: './app/shows/error.tsx',
      description: 'Shows page specific error boundary'
    },
    {
      name: 'Artists Error',
      path: './app/artists/[slug]/error.tsx',
      description: 'Artist page specific error boundary'
    }
  ];
  
  const results = [];
  
  for (const errorPage of errorPageTests) {
    const exists = fs.existsSync(errorPage.path);
    console.log(`${errorPage.name}: ${exists ? '✅' : '❌'}`);
    console.log(`Path: ${errorPage.path}`);
    console.log(`Description: ${errorPage.description}`);
    
    results.push({
      ...errorPage,
      exists,
      status: exists ? 'found' : 'missing'
    });
    
    console.log('-'.repeat(50));
  }
  
  return results;
}

// Generate report
function generateReport(navigationResults, componentResults, errorPageResults) {
  console.log('\n📊 Navigation Test Report\n');
  console.log('=' .repeat(60));
  
  // Navigation summary
  const navPassed = navigationResults.filter(r => r.ok).length;
  const navTotal = navigationResults.length;
  console.log(`Navigation Routes: ${navPassed}/${navTotal} passed`);
  
  // Component summary
  const compPassed = componentResults.filter(r => r.exists).length;
  const compTotal = componentResults.length;
  console.log(`Navigation Components: ${compPassed}/${compTotal} found`);
  
  // Error page summary
  const errorPassed = errorPageResults.filter(r => r.exists).length;
  const errorTotal = errorPageResults.length;
  console.log(`Error Pages: ${errorPassed}/${errorTotal} found`);
  
  // Overall status
  const overallPassed = navPassed + compPassed + errorPassed;
  const overallTotal = navTotal + compTotal + errorTotal;
  const percentage = Math.round((overallPassed / overallTotal) * 100);
  
  console.log(`Overall Navigation Health: ${percentage}% (${overallPassed}/${overallTotal})`);
  
  if (percentage >= 90) {
    console.log('🎉 Navigation System: EXCELLENT');
  } else if (percentage >= 75) {
    console.log('✅ Navigation System: GOOD');
  } else if (percentage >= 50) {
    console.log('⚠️  Navigation System: NEEDS IMPROVEMENT');
  } else {
    console.log('❌ Navigation System: CRITICAL ISSUES');
  }
  
  console.log('=' .repeat(60));
  
  // Failed tests details
  const failedNavigation = navigationResults.filter(r => !r.ok);
  if (failedNavigation.length > 0) {
    console.log('\n❌ Failed Navigation Tests:');
    failedNavigation.forEach(test => {
      console.log(`  - ${test.name}: ${test.status} ${test.statusText}`);
    });
  }
  
  const missingComponents = componentResults.filter(r => !r.exists);
  if (missingComponents.length > 0) {
    console.log('\n❌ Missing Components:');
    missingComponents.forEach(comp => {
      console.log(`  - ${comp.name}: ${comp.path}`);
    });
  }
  
  const missingErrorPages = errorPageResults.filter(r => !r.exists);
  if (missingErrorPages.length > 0) {
    console.log('\n❌ Missing Error Pages:');
    missingErrorPages.forEach(page => {
      console.log(`  - ${page.name}: ${page.path}`);
    });
  }
}

// Main test execution
async function main() {
  console.log('🚀 MySetlist Navigation System Test\n');
  console.log('Testing navigation routes, components, and error handling...\n');
  
  try {
    // Check if dev server is running
    const devServerTest = await testUrl(BASE_URL);
    if (!devServerTest.ok) {
      console.log('❌ Development server is not running!');
      console.log('Please run: npm run dev');
      process.exit(1);
    }
    
    console.log('✅ Development server is running\n');
    
    // Run all tests
    const navigationResults = await testNavigation();
    const componentResults = await testComponents();
    const errorPageResults = await testErrorPages();
    
    // Generate report
    generateReport(navigationResults, componentResults, errorPageResults);
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);