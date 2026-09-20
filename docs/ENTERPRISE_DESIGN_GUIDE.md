# Enterprise Design System - moniger.net

## 1. ACCESSIBILITY IMPLEMENTATION CHECKLIST

### WCAG 2.1 Level AA Compliance

#### Keyboard Navigation
- [ ] All interactive elements accessible via Tab key
- [ ] Focus visible indicators on all buttons/links
- [ ] Escape key closes modals/dropdowns
- [ ] Enter/Space activates buttons
- [ ] Arrow keys for navigation in menus/tables
- [ ] Cmd+K for command palette

#### ARIA Attributes
- [ ] All buttons have aria-label if text not visible
- [ ] Forms use aria-describedby for error messages
- [ ] Modals use role="dialog" with aria-modal="true"
- [ ] Live regions use aria-live="polite" for status updates
- [ ] Tables have proper headers (scope attribute)
- [ ] Icons have aria-hidden="true" if decorative

#### Screen Reader Support
- [ ] Page landmarks (main, nav, aside)
- [ ] Heading hierarchy (h1, h2, h3 in order)
- [ ] List semantics (<ul>, <ol>, <li>)
- [ ] Form labels properly associated with inputs
- [ ] Error messages connected to fields
- [ ] Loading states announced

#### Color & Contrast
- [ ] Minimum 4.5:1 contrast for text
- [ ] 3:1 contrast for UI components
- [ ] Don't rely on color alone for meaning
- [ ] Test with WebAIM Contrast Checker

---

## 2. DESIGN TOKENS SYSTEM

### Color Scale (Base)
```
Primary: #210 53% 24% (HSL)
Secondary: #204 70% 44%
Success: #142 72% 37%
Warning: #32 95% 44%
Destructive: #0 72% 51%
```

### Spacing Scale (8px base)
```
xs: 0.25rem (4px)
sm: 0.5rem (8px)
md: 1rem (16px)
lg: 1.5rem (24px)
xl: 2rem (32px)
2xl: 3rem (48px)
3xl: 4rem (64px)
```

### Typography Scale
```
xs: 12px / 16px (line-height)
sm: 14px / 20px
base: 16px / 24px
lg: 18px / 28px
xl: 20px / 28px
2xl: 24px / 32px
3xl: 32px / 40px
```

### Elevation/Shadow System
```
shadow-xs: 0 1px 2px rgba(0,0,0,0.05)
shadow-sm: 0 1px 3px rgba(0,0,0,0.1)
shadow-md: 0 4px 6px rgba(0,0,0,0.1)
shadow-lg: 0 10px 15px rgba(0,0,0,0.1)
shadow-xl: 0 20px 25px rgba(0,0,0,0.1)
```

### Z-Index Scale
```
0: Default content
10: Sticky headers
20: Dropdown menus
30: Modals
40: Popovers/tooltips
50: Toast notifications
```

---

## 3. FORM BEST PRACTICES

### Field States
- [ ] Default (empty)
- [ ] Focused (with clear visual indicator)
- [ ] Filled
- [ ] Disabled
- [ ] Error (with message below field)
- [ ] Success (optional, for confirmations)
- [ ] Loading (for async validation)

### Error Messaging
```
DON'T: "Error: Invalid input"
DO: "Bill amount must be between ₦1,000 and ₦10,000,000"

DON'T: "Field required"
DO: "Please enter the vendor's account number (10-12 digits)"
```

### Form Progress
- Use steps in multi-step forms
- Show clear save/discard states
- Auto-save drafts with visual feedback
- Reduce cognitive load

---

## 4. DATA TABLE STANDARDS

### Mobile Responsiveness
- Stack columns as cards on mobile
- Horizontal scroll with sticky first column
- Collapsible rows with detail view

### Interactions
- Sortable columns with visual indicators
- Filterable columns
- Bulk selection with actions
- Row hover states
- Inline editing where appropriate

### Empty States
```
Icon: Relevant to content type
Title: Clear, action-oriented
Description: Why it's empty, what to do
CTA: Primary action to populate
```

---

## 5. ERROR HANDLING PATTERNS

### Error Types & Responses
```
Validation Error (400)
├─ Response: Inline field error + summary
├─ Action: Allow retry
└─ Example: "Email already registered"

Not Found (404)
├─ Response: Dashboard with suggestions
├─ Action: Link to list or create new
└─ Example: "Invoice not found - create new?"

Unauthorized (401)
├─ Response: Redirect to login
├─ Action: Prompt for re-authentication
└─ Example: "Session expired, please log in"

Server Error (500)
├─ Response: Friendly error + retry button
├─ Action: Log to Sentry, suggest reload
└─ Example: "Something went wrong. We're investigating."

Network Error
├─ Response: Offline indicator + queue actions
├─ Action: Retry when online
└─ Example: "Offline - changes will sync when online"
```

---

## 6. LOADING & SKELETON STATES

### Loading Patterns
- Skeleton screens for data load (preferred)
- Progress bars for long operations (> 3 seconds)
- Spinners for short operations (< 1 second)
- Streamed updates for large datasets

### Perceived Performance
- Show something immediately (skeleton)
- Progressive enhancement (load critical first)
- Optimistic updates (assume success)
- Graceful degradation on failure

---

## 7. NOTIFICATION SYSTEM

### Toast Notifications (Current: Sonner)
```
Success: Green ✓
├─ Use for: Successful actions
├─ Duration: 3 seconds auto-close
└─ Extra: Undo button where possible

Warning: Amber ⚠
├─ Use for: Caution information
├─ Duration: 5 seconds auto-close
└─ Extra: Dismissible

Error: Red ✕
├─ Use for: Failed actions
├─ Duration: 7 seconds (longer, user reads)
└─ Extra: Retry button, support link

Info: Blue ℹ
├─ Use for: General information
├─ Duration: 4 seconds auto-close
└─ Extra: Learn more link
```

### Notification Center (To Build)
- In-app notification history
- Filter by type/date
- Mark as read/unread
- Delete individual notifications
- Clear all
- Notification preferences per type

---

## 8. RESPONSIVE DESIGN BREAKPOINTS

```
Mobile: 320px - 640px
Tablet: 641px - 1024px
Desktop: 1025px - 1440px
Large: 1441px+
```

### Mobile-First Principles
1. Design for mobile first
2. Progressive enhancement for larger screens
3. Touch targets minimum 44x44px
4. Avoid horizontal scroll
5. Stacked layout by default

---

## 9. PERFORMANCE TARGETS

### Core Web Vitals (Google)
- FCP: < 1.8s
- LCP: < 2.5s
- CLS: < 0.1
- TTL: < 3.8s

### Lighthouse Scores
- Performance: 90+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 90+

### Optimization Strategy
1. Code splitting per route
2. Image optimization (WebP, lazy loading)
3. Virtual scrolling for large lists
4. Memoization of components
5. API response caching
6. Service Worker for offline

---

## 10. INTERNATIONALIZATION (i18n)

### Currency Formatting
```typescript
// NGN (Nigerian Naira) - Default
formatCurrency(2500000, 'NGN') → ₦2,500,000.00

// USD Support
formatCurrency(2500000, 'USD') → $2,500,000.00

// Auto detect from user settings
```

### Date Formatting
```typescript
// User locale-based
// EN: 03/29/2026
// FR: 29/03/2026
// DE: 29.03.2026
```

### Translation Keys Structure
```typescript
{
  common: { save, cancel, delete, confirm },
  invoices: { create, send, paid, overdue },
  bills: { create, pay, scheduled, unpaid },
  errors: { validation, network, permission },
  messages: { success, warning, error, info }
}
```

---

## 11. DARK MODE IMPLEMENTATION

### Current Implementation ✓
- Toggle in header
- localStorage persistence
- CSS custom properties
- Automatic on system preference

### Enhancements Needed
- Reduced motion support
- Higher contrast mode option
- Special accessibility themes

---

## 12. COMPONENT COMPOSITION PATTERNS

### Container/Presenter Pattern
```typescript
// Container handles logic
export function InvoiceContainer() {
  const [data, setData] = useState()
  return <InvoicePresenter data={data} />
}

// Presenter handles UI only
export function InvoicePresenter({ data }) {
  return <div>{/* UI */}</div>
}
```

### Compound Components
```typescript
// Allow flexible composition
<Card>
  <Card.Header>
    <Card.Title>Invoices</Card.Title>
  </Card.Header>
  <Card.Content>
    {/* Content */}
  </Card.Content>
  <Card.Footer>
    {/* Footer */}
  </Card.Footer>
</Card>
```

---

## 13. SECURITY BEST PRACTICES

### Client-Side
- CSRF token in forms
- XSS prevention (sanitize user input)
- Secure cookies (httpOnly, Secure, SameSite)

### API Communication
- HTTPS only
- Rate limiting
- API versioning
- Proper error messages (no data leakage)

### Data Handling
- Encrypt sensitive data in transit
- Audit logging (already implemented ✓)
- User consent for data usage

---

## 14. TESTING REQUIREMENTS

### Unit Tests
- Component rendering
- Event handlers
- Props validation
- Error states

### Integration Tests
- Form submission flows
- API error handling
- Authentication flows
- Navigation

### E2E Tests (Playwright - Already Setup ✓)
- Core user journeys
- Payment flows
- Report generation
- Audit trail

### Accessibility Tests
- axe DevTools
- NVDA/JAWS testing
- Keyboard navigation
- Color contrast

---

## 15. MONITORING & ANALYTICS

### Error Tracking (Recommended: Sentry)
```
- Exception logging
- Source map upload
- Session replay
- Performance metrics
```

### Product Analytics (Recommended: Mixpanel)
```
- Feature adoption
- User flows
- Conversion funnels
- Retention metrics
```

### Performance Monitoring
```
- Web Vitals tracking
- API response times
- Component render times
- Memory usage
```

---

## Implementation Priority

### Critical (Week 1-2)
1. WCAG keyboard navigation
2. Error boundary implementation
3. Skeleton loading states
4. Form error messaging

### High (Week 3-4)
1. Accessibility full audit
2. Notification center
3. Advanced filtering
4. Mobile table improvements

### Medium (Week 5-6)
1. i18n setup
2. Analytics integration
3. Storybook documentation
4. Performance optimization

### Nice-to-Have (Future)
1. Onboarding flows
2. AI-powered suggestions
3. Offline sync
4. Plugin architecture

---

## Tools & Resources

### Accessibility
- WebAIM Contrast Checker
- axe DevTools
- NVDA Screen Reader
- https://www.w3.org/WAI/test-evaluate/

### Performance
- Lighthouse CI
- Web Vitals extension
- Bundle Analyzer

### Design
- Figma (design handoff)
- Storybook (component documentation)
- Design Tokens Studio

### Testing
- Playwright (E2E) ✓ Already setup
- Vitest (Unit) ✓ Already setup
- Testing Library (Integration)

---

**Last Updated:** March 29, 2026
**Next Review:** June 29, 2026
