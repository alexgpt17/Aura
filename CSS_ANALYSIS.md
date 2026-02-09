# CSS Theme Application Analysis

## Current CSS Structure

### 1. **Universal Rules** (Apply to ALL websites)
These work across all sites:
- `html, body` - Base background
- `main, article, section, aside` - Semantic HTML5 elements
- `[class*="content"]`, `[class*="container"]`, `[class*="wrapper"]` - Generic class patterns
- `[id*="content"]`, `[id*="container"]`, `[id*="wrapper"]` - Generic ID patterns
- `p, h1-h6, li, td, th` - Text content elements
- `input`, `textarea`, `select` - Form elements
- Image/media visibility rules
- Icon/button exclusion rules

**Overlap**: ~70% of CSS is universal and works on most websites.

---

### 2. **Wikipedia-Specific Rules** (Only for Wikipedia)
These are Wikipedia-only:
- `[class*="mw-"]` - MediaWiki classes
- `[class*="vector-"]` - Vector skin classes
- `[class*="page-"]` - Wikipedia page classes
- `[class*="infobox"]` - Wikipedia infoboxes
- `[class*="mw-parser-output"]` - Parser output
- `[class*="mw-content-ltr"]`, `[class*="mw-content-rtl"]` - Content direction
- `[id*="mw-content-text"]`, `[id*="bodyContent"]` - Wikipedia IDs
- `input.mw-input`, `input.vector-search-box-input` - Wikipedia search inputs
- `div.mw-parser-output > div` - Nested Wikipedia divs

**Overlap**: ~30% of CSS is Wikipedia-specific.

---

## Website Types That May Need Special Handling

### 1. **News/Media Sites** (NYTimes, BBC, CNN, etc.)
**Common Patterns:**
- `[class*="article"]`, `[class*="story"]`, `[class*="post"]`
- `[class*="content-wrapper"]`, `[class*="article-body"]`
- `[class*="byline"]`, `[class*="headline"]`
- Paywall overlays that might need exclusion
- Newsletter signup boxes

**Potential Issues:**
- Article content containers
- Comment sections
- Related articles sections (similar to Wikipedia)

---

### 2. **Social Media** (Twitter/X, Facebook, Reddit, etc.)
**Common Patterns:**
- `[class*="tweet"]`, `[class*="post"]`, `[class*="feed"]`
- `[class*="card"]`, `[class*="item"]`
- `[class*="sidebar"]`, `[class*="widget"]`
- Timeline/feed containers
- Modal dialogs and overlays

**Potential Issues:**
- Feed items need backgrounds
- Sidebars and widgets
- Modal dialogs should probably be excluded
- Interactive elements (like, share buttons) need exclusion

---

### 3. **E-commerce** (Amazon, eBay, Shopify sites)
**Common Patterns:**
- `[class*="product"]`, `[class*="item"]`, `[class*="card"]`
- `[class*="price"]`, `[class*="cart"]`
- `[class*="review"]`, `[class*="rating"]`
- Product image containers
- Shopping cart overlays

**Potential Issues:**
- Product cards/containers
- Price displays (should keep original styling?)
- Review sections
- Image galleries (need careful handling)

---

### 4. **Blog/Content Sites** (Medium, WordPress, etc.)
**Common Patterns:**
- `[class*="post"]`, `[class*="entry"]`, `[class*="article"]`
- `[class*="content"]`, `[class*="main"]`
- `[class*="sidebar"]`, `[class*="widget"]`
- Comment sections
- Author bio boxes

**Potential Issues:**
- Similar to news sites
- Sidebar widgets
- Comment forms

---

### 5. **Documentation/Wiki Sites** (GitHub, GitLab, Confluence, etc.)
**Common Patterns:**
- `[class*="markdown"]`, `[class*="documentation"]`
- `[class*="code"]`, `[class*="snippet"]`
- Code blocks (should probably be excluded or styled differently)
- Navigation sidebars
- Search boxes

**Potential Issues:**
- Code blocks (syntax highlighting)
- Documentation navigation
- API reference sections

---

### 6. **Search Engines** (Google, Bing, DuckDuckGo)
**Common Patterns:**
- `[class*="result"]`, `[class*="search"]`
- `[class*="card"]`, `[class*="snippet"]`
- Search result containers
- Knowledge panels
- Related searches

**Potential Issues:**
- Search result boxes
- Knowledge panels (like Wikipedia infoboxes)
- Search suggestions dropdown

---

### 7. **Forums/Discussion Boards** (Reddit, Stack Overflow, etc.)
**Common Patterns:**
- `[class*="thread"]`, `[class*="comment"]`, `[class*="reply"]`
- `[class*="post"]`, `[class*="message"]`
- Thread containers
- Comment trees
- Voting buttons (should be excluded)

**Potential Issues:**
- Thread/post containers
- Comment sections
- Voting UI (should stay original)

---

## Recommendations for Future Improvements

### 1. **Site-Specific Detection**
Consider detecting site types and applying different rules:
```javascript
const siteType = detectSiteType(window.location.hostname);
if (siteType === 'wikipedia') {
    // Apply Wikipedia-specific rules
} else if (siteType === 'news') {
    // Apply news site rules
}
```

### 2. **Common Patterns to Add**
These patterns appear across many sites and could be added:
- `[class*="article"]` - Already partially covered
- `[class*="post"]` - Blog posts, social posts
- `[class*="card"]` - Already added, but could be more specific
- `[class*="sidebar"]` - Sidebars (might want to exclude or style differently)
- `[class*="modal"]`, `[class*="dialog"]` - Should probably be excluded
- `[class*="dropdown"]`, `[class*="menu"]` - Should probably be excluded

### 3. **Exclusions to Add**
These should probably be excluded from theme application:
- Modal dialogs and overlays
- Dropdown menus
- Tooltips
- Notification banners
- Cookie consent boxes
- Video players (controls)
- Code blocks with syntax highlighting

### 4. **Smart Detection**
Instead of hardcoding, could detect:
- Elements with `position: fixed` or `position: absolute` (likely UI overlays)
- Elements with high z-index (likely modals/overlays)
- Elements with `role="dialog"` or `role="alert"`
- Elements inside `[role="navigation"]` (might want different treatment)

---

## Current Overlap Summary

**Wikipedia-Specific**: ~30%
- `mw-*` classes
- `vector-*` classes
- Wikipedia-specific IDs
- Wikipedia search inputs

**Universal/Reusable**: ~70%
- Semantic HTML elements
- Generic class/ID patterns
- Form elements
- Text content elements
- Image/media handling
- UI element exclusions

**Good News**: Most of the CSS is already universal! The Wikipedia-specific rules are additive and don't break other sites.

---

## Potential Issues on Other Sites

1. **Generic class names** like `box`, `card`, `item`, `result` might match unintended elements
2. **Text color** being too aggressive - might affect UI elements we haven't excluded yet
3. **Background application** might conflict with sites that use CSS variables or complex styling
4. **Form elements** might need more specific targeting per site

---

## Next Steps

1. Test on various site types to identify common issues
2. Add more UI element exclusions (modals, dropdowns, tooltips)
3. Consider site-specific rule sets
4. Add detection for overlay/modals to exclude them
5. Fine-tune text color application to be less aggressive
