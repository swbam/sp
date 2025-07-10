# 🚀 MySetlist Deployment Hardening - Quick Start Guide

## 📋 Prerequisites

1. **Required Environment Variables**
   ```bash
   # Deployment
   VERCEL_TOKEN=your-vercel-token
   VERCEL_ORG_ID=your-org-id
   VERCEL_PROJECT_ID=your-project-id
   
   # Monitoring
   SENTRY_DSN=your-sentry-dsn
   SENTRY_AUTH_TOKEN=your-sentry-auth-token
   
   # Security
   SNYK_TOKEN=your-snyk-token
   
   # Notifications
   SLACK_WEBHOOK_URL=your-slack-webhook
   ```

2. **Required Dependencies**
   ```bash
   npm install @sentry/nextjs @vercel/analytics @vercel/speed-insights
   ```

## 🔧 Setup Instructions

### 1. Initialize Deployment Hardening
```bash
# Set up monitoring systems
npm run monitoring:setup

# Create disaster recovery plan
npm run dr:plan

# Run initial security scan
npm run security:scan
```

### 2. Configure GitHub Actions
The enhanced deployment pipeline is already configured in `.github/workflows/enhanced-deployment.yml`. Add these secrets to your GitHub repository:

```bash
# Required Secrets
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
SENTRY_DSN
SENTRY_AUTH_TOKEN
SNYK_TOKEN
SLACK_WEBHOOK_URL
```

### 3. Test the System
```bash
# Test blue-green deployment
npm run deploy:hardened

# Test rollback capability
npm run deploy:rollback:auto

# Test disaster recovery
npm run backup:test

# Check system health
npm run health:production
```

## 🚀 Common Deployment Commands

### Standard Deployment
```bash
# Full production deployment with all safety checks
npm run deploy:hardened

# Quick deployment (skip some checks)
npm run deploy:quick

# Canary deployment (gradual rollout)
npm run deploy:canary
```

### Emergency Procedures
```bash
# Immediate rollback
npm run deploy:rollback:auto

# Check deployment status
npm run deploy:status

# Health check
npm run health:production
```

### Security & Compliance
```bash
# Run security scan
npm run security:scan

# Generate security report
npm run security:report

# Test monitoring alerts
npm run monitoring:test
```

### Backup & Recovery
```bash
# Create backup
npm run backup:create

# Restore from backup
npm run backup:restore <backup-id>

# Test recovery procedures
npm run backup:test
```

## 🔍 Monitoring & Alerts

### Health Checks
- **Production**: `https://mysetlist.com/api/monitoring/health`
- **Staging**: `https://staging.mysetlist.com/api/monitoring/health`

### Key Metrics
- **Uptime**: 99.9% target
- **Error Rate**: < 0.1%
- **Response Time**: < 2 seconds
- **Deployment Time**: < 6 minutes

### Alert Channels
- **Slack**: `#production` channel
- **Email**: Critical alerts only
- **Sentry**: Real-time error tracking

## 📊 Deployment Status Dashboard

Check deployment status at any time:
```bash
npm run deploy:status
```

Example output:
```json
{
  "current": {
    "id": "deploy-abc123",
    "timestamp": 1720825200000,
    "status": "active",
    "url": "https://mysetlist.com"
  },
  "previous": {
    "id": "deploy-def456",
    "timestamp": 1720821600000,
    "status": "archived"
  }
}
```

## 🛠️ Troubleshooting

### Common Issues

1. **Deployment Stuck**
   ```bash
   # Check deployment status
   npm run deploy:status
   
   # Force rollback if needed
   npm run deploy:rollback:auto
   ```

2. **Health Check Failures**
   ```bash
   # Check specific health metrics
   npm run health:production
   
   # View detailed logs
   tail -f logs/deployment/deployment_*.log
   ```

3. **Security Scan Failures**
   ```bash
   # Run detailed security scan
   npm run security:report
   
   # View security report
   open security-reports/security-report-*.html
   ```

## 📈 Performance Optimization

### Monitoring Performance
```bash
# Monitor real-time metrics
curl https://mysetlist.com/api/monitoring/metrics

# Check Core Web Vitals
npm run test:lighthouse

# Performance testing
npm run test:performance
```

### Optimization Commands
```bash
# Analyze bundle size
npm run build:analyze

# Optimize database queries
npm run optimize:database

# Validate optimizations
npm run validate:performance
```

## 🔐 Security Best Practices

### Regular Security Tasks
```bash
# Weekly security scan
npm run security:scan

# Monthly compliance report
npm run security:report

# Quarterly disaster recovery test
npm run backup:test
```

### Security Monitoring
- **Dependency vulnerabilities**: Automated scanning
- **Code security**: Pre-commit hooks
- **Runtime security**: Sentry monitoring
- **Infrastructure security**: Vercel configuration

## 📞 Support & Escalation

### Emergency Contacts
- **Primary**: `admin@mysetlist.com`
- **Secondary**: `support@mysetlist.com`
- **Escalation**: Slack `#production` channel

### Support Commands
```bash
# Generate support bundle
npm run support:bundle

# View system logs
npm run logs:view

# Check system status
npm run status:full
```

## 🎯 Success Metrics

### Deployment Success
- ✅ Zero-downtime deployments
- ✅ < 2 minute rollback time
- ✅ 100% health check pass rate
- ✅ Automated security scanning

### Monitoring Success
- ✅ < 30 second alert response
- ✅ 99.9% uptime monitoring
- ✅ Real-time error tracking
- ✅ Performance regression detection

### Security Success
- ✅ 100% vulnerability detection
- ✅ Compliance automation
- ✅ Audit trail completeness
- ✅ Incident response readiness

---

## 🚀 Getting Started Checklist

- [ ] Set up required environment variables
- [ ] Install monitoring dependencies
- [ ] Configure GitHub Actions secrets
- [ ] Run initial security scan
- [ ] Test deployment pipeline
- [ ] Validate rollback procedures
- [ ] Set up monitoring dashboards
- [ ] Create disaster recovery plan
- [ ] Test emergency procedures
- [ ] Configure alert channels

---

*For detailed documentation, see: DEPLOYMENT-HARDENING-COMPLETE-REPORT.md*