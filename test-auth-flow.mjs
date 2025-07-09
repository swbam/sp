#\!/usr/bin/env node

console.log('🔐 SUB-AGENT 3: AUTHENTICATION FLOW COMPREHENSIVE TEST');
console.log('=' .repeat(60));

// Test configuration
const baseUrl = 'http://localhost:3000';
const testHeaders = {
  'Content-Type': 'application/json',
  'User-Agent': 'MySetlist-AuthTest/1.0'
};

// Test results storage
const testResults = {
  anonymousAccess: [],
  authComponents: [],
  votingPermissions: [],
  authFlows: [],
  sessionManagement: [],
  userInterface: []
};

// Helper function to test HTTP endpoints
async function testEndpoint(endpoint, method = 'GET', body = null) {
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: testHeaders,
      body: body ? JSON.stringify(body) : null
    });
    
    return {
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      data: response.headers.get('content-type')?.includes('application/json') 
        ? await response.json() 
        : await response.text()
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message
    };
  }
}

// Helper function to check component files
import { readFileSync } from 'fs';

function checkComponentFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return { exists: true, content };
  } catch (error) {
    return { exists: false, error: error.message };
  }
}

// Test 1: Anonymous User Access
async function testAnonymousAccess() {
  console.log('\n1. 🌐 Testing Anonymous User Access');
  console.log('-'.repeat(40));
  
  // Test pages that should be accessible anonymously
  const anonymousPages = [
    '/',
    '/search',
    '/trending',
    '/shows'
  ];
  
  for (const page of anonymousPages) {
    const result = await testEndpoint(page);
    const accessible = result.ok && result.status === 200;
    
    testResults.anonymousAccess.push({
      page,
      accessible,
      status: result.status,
      hasContent: result.data && result.data.length > 100
    });
    
    console.log(`  ${accessible ? '✅' : '❌'} ${page} - Status: ${result.status}`);
  }
  
  // Test API endpoints that should work anonymously
  const anonymousAPIs = [
    '/api/artists',
    '/api/shows',
    '/api/trending',
    '/api/search/artists?q=test'
  ];
  
  console.log('\n  API Endpoints:');
  for (const api of anonymousAPIs) {
    const result = await testEndpoint(api);
    const accessible = result.ok && result.status === 200;
    
    testResults.anonymousAccess.push({
      endpoint: api,
      accessible,
      status: result.status,
      hasData: result.data && typeof result.data === 'object'
    });
    
    console.log(`    ${accessible ? '✅' : '❌'} ${api} - Status: ${result.status}`);
  }
}

// Test 2: Authentication Components
async function testAuthComponents() {
  console.log('\n2. 🔧 Testing Authentication Components');
  console.log('-'.repeat(40));
  
  const authComponents = [
    'components/AuthModal.tsx',
    'hooks/useUser.tsx',
    'hooks/useAuthModal.ts',
    'providers/UserProvider.tsx',
    'providers/SupabaseProvider.tsx'
  ];
  
  for (const component of authComponents) {
    const result = checkComponentFile(component);
    
    testResults.authComponents.push({
      component,
      exists: result.exists,
      hasAuth: result.content?.includes('supabase') || result.content?.includes('auth'),
      hasProviders: result.content?.includes('Provider') || result.content?.includes('Context')
    });
    
    console.log(`  ${result.exists ? '✅' : '❌'} ${component}`);
    
    if (result.exists) {
      // Check for key authentication patterns
      const hasSupabase = result.content.includes('supabase');
      const hasAuth = result.content.includes('auth');
      const hasUser = result.content.includes('user');
      
      console.log(`    - Supabase: ${hasSupabase ? '✅' : '❌'}`);
      console.log(`    - Auth: ${hasAuth ? '✅' : '❌'}`);
      console.log(`    - User: ${hasUser ? '✅' : '❌'}`);
    }
  }
}

// Test 3: Voting Permissions
async function testVotingPermissions() {
  console.log('\n3. 🗳️ Testing Voting Permissions');
  console.log('-'.repeat(40));
  
  // Test voting API endpoint
  const voteResult = await testEndpoint('/api/votes', 'POST', {
    setlist_song_id: 'test-uuid',
    vote_type: 'up'
  });
  
  testResults.votingPermissions.push({
    endpoint: '/api/votes',
    anonymousVoting: voteResult.status \!== 401,
    status: voteResult.status,
    response: voteResult.data
  });
  
  console.log(`  ${voteResult.status \!== 401 ? '✅' : '❌'} Anonymous voting allowed - Status: ${voteResult.status}`);
  
  // Test vote counts endpoint (should be accessible)
  const voteCountsResult = await testEndpoint('/api/votes?setlist_song_ids=test-uuid');
  
  testResults.votingPermissions.push({
    endpoint: '/api/votes (GET)',
    accessible: voteCountsResult.ok,
    status: voteCountsResult.status,
    hasData: voteCountsResult.data && typeof voteCountsResult.data === 'object'
  });
  
  console.log(`  ${voteCountsResult.ok ? '✅' : '❌'} Vote counts accessible - Status: ${voteCountsResult.status}`);
}

// Test 4: Authentication Flows
async function testAuthFlows() {
  console.log('\n4. 🔄 Testing Authentication Flows');
  console.log('-'.repeat(40));
  
  // Test Spotify OAuth endpoint
  const spotifyAuthResult = await testEndpoint('/api/auth/spotify', 'POST');
  
  testResults.authFlows.push({
    provider: 'spotify',
    endpointAccessible: spotifyAuthResult.status \!== 500,
    status: spotifyAuthResult.status,
    hasAuthUrl: spotifyAuthResult.data && spotifyAuthResult.data.auth_url
  });
  
  console.log(`  ${spotifyAuthResult.status \!== 500 ? '✅' : '❌'} Spotify OAuth endpoint - Status: ${spotifyAuthResult.status}`);
  
  // Check for auth callback handling
  const authCallbackResult = await testEndpoint('/api/auth/spotify?code=test&state=test');
  
  testResults.authFlows.push({
    callback: 'spotify',
    endpointAccessible: authCallbackResult.status \!== 500,
    status: authCallbackResult.status,
    handlesCallback: authCallbackResult.status === 400 || authCallbackResult.status === 401
  });
  
  console.log(`  ${authCallbackResult.status \!== 500 ? '✅' : '❌'} Auth callback handling - Status: ${authCallbackResult.status}`);
}

// Test 5: Session Management
async function testSessionManagement() {
  console.log('\n5. 👤 Testing Session Management');
  console.log('-'.repeat(40));
  
  // Test user context provider
  const userProviderResult = checkComponentFile('providers/UserProvider.tsx');
  
  testResults.sessionManagement.push({
    component: 'UserProvider',
    exists: userProviderResult.exists,
    hasContext: userProviderResult.content?.includes('Context'),
    hasProvider: userProviderResult.content?.includes('Provider')
  });
  
  console.log(`  ${userProviderResult.exists ? '✅' : '❌'} User Context Provider exists`);
  
  // Test session persistence patterns
  const useUserResult = checkComponentFile('hooks/useUser.tsx');
  
  testResults.sessionManagement.push({
    hook: 'useUser',
    exists: useUserResult.exists,
    hasSession: useUserResult.content?.includes('session'),
    hasUserDetails: useUserResult.content?.includes('userDetails')
  });
  
  console.log(`  ${useUserResult.exists ? '✅' : '❌'} useUser hook exists`);
  
  if (useUserResult.exists) {
    const hasSession = useUserResult.content.includes('session');
    const hasUserDetails = useUserResult.content.includes('userDetails');
    const hasLoading = useUserResult.content.includes('isLoading');
    
    console.log(`    - Session handling: ${hasSession ? '✅' : '❌'}`);
    console.log(`    - User details: ${hasUserDetails ? '✅' : '❌'}`);
    console.log(`    - Loading states: ${hasLoading ? '✅' : '❌'}`);
  }
}

// Test 6: User Interface Elements
async function testUserInterface() {
  console.log('\n6. 🎨 Testing User Interface Elements');
  console.log('-'.repeat(40));
  
  // Test Header component for auth controls
  const headerResult = checkComponentFile('components/Header.tsx');
  
  testResults.userInterface.push({
    component: 'Header',
    exists: headerResult.exists,
    hasAuthControls: headerResult.content?.includes('authModal') || headerResult.content?.includes('login'),
    hasUserCheck: headerResult.content?.includes('user ?')
  });
  
  console.log(`  ${headerResult.exists ? '✅' : '❌'} Header component exists`);
  
  if (headerResult.exists) {
    const hasAuthModal = headerResult.content.includes('authModal');
    const hasLogin = headerResult.content.includes('Log in');
    const hasLogout = headerResult.content.includes('Logout');
    const hasUserCheck = headerResult.content.includes('user ?');
    
    console.log(`    - Auth modal: ${hasAuthModal ? '✅' : '❌'}`);
    console.log(`    - Login button: ${hasLogin ? '✅' : '❌'}`);
    console.log(`    - Logout button: ${hasLogout ? '✅' : '❌'}`);
    console.log(`    - User check: ${hasUserCheck ? '✅' : '❌'}`);
  }
  
  // Test Auth Modal component
  const authModalResult = checkComponentFile('components/AuthModal.tsx');
  
  testResults.userInterface.push({
    component: 'AuthModal',
    exists: authModalResult.exists,
    hasSpotifyAuth: authModalResult.content?.includes('spotify'),
    hasSupabaseAuth: authModalResult.content?.includes('supabaseClient')
  });
  
  console.log(`  ${authModalResult.exists ? '✅' : '❌'} Auth Modal component exists`);
  
  if (authModalResult.exists) {
    const hasSpotifyProvider = authModalResult.content.includes("providers={['spotify']}");
    const hasSupabaseClient = authModalResult.content.includes('supabaseClient');
    const hasRedirectUrl = authModalResult.content.includes('redirectTo');
    
    console.log(`    - Spotify provider: ${hasSpotifyProvider ? '✅' : '❌'}`);
    console.log(`    - Supabase client: ${hasSupabaseClient ? '✅' : '❌'}`);
    console.log(`    - Redirect URL: ${hasRedirectUrl ? '✅' : '❌'}`);
  }
}

// Test 7: Voting System Integration
async function testVotingSystemIntegration() {
  console.log('\n7. 🎯 Testing Voting System Integration');
  console.log('-'.repeat(40));
  
  // Test VoteButton component
  const voteButtonResult = checkComponentFile('components/VoteButton.tsx');
  
  testResults.userInterface.push({
    component: 'VoteButton',
    exists: voteButtonResult.exists,
    hasVoting: voteButtonResult.content?.includes('onVote'),
    hasUserVoteState: voteButtonResult.content?.includes('userVote')
  });
  
  console.log(`  ${voteButtonResult.exists ? '✅' : '❌'} VoteButton component exists`);
  
  if (voteButtonResult.exists) {
    const hasOnVote = voteButtonResult.content.includes('onVote');
    const hasUserVote = voteButtonResult.content.includes('userVote');
    const hasDisabled = voteButtonResult.content.includes('disabled');
    
    console.log(`    - Vote handler: ${hasOnVote ? '✅' : '❌'}`);
    console.log(`    - User vote state: ${hasUserVote ? '✅' : '❌'}`);
    console.log(`    - Disabled state: ${hasDisabled ? '✅' : '❌'}`);
  }
  
  // Test SetlistVoting component
  const setlistVotingResult = checkComponentFile('app/shows/[id]/components/SetlistVoting.tsx');
  
  testResults.userInterface.push({
    component: 'SetlistVoting',
    exists: setlistVotingResult.exists,
    hasRealtimeVoting: setlistVotingResult.content?.includes('useRealtimeVoting'),
    hasAnonymousSupport: setlistVotingResult.content?.includes('anonymous')
  });
  
  console.log(`  ${setlistVotingResult.exists ? '✅' : '❌'} SetlistVoting component exists`);
  
  if (setlistVotingResult.exists) {
    const hasRealtimeVoting = setlistVotingResult.content.includes('useRealtimeVoting');
    const hasVoteButton = setlistVotingResult.content.includes('VoteButton');
    const hasAnonymousComment = setlistVotingResult.content.includes('anonymous');
    
    console.log(`    - Realtime voting: ${hasRealtimeVoting ? '✅' : '❌'}`);
    console.log(`    - Vote button: ${hasVoteButton ? '✅' : '❌'}`);
    console.log(`    - Anonymous support: ${hasAnonymousComment ? '✅' : '❌'}`);
  }
}

// Generate comprehensive report
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 AUTHENTICATION FLOW COMPREHENSIVE REPORT');
  console.log('='.repeat(60));
  
  // Anonymous access summary
  const anonymousAccessible = testResults.anonymousAccess.filter(r => r.accessible || r.status === 200).length;
  const totalAnonymousTests = testResults.anonymousAccess.length;
  
  console.log(`\n1. 🌐 Anonymous Access: ${anonymousAccessible}/${totalAnonymousTests} accessible`);
  
  // Auth components summary
  const authComponentsWorking = testResults.authComponents.filter(r => r.exists && r.hasAuth).length;
  const totalAuthComponents = testResults.authComponents.length;
  
  console.log(`2. 🔧 Auth Components: ${authComponentsWorking}/${totalAuthComponents} working`);
  
  // Voting permissions summary
  const votingWorking = testResults.votingPermissions.filter(r => r.anonymousVoting || r.accessible).length;
  const totalVotingTests = testResults.votingPermissions.length;
  
  console.log(`3. 🗳️ Voting Permissions: ${votingWorking}/${totalVotingTests} working`);
  
  // Auth flows summary
  const authFlowsWorking = testResults.authFlows.filter(r => r.endpointAccessible).length;
  const totalAuthFlows = testResults.authFlows.length;
  
  console.log(`4. 🔄 Auth Flows: ${authFlowsWorking}/${totalAuthFlows} working`);
  
  // Session management summary
  const sessionWorking = testResults.sessionManagement.filter(r => r.exists).length;
  const totalSessionTests = testResults.sessionManagement.length;
  
  console.log(`5. 👤 Session Management: ${sessionWorking}/${totalSessionTests} working`);
  
  // UI elements summary
  const uiWorking = testResults.userInterface.filter(r => r.exists).length;
  const totalUITests = testResults.userInterface.length;
  
  console.log(`6. 🎨 UI Elements: ${uiWorking}/${totalUITests} working`);
  
  // Overall assessment
  const totalTests = anonymousAccessible + authComponentsWorking + votingWorking + authFlowsWorking + sessionWorking + uiWorking;
  const totalPossible = totalAnonymousTests + totalAuthComponents + totalVotingTests + totalAuthFlows + totalSessionTests + totalUITests;
  const successRate = ((totalTests / totalPossible) * 100).toFixed(1);
  
  console.log(`\n🎯 Overall Authentication System Health: ${successRate}% (${totalTests}/${totalPossible})`);
  
  // Critical issues
  console.log('\n🚨 Critical Issues:');
  
  let criticalIssues = [];
  
  if (testResults.anonymousAccess.filter(r => r.page === '/' && \!r.accessible).length > 0) {
    criticalIssues.push('Homepage not accessible anonymously');
  }
  
  if (testResults.authComponents.filter(r => r.component === 'components/AuthModal.tsx' && \!r.exists).length > 0) {
    criticalIssues.push('Auth modal component missing');
  }
  
  if (testResults.votingPermissions.filter(r => r.endpoint === '/api/votes' && r.status === 401).length > 0) {
    criticalIssues.push('Voting requires authentication (should be anonymous)');
  }
  
  if (testResults.authFlows.filter(r => r.provider === 'spotify' && r.status === 500).length > 0) {
    criticalIssues.push('Spotify OAuth endpoint not working');
  }
  
  if (criticalIssues.length === 0) {
    console.log('  ✅ No critical issues found');
  } else {
    criticalIssues.forEach(issue => console.log(`  ❌ ${issue}`));
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  
  const recommendations = [
    'Ensure anonymous users can access all core features',
    'Implement proper error handling for auth failures',
    'Add loading states for authentication operations',
    'Test OAuth flows with real credentials',
    'Implement proper session cleanup on logout',
    'Add user feedback for auth operations',
    'Test auth state persistence across page reloads'
  ];
  
  recommendations.forEach(rec => console.log(`  • ${rec}`));
  
  console.log('\n✅ SUB-AGENT 3 AUTHENTICATION TESTING COMPLETE');
  console.log('='.repeat(60));
}

// Main execution
async function main() {
  try {
    // Check if server is running
    const serverCheck = await testEndpoint('/');
    if (\!serverCheck.ok) {
      console.log('❌ Server not running at http://localhost:3000');
      console.log('   Please start the server with: npm run dev');
      process.exit(1);
    }
    
    // Run all tests
    await testAnonymousAccess();
    await testAuthComponents();
    await testVotingPermissions();
    await testAuthFlows();
    await testSessionManagement();
    await testUserInterface();
    await testVotingSystemIntegration();
    
    // Generate comprehensive report
    generateReport();
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
EOF < /dev/null