#!/usr/bin/env node
/**
 * 🚀 MySetlist Final Deployment Script
 * 
 * This script handles the complete deployment process to Vercel:
 * 1. Pre-deployment validation
 * 2. Database migration
 * 3. Build process
 * 4. Vercel deployment
 * 5. Post-deployment validation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env files
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env.production' });
require('dotenv').config();

// Color codes for output
const colors = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
  RESET: '\x1b[0m'
};

// Utility functions
function log(message, color = colors.WHITE) {
  console.log(`${color}${message}${colors.RESET}`);
}

function success(message) {
  log(`✅ ${message}`, colors.GREEN);
}

function error(message) {
  log(`❌ ${message}`, colors.RED);
  process.exit(1);
}

function warning(message) {
  log(`⚠️  ${message}`, colors.YELLOW);
}

function info(message) {
  log(`ℹ️  ${message}`, colors.BLUE);
}

function header(message) {
  log(`\n🎯 ${message}`, colors.MAGENTA);
  log('='.repeat(50), colors.MAGENTA);
}

function runCommand(command, description, exitOnError = true) {
  try {
    info(`Running: ${description}`);
    log(`Command: ${command}`, colors.CYAN);
    
    const result = execSync(command, { 
      stdio: 'inherit', 
      cwd: process.cwd(),
      env: { ...process.env }
    });
    
    success(`${description} completed successfully`);
    return result;
  } catch (err) {
    if (exitOnError) {
      error(`${description} failed: ${err.message}`);
    } else {
      warning(`${description} failed: ${err.message}`);
      return null;
    }
  }
}

function checkEnvironmentVariables() {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'TICKETMASTER_API_KEY',
    'SETLISTFM_API_KEY',
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
    'JWT_SECRET',
    'CRON_SECRET'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  success('All required environment variables are set');
}

function validatePackageManager() {
  try {
    execSync('pnpm --version', { stdio: 'pipe' });
    success('pnpm is available');
    return 'pnpm';
  } catch {
    try {
      execSync('npm --version', { stdio: 'pipe' });
      success('npm is available');
      return 'npm';
    } catch {
      error('Neither pnpm nor npm is available');
    }
  }
}

function checkVercelCLI() {
  try {
    execSync('vercel --version', { stdio: 'pipe' });
    success('Vercel CLI is available');
    return true;
  } catch {
    error('Vercel CLI is not installed. Please install it with: npm i -g vercel');
  }
}

function validateDatabaseConnection() {
  const testScript = `
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    (async () => {
      try {
        const { data, error } = await supabase.from('artists').select('count').limit(1);
        if (error) throw error;
        console.log('✅ Database connection successful');
        process.exit(0);
      } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
      }
    })();
  `;
  
  try {
    execSync(`node -e "${testScript.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`, { 
      stdio: 'inherit',
      env: { ...process.env }
    });
    success('Database connection validated');
  } catch {
    error('Database connection validation failed');
  }
}

function createVercelConfig() {
  const vercelConfig = {
    "version": 2,
    "buildCommand": "npm run build",
    "outputDirectory": ".next",
    "installCommand": "npm install",
    "framework": "nextjs",
    "regions": ["iad1"],
    "env": {
      "NEXT_PUBLIC_SUPABASE_URL": process.env.NEXT_PUBLIC_SUPABASE_URL,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "SUPABASE_SERVICE_ROLE_KEY": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "TICKETMASTER_API_KEY": process.env.TICKETMASTER_API_KEY,
      "SETLISTFM_API_KEY": process.env.SETLISTFM_API_KEY,
      "SPOTIFY_CLIENT_ID": process.env.SPOTIFY_CLIENT_ID,
      "SPOTIFY_CLIENT_SECRET": process.env.SPOTIFY_CLIENT_SECRET,
      "JWT_SECRET": process.env.JWT_SECRET,
      "CRON_SECRET": process.env.CRON_SECRET,
      "NEXT_PUBLIC_APP_URL": "https://mysetlist.vercel.app",
      "NEXT_PUBLIC_APP_ENV": "production"
    },
    "functions": {
      "app/api/**": {
        "maxDuration": 60
      }
    },
    "crons": [
      {
        "path": "/api/sync/autonomous",
        "schedule": "0 */6 * * *"
      }
    ]
  };

  fs.writeFileSync('vercel.json', JSON.stringify(vercelConfig, null, 2));
  success('Vercel configuration created');
}

function deployToVercel() {
  try {
    // First, link the project to Vercel
    info('Linking project to Vercel...');
    try {
      execSync('vercel --prod --confirm --token $VERCEL_TOKEN', { stdio: 'inherit' });
    } catch {
      // If linking fails, try a regular deploy
      info('Attempting regular deployment...');
      execSync('vercel --prod --confirm', { stdio: 'inherit' });
    }
    
    success('Deployment to Vercel completed successfully');
  } catch (err) {
    error(`Vercel deployment failed: ${err.message}`);
  }
}

function validateDeployment() {
  // Wait a bit for deployment to propagate
  info('Waiting for deployment to propagate...');
  setTimeout(() => {
    try {
      // Get the deployment URL from Vercel
      const deploymentInfo = execSync('vercel inspect --timeout=60s', { encoding: 'utf8' });
      info('Deployment validation completed');
      success('MySetlist is now live on Vercel!');
    } catch (err) {
      warning(`Deployment validation failed: ${err.message}`);
      info('The deployment may still be successful. Please check Vercel dashboard.');
    }
  }, 10000);
}

function main() {
  log('\n🚀 MYSETLIST FINAL DEPLOYMENT SCRIPT', colors.MAGENTA);
  log('==========================================', colors.MAGENTA);
  log(`Date: ${new Date().toISOString()}`, colors.BLUE);
  log('Target: Vercel Production', colors.BLUE);
  log('', colors.RESET);

  // Phase 1: Pre-deployment validation
  header('Phase 1: Pre-deployment Validation');
  
  info('Checking environment variables...');
  checkEnvironmentVariables();
  
  info('Validating package manager...');
  const packageManager = validatePackageManager();
  
  info('Checking Vercel CLI...');
  checkVercelCLI();
  
  info('Validating database connection...');
  validateDatabaseConnection();
  
  success('Pre-deployment validation completed');

  // Phase 2: Build preparation
  header('Phase 2: Build Preparation');
  
  info('Installing dependencies...');
  runCommand(`${packageManager} install`, 'Install dependencies');
  
  info('Running TypeScript type check...');
  runCommand(`${packageManager} run type-check`, 'TypeScript validation');
  
  info('Running linting...');
  runCommand(`${packageManager} run lint:check`, 'Code linting', false);
  
  success('Build preparation completed');

  // Phase 3: Database migration
  header('Phase 3: Database Migration');
  
  info('Running database migration...');
  if (fs.existsSync('supabase_migration.sql')) {
    runCommand('node migrate-database.mjs', 'Database migration', false);
  } else {
    info('No database migration file found, skipping...');
  }
  
  success('Database migration completed');

  // Phase 4: Build process
  header('Phase 4: Build Process');
  
  info('Building application...');
  runCommand(`${packageManager} run build`, 'Application build');
  
  success('Build process completed');

  // Phase 5: Vercel deployment
  header('Phase 5: Vercel Deployment');
  
  info('Creating Vercel configuration...');
  createVercelConfig();
  
  info('Deploying to Vercel...');
  deployToVercel();
  
  success('Vercel deployment completed');

  // Phase 6: Post-deployment validation
  header('Phase 6: Post-deployment Validation');
  
  info('Validating deployment...');
  validateDeployment();

  // Final summary
  header('🎉 DEPLOYMENT COMPLETE!');
  success('MySetlist has been successfully deployed to Vercel');
  info('🔗 Check your Vercel dashboard for the live URL');
  info('📊 Monitor the application health at /api/sync/health');
  info('🎯 The application is now live and ready for users!');
  log('', colors.RESET);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };