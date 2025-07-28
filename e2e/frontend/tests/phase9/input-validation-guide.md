# Input Validation Guide

## Overview

This guide documents the input validation strategy implemented in Phase 9 of the BetterPrompts E2E testing framework. The validation system provides comprehensive protection against edge cases, security threats, and ensures consistent behavior across all input scenarios.

## Validation Layers

### 1. Client-Side Validation
- **Character Limit**: Real-time counting with grapheme cluster support
- **Empty Input**: Immediate feedback for empty/whitespace-only input
- **Visual Feedback**: Character counter, error states, input highlighting

### 2. API Gateway Validation
- **Rate Limiting**: Prevent abuse and DoS attacks
- **Request Size**: Enforce maximum payload sizes
- **Basic Sanitization**: Remove obvious malicious patterns

### 3. Backend Service Validation
- **Deep Validation**: Comprehensive input analysis
- **Context-Aware**: Different rules for different prompt types
- **Security Scanning**: Pattern matching for injection attempts

### 4. Database Layer
- **Parameterized Queries**: Prevent SQL injection
- **Field Constraints**: Enforce data types and lengths
- **Encoding**: Proper UTF-8 handling

## Character Limit Implementation

### Accurate Character Counting
```typescript
// Use Intl.Segmenter for accurate emoji/grapheme counting
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const length = Array.from(segmenter.segment(input)).length;
```

### Edge Cases Handled
- Complex emojis (👨‍👩‍👧‍👦 counts as 1)
- Combining characters (é can be 1 or 2 code points)
- Zero-width characters (ignored in count)
- Various newline formats (\n, \r\n)

## Special Character Support

### Allowed Characters
- **Punctuation**: All standard ASCII punctuation
- **Mathematical**: ±÷×∞∑∏√∂∫≈≠≤≥
- **Currency**: $€£¥₹₿ and others
- **Emojis**: Full Unicode emoji support
- **Stylized Text**: 𝕳𝖊𝖑𝖑𝖔 𝖂𝖔𝖗𝖑𝖉

### Blocked Characters
- Control characters (except newline/tab)
- NULL bytes
- Format control characters
- Private use area characters

## Multilingual Support

### Supported Scripts
- Latin (English, Spanish, French, etc.)
- Chinese (Simplified and Traditional)
- Japanese (Hiragana, Katakana, Kanji)
- Arabic (with RTL support)
- Hebrew (with RTL support)
- Cyrillic (Russian, Ukrainian, etc.)
- Korean (Hangul)

### RTL Language Handling
- Automatic direction detection
- Mixed directional text support
- Proper text alignment preservation

### Unicode Normalization
- All input normalized to NFC form
- Consistent character representation
- Proper comparison and storage

## Security Measures

### XSS Prevention
1. **Input Encoding**: HTML entity encoding for display
2. **CSP Headers**: Strict Content Security Policy
3. **Output Sanitization**: Remove script tags and event handlers
4. **Context-Aware Encoding**: Different encoding for different contexts

### SQL Injection Prevention
1. **Parameterized Queries**: Never concatenate user input
2. **Input Validation**: Whitelist approach where possible
3. **Error Handling**: Never expose database errors
4. **Query Limits**: Prevent resource exhaustion

### Other Security Measures
- Path traversal prevention
- Command injection blocking
- XXE attack prevention
- LDAP injection protection
- NoSQL injection prevention

## Error Message Guidelines

### User-Friendly Errors
```javascript
// Good
"Your input is too long. Please keep it under 2000 characters."

// Bad
"Error: String length exceeds column varchar(2000) limit at line 45"
```

### Error Message Principles
1. **Clear**: Explain what went wrong
2. **Actionable**: Tell user how to fix it
3. **Safe**: No technical details or stack traces
4. **Localized**: Support multiple languages
5. **Accessible**: Screen reader friendly

## Testing Strategy

### Test Categories
1. **Boundary Testing**: At and around limits
2. **Equivalence Classes**: Valid and invalid partitions
3. **Security Testing**: Known attack patterns
4. **Internationalization**: Various languages and scripts
5. **Performance**: Large inputs and rapid changes

### Automated Validation
- Continuous security scanning
- Cross-browser testing
- Performance benchmarking
- Accessibility compliance

## Implementation Checklist

### Frontend
- [ ] Character counter with grapheme support
- [ ] Real-time validation feedback
- [ ] Proper error display
- [ ] Accessibility compliance
- [ ] RTL language support

### Backend
- [ ] Input length validation
- [ ] Character set validation
- [ ] Security pattern detection
- [ ] Proper sanitization
- [ ] Error message formatting

### Infrastructure
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Monitoring and alerting
- [ ] Performance tracking
- [ ] Security scanning

## Common Issues and Solutions

### Issue: Emoji Miscounting
**Solution**: Use Intl.Segmenter or grapheme-splitting library

### Issue: RTL Layout Breaking
**Solution**: Use CSS logical properties and dir="auto"

### Issue: Over-Aggressive Sanitization
**Solution**: Whitelist safe characters instead of blacklisting

### Issue: Inconsistent Validation
**Solution**: Share validation logic between client and server

### Issue: SQL Errors Exposed
**Solution**: Generic error messages, detailed logging server-side

## Monitoring and Metrics

### Key Metrics to Track
- Validation failure rate by type
- Security pattern detection frequency
- Character limit violations
- Error message effectiveness
- Performance impact of validation

### Alerting Thresholds
- Security pattern spike (possible attack)
- High validation failure rate (UX issue)
- Performance degradation (>100ms overhead)
- Error rate increase (potential bug)

## Future Enhancements

1. **Machine Learning**: Detect new attack patterns
2. **Smart Validation**: Context-aware rules
3. **Progressive Enhancement**: Graceful degradation
4. **Advanced Internationalization**: More language support
5. **Performance Optimization**: Faster validation algorithms