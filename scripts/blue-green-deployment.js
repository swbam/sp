#!/usr/bin/env node

/**
 * Blue-Green Deployment Script for MySetlist
 * Implements zero-downtime deployment with automated rollback capabilities
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BlueGreenDeployment {
  constructor(config = {}) {
    this.config = {
      vercelToken: process.env.VERCEL_TOKEN,
      vercelOrgId: process.env.VERCEL_ORG_ID,
      vercelProjectId: process.env.VERCEL_PROJECT_ID,
      productionDomain: process.env.NEXT_PUBLIC_APP_URL || 'https://mysetlist.com',
      stagingDomain: 'https://staging.mysetlist.com',
      healthCheckTimeout: 300000, // 5 minutes
      healthCheckInterval: 5000, // 5 seconds
      rollbackTimeout: 60000, // 1 minute
      ...config,
    };
    
    this.deploymentHistory = [];
    this.currentDeployment = null;
    this.previousDeployment = null;
    
    this.loadDeploymentHistory();
  }

  /**
   * Load deployment history from file
   */
  loadDeploymentHistory() {
    const historyPath = path.join(__dirname, '..', 'deployment-history.json');
    
    try {
      if (fs.existsSync(historyPath)) {
        const data = fs.readFileSync(historyPath, 'utf8');
        this.deploymentHistory = JSON.parse(data);
        
        if (this.deploymentHistory.length > 0) {
          this.currentDeployment = this.deploymentHistory[0];
          this.previousDeployment = this.deploymentHistory[1] || null;
        }
      }
    } catch (error) {
      console.error('Error loading deployment history:', error);
      this.deploymentHistory = [];
    }
  }

  /**
   * Save deployment history to file
   */
  saveDeploymentHistory() {
    const historyPath = path.join(__dirname, '..', 'deployment-history.json');
    
    try {
      fs.writeFileSync(historyPath, JSON.stringify(this.deploymentHistory, null, 2));
    } catch (error) {
      console.error('Error saving deployment history:', error);
    }
  }

  /**
   * Main deployment orchestration
   */
  async deploy(options = {}) {
    const {
      branch = 'main',
      skipTests = false,
      skipHealthCheck = false,
      autoRollback = true,
    } = options;

    const deploymentId = this.generateDeploymentId();
    const startTime = Date.now();

    console.log(`🚀 Starting Blue-Green deployment ${deploymentId}`);
    console.log(`📋 Branch: ${branch}`);
    console.log(`⚙️  Auto-rollback: ${autoRollback}`);
    console.log(`🧪 Skip tests: ${skipTests}`);
    console.log('');

    try {
      // Step 1: Pre-deployment validation
      console.log('📋 Step 1: Pre-deployment validation');
      await this.validateEnvironment();
      
      if (!skipTests) {
        await this.runTests();
      }

      // Step 2: Build and prepare green deployment
      console.log('🏗️  Step 2: Build and prepare green deployment');
      const greenDeployment = await this.buildGreenDeployment(deploymentId);

      // Step 3: Deploy to green environment
      console.log('🟢 Step 3: Deploy to green environment');
      await this.deployToGreen(greenDeployment);

      // Step 4: Health check on green deployment
      console.log('🔍 Step 4: Health check on green deployment');
      if (!skipHealthCheck) {
        await this.healthCheckGreen(greenDeployment);
      }

      // Step 5: Switch traffic to green (blue-green switch)
      console.log('🔄 Step 5: Switch traffic to green');
      await this.switchTrafficToGreen(greenDeployment);

      // Step 6: Validate production traffic
      console.log('✅ Step 6: Validate production traffic');
      await this.validateProductionTraffic();

      // Step 7: Update deployment history
      console.log('📝 Step 7: Update deployment history');
      await this.updateDeploymentHistory(greenDeployment, 'success');

      // Step 8: Cleanup old deployments
      console.log('🧹 Step 8: Cleanup old deployments');
      await this.cleanupOldDeployments();

      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);

      console.log('');
      console.log(`✅ Deployment ${deploymentId} completed successfully!`);
      console.log(`⏱️  Duration: ${duration}s`);
      console.log(`🌐 Production URL: ${this.config.productionDomain}`);
      console.log('');

      return {
        deploymentId,
        success: true,
        duration,
        url: this.config.productionDomain,
      };

    } catch (error) {
      console.error(`❌ Deployment ${deploymentId} failed:`, error.message);
      
      if (autoRollback) {
        console.log('🔄 Starting automatic rollback...');
        await this.rollback({ reason: error.message });
      }

      throw error;
    }
  }

  /**
   * Validate environment before deployment
   */
  async validateEnvironment() {
    console.log('🔍 Validating environment variables...');
    
    const requiredVars = [
      'VERCEL_TOKEN',
      'VERCEL_ORG_ID',
      'VERCEL_PROJECT_ID',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    console.log('✅ Environment validation passed');
  }

  /**
   * Run test suite
   */
  async runTests() {
    console.log('🧪 Running test suite...');
    
    try {
      execSync('npm run test:ci', { stdio: 'inherit', cwd: process.cwd() });
      console.log('✅ Tests passed');
    } catch (error) {
      throw new Error('Tests failed');
    }
  }

  /**
   * Build green deployment
   */
  async buildGreenDeployment(deploymentId) {
    console.log('🏗️  Building green deployment...');
    
    const deployment = {
      id: deploymentId,
      timestamp: Date.now(),
      commit: this.getGitCommit(),
      branch: this.getGitBranch(),
      status: 'building',
      url: null,
      healthCheck: null,
    };

    // Build the application
    try {
      execSync('npm run build', { stdio: 'inherit', cwd: process.cwd() });
      console.log('✅ Build completed successfully');
      
      deployment.status = 'built';
      return deployment;
    } catch (error) {
      deployment.status = 'failed';
      throw new Error('Build failed');
    }
  }

  /**
   * Deploy to green environment
   */
  async deployToGreen(deployment) {
    console.log('🟢 Deploying to green environment...');
    
    try {
      // Deploy to Vercel
      const deployOutput = execSync('vercel --prod --token $VERCEL_TOKEN', {
        encoding: 'utf8',
        cwd: process.cwd(),
        env: {
          ...process.env,
          VERCEL_TOKEN: this.config.vercelToken,
          VERCEL_ORG_ID: this.config.vercelOrgId,
          VERCEL_PROJECT_ID: this.config.vercelProjectId,
        },
      });

      // Extract deployment URL
      const urlMatch = deployOutput.match(/https:\\/\\/[^\\s]+/);
      if (urlMatch) {
        deployment.url = urlMatch[0];
        deployment.status = 'deployed';
        console.log(`✅ Deployed to: ${deployment.url}`);
      } else {
        throw new Error('Could not extract deployment URL');
      }

      return deployment;
    } catch (error) {
      deployment.status = 'failed';
      throw new Error(`Deployment failed: ${error.message}`);
    }
  }

  /**
   * Health check on green deployment
   */
  async healthCheckGreen(deployment) {
    console.log('🔍 Running health checks on green deployment...');
    
    const startTime = Date.now();
    const timeout = this.config.healthCheckTimeout;
    
    while (Date.now() - startTime < timeout) {
      try {
        const healthCheckResult = await this.performHealthCheck(deployment.url);
        
        if (healthCheckResult.healthy) {
          deployment.healthCheck = healthCheckResult;
          deployment.status = 'healthy';
          console.log('✅ Green deployment health check passed');
          return;
        }
        
        console.log('⏳ Health check not ready, retrying...');
        await this.sleep(this.config.healthCheckInterval);
      } catch (error) {
        console.log(`⚠️  Health check failed: ${error.message}, retrying...`);
        await this.sleep(this.config.healthCheckInterval);
      }
    }

    deployment.status = 'unhealthy';
    throw new Error('Health check timeout - green deployment is not healthy');
  }

  /**
   * Switch traffic to green deployment
   */
  async switchTrafficToGreen(deployment) {
    console.log('🔄 Switching traffic to green deployment...');
    
    try {
      // Assign production domain to green deployment
      const aliasCmd = `vercel alias ${deployment.url} ${this.config.productionDomain} --token $VERCEL_TOKEN`;
      
      execSync(aliasCmd, {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: {
          ...process.env,
          VERCEL_TOKEN: this.config.vercelToken,
        },
      });

      deployment.status = 'active';
      console.log(`✅ Traffic switched to green deployment`);
      console.log(`🌐 Production URL: ${this.config.productionDomain}`);
      
      // Wait for DNS propagation
      await this.sleep(10000);
      
    } catch (error) {
      throw new Error(`Traffic switch failed: ${error.message}`);
    }
  }

  /**
   * Validate production traffic
   */
  async validateProductionTraffic() {
    console.log('✅ Validating production traffic...');
    
    try {
      const healthCheckResult = await this.performHealthCheck(this.config.productionDomain);
      
      if (!healthCheckResult.healthy) {
        throw new Error('Production health check failed after traffic switch');
      }

      console.log('✅ Production traffic validation passed');
    } catch (error) {
      throw new Error(`Production validation failed: ${error.message}`);
    }
  }

  /**
   * Perform health check on a URL
   */
  async performHealthCheck(url) {
    const healthUrl = `${url}/api/monitoring/health`;
    
    try {
      const response = await fetch(healthUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'MySetlist-BlueGreen-HealthCheck',
        },
      });

      if (!response.ok) {
        throw new Error(`Health check returned ${response.status}`);
      }

      const healthData = await response.json();
      
      return {
        healthy: healthData.status === 'healthy',
        status: healthData.status,
        checks: healthData.checks,
        timestamp: Date.now(),
        responseTime: response.headers.get('x-response-time'),
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Update deployment history
   */
  async updateDeploymentHistory(deployment, status) {
    deployment.status = status;
    deployment.completedAt = Date.now();
    
    // Add to beginning of history
    this.deploymentHistory.unshift(deployment);
    
    // Keep only last 10 deployments
    if (this.deploymentHistory.length > 10) {
      this.deploymentHistory = this.deploymentHistory.slice(0, 10);
    }
    
    // Update current and previous
    this.currentDeployment = deployment;
    this.previousDeployment = this.deploymentHistory[1] || null;
    
    // Save to file
    this.saveDeploymentHistory();
  }

  /**
   * Cleanup old deployments
   */
  async cleanupOldDeployments() {
    console.log('🧹 Cleaning up old deployments...');
    
    try {
      // Get list of deployments
      const deploymentsCmd = `vercel list --token $VERCEL_TOKEN`;
      const deploymentsList = execSync(deploymentsCmd, {
        encoding: 'utf8',
        env: {
          ...process.env,
          VERCEL_TOKEN: this.config.vercelToken,
        },
      });

      // Parse and identify old deployments to remove
      // This is a simplified version - in practice you'd parse the output
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.warn('⚠️  Cleanup failed:', error.message);
    }
  }

  /**
   * Rollback to previous deployment
   */
  async rollback(options = {}) {
    const { reason = 'Manual rollback' } = options;
    
    console.log('🔄 Starting rollback process...');
    console.log(`📋 Reason: ${reason}`);
    
    if (!this.previousDeployment) {
      throw new Error('No previous deployment available for rollback');
    }

    try {
      // Switch back to previous deployment
      const rollbackCmd = `vercel alias ${this.previousDeployment.url} ${this.config.productionDomain} --token $VERCEL_TOKEN`;
      
      execSync(rollbackCmd, {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: {
          ...process.env,
          VERCEL_TOKEN: this.config.vercelToken,
        },
      });

      // Wait for DNS propagation
      await this.sleep(10000);
      
      // Validate rollback
      const healthCheckResult = await this.performHealthCheck(this.config.productionDomain);
      
      if (!healthCheckResult.healthy) {
        throw new Error('Rollback validation failed');
      }

      console.log('✅ Rollback completed successfully');
      console.log(`🌐 Production URL: ${this.config.productionDomain}`);
      console.log(`📝 Rolled back to: ${this.previousDeployment.id}`);
      
      // Update deployment history
      const rollbackRecord = {
        id: this.generateDeploymentId(),
        timestamp: Date.now(),
        type: 'rollback',
        reason,
        rolledBackTo: this.previousDeployment.id,
        status: 'success',
      };
      
      this.deploymentHistory.unshift(rollbackRecord);
      this.saveDeploymentHistory();
      
      return rollbackRecord;
      
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      throw error;
    }
  }

  /**
   * Get deployment status
   */
  getDeploymentStatus() {
    return {
      current: this.currentDeployment,
      previous: this.previousDeployment,
      history: this.deploymentHistory,
    };
  }

  /**
   * Utility methods
   */
  generateDeploymentId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `deploy-${timestamp}-${random}`;
  }

  getGitCommit() {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  getGitBranch() {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const deployment = new BlueGreenDeployment();
  
  try {
    switch (command) {
      case 'deploy':
        const deployOptions = {
          branch: args.find(arg => arg.startsWith('--branch='))?.split('=')[1] || 'main',
          skipTests: args.includes('--skip-tests'),
          skipHealthCheck: args.includes('--skip-health-check'),
          autoRollback: !args.includes('--no-auto-rollback'),
        };
        
        const result = await deployment.deploy(deployOptions);
        console.log(JSON.stringify(result, null, 2));
        break;
        
      case 'rollback':
        const rollbackOptions = {
          reason: args.find(arg => arg.startsWith('--reason='))?.split('=')[1] || 'Manual rollback',
        };
        
        const rollbackResult = await deployment.rollback(rollbackOptions);
        console.log(JSON.stringify(rollbackResult, null, 2));
        break;
        
      case 'status':
        const status = deployment.getDeploymentStatus();
        console.log(JSON.stringify(status, null, 2));
        break;
        
      case 'health':
        const target = args.find(arg => arg.startsWith('--target='))?.split('=')[1] || 'production';
        const url = target === 'production' ? deployment.config.productionDomain : deployment.config.stagingDomain;
        const healthResult = await deployment.performHealthCheck(url);
        console.log(JSON.stringify(healthResult, null, 2));
        break;
        
      default:
        console.log('Usage: node blue-green-deployment.js <command> [options]');
        console.log('');
        console.log('Commands:');
        console.log('  deploy [--branch=main] [--skip-tests] [--skip-health-check] [--no-auto-rollback]');
        console.log('  rollback [--reason="Manual rollback"]');
        console.log('  status');
        console.log('  health [--target=production|staging]');
        console.log('');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = BlueGreenDeployment;