# Phase 12: Mobile & Accessibility E2E Tests

This directory contains end-to-end tests for Phase 12 of the BetterPrompts project, focusing on mobile experience (US-019) and accessibility (US-020).

## Overview

Phase 12 ensures that BetterPrompts provides an excellent experience for:
- Mobile users across all device sizes
- Users with disabilities who rely on assistive technologies
- Users who need accessible interfaces that comply with WCAG 2.1 AA standards

## Test Structure

```
phase12/
├── us-019-mobile-experience.spec.ts    # Mobile experience tests
├── us-020-accessibility.spec.ts        # Accessibility compliance tests
├── mobile-a11y-combined.spec.ts        # Combined mobile + a11y tests
├── utils/                              # Test utilities
│   ├── viewport-helper.ts              # Viewport management
│   ├── touch-gesture-simulator.ts      # Touch interaction testing
│   ├── accessibility-validator.ts      # WCAG compliance validation
│   └── screen-reader-helper.ts         # Screen reader simulation
├── playwright.config.ts                # Test configuration
├── package.json                        # Dependencies
├── run-tests.sh                        # Test runner script
└── README.md                          # This file
```

## User Stories

### US-019: Mobile Experience
**Story**: "As a mobile user, I want a seamless experience on my device"

**Acceptance Criteria**:
- ✅ All features work on mobile viewports (320px - 768px)
- ✅ Touch targets meet minimum size requirements (44x44px)
- ✅ Responsive design adapts to all screen sizes
- ✅ Touch gestures (tap, swipe, long press) work correctly
- ✅ No horizontal scrolling on mobile devices
- ✅ Forms are optimized for mobile input

### US-020: Accessibility
**Story**: "As a user with disabilities, I want full access to all features"

**Acceptance Criteria**:
- ✅ WCAG 2.1 AA compliance
- ✅ Full keyboard navigation support
- ✅ Screen reader compatibility
- ✅ Proper color contrast ratios (4.5:1 normal, 3:1 large text)
- ✅ Clear focus indicators
- ✅ Accessible forms with proper labels and error messages
- ✅ Proper heading hierarchy
- ✅ ARIA landmarks and labels

## Test Utilities

### ViewportHelper
Manages viewport sizes and responsive testing:
- Predefined viewport configurations (mobile, tablet, desktop)
- Orientation change testing
- Responsive breakpoint validation
- Element visibility checking

### TouchGestureSimulator
Simulates touch interactions:
- Tap, double tap, and long press gestures
- Swipe gestures in all directions
- Touch target size validation
- Touch target spacing checks
- Pinch-to-zoom simulation

### AccessibilityValidator
Validates WCAG compliance:
- Automated axe-core scanning
- Color contrast checking
- Keyboard navigation validation
- ARIA usage verification
- Form accessibility testing
- Landmark region validation

### ScreenReaderHelper
Simulates screen reader behavior:
- Accessible name/description retrieval
- Role identification
- Heading structure analysis
- Landmark detection
- Form field announcement testing
- Live region monitoring

## Running Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Ensure the application is running
npm run dev  # In the main project directory
```

### Run All Tests
```bash
./run-tests.sh
```

### Run Specific Test Suites
```bash
# Mobile experience tests only
./run-tests.sh mobile

# Accessibility tests only
./run-tests.sh a11y

# Combined tests only
./run-tests.sh combined
```

### Run with Specific Options
```bash
# Run in headed mode (see browser)
npm run test:headed

# Run with debugging
npm run test:debug

# Run on mobile devices only
npm run test:mobile-devices

# Run on all browsers
npm run test:all-browsers
```

### Run Individual Tests
```bash
# Run a specific test file
npx playwright test us-019-mobile-experience.spec.ts

# Run a specific test
npx playwright test -g "should display correctly on all mobile viewports"
```

## Test Configuration

### Environment Variables
Edit `.env` to configure:
- `BASE_URL`: Application URL (default: http://localhost:3000)
- `HEADLESS`: Run tests in headless mode (default: true)
- `TEST_TIMEOUT`: Test timeout in ms (default: 60000)
- `TEST_RETRIES`: Number of retries (default: 1)
- `TEST_WORKERS`: Parallel workers (default: 4)

### Viewport Configurations
Predefined viewports in `viewport-helper.ts`:
- Mobile Small: 320x568 (iPhone SE)
- Mobile Medium: 375x667 (iPhone 8)
- Mobile Large: 414x896 (iPhone 11 Pro)
- Tablet: 768x1024 (iPad)
- Desktop: 1920x1080

### Browser/Device Testing
Configured projects in `playwright.config.ts`:
- Desktop: Chrome, Firefox, Safari
- Mobile: Chrome (Pixel 5), Safari (iPhone 13)
- Tablet: Safari (iPad), Chrome (Galaxy Tab)
- Accessibility profiles: High contrast, reduced motion

## Test Reports

### HTML Report
After test execution:
```bash
npm run test:report
```

### Test Results
- `playwright-report/`: Interactive HTML report
- `test-results.json`: JSON format results
- `junit.xml`: JUnit format for CI integration
- `accessibility-audit.md`: Detailed accessibility findings
- `mobile-test-results.md`: Mobile testing summary
- `wcag-compliance-report.md`: WCAG compliance details

## Common Issues & Solutions

### Touch Target Failures
**Issue**: "Touch target too small" errors
**Solution**: Ensure all interactive elements are at least 44x44px with 8px spacing

### Color Contrast Failures
**Issue**: "Insufficient color contrast" violations
**Solution**: 
- Normal text: Use colors with 4.5:1 contrast ratio
- Large text (18pt+): 3:1 contrast ratio minimum
- Use Chrome DevTools contrast checker

### Keyboard Navigation Issues
**Issue**: "Element not keyboard accessible"
**Solution**:
- Add `tabindex="0"` to custom interactive elements
- Ensure proper focus order with `tabindex`
- Implement keyboard event handlers

### Screen Reader Issues
**Issue**: "Missing accessible name"
**Solution**:
- Add `aria-label` or `aria-labelledby`
- Use semantic HTML (`<button>`, `<nav>`, etc.)
- Provide alt text for images

### Mobile Layout Issues
**Issue**: Horizontal scrolling on mobile
**Solution**:
- Use relative units (%, vw, vh) instead of fixed pixels
- Add viewport meta tag
- Test with device emulation

## Best Practices

### Mobile Testing
1. Test on real devices when possible
2. Use emulators for basic validation
3. Test both portrait and landscape orientations
4. Verify touch targets are properly sized
5. Ensure forms use appropriate input types

### Accessibility Testing
1. Run automated scans first (axe-core)
2. Manually test keyboard navigation
3. Use actual screen readers (NVDA, JAWS, VoiceOver)
4. Test with high contrast mode
5. Verify with reduced motion preferences

### Writing New Tests
1. Use the provided utility classes
2. Test across multiple viewports
3. Include both automated and manual checks
4. Document expected vs actual behavior
5. Add meaningful test descriptions

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run Mobile & Accessibility Tests
  run: |
    cd e2e/phase12
    npm ci
    npm test
  env:
    BASE_URL: ${{ secrets.TEST_URL }}
```

### Required CI Environment
- Node.js 18+
- Playwright browsers installed
- Access to test environment

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Use TypeScript for type safety
3. Add comprehensive test descriptions
4. Update this README with new patterns
5. Ensure tests are idempotent

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Playwright Documentation](https://playwright.dev)
- [Axe-core Rules](https://dequeuniversity.com/rules/axe/)
- [Mobile UX Best Practices](https://developers.google.com/web/fundamentals/design-and-ux/principles)
- [Screen Reader Testing Guide](https://webaim.org/articles/screenreader_testing/)

---

*Last Updated: January 2025*