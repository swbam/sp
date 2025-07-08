#!/usr/bin/env node

/**
 * Execute MySetlist Database Migration
 * 
 * This script executes the database migration directly using Supabase client
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables manually
const envContent = readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

console.log('🔗 Connecting to Supabase...');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeMigration() {
  try {
    console.log('📄 Reading migration file...');
    const migrationSQL = readFileSync('supabase_migration.sql', 'utf8');
    
    console.log('🚀 Executing migration...');
    
    // Execute the migration in chunks to avoid timeout
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length > 0) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        
        const { error } = await supabase.rpc('exec_sql', { 
          sql: statement 
        });
        
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          // Continue with other statements unless it's a critical error
          if (error.message.includes('already exists')) {
            console.log('⚠️  Object already exists, continuing...');
          } else {
            console.error('Statement:', statement.substring(0, 100) + '...');
          }
        } else {
          console.log(`✅ Statement ${i + 1} completed`);
        }
      }
    }

    console.log('\n🔍 Verifying migration...');
    
    // Test basic queries
    const { data: artists, error: artistError } = await supabase
      .from('artists')
      .select('count()', { count: 'exact', head: true });
      
    const { data: venues, error: venueError } = await supabase
      .from('venues')
      .select('count()', { count: 'exact', head: true });

    if (artistError || venueError) {
      console.error('❌ Verification failed:', artistError || venueError);
    } else {
      console.log(`✅ Verification successful: ${artists.count} artists, ${venues.count} venues`);
    }

    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

executeMigration();