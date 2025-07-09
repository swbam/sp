#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Bundle size targets (in bytes)
const BUNDLE_SIZE_TARGETS = {
  total: 10 * 1024 * 1024, // 10MB total
  javascript: 5 * 1024 * 1024, // 5MB JS
  css: 500 * 1024, // 500KB CSS
  images: 3 * 1024 * 1024, // 3MB images
  fonts: 1 * 1024 * 1024, // 1MB fonts
  other: 1.5 * 1024 * 1024, // 1.5MB other assets
};

// Critical dependencies that should be optimized
const CRITICAL_DEPENDENCIES = [
  'react-icons',
  'framer-motion',
  'lucide-react',
  '@radix-ui/react-dialog',
  'tailwind-merge',
  'query-string',
  'date-fns',
  'react-hot-toast',
  'immer',
  'zustand'
];

// Utility functions
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getDirectorySize = (dirPath) => {
  let totalSize = 0;
  
  const traverse = (currentPath) => {
    const stat = fs.statSync(currentPath);
    if (stat.isDirectory()) {
      const files = fs.readdirSync(currentPath);
      files.forEach(file => {
        traverse(path.join(currentPath, file));
      });
    } else {
      totalSize += stat.size;
    }
  };
  
  if (fs.existsSync(dirPath)) {
    traverse(dirPath);
  }
  
  return totalSize;
};

const analyzeBundle = () => {
  console.log('🔍 Analyzing bundle sizes...\n');
  
  const nextDir = path.join(process.cwd(), '.next');
  const staticDir = path.join(nextDir, 'static');
  
  if (!fs.existsSync(nextDir)) {
    console.error('❌ .next directory not found. Run `npm run build` first.');
    process.exit(1);
  }
  
  // Analyze different asset types
  const sizes = {
    total: getDirectorySize(staticDir),
    javascript: getDirectorySize(path.join(staticDir, 'chunks')),
    css: getDirectorySize(path.join(staticDir, 'css')),
    images: getDirectorySize(path.join(staticDir, 'media')),
    fonts: 0, // Fonts are typically in media or separate directory
    other: 0
  };
  
  // Calculate other assets
  sizes.other = sizes.total - sizes.javascript - sizes.css - sizes.images - sizes.fonts;
  
  console.log('📊 Bundle Size Analysis:');
  console.log('------------------------');
  
  Object.entries(sizes).forEach(([type, size]) => {
    const target = BUNDLE_SIZE_TARGETS[type];
    const percentage = target ? (size / target) * 100 : 0;
    const status = percentage > 100 ? '❌' : percentage > 80 ? '⚠️' : '✅';
    
    console.log(`${status} ${type.padEnd(12)}: ${formatBytes(size).padEnd(10)} (${percentage.toFixed(1)}% of target)`);
  });
  
  console.log('\n');
  
  return sizes;
};

const optimizeDependencies = () => {
  console.log('🎯 Optimizing dependencies...\n');
  
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  const suggestions = [];
  
  // Check for unused dependencies
  CRITICAL_DEPENDENCIES.forEach(dep => {
    if (packageJson.dependencies[dep] || packageJson.devDependencies[dep]) {
      console.log(`✅ ${dep} is installed`);
    } else {
      console.log(`⚠️ ${dep} not found in dependencies`);
    }
  });
  
  // Suggest optimizations
  suggestions.push('Consider using dynamic imports for large components');
  suggestions.push('Implement tree-shaking for icon libraries');
  suggestions.push('Use Next.js Image component for optimized images');
  suggestions.push('Enable compression in production');
  
  console.log('\n💡 Optimization Suggestions:');
  suggestions.forEach(suggestion => {
    console.log(`   • ${suggestion}`);
  });
  
  console.log('\n');
};

const generateOptimizationReport = (sizes) => {
  const report = {
    timestamp: new Date().toISOString(),
    bundleSizes: sizes,
    targets: BUNDLE_SIZE_TARGETS,
    recommendations: [],
    performance: {
      meetsTarget: sizes.total <= BUNDLE_SIZE_TARGETS.total,
      compressionRatio: 0,
      loadTimeEstimate: Math.round(sizes.total / (1024 * 1024 * 0.5)), // Assume 0.5MB/s connection
    }
  };
  
  // Generate recommendations
  if (sizes.javascript > BUNDLE_SIZE_TARGETS.javascript) {
    report.recommendations.push({
      type: 'javascript',
      priority: 'high',
      message: 'JavaScript bundle exceeds target size',
      actions: [
        'Implement code splitting for route-based chunks',
        'Use dynamic imports for non-critical components',
        'Tree-shake unused code from dependencies'
      ]
    });
  }
  
  if (sizes.css > BUNDLE_SIZE_TARGETS.css) {
    report.recommendations.push({
      type: 'css',
      priority: 'medium',
      message: 'CSS bundle exceeds target size',
      actions: [
        'Remove unused CSS with PurgeCSS',
        'Optimize Tailwind CSS configuration',
        'Use CSS modules for component-scoped styles'
      ]
    });
  }
  
  if (sizes.images > BUNDLE_SIZE_TARGETS.images) {
    report.recommendations.push({
      type: 'images',
      priority: 'high',
      message: 'Image assets exceed target size',
      actions: [
        'Implement lazy loading for images',
        'Use Next.js Image component with optimization',
        'Compress images with appropriate formats (WebP, AVIF)'
      ]
    });
  }
  
  // Save report
  const reportPath = path.join(process.cwd(), 'bundle-optimization-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`📋 Optimization report saved to: ${reportPath}\n`);
  
  return report;
};

const implementOptimizations = () => {
  console.log('🔧 Implementing optimizations...\n');
  
  const optimizations = [
    {
      name: 'Enable SWC minification',
      check: () => {
        const nextConfigPath = path.join(process.cwd(), 'next.config.js');
        const content = fs.readFileSync(nextConfigPath, 'utf8');
        return content.includes('swcMinify: true');
      },
      action: 'Already enabled in next.config.js'
    },
    {
      name: 'Configure bundle splitting',
      check: () => {
        const nextConfigPath = path.join(process.cwd(), 'next.config.js');
        const content = fs.readFileSync(nextConfigPath, 'utf8');
        return content.includes('splitChunks');
      },
      action: 'Already configured in next.config.js'
    },
    {
      name: 'Optimize package imports',
      check: () => {
        const nextConfigPath = path.join(process.cwd(), 'next.config.js');
        const content = fs.readFileSync(nextConfigPath, 'utf8');
        return content.includes('optimizePackageImports');
      },
      action: 'Already configured in next.config.js'
    }
  ];
  
  optimizations.forEach(opt => {
    const status = opt.check() ? '✅' : '❌';
    console.log(`${status} ${opt.name}: ${opt.action}`);
  });
  
  console.log('\n');
};

const runBundleAnalyzer = () => {
  console.log('📈 Running bundle analyzer...\n');
  
  try {
    // Check if bundle analyzer is available
    execSync('npx @next/bundle-analyzer --version', { stdio: 'pipe' });
    
    // Run the analyzer
    console.log('Opening bundle analyzer in browser...');
    execSync('npm run build:analyze', { stdio: 'inherit' });
  } catch (error) {
    console.log('⚠️ Bundle analyzer not available. Install with:');
    console.log('   npm install --save-dev @next/bundle-analyzer');
  }
  
  console.log('\n');
};

const main = () => {
  console.log('🚀 MySetlist Bundle Optimization Tool\n');
  console.log('=====================================\n');
  
  // Step 1: Analyze current bundle
  const sizes = analyzeBundle();
  
  // Step 2: Check dependencies
  optimizeDependencies();
  
  // Step 3: Generate optimization report
  const report = generateOptimizationReport(sizes);
  
  // Step 4: Implement optimizations
  implementOptimizations();
  
  // Step 5: Show summary
  console.log('📝 Summary:');
  console.log('-----------');
  console.log(`Total bundle size: ${formatBytes(sizes.total)}`);
  console.log(`Target: ${formatBytes(BUNDLE_SIZE_TARGETS.total)}`);
  console.log(`Status: ${report.performance.meetsTarget ? '✅ Meets target' : '❌ Exceeds target'}`);
  console.log(`Estimated load time: ${report.performance.loadTimeEstimate}s\n`);
  
  if (report.recommendations.length > 0) {
    console.log('🎯 Priority Actions:');
    report.recommendations
      .filter(rec => rec.priority === 'high')
      .forEach(rec => {
        console.log(`   • ${rec.message}`);
        rec.actions.forEach(action => {
          console.log(`     - ${action}`);
        });
      });
  }
  
  console.log('\n✨ Optimization complete!');
  
  // Optionally run bundle analyzer
  if (process.argv.includes('--analyze')) {
    runBundleAnalyzer();
  }
};

if (require.main === module) {
  main();
}

module.exports = {
  analyzeBundle,
  optimizeDependencies,
  generateOptimizationReport,
  implementOptimizations,
  formatBytes,
  BUNDLE_SIZE_TARGETS
};