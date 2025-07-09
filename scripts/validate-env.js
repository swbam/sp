#!/usr/bin/env node

/**
 * Environment Variables Validation Script
 * 
 * This script validates all required environment variables
 * and can be run during the build process or manually.
 * 
 * Usage:
 *   node scripts/validate-env.js
 *   npm run validate:env
 */

const fs = require('fs');
const path = require('path');

// Load environment variables based on NODE_ENV
const isDevelopment = process.env.NODE_ENV !== 'production';
const envFile = isDevelopment ? '.env.local' : '.env.production';
const envPath = path.join(__dirname, '..', envFile);

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Also load .env.local as fallback for any missing vars
const localEnvPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(localEnvPath) && envFile !== '.env.local') {
  require('dotenv').config({ path: localEnvPath });
}

// Define required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_APP_ENV',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'TICKETMASTER_API_KEY',
  'SETLISTFM_API_KEY',
  'JWT_SECRET',
  'CRON_SECRET'
];

// Define optional environment variables
const optionalEnvVars = [
  'NODE_ENV',
  'VERCEL_ANALYTICS_ID',
  'SENTRY_DSN',
  'GOOGLE_SITE_VERIFICATION'
];

// Validation functions
function validateUrl(value, name) {
  try {
    new URL(value);
    return true;
  } catch {
    console.error(`❌ Invalid URL for ${name}: ${value}`);
    return false;
  }
}

function validateJWT(value, name) {
  const jwtPattern = /^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
  if (!jwtPattern.test(value)) {
    console.error(`❌ Invalid JWT format for ${name}`);
    return false;
  }
  return true;
}

function validateSpotifyKey(value, name) {
  const spotifyPattern = /^[a-f0-9]{32}$/;
  if (!spotifyPattern.test(value)) {
    console.error(`❌ Invalid Spotify API key format for ${name}`);
    return false;
  }
  return true;
}

function validateApiKey(value, name) {
  if (value.length < 10) {
    console.error(`❌ API key too short for ${name} (minimum 10 characters)`);
    return false;
  }
  return true;
}

function validateEnvironment(value, name) {
  const validEnvs = ['development', 'staging', 'production'];
  if (!validEnvs.includes(value)) {
    console.error(`❌ Invalid environment for ${name}: ${value}. Must be one of: ${validEnvs.join(', ')}`);
    return false;
  }
  return true;
}

// Main validation function
function validateEnvironmentVariables() {
  console.log('🔍 Validating environment variables...\n');
  
  let hasErrors = false;
  const missing = [];
  const invalid = [];
  
  // Check required variables
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    
    if (!value) {
      missing.push(envVar);
      hasErrors = true;
      continue;
    }
    
    // Perform specific validations
    let isValid = true;
    
    switch (envVar) {
      case 'NEXT_PUBLIC_APP_URL':
      case 'NEXT_PUBLIC_SUPABASE_URL':
        isValid = validateUrl(value, envVar);
        break;
      case 'NEXT_PUBLIC_SUPABASE_ANON_KEY':
      case 'SUPABASE_SERVICE_ROLE_KEY':
        isValid = validateJWT(value, envVar);
        break;
      case 'SPOTIFY_CLIENT_ID':
      case 'SPOTIFY_CLIENT_SECRET':
        isValid = validateSpotifyKey(value, envVar);
        break;
      case 'TICKETMASTER_API_KEY':
      case 'SETLISTFM_API_KEY':
        isValid = validateApiKey(value, envVar);
        break;
      case 'NEXT_PUBLIC_APP_ENV':
        isValid = validateEnvironment(value, envVar);
        break;
      case 'JWT_SECRET':
        isValid = value.length >= 32;
        if (!isValid) {
          console.error(`❌ JWT_SECRET must be at least 32 characters long`);
        }
        break;
      case 'CRON_SECRET':
        isValid = value.length >= 10;
        if (!isValid) {
          console.error(`❌ CRON_SECRET must be at least 10 characters long`);
        }
        break;
    }
    
    if (!isValid) {
      invalid.push(envVar);
      hasErrors = true;
    }
  }
  
  // Report results
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(name => console.error(`  - ${name}`));
    console.error('');
  }
  
  if (invalid.length > 0) {
    console.error('❌ Invalid environment variables:');
    invalid.forEach(name => console.error(`  - ${name}`));
    console.error('');
  }
  
  // Check optional variables
  const missingOptional = [];
  for (const envVar of optionalEnvVars) {
    if (!process.env[envVar]) {
      missingOptional.push(envVar);
    }
  }
  
  if (missingOptional.length > 0) {
    console.warn('⚠️  Optional environment variables not set:');
    missingOptional.forEach(name => console.warn(`  - ${name}`));
    console.warn('');
  }
  
  // Environment-specific checks
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  
  if (appEnv === 'production' && appUrl && appUrl.includes('localhost')) {
    console.error('❌ Production environment should not use localhost URL');
    hasErrors = true;
  }
  
  if (appEnv === 'development' && appUrl && !appUrl.includes('localhost')) {
    console.warn('⚠️  Development environment typically uses localhost URL');
  }
  
  // Final result
  if (hasErrors) {
    console.error('❌ Environment validation failed!');
    console.error('');
    console.error('💡 Tips:');
    console.error('  - Check your .env.local file');
    console.error('  - Verify all API keys are correct');
    console.error('  - See VERCEL_ENV_TEMPLATE.md for configuration help');
    console.error('');
    return false;
  }
  
  console.log('✅ All environment variables are valid!');
  console.log('');
  console.log('📊 Summary:');
  console.log(`  - Required variables: ${requiredEnvVars.length}/${requiredEnvVars.length} ✅`);
  console.log(`  - Optional variables: ${optionalEnvVars.length - missingOptional.length}/${optionalEnvVars.length} set`);
  console.log(`  - Environment: ${appEnv}`);
  console.log(`  - App URL: ${appUrl}`);
  console.log('');
  
  return true;
}

// Run validation
if (require.main === module) {
  const isValid = validateEnvironmentVariables();
  process.exit(isValid ? 0 : 1);
}

module.exports = { validateEnvironmentVariables };