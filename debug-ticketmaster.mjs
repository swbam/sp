#!/usr/bin/env node

/**
 * Debug Ticketmaster API
 */

import { readFileSync } from 'fs';

// Load environment variables manually
const envContent = readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

async function testTicketmaster() {
  const apiKey = envVars.TICKETMASTER_API_KEY;
  console.log('🔧 API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'Missing');
  
  const baseUrl = 'https://app.ticketmaster.com/discovery/v2';
  
  // Test basic API access
  const params = new URLSearchParams({
    apikey: apiKey,
    size: '5'
  });

  try {
    console.log('🔍 Testing basic Ticketmaster API access...');
    console.log('URL:', `${baseUrl}/events.json?${params}`);
    
    const response = await fetch(`${baseUrl}/events.json?${params}`);
    
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    const text = await response.text();
    console.log('Response:', text.substring(0, 500));
    
    if (response.ok) {
      const data = JSON.parse(text);
      console.log('✅ API call successful');
      console.log('Events found:', data._embedded?.events?.length || 0);
    } else {
      console.log('❌ API call failed');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testTicketmaster();