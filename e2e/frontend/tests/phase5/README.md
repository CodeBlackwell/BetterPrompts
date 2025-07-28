# Phase 5: Technique Education & Tooltips Tests

## Overview
Phase 5 implements E2E tests for US-006: Technique Education & Tooltips. This phase focuses on educational UI components that help users understand why specific prompt engineering techniques were chosen.

## Test Files
- `us-006-technique-education.spec.ts` - Main test suite for educational features

## Supporting Files
- `pages/technique-education.page.ts` - Page object for educational UI interactions
- `utils/education-helpers.ts` - Helper functions for tooltip, modal, and gesture testing
- `fixtures/educational-content.ts` - Educational content data for all techniques

## Running Tests

### Run all Phase 5 tests:
```bash
cd e2e/frontend
npm test tests/phase5/
```

### Run specific test file:
```bash
npm test tests/phase5/us-006-technique-education.spec.ts
```

### Run with UI mode for debugging:
```bash
npm run test:ui tests/phase5/
```

### Run in headed mode to see browser:
```bash
npm run test:headed tests/phase5/
```

### Run specific test by description:
```bash
npm test tests/phase5/ -g "should show tooltip on hover"
```

## Test Coverage

### Tooltip Behavior
- ✅ Desktop hover interactions
- ✅ Mobile tap interactions
- ✅ Dismiss methods (click outside, ESC key)
- ✅ Viewport edge repositioning
- ✅ Performance (<100ms display time)

### Modal Functionality
- ✅ Complete educational content display
- ✅ Multiple close methods
- ✅ Body scroll locking
- ✅ Performance (<300ms load time)

### Educational Content
- ✅ Accurate technique information
- ✅ Content completeness verification
- ✅ All required sections present

### Navigation
- ✅ Documentation links (open in new tab)
- ✅ Breadcrumb navigation
- ✅ Back button functionality

### Alternative Suggestions
- ✅ Display related techniques
- ✅ Technique comparison modal
- ✅ Switch to alternative technique

### Mobile Interactions
- ✅ Touch gestures (tap, swipe)
- ✅ 44x44px minimum touch targets
- ✅ Responsive modal layouts

### Accessibility
- ✅ Proper ARIA attributes
- ✅ Keyboard navigation
- ✅ Screen reader support
- ✅ WCAG 2.1 AA compliance

### Performance
- ✅ Tooltip display <100ms
- ✅ Modal load <300ms
- ✅ 60fps animations

## Key Features Tested

### Educational Modal Structure
```
- Technique Name
- Description (50+ characters)
- Examples (practical use cases)
- Benefits (why use this technique)
- Use Cases (when to apply)
- Alternatives (related techniques)
```

### Accessibility Requirements
```
- role="tooltip" for tooltips
- role="dialog" for modals
- aria-describedby for associations
- aria-expanded for expandable sections
- Focus trap in modals
- Keyboard navigation support
```

### Performance Targets
```
- Tooltip Display: <100ms
- Modal Load: <300ms with content
- Animation FPS: ≥55fps (60fps target)
- No layout shifts during interactions
```

## Common Issues & Solutions

### Tooltip positioning issues
If tooltips are cut off at viewport edges:
- Verify `verifyTooltipInViewport()` is working
- Check viewport boundary detection logic
- Ensure repositioning algorithm handles all edges

### Mobile gesture failures
If swipe/tap gestures fail:
- Verify mobile viewport is set correctly
- Check touch target sizes (minimum 44x44px)
- Ensure gesture helpers are properly initialized

### Performance test failures
If performance targets aren't met:
- Check for unnecessary re-renders
- Verify animations use CSS transforms
- Ensure content is pre-loaded where possible

### Accessibility test failures
If ARIA or keyboard tests fail:
- Verify all interactive elements have proper roles
- Check focus management in modals
- Ensure keyboard event handlers are attached

## Integration Notes

This phase integrates with:
- **Enhancement Page**: Tooltips appear after enhancement
- **Technique Selection**: Education available for all techniques
- **History Feature**: Educational state preserved

## Future Enhancements

Consider adding tests for:
- Video tutorials integration
- Interactive examples
- Technique playground
- Personalized learning paths
- Progress tracking

## Debugging Tips

1. Use `npm run test:ui` to visually debug interactions
2. Add `await page.pause()` to stop execution and inspect
3. Use `test.only()` to run single test in isolation
4. Check browser console for errors with `page.on('console')`
5. Take screenshots with `await page.screenshot()` for visual debugging

---

*Last Updated: 2025-01-28*