# 🚀 MySetlist Deployment System

## Overview

The MySetlist deployment system is a bulletproof, single-command deployment solution that handles:
- Environment validation
- Database migrations
- Edge functions deployment
- Build validation
- Type checking
- Vercel deployment with auto-accept
- Post-deployment validation
- Comprehensive error handling and rollback

## Quick Start

### Single Command Deployment

```bash
# Full deployment with all validations
pnpm final

# Quick deployment (skip tests and validations)
pnpm final --quick

# Dry run (see what would be deployed)
pnpm final --dry-run
```

## Available Commands

### Package.json Scripts

```bash
# Main deployment commands
pnpm final              # Full deployment
pnpm deploy             # Same as final
pnpm deploy:production  # Production deployment
pnpm deploy:quick       # Quick deployment without tests
pnpm deploy:force       # Force reset on migration conflicts
pnpm deploy:rollback    # Rollback to previous deployment

# Validation
./scripts/validate-deployment.sh                    # Validate current deployment
./scripts/validate-deployment.sh https://myapp.com # Validate specific URL
```

### Direct Script Usage

```bash
# Full deployment
./scripts/deploy-final.sh

# Quick deployment
./scripts/deploy-final.sh --quick

# Dry run
./scripts/deploy-final.sh --dry-run

# Force reset migrations
./scripts/deploy-final.sh --force

# Rollback
./scripts/deploy-final.sh --rollback
```

## Command Line Options

### Deploy Script Options

| Option | Description |
|--------|-------------|
| `-h, --help` | Show help message |
| `-q, --quick` | Quick deployment (skip tests and validation) |
| `-d, --dry-run` | Dry run (show what would be done) |
| `-f, --force` | Force reset migrations if conflicts |
| `-r, --rollback` | Rollback to previous deployment |
| `--skip-tests` | Skip test suite |
| `--skip-build` | Skip build process |
| `--skip-migration` | Skip database migration |
| `--skip-functions` | Skip edge functions deployment |
| `--build-timeout=N` | Set build timeout (default: 300s) |
| `--deploy-timeout=N` | Set deploy timeout (default: 600s) |

### Validation Script Options

| Option | Description |
|--------|-------------|
| `-h, --help` | Show help message |
| `-t, --timeout` | Set timeout for requests (default: 30s) |
| `-r, --retries` | Set max retries (default: 3) |

## Deployment Process

### Step 1: Environment Validation
- Checks required tools (node, npm, pnpm, supabase, vercel)
- Validates Node.js version (≥18.0.0)
- Verifies all required environment variables
- Tests Supabase and Vercel connections

### Step 2: Pre-deployment Backup
- Creates timestamped backup directory
- Backs up package.json, vercel.json
- Stores current git commit hash
- Saves environment variables (without secrets)

### Step 3: Database Migration
- Links to Supabase project
- Pushes database migrations with auto-accept
- Handles migration conflicts with force reset option
- Validates migration success

### Step 4: Edge Functions Deployment
- Deploys all functions in `supabase/functions/`
- Uses auto-accept for prompts
- Validates function deployment

### Step 5: Build Validation
- Installs dependencies with pnpm
- Runs production build
- Validates build output

### Step 6: Type Checking
- Runs TypeScript type checking
- Runs ESLint validation
- Ensures code quality

### Step 7: Vercel Deployment
- Deploys to Vercel production
- Uses auto-accept for all prompts
- Handles timeout and retries

### Step 8: Post-Deploy Validation
- Waits for deployment to be ready
- Runs comprehensive endpoint testing
- Validates SSL certificates
- Checks performance metrics
- Tests security headers

### Step 9: Final Status
- Displays deployment summary
- Shows important URLs
- Provides post-deployment checklist

## Environment Variables

### Required Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# External APIs
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
TICKETMASTER_API_KEY=your-ticketmaster-api-key
SETLISTFM_API_KEY=your-setlistfm-api-key

# Security
JWT_SECRET=your-jwt-secret
CRON_SECRET=your-cron-secret

# App Configuration
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_APP_ENV=production
```

### Optional Variables

```bash
# Vercel
VERCEL_TOKEN=your-vercel-token  # For CI/CD
VERCEL_ANALYTICS_ID=your-analytics-id

# Performance
FORCE_RESET=true  # Force reset migrations
```

## Auto-Accept Strategies

The deployment script uses multiple strategies to auto-accept prompts:

1. **Echo piping**: `echo "y" | command`
2. **Flag-based**: `command --yes`, `command -y`
3. **Timeout protection**: `timeout 30 command`
4. **Expect fallback**: Uses `expect` if available

## Error Handling

### Automatic Rollback
- Triggers on any deployment failure
- Restores from backup if available
- Logs all rollback actions
- Provides clear error messages

### Comprehensive Logging
- Timestamped logs for each deployment
- Separate error logs
- Deployment-specific log directories
- Structured log format

### Timeout Protection
- Build timeout: 300s (5 minutes)
- Deploy timeout: 600s (10 minutes)
- Test timeout: 120s (2 minutes)
- Database timeout: 180s (3 minutes)

## Post-Deployment Validation

### Endpoint Testing
- Homepage accessibility
- API health endpoints
- Search functionality
- Critical user flows

### Performance Testing
- Response time validation
- SSL certificate verification
- Security headers check
- Lighthouse performance score

### Security Validation
- Secret exposure detection
- Environment variable validation
- CORS configuration check
- Security headers verification

## File Structure

```
scripts/
├── deploy-final.sh       # Main deployment script
├── validate-deployment.sh # Post-deployment validation
└── deploy-prod.sh        # Legacy deployment script

logs/
└── deployment/
    ├── deployment_TIMESTAMP.log
    ├── errors_TIMESTAMP.log
    └── rollback_TIMESTAMP.log

backups/
└── TIMESTAMP/
    ├── package.json.backup
    ├── vercel.json.backup
    ├── env.backup
    └── git_commit.backup
```

## Troubleshooting

### Common Issues

#### Missing Environment Variables
```bash
# Check which variables are missing
pnpm final --dry-run

# Set missing variables
export MISSING_VAR=value
```

#### Migration Conflicts
```bash
# Force reset migrations
pnpm deploy:force
```

#### Build Failures
```bash
# Skip build for quick testing
pnpm final --skip-build
```

#### Deployment Timeouts
```bash
# Increase timeout
./scripts/deploy-final.sh --deploy-timeout=1200
```

### Debug Mode
```bash
# Enable verbose logging
set -x
pnpm final
```

### Manual Rollback
```bash
# Automatic rollback
pnpm deploy:rollback

# Manual rollback
git checkout HEAD~1
pnpm final
```

## Best Practices

### Before Deployment
1. **Test locally**: `pnpm dev`
2. **Run tests**: `pnpm test:all`
3. **Check types**: `pnpm type-check`
4. **Lint code**: `pnpm lint`

### During Deployment
1. **Monitor logs**: Watch deployment logs for errors
2. **Validate endpoints**: Check critical functionality
3. **Monitor performance**: Watch response times

### After Deployment
1. **Run validation**: `./scripts/validate-deployment.sh`
2. **Check monitoring**: Verify metrics collection
3. **Test user flows**: Validate critical paths

## CI/CD Integration

### GitHub Actions
```yaml
name: Deploy to Production
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy
        run: pnpm final --quick
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

### Vercel Integration
The deployment script automatically configures:
- Cron jobs for data synchronization
- Environment variables
- Function timeouts
- Security headers

## Support

### Log Analysis
```bash
# View recent deployments
ls -la logs/deployment/

# Check specific deployment
cat logs/deployment/deployment_TIMESTAMP.log

# Check errors
cat logs/deployment/errors_TIMESTAMP.log
```

### Health Checks
```bash
# Check deployment health
curl https://your-app.vercel.app/api/health

# Check sync health
curl https://your-app.vercel.app/api/sync/health
```

### Performance Monitoring
```bash
# Run performance validation
./scripts/validate-deployment.sh --timeout 60

# Check specific metrics
curl https://your-app.vercel.app/api/monitoring/performance
```

## Advanced Usage

### Custom Configuration
```bash
# Override defaults
export BUILD_TIMEOUT=600
export DEPLOY_TIMEOUT=1200
pnpm final
```

### Multiple Environments
```bash
# Staging deployment
NEXT_PUBLIC_APP_URL=https://staging.myapp.com pnpm final

# Production deployment
NEXT_PUBLIC_APP_URL=https://myapp.com pnpm final
```

### Batch Deployment
```bash
# Deploy multiple projects
for project in app1 app2 app3; do
  cd $project
  pnpm final --quick
  cd ..
done
```

---

## Summary

The MySetlist deployment system provides:

✅ **Single command deployment** - `pnpm final`
✅ **Auto-accept all prompts** - No manual intervention needed
✅ **Comprehensive error handling** - Automatic rollback on failures
✅ **Ultra-efficient execution** - Parallel operations where possible
✅ **Complete logging** - Detailed logs for debugging
✅ **Post-deployment validation** - Ensures everything works
✅ **Rollback strategies** - Quick recovery from issues

For support or questions, check the logs in `logs/deployment/` or run `pnpm final --help`.