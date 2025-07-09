#!/bin/bash

# 🧪 MySetlist Deployment Validation Script
# ========================================
# Validates that deployment is working correctly
# Usage: ./scripts/validate-deployment.sh [URL]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_URL="${1:-${NEXT_PUBLIC_APP_URL:-https://mysetlist.vercel.app}}"
TIMEOUT=30
MAX_RETRIES=3

# Test results
PASSED_TESTS=0
FAILED_TESTS=0
TOTAL_TESTS=0

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] ✅ $1${NC}"
    ((PASSED_TESTS++))
}

error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ❌ $1${NC}"
    ((FAILED_TESTS++))
}

warning() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠️  $1${NC}"
}

# Test function with retries
test_endpoint() {
    local url="$1"
    local description="$2"
    local expected_status="${3:-200}"
    local retry_count=0
    
    ((TOTAL_TESTS++))
    
    log "Testing: $description"
    log "URL: $url"
    
    while [ $retry_count -lt $MAX_RETRIES ]; do
        if response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" 2>/dev/null); then
            if [ "$response" = "$expected_status" ]; then
                success "$description (HTTP $response)"
                return 0
            else
                warning "$description returned HTTP $response (expected $expected_status)"
            fi
        else
            warning "Connection failed to $url (attempt $((retry_count + 1))/$MAX_RETRIES)"
        fi
        
        ((retry_count++))
        if [ $retry_count -lt $MAX_RETRIES ]; then
            sleep 2
        fi
    done
    
    error "$description (failed after $MAX_RETRIES attempts)"
    return 1
}

# Test function for JSON response
test_json_endpoint() {
    local url="$1"
    local description="$2"
    local expected_field="$3"
    local retry_count=0
    
    ((TOTAL_TESTS++))
    
    log "Testing JSON: $description"
    log "URL: $url"
    
    while [ $retry_count -lt $MAX_RETRIES ]; do
        if response=$(curl -s --max-time $TIMEOUT "$url" 2>/dev/null); then
            if echo "$response" | jq -e ".$expected_field" >/dev/null 2>&1; then
                success "$description (JSON valid with field: $expected_field)"
                return 0
            else
                warning "$description - JSON response missing field: $expected_field"
            fi
        else
            warning "Connection failed to $url (attempt $((retry_count + 1))/$MAX_RETRIES)"
        fi
        
        ((retry_count++))
        if [ $retry_count -lt $MAX_RETRIES ]; then
            sleep 2
        fi
    done
    
    error "$description (failed after $MAX_RETRIES attempts)"
    return 1
}

# Main validation function
main() {
    echo ""
    echo "🧪 MySetlist Deployment Validation"
    echo "=================================="
    echo "Testing deployment at: $DEPLOYMENT_URL"
    echo ""
    
    # Test 1: Homepage
    test_endpoint "$DEPLOYMENT_URL" "Homepage"
    
    # Test 2: Search page
    test_endpoint "$DEPLOYMENT_URL/search" "Search page"
    
    # Test 3: Artists page
    test_endpoint "$DEPLOYMENT_URL/artists" "Artists page" "200"
    
    # Test 4: Shows page
    test_endpoint "$DEPLOYMENT_URL/shows" "Shows page"
    
    # Test 5: API Health endpoint
    test_endpoint "$DEPLOYMENT_URL/api/health" "API Health endpoint"
    
    # Test 6: Sync health endpoint
    test_endpoint "$DEPLOYMENT_URL/api/sync/health" "Sync health endpoint"
    
    # Test 7: Artists API
    test_json_endpoint "$DEPLOYMENT_URL/api/artists" "Artists API" "artists"
    
    # Test 8: Shows API
    test_json_endpoint "$DEPLOYMENT_URL/api/shows" "Shows API" "shows"
    
    # Test 9: Featured content
    test_endpoint "$DEPLOYMENT_URL/api/featured" "Featured content API"
    
    # Test 10: Search API
    test_json_endpoint "$DEPLOYMENT_URL/api/search/artists?q=test" "Search API" "artists"
    
    # Test 11: Trending API
    test_endpoint "$DEPLOYMENT_URL/api/trending" "Trending API"
    
    # Test 12: Robots.txt
    test_endpoint "$DEPLOYMENT_URL/robots.txt" "Robots.txt"
    
    # Test 13: Sitemap
    test_endpoint "$DEPLOYMENT_URL/sitemap.xml" "Sitemap"
    
    # Test 14: Manifest
    test_endpoint "$DEPLOYMENT_URL/manifest.json" "PWA Manifest"
    
    # Test 15: Static assets
    test_endpoint "$DEPLOYMENT_URL/_next/static" "Static assets directory" "200"
    
    # Test 16: API CORS headers
    log "Testing CORS headers..."
    ((TOTAL_TESTS++))
    if cors_headers=$(curl -s -I --max-time $TIMEOUT "$DEPLOYMENT_URL/api/health" 2>/dev/null | grep -i "access-control-allow-origin"); then
        success "CORS headers configured"
    else
        error "CORS headers missing"
    fi
    
    # Test 17: Security headers
    log "Testing security headers..."
    ((TOTAL_TESTS++))
    if security_headers=$(curl -s -I --max-time $TIMEOUT "$DEPLOYMENT_URL" 2>/dev/null | grep -E "(X-Content-Type-Options|X-Frame-Options|X-XSS-Protection)"); then
        success "Security headers configured"
    else
        error "Security headers missing"
    fi
    
    # Test 18: Response time
    log "Testing response time..."
    ((TOTAL_TESTS++))
    if response_time=$(curl -s -o /dev/null -w "%{time_total}" --max-time $TIMEOUT "$DEPLOYMENT_URL" 2>/dev/null); then
        if (( $(echo "$response_time < 3.0" | bc -l) )); then
            success "Response time acceptable (${response_time}s)"
        else
            warning "Response time slow (${response_time}s)"
        fi
    else
        error "Response time test failed"
    fi
    
    # Test 19: SSL Certificate
    log "Testing SSL certificate..."
    ((TOTAL_TESTS++))
    if echo | openssl s_client -connect "${DEPLOYMENT_URL#https://}:443" -servername "${DEPLOYMENT_URL#https://}" 2>/dev/null | grep -q "Verify return code: 0"; then
        success "SSL certificate valid"
    else
        warning "SSL certificate issues detected"
    fi
    
    # Test 20: Performance - First Contentful Paint
    log "Testing basic performance..."
    ((TOTAL_TESTS++))
    if command -v lighthouse >/dev/null 2>&1; then
        if lighthouse_score=$(lighthouse "$DEPLOYMENT_URL" --only-categories=performance --output=json --quiet 2>/dev/null | jq -r '.categories.performance.score'); then
            if (( $(echo "$lighthouse_score > 0.8" | bc -l) )); then
                success "Performance score good (${lighthouse_score})"
            else
                warning "Performance score could be better (${lighthouse_score})"
            fi
        else
            warning "Performance test failed"
        fi
    else
        warning "Lighthouse not available for performance testing"
    fi
    
    # Summary
    echo ""
    echo "📊 Validation Summary"
    echo "===================="
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Success Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo "🎉 All tests passed! Deployment is healthy."
        exit 0
    elif [ $FAILED_TESTS -lt 3 ]; then
        echo "⚠️  Some tests failed, but deployment appears mostly functional."
        exit 1
    else
        echo "❌ Multiple test failures detected. Deployment may have issues."
        exit 2
    fi
}

# Check dependencies
check_dependencies() {
    local missing_deps=()
    
    if ! command -v curl >/dev/null 2>&1; then
        missing_deps+=("curl")
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        missing_deps+=("jq")
    fi
    
    if ! command -v bc >/dev/null 2>&1; then
        missing_deps+=("bc")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        error "Missing required dependencies: ${missing_deps[*]}"
        echo "Please install missing dependencies and try again."
        exit 1
    fi
}

# Help function
show_help() {
    echo "MySetlist Deployment Validation Script"
    echo ""
    echo "Usage: $0 [OPTIONS] [URL]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -t, --timeout  Set timeout for requests (default: 30s)"
    echo "  -r, --retries  Set max retries (default: 3)"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Test default URL"
    echo "  $0 https://mysetlist.vercel.app       # Test specific URL"
    echo "  $0 -t 60 https://myapp.com            # Test with 60s timeout"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -r|--retries)
            MAX_RETRIES="$2"
            shift 2
            ;;
        http*://*)
            DEPLOYMENT_URL="$1"
            shift
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Check dependencies and run validation
check_dependencies
main