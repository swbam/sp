#!/usr/bin/env node

/**
 * MySetlist Database Setup Script
 * 
 * This script executes the complete database migration to transform
 * the Spotify clone into MySetlist. It will:
 * 
 * 1. Connect to Supabase
 * 2. Execute the migration SQL
 * 3. Verify the setup
 * 4. Add sample data
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQL(sql, description) {
  console.log(`🔄 ${description}...`);
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.error(`❌ Error in ${description}:`, error.message);
      return false;
    }
    console.log(`✅ ${description} completed successfully`);
    return true;
  } catch (err) {
    console.error(`❌ Error in ${description}:`, err.message);
    return false;
  }
}

async function setupDatabase() {
  console.log('🚀 Starting MySetlist Database Migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase_migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📄 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length > 0) {
        await executeSQL(statement + ';', `Statement ${i + 1}/${statements.length}`);
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('\n🔍 Verifying migration...');

    // Verify tables were created
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');

    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError.message);
      return;
    }

    const expectedTables = [
      'artists', 'venues', 'shows', 'songs', 
      'setlists', 'setlist_songs', 'votes', 'user_artists'
    ];

    const createdTables = tables.map(t => t.table_name);
    const missingTables = expectedTables.filter(table => !createdTables.includes(table));

    if (missingTables.length > 0) {
      console.error('❌ Missing tables:', missingTables.join(', '));
      return;
    }

    console.log('✅ All expected tables created successfully');

    // Check sample data
    const { data: artistCount } = await supabase
      .from('artists')
      .select('id', { count: 'exact', head: true });

    const { data: venueCount } = await supabase
      .from('venues')
      .select('id', { count: 'exact', head: true });

    console.log(`📊 Sample data: ${artistCount?.count || 0} artists, ${venueCount?.count || 0} venues`);

    console.log('\n🎉 Database migration completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Test the application: npm run dev');
    console.log('2. Check Supabase dashboard for RLS policies');
    console.log('3. Test user authentication flow');
    console.log('4. Test artist search and voting functionality');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check your Supabase credentials in .env.local');
    console.error('2. Ensure your Supabase project is active');
    console.error('3. Verify you have admin access to the database');
    process.exit(1);
  }
}

// Execute the setup
setupDatabase();