#!/bin/bash

# =============================================================================
# Frontend Performance Validation Script
# =============================================================================
# This script validates that performance optimizations are properly configured
# =============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Frontend Performance Validation ===${NC}"
echo ""

# Check if we're in the frontend directory
if [ ! -f "package.json" ] || [ ! -f "next.config.js" ]; then
    echo -e "${RED}Error: Must run from frontend directory${NC}"
    exit 1
fi

# 1. Check Next.js configuration
echo -e "${BLUE}1. Checking Next.js configuration...${NC}"

if grep -q "unoptimized: false" next.config.js; then
    echo -e "${GREEN}✓ Image optimization is enabled${NC}"
else
    echo -e "${RED}✗ Image optimization is not enabled${NC}"
fi

if grep -q "swcMinify: true" next.config.js; then
    echo -e "${GREEN}✓ SWC minification is enabled${NC}"
else
    echo -e "${RED}✗ SWC minification is not enabled${NC}"
fi

if grep -q "splitChunks" next.config.js; then
    echo -e "${GREEN}✓ Code splitting is configured${NC}"
else
    echo -e "${RED}✗ Code splitting is not configured${NC}"
fi

# 2. Check for lazy loading components
echo ""
echo -e "${BLUE}2. Checking lazy loading setup...${NC}"

if [ -f "src/components/utils/LazyLoad.tsx" ]; then
    echo -e "${GREEN}✓ LazyLoad utility exists${NC}"
else
    echo -e "${RED}✗ LazyLoad utility not found${NC}"
fi

if [ -f "src/components/home/HeroSection.tsx" ] && [ -f "src/components/home/FeaturesSection.tsx" ]; then
    echo -e "${GREEN}✓ Home page components are split${NC}"
else
    echo -e "${RED}✗ Home page components are not split${NC}"
fi

# 3. Check for performance monitoring
echo ""
echo -e "${BLUE}3. Checking performance monitoring...${NC}"

if [ -f "src/lib/performance.ts" ]; then
    echo -e "${GREEN}✓ Performance monitoring utilities exist${NC}"
else
    echo -e "${RED}✗ Performance monitoring utilities not found${NC}"
fi

# 4. Check package.json scripts
echo ""
echo -e "${BLUE}4. Checking build scripts...${NC}"

if grep -q '"analyze":' package.json; then
    echo -e "${GREEN}✓ Bundle analyzer script is configured${NC}"
else
    echo -e "${RED}✗ Bundle analyzer script not found${NC}"
fi

# 5. Check dependencies
echo ""
echo -e "${BLUE}5. Checking dependencies...${NC}"

if grep -q "webpack-bundle-analyzer" package.json; then
    echo -e "${GREEN}✓ webpack-bundle-analyzer is installed${NC}"
else
    echo -e "${YELLOW}⚠ webpack-bundle-analyzer not installed. Run: npm install -D webpack-bundle-analyzer${NC}"
fi

# 6. Build check (optional)
echo ""
echo -e "${BLUE}6. Build validation (optional)...${NC}"
read -p "Run production build to validate? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Building production bundle...${NC}"
    npm run build
    
    # Check build output
    if [ -d ".next" ]; then
        echo -e "${GREEN}✓ Build completed successfully${NC}"
        
        # Check for chunk files
        if ls .next/static/chunks/*-*.js 1> /dev/null 2>&1; then
            echo -e "${GREEN}✓ Code splitting is working (chunk files found)${NC}"
        else
            echo -e "${YELLOW}⚠ No chunk files found${NC}"
        fi
    else
        echo -e "${RED}✗ Build failed${NC}"
    fi
fi

# 7. Summary
echo ""
echo -e "${BLUE}=== Validation Summary ===${NC}"
echo ""

# Count checks
TOTAL_CHECKS=8
PASSED_CHECKS=0

# Rerun checks silently for summary
grep -q "unoptimized: false" next.config.js && ((PASSED_CHECKS++))
grep -q "swcMinify: true" next.config.js && ((PASSED_CHECKS++))
grep -q "splitChunks" next.config.js && ((PASSED_CHECKS++))
[ -f "src/components/utils/LazyLoad.tsx" ] && ((PASSED_CHECKS++))
[ -f "src/components/home/HeroSection.tsx" ] && ((PASSED_CHECKS++))
[ -f "src/lib/performance.ts" ] && ((PASSED_CHECKS++))
grep -q '"analyze":' package.json && ((PASSED_CHECKS++))
grep -q "webpack-bundle-analyzer" package.json && ((PASSED_CHECKS++))

echo -e "Passed: ${GREEN}$PASSED_CHECKS/$TOTAL_CHECKS${NC}"

if [ $PASSED_CHECKS -eq $TOTAL_CHECKS ]; then
    echo -e "${GREEN}✅ All performance optimizations are properly configured!${NC}"
else
    echo -e "${YELLOW}⚠ Some optimizations need attention${NC}"
fi

echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Install missing dependencies: npm install"
echo "2. Run bundle analysis: npm run analyze"
echo "3. Test in production: npm run build && npm start"
echo "4. Run Lighthouse audit in Chrome DevTools"