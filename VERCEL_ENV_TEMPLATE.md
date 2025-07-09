# Vercel Environment Variables Configuration Template

## Required Environment Variables for MySetlist Production Deployment

### 🚨 Critical Variables (Must be set in Vercel)

#### App Configuration
```
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_APP_ENV=production
NODE_ENV=production
```

#### Supabase Configuration
```
NEXT_PUBLIC_SUPABASE_URL=https://eotvxxipggnqxonvzkks.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdHZ4eGlwZ2ducXhvbnZ6a2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MzY0NjYsImV4cCI6MjA2NzUxMjQ2Nn0.jOetqdvld75LwNpzlxGXiHvMaGaO1FIeebkcObwYKhc
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdHZ4eGlwZ2ducXhvbnZ6a2tzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkzNjQ2NiwiZXhwIjoyMDY3NTEyNDY2fQ.UcCqgn45-JiykTwgTNsRScPJm8Q74K57TL5_3lO0IAI
```

#### External API Keys
```
SPOTIFY_CLIENT_ID=2946864dc822469b9c672292ead45f43
SPOTIFY_CLIENT_SECRET=feaf0fc901124b839b11e02f97d18a8d
TICKETMASTER_API_KEY=k8GrSAkbFaN0w7qDxGl7ohr8LwdAQm9b
SETLISTFM_API_KEY=xkutflW-aRy_Df9rF4OkJyCsHBYN88V37EBL
```

#### Security
```
JWT_SECRET=7uXJjiJ3F5rZAu7LJ2I7KwbS5wMtiBtzuy/dqkcMaKnKnp+XHdp8vZDqkEhvBOit8m/93PuY44YMNvq+Fu0bRg==
CRON_SECRET=6155002300
```

## 🔧 Vercel Environment Configuration Steps

### 1. Set Environment Variables in Vercel Dashboard
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable with appropriate environments:
   - **Production**: For live deployment
   - **Preview**: For PR deployments
   - **Development**: For local development

### 2. Environment-Specific Settings

#### Production Environment
```
NEXT_PUBLIC_APP_URL=https://mysetlist.com
NEXT_PUBLIC_APP_ENV=production
NODE_ENV=production
```

#### Preview Environment
```
NEXT_PUBLIC_APP_URL=https://preview-mysetlist.vercel.app
NEXT_PUBLIC_APP_ENV=preview
NODE_ENV=production
```

#### Development Environment
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_ENV=development
NODE_ENV=development
```

## 🛡️ Security Best Practices

### Secret Variables (Never expose to client)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SPOTIFY_CLIENT_SECRET`
- `TICKETMASTER_API_KEY`
- `SETLISTFM_API_KEY`
- `JWT_SECRET`
- `CRON_SECRET`

### Public Variables (Can be exposed to client)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_ENV`

## 📋 Deployment Checklist

### Before Deployment
- [ ] All environment variables added to Vercel
- [ ] Production URL updated in `NEXT_PUBLIC_APP_URL`
- [ ] Supabase Auth URLs updated to match production domain
- [ ] API rate limits configured for production
- [ ] All secrets rotated for production use

### After Deployment
- [ ] Test all API endpoints work with production environment
- [ ] Verify Supabase connection and auth flow
- [ ] Check external API integrations (Spotify, Ticketmaster, Setlist.fm)
- [ ] Test cron jobs functionality
- [ ] Monitor for any environment-related errors

## 🚀 Quick Deploy Command

```bash
# Deploy to Vercel with environment variables
vercel --prod

# Or using Vercel CLI with environment file
vercel env pull .env.vercel.local
```

## 🔍 Environment Variables Validation

### Runtime Validation
The application includes runtime validation to ensure all required environment variables are present:

```typescript
// Environment validation is handled in libs/env.ts
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'TICKETMASTER_API_KEY',
  'SETLISTFM_API_KEY',
  'JWT_SECRET',
  'CRON_SECRET'
];
```

### Build-Time Validation
Environment variables are validated during build to catch missing variables early:

```bash
# Build command validates environment
npm run build
```

## 📝 Notes

1. **Domain Configuration**: Update `NEXT_PUBLIC_APP_URL` to match your actual domain
2. **Supabase Auth**: Ensure your Supabase project's Auth URLs include your production domain
3. **API Keys**: These are real API keys from the existing configuration - rotate them for production
4. **CORS**: Update any CORS settings to include your production domain
5. **Rate Limiting**: Production rate limits are configured in vercel.json

## 🆘 Troubleshooting

### Common Issues
- **Build fails**: Check if all required environment variables are set
- **Auth not working**: Verify Supabase Auth URLs include your domain
- **API calls fail**: Ensure API keys are valid and rate limits aren't exceeded
- **Images not loading**: Check Supabase storage bucket configuration

### Debug Commands
```bash
# Check environment variables in Vercel
vercel env ls

# Pull environment variables locally
vercel env pull .env.vercel.local

# Test build locally with production env
NODE_ENV=production npm run build
```