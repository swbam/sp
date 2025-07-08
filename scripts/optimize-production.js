#!/usr/bin/env node

/**
 * Production Optimization Script
 * Optimizes the application for production deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ProductionOptimizer {
  constructor() {
    this.optimizations = [];
    this.errors = [];
  }

  log(message) {
    console.log(`🔧 ${message}`);
  }

  error(message) {
    console.error(`❌ ${message}`);
    this.errors.push(message);
  }

  success(message) {
    console.log(`✅ ${message}`);
    this.optimizations.push(message);
  }

  // Clean build artifacts
  cleanBuildArtifacts() {
    this.log('Cleaning build artifacts...');
    
    const dirsToClean = ['.next', 'out', 'dist', 'node_modules/.cache'];
    
    dirsToClean.forEach(dir => {
      const dirPath = path.join(process.cwd(), dir);
      if (fs.existsSync(dirPath)) {
        try {
          fs.rmSync(dirPath, { recursive: true, force: true });
          this.success(`Cleaned ${dir}`);
        } catch (error) {
          this.error(`Failed to clean ${dir}: ${error.message}`);
        }
      }
    });
  }

  // Optimize dependencies
  optimizeDependencies() {
    this.log('Optimizing dependencies...');
    
    try {
      // Remove unused dependencies
      execSync('npm prune --production', { stdio: 'inherit' });
      this.success('Pruned unused dependencies');
      
      // Reinstall with optimized settings
      execSync('npm ci --omit=dev', { stdio: 'inherit' });
      this.success('Reinstalled production dependencies');
      
    } catch (error) {
      this.error(`Failed to optimize dependencies: ${error.message}`);
    }
  }

  // Optimize images
  optimizeImages() {
    this.log('Optimizing images...');
    
    const imagesDir = path.join(process.cwd(), 'public', 'images');
    if (!fs.existsSync(imagesDir)) {
      this.log('No images directory found, skipping optimization');
      return;
    }

    const imageFiles = fs.readdirSync(imagesDir)
      .filter(file => /\.(png|jpg|jpeg|gif|webp)$/i.test(file));

    if (imageFiles.length === 0) {
      this.log('No images found to optimize');
      return;
    }

    imageFiles.forEach(file => {
      const filePath = path.join(imagesDir, file);
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      
      if (stats.size > 100000) { // 100KB
        this.log(`Large image found: ${file} (${sizeKB}KB)`);
        // In a real implementation, you would optimize the image here
      }
    });

    this.success(`Analyzed ${imageFiles.length} images`);
  }

  // Generate production build
  async generateProductionBuild() {
    this.log('Generating production build...');
    
    try {
      // Set production environment
      process.env.NODE_ENV = 'production';
      
      // Build the application
      execSync('npm run build:production', { stdio: 'inherit' });
      this.success('Production build generated');
      
      // Analyze bundle size
      this.analyzeBundleSize();
      
    } catch (error) {
      this.error(`Failed to generate production build: ${error.message}`);
    }
  }

  // Analyze bundle size
  analyzeBundleSize() {
    this.log('Analyzing bundle size...');
    
    const buildDir = path.join(process.cwd(), '.next');
    if (!fs.existsSync(buildDir)) {
      this.error('Build directory not found');
      return;
    }

    const staticDir = path.join(buildDir, 'static');
    if (!fs.existsSync(staticDir)) {
      this.error('Static directory not found');
      return;
    }

    let totalSize = 0;
    const largeFiles = [];

    const analyzeDirectory = (dir) => {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          analyzeDirectory(filePath);
        } else {
          totalSize += stats.size;
          
          // Flag large files
          if (stats.size > 250000) { // 250KB
            largeFiles.push({
              file: path.relative(staticDir, filePath),
              size: (stats.size / 1024).toFixed(2) + 'KB'
            });
          }
        }
      });
    };

    analyzeDirectory(staticDir);

    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
    this.success(`Total bundle size: ${totalSizeMB}MB`);
    
    if (largeFiles.length > 0) {
      this.log('Large files found:');
      largeFiles.forEach(file => {
        console.log(`  ⚠️  ${file.file}: ${file.size}`);
      });
    }

    // Check against thresholds
    if (totalSize > 5000000) { // 5MB
      this.error(`Bundle size exceeds 5MB threshold: ${totalSizeMB}MB`);
    } else {
      this.success(`Bundle size within limits: ${totalSizeMB}MB`);
    }
  }

  // Optimize configuration files
  optimizeConfigFiles() {
    this.log('Optimizing configuration files...');
    
    // Check next.config.js
    const nextConfigPath = path.join(process.cwd(), 'next.config.js');
    if (fs.existsSync(nextConfigPath)) {
      const config = fs.readFileSync(nextConfigPath, 'utf8');
      
      // Check for production optimizations
      const hasCompression = config.includes('compress: true');
      const hasMinification = config.includes('swcMinify: true');
      const hasSourceMaps = config.includes('productionBrowserSourceMaps: false');
      
      if (hasCompression && hasMinification && hasSourceMaps) {
        this.success('Next.js configuration optimized');
      } else {
        this.error('Next.js configuration missing optimizations');
      }
    }

    // Check package.json scripts
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      if (packageJson.scripts['build:production']) {
        this.success('Production build script configured');
      } else {
        this.error('Production build script missing');
      }
    }
  }

  // Validate environment variables
  validateEnvironmentVariables() {
    this.log('Validating environment variables...');
    
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      this.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    } else {
      this.success('All required environment variables present');
    }

    // Check for development-specific variables in production
    const devVars = ['NEXT_PUBLIC_APP_URL'];
    devVars.forEach(varName => {
      if (process.env[varName] && process.env[varName].includes('localhost')) {
        this.error(`Development URL found in production: ${varName}`);
      }
    });
  }

  // Security checks
  performSecurityChecks() {
    this.log('Performing security checks...');
    
    // Check for exposed secrets
    const sensitiveFiles = ['.env', '.env.local', '.env.development'];
    sensitiveFiles.forEach(file => {
      if (fs.existsSync(file)) {
        this.log(`Found sensitive file: ${file}`);
      }
    });

    // Check middleware configuration
    const middlewarePath = path.join(process.cwd(), 'middleware.ts');
    if (fs.existsSync(middlewarePath)) {
      const middleware = fs.readFileSync(middlewarePath, 'utf8');
      
      if (middleware.includes('X-Frame-Options') && middleware.includes('X-XSS-Protection')) {
        this.success('Security headers configured in middleware');
      } else {
        this.error('Security headers missing in middleware');
      }
    }

    this.success('Security checks completed');
  }

  // Run all optimizations
  async runAllOptimizations() {
    console.log('🚀 Starting production optimization...\n');
    
    try {
      // Clean previous builds
      this.cleanBuildArtifacts();
      
      // Optimize dependencies
      this.optimizeDependencies();
      
      // Optimize images
      this.optimizeImages();
      
      // Optimize configuration
      this.optimizeConfigFiles();
      
      // Validate environment
      this.validateEnvironmentVariables();
      
      // Security checks
      this.performSecurityChecks();
      
      // Generate production build
      await this.generateProductionBuild();
      
      // Summary
      this.generateSummary();
      
    } catch (error) {
      this.error(`Optimization failed: ${error.message}`);
    }
  }

  // Generate optimization summary
  generateSummary() {
    console.log('\n📊 Optimization Summary');
    console.log('======================');
    
    if (this.optimizations.length > 0) {
      console.log('\n✅ Completed Optimizations:');
      this.optimizations.forEach(opt => console.log(`  ✓ ${opt}`));
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ Issues Found:');
      this.errors.forEach(err => console.log(`  ✗ ${err}`));
    }
    
    const success = this.errors.length === 0;
    console.log(`\n${success ? '🎉' : '⚠️'} Overall Status: ${success ? 'SUCCESS' : 'ISSUES FOUND'}`);
    
    if (success) {
      console.log('\n🚀 Your application is optimized for production!');
    } else {
      console.log('\n🔧 Please fix the issues above before deploying to production.');
    }
    
    return success;
  }
}

// CLI usage
async function main() {
  const optimizer = new ProductionOptimizer();
  const success = await optimizer.runAllOptimizations();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = ProductionOptimizer;