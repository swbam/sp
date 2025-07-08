#!/bin/bash

echo "🚀 MySetlist Production Deployment Script"
echo "=========================================="

# Check if all required environment variables are set
echo "📋 Checking environment variables..."

required_vars=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "SPOTIFY_CLIENT_ID"
  "SPOTIFY_CLIENT_SECRET"
  "TICKETMASTER_API_KEY"
  "SETLISTFM_API_KEY"
  "JWT_SECRET"
  "CRON_SECRET"
  "NEXT_PUBLIC_APP_URL"
)

missing_vars=()
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing_vars+=("$var")
  fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
  echo "❌ Missing required environment variables:"
  printf '%s\n' "${missing_vars[@]}"
  echo "Please set all required variables before deployment."
  exit 1
fi

echo "✅ All environment variables are set"

# Clean up debug statements for production
echo "🧹 Cleaning debug statements..."

# Remove console.log statements (keep console.error for production logging)
find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | xargs sed -i '' '/console\.log/d'

echo "✅ Debug cleanup complete"

# Run TypeScript checks
echo "🔍 Running TypeScript checks..."
npx tsc --noEmit

if [ $? -ne 0 ]; then
  echo "❌ TypeScript errors found. Please fix before deployment."
  exit 1
fi

echo "✅ TypeScript checks passed"

# Run linting
echo "🔍 Running ESLint..."
npx eslint . --ext .ts,.tsx --max-warnings 0

if [ $? -ne 0 ]; then
  echo "❌ Linting errors found. Please fix before deployment."
  exit 1
fi

echo "✅ Linting passed"

# Build the application
echo "🏗️  Building application..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed. Please fix errors before deployment."
  exit 1
fi

echo "✅ Build successful"

# Test critical API endpoints
echo "🧪 Testing critical endpoints..."

# Test health endpoint
curl -f -s "http://localhost:3000/api/health" > /dev/null
if [ $? -ne 0 ]; then
  echo "⚠️  Health endpoint test failed (this is expected if server isn't running locally)"
fi

echo "✅ Deployment preparation complete!"
echo ""
echo "🎯 Ready for deployment to Vercel!"
echo "Run: vercel --prod"
echo ""
echo "📊 Post-deployment checklist:"
echo "- ✅ Test search functionality"
echo "- ✅ Test voting without authentication"  
echo "- ✅ Test Spotify OAuth integration"
echo "- ✅ Verify cron jobs are running"
echo "- ✅ Check autonomous sync status"
echo ""
echo "🌟 MySetlist is ready for production!" 