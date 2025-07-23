#!/bin/bash

# =============================================================================
# UI/UX Improvements Validation Script
# =============================================================================
# This script validates that all UI/UX improvements have been implemented
# =============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== UI/UX Improvements Validation ===${NC}"
echo ""

# Check if we're in the frontend directory
if [ ! -f "package.json" ] || [ ! -f "next.config.js" ]; then
    echo -e "${RED}Error: Must run from frontend directory${NC}"
    exit 1
fi

# 1. Check Loading States Components
echo -e "${BLUE}1. Checking Loading States Implementation...${NC}"

if [ -f "src/components/ui/loading-states.tsx" ]; then
    echo -e "${GREEN}✓ Loading states component exists${NC}"
    
    # Check for specific components
    if grep -q "Spinner" src/components/ui/loading-states.tsx; then
        echo -e "${GREEN}  ✓ Spinner component implemented${NC}"
    fi
    if grep -q "Skeleton" src/components/ui/loading-states.tsx; then
        echo -e "${GREEN}  ✓ Skeleton loader implemented${NC}"
    fi
    if grep -q "PageLoader" src/components/ui/loading-states.tsx; then
        echo -e "${GREEN}  ✓ Page loader implemented${NC}"
    fi
else
    echo -e "${RED}✗ Loading states component not found${NC}"
fi

# 2. Check Error States Components
echo ""
echo -e "${BLUE}2. Checking Error States Implementation...${NC}"

if [ -f "src/components/ui/error-states.tsx" ]; then
    echo -e "${GREEN}✓ Error states component exists${NC}"
    
    if grep -q "ErrorState" src/components/ui/error-states.tsx; then
        echo -e "${GREEN}  ✓ ErrorState component implemented${NC}"
    fi
    if grep -q "NetworkError" src/components/ui/error-states.tsx; then
        echo -e "${GREEN}  ✓ NetworkError component implemented${NC}"
    fi
    if grep -q "FieldError" src/components/ui/error-states.tsx; then
        echo -e "${GREEN}  ✓ FieldError component implemented${NC}"
    fi
else
    echo -e "${RED}✗ Error states component not found${NC}"
fi

# 3. Check Accessibility Components
echo ""
echo -e "${BLUE}3. Checking Accessibility Implementation...${NC}"

if [ -f "src/components/ui/accessibility.tsx" ]; then
    echo -e "${GREEN}✓ Accessibility component exists${NC}"
    
    if grep -q "SkipToContent" src/components/ui/accessibility.tsx; then
        echo -e "${GREEN}  ✓ Skip navigation implemented${NC}"
    fi
    if grep -q "LiveRegion" src/components/ui/accessibility.tsx; then
        echo -e "${GREEN}  ✓ Live regions for screen readers${NC}"
    fi
    if grep -q "FocusTrap" src/components/ui/accessibility.tsx; then
        echo -e "${GREEN}  ✓ Focus trap for modals${NC}"
    fi
else
    echo -e "${RED}✗ Accessibility component not found${NC}"
fi

# 4. Check Header Improvements
echo ""
echo -e "${BLUE}4. Checking Header Component Improvements...${NC}"

if grep -q "aria-label" src/components/layout/Header.tsx; then
    echo -e "${GREEN}✓ ARIA labels added to header${NC}"
fi

if grep -q "aria-expanded" src/components/layout/Header.tsx; then
    echo -e "${GREEN}✓ ARIA expanded state for mobile menu${NC}"
fi

if grep -q "focus-visible" src/components/layout/Header.tsx; then
    echo -e "${GREEN}✓ Focus states improved${NC}"
fi

# 5. Check Input Component Improvements
echo ""
echo -e "${BLUE}5. Checking Input Component Improvements...${NC}"

if grep -q "aria-invalid" src/components/ui/input.tsx; then
    echo -e "${GREEN}✓ ARIA invalid state for inputs${NC}"
fi

if grep -q "aria-describedby" src/components/ui/input.tsx; then
    echo -e "${GREEN}✓ ARIA describedby for error messages${NC}"
fi

# 6. Check Button Component Improvements
echo ""
echo -e "${BLUE}6. Checking Button Component Improvements...${NC}"

if grep -q "aria-busy" src/components/ui/button.tsx; then
    echo -e "${GREEN}✓ ARIA busy state for loading buttons${NC}"
fi

if grep -q "loading" src/components/ui/button.tsx; then
    echo -e "${GREEN}✓ Loading state prop for buttons${NC}"
fi

# 7. Check Global CSS Improvements
echo ""
echo -e "${BLUE}7. Checking Global CSS Improvements...${NC}"

if grep -q "high-contrast" src/app/globals.css; then
    echo -e "${GREEN}✓ High contrast mode support${NC}"
fi

if grep -q "reduce-motion" src/app/globals.css; then
    echo -e "${GREEN}✓ Reduced motion support${NC}"
fi

if grep -q "touch-target" src/app/globals.css; then
    echo -e "${GREEN}✓ Touch target sizing utilities${NC}"
fi

# 8. Check Footer Responsiveness
echo ""
echo -e "${BLUE}8. Checking Footer Component Improvements...${NC}"

if grep -q "expandedSections" src/components/layout/Footer.tsx; then
    echo -e "${GREEN}✓ Mobile accordion implementation${NC}"
fi

if grep -q "aria-controls" src/components/layout/Footer.tsx; then
    echo -e "${GREEN}✓ ARIA controls for footer sections${NC}"
fi

# 9. Check Form Field Component
echo ""
echo -e "${BLUE}9. Checking Form Field Component...${NC}"

if [ -f "src/components/ui/form-field.tsx" ]; then
    echo -e "${GREEN}✓ Form field component exists${NC}"
    
    if grep -q "errorMessage" src/components/ui/form-field.tsx; then
        echo -e "${GREEN}  ✓ Error message handling${NC}"
    fi
    if grep -q "helperText" src/components/ui/form-field.tsx; then
        echo -e "${GREEN}  ✓ Helper text support${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Form field component not found${NC}"
fi

# 10. Summary
echo ""
echo -e "${BLUE}=== Validation Summary ===${NC}"
echo ""

# Count improvements
TOTAL_CHECKS=20
IMPLEMENTED=0

# List of files to check
declare -a FILES=(
    "src/components/ui/loading-states.tsx"
    "src/components/ui/error-states.tsx"
    "src/components/ui/accessibility.tsx"
    "src/components/ui/form-field.tsx"
    "src/components/providers/AccessibilityProvider.tsx"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        ((IMPLEMENTED++))
    fi
done

# Additional pattern checks
grep -q "aria-label" src/components/layout/Header.tsx && ((IMPLEMENTED++))
grep -q "aria-expanded" src/components/layout/Header.tsx && ((IMPLEMENTED++))
grep -q "focus-visible" src/components/layout/Header.tsx && ((IMPLEMENTED++))
grep -q "aria-invalid" src/components/ui/input.tsx && ((IMPLEMENTED++))
grep -q "aria-describedby" src/components/ui/input.tsx && ((IMPLEMENTED++))
grep -q "aria-busy" src/components/ui/button.tsx && ((IMPLEMENTED++))
grep -q "loading" src/components/ui/button.tsx && ((IMPLEMENTED++))
grep -q "high-contrast" src/app/globals.css && ((IMPLEMENTED++))
grep -q "reduce-motion" src/app/globals.css && ((IMPLEMENTED++))
grep -q "touch-target" src/app/globals.css && ((IMPLEMENTED++))
grep -q "expandedSections" src/components/layout/Footer.tsx && ((IMPLEMENTED++))

echo -e "Implemented: ${GREEN}$IMPLEMENTED/$TOTAL_CHECKS${NC}"

if [ $IMPLEMENTED -ge 18 ]; then
    echo -e "${GREEN}✅ UI/UX improvements successfully implemented!${NC}"
else
    echo -e "${YELLOW}⚠ Some improvements still need attention${NC}"
fi

echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Test all components with a screen reader"
echo "2. Run Lighthouse accessibility audit"
echo "3. Test on real mobile devices"
echo "4. Verify keyboard navigation works throughout"
echo "5. Test with high contrast mode enabled"