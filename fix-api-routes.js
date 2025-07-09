#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// List of API routes that use request.url
const apiRoutes = [
  '/Users/seth/sp/app/api/analytics/dashboard/route.ts',
  '/Users/seth/sp/app/api/votes/route.ts',
  '/Users/seth/sp/app/api/search/artists/route.ts',
  '/Users/seth/sp/app/api/analytics/recommendations/route.ts',
  '/Users/seth/sp/app/api/analytics/etl/route.ts',
  '/Users/seth/sp/app/api/content/ab-testing/route.ts',
  '/Users/seth/sp/app/api/monitoring/health/route.ts',
  '/Users/seth/sp/app/api/analytics/advanced/route.ts',
  '/Users/seth/sp/app/api/ml/predictions/route.ts',
  '/Users/seth/sp/app/api/analytics/events/route.ts',
  '/Users/seth/sp/app/api/trending/route.ts',
  '/Users/seth/sp/app/api/sync/finalized/route.ts',
  '/Users/seth/sp/app/api/sync/comprehensive/route.ts',
  '/Users/seth/sp/app/api/sync/shows/route.ts',
  '/Users/seth/sp/app/api/sync/artists/route.ts',
  '/Users/seth/sp/app/api/sync/trigger/route.ts',
  '/Users/seth/sp/app/api/sync/autonomous/route.ts',
  '/Users/seth/sp/app/api/setlists/[id]/songs/route.ts',
  '/Users/seth/sp/app/api/auth/spotify/route.ts',
  '/Users/seth/sp/app/api/setlists/import/route.ts',
  '/Users/seth/sp/app/api/sync/populate/route.ts',
  '/Users/seth/sp/app/api/sync/test-spotify/route.ts',
  '/Users/seth/sp/app/api/stats/route.ts',
  '/Users/seth/sp/app/api/shows/route.ts',
  '/Users/seth/sp/app/api/setlists/route.ts',
  '/Users/seth/sp/app/api/artists/[slug]/shows/route.ts',
  '/Users/seth/sp/app/api/artists/route.ts',
  '/Users/seth/sp/app/api/realtime/votes/route.ts',
  '/Users/seth/sp/app/api/search/route.ts',
  '/Users/seth/sp/app/api/songs/search/route.ts'
];

function addDynamicConfig(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if already has dynamic config
    if (content.includes('export const dynamic')) {
      console.log(`✅ Already configured: ${filePath}`);
      return;
    }

    // Find the first import statement and add dynamic config after it
    const lines = content.split('\n');
    let insertIndex = -1;

    // Find the last import statement
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) {
        insertIndex = i;
      }
    }

    if (insertIndex === -1) {
      // No imports found, add at the beginning
      insertIndex = 0;
    } else {
      // Insert after the last import
      insertIndex++;
    }

    // Insert dynamic configuration
    const dynamicConfig = [
      '',
      '// Force dynamic rendering for this route',
      'export const dynamic = \'force-dynamic\';',
      'export const runtime = \'nodejs\';',
      ''
    ];

    lines.splice(insertIndex, 0, ...dynamicConfig);
    
    const updatedContent = lines.join('\n');
    fs.writeFileSync(filePath, updatedContent);
    
    console.log(`✅ Updated: ${filePath}`);
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

console.log('🔧 Adding dynamic configuration to API routes...\n');

apiRoutes.forEach(addDynamicConfig);

console.log('\n🎉 Done! All API routes have been updated with dynamic configuration.');