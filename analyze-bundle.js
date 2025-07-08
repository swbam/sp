/**
 * Bundle Analysis Configuration for MySetlist
 * Run with: ANALYZE=true npm run build
 */

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: true,
});

// Wrap the Next.js config with bundle analyzer
const nextConfig = require('./next.config.js');

module.exports = withBundleAnalyzer(nextConfig);