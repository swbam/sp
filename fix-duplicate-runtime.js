#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files with duplicate runtime exports
const problemFiles = [
  '/Users/seth/sp/app/api/auth/spotify/route.ts',
  '/Users/seth/sp/app/api/setlists/import/route.ts',
  '/Users/seth/sp/app/api/sync/autonomous/route.ts',
  '/Users/seth/sp/app/api/sync/populate/route.ts',
  '/Users/seth/sp/app/api/sync/test-spotify/route.ts'
];

function fixDuplicateRuntime(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    
    // Remove duplicate runtime exports
    const lines = content.split('\n');
    const seenRuntime = new Set();
    const filteredLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('export const runtime = \'nodejs\';')) {
        if (!seenRuntime.has('runtime')) {
          seenRuntime.add('runtime');
          filteredLines.push(line);
        }
        // Skip duplicate lines
      } else {
        filteredLines.push(line);
      }
    }
    
    const updatedContent = filteredLines.join('\n');
    fs.writeFileSync(filePath, updatedContent);
    
    console.log(`✅ Fixed: ${filePath}`);
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

console.log('🔧 Fixing duplicate runtime exports...\n');

problemFiles.forEach(fixDuplicateRuntime);

console.log('\n🎉 Done! All duplicate runtime exports have been fixed.');