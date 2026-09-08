/**
 * AURA THEME ENGINE - Fixed Version with Memory Leak Prevention
 */

(function() {
    let currentTheme = null;
    const processedShadowRoots = new WeakSet();
    // <iframe> elements whose same-origin contentDocument we've injected a
    // themed <style data-aura-iframe> into (see handleShadowDOM /
    // visitSameOriginIframe) — tracked only for removeTheme() cleanup.
    const sameOriginIframeModified = new Set();
    // Set when the opt-in Dark Mode toggle (nativeDarkModeEnabled) has
    // successfully flipped the site's own native dark-mode convention (see
    // applyNativeDarkModeIfEnabled) — records exactly what was changed on
    // <html> so revertNativeDarkMode() can put it back precisely, including
    // restoring a pre-existing attribute value rather than just deleting it.
    let nativeDarkModeApplied = null;
    let mutationObserver = null;
    let customEventListenerAttached = false;
    // Elements we forced opaque because they are position:fixed/sticky.
    // Tracked so removeTheme() can cleanly revert them.
    const stickyModified = new Set();
    // Near-white / light-gray opaque surfaces cleared by rethemeBrightSurfaces().
    const brightModified = new Set();
    const contrastModified = new Set();
    // Visible dialogs / modal cards we forced opaque with --aura-overlay.
    const overlayModified = new Set();
    // SPA shells / large gradients we forced transparent.
    const shellModified = new Set();
    // Top app-bar / search chrome we painted or cleared.
    const chromeModified = new Set();
    // Outermost top-chrome bars we painted opaque (--aura-bg). Tracked
    // separately from cleared inners so we can undo if the bar later grows
    // into a covering sheet (fox5-class curtain).
    const chromeOuterModified = new Set();
    // position:fixed/sticky descendants found INSIDE a painted chrome outer
    // (e.g. a <header> that wraps a position:fixed .header-bar div, common
    // on sites where the semantic <header> itself stays in normal flow and
    // only an inner bar becomes sticky). These render in their own layer,
    // detached from the outer element's box, so they get painted opaque
    // too instead of cleared — tracked separately since isTopChromeBar
    // doesn't recognize a plain fixed div, so they need their own revert
    // check (still fixed/sticky, not grown into a curtain) rather than
    // chromeOuterModified's.
    const chromeFixedInnerModified = new Set();
    // Nav/menu/header elements repainted opaque because the site's own CSS
    // gave them an !important background we out-specificity'd (see
    // restoreAuthoredChromeOpacity). Tracked only for removeTheme() cleanup —
    // unlike the fixed-position tiers above, a non-fixed menu can't grow
    // into a curtain by scrolling, so there's no separate revert pass.
    const chromeAuthoredModified = new Set();
    // Non-ARIA modal cards painted opaque by visitOverlayModalWalk. Unlike
    // ARIA reopaqueOverlays (re-evaluated every pass), these only get touched
    // while isLikelyModalCard is true — so we must revert when they grow.
    const modalCardOpaqueModified = new Set();
    // Per-element collapsed/expanded classification history for the
    // isLikelyNavDrawer transition gate (see classifyNavDrawerState in
    // themeHeuristics.js) — an element is painted opaque only on a confirmed
    // collapsed -> expanded transition, never merely because it "currently
    // looks expanded." That level-triggered check is what mispainted
    // wtatennis.com's ambient sticky nav bar into a full-page curtain
    // earlier this session (see CHROME_REPAINT_DISABLED_HOSTS below).
    // WeakMap: entries need no manual disconnect cleanup, unlike the Sets
    // above, since they vanish along with the element itself.
    let navDrawerStateHistory = new WeakMap();
    // Same transition-gating idea as navDrawerStateHistory, for menus that
    // expand IN PLACE rather than as a position:fixed/sticky overlay (see
    // classifyNavMenuPanelState / reopaqueExpandedNavMenuPanels) — e.g. a
    // Bootstrap-style ".navbar-collapse" mobile menu, which isLikelyNavDrawer
    // can never reach since it requires position fixed/sticky.
    let navMenuPanelStateHistory = new WeakMap();
    // Elements forced opaque by reopaqueExpandedNavMenuPanels. Tracked
    // separately from modalCardOpaqueModified (a different mechanism/gate)
    // so their revert paths never interfere with each other.
    const navMenuPanelOpaqueModified = new Set();
    // Same transition-gating idea again, one level more general than
    // navMenuPanelStateHistory: an in-flow (position:static/relative) card
    // that expands with real, actionable content but carries NO nav
    // semantics at all — e.g. booking.com's inline "Enter dates to see
    // prices" date-picker, a plain role-less <div> that grows from
    // collapsed to a large white card with no <nav>/links (a calendar has
    // none) when its trigger is focused. classifyNavMenuPanelState can
    // never reach it (requires nav tag/descendant/link-count); isLikelyModalCard
    // can't either (requires position:fixed, precisely to avoid flagging
    // ordinary absolute promo tiles). See classifyExpandedContentPanelState /
    // reopaqueExpandedContentPanels below.
    let expandedContentPanelStateHistory = new WeakMap();
    // Elements forced opaque by reopaqueExpandedContentPanels. Tracked
    // separately from the other opaque-modified sets for the same reason as
    // navMenuPanelOpaqueModified above.
    const expandedContentPanelOpaqueModified = new Set();
    // Elements forced opaque by visitFloatingIconControlElement — small
    // icon-only controls (close/share/kebab-menu) pinned via position:fixed/
    // absolute to float over media (a photo, a map) whose own translucent
    // scrim backing the universal transparency rule stripped. See
    // isLikelyFloatingIconControl in themeHeuristics.js.
    const floatingIconControlModified = new Set();
    // Google Ask-anything pill ancestors / decorative siblings we cleared.
    const askAnythingModified = new Set();
    // Elements whose ::before/::after we identified as a full-bleed
    // background layer (see clearFullBleedPseudoBackgrounds) and tagged
    // with a data-aura-pbg id so a generated stylesheet rule can reach the
    // pseudo-element (JS cannot set inline style on a pseudo-element).
    const pseudoBgCleared = new Set();
    let pseudoBgStyleEl = null;
    let pseudoBgCounter = 0;
    // token (data-aura-pbg value) -> generated CSS rule text. A Map, not an
    // array, so a nav-panel host re-derived on every pass (see
    // pseudoBgNavPanelHosts) UPDATES its one rule in place instead of
    // accumulating a duplicate for every walk that ever visits it.
    const pseudoBgRulesByToken = new Map();
    // Pseudo-bg hosts with nav semantics (see hasNavSemanticsForPseudoBg) —
    // deliberately excluded from the permanent pseudoBgCleared cache so
    // their fill is re-derived every pass rather than locked to whatever
    // open/closed state they happened to be sampled in first. Tracked here
    // only so removeTheme() can strip their data-aura-pbg attribute.
    const pseudoBgNavPanelHosts = new Set();
    // Elements whose background-image we cleared because it resolved to a
    // loader/spinner asset (see clearLoaderBackgroundImages) — normally
    // hidden behind an opaque covering element that our own transparency
    // rule strips, exposing the loader underneath.
    const loaderBgModified = new Set();
    let ignoreMutations = false;
    let ignoreMutationsTimer = null;
    let scrollListenerAttached = false;
    let scrollPassTimer = null;

    const H = (typeof AuraThemeHeuristics !== 'undefined' && AuraThemeHeuristics)
        ? AuraThemeHeuristics
        : null;
    const Split = (typeof AuraSplitTheme !== 'undefined' && AuraSplitTheme)
        ? AuraSplitTheme
        : null;
    const Resolve = (typeof AuraThemeResolve !== 'undefined' && AuraThemeResolve)
        ? AuraThemeResolve
        : null;

    // AMP gets a dedicated, isolated theming path instead of running through
    // the general reactive engine (mutation-driven sticky/overlay/shell walks
    // tuned for arbitrary SPA markup). AMP's DOM vocabulary is small and
    // well-known — a static stylesheet handles it more reliably than layering
    // more special cases onto heuristics built for a different problem.
    // See applyTheme()'s IS_AMP_DOCUMENT / IS_AMP_CONSENT_FRAME branches.
    const IS_AMP_DOCUMENT = !!(H && H.isAmpDocument && H.isAmpDocument(document));
    // The AMP consent widget (e.g. OneTrust's amp-privacy.<site> iframe) is a
    // layout="fill" overlay meant to stay pass-through except where it
    // actually draws a dialog — it is never a real page, so it never gets an
    // opaque root paint at all (see getAmpConsentFrameStyleSheet).
    const IS_AMP_CONSENT_FRAME = !!(H && H.isAmpPrivacyFrameHost
        && H.isAmpPrivacyFrameHost(window.location.hostname));
    // Ad creative frames (GPT/SafeFrame, exchange iframes, ...): never theme
    // these at all, not even cosmetically. SafeFrame / "friendly iframe"
    // rendering pipelines commonly assume the frame's document is untouched
    // by any other script before their own bootstrap code runs. A previous
    // attempt injected a transparent-canvas stylesheet here to fix empty
    // slots showing white — confirmed (extension off vs. on) to break ad
    // loading entirely, not just its color. See the isAdNetworkHost checks
    // in applyTheme() / init() below.

    let lastAppliedThemeKey = '';
    let mutationDebounceTimer = null;
    // MutationRecords buffered across the debounce window AND across any
    // pass currently running (queue-and-coalesce, not drop-while-busy) — see
    // dispatchSafetyPasses. Used only to decide how to scope the next walk;
    // never read for its own content beyond target/addedNodes/removedNodes.
    let pendingMutationRecords = [];
    let safetyPassesRaf = 0;
    // Timestamp of the current theme's fresh apply — see
    // visitExpandedContentPanelElement's fresh-mount allowance, which needs
    // to tell "this element has no prior state because the page had only
    // just started loading when we first saw it" apart from "this element
    // has no prior state because it was inserted into the DOM well after
    // the page (and this engine's initial walk of it) had already settled."
    let engineAppliedAt = 0;
    const SPLIT_LAYER_ID = 'aura-split-bg';
    let bodyPositionForced = false;
    // Cache for the site's own !important opaque background-color rules
    // (see getAuthoredOpaqueBgSelectors) — stylesheets rarely change after
    // load, so this is rebuilt on a TTL rather than every safety pass.
    let authoredOpaqueSelectorsCache = null;
    let authoredOpaqueSelectorsAt = 0;
    let authoredOpaqueSelectorsSheetCount = -1;
    const AUTHORED_OPAQUE_CACHE_TTL = 5000;
    const AUTHORED_OPAQUE_MAX_RULES_SCANNED = 15000;
    const AUTHORED_OPAQUE_MAX_SELECTORS = 300;
    let walkGeneration = 0;
    let walkSliceRaf = 0;
    const WALK_SLICE = 4000;

    function isActiveSplitTheme(theme) {
        if (!theme || !Split || !Split.isSplitTheme(theme)) return false;
        return !!Split.parseSplitColors(theme.backgroundGradient || theme);
    }

    // Mosaic tiles hidden while the Images viewer is open (reverted each pass).
    const googleImagesMosaicHidden = new Set();

    function isGoogleHost() {
        try {
            const host = String(window.location.hostname || '').toLowerCase();
            return host === 'google.com' || host.endsWith('.google.com');
        } catch (e) {
            return false;
        }
    }

    /** Prefer the visual viewport so iOS toolbar chrome cannot shrink a
     *  `inset:0` layer below the covering-sheet / fullscreen thresholds. */
    function passViewport() {
        try {
            const vv = window.visualViewport;
            if (vv && vv.height > 0 && vv.width > 0) {
                return { vh: vv.height, vw: vv.width };
            }
        } catch (e) {}
        return {
            vh: window.innerHeight || 0,
            vw: window.innerWidth || 0,
        };
    }

    /** Images tab: legacy tbm=isch or current udm=2 unified search. */
    function isGoogleImagesPage() {
        if (!isGoogleHost()) return false;
        try {
            const href = String(window.location.href || '');
            if (/[?&]tbm=isch(?:&|$|#)/.test(href) || /[?&]udm=2(?:&|$|#)/.test(href)) {
                return true;
            }
            const tab = document.querySelector('[aria-current="page"], [aria-current="true"]');
            if (tab && /images/i.test(String(tab.textContent || ''))) return true;
        } catch (e) {}
        return false;
    }

    function removeSplitLayer() {
        const el = document.getElementById(SPLIT_LAYER_ID);
        if (el) el.remove();
        if (bodyPositionForced && document.body) {
            document.body.style.removeProperty('position');
            bodyPositionForced = false;
        }
    }

    function cancelWalkSlices() {
        walkGeneration += 1;
        if (walkSliceRaf) {
            try { cancelAnimationFrame(walkSliceRaf); } catch (e) {}
            walkSliceRaf = 0;
        }
    }

    function collectElements(root) {
        try {
            return root.nodeType === 1
                ? [root, ...root.querySelectorAll('*')]
                : Array.from(root.querySelectorAll('*'));
        } catch (e) {
            return [];
        }
    }

    // One misbehaving element (a detached node mid-mutation, a throwing
    // getter, an SVG className, a hostile third-party web component) must
    // never abort the whole walk — the passes further down (and the
    // ignoreMutations reset in onDone) still have to run, or reactive
    // re-theming can silently wedge for the rest of the page's life.
    function safeVisit(visit, el) {
        try { visit(el); } catch (e) {}
    }

    function forEachSliced(elements, visit, onDone) {
        const gen = walkGeneration;
        let i = 0;
        function step() {
            if (gen !== walkGeneration) return;
            const end = Math.min(i + WALK_SLICE, elements.length);
            for (; i < end; i++) {
                const el = elements[i];
                if (el && el.nodeType === 1) safeVisit(visit, el);
            }
            if (i < elements.length) {
                walkSliceRaf = requestAnimationFrame(step);
            } else if (onDone) {
                onDone();
            }
        }
        step();
    }

    // 1. SITE-SPECIFIC OVERRIDES
    // Each entry: { match: [hostnames], css }. A site matches when the current
    // hostname equals a listed host or is a subdomain of it (suffix match), so
    // e.g. 'google.com' also covers 'www.google.com'.
    const SITE_FIXES = [
        {
            match: ['google.com'],
            css: `
                /* The universal 'a { color: link }' rule recolors the Sign-in
                   pill's text to match its own light background, making it
                   invisible. Give it a readable themed surface instead. */
                .gb_A {
                    background-color: var(--aura-surface) !important;
                    color: var(--aura-text) !important;
                }

                /* The search input has a text-fade overlay (.u4frDf) painted as
                   a white linear-gradient. The universal rule only clears
                   background-COLOR, not background-IMAGE, so this gradient
                   survives and reads as a gray/white box to the right of the
                   query text on any non-white theme. Remove the gradient. */
                .u4frDf {
                    background-image: none !important;
                }

                /* Result-area surfaces (the AI Overview panel, answer cards)
                   set their dark background with multi-class selectors that
                   out-specify the universal 'div { ...transparent }' rule, so
                   under color-scheme:dark they keep Google's own dark surface.
                   Re-assert transparency scoped to the #rso results container:
                   an ID selector out-specifies any class-only rule, so the
                   themed page background shows through instead.
                   NOTE: the AI Overview "Show more" collapse-fade renders in an
                   isolated context that page CSS cannot reach; it is a minor
                   residual and must be pinned on-device if it needs removal. */
                #rso div:not([role="dialog"]):not([role="menu"]) {
                    background-color: transparent !important;
                }

                /* Images tab: tap opens a second in-page screen on top of
                   the mosaic. Universal div-transparency (and the #rso rule
                   above, for non-dialog sheets) makes that screen glass.
                   Beat #rso div { transparent } for dialog/modal sheets
                   (1,1,1 vs 1,0,1). Hashed viewer classes are a fallback
                   for the older tbm=isch layout. Do not change .gb_A,
                   .u4frDf, or the #rso rule above. */
                #rso [role="dialog"],
                #rso [aria-modal="true"],
                .tvh9oe,
                .EIehLd,
                .fHE6De,
                #islsp {
                    background-color: var(--aura-bg) !important;
                }
                body:has([aria-modal="true"]) #islrg,
                body:has([role="dialog"] [aria-label="Close"]) #islrg,
                body:has(.tvh9oe:not([aria-hidden="true"])) #islrg,
                body:has([aria-modal="true"]) #islmp {
                    visibility: hidden !important;
                }

                /* AI Overview collapse-fade: empty overlay whose following
                   sibling (source chips may sit in between on mobile) contains
                   the expander. Adjacent `+` misses that stack. SITE_FIX only
                   — do not restore this gradient in the shared JS walk. */
                div:has(~ div [aria-controls="m-x-content"]):empty,
                div:has(~ div [aria-label*="Show more AI" i]):empty,
                #rso div:has(~ div [aria-controls="m-x-content"]):empty,
                #rso div:has(~ div [aria-label*="Show more AI" i]):empty {
                    background-color: transparent !important;
                    background-image: linear-gradient(transparent, var(--aura-bg)) !important;
                }
                div:has(> [aria-controls="m-x-content"]),
                [aria-controls="m-x-content"],
                [aria-label*="Show more AI" i],
                #rso div:has(> [aria-controls="m-x-content"]),
                #rso [aria-controls="m-x-content"],
                #rso [aria-label*="Show more AI" i] {
                    background-color: var(--aura-bg) !important;
                    color: var(--aura-text) !important;
                }

                /* Expanded AI Overview query chip ("You said: …") is a chat
                   bubble whose hashed fill loses to universal div-transparency. */
                #m-x-content div:has(> span[role="heading"]) {
                    background-color: var(--aura-surface) !important;
                    color: var(--aura-text) !important;
                }
                #m-x-content div:has(> span[role="heading"]) span {
                    color: var(--aura-text) !important;
                }

                /* Ask-anything field text only — outer chip cleared in JS
                   (rethemeAskAnythingComposer). Do not paint --aura-bg. */
                :is(textarea, input, [contenteditable="true"], [role="textbox"]):is(
                    [placeholder*="Ask anything" i],
                    [aria-label*="Ask anything" i],
                    [placeholder*="Ask" i],
                    [aria-label*="Ask" i]
                ):not(.gLFyf):not([aria-label*="Search" i]) {
                    background-image: none !important;
                    color: var(--aura-text) !important;
                }
            `
        },
        {
            match: ['wikipedia.org'],
            css: `
                /* Content cards: subtle surface lift (off-white analog), NOT
                   --aura-overlay which is near-black and reads as a slab. */
                .infobox, .navbox, .sidebar, .wikitable, .metadata, .mbox, .catlinks {
                    background-color: var(--aura-surface) !important;
                    color: var(--aura-text) !important;
                    border: 1px solid var(--aura-border) !important;
                }

                /* Section headers only (Men's, Women's, etc.). Do NOT include
                   .infobox th — row labels like Founded/Editions are also <th
                   class="infobox-label"> and must stay flush with their data. */
                .infobox-title,
                .infobox-header {
                    background: var(--aura-elevated) !important;
                    background-color: var(--aura-elevated) !important;
                    background-image: none !important;
                    color: var(--aura-text) !important;
                }
                .infobox-label {
                    color: var(--aura-muted) !important;
                    background-color: transparent !important;
                }
                .infobox-data,
                .infobox-full-data {
                    color: var(--aura-text) !important;
                    background-color: transparent !important;
                }
                .infobox a {
                    color: var(--aura-link) !important;
                }

                /* Same header treatment for tables / navboxes. */
                .wikitable th,
                .navbox-title,
                .navbox th {
                    background: var(--aura-elevated) !important;
                    background-color: var(--aura-elevated) !important;
                    background-image: none !important;
                    color: var(--aura-text) !important;
                }

                /* Search field: inputs aren't covered by universal transparency. */
                .cdx-text-input__input {
                    background-color: var(--aura-surface) !important;
                    color: var(--aura-text) !important;
                }

                /* Footer / logo tiles use Codex fake-buttons. Theming them to
                   --aura-surface left visible tinted boxes around the logos.
                   Make them seamless so icons sit directly on the page bg.
                   Multi-class selectors beat Codex's own
                   .cdx-button--fake-button--enabled { background:#fff !important }.
                   NOTE: do NOT add .minerva-icon — those are mask-image icons
                   whose white "background" IS the visible icon color. */
                .cdx-button.cdx-button--fake-button,
                .cdx-button.cdx-button--fake-button--enabled,
                .mw-footer .cdx-button,
                .mw-footer-container .cdx-button,
                .mw-footer .cdx-button.cdx-button--fake-button,
                .mw-footer-container .cdx-button.cdx-button--fake-button {
                    background: transparent !important;
                    background-color: transparent !important;
                    background-image: none !important;
                    border: none !important;
                    box-shadow: none !important;
                    color: var(--aura-text) !important;
                }

                /* Related articles (ReadMore) load asynchronously into
                   .read-more-container. Cards are <a>/<li>/summary surfaces the
                   universal div-transparency rule never reaches, so they stay
                   white without an explicit override. */
                .read-more-container,
                .read-more-container a,
                .read-more-container li,
                .read-more-container .mw-page-summary,
                .read-more-card,
                .related-pages,
                .related-pages a,
                .page-summary,
                .page-summary .content {
                    background-color: transparent !important;
                    background-image: none !important;
                    color: var(--aura-text) !important;
                    box-shadow: none !important;
                }
                .read-more-container h2,
                .read-more-container h3,
                .read-more-container p,
                .read-more-container span {
                    color: var(--aura-text) !important;
                }

                /* Leftover light Minerva surfaces. */
                .hatnote,
                .toggle-list-item {
                    background-color: transparent !important;
                    color: var(--aura-text) !important;
                }
                .last-modified-bar {
                    background-color: var(--aura-surface) !important;
                    color: var(--aura-text) !important;
                }
                .last-modified-bar a,
                .last-modified-bar span {
                    color: var(--aura-text) !important;
                }
            `
        },
        {
            match: ['amazon.com'],
            css: `
                /* Search field renders solid white; inputs aren't covered by
                   the universal transparency rule, so theme it explicitly. */
                #nav-search-keywords, .nav-input {
                    background-color: var(--aura-surface) !important;
                    color: var(--aura-text) !important;
                }
            `
        },
        {
            // Nexstar local-news (fox5sandiego): sticky pass historically
            // re-opaqued OneSignal / OneTrust / video-float / adhesion shells
            // into a theme-colored curtain. Heuristics now skip those; this
            // CSS is a host-scoped belt-and-suspenders so stylesheet-level
            // dialog paints cannot leave an opaque sheet either.
            match: ['fox5sandiego.com'],
            css: `
                #onesignal-slidedown-container,
                .onesignal-slidedown-container,
                #onetrust-consent-sdk,
                .onetrust-pc-dark-filter,
                #onetrust-banner-sdk,
                #onetrust-pc-sdk,
                .login-registration-modal,
                .nexstar-video.video-float,
                .site-header__navigation__content,
                aside.ad-unit--adhesion,
                /* AMP article (/amp/) consent + sticky ad shells */
                amp-consent,
                amp-sticky-ad,
                .popupOverlay,
                .consentPopup,
                #myConsentFlow {
                    background-color: transparent !important;
                    background-image: none !important;
                }
            `
        },
        {
            // wtatennis.com: OneTrust is confirmed present here
            // (data-domain-script in the page source), matching the
            // fox5sandiego.com pattern above. This is belt-and-suspenders
            // only — it is NOT the fix for the reported curtain bug, which
            // is the sticky `.page-hero` section (see
            // STICKY_PAINT_HOST_SKIPS / isStickyPaintHostSkipped above).
            //
            // .main-navigation__logo-image: the header logo is a solid-purple
            // SVG wordmark (WTA_Logo_Core_Purple_RGB.svg, confirmed via the
            // site's own markup) with no theme awareness of its own. Sitting
            // on the new dark header background it reads as nearly invisible.
            // No general image-contrast capability exists in the engine
            // (IMG/SVG are always skipped by every color/contrast pass — see
            // BRIGHT_SKIP_TAGS), so this is a targeted, site-scoped fix
            // rather than a general one.
            match: ['wtatennis.com'],
            css: `
                #onetrust-consent-sdk,
                .onetrust-pc-dark-filter,
                #onetrust-banner-sdk,
                #onetrust-pc-sdk {
                    background-color: transparent !important;
                    background-image: none !important;
                }
                .main-navigation__logo-image {
                    filter: invert(1) brightness(1.6) !important;
                }
            `
        }
        // youtube.com, reddit.com and x.com/twitter.com were verified to need no
        // override: the universal transparency + sticky/fixed pass themes them
        // cleanly. Add entries here if device testing reveals site-specific issues.
    ];

    // Concatenate the CSS of every SITE_FIXES entry whose host matches.
    function getSiteFix(hostname) {
        if (Resolve) return Resolve.getSiteFix(hostname, SITE_FIXES);
        return SITE_FIXES
            .filter(entry => entry.match.some(h => hostname === h || hostname.endsWith('.' + h)))
            .map(entry => entry.css)
            .join('\n');
    }

    // Site-scoped selectors that must NEVER be matched by the universal
    // transparency rule's own `:is(...)` selector at all — not just
    // re-painted afterward by JS. Confirmed via extensive testing:
    // github.com's mobile hamburger/close toggle (three <span> bars
    // painted via `background-color: currentColor`) sits inside these
    // plain <div> ancestors, and GitHub's CSS `transform` transition on
    // those bars (rotating hamburger -> X when the menu opens) never
    // composites once the universal rule's OWN stylesheet !important
    // background-color rule matches the ancestor chain — a browser-level
    // compositing failure. A competing !important rule (even the exact
    // same value) or a post-hoc JS repaint does NOT avoid this; only
    // never letting the universal rule's selector match these elements in
    // the first place does. Paired with CHROME_REPAINT_DISABLED_HOSTS
    // above (which stops reopaqueTopChrome from independently repainting
    // the same chain via JS) and the matching skip inside paintChrome's
    // inner loop.
    //
    // [class*=] prefix matching, not exact class names: these are
    // CSS-module hashed class names (e.g.
    // `MarketingHeader-module__toggleSlot__hDxbh`) whose hash suffix can
    // change across GitHub deploys; the human-readable prefix is stable.
    const UNIVERSAL_TRANSPARENCY_HOST_EXCLUDES = [
        {
            match: ['github.com'],
            selectors: [
                '[class*="MarketingHeader-module__toggleSlot"]',
                '[class*="MarketingHeader-module__topRow"]',
                '[class*="MarketingHeader-module__bar__"]',
            ],
        },
    ];

    function getUniversalTransparencyExcludeNot(hostname) {
        if (!hostname) return '';
        const host = String(hostname).toLowerCase();
        const frags = [];
        UNIVERSAL_TRANSPARENCY_HOST_EXCLUDES.forEach(entry => {
            const matches = Resolve && Resolve.hostMatches
                ? Resolve.hostMatches(host, entry.match)
                : entry.match.some(h => host === h || host.endsWith('.' + h));
            if (matches) {
                entry.selectors.forEach(sel => frags.push(`:not(${sel})`));
            }
        });
        return frags.join('');
    }

    // Cheap substring check mirroring getUniversalTransparencyExcludeNot,
    // for the JS-side skip inside paintChrome's inner loop (see
    // UNIVERSAL_TRANSPARENCY_HOST_EXCLUDES above for why both are needed).
    function isUniversalTransparencyHostExcluded(el) {
        if (!el || typeof el.className !== 'string' || !el.className) return false;
        let host;
        try { host = String(window.location.hostname || '').toLowerCase(); } catch (e) { return false; }
        if (!host) return false;
        for (const entry of UNIVERSAL_TRANSPARENCY_HOST_EXCLUDES) {
            const matches = Resolve && Resolve.hostMatches
                ? Resolve.hostMatches(host, entry.match)
                : entry.match.some(h => host === h || host.endsWith('.' + h));
            if (!matches) continue;
            for (const sel of entry.selectors) {
                const m = /\[class\*="([^"]+)"\]/.exec(sel);
                if (m && el.className.indexOf(m[1]) >= 0) return true;
            }
        }
        return false;
    }

    // Pick the theme that applies to the current page.
    // Precedence: per-site theme > time-based day/night > global theme.
    function resolveTheme(themeData) {
        if (Resolve) {
            return Resolve.resolveTheme(themeData, window.location.hostname);
        }
        if (!themeData) return null;
        const host = window.location.hostname;
        const siteTheme = themeData.siteThemes && themeData.siteThemes[host];
        if (siteTheme && siteTheme.enabled !== false) {
            return siteTheme;
        }
        const timed = resolveTimeBasedTheme(themeData.timeBasedRule);
        if (timed) return timed;
        return themeData.globalTheme || null;
    }

    function resolveTimeBasedTheme(rule) {
        if (Resolve) return Resolve.resolveTimeBasedTheme(rule);
        return null;
    }

    // 2. CORE THEME GENERATOR
    function getFullStyleSheet(theme) {
        if (!theme) return '';
        const bgColor = theme.background || '#121212';
        const textColor = theme.text || '#e0e0e0';
        const linkColor = theme.link || '#8ab4f8';
        // Consistency: only true split when colors parse successfully.
        const wantsSplit = !!(Split && Split.isSplitTheme(theme));
        const splitColors = wantsSplit ? Split.parseSplitColors(theme.backgroundGradient || theme) : null;
        const isSplit = !!(wantsSplit && splitColors);
        const isGradient = !isSplit && theme.backgroundType === 'gradient' && !!theme.backgroundGradient;
        const bgGradient = isGradient ? theme.backgroundGradient : null;

        const siteFix = getSiteFix(window.location.hostname);
        const usesGradientBg = !!bgGradient;
        const invertText = (Split && Split.SPLIT_INVERT_TEXT) || '#ffffff';
        const resolvedText = isSplit ? invertText : textColor;
        const resolvedLink = isSplit ? invertText : linkColor;
        const splitLayerCss = (isSplit && Split && Split.liveSplitPaintCss)
            ? Split.liveSplitPaintCss(splitColors.dark, splitColors.light, Split.SPLIT_PCT_START)
            : (isSplit && Split && Split.liveSplitLayerCss)
                ? Split.liveSplitLayerCss(splitColors.dark, splitColors.light, Split.SPLIT_PCT_START)
                : '';

        const surface = isSplit
            ? 'rgba(128, 128, 128, 0.22)'
            : 'rgba(255, 255, 255, 0.08)';
        const elevated = isSplit
            ? 'rgba(128, 128, 128, 0.32)'
            : 'rgba(255, 255, 255, 0.14)';
        const border = isSplit
            ? 'rgba(128, 128, 128, 0.35)'
            : 'rgba(255, 255, 255, 0.15)';

        const layoutTags = `
                div, main, section, article, header, nav, aside,
                ul, ol, li, footer, figure, figcaption,
                table, thead, tbody, tfoot, tr, td, th,
                form, fieldset, a
        `;
        const overlayNot =
            ':not([role="dialog"]):not([role="alertdialog"]):not([role="menu"]):not([role="listbox"]):not([aria-modal="true"]):not(dialog):not([popover])' +
            // Toast/snackbar notifications (react-toastify, notistack, sonner,
            // ...) use role="alert"/"status" or aria-live, not role="dialog" —
            // exempt them from the blanket transparency strip too, so their
            // own semantic color (red/green/blue for error/success/info)
            // survives instead of leaving a colorless, backgroundless
            // notification. Unlike a real dialog/menu, a toast's color IS the
            // message, so it's exempted from the strip rather than routed
            // through the generic --aura-overlay wash the JS overlay pass
            // uses for ARIA dialogs. A toast that happens to be near-white is
            // still caught by the separate (tag-based) bright-surface pass.
            ':not([role="alert"]):not([role="status"]):not([aria-live="assertive"]):not([aria-live="polite"])' +
            getUniversalTransparencyExcludeNot(window.location.hostname);
        const textBlend = 'normal';
        const splitTextFill = (isSplit && Split && Split.liveSplitTextFillCss && Split.liveSplitTextGradient)
            ? Split.liveSplitTextFillCss(Split.liveSplitTextGradient(Split.SPLIT_PCT_START))
            : '';
        const splitLinkFill = (isSplit && Split && Split.liveSplitTextFillCss && Split.liveSplitLinkGradient)
            ? Split.liveSplitTextFillCss(Split.liveSplitLinkGradient(Split.SPLIT_PCT_START))
            : '';
        const colorScheme = (H && H.isThemeBackgroundLight && H.isThemeBackgroundLight(bgColor))
            ? 'light'
            : 'dark';

        return `
            :root {
                --aura-bg: ${bgColor};
                --aura-text: ${resolvedText};
                --aura-link: ${resolvedLink};
                --aura-surface: ${surface};
                --aura-elevated: ${elevated};
                --aura-muted: color-mix(in srgb, var(--aura-text) 65%, transparent);
                --aura-border: ${border};
                --aura-overlay: color-mix(in srgb, var(--aura-bg) 82%, #000000);
                /* Semantic / design-system tokens (Wikipedia Codex, etc.).
                   !important on all of these: they deliberately collide with
                   real sites' own variable names to hijack their theming —
                   confirmed live on Wikipedia, whose own native dark mode
                   defines "html.skin-theme-clientpref-night { --color-base:
                   #eaecf0 }", a higher-specificity selector than bare :root
                   that silently wins (and defeats this hijack) whenever a
                   user has Wikipedia's own dark mode active, since neither
                   side previously had !important to settle it. */
                --color-base: var(--aura-text) !important;
                --color-emphasized: var(--aura-text) !important;
                --color-subtle: var(--aura-muted) !important;
                --color-progressive: var(--aura-link) !important;
                --color-visited: var(--aura-link) !important;
                --color-link: var(--aura-link) !important;
                --color-link-red: var(--aura-link) !important;
                --color-base-fixed: var(--aura-text) !important;
                --color-emphasized-fixed: var(--aura-text) !important;
                --background-color-base: var(--aura-bg) !important;
                --background-color-neutral: var(--aura-surface) !important;
                --background-color-neutral-subtle: transparent !important;
                --background-color-interactive: var(--aura-elevated) !important;
                --background-color-interactive-subtle: var(--aura-surface) !important;
                /* Discord / common app-shell tokens */
                --background-primary: var(--aura-bg) !important;
                --background-secondary: var(--aura-surface) !important;
                --background-tertiary: var(--aura-elevated) !important;
                --md-sys-color-surface: var(--aura-surface) !important;
                --bg-primary: var(--aura-bg) !important;
                --color-background: var(--aura-bg) !important;
            }
            html {
                color-scheme: ${colorScheme} !important;
                background-color: ${isSplit ? splitColors.dark : bgColor} !important;
                ${isSplit ? '' : 'background-image: none !important;'}
            }
            ${isSplit ? `
            /* Dual: corner-to-corner on the visual viewport. html background is
               the mix-blend backdrop; html::before is the compositor lock. */
            ${splitLayerCss}
            body {
                background-color: transparent !important;
                background-image: none !important;
                color: var(--aura-text) !important;
            }
            ` : usesGradientBg ? `
            html {
                background-image: ${bgGradient} !important;
                background-attachment: fixed !important;
                background-repeat: no-repeat !important;
                background-size: cover !important;
            }
            body {
                background-color: transparent !important;
                background-image: none !important;
                color: var(--aura-text) !important;
            }` : `
            html {
                background: ${bgColor} !important;
            }
            body {
                background-color: ${bgColor} !important;
                background: ${bgColor} !important;
                color: var(--aura-text) !important;
            }`}


            :is(${layoutTags})${overlayNot} {
                background-color: transparent !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
            }

            /* thead is swept into the transparent rule above like every other
               layout tag, flattening header/body rows into an undifferentiated
               grid on every site except Wikipedia's dedicated .wikitable fix.
               Same :is()+overlayNot shape as the rule above, so this matches
               it in specificity and wins purely by coming later in the
               stylesheet — no JS pass needed. Scoped to <thead> only (not
               <th> generally) so scattered <th scope="row"> cells inside a
               data table's body aren't individually painted. thead's own
               background legitimately shows through its (already-transparent)
               child tr/th cells per normal table background-painting rules. */
            :is(thead)${overlayNot} {
                background-color: var(--aura-elevated) !important;
            }

            /* Common SPA roots: first-paint assist. JS inline !important is the guarantee. */
            #app, #app-mount, #root, #__next, #__nuxt {
                background-color: transparent !important;
                background-image: none !important;
            }

            dialog,
            [popover],
            [role="dialog"],
            [role="alertdialog"],
            [role="menu"],
            [role="listbox"],
            [aria-modal="true"] {
                background-color: var(--aura-overlay) !important;
                color: var(--aura-text) !important;
                -webkit-text-fill-color: var(--aura-text) !important;
                background-image: none !important;
                mix-blend-mode: normal !important;
            }
            dialog *,
            [popover] *,
            [role="dialog"] *,
            [role="alertdialog"] *,
            [role="menu"] *,
            [role="listbox"] *,
            [aria-modal="true"] * {
                mix-blend-mode: normal !important;
                -webkit-text-fill-color: var(--aura-text) !important;
                color: var(--aura-text) !important;
                background-clip: border-box !important;
                -webkit-background-clip: border-box !important;
            }
            dialog::backdrop {
                background-color: rgba(0, 0, 0, 0.45) !important;
            }
            dialog a,
            [popover] a,
            [role="dialog"] a,
            [role="alertdialog"] a,
            [role="menu"] a,
            [role="listbox"] a,
            [aria-modal="true"] a {
                color: var(--aura-link) !important;
            }

            /* Color only — do NOT paint --aura-surface. A fill here shows up as a
               highlight inside Google's search / AI "Ask anything" fields (those
               were already seamless via inherited transparency). White leftover
               inputs are cleared by the light-surface pass where safe. */
            input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"]):not([type="hidden"]),
            textarea,
            select {
                background-color: transparent !important;
                color: var(--aura-text) !important;
                caret-color: var(--aura-text) !important;
                mix-blend-mode: ${textBlend} !important;
                ${isSplit && splitTextFill ? splitTextFill : ''}
            }
            ::placeholder {
                color: var(--aura-muted) !important;
                opacity: 0.75;
            }
            input:-webkit-autofill,
            input:-webkit-autofill:hover,
            input:-webkit-autofill:focus,
            textarea:-webkit-autofill,
            select:-webkit-autofill {
                -webkit-text-fill-color: var(--aura-text) !important;
                caret-color: var(--aura-text) !important;
                transition: background-color 99999s ease-out 0s;
            }

            :is(
                [style*="background-color:#fff"],
                [style*="background-color: #fff"],
                [style*="background-color:#FFF"],
                [style*="background-color: #FFF"],
                [style*="background-color:#ffffff"],
                [style*="background-color: #ffffff"],
                [style*="background-color:#FFFFFF"],
                [style*="background-color: #FFFFFF"],
                [style*="background-color:white"],
                [style*="background-color: white"],
                [style*="background-color:rgb(255, 255, 255)"],
                [style*="background-color:rgb(255,255,255)"],
                [style*="background:#fff"],
                [style*="background: #fff"],
                [style*="background:#ffffff"],
                [style*="background: #ffffff"],
                [style*="background:#FFF"],
                [style*="background: #FFF"],
                [style*="background:#FFFFFF"],
                [style*="background: #FFFFFF"],
                [class*="bg-white"],
                [class*="bg-gray-50"],
                [class*="bg-slate-50"],
                [class*="bg-neutral-50"],
                [class*="bg-stone-50"]
            ):not(button):not([role="button"]):not(input):not(select):not(textarea):not(svg):not(img):not([class*="icon" i]):not([class*="Icon"]):not([role="dialog"]):not([role="alertdialog"]):not([role="menu"]):not([role="listbox"]):not([aria-modal="true"]):not(dialog):not([popover]) {
                background-color: transparent !important;
            }

            /* Citation / selection highlights (Google AI Overview uses
               background-IMAGE on <mark>, which the universal color-only
               rule never clears). Theme the wash so light text stays readable. */
            mark {
                background-color: var(--aura-elevated) !important;
                background-image: none !important;
                color: var(--aura-text) !important;
                -webkit-text-fill-color: var(--aura-text) !important;
            }

            h1, h2, h3, h4, h5, h6, p, li, td, th, label, figcaption, dt, dd,
            strong, em, b, i, small, blockquote, cite, code, pre, summary {
                ${isSplit && splitTextFill ? splitTextFill : `
                color: var(--aura-text) !important;
                mix-blend-mode: ${textBlend} !important;
                `}
            }
            a {
                ${isSplit && splitLinkFill ? splitLinkFill : `
                color: var(--aura-link) !important;
                mix-blend-mode: ${textBlend} !important;
                `}
            }
            img, svg, video, canvas, iframe {
                mix-blend-mode: normal !important;
            }

            /* Native form controls previously excluded from all styling
               (checkbox/radio/range/color inputs, <progress>) — accent-color
               is purpose-built for exactly this and broadly supported, so
               this is near-zero-risk theming essentially for free.
               !important: same class of bug just confirmed for scrollbar
               styling — accent-color is a popular, easy-to-set property many
               sites use for their own branded form controls (Bootstrap 5.3+
               form-checks among them), and a bare, non-important rule here
               loses to any such site rule of equal-or-higher specificity
               regardless of injection order. */
            input[type="checkbox"], input[type="radio"], input[type="range"], progress {
                accent-color: var(--aura-link) !important;
            }

            /* <meter> isn't part of the CSS Accent Color spec (unlike
               checkbox/radio/range/progress above), so it's completely
               untouched by the rule above and shows its default light track
               forever. Retint just the track via the WebKit pseudo-element
               Safari actually renders it with (this is a Safari extension) —
               the semantic value-color pseudo-elements (optimum/sub-optimum/
               even-less-good) are left alone. */
            meter {
                background: var(--aura-surface) !important;
            }
            meter::-webkit-meter-bar {
                background: var(--aura-surface) !important;
            }

            /* Polish: without these, a themed page still shows the native
               light-mode text-selection highlight, default scrollbars, and
               default focus ring, which reads as unfinished. !important on
               both: sites very commonly style their own ::selection (brand
               highlight color) and :focus-visible (accessibility/brand
               outline color) — same missing-!important defect class just
               confirmed for scrollbars and accent-color, and these two are
               if anything more commonly overridden by site CSS than either
               of those. */
            ::selection {
                background: var(--aura-overlay) !important;
                color: var(--aura-text) !important;
            }
            :focus-visible {
                outline-color: var(--aura-link) !important;
            }
            /* !important on all three: sites very commonly define their own
               scoped, higher-specificity scrollbar rules (confirmed on
               vuejs.org: ".file-selector[data-v-...]::-webkit-scrollbar-thumb
               { background-color: var(--color-branding) }") — without
               !important here, Aura's bare/universal selectors lose to any
               such rule regardless of injection order, leaving a
               light-mode-authored scrollbar color behind on an otherwise
               dark page. */
            * {
                scrollbar-color: var(--aura-elevated) var(--aura-bg) !important;
            }
            ::-webkit-scrollbar-thumb {
                background: var(--aura-elevated) !important;
            }
            ::-webkit-scrollbar-track {
                background: var(--aura-bg) !important;
            }

            /* Printing a themed page should never waste ink on a forced-dark
               background or produce broken on-paper contrast. */
            @media print {
                html, html body {
                    color-scheme: light !important;
                    background: #ffffff !important;
                }
                * {
                    background-color: transparent !important;
                    background-image: none !important;
                    color: #000000 !important;
                    box-shadow: none !important;
                }
            }

            ${siteFix}
        `;
    }

    // 2b. AMP — DEDICATED, ISOLATED PATH
    // AMP's DOM is a small, well-known vocabulary (hyphenated custom
    // elements + a handful of consent/notification widget patterns), unlike
    // the arbitrary SPA markup the general engine's JS safety-net passes
    // (sticky/overlay/shell walks) are tuned for. Rather than keep teaching
    // those generic, mutation-reactive heuristics about AMP one regression at
    // a time, AMP documents and the AMP consent iframe get their own static
    // stylesheet and skip the JS engine entirely (see applyTheme()).
    const AMP_GENERIC_CONTENT_TAGS = [
        'amp-img', 'amp-anim', 'amp-video', 'amp-video-iframe', 'amp-iframe',
        'amp-layout', 'amp-fit-text', 'amp-fx-flying-carpet',
        'amp-carousel', 'amp-base-carousel', 'amp-accordion', 'amp-sidebar',
        'amp-list', 'amp-social-share', 'amp-analytics', 'amp-pixel',
        'amp-embed', 'amp-ad', 'amp-geo', 'amp-selector',
    ];
    // Consent / notification chrome AMP (or a widget it embeds) renders as a
    // layout="fill" overlay. These must stay pass-through — forcing any
    // opaque fill on them curtains the whole viewport over the article.
    const AMP_OVERLAY_CHROME_SELECTORS = [
        'amp-consent', 'amp-sticky-ad', 'amp-lightbox', 'amp-user-notification',
        '.popupOverlay', '.consentPopup', '#myConsentFlow',
        '.onetrust-pc-dark-filter', '#onetrust-banner-sdk', '#onetrust-pc-sdk',
        '#onesignal-slidedown-container', '.onesignal-slidedown-container',
    ];

    /** Appended after getFullStyleSheet() for a top-level AMP document. */
    function getAmpDocumentOverrideCss() {
        return `
            :is(${AMP_GENERIC_CONTENT_TAGS.join(', ')}) {
                background-color: transparent !important;
                background-image: none !important;
            }
            :is(${AMP_OVERLAY_CHROME_SELECTORS.join(', ')}) {
                background-color: transparent !important;
                background-image: none !important;
            }
        `;
    }

    /**
     * Full replacement stylesheet for the AMP consent iframe (never combined
     * with getFullStyleSheet). No root paint at all: this frame is a
     * layout="fill" overlay, not a real page, and is invisible whenever it
     * has nothing to show — forcing html/body opaque would curtain the
     * article underneath even when no dialog is active.
     */
    function getAmpConsentFrameStyleSheet(theme) {
        if (!theme) return '';
        const textColor = theme.text || '#e0e0e0';
        const linkColor = theme.link || '#8ab4f8';
        const colorScheme = (H && H.isThemeBackgroundLight && H.isThemeBackgroundLight(theme.background || '#121212'))
            ? 'light'
            : 'dark';
        return `
            html {
                color-scheme: ${colorScheme} !important;
            }
            body {
                color: ${textColor} !important;
            }
            a {
                color: ${linkColor} !important;
            }
            :is(${AMP_OVERLAY_CHROME_SELECTORS.join(', ')}) {
                background-color: transparent !important;
                background-image: none !important;
            }
        `;
    }

    // 3. APPLY BACKGROUND DIRECTLY TO HTML/BODY
    function applyBackgroundColors(theme) {
        const bgColor = theme.background || '#121212';
        const wantsSplit = !!(Split && Split.isSplitTheme(theme));
        const splitColors = wantsSplit ? Split.parseSplitColors(theme.backgroundGradient || theme) : null;
        const isSplit = !!(wantsSplit && splitColors);
        const isGradient = !isSplit && theme.backgroundType === 'gradient' && !!theme.backgroundGradient;
        const imageBg = (!isSplit && isGradient) ? theme.backgroundGradient : null;
        const bodyTransparent = !!(imageBg || isSplit);

        if (document.documentElement) {
            const de = document.documentElement.style;
            const scheme = (H && H.isThemeBackgroundLight && H.isThemeBackgroundLight(bgColor))
                ? 'light'
                : 'dark';
            de.setProperty('color-scheme', scheme, 'important');
            if (isSplit) {
                const paint = (Split && Split.liveSplitBackground)
                    ? Split.liveSplitBackground(splitColors.dark, splitColors.light, Split.SPLIT_PCT_START)
                    : null;
                const grad = paint
                    ? paint.image
                    : Split.buildSplitGradient(splitColors.dark, splitColors.light, Split.SPLIT_PCT_START);
                de.setProperty('background-color', splitColors.dark, 'important');
                de.setProperty('background-image', grad, 'important');
                de.setProperty('background-repeat', 'no-repeat', 'important');
                de.setProperty('background-attachment', 'fixed', 'important');
                de.setProperty('background-position', '0 0', 'important');
                de.setProperty('background-size', paint && paint.sizeFallback ? paint.sizeFallback : '100vw 100vh', 'important');
                if (paint && paint.sizeMid) {
                    de.setProperty('background-size', paint.sizeMid, 'important');
                }
                if (paint && paint.size) {
                    de.setProperty('background-size', paint.size, 'important');
                }
            } else if (imageBg) {
                de.setProperty('background-color', bgColor, 'important');
                de.setProperty('background-image', imageBg, 'important');
                de.setProperty('background-attachment', 'fixed', 'important');
                de.setProperty('background-repeat', 'no-repeat', 'important');
                de.setProperty('background-size', 'cover', 'important');
                de.removeProperty('background-position');
            } else {
                de.setProperty('background', bgColor, 'important');
                de.setProperty('background-image', 'none', 'important');
                de.removeProperty('background-position');
                de.removeProperty('background-size');
            }
        }

        if (document.body) {
            const bs = document.body.style;
            if (bodyTransparent) {
                bs.setProperty('background-color', 'transparent', 'important');
                bs.setProperty('background-image', 'none', 'important');
            } else {
                bs.setProperty('background-color', bgColor, 'important');
                bs.setProperty('background', bgColor, 'important');
            }
        }

        // Live split paints on html. Drop any leftover sibling wallpaper.
        removeSplitLayer();
    }

    // 3b. BRIGHT / LIGHT-SURFACE SAFETY NET
    // CSS tag/class rules lose to high-specificity or CSS-variable whites on
    // random sites. Clear near-white and low-chroma light-gray leftovers;
    // never touch controls, icons, media, dialogs, modal cards, or tiny tiles.

    // Google AI Overview collapse-fade: empty overlay in the same parent as
    // the expander. Google-only — never run this detector on other hosts.
    function isAiOverviewCollapseFade(el) {
        if (!isGoogleHost() || !el || el.nodeType !== 1) return false;
        if (el.childNodes && el.childNodes.length) return false;
        const parent = el.parentElement;
        if (!parent || typeof parent.querySelector !== 'function') return false;
        try {
            return !!parent.querySelector(
                '[aria-controls="m-x-content"], [aria-label*="Show more AI" i]'
            );
        } catch (e) {
            return false;
        }
    }

    function visitBrightElement(el, vh, vw) {
        if (!el || el.nodeType !== 1 || !H || overlayModified.has(el)) return;
        if (el === document.documentElement || el === document.body) return;
        if (el.id === 'aura-core-engine') return;

        let style;
        try { style = getComputedStyle(el); } catch (e) { return; }

        let rect;
        try { rect = el.getBoundingClientRect(); } catch (e) { return; }

        const mask = style.webkitMaskImage || style.maskImage;
        const overlayRoot = H.isOverlayRoot(el);
        const floatingBannerRoot = H.isFloatingBannerRoot(el, getComputedStyle, { vh, vw });
        const modalCard = !!(H.isLikelyModalCard && H.isLikelyModalCard(el, getComputedStyle, { vh, vw }));
        const isControl = !!(H.BRIGHT_SKIP_TAGS && H.BRIGHT_SKIP_TAGS[el.tagName]);
        const hasSearchField = !!(H.elementHasSearchField && H.elementHasSearchField(el));
        const collapseFade = isAiOverviewCollapseFade(el);
        if (collapseFade) return;

        // Only computed for BUTTON — el.textContent walks the whole subtree,
        // and every other tag ignores this field, so computing it
        // unconditionally for every element in the main walk would add an
        // O(subtree-size) cost site-wide for a value only the icon-only-
        // button carve-out (shouldSkipBrightElement) ever reads.
        let textLength;
        if (el.tagName === 'BUTTON') {
            let text = '';
            try { text = String(el.textContent || '').replace(/\s+/g, ' ').trim(); } catch (e) {}
            textLength = text.length;
        }

        if (H.shouldSkipBrightElement({
            tag: el.tagName,
            role: el.getAttribute('role'),
            className: typeof el.className === 'string' ? el.className : '',
            inSvg: typeof el.closest === 'function' && !!el.closest('svg'),
            mask: mask || 'none',
            visibility: style.visibility,
            opacity: style.opacity,
            width: rect.width,
            height: rect.height,
            overlayRoot,
            floatingBannerRoot,
            modalCard,
            hasSearchField,
            textLength,
        })) {
            return;
        }

        if (H.shouldClearLayoutGradient && H.shouldClearLayoutGradient({
            id: el.id,
            tag: el.tagName,
            width: rect.width,
            height: rect.height,
            vh,
            vw,
            overlayRoot,
            overlayChrome: H.isOverlayChrome(el),
            backgroundImage: style.backgroundImage,
            isControl,
            collapseFade,
        })) {
            el.style.setProperty('background-image', 'none', 'important');
            brightModified.add(el);
        }

        const isLight = H.isLightContentSurface || H.isNearWhiteSurface;
        const parsed = H.parseCssRgb(style.backgroundColor);
        if (!isLight(parsed)) return;

        // Light themes (Sepia, Paper, Light Mode): Google Images viewer cards
        // are beige/white stacked layers. Clearing them makes Visit/Share/Save
        // and captions overlap. Keep author fills when the page is already light.
        if (H.isThemeBackgroundLight && currentTheme && H.isThemeBackgroundLight(currentTheme.background)) {
            return;
        }

        el.style.setProperty('background-color', 'transparent', 'important');
        brightModified.add(el);
    }

    function rethemeBrightSurfaces(root) {
        if (!root || !currentTheme || !H) return;
        const { vh, vw } = passViewport();
        const elements = collectElements(root);
        const limit = Math.min(elements.length, WALK_SLICE);
        for (let i = 0; i < limit; i++) {
            visitBrightElement(elements[i], vh, vw);
        }
    }

    // 3c. OVERLAY / POPUP SAFETY NET
    // Sticky pass skips dialogs (hidden cookie sheets, etc.). Visible modals
    // still need an opaque sheet so theming cannot leave them glass-like.
    // Full-viewport and covering-sheet scrims are left transparent (Maps /
    // cookie-curtain guard); their inner card is painted instead.
    function paintOverlaySheet(el) {
        el.style.setProperty('background-color', 'var(--aura-overlay)', 'important');
        el.style.setProperty('mix-blend-mode', 'normal', 'important');
        // Icon-font glyphs (Font Awesome et al.) render via inherited `color`
        // with no text content of their own, so the separate contrast pass
        // (which reads textContent) never sees them — pairing a guaranteed
        // legible text color with every opaque background write here avoids
        // a same-tone icon-on-background invisibility (confirmed as a risk
        // on coingecko's fixed scroll-to-top button, whose Tailwind
        // light-mode text-color classes would otherwise sit unchanged on a
        // freshly dark-painted background).
        el.style.setProperty('color', 'var(--aura-text)', 'important');
        overlayModified.add(el);
    }

    function paintModalCardSheet(el) {
        paintOverlaySheet(el);
        modalCardOpaqueModified.add(el);
    }

    function isOverlayCoveringSheet(rect, vh, vw) {
        if (!rect) return false;
        if (H.isFullViewportRect(rect, vh, vw)) return true;
        return !!(H.isCoveringSheetRect && H.isCoveringSheetRect(rect, vh, vw));
    }

    function paintOverlayScrimAsTransparent(el, vh, vw) {
        // Google Images viewer is a full-screen second page, not a cookie
        // scrim. Leave it opaque so the mosaic cannot show through. Inline
        // !important is required: a stylesheet SITE_FIX loses to this pass's
        // previous transparent write.
        modalCardOpaqueModified.delete(el);
        if (isGoogleImagesPage()) {
            el.style.setProperty('background-color', 'var(--aura-bg)', 'important');
            el.style.setProperty('background-image', 'none', 'important');
            overlayModified.add(el);
            return;
        }
        el.style.setProperty('background-color', 'transparent', 'important');
        overlayModified.add(el);
        const inner = H.findInnerModalCard
            ? H.findInnerModalCard(el, getComputedStyle, { vh, vw })
            : null;
        if (inner) {
            paintOverlaySheet(inner);
            return;
        }
        // Some genuine ARIA dialogs (role="dialog"/"alertdialog", aria-modal,
        // <dialog>, [popover]) wrap a content panel that is ITSELF
        // full-viewport-sized on mobile — e.g. booking.com's "More"
        // traveller/currency/language sheet: the [role="dialog"] node has no
        // background of its own, and the actual white panel is a plain,
        // role-less <div> one level inside it, sized to the full viewport.
        // findInnerModalCard/isModalCardShape deliberately won't match that
        // shape (covering-sheet sizes are excluded there to avoid painting
        // empty ad curtains opaque), so only look for a full-viewport
        // content panel here — gated on `el` itself already being a
        // confirmed ARIA overlay root, never an anonymous curtain wrapper.
        if (H.isOverlayRoot && H.isOverlayRoot(el) && H.findInnerDialogPanel) {
            const panel = H.findInnerDialogPanel(el, getComputedStyle, { vh, vw });
            if (panel) paintOverlaySheet(panel);
        }
    }

    /**
     * CMP wrappers often start card-sized (opaque paint), then expand to a
     * covering sheet. isLikelyModalCard then becomes false, so the walk stops
     * touching them — without this pass the earlier --aura-overlay fill stays
     * forever (fox5sandiego.com curtain).
     */
    function revertGrownModalCards(vh, vw) {
        if (!H) return;
        Array.from(modalCardOpaqueModified).forEach(el => {
            if (!el || !el.isConnected) {
                modalCardOpaqueModified.delete(el);
                return;
            }
            let rect;
            try { rect = el.getBoundingClientRect(); } catch (e) {
                modalCardOpaqueModified.delete(el);
                return;
            }
            const covering = isOverlayCoveringSheet(rect, vh, vw);
            let stillCard = false;
            try {
                stillCard = !!(H.isLikelyModalCard
                    && H.isLikelyModalCard(el, getComputedStyle, { vh, vw }));
            } catch (e2) {
                stillCard = false;
            }
            // Nav drawers are expected to be covering-sheet sized while
            // open — that's not the curtain-growth signal it is for a plain
            // modal card. Only revert one if it's actually closed/hidden.
            let isNavDrawer = false;
            try {
                isNavDrawer = !!(H.isLikelyNavDrawer
                    && H.isLikelyNavDrawer(el, getComputedStyle, { vh, vw }));
            } catch (eNav) {
                isNavDrawer = false;
            }
            // High z-index is the OneSignal/OneTrust/video-float curtain
            // tier — but nav drawers legitimately sit above everything else
            // on the page too, so it can't be a revert trigger for those.
            let highZ = false;
            try {
                const z = parseInt(getComputedStyle(el).zIndex, 10);
                highZ = !isNaN(z) && z >= 1000 && !isNavDrawer;
            } catch (e3) {}
            const coveringMeansCurtain = covering && !isNavDrawer;
            if ((!stillCard && !isNavDrawer) || coveringMeansCurtain || highZ) {
                paintOverlayScrimAsTransparent(el, vh, vw);
            }
        });
    }

    function reopaqueOverlays(root) {
        if (!root || !currentTheme || !H) return;

        const { vh, vw } = passViewport();
        const seen = new Set();
        const scope = root.nodeType === 1 ? root : document.documentElement;
        const candidates = [];

        try {
            const listed = scope.querySelectorAll(
                (H && H.OVERLAY_SELECTOR) ||
                'dialog, [popover], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [aria-modal="true"]'
            );
            listed.forEach(el => candidates.push(el));
            if (root.nodeType === 1 && H.isOverlayRoot(root)) {
                candidates.unshift(root);
            }
        } catch (e) {
            return;
        }

        function consider(el) {
            if (!el || el.nodeType !== 1 || seen.has(el)) return;
            seen.add(el);
            if (H.isSearchChrome && H.isSearchChrome(el)) return;

            let style;
            try { style = getComputedStyle(el); } catch (e) { return; }
            if (style.visibility === 'hidden' || style.opacity === '0') return;
            if (style.display === 'none') return;

            let rect;
            try { rect = el.getBoundingClientRect(); } catch (e) { return; }
            if (rect.width < 1 || rect.height < 1) return;

            if (isOverlayCoveringSheet(rect, vh, vw)) {
                paintOverlayScrimAsTransparent(el, vh, vw);
                return;
            }

            paintOverlaySheet(el);
        }

        candidates.forEach(consider);
    }

    function visitOverlayModalWalk(el, vh, vw, seen) {
        if (!el || el.nodeType !== 1 || !H || seen.has(el)) return;
        if (isAdThemingSkipped(el)) return;
        if (H.isAmpOverlayChrome && H.isAmpOverlayChrome(el)) {
            if (modalCardOpaqueModified.has(el)) {
                paintOverlayScrimAsTransparent(el, vh, vw);
            }
            return;
        }
        // Full-screen / near-full-screen nav drawers (hamburger menus) are
        // real, deliberately-opened UI — unlike curtain artifacts, they must
        // stay opaque even at covering-sheet size and high z-index, or the
        // menu text becomes unreadable against the page bleeding through.
        // Gated on a confirmed collapsed -> expanded TRANSITION (see
        // navDrawerStateHistory above), not on "currently looks expanded"
        // alone — that level-triggered check is what mispainted
        // wtatennis.com's ambient sticky nav bar into a curtain.
        if (H.classifyNavDrawerState && !isChromeRepaintDisabledForHost()) {
            const navState = H.classifyNavDrawerState(el, getComputedStyle, { vh, vw });
            if (navState === 'expanded') {
                seen.add(el);
                const prevNavState = navDrawerStateHistory.get(el);
                const isOpenTransition = !!(H.isNavDrawerOpenTransition
                    && H.isNavDrawerOpenTransition(prevNavState, navState));
                navDrawerStateHistory.set(el, 'expanded');
                // Paint on a confirmed open transition, or keep repainting an
                // already-confirmed drawer every pass (self-healing if the
                // site's own script strips our inline style) — but never
                // merely because it "currently looks expanded" with no prior
                // collapsed sighting.
                if (isOpenTransition || modalCardOpaqueModified.has(el)) {
                    let navStyle;
                    try { navStyle = getComputedStyle(el); } catch (e) { return; }
                    if (navStyle.visibility === 'hidden' || navStyle.opacity === '0') return;
                    if (navStyle.display === 'none') return;
                    let navRect;
                    try { navRect = el.getBoundingClientRect(); } catch (e) { return; }
                    if (navRect.width < 1 || navRect.height < 1) return;
                    paintModalCardSheet(el);
                }
                return;
            }
            if (navState === 'collapsed') {
                navDrawerStateHistory.set(el, 'collapsed');
            }
            // 'ambiguous' or null (not a candidate): leave history untouched
            // and fall through to the checks below, same as before.
        }
        if (H.isLikelyModalCard && H.isLikelyModalCard(el, getComputedStyle, { vh, vw })) {
            seen.add(el);
            if (H.isSearchChrome && H.isSearchChrome(el)) return;
            let style;
            try { style = getComputedStyle(el); } catch (e) { return; }
            if (style.visibility === 'hidden' || style.opacity === '0') return;
            if (style.display === 'none') return;
            // Overlay-tier shells (OneSignal / OneTrust / video float) must stay
            // transparent — painting them --aura-overlay is the same curtain
            // class as sticky re-opaque on these sites.
            const z = parseInt(style.zIndex, 10);
            if (!isNaN(z) && z >= 1000) {
                if (modalCardOpaqueModified.has(el)) {
                    paintOverlayScrimAsTransparent(el, vh, vw);
                }
                return;
            }
            let rect;
            try { rect = el.getBoundingClientRect(); } catch (e) { return; }
            if (rect.width < 1 || rect.height < 1) return;
            if (isOverlayCoveringSheet(rect, vh, vw)) {
                paintOverlayScrimAsTransparent(el, vh, vw);
                return;
            }
            paintModalCardSheet(el);
        }
    }

    function revertGoogleImagesMosaic() {
        googleImagesMosaicHidden.forEach(el => {
            try { el.style.removeProperty('visibility'); } catch (e) {}
        });
        googleImagesMosaicHidden.clear();
    }

    function paintGoogleImagesSheet(el) {
        if (!el || el === document.body || el === document.documentElement) return;
        el.style.setProperty('background-color', 'var(--aura-bg)', 'important');
        el.style.setProperty('background-image', 'none', 'important');
        overlayModified.add(el);
    }

    function hideGoogleImagesMosaicEl(el) {
        if (!el || el.nodeType !== 1) return;
        el.style.setProperty('visibility', 'hidden', 'important');
        googleImagesMosaicHidden.add(el);
    }

    /**
     * Current Images UI (udm=2) does not use #islrg / .tvh9oe. The viewer is
     * a covering sheet with a Close control; hashed classes change. Walk from
     * the close button / dialog to a large ancestor and paint it opaque, then
     * hide mosaic siblings so the original grid cannot show through.
     */
    function paintGoogleImagesViewer(root) {
        revertGoogleImagesMosaic();
        if (!isGoogleImagesPage() || !H) return;

        const { vh, vw } = passViewport();
        const scope = root && root.nodeType === 1 ? root : document.documentElement;
        const covers = new Set();

        function considerCover(el) {
            if (!el || el.nodeType !== 1 || covers.has(el)) return;
            if (el === document.body || el === document.documentElement) return;
            let rect;
            try { rect = el.getBoundingClientRect(); } catch (e) { return; }
            if (rect.width < vw * 0.7 || rect.height < vh * 0.45) return;
            let style;
            try { style = getComputedStyle(el); } catch (e2) { return; }
            if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') return;
            covers.add(el);
            paintGoogleImagesSheet(el);
        }

        function coverFrom(start) {
            if (!start) return;
            let node = start;
            while (
                node &&
                node.nodeType === 1 &&
                node !== document.body &&
                node !== document.documentElement
            ) {
                let rect;
                try { rect = node.getBoundingClientRect(); } catch (e) { break; }
                if (rect.width >= vw * 0.7 && rect.height >= vh * 0.45) {
                    considerCover(node);
                    return;
                }
                node = node.parentElement;
            }
        }

        let listed;
        try {
            listed = scope.querySelectorAll(
                '[aria-modal="true"], [role="dialog"], [role="alertdialog"]'
            );
        } catch (e) {
            listed = [];
        }
        listed.forEach(considerCover);

        let closers;
        try {
            closers = scope.querySelectorAll(
                '[aria-label="Close"], [aria-label="Close image"], [aria-label="Close dialog"]'
            );
        } catch (e2) {
            closers = [];
        }
        closers.forEach(btn => coverFrom(btn));

        covers.forEach(cover => {
            const parent = cover.parentElement;
            if (!parent) return;
            for (let i = 0; i < parent.children.length; i++) {
                const sib = parent.children[i];
                if (!sib || sib === cover) continue;
                if (sib.contains(cover) || cover.contains(sib)) continue;
                hideGoogleImagesMosaicEl(sib);
            }
        });

        try {
            const mosaic = scope.querySelectorAll('#islrg, #islmp');
            if (covers.size > 0) {
                mosaic.forEach(hideGoogleImagesMosaicEl);
            }
        } catch (e3) {}
    }

    // 3d. STICKY/FIXED SAFETY NET
    // The universal transparency rule (getFullStyleSheet) strips backgrounds off
    // sticky/fixed headers and bars, so page content scrolls through them. CSS
    // can't select by computed position, so re-opaque ONLY chrome-like bars here.
    // Full-viewport and covering-sheet fixed overlays (HubSpot anchors, cookie
    // modals, fox5-class CMP wrappers, etc.) must NOT be painted — doing so
    // creates a solid theme-colored curtain over the page (seen on usopen.com /
    // wta.com / fox5sandiego.com) with content only peeking on overscroll.
    // Visible dialogs are handled by reopaqueOverlays instead.
    // Skip alone is not enough: an element painted while small must have its
    // inline fill cleared once a later pass decides it should be skipped
    // (covering-sheet growth while scrolling).
    function revertStickyPaint(el) {
        try {
            el.style.removeProperty('background-color');
            el.style.removeProperty('color');
        } catch (e) {}
        stickyModified.delete(el);
    }

    function isAdThemingSkipped(el) {
        if (!el || !H) return false;
        try {
            if (H.isInsideAdSurface && H.isInsideAdSurface(el)) return true;
        } catch (e) {}
        return false;
    }

    // Host-scoped exclusions from EVERY opaque-chrome repaint pass below
    // (sticky/fixed safety net, top-chrome seeding). These are legitimate
    // sticky/fixed CONTENT sections (not chrome) that still get swept up by
    // one of those passes — e.g. too short to trip the covering-sheet skip,
    // or a bare semantic <header>/<nav> tag that the top-chrome seed treats
    // as chrome by tag alone. The site's own layout intentionally scrolls
    // other content up over/under them, and an opaque --aura-bg paint blocks
    // that reveal instead of letting it show through. CSS can't stop this
    // (our own inline style already wins any stylesheet !important), so it
    // has to be a JS-side skip like this one.
    //
    // wtatennis.com: `.page-hero` / `[data-widget*="sticky-page-hero"]` is a
    // `<header>` that is `position: sticky; top: 0; z-index: 0` (confirmed
    // via the site's own screen.css) and pins at the top of the viewport
    // while later sections scroll up over it. Both reopaqueStickyFixed
    // (generic sticky safety net) AND reopaqueTopChrome (which treats any
    // semantic <header>/<nav> near the top as chrome, regardless of nav
    // signal, since the UC Davis relaxation) paint it opaque independently —
    // it has to be excluded from both. Painting it opaque produces exactly
    // the reported bug: page looks fine, then gets curtained by the theme
    // color, with content only flashing through while actively scrolling.
    const CHROME_PAINT_HOST_SKIPS = [
        {
            match: ['wtatennis.com'],
            selectors: ['.page-hero', '[data-widget*="sticky-page-hero"]']
        }
    ];

    // Kill-switch for the two opaque-repaint passes that treat "is this
    // fixed/sticky and near the top" alone as evidence of legitimate chrome,
    // rather than trying to name every element. wtatennis.com's own
    // screen.css shows its <nav class="main-navigation"> is `position:
    // relative` by default and only becomes `position: sticky` when the
    // site's OWN scroll JS toggles a `scroll-lock`/`scroll-lock-off` class
    // post-load (a hide-on-scroll-down / show-on-scroll-up nav pattern) —
    // not from any authored fixed/sticky CSS present at initial paint. That
    // exactly matches the reported timing (fine at first, curtained about a
    // second later) and the scroll behavior (content flashes through only
    // while actively scrolling, then gets re-covered once scrolling stops
    // and our passes re-run). Because the element only becomes fixed/sticky
    // via a class toggle we cannot distinguish in advance from a real nav
    // bar becoming sticky, targeting it by selector (as with the .page-hero
    // skip above) does not generalize here.
    //
    // This host-disable is checked in FOUR places: reopaqueStickyFixed,
    // reopaqueTopChrome, restoreAuthoredChromeOpacity, and the
    // isLikelyNavDrawer branch in visitOverlayModalWalk.
    //
    // A narrower version once disabled only the first two (reasoning: only
    // those fired on the thin sticky nav bar, so the other two should be
    // safe to leave on and would let the opened hamburger drawer stay
    // opaque). That reasoning did not hold up on-device — re-enabling
    // restoreAuthoredChromeOpacity / isLikelyNavDrawer for this host brought
    // the curtain back. Root cause unconfirmed (no live DOM access), but the
    // empirical result is unambiguous: on wtatennis.com, all four have to
    // stay off together. Do not narrow this again without on-device
    // confirmation that the curtain is still gone — this is the second time
    // that exact change has reintroduced it.
    //
    // Net effect: the opened hamburger menu on this host is NOT repainted by
    // any of these four — that trade was made deliberately to keep the
    // curtain fixed, since the curtain was reported as the more severe
    // issue. The menu is instead fixed by a mechanism outside these four:
    // wtatennis.com paints its mobile menu's background via a `::before`
    // pseudo-element (`.main-navigation__mobile:before`), not a real
    // element background, so it's handled by visitPseudoBgElement's
    // nav-panel branch (see clearFullBleedPseudoBackgrounds) instead —
    // untouched by this host-disable, and by construction never touches
    // `.page-hero`/the sticky nav bar, so it carries no risk of
    // reintroducing the curtain.
    //
    // github.com: confirmed via extensive headless + on-device testing —
    // the mobile hamburger/close toggle is three <span> bars painted via
    // `background-color: currentColor` (see visitContrastElement's
    // currentColor-fill skip), inside plain <div> ancestors that
    // reopaqueTopChrome repaints as chrome. GitHub runs a CSS `transform`
    // transition on those bars when the menu opens (rotating hamburger ->
    // X); with reopaqueTopChrome repeatedly repainting the same ancestor
    // chain while that transition is active, the browser's compositor
    // fails to ever paint the transitioning bars — genuinely present
    // (correct color, correct geometry) but zero rendered pixels. Neither
    // a competing stylesheet rule nor a post-hoc JS repaint avoids this;
    // only leaving the chain alone entirely does (see
    // UNIVERSAL_TRANSPARENCY_HOST_EXCLUDES below for the other half of
    // this fix — CSS-level exclusion for the same ancestor chain). Net
    // effect, same trade-off as wtatennis.com above: the header loses its
    // themed background (falls back to GitHub's own near-black chrome)
    // while the mobile menu is open, in exchange for the close button,
    // logo, and sign-in link being visible at all.
    const CHROME_REPAINT_DISABLED_HOSTS = ['wtatennis.com', 'github.com'];

    function isChromeRepaintDisabledForHost() {
        let host;
        try { host = String(window.location.hostname || '').toLowerCase(); } catch (e) { return false; }
        if (!host) return false;
        return Resolve && Resolve.hostMatches
            ? Resolve.hostMatches(host, CHROME_REPAINT_DISABLED_HOSTS)
            : CHROME_REPAINT_DISABLED_HOSTS.some(h => host === h || host.endsWith('.' + h));
    }

    function isChromePaintHostSkipped(el) {
        if (!el) return false;
        let host;
        try { host = String(window.location.hostname || '').toLowerCase(); } catch (e) { return false; }
        if (!host) return false;
        for (let i = 0; i < CHROME_PAINT_HOST_SKIPS.length; i++) {
            const entry = CHROME_PAINT_HOST_SKIPS[i];
            const matches = Resolve && Resolve.hostMatches
                ? Resolve.hostMatches(host, entry.match)
                : entry.match.some(h => host === h || host.endsWith('.' + h));
            if (!matches) continue;
            for (let j = 0; j < entry.selectors.length; j++) {
                try { if (el.matches(entry.selectors[j])) return true; } catch (e2) {}
            }
        }
        return false;
    }

    function visitStickyElement(el, vh, vw) {
        if (!el || el.nodeType !== 1 || !H) return;
        if (isAdThemingSkipped(el) || isChromePaintHostSkipped(el)) {
            if (stickyModified.has(el)) revertStickyPaint(el);
            return;
        }
        if (H.isAmpOverlayChrome && H.isAmpOverlayChrome(el)) {
            if (stickyModified.has(el)) revertStickyPaint(el);
            return;
        }
        // Modal cards / promos are the overlay pass's job — never paint them
        // as chrome with --aura-bg (OneSignal, cookie cards, etc.).
        if (H.isLikelyModalCard && H.isLikelyModalCard(el, getComputedStyle, { vh, vw })) {
            if (stickyModified.has(el)) revertStickyPaint(el);
            return;
        }
        let style;
        try { style = getComputedStyle(el); } catch (e) { return; }
        let rect;
        try { rect = el.getBoundingClientRect(); } catch (e) { return; }
        const mask = style.webkitMaskImage || style.maskImage;
        // A position:fixed element that covers most of the viewport and is
        // NOT a recognized ARIA overlay, but DOES contain a genuine
        // modal-card-shaped descendant, is a custom (non-ARIA) modal/
        // bottom-sheet — e.g. Google's sports scorecard panel. Route it
        // through the same scrim treatment real ARIA dialogs already get
        // (transparent backdrop + opaque inner card) instead of leaving it
        // to whatever wins the plain cascade (confirmed on Google: the
        // panel itself renders fine, but its backdrop was left a flat
        // solid color instead of a dimmed view of the page behind it).
        if (style.position === 'fixed'
            && !H.isOverlayChrome(el)
            && isOverlayCoveringSheet(rect, vh, vw)) {
            const inner = H.findInnerModalCard && H.findInnerModalCard(el, getComputedStyle, { vh, vw });
            if (inner) {
                paintOverlayScrimAsTransparent(el, vh, vw);
                return;
            }
        }
        // Layout geometry (unlike background-color, which the universal
        // transparency rule already forces !important before any JS pass
        // runs) is never touched by Aura's stylesheet, so this reliably
        // reads the site's true original layout regardless of when it's
        // sampled. Capped at a handful of children to keep this cheap —
        // busier bars are much more likely genuine chrome anyway, so
        // skipping the computation there (leaving childCoverageFrac null,
        // which the predicate treats as "don't apply this gate") is safe.
        let childCoverageFrac = null;
        // Same pass, but only counting children that already carry their own
        // opaque authored background (buttons with a real fill, not plain
        // text/links leaning on the container for contrast). A wrapper whose
        // children are already self-opaque doesn't need painting itself,
        // regardless of how much of the width they cover — confirmed on
        // sky.coflnet.com's Notify/copy/scroll-to-top bottom bar, where three
        // pre-styled buttons fill most of the bar but the wrapper still got
        // re-opaqued behind/around them.
        let childOpaqueCoverageFrac = null;
        try {
            if (rect.width > 0) {
                // A position:fixed element is very often just a placement
                // shell around exactly one inner flex/grid row that does the
                // actual layout, with the buttons as THAT row's children —
                // not the outer shell's direct children (Tailwind-style
                // `fixed bottom-4` wrapper + `flex gap-2` row is the common
                // shape). Unwrap a couple of single-child levels first, same
                // "portals wrap the card in extra divs" philosophy as
                // findInnerModalCard, so the buttons are measured against
                // the row that actually holds them.
                let row = el;
                let unwrapDepth = 0;
                while (unwrapDepth < 2 && row.children && row.children.length === 1) {
                    row = row.children[0];
                    unwrapDepth++;
                }
                if (row.children && row.children.length > 0 && row.children.length <= 6) {
                    let covered = 0;
                    let coveredOpaque = 0;
                    for (let i = 0; i < row.children.length; i++) {
                        const child = row.children[i];
                        const w = child.getBoundingClientRect().width;
                        covered += w;
                        try {
                            const parsed = H.parseCssRgb(getComputedStyle(child).backgroundColor);
                            if (parsed && parsed.a >= 0.5) coveredOpaque += w;
                        } catch (e2) {}
                    }
                    childCoverageFrac = Math.min(1, covered / rect.width);
                    childOpaqueCoverageFrac = Math.min(1, coveredOpaque / rect.width);
                }
            }
        } catch (e) {}
        // z-index >= 1000 (below) is meant to catch real overlay/CMP/
        // notification tiers, but ordinary sticky sub-navigation commonly
        // uses a similarly "high enough to stay above content" z-index by
        // convention alone — confirmed on bbc.com's live-match Live
        // Reporting/Scores/Tables tab bar (role="tablist", z-index:1003),
        // painted transparent and overlapping the article underneath it as
        // a result. A tablist is an unambiguous ARIA role for real
        // navigation, never a notification/CMP widget, so it's exempted.
        let hasTablistRole = false;
        try {
            hasTablistRole = el.getAttribute('role') === 'tablist' || !!el.querySelector('[role="tablist"]');
        } catch (e4) {}
        if (H.shouldSkipStickyElement({
            position: style.position,
            mask: mask || 'none',
            visibility: style.visibility,
            opacity: style.opacity,
            overlayChrome: H.isOverlayChrome(el),
            tag: el.tagName,
            id: el.id,
            className: typeof el.className === 'string' ? el.className : '',
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
            zIndex: style.zIndex,
            vh,
            vw,
            childCoverageFrac,
            childOpaqueCoverageFrac,
            hasTablistRole,
        })) {
            if (stickyModified.has(el)) revertStickyPaint(el);
            return;
        }
        el.style.setProperty('background-color', 'var(--aura-bg)', 'important');
        // Same icon-legibility pairing as paintOverlaySheet — a small fixed
        // control (e.g. a scroll-to-top button) freshly painted opaque can't
        // rely on the separate textContent-based contrast pass to notice an
        // icon-font glyph with no text of its own.
        el.style.setProperty('color', 'var(--aura-text)', 'important');
        stickyModified.add(el);
    }

    // Small icon-only controls (close/share/kebab-menu) pinned via
    // position:fixed/absolute to float over media — a product photo, a map
    // — routinely carry their own translucent scrim so the icon stays
    // legible over whatever's underneath. The universal transparency rule
    // strips that scrim like any other div/a background, leaving a bare
    // icon glyph with nothing behind it (confirmed via screenshot on Google
    // Shopping's item-photo share/kebab-menu/close cluster). Idempotent,
    // no transition-gating needed (unlike the expand-in-place panels
    // above) — these controls don't toggle open/closed, they're just
    // present or not, so re-checking the current shape every pass and
    // reverting the moment it stops matching is sufficient.
    function revertFloatingIconControlPaint(el) {
        try {
            el.style.removeProperty('background-color');
            el.style.removeProperty('background-image');
        } catch (e) {}
        floatingIconControlModified.delete(el);
    }

    function visitFloatingIconControlElement(el, vh, vw) {
        if (!el || el.nodeType !== 1 || !H || !H.isLikelyFloatingIconControl) return;
        if (isChromeRepaintDisabledForHost()) return;
        if (isAdThemingSkipped(el)) return;
        if (H.isLikelyFloatingIconControl(el, getComputedStyle, { vh, vw })) {
            el.style.setProperty('background-color', 'var(--aura-overlay)', 'important');
            el.style.setProperty('background-image', 'none', 'important');
            floatingIconControlModified.add(el);
            return;
        }
        if (floatingIconControlModified.has(el)) revertFloatingIconControlPaint(el);
    }

    function reopaqueStickyFixed(root) {
        if (!root || !currentTheme || !H) return;
        if (isChromeRepaintDisabledForHost()) return;
        const { vh, vw } = passViewport();
        // Re-check prior paints first — they may have grown into covering sheets
        // without being re-visited by the sliced walk this frame.
        Array.from(stickyModified).forEach(el => {
            if (!el || !el.isConnected) {
                stickyModified.delete(el);
                return;
            }
            safeVisit(e => visitStickyElement(e, vh, vw), el);
        });
        const elements = collectElements(root);
        const limit = Math.min(elements.length, WALK_SLICE);
        for (let i = 0; i < limit; i++) {
            safeVisit(e => visitStickyElement(e, vh, vw), elements[i]);
        }
    }

    // Google-only: clear dark Ask-anything pill shells that CSS :has misses.
    // Walk ancestors of the Ask field and empty previous siblings with an
    // opaque fill (decorative chip layers). Never paint --aura-bg / surface.
    function clearAskAnythingFill(el) {
        if (!el || el.nodeType !== 1) return;
        el.style.setProperty('background-color', 'transparent', 'important');
        el.style.setProperty('background-image', 'none', 'important');
        askAnythingModified.add(el);
    }

    function isAskAnythingField(el) {
        if (!el || el.nodeType !== 1) return false;
        if (el.classList && el.classList.contains('gLFyf')) return false;
        const aria = String(el.getAttribute('aria-label') || '');
        if (/search/i.test(aria)) return false;
        const ph = String(el.getAttribute('placeholder') || '');
        if (/ask\s+anything/i.test(ph) || /ask\s+anything/i.test(aria)) return true;
        if (/^ask$/i.test(ph.trim()) || /^ask$/i.test(aria.trim())) return true;
        if (/\bask\b/i.test(ph) || /\bask\b/i.test(aria)) {
            // Broad "Ask" match, but skip plain Search fields already gated.
            return !/search/i.test(ph);
        }
        return false;
    }

    function clearAskAnythingDecorativeSibling(sib) {
        if (!sib || sib.nodeType !== 1) return;
        let text = '';
        try { text = String(sib.textContent || '').replace(/\s+/g, ' ').trim(); } catch (e) {}
        if (text.length > 0) return;
        if (sib.children && sib.children.length > 0) return;
        let style;
        try { style = getComputedStyle(sib); } catch (e2) { return; }
        if (!style || style.visibility === 'hidden' || style.opacity === '0') return;
        const parsed = H && H.parseCssRgb ? H.parseCssRgb(style.backgroundColor) : null;
        const hasOpaque = !!(parsed && parsed.a >= 0.5);
        const hasGradient = !!(H && H.isGradientBackgroundImage
            && H.isGradientBackgroundImage(style.backgroundImage));
        if (!hasOpaque && !hasGradient) return;
        clearAskAnythingFill(sib);
    }

    // Icon-only controls docked in/near the Ask-anything composer (mic,
    // send, "+"/tools) — cleared unconditionally here rather than relying
    // solely on the general-engine BUTTON carve-out (visitBrightElement):
    // that pass only clears a background that reads as authored near-white,
    // and only paints a scrim (isLikelyFloatingIconControl) when
    // position:fixed/absolute — on this specific, evolving Google surface a
    // more permissive, site-scoped "any icon-only control near this field
    // gets a transparent background + themed icon color" is both safer (the
    // container is already reliably located via the Ask-anything field) and
    // more robust to markup Aura hasn't seen a live sample of.
    function clearAskAnythingIconButton(btn) {
        if (!btn || btn.nodeType !== 1) return;
        let text = '';
        try { text = String(btn.textContent || '').trim(); } catch (e) {}
        if (text.length > 1) return; // has a visible label — leave it alone
        btn.style.setProperty('background-color', 'transparent', 'important');
        btn.style.setProperty('background-image', 'none', 'important');
        btn.style.setProperty('color', 'var(--aura-text)', 'important');
        askAnythingModified.add(btn);
        // `color` alone only fixes the glyph if the icon's SVG inherits via
        // `fill: currentColor` — Google's Material-style icons often bake an
        // explicit fill color onto the path/shape itself instead, which
        // `color` never reaches (confirmed as the likely cause of the send
        // button staying invisible after the background/color fix alone).
        // Force every descendant shape directly so it's correct either way.
        let shapes;
        try { shapes = btn.querySelectorAll('svg, path, circle, rect, line, polygon, polyline, use'); } catch (e) { shapes = null; }
        if (shapes) {
            for (let i = 0; i < shapes.length; i++) {
                shapes[i].style.setProperty('fill', 'var(--aura-text)', 'important');
                askAnythingModified.add(shapes[i]);
            }
        }
    }

    function clearAskAnythingIconButtons(container) {
        if (!container || container.nodeType !== 1) return;
        let buttons;
        try { buttons = container.querySelectorAll('button, [role="button"]'); } catch (e) { return; }
        buttons.forEach(clearAskAnythingIconButton);
    }

    function rethemeAskAnythingComposer(root) {
        if (!root || !currentTheme || !isGoogleHost()) return;
        const scope = root.nodeType === 1 ? root : document.documentElement;
        let fields;
        try {
            fields = scope.querySelectorAll(
                'textarea, input, [contenteditable="true"], [role="textbox"]'
            );
        } catch (e) {
            return;
        }
        fields.forEach(field => {
            if (!isAskAnythingField(field)) return;
            clearAskAnythingFill(field);
            let node = field;
            for (let depth = 0; depth < 8; depth++) {
                const parent = node.parentElement;
                if (!parent || parent === document.body || parent === document.documentElement) {
                    break;
                }
                let rect;
                try { rect = parent.getBoundingClientRect(); } catch (e2) { break; }
                if (rect.height > 180) break;
                if (rect.height >= 36 && rect.width >= 160) {
                    clearAskAnythingFill(parent);
                    clearAskAnythingIconButtons(parent);
                }
                // Decorative empty previous siblings behind the field / pill.
                let sib = node.previousElementSibling;
                while (sib) {
                    clearAskAnythingDecorativeSibling(sib);
                    sib = sib.previousElementSibling;
                }
                node = parent;
            }
        });
    }

    function revertAskAnythingComposer() {
        askAnythingModified.forEach(el => {
            try {
                el.style.removeProperty('background-color');
                el.style.removeProperty('background-image');
                el.style.removeProperty('color');
                el.style.removeProperty('fill');
            } catch (e) {}
        });
        askAnythingModified.clear();
    }

    // GOOGLE AI-CHAT ANSWER SURFACE (site override — general per-span/
    // per-button heuristics missed real cases on this specific, fast-
    // evolving surface; Google's own class names are obfuscated and rotate,
    // so instead of guessing at them this anchors on a fixed, visible,
    // user-facing string Google shows under every AI-generated answer:
    // "AI responses may include mistakes." Once that landmark locates the
    // answer card, everything inside it is scoped tightly enough that a
    // much more permissive "clear every block background, clear every
    // icon-only button" pass is safe — the false-positive risk is contained
    // to this one identified card, not the rest of google.com.
    const googleAiChatModified = new Set();
    const AI_DISCLAIMER_TEXT_RE = /AI responses may include mistakes/i;
    const AI_ANSWER_ROOT_MIN_WIDTH = 200;
    const AI_ANSWER_ROOT_MIN_HEIGHT = 150;
    // The disclaimer search below scans every leaf div/p/span/small under
    // `scope` and reads each one's textContent — cheap on a small scoped
    // subtree, but this pass runs on every reactive repaint, including one
    // per keystroke while typing in a contenteditable composer (a plain
    // <textarea>'s value changes don't mutate the DOM at all, but a rich
    // composer's often does). Re-running the full scan every keystroke was
    // a real, self-inflicted lag source. New AI answer cards don't appear
    // anywhere near that often, so the search itself is throttled — the
    // (cheap, container-scoped) re-clearing of already-found cards still
    // runs every pass to catch newly streamed-in content inside them.
    let googleAiAnswerRootsCache = [];
    let googleAiAnswerRootsCacheAt = 0;
    const GOOGLE_AI_ANSWER_ROOT_RESCAN_MS = 1500;

    function findGoogleAiAnswerRoot(el) {
        let node = el;
        let best = null;
        for (let depth = 0; node && depth < 10; depth++) {
            let rect;
            try { rect = node.getBoundingClientRect(); } catch (e) { break; }
            if (rect.width >= AI_ANSWER_ROOT_MIN_WIDTH && rect.height >= AI_ANSWER_ROOT_MIN_HEIGHT) {
                best = node;
            }
            node = node.parentElement;
        }
        return best;
    }

    function findGoogleAiAnswerRoots(scope) {
        let leaves;
        try {
            // Leaf-like text nodes only (no element children) — the
            // disclaimer renders as a short standalone text run, and
            // checking only leaves keeps this O(matching elements), not
            // O(n^2) the way testing every element's full-subtree
            // textContent would be on a large page.
            leaves = scope.querySelectorAll('div, p, span, small');
        } catch (e) {
            return [];
        }
        const roots = new Set();
        for (let i = 0; i < leaves.length && roots.size < 5; i++) {
            const el = leaves[i];
            if (el.children && el.children.length > 0) continue;
            let text = '';
            try { text = el.textContent || ''; } catch (e2) { continue; }
            if (text.length > 200 || !AI_DISCLAIMER_TEXT_RE.test(text)) continue;
            const container = findGoogleAiAnswerRoot(el);
            if (container) roots.add(container);
        }
        return Array.from(roots);
    }

    function rethemeGoogleAiChatSurface(root) {
        if (!root || !currentTheme || !isGoogleHost()) return;
        // Re-check prior clears first — same pattern as every other
        // modified-Set pass — so a card outside this frame's scoped walk
        // (see Problem 1's mutation scoping) still gets revisited.
        Array.from(googleAiChatModified).forEach(el => {
            if (!el || !el.isConnected) {
                googleAiChatModified.delete(el);
            }
        });
        googleAiAnswerRootsCache = googleAiAnswerRootsCache.filter(el => el && el.isConnected);
        const now = Date.now();
        if (googleAiAnswerRootsCache.length === 0
            || now - googleAiAnswerRootsCacheAt > GOOGLE_AI_ANSWER_ROOT_RESCAN_MS) {
            // Search from the document root, not just `scope` — a scoped,
            // typing-triggered pass's root is very likely inside the
            // composer, nowhere near the answer card the disclaimer lives
            // in, and this call is already throttled above so the extra
            // reach doesn't reintroduce the per-keystroke cost.
            googleAiAnswerRootsCache = findGoogleAiAnswerRoots(document.documentElement);
            googleAiAnswerRootsCacheAt = now;
        }
        googleAiAnswerRootsCache.forEach(container => {
            let blocks;
            try { blocks = container.querySelectorAll('div, p, li, span'); } catch (e) { return; }
            for (let i = 0; i < blocks.length; i++) {
                const b = blocks[i];
                if (b.closest && b.closest('button, [role="button"]')) continue;
                b.style.setProperty('background-color', 'transparent', 'important');
                b.style.setProperty('background-image', 'none', 'important');
                googleAiChatModified.add(b);
            }
            clearAskAnythingIconButtons(container);
        });
    }

    function revertGoogleAiChatSurface() {
        googleAiChatModified.forEach(el => {
            try {
                el.style.removeProperty('background-color');
                el.style.removeProperty('background-image');
                el.style.removeProperty('color');
            } catch (e) {}
        });
        googleAiChatModified.clear();
        googleAiAnswerRootsCache = [];
        googleAiAnswerRootsCacheAt = 0;
    }

    // 3d-bis. TOP CHROME — headers/search bars that are not sticky/fixed yet
    // (Google Shopping <header>, many SERP toolbars). Site color-scheme:dark
    // fills beat the universal `header { transparent }` rule. Paint the
    // outermost bar and clear inner layout fills so scroll doesn't leave a
    // gray slab stacked on a themed one.
    function revertChromeOuterPaint(el) {
        try {
            el.style.removeProperty('background-color');
            el.style.removeProperty('background-image');
            el.style.removeProperty('color');
        } catch (e) {}
        chromeOuterModified.delete(el);
        chromeModified.delete(el);
    }

    function reopaqueTopChrome(root) {
        if (!root || !currentTheme || !H || !H.isTopChromeBar) return;
        if (isChromeRepaintDisabledForHost()) return;

        const { vh, vw } = passViewport();
        const scope = root.nodeType === 1 ? root : document.documentElement;
        const painted = new Set();

        // Undo outer bars that are no longer safe top chrome (grew into a
        // covering sheet, scrolled away from the top band, etc.).
        Array.from(chromeOuterModified).forEach(el => {
            if (!el || !el.isConnected) {
                chromeOuterModified.delete(el);
                return;
            }
            let rect;
            try { rect = el.getBoundingClientRect(); } catch (e) {
                revertChromeOuterPaint(el);
                return;
            }
            if (isOverlayCoveringSheet(rect, vh, vw)
                || isChromePaintHostSkipped(el)
                || !H.isTopChromeBar(el, getComputedStyle, { vh, vw })) {
                revertChromeOuterPaint(el);
            }
        });

        // Same undo for fixed/sticky inner bars (see chromeFixedInnerModified
        // above) — isTopChromeBar doesn't recognize a plain fixed div, so
        // check the thing that actually made it special: is it still
        // fixed/sticky, and hasn't grown into a curtain.
        Array.from(chromeFixedInnerModified).forEach(el => {
            if (!el || !el.isConnected) {
                chromeFixedInnerModified.delete(el);
                return;
            }
            let stillFixed = false;
            try {
                const pos = getComputedStyle(el).position;
                stillFixed = pos === 'fixed' || pos === 'sticky';
            } catch (e) {}
            let rect;
            try { rect = el.getBoundingClientRect(); } catch (e2) {
                revertChromeOuterPaint(el);
                chromeFixedInnerModified.delete(el);
                return;
            }
            if (!stillFixed || isOverlayCoveringSheet(rect, vh, vw) || isChromePaintHostSkipped(el)) {
                revertChromeOuterPaint(el);
                chromeFixedInnerModified.delete(el);
            }
        });

        function outermost(el) {
            let best = null;
            let node = el;
            while (
                node &&
                node.nodeType === 1 &&
                node !== document.body &&
                node !== document.documentElement
            ) {
                if (H.isTopChromeBar(node, getComputedStyle, { vh, vw })) {
                    best = node;
                }
                node = node.parentElement;
            }
            return best;
        }

        function paintChrome(el) {
            if (!el || painted.has(el)) return;
            if (isAdThemingSkipped(el) || isChromePaintHostSkipped(el)) return;
            let rect;
            try { rect = el.getBoundingClientRect(); } catch (e) { return; }
            // Never paint a covering sheet as top chrome — same curtain class.
            if (isOverlayCoveringSheet(rect, vh, vw)) return;
            painted.add(el);
            el.style.setProperty('background-color', 'var(--aura-bg)', 'important');
            el.style.setProperty('background-image', 'none', 'important');
            el.style.setProperty('color', 'var(--aura-text)', 'important');
            chromeModified.add(el);
            chromeOuterModified.add(el);

            let inners;
            try {
                inners = el.querySelectorAll(
                    'div, nav, header, form, section, ul, ol, li, fieldset'
                );
            } catch (e) {
                return;
            }
            // Precompute once per outer bar (not per descendant — an
            // O(inner x selectors) el.matches() scan could hit 250 x 300
            // calls per bar per pass) which descendants the SITE ITSELF
            // marked !important opaque. A non-fixed/sticky descendant that
            // matches (and passes the same accept-gate
            // restoreAuthoredChromeOpacity uses) must not be blindly forced
            // transparent below — confirmed on Google Maps' search pill:
            // its icon buttons and input track are position:absolute, not
            // fixed/sticky, so they fell through to the unconditional
            // `transparent` line every pass, including the scroll fast-path
            // (window 'scroll' listener below calls reopaqueTopChrome alone,
            // not restoreAuthoredChromeOpacity) — this branch is load-
            // bearing on its own, not just a redundant hedge against that
            // other pass.
            let authoredOpaqueDescendants = null;
            const authoredSelectorsForChrome = H ? getAuthoredOpaqueBgSelectors() : [];
            if (authoredSelectorsForChrome.length) {
                authoredOpaqueDescendants = new Set(
                    findAuthoredOpaqueElements(el, authoredSelectorsForChrome)
                );
            }
            let n = 0;
            for (const inner of inners) {
                if (!inner || inner.nodeType !== 1) continue;
                if (++n > 250) break;
                if (H.BRIGHT_SKIP_TAGS && H.BRIGHT_SKIP_TAGS[inner.tagName]) continue;
                if (inner.getAttribute('role') === 'button') continue;
                if (isUniversalTransparencyHostExcluded(inner)) continue;
                // A fixed/sticky descendant renders in its own layer,
                // detached from this element's box (e.g. a <header> that
                // stays in normal flow while an inner .header-bar div is
                // the actual position:fixed sticky surface). Clearing its
                // background would make the surface that's really on screen
                // transparent while the opaque paint above lands on a
                // possibly zero-height, off-screen ancestor — paint it
                // opaque too instead.
                let innerPos = '';
                try { innerPos = getComputedStyle(inner).position; } catch (ePos) {}
                if (innerPos === 'fixed' || innerPos === 'sticky') {
                    if (!painted.has(inner)) {
                        inner.style.setProperty('background-color', 'var(--aura-bg)', 'important');
                        inner.style.setProperty('background-image', 'none', 'important');
                        chromeModified.add(inner);
                        chromeFixedInnerModified.add(inner);
                        painted.add(inner);
                    }
                    continue;
                }
                if (authoredOpaqueDescendants && authoredOpaqueDescendants.has(inner)
                    && !isAdThemingSkipped(inner) && !isChromePaintHostSkipped(inner)
                    && (H.isLikelyNavMenu(inner, getComputedStyle, { vh, vw })
                        || (H.isLikelyAuthoredSurface && H.isLikelyAuthoredSurface(inner, getComputedStyle, { vh, vw })))) {
                    if (!painted.has(inner)) {
                        // --aura-overlay, not --aura-bg: matches what
                        // restoreAuthoredChromeOpacity and the floating-icon-
                        // control pass already paint this class of surface,
                        // so a pill's icon children and its own wrapper
                        // don't show a visible color seam between them.
                        inner.style.setProperty('background-color', 'var(--aura-overlay)', 'important');
                        inner.style.setProperty('background-image', 'none', 'important');
                        chromeModified.add(inner);
                        painted.add(inner);
                    }
                    continue;
                }
                inner.style.setProperty('background-color', 'transparent', 'important');
                chromeModified.add(inner);
                let img = '';
                try { img = getComputedStyle(inner).backgroundImage; } catch (e2) { img = ''; }
                if (H.isGradientBackgroundImage && H.isGradientBackgroundImage(img)) {
                    inner.style.setProperty('background-image', 'none', 'important');
                }
            }
        }

        // Fallback for a semantic wrapper that itself never qualifies as top
        // chrome: a <header>/[role=banner] whose only real content is a
        // position:fixed inner bar (e.g. UC Davis's .header__bar) never
        // gains height from that child in normal flow, so the wrapper can
        // collapse under isTopChromeBar's minimum-height requirement even
        // though the fixed inner bar is clearly a real, visible header.
        // Look inside the semantic wrapper for that fixed descendant
        // directly rather than requiring the wrapper to qualify first.
        function findFixedChromeDescendant(el) {
            let candidates;
            try {
                candidates = el.querySelectorAll('div, nav, header, section');
            } catch (e) {
                return null;
            }
            for (let i = 0; i < candidates.length; i++) {
                const c = candidates[i];
                let style;
                try { style = getComputedStyle(c); } catch (e2) { continue; }
                if (style.position !== 'fixed' && style.position !== 'sticky') continue;
                if (style.visibility === 'hidden' || style.opacity === '0') continue;
                let rect;
                try { rect = c.getBoundingClientRect(); } catch (e3) { continue; }
                if (rect.width < vw * 0.6) continue;
                if (rect.height < 20) continue;
                if (rect.top < -20 || rect.top > 80) continue;
                if (isOverlayCoveringSheet(rect, vh, vw)) continue;
                return c;
            }
            return null;
        }

        let seeds;
        try {
            // Search/combobox fields are seeded directly too, not just their
            // semantic wrappers — isTopChromeBarInfo already accepts a
            // near-top bar purely on `hasSearchField` with no tag/role
            // requirement (Google Shopping's <header> comment above), but
            // that only helps if `outermost()` ever gets called starting
            // from somewhere inside the bar. A search bar built as a plain,
            // role-less <div> (no <form>/[role=search]/<header> wrapper —
            // the likely shape of Google Maps' "Find a place" bar, going
            // transparent with no live-DOM confirmation possible: Google's
            // bot detection blocked every attempt to load the real page
            // this session) is otherwise invisible to this pass no matter
            // how correct isTopChromeBar's own logic is.
            seeds = scope.querySelectorAll(
                'header, nav, [role="banner"], [role="search"], form, #searchform, ' +
                '[role="combobox"], [role="searchbox"], ' +
                'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):' +
                'not([type="submit"]):not([type="button"]):not([type="password"]), textarea'
            );
        } catch (e) {
            return;
        }
        seeds.forEach(el => {
            const rootEl = outermost(el);
            if (rootEl) {
                paintChrome(rootEl);
                return;
            }
            const fixedInner = findFixedChromeDescendant(el);
            if (fixedInner && !painted.has(fixedInner)) {
                paintChrome(fixedInner);
                // isTopChromeBar can't recognize a plain fixed div — this
                // needs chromeFixedInnerModified's revert check (still
                // fixed, not grown into a curtain), not chromeOuterModified's
                // (which would revert it on the very next pass since a
                // bare div never passes isTopChromeBar).
                chromeOuterModified.delete(fixedInner);
                chromeFixedInnerModified.add(fixedInner);
            }
        });
    }

    // 3d-ter. AUTHORED-INTENT CHROME RESTORATION — general, position-agnostic.
    // The universal transparency rule (getFullStyleSheet's layoutTags) is
    // !important with a long :not() chain, which gives it more accumulated
    // specificity than most sites' own selectors. When a site ALSO marks a
    // nav/menu/header opaque with !important (extremely common —
    // WordPress/Divi-style themes routinely do this for header, dropdown
    // submenus, mobile menu, and search overlay via one shared selector),
    // our rule wins the specificity tie and silently defeats their
    // deliberate opaque styling — regardless of whether the element is
    // position:fixed, absolute, or static, which is why the fixed-position
    // heuristics above (isLikelyModalCard, isLikelyNavDrawer, isTopChromeBar)
    // don't catch this class of site. Instead of guessing at more structural
    // patterns, ask the site's own CSS what it intended, and restore opacity
    // for anything that both (a) the site explicitly marked !important
    // opaque and (b) looks like real navigation/chrome (isLikelyNavMenu),
    // not just any !important-styled promo/card that should stay themed.
    function collectImportantBgSelectors(rules, out, budget) {
        for (let i = 0; i < rules.length && budget.scanned < AUTHORED_OPAQUE_MAX_RULES_SCANNED
            && out.length < AUTHORED_OPAQUE_MAX_SELECTORS; i++) {
            const rule = rules[i];
            budget.scanned++;
            if (!rule) continue;
            // Recurse into genuinely nested rule groups — @media/@supports/
            // @layer, OR native CSS Nesting's inline nested selectors within
            // an ordinary style rule. Browsers with CSS Nesting support
            // (Chromium 120+, Safari 17.2+ — i.e. most real devices today)
            // expose a `cssRules` CSSRuleList on EVERY CSSStyleRule now, not
            // just grouping at-rules, so mere truthiness can no longer tell
            // "this is a container" apart from "this is a plain rule with
            // an incidental empty list" — check length instead. And do NOT
            // `continue` after recursing: a nesting-parent rule (`.card { .. }
            // & .icon { .. } }`) can carry its own !important background
            // declaration too, so its own selector must still be checked
            // below regardless of whether it also has nested children.
            if (rule.cssRules && rule.cssRules.length > 0) {
                try { collectImportantBgSelectors(rule.cssRules, out, budget); } catch (e) {}
            }
            if (!rule.style || !rule.selectorText) continue;
            let bg = '';
            let important = false;
            try {
                bg = rule.style.getPropertyValue('background-color')
                    || rule.style.getPropertyValue('background');
                important = rule.style.getPropertyPriority('background-color') === 'important'
                    || rule.style.getPropertyPriority('background') === 'important';
            } catch (e2) { continue; }
            if (!important || !bg) continue;
            const v = bg.trim().toLowerCase();
            if (v === 'transparent' || v === 'none' || v === 'initial' || v === 'inherit') continue;
            if (/rgba?\([^)]*,\s*0(\.0+)?\s*\)/.test(v)) continue;
            out.push(rule.selectorText);
        }
    }

    function getAuthoredOpaqueBgSelectors() {
        const now = Date.now();
        // Deferred/preload stylesheets (a common WordPress/perf-plugin
        // pattern — <link rel="preload" as="style" onload="this.rel=
        // 'stylesheet'">) don't register in document.styleSheets until
        // they finish loading, which can be after our first scan. A pure
        // time-based TTL can then serve a stale, incomplete selector list
        // for its full window. Force a rescan whenever the sheet count
        // changes, regardless of TTL.
        const sheetCount = document.styleSheets ? document.styleSheets.length : 0;
        if (authoredOpaqueSelectorsCache
            && sheetCount === authoredOpaqueSelectorsSheetCount
            && (now - authoredOpaqueSelectorsAt) < AUTHORED_OPAQUE_CACHE_TTL) {
            return authoredOpaqueSelectorsCache;
        }
        const selectors = [];
        const budget = { scanned: 0 };
        try {
            const sheets = Array.from(document.styleSheets);
            for (let i = 0; i < sheets.length
                && budget.scanned < AUTHORED_OPAQUE_MAX_RULES_SCANNED
                && selectors.length < AUTHORED_OPAQUE_MAX_SELECTORS; i++) {
                let rules;
                try { rules = sheets[i].cssRules || sheets[i].rules; } catch (e) { continue; }
                if (!rules) continue;
                collectImportantBgSelectors(rules, selectors, budget);
            }
        } catch (e) {}
        authoredOpaqueSelectorsCache = selectors;
        authoredOpaqueSelectorsAt = now;
        authoredOpaqueSelectorsSheetCount = sheetCount;
        return selectors;
    }

    // Shared by restoreAuthoredChromeOpacity and paintChrome's inner loop:
    // find every element under `scope` matching any of the (capped,
    // TTL-cached) authored !important-opaque selectors. One combined
    // comma-list query is a single native tree walk — cheaper than either
    // scanning `scope` with a broad candidate pre-filter first, or running
    // one querySelectorAll per selector. Falls back to per-selector queries
    // (deduped via the Set) only if the combined string itself is malformed
    // — one bad fragment in a 300-selector comma-list would otherwise fail
    // the whole query, unlike el.matches() which fails per-selector.
    function findAuthoredOpaqueElements(scope, selectors) {
        try {
            return scope.querySelectorAll(selectors.join(','));
        } catch (e) {
            const seen = new Set();
            for (let i = 0; i < selectors.length; i++) {
                try {
                    scope.querySelectorAll(selectors[i]).forEach(el => seen.add(el));
                } catch (e2) {}
            }
            return Array.from(seen);
        }
    }

    // Position-agnostic counterpart to the isLikelyNavDrawer transition gate
    // in visitOverlayModalWalk, for menus that expand IN PLACE (display:none
    // -> block, height:0 -> auto) rather than as a position:fixed/sticky
    // overlay — e.g. a Bootstrap-style ".navbar-collapse" mobile menu.
    // isLikelyNavDrawer can never reach this shape (it requires position
    // fixed/sticky), and restoreAuthoredChromeOpacity only helps when the
    // site marks its own background !important, which not every site does.
    // Same collapsed -> expanded transition gate as the drawer path, via the
    // same isNavDrawerOpenTransition function (its logic is generic to any
    // two state strings, not specific to drawers).
    function revertNavMenuPanelPaint(el) {
        try {
            el.style.removeProperty('background-color');
            el.style.removeProperty('background-image');
        } catch (e) {}
        navMenuPanelOpaqueModified.delete(el);
    }

    function visitNavMenuPanelElement(el, vh, vw) {
        if (!el || el.nodeType !== 1 || !H || !H.classifyNavMenuPanelState) return;
        if (isChromeRepaintDisabledForHost()) return;
        const navState = H.classifyNavMenuPanelState(el, getComputedStyle, { vh, vw });
        if (navState === 'expanded') {
            const prevNavState = navMenuPanelStateHistory.get(el);
            const isOpenTransition = !!(H.isNavDrawerOpenTransition
                && H.isNavDrawerOpenTransition(prevNavState, navState));
            // Same history-poisoning fix as visitExpandedContentPanelElement
            // above: only record 'expanded' once actually treated as an
            // open. A panel that ever mounts pre-expanded (no earlier
            // 'collapsed' sighting — e.g. opened via a URL hash on load)
            // would otherwise get prevNavState stuck at 'expanded' forever,
            // and isNavDrawerOpenTransition (which requires prevState ===
            // 'collapsed') could never fire again for it.
            if (isOpenTransition || navMenuPanelOpaqueModified.has(el)) {
                navMenuPanelStateHistory.set(el, 'expanded');
                let style;
                try { style = getComputedStyle(el); } catch (e) { return; }
                if (style.visibility === 'hidden' || style.opacity === '0') return;
                if (style.display === 'none') return;
                let rect;
                try { rect = el.getBoundingClientRect(); } catch (e2) { return; }
                if (rect.width < 1 || rect.height < 1) return;
                el.style.setProperty('background-color', 'var(--aura-overlay)', 'important');
                el.style.setProperty('background-image', 'none', 'important');
                navMenuPanelOpaqueModified.add(el);
            }
            return;
        }
        if (navState === 'collapsed') {
            navMenuPanelStateHistory.set(el, 'collapsed');
            if (navMenuPanelOpaqueModified.has(el)) revertNavMenuPanelPaint(el);
        }
        // 'ambiguous' or null: leave history and any existing paint alone.
    }

    function reopaqueExpandedNavMenuPanels(root, precollected) {
        if (!root || !currentTheme || !H) return;
        const { vh, vw } = passViewport();
        // Re-check prior paints first — they may have closed without being
        // re-visited by the sliced walk this frame.
        Array.from(navMenuPanelOpaqueModified).forEach(el => {
            if (!el || !el.isConnected) {
                navMenuPanelOpaqueModified.delete(el);
                return;
            }
            safeVisit(e => visitNavMenuPanelElement(e, vh, vw), el);
        });
        const elements = precollected || collectElements(root);
        const limit = Math.min(elements.length, WALK_SLICE);
        for (let i = 0; i < limit; i++) {
            safeVisit(e => visitNavMenuPanelElement(e, vh, vw), elements[i]);
        }
    }

    // Position-agnostic counterpart to isLikelyModalCard, for cards that
    // expand IN PLACE (display:none -> block, height:0 -> auto) with no
    // position:fixed of their own and no nav semantics — see
    // expandedContentPanelStateHistory above for the booking.com date-picker
    // shape this exists to catch. Same collapsed -> expanded transition gate
    // as the nav drawer / nav menu panel paths, via the same
    // isNavDrawerOpenTransition function (its logic is generic to any two
    // state strings) — required so an ordinary always-present content block
    // (a sidebar card, a footer panel) never gets swept up merely for
    // "currently looking card-shaped."
    function revertExpandedContentPanelPaint(el) {
        try {
            el.style.removeProperty('background-color');
            el.style.removeProperty('background-image');
        } catch (e) {}
        expandedContentPanelOpaqueModified.delete(el);
    }

    // How long after a fresh theme apply the page/engine is assumed to have
    // "settled" — see isFreshlyMountedContentPanel below.
    const CONTENT_PANEL_SETTLE_MS = 1500;

    // booking.com's date-picker doesn't exist in the DOM at all until its
    // trigger is focused (confirmed live: querySelector finds nothing for
    // it before the click, then the whole subtree appears already
    // 'expanded') — so isNavDrawerOpenTransition's collapsed -> expanded
    // gate can never fire for it; there is no earlier 'collapsed' sighting
    // to transition FROM. A first-ever sighting is only trusted as "just
    // opened" when BOTH: (1) it happens well after the theme's initial
    // apply, so it can't be ordinary content the very first full walk simply
    // hadn't reached yet, and (2) the element isn't one of several siblings
    // sharing its class name — a repeated class is the standard shape of an
    // infinite-scroll/list-append batch (e.g. more property-card tiles
    // loading in), which is exactly the kind of "new but not a popup"
    // insertion this must not paint as a near-black overlay.
    function isFreshlyMountedContentPanel(el, prevState) {
        if (prevState !== undefined) return false;
        if (!engineAppliedAt || (Date.now() - engineAppliedAt) < CONTENT_PANEL_SETTLE_MS) return false;
        const cls = typeof el.className === 'string' ? el.className : '';
        if (!cls || !el.parentElement) return true;
        let siblingsWithSameClass = 0;
        const siblings = el.parentElement.children;
        for (let i = 0; i < siblings.length; i++) {
            if (siblings[i] !== el && siblings[i].className === cls) {
                siblingsWithSameClass++;
                if (siblingsWithSameClass >= 1) return false;
            }
        }
        return true;
    }

    function visitExpandedContentPanelElement(el, vh, vw) {
        if (!el || el.nodeType !== 1 || !H || !H.classifyExpandedContentPanelState) return;
        if (isChromeRepaintDisabledForHost()) return;
        const panelState = H.classifyExpandedContentPanelState(el, getComputedStyle, { vh, vw });
        if (panelState === 'expanded') {
            const prevState = expandedContentPanelStateHistory.get(el);
            const isOpenTransition = !!(H.isNavDrawerOpenTransition
                && H.isNavDrawerOpenTransition(prevState, panelState))
                || isFreshlyMountedContentPanel(el, prevState);
            // Only record 'expanded' once we've actually decided to treat
            // this sighting as an open — never on a declined pass. Writing
            // it unconditionally here would permanently poison prevState
            // for any element whose first-ever 'expanded' sighting fails
            // isFreshlyMountedContentPanel's settle-time/sibling gate (e.g.
            // a panel that mounts within the settle window, or shares a
            // wrapper class with a sibling at mount time): every later pass
            // would see prevState === 'expanded' instead of `undefined`, so
            // isFreshlyMountedContentPanel could never re-qualify it and
            // isNavDrawerOpenTransition could never fire either (it needs
            // prevState === 'collapsed', which this element never has) —
            // the element would stay transparent forever. Leaving prevState
            // as `undefined` on a declined pass lets the next pass retry
            // isFreshlyMountedContentPanel fresh instead of locking out.
            if (isOpenTransition || expandedContentPanelOpaqueModified.has(el)) {
                expandedContentPanelStateHistory.set(el, 'expanded');
                let style;
                try { style = getComputedStyle(el); } catch (e) { return; }
                if (style.visibility === 'hidden' || style.opacity === '0') return;
                if (style.display === 'none') return;
                let rect;
                try { rect = el.getBoundingClientRect(); } catch (e2) { return; }
                if (rect.width < 1 || rect.height < 1) return;
                // A video player's own auto-hide controls overlay (play/pause,
                // volume, settings, fullscreen) legitimately cycles collapsed
                // <-> expanded just like a real popup — but it's a SIBLING of
                // the <video> in every player markup checked, stacked in
                // front of it, not an ARIA dialog. Painting it opaque hides
                // the video frame behind it while the overlay's own icon
                // children still render on top of their own parent's paint,
                // looking exactly like "the video got painted over" while
                // controls stay visible (confirmed on twitch.tv). Checking
                // the immediate container's subtree catches both that shape
                // and a wrap-the-video-as-descendant shape in one check.
                let hasVideoSibling = false;
                try { hasVideoSibling = !!(el.parentElement && el.parentElement.querySelector('video')); } catch (e3) {}
                if (hasVideoSibling) {
                    if (expandedContentPanelOpaqueModified.has(el)) revertExpandedContentPanelPaint(el);
                    return;
                }
                el.style.setProperty('background-color', 'var(--aura-overlay)', 'important');
                el.style.setProperty('background-image', 'none', 'important');
                expandedContentPanelOpaqueModified.add(el);
            }
            return;
        }
        if (panelState === 'collapsed') {
            expandedContentPanelStateHistory.set(el, 'collapsed');
            if (expandedContentPanelOpaqueModified.has(el)) revertExpandedContentPanelPaint(el);
        }
        // 'ambiguous' or null: leave history and any existing paint alone.
    }

    function reopaqueExpandedContentPanels(root, precollected) {
        if (!root || !currentTheme || !H) return;
        const { vh, vw } = passViewport();
        Array.from(expandedContentPanelOpaqueModified).forEach(el => {
            if (!el || !el.isConnected) {
                expandedContentPanelOpaqueModified.delete(el);
                return;
            }
            safeVisit(e => visitExpandedContentPanelElement(e, vh, vw), el);
        });
        const elements = precollected || collectElements(root);
        const limit = Math.min(elements.length, WALK_SLICE);
        for (let i = 0; i < limit; i++) {
            safeVisit(e => visitExpandedContentPanelElement(e, vh, vw), elements[i]);
        }
    }

    function restoreAuthoredChromeOpacity(root) {
        if (!root || !currentTheme || !H || !H.isLikelyNavMenu) return;
        if (isChromeRepaintDisabledForHost()) return;
        const selectors = getAuthoredOpaqueBgSelectors();
        if (!selectors.length) return;
        const scope = root.nodeType === 1 ? root : document.documentElement;
        // Query every authored !important-opaque selector directly — this is
        // a strict superset of the old nav-ish pre-filter (which also
        // required el.matches(selectors[i]) afterward), and catches compact,
        // non-nav-shaped surfaces (a stat card, a "Sign in" pill, a
        // selected-tab highlight) the old candidate list could never reach
        // no matter what el.matches() found, since they were never queried
        // for in the first place. See isLikelyAuthoredSurface below.
        const candidates = findAuthoredOpaqueElements(scope, selectors);
        const { vh, vw } = passViewport();
        let n = 0;
        for (let ci = 0; ci < candidates.length && n <= 200; ci++) {
            const el = candidates[ci];
            if (chromeAuthoredModified.has(el)) continue;
            if (isAdThemingSkipped(el) || isChromePaintHostSkipped(el)) continue;
            if (H.isAmpOverlayChrome && H.isAmpOverlayChrome(el)) continue;
            let style;
            try { style = getComputedStyle(el); } catch (e2) { continue; }
            const parsed = H.parseCssRgb && H.parseCssRgb(style.backgroundColor);
            const currentlyTransparent = !parsed || parsed.a < 0.5;
            if (!currentlyTransparent) continue;
            const accepted = H.isLikelyNavMenu(el, getComputedStyle, { vh, vw })
                || (H.isLikelyAuthoredSurface && H.isLikelyAuthoredSurface(el, getComputedStyle, { vh, vw }));
            if (!accepted) continue;
            n++;
            el.style.setProperty('background-color', 'var(--aura-overlay)', 'important');
            el.style.setProperty('background-image', 'none', 'important');
            chromeAuthoredModified.add(el);
        }
    }

    // 3d. TEXT CONTRAST SAFETY NET — pick black/white against the visible stack.
    // Skipped for split themes so invert (white + difference) is not flattened.
    // Painted aria-hidden copies (Airbnb host stats, currentColor icons) are
    // rewritten; unused stacked Google Images labels are still skipped.
    function visitContrastElement(el, effectiveBgCache) {
        if (!el || el.nodeType !== 1 || !H || !H.hasPoorContrast || !currentTheme) return;
        if (isActiveSplitTheme(currentTheme)) return;
        const tag = el.tagName;
        // BRIGHT_SKIP_TAGS exists to protect native form-control CHROME
        // (the browser's own checkbox/select/OS-rendered appearance) from
        // the bright-surface-clearing pass — but this pass only ever
        // rewrites `color` on text, never a background, and a <button> is
        // just a text label sitting on an (intentionally untouched —
        // buttons are never in layoutTags and are skip-tagged everywhere
        // else too) authored background. Reusing the same list here blinds
        // this pass to exactly the common case where a button's text has no
        // color of its own, inherits Aura's light global text color via
        // normal CSS inheritance, and ends up light-on-light against the
        // button's own background that never changed (confirmed on Gmail's
        // search bar and several other buttons — general, not site-
        // specific). Still skip the rest of BRIGHT_SKIP_TAGS (INPUT/SELECT/
        // TEXTAREA/OPTION and friends): those carry native, OS-rendered, or
        // user-typed content where forcing a color is more likely to look
        // broken than helpful.
        if (H.BRIGHT_SKIP_TAGS && H.BRIGHT_SKIP_TAGS[tag] && tag !== 'BUTTON') return;
        if (typeof el.className === 'string' && /icon/i.test(el.className)) return;
        if (H.isStackedDuplicateLabel && H.isStackedDuplicateLabel(el)) return;
        let style;
        try { style = getComputedStyle(el); } catch (e) { return; }
        // A decorative shape whose visible fill IS its own `color` via
        // `background-color: currentColor` (a common technique for
        // monochrome icon bars — confirmed on github.com's mobile-menu
        // hamburger/close toggle, three <span>s built exactly this way).
        // Rewriting `color` here for text-contrast purposes also silently
        // rewrites the element's entire visible fill, which can — and,
        // depending on the surrounding context at the moment of each
        // re-run, unpredictably will — make the shape blend into its own
        // background instead of fixing anything. Self-stabilizing: once
        // true this stays true on every future re-visit too, since
        // `currentColor` recomputes automatically whenever `color` changes,
        // so there's no stale-cache risk from skipping here.
        const rawColor = H.parseCssRgb(style.color);
        const rawBg = H.parseCssRgb(style.backgroundColor);
        if (rawColor && rawBg
            && rawColor.r === rawBg.r && rawColor.g === rawBg.g && rawColor.b === rawBg.b
            && Math.abs((rawColor.a == null ? 1 : rawColor.a) - (rawBg.a == null ? 1 : rawBg.a)) < 0.01) {
            return;
        }
        let rect;
        try { rect = el.getBoundingClientRect(); } catch (e2) { return; }
        if (H.isUnpaintedForContrast && H.isUnpaintedForContrast({
            visibility: style.visibility,
            opacity: style.opacity,
            display: style.display,
            width: rect.width,
            height: rect.height,
        })) return;
        const fg = H.parseCssRgb(style.color);
        const bgParsed = H.effectiveBackground
            ? H.effectiveBackground(el, getComputedStyle, currentTheme.background, effectiveBgCache)
            : (H.parseHexColor && H.parseHexColor(currentTheme.background));
        if (!fg || !bgParsed) return;
        if (!H.hasPoorContrast(fg, bgParsed, 3.0)) return;
        const themeText = currentTheme.text || '#ffffff';
        const themeLink = currentTheme.link || '#8ab4f8';
        const isLink = tag === 'A' || (el.closest && el.closest('a'));
        const preferred = isLink ? themeLink : themeText;
        const picked = H.pickReadableAgainstSurface
            ? H.pickReadableAgainstSurface(bgParsed, preferred, 3.0)
            : preferred;
        el.style.setProperty('color', picked, 'important');
        contrastModified.add(el);
    }

    function rethemePoorContrast(root) {
        if (!root || !currentTheme || !H || !H.hasPoorContrast) return;
        if (isActiveSplitTheme(currentTheme)) return;
        const elements = collectElements(root);
        const limit = Math.min(elements.length, WALK_SLICE);
        for (let i = 0; i < limit; i++) {
            visitContrastElement(elements[i]);
        }
    }

    // 3e. SPA SHELL / GRADIENT SAFETY NET
    // Sites like Discord paint #app with a gradient or ID+!important fill after
    // first paint. Inline !important beats those rules; never clear photos.
    function visitShellElement(el, vh, vw) {
        if (!el || el.nodeType !== 1 || !H || !H.shouldClearShellBackground) return;
        if (el === document.documentElement || el === document.body) return;
        if (overlayModified.has(el)) return;
        if (el.id === 'aura-core-engine' || el.id === 'aura-split-bg') return;
        if (el.closest && el.closest('#aura-split-bg')) return;

        let style;
        try { style = getComputedStyle(el); } catch (e) { return; }
        if (style.visibility === 'hidden' || style.opacity === '0') return;

        let rect;
        try { rect = el.getBoundingClientRect(); } catch (e) { return; }

        const parsed = H.parseCssRgb(style.backgroundColor);
        const opaqueFill = !!(parsed && parsed.a >= 0.5);
        const collapseFade = isAiOverviewCollapseFade(el);
        if (collapseFade) return;
        const info = {
            id: el.id,
            tag: el.tagName,
            width: rect.width,
            height: rect.height,
            vh,
            vw,
            overlayRoot: H.isOverlayRoot(el),
            overlayChrome: H.isOverlayChrome(el),
            backgroundImage: style.backgroundImage,
            isControl: !!(H.BRIGHT_SKIP_TAGS && H.BRIGHT_SKIP_TAGS[el.tagName]),
            opaqueFill,
            collapseFade,
        };
        if (!H.shouldClearShellBackground(info)) return;

        el.style.setProperty('background-color', 'transparent', 'important');
        el.style.setProperty('background-image', 'none', 'important');
        shellModified.add(el);
    }

    function rethemeKnownShells(root) {
        if (!root || !currentTheme || !H) return;
        const { vh, vw } = passViewport();
        const scope = root.nodeType === 1 ? root : document.documentElement;
        try {
            const listed = scope.querySelectorAll('#app, #app-mount, #root, #__next, #__nuxt');
            listed.forEach(el => visitShellElement(el, vh, vw));
        } catch (e) {}
    }

    function rethemeOpaqueShells(root, precollected) {
        if (!root || !currentTheme || !H || !H.shouldClearShellBackground) return;
        const { vh, vw } = passViewport();
        rethemeKnownShells(root);
        const elements = precollected || collectElements(root);
        const limit = Math.min(elements.length, WALK_SLICE);
        for (let i = 0; i < limit; i++) {
            visitShellElement(elements[i], vh, vw);
        }
    }

    // 3e. PSEUDO-ELEMENT BACKGROUND LAYERS
    // A growing design pattern (seen e.g. on wtatennis.com's `.widget.has-bg`
    // cards: `.widget.has-bg:before { position:absolute; inset/top/left:0;
    // width:100%; height:100%; background: <opaque>; z-index:-1 }`) paints a
    // card's surface via a ::before/::after pseudo-element instead of a
    // background on the element itself. The universal transparency rule
    // (getFullStyleSheet's layoutTags) can only ever match real elements —
    // there is no way to reach "whatever the ::before of any div happens to
    // be" with one static selector — so this opaque layer survives untouched
    // and sits on top of the correctly-themed content behind it, reading as
    // a leftover white panel (seen on the wtatennis.com stats leaderboard:
    // the frozen player-name column is a real element and themes correctly,
    // while the rest of the row's card background is this pseudo-element
    // and stays white).
    //
    // JS cannot set inline style on a pseudo-element, so the only way to
    // override it is a stylesheet rule. Since we don't know in advance which
    // sites/elements do this, we detect it at runtime (a pseudo-element
    // sized to closely cover its own host element, carrying an opaque fill)
    // and generate a scoped rule for just that element via a unique
    // data-aura-pbg id, appended to a dedicated stylesheet.
    //
    // The 90%-of-host-box + absolute-minimum-size gate is deliberate: it is
    // what keeps this from firing on the countless small ::before/::after
    // uses that are load-bearing UI, not decoration — custom checkbox/radio
    // fills, badges, carets, underlines, tab indicators. Those are always
    // small relative to a real container; a full-bleed card background never
    // is.
    const PSEUDO_BG_MIN_WIDTH = 80;
    const PSEUDO_BG_MIN_HEIGHT = 40;
    const PSEUDO_BG_COVERAGE = 0.9;

    function ensurePseudoBgStyleEl() {
        if (pseudoBgStyleEl && pseudoBgStyleEl.isConnected) return pseudoBgStyleEl;
        pseudoBgStyleEl = document.getElementById('aura-pseudo-overrides');
        if (!pseudoBgStyleEl) {
            pseudoBgStyleEl = document.createElement('style');
            pseudoBgStyleEl.id = 'aura-pseudo-overrides';
        }
        (document.head || document.documentElement).appendChild(pseudoBgStyleEl);
        return pseudoBgStyleEl;
    }

    // A element carrying real nav semantics (its own <nav>/role=navigation,
    // or a handful of links) might currently be closed/collapsed the first
    // time this pass ever sees it — e.g. a mobile menu sampled on initial
    // page load, long before the user ever taps the hamburger. Structural
    // signal only, deliberately state-independent (no size/visibility
    // check): used purely to decide whether this element is EVER allowed
    // into the permanent pseudoBgCleared cache below, since permanently
    // caching "not a nav panel" from a closed-state sample would freeze
    // that verdict forever and never revisit it once genuinely opened.
    function hasNavSemanticsForPseudoBg(el) {
        if (!el) return false;
        if (el.tagName === 'NAV') return true;
        if (el.getAttribute && el.getAttribute('role') === 'navigation') return true;
        try {
            if (el.querySelector && el.querySelector('nav, [role="navigation"]')) return true;
            return el.querySelectorAll('a[href]').length >= 3;
        } catch (e) { return false; }
    }

    function visitPseudoBgElement(el, vh, vw) {
        if (!el || el.nodeType !== 1 || !H) return;
        if (pseudoBgCleared.has(el)) return;
        if (H.BRIGHT_SKIP_TAGS && H.BRIGHT_SKIP_TAGS[el.tagName]) return;
        let rect;
        try { rect = el.getBoundingClientRect(); } catch (e) { return; }
        if (rect.width < PSEUDO_BG_MIN_WIDTH || rect.height < PSEUDO_BG_MIN_HEIGHT) return;

        let matched = null;
        for (let i = 0; i < 2; i++) {
            const pseudo = i === 0 ? '::before' : '::after';
            let pStyle;
            try { pStyle = getComputedStyle(el, pseudo); } catch (e2) { continue; }
            if (!pStyle || pStyle.content === 'none' || pStyle.content === '') continue;
            if (pStyle.display === 'none' || pStyle.visibility === 'hidden' || pStyle.opacity === '0') continue;
            if (pStyle.position !== 'absolute' && pStyle.position !== 'fixed') continue;
            const pw = parseFloat(pStyle.width);
            const ph = parseFloat(pStyle.height);
            if (!(pw >= rect.width * PSEUDO_BG_COVERAGE) || !(ph >= rect.height * PSEUDO_BG_COVERAGE)) continue;
            const parsed = H.parseCssRgb && H.parseCssRgb(pStyle.backgroundColor);
            const hasOpaqueColor = !!(parsed && parsed.a >= 0.4);
            const hasBgImage = pStyle.backgroundImage && pStyle.backgroundImage !== 'none';
            if (!hasOpaqueColor && !hasBgImage) continue;
            matched = pseudo;
            break;
        }
        if (!matched) return;

        let token = el.getAttribute('data-aura-pbg');
        if (!token) {
            token = String(++pseudoBgCounter);
            el.setAttribute('data-aura-pbg', token);
        }

        // A nav-drawer/menu-panel that paints its own background via this
        // pseudo-element (confirmed e.g. on wtatennis.com's
        // `.main-navigation__mobile:before`, a `position:fixed` mobile menu
        // whose real background lives entirely on `::before { inset:0 }`)
        // must stay OPAQUE, not be cleared — clearing it here, correct for
        // a stale opaque card layer sitting on top of already-themed content
        // (the leaderboard-card case this pass was originally built for),
        // instead turns an open mobile menu fully see-through to the page
        // behind it.
        if (hasNavSemanticsForPseudoBg(el)) {
            const viewport = { vh: vh, vw: vw };
            const isNavPanelHost = !!(
                (H.isLikelyNavDrawer && H.isLikelyNavDrawer(el, getComputedStyle, viewport)) ||
                (H.classifyNavMenuPanelState && H.classifyNavMenuPanelState(el, getComputedStyle, viewport) === 'expanded') ||
                (H.isLikelyNavMenu && H.isLikelyNavMenu(el, getComputedStyle, viewport))
            );
            const fill = isNavPanelHost ? 'var(--aura-overlay) !important' : 'transparent !important';
            pseudoBgNavPanelHosts.add(el);
            pseudoBgRulesByToken.set(token,
                `[data-aura-pbg="${token}"]${matched} { background-color: ${fill}; background-image: none !important; }`
            );
            // Deliberately NOT added to pseudoBgCleared: a nav-shaped host
            // must be re-derived on every pass (it can open/close after
            // this visit), never permanently locked to whatever state it
            // happened to be sampled in first.
        } else {
            pseudoBgRulesByToken.set(token,
                `[data-aura-pbg="${token}"]${matched} { background-color: transparent !important; background-image: none !important; }`
            );
            pseudoBgCleared.add(el);
        }
        ensurePseudoBgStyleEl().textContent = Array.from(pseudoBgRulesByToken.values()).join('\n');
    }

    function clearFullBleedPseudoBackgrounds(root, precollected) {
        if (!root || !currentTheme || !H) return;
        const { vh, vw } = passViewport();
        const elements = precollected || collectElements(root);
        const limit = Math.min(elements.length, WALK_SLICE);
        for (let i = 0; i < limit; i++) {
            safeVisit(e => visitPseudoBgElement(e, vh, vw), elements[i]);
        }
    }

    // 3f. LOADER / SPINNER BACKGROUND-IMAGE SAFETY NET
    // Some sites set a static loading-spinner GIF as an element's
    // background-image, permanently, relying on an opaque covering
    // background-color (their own button/card fill) to keep it hidden until
    // an active/loading state swaps something on top of it (seen e.g. on UC
    // Davis OASIS's login button: `#enterButtonSection` carries
    // `background-image: url(loader.circle.medium.gif)` under its own
    // translucent white `background-color`). The universal transparency
    // rule (getFullStyleSheet's layoutTags) clears background-color
    // site-wide but has no concept of background-image, so once the
    // covering color is gone, the loader asset is left permanently visible.
    // Safe to clear unconditionally: a loader/spinner asset visible at rest
    // is never desirable under any theme, regardless of what exposed it.
    function revertLoaderBgElement(el) {
        try { el.style.removeProperty('background-image'); } catch (e) {}
        loaderBgModified.delete(el);
    }

    function visitLoaderBgElement(el) {
        if (!el || el.nodeType !== 1 || !H || !H.isLoaderBackgroundImageUrl) return;
        if (loaderBgModified.has(el)) {
            // Re-check: a site can reuse the same element for real content
            // later (a shimmer/loading container swapped to a real photo).
            // Our own override reads back as 'none' via computed style, so
            // lift it briefly to see the site's current underlying value.
            el.style.removeProperty('background-image');
            let underlying;
            try { underlying = getComputedStyle(el).backgroundImage; } catch (e) { underlying = null; }
            if (underlying && H.isLoaderBackgroundImageUrl(underlying)) {
                el.style.setProperty('background-image', 'none', 'important');
            } else {
                revertLoaderBgElement(el);
            }
            return;
        }
        let style;
        try { style = getComputedStyle(el); } catch (e) { return; }
        if (!H.isLoaderBackgroundImageUrl(style.backgroundImage)) return;
        el.style.setProperty('background-image', 'none', 'important');
        loaderBgModified.add(el);
    }

    function clearLoaderBackgroundImages(root, precollected) {
        if (!root || !currentTheme || !H) return;
        // Re-check prior clears first — same pattern as reopaqueStickyFixed /
        // rethemeLogoContrast, so an element outside this frame's sliced walk
        // still gets revisited.
        Array.from(loaderBgModified).forEach(el => {
            if (!el || !el.isConnected) {
                loaderBgModified.delete(el);
                return;
            }
            safeVisit(visitLoaderBgElement, el);
        });
        const elements = precollected || collectElements(root);
        const limit = Math.min(elements.length, WALK_SLICE);
        for (let i = 0; i < limit; i++) {
            safeVisit(visitLoaderBgElement, elements[i]);
        }
    }

    // 3g. CONSERVATIVE LOGO / IMAGE CONTRAST
    // IMG/SVG are unconditionally skipped by every other color pass
    // (BRIGHT_SKIP_TAGS) — there is no general image-contrast capability
    // anywhere else in the engine, so a solid-color logo (e.g. a dark
    // wordmark meant for a white header) can end up nearly invisible once
    // its surroundings go dark (confirmed on wtatennis.com's
    // WTA_Logo_Core_Purple_RGB.svg, #2d0046 on black). This pass generalizes
    // that fix, gated tightly enough to never touch a photo or multi-color
    // graphic: small candidate images only, in a brand-mark position, pixel-
    // sampled via canvas and only inverted when (a) confidently near-
    // monochrome and (b) the sampled color genuinely fails contrast against
    // the current theme background. Any failure mode (no src, cross-origin
    // without permissive CORS headers throwing on getImageData, multi-color
    // sample) leaves the image completely untouched — never a guess.
    function isElementInHeaderOrNav(el) {
        try {
            return !!(el.closest && el.closest('header, nav, [role="banner"], [role="navigation"]'));
        } catch (e) { return false; }
    }

    function hasLogoClassHint(el) {
        try {
            if (/logo|brand/i.test(el.className || '')) return true;
            let p = el.parentElement;
            for (let i = 0; i < 3 && p; i++) {
                if (typeof p.className === 'string' && /logo|brand/i.test(p.className)) return true;
                p = p.parentElement;
            }
        } catch (e) {}
        return false;
    }

    function isHomeLinkImage(el) {
        try {
            const a = el.closest && el.closest('a[href]');
            if (!a) return false;
            const href = a.getAttribute('href') || '';
            if (!href) return false;
            const url = new URL(href, window.location.href);
            return url.pathname === '/' && url.origin === window.location.origin;
        } catch (e) { return false; }
    }

    let logoSampleCanvas = null;
    // Cache keyed by image src: sampled pixel stats, or null for a
    // permanently-failed sample (cross-origin/decode failure) — never
    // retried, since decode+sample has a real cost and a CORS failure will
    // never resolve differently on a later pass.
    const logoColorSampleCache = new Map();
    const logoContrastModified = new Set();

    function sampleImageDominantColor(imgEl) {
        if (!logoSampleCanvas) {
            try { logoSampleCanvas = document.createElement('canvas'); } catch (e) { return null; }
        }
        const SAMPLE = 24;
        logoSampleCanvas.width = SAMPLE;
        logoSampleCanvas.height = SAMPLE;
        let ctx;
        try { ctx = logoSampleCanvas.getContext('2d', { willReadFrequently: true }); } catch (e) { return null; }
        if (!ctx) return null;
        try {
            ctx.clearRect(0, 0, SAMPLE, SAMPLE);
            ctx.drawImage(imgEl, 0, 0, SAMPLE, SAMPLE);
            const data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
            let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
            let rSum = 0, gSum = 0, bSum = 0, count = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] < 32) continue; // skip near-transparent pixels
                const r = data[i], g = data[i + 1], b = data[i + 2];
                if (r < rMin) rMin = r;
                if (r > rMax) rMax = r;
                if (g < gMin) gMin = g;
                if (g > gMax) gMax = g;
                if (b < bMin) bMin = b;
                if (b > bMax) bMax = b;
                rSum += r; gSum += g; bSum += b; count++;
            }
            if (count === 0) return null;
            return {
                rSpread: rMax - rMin, gSpread: gMax - gMin, bSpread: bMax - bMin,
                r: Math.round(rSum / count), g: Math.round(gSum / count), b: Math.round(bSum / count),
            };
        } catch (e) {
            // Cross-origin without permissive CORS headers throws a
            // SecurityError on getImageData ("tainted canvas") — safe,
            // expected no-op.
            return null;
        }
    }

    function revertLogoContrastElement(el) {
        try { el.style.removeProperty('filter'); } catch (e) {}
        logoContrastModified.delete(el);
    }

    function visitLogoContrastElement(el) {
        if (!el || el.nodeType !== 1 || !H || !H.isLikelyLogoCandidateInfo) return;
        if (el.tagName !== 'IMG') return;
        let rect;
        try { rect = el.getBoundingClientRect(); } catch (e) { return; }
        const info = {
            width: rect.width,
            height: rect.height,
            inHeaderOrNav: isElementInHeaderOrNav(el),
            hasLogoClassHint: hasLogoClassHint(el),
            isHomeLinkImage: isHomeLinkImage(el),
        };
        if (!H.isLikelyLogoCandidateInfo(info)) {
            // The image no longer qualifies (e.g. it grew past the
            // logo-candidate size window once its responsive layout settled)
            // — revert a prior invert instead of leaving it stuck forever.
            if (logoContrastModified.has(el)) revertLogoContrastElement(el);
            return;
        }
        if (rect.width < 1 || rect.height < 1) return;

        const src = el.currentSrc || el.src || '';
        if (!src) return;
        let sample = logoColorSampleCache.get(src);
        if (sample === undefined) {
            sample = sampleImageDominantColor(el);
            logoColorSampleCache.set(src, sample);
        }
        if (!sample || !H.isNearMonochromeColorStats(sample)) {
            if (logoContrastModified.has(el)) revertLogoContrastElement(el);
            return;
        }

        let style;
        try { style = getComputedStyle(el); } catch (e) { return; }
        // Never fight a site's own filter — unless it's our own from a
        // prior pass, in which case we need to re-derive it below (the
        // theme background may have changed since).
        if (style.filter && style.filter !== 'none' && !logoContrastModified.has(el)) return;

        const dominant = { r: sample.r, g: sample.g, b: sample.b, a: 1 };
        const bg = H.effectiveBackground
            ? H.effectiveBackground(el, getComputedStyle, currentTheme.background)
            : (H.parseHexColor && H.parseHexColor(currentTheme.background));
        if (!bg) return;
        const needsInvert = !!(H.hasPoorContrast && H.hasPoorContrast(dominant, bg, 3.0));
        if (needsInvert) {
            el.style.setProperty('filter', 'invert(1)', 'important');
            logoContrastModified.add(el);
        } else if (logoContrastModified.has(el)) {
            revertLogoContrastElement(el);
        }
    }

    function rethemeLogoContrast(root, precollected) {
        if (!root || !currentTheme || !H) return;
        // Re-check prior inverts first — they may have grown past the
        // logo-candidate size window without being re-visited by the sliced
        // walk this frame (same pattern as reopaqueStickyFixed).
        Array.from(logoContrastModified).forEach(el => {
            if (!el || !el.isConnected) {
                logoContrastModified.delete(el);
                return;
            }
            safeVisit(visitLogoContrastElement, el);
        });
        const elements = precollected || collectElements(root);
        const limit = Math.min(elements.length, WALK_SLICE);
        for (let i = 0; i < limit; i++) {
            safeVisit(visitLogoContrastElement, elements[i]);
        }
    }

    // A <span> version of the existing `mark {}` CSS rule (getFullStyleSheet)
    // — see isLikelyInlineHighlightSpanInfo's doc comment in themeHeuristics.js
    // for why the CSS rule alone can't reach this case. Same re-check-
    // modified-first pattern as visitLoaderBgElement: lift our own override
    // first so we judge the site's real current value, not the paint we
    // applied last pass (a streamed-in span can gain/lose its highlight
    // class as more content arrives).
    const inlineHighlightModified = new Set();

    function computeParentHasSiblingText(el) {
        const parent = el.parentElement;
        if (!parent) return false;
        let total = '', own = '';
        try { total = String(parent.textContent || '').replace(/\s+/g, ' ').trim(); } catch (e) { return false; }
        try { own = String(el.textContent || '').replace(/\s+/g, ' ').trim(); } catch (e) {}
        return (total.length - own.length) >= 3;
    }

    function revertInlineHighlightElement(el) {
        try {
            el.style.removeProperty('background-color');
            el.style.removeProperty('background-image');
            el.style.removeProperty('color');
            el.style.removeProperty('-webkit-text-fill-color');
        } catch (e) {}
        inlineHighlightModified.delete(el);
    }

    function visitInlineHighlightElement(el) {
        if (!el || el.nodeType !== 1 || el.tagName !== 'SPAN' || !H || !H.isLikelyInlineHighlightSpanInfo) return;
        if (inlineHighlightModified.has(el)) {
            el.style.removeProperty('background-color');
            el.style.removeProperty('background-image');
            el.style.removeProperty('color');
            el.style.removeProperty('-webkit-text-fill-color');
        }
        let style;
        try { style = getComputedStyle(el); } catch (e) { return; }
        let ownText = '';
        try { ownText = String(el.textContent || '').replace(/\s+/g, ' ').trim(); } catch (e) {}
        const info = {
            tag: el.tagName,
            backgroundColor: H.parseCssRgb(style.backgroundColor),
            ownTextLength: ownText.length,
            hasIconClassHint: typeof el.className === 'string' && /icon/i.test(el.className),
            inCodeOrPre: !!(el.closest && el.closest('pre, code')),
            inButtonControl: !!(el.closest && el.closest('button, [role="button"]')),
            parentHasSiblingText: computeParentHasSiblingText(el),
        };
        if (!H.isLikelyInlineHighlightSpanInfo(info)) {
            if (inlineHighlightModified.has(el)) revertInlineHighlightElement(el);
            return;
        }
        el.style.setProperty('background-color', 'var(--aura-elevated)', 'important');
        el.style.setProperty('background-image', 'none', 'important');
        el.style.setProperty('color', 'var(--aura-text)', 'important');
        el.style.setProperty('-webkit-text-fill-color', 'var(--aura-text)', 'important');
        inlineHighlightModified.add(el);
    }

    function rethemeInlineHighlights(root, precollected) {
        if (!root || !currentTheme || !H) return;
        Array.from(inlineHighlightModified).forEach(el => {
            if (!el || !el.isConnected) {
                inlineHighlightModified.delete(el);
                return;
            }
            safeVisit(visitInlineHighlightElement, el);
        });
        const elements = precollected || collectElements(root);
        const limit = Math.min(elements.length, WALK_SLICE);
        for (let i = 0; i < limit; i++) {
            safeVisit(visitInlineHighlightElement, elements[i]);
        }
    }

    function promoteEngineStylesheet() {
        const el = document.getElementById('aura-core-engine');
        if (!el || !el.parentNode) return;
        if (el.parentNode.lastElementChild === el) return;
        el.parentNode.appendChild(el);
    }

    // Guards a single pass so a failure in one (arbitrary third-party DOM,
    // a throwing getter, a stack overflow from a pathologically deep tree in
    // handleShadowDOM's recursion, etc.) can't stop the rest of the sequence
    // — and, critically, can't prevent finish() from ever resetting
    // ignoreMutations, which would otherwise silently wedge the
    // MutationObserver into ignoring all future DOM changes on the page.
    function safePass(fn) {
        try { fn(); } catch (e) {}
    }

    function runSafetyPasses(root) {
        if (!root || !currentTheme) return;
        cancelWalkSlices();
        const gen = walkGeneration;
        ignoreMutations = true;
        safePass(() => promoteEngineStylesheet());
        safePass(() => handleShadowDOM(root));

        // Collected once and shared across every pass below (previously each
        // of the 7 full-element walks re-queried `root.querySelectorAll('*')`
        // independently — 7 full-document scans per single reactive
        // repaint). Safe to share: none of the passes fed this array
        // structurally mutate `root`'s light-DOM subtree (verified directly
        // — they only ever write inline style/attributes); the couple that
        // DO touch the DOM tree (promoteEngineStylesheet reordering the
        // engine's own <style>, ensurePseudoBgStyleEl appending an
        // #aura-pseudo-overrides <style> to <head>) both run before this
        // snapshot is taken and never touch elements any pass below cares
        // about.
        const elements = collectElements(root);

        const { vh, vw } = passViewport();
        // AMP (and other custom-element-heavy) pages route real content
        // through hyphenated tags like <amp-layout>/<i-amphtml-wrapper> that
        // the universal `div, section, ... { transparent }` stylesheet rule
        // (getFullStyleSheet's layoutTags list) can never match by name.
        // rethemeOpaqueShells extends the same "clear large opaque shells"
        // treatment to any large custom element via shouldClearShellBackground
        // / isCustomLayoutElement, not just the #app/#root SPA-shell ids that
        // rethemeKnownShells alone covers — without it, a site's own opaque
        // (often white) fill on one of these wrappers sits on top of the
        // correctly-themed html/body and reads as "the whole page is white".
        safePass(() => rethemeOpaqueShells(root, elements));
        safePass(() => clearFullBleedPseudoBackgrounds(root, elements));
        safePass(() => clearLoaderBackgroundImages(root, elements));
        safePass(() => rethemeLogoContrast(root, elements));
        safePass(() => rethemeInlineHighlights(root, elements));
        safePass(() => reopaqueOverlays(root));
        safePass(() => revertGrownModalCards(vh, vw));
        safePass(() => paintGoogleImagesViewer(root));
        safePass(() => reopaqueTopChrome(root));
        safePass(() => restoreAuthoredChromeOpacity(root));
        safePass(() => reopaqueExpandedNavMenuPanels(root, elements));
        safePass(() => reopaqueExpandedContentPanels(root, elements));
        safePass(() => rethemeAskAnythingComposer(root));
        safePass(() => rethemeGoogleAiChatSurface(root));

        const overlaySeen = new Set();
        const skipContrast = isActiveSplitTheme(currentTheme);

        function finish() {
            if (gen !== walkGeneration) return;
            safePass(() => paintGoogleImagesViewer(root));
            if (ignoreMutationsTimer) clearTimeout(ignoreMutationsTimer);
            ignoreMutationsTimer = setTimeout(() => {
                ignoreMutations = false;
                ignoreMutationsTimer = null;
                // Mutations that arrived while this pass was running were
                // queued (see dispatchSafetyPasses), not dropped — re-arm
                // the same debounce path so they're not lost.
                if (pendingMutationRecords.length && !mutationDebounceTimer) {
                    mutationDebounceTimer = setTimeout(() => {
                        mutationDebounceTimer = null;
                        dispatchSafetyPasses();
                    }, 150);
                }
            }, 50);
        }

        // Contrast must run after bright/shell clears so muted spans are
        // judged against the theme background, not a still-white ancestor.
        ignoreMutations = true;
        forEachSliced(elements, function (el) {
            visitShellElement(el, vh, vw);
            visitOverlayModalWalk(el, vh, vw, overlaySeen);
            visitBrightElement(el, vh, vw);
            visitStickyElement(el, vh, vw);
            visitFloatingIconControlElement(el, vh, vw);
        }, function () {
            if (gen !== walkGeneration) return;
            if (skipContrast) {
                finish();
                return;
            }
            // Cache lives only for this one pass, created after every
            // background-mutating pass above has already run — see
            // effectiveBackground's doc comment in themeHeuristics.js for
            // why that ordering is what makes caching safe here.
            const effectiveBgCache = new WeakMap();
            forEachSliced(elements, el => visitContrastElement(el, effectiveBgCache), finish);
        });
    }

    // 3g. NATIVE DARK MODE (opt-in, nativeDarkModeEnabled)
    // Gathers the DOM-facing signals H.classifyNativeDarkModeInfo needs —
    // see that function's doc comment for exactly what each convention
    // requires and why (GitHub Primer, Bootstrap 5.3+, Docusaurus/VitePress/
    // Daisy UI, Tailwind's class="dark" convention).
    function gatherNativeDarkModeInfo() {
        const html = document.documentElement;
        if (!html) return {};
        const dataColorMode = html.getAttribute('data-color-mode');
        const hasDarkThemeCompanion = html.hasAttribute('data-dark-theme') && html.hasAttribute('data-light-theme');
        let hasDataBsTheme = false;
        try { hasDataBsTheme = !!document.querySelector('[data-bs-theme]'); } catch (e) {}
        const dataBsTheme = html.getAttribute('data-bs-theme');
        const dataTheme = html.getAttribute('data-theme');
        let hasDarkClassEvidence = false;
        try {
            const meta = document.querySelector('meta[name="color-scheme"]');
            if (meta && /dark/i.test(meta.getAttribute('content') || '')) hasDarkClassEvidence = true;
        } catch (e) {}
        if (!hasDarkClassEvidence) {
            try { hasDarkClassEvidence = !!document.querySelector('[class*="dark:"]'); } catch (e) {}
        }
        // A small whitelist of common body-level dark-mode class names (not
        // tied to one site's exact string) — e.g. twitch.tv runs its own
        // inline bootstrap script before Aura ever loads:
        //   (localStorage.getItem("twilight.theme")==="1" || matchMedia(...).matches)
        //     && document.body.classList.add("dark-theme")
        // None of the html-level conventions above look at <body> at all.
        const BODY_DARK_CLASS_NAMES = ['dark-theme', 'dark-mode', 'theme-dark'];
        let hasBodyDarkClass = false;
        try {
            hasBodyDarkClass = !!(document.body && document.body.classList
                && BODY_DARK_CLASS_NAMES.some(c => document.body.classList.contains(c)));
        } catch (e) {}
        // Sites with a pure CSS `@media (prefers-color-scheme: dark)` dark
        // theme and no JS/DOM toggle at all (confirmed live on
        // overreacted.io: no class/data-attribute signal whatsoever, yet it
        // renders a real dark background — rgb(40,44,53) — purely from this
        // media query) are invisible to every convention check above, which
        // all look for some DOM marker. The media query itself is the only
        // signal there is to find, and only worth checking when the OS is
        // actually in dark mode right now (the media query auto-applies
        // based on that alone — there's no attribute for us to flip either
        // way, so finding this only ever means "already dark").
        let hasPrefersColorSchemeDarkCss = false;
        try {
            const osPrefersDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
            if (osPrefersDark) {
                outer: for (const sheet of document.styleSheets) {
                    let cssRules;
                    try { cssRules = sheet.cssRules; } catch (e2) { continue; }
                    if (!cssRules) continue;
                    for (const rule of cssRules) {
                        try {
                            if (rule.media && /prefers-color-scheme:\s*dark/i.test(rule.media.mediaText)) {
                                hasPrefersColorSchemeDarkCss = true;
                                break outer;
                            }
                        } catch (e3) {}
                    }
                }
            }
        } catch (e4) {}
        return {
            hasDataColorMode: dataColorMode != null,
            dataColorMode: dataColorMode,
            hasDarkThemeCompanion: hasDarkThemeCompanion,
            hasDataBsTheme: hasDataBsTheme,
            dataBsTheme: dataBsTheme,
            hasDataTheme: dataTheme != null,
            dataTheme: dataTheme,
            hasDarkClassEvidence: hasDarkClassEvidence,
            hasDarkClassAlready: html.classList ? html.classList.contains('dark') : false,
            hasBodyDarkClass: hasBodyDarkClass,
            hasPrefersColorSchemeDarkCss: hasPrefersColorSchemeDarkCss,
        };
    }

    function revertNativeDarkMode() {
        if (!nativeDarkModeApplied) return;
        const html = document.documentElement;
        try {
            if (html) {
                if (nativeDarkModeApplied.attr === 'class') {
                    html.classList.remove(nativeDarkModeApplied.value);
                } else if (nativeDarkModeApplied.hadAttrBefore) {
                    html.setAttribute(nativeDarkModeApplied.attr, nativeDarkModeApplied.prevValue);
                } else {
                    html.removeAttribute(nativeDarkModeApplied.attr);
                }
            }
        } catch (e) {}
        nativeDarkModeApplied = null;
    }

    // Returns true when a known native-dark-mode convention was found and
    // activated — the caller (applyTheme) uses this to decide whether to
    // skip Aura's own generic override stylesheet/JS engine entirely for
    // this page, letting the site's own (designed, complete, self-
    // consistent) dark palette do the work instead.
    function applyNativeDarkModeIfEnabled() {
        if (!H || !H.classifyNativeDarkModeInfo) return false;
        const html = document.documentElement;
        if (!html) return false;
        const info = gatherNativeDarkModeInfo();
        let result;
        try { result = H.classifyNativeDarkModeInfo(info); } catch (e) { return false; }
        if (!result) return false;
        // A known convention was recognized and the site is already dark via
        // it (nativeDarkModeApplied stays null — there's nothing for
        // revertNativeDarkMode to undo later). Success: caller skips Aura's
        // own theme entirely, without us touching any attribute/class.
        if (result.alreadyDark) return true;
        try {
            if (result.attr === 'class') {
                html.classList.add(result.value);
                nativeDarkModeApplied = { attr: 'class', value: result.value };
            } else {
                const prevValue = html.getAttribute(result.attr);
                const hadAttrBefore = prevValue !== null;
                html.setAttribute(result.attr, result.value);
                nativeDarkModeApplied = { attr: result.attr, value: result.value, hadAttrBefore: hadAttrBefore, prevValue: prevValue };
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    // 4. THEME APPLICATION
    function applyTheme(theme) {
        try {
            const host = String(window.location.hostname || '');
            if (H && H.isAdNetworkHost && H.isAdNetworkHost(host)) return;
        } catch (eHost) {}
        if (!theme || theme.enabled === false) {
            lastAppliedThemeKey = '';
            return removeTheme();
        }
        const themeKey = [
            theme.background, theme.text, theme.link,
            theme.backgroundType || '', theme.backgroundGradient || '',
            theme.enabled === false ? '0' : '1',
            theme.nativeDarkModeEnabled ? '1' : '0',
        ].join('|');
        if (themeKey === lastAppliedThemeKey && (document.getElementById('aura-core-engine') || nativeDarkModeApplied)) {
            return;
        }

        // Fully undo any prior paint — generic overrides OR a previous
        // native-dark-mode flip — before deciding what this call should do.
        // The two modes are mutually exclusive and must never blend
        // leftover state from one into the other.
        removeTheme();

        lastAppliedThemeKey = themeKey;
        currentTheme = theme;
        engineAppliedAt = Date.now();
        cancelWalkSlices();

        // Opt-in Dark Mode toggle: prefer the site's own native dark mode
        // over Aura's palette where one is confidently detected (AMP has
        // its own dedicated, isolated path below and doesn't participate —
        // its small custom-element vocabulary has no such framework
        // convention to piggyback on). On success, the site's own CSS does
        // all the work — skip Aura's generic override stylesheet and JS
        // safety-net engine entirely for this page.
        if (!IS_AMP_CONSENT_FRAME && !IS_AMP_DOCUMENT && theme.nativeDarkModeEnabled) {
            if (applyNativeDarkModeIfEnabled()) {
                const earlyShield = document.getElementById('aura-early-shield');
                if (earlyShield) earlyShield.remove();
                return;
            }
        }

        const styleEl = document.createElement('style');
        styleEl.id = 'aura-core-engine';

        if (IS_AMP_CONSENT_FRAME) {
            // Dedicated path: no root paint, no applyBackgroundColors (which
            // forces html/body opaque unconditionally), no JS safety-net
            // engine. See getAmpConsentFrameStyleSheet.
            styleEl.textContent = getAmpConsentFrameStyleSheet(theme);
            (document.head || document.documentElement).appendChild(styleEl);
            const earlyShield = document.getElementById('aura-early-shield');
            if (earlyShield) earlyShield.remove();
            return;
        }

        styleEl.textContent = getFullStyleSheet(theme)
            + (IS_AMP_DOCUMENT ? getAmpDocumentOverrideCss() : '');
        (document.head || document.documentElement).appendChild(styleEl);

        applyBackgroundColors(theme);
        const earlyShield = document.getElementById('aura-early-shield');
        if (earlyShield) earlyShield.remove();

        if (IS_AMP_DOCUMENT) {
            // Dedicated path: static CSS only — skip the general JS
            // safety-net engine entirely for AMP documents.
            return;
        }
        scheduleSafetyPasses();
    }

    function scheduleSafetyPasses() {
        if (safetyPassesRaf) {
            try { cancelAnimationFrame(safetyPassesRaf); } catch (e) {}
            safetyPassesRaf = 0;
        }
        const run = function () {
            safetyPassesRaf = 0;
            if (currentTheme && document.documentElement) {
                runSafetyPasses(document.documentElement);
            }
        };
        if (typeof requestAnimationFrame === 'function') {
            safetyPassesRaf = requestAnimationFrame(function () {
                safetyPassesRaf = requestAnimationFrame(run);
            });
        } else {
            setTimeout(run, 0);
        }
    }

    function removeTheme() {
        lastAppliedThemeKey = '';
        engineAppliedAt = 0;
        revertNativeDarkMode();
        cancelWalkSlices();
        if (safetyPassesRaf) {
            try { cancelAnimationFrame(safetyPassesRaf); } catch (e) {}
            safetyPassesRaf = 0;
        }
        const earlyShield = document.getElementById('aura-early-shield');
        if (earlyShield) earlyShield.remove();
        removeSplitLayer();
        const styleEl = document.getElementById('aura-core-engine');
        if (styleEl) styleEl.remove();
        // Belt-and-suspenders: clear any orphan split node
        const orphanSplit = document.getElementById(SPLIT_LAYER_ID);
        if (orphanSplit) orphanSplit.remove();
        if (document.documentElement) {
            const de = document.documentElement.style;
            de.removeProperty('background-color');
            de.removeProperty('background');
            de.removeProperty('background-image');
            de.removeProperty('background-attachment');
            de.removeProperty('background-repeat');
            de.removeProperty('background-size');
            de.removeProperty('background-position');
            de.removeProperty('color-scheme');
            de.removeProperty('--aura-split-pct');
            de.removeProperty('--aura-split-dark');
            de.removeProperty('--aura-split-light');
        }
        if (document.body) {
            document.body.style.removeProperty('background-color');
            document.body.style.removeProperty('background');
            document.body.style.removeProperty('background-image');
        }
        // Revert any sticky/fixed elements we forced opaque
        stickyModified.forEach(el => {
            try {
                el.style.removeProperty('background-color');
                el.style.removeProperty('color');
            } catch (e) {}
        });
        stickyModified.clear();
        // Revert near-white surfaces we cleared
        brightModified.forEach(el => {
            try {
                el.style.removeProperty('background-color');
                el.style.removeProperty('background-image');
            } catch (e) {}
        });
        brightModified.clear();
        // Revert dialog overlays we painted
        overlayModified.forEach(el => {
            try {
                el.style.removeProperty('background-color');
                el.style.removeProperty('background-image');
                el.style.removeProperty('mix-blend-mode');
                el.style.removeProperty('color');
            } catch (e) {}
        });
        overlayModified.clear();
        modalCardOpaqueModified.clear();
        // Reset so a drawer already open at re-apply time is treated as a
        // fresh baseline (no paint) rather than reading 'expanded' as its
        // own prior state and never registering a transition.
        navDrawerStateHistory = new WeakMap();
        navMenuPanelOpaqueModified.forEach(el => {
            try {
                el.style.removeProperty('background-color');
                el.style.removeProperty('background-image');
            } catch (e) {}
        });
        navMenuPanelOpaqueModified.clear();
        navMenuPanelStateHistory = new WeakMap();
        expandedContentPanelOpaqueModified.forEach(el => {
            try {
                el.style.removeProperty('background-color');
                el.style.removeProperty('background-image');
            } catch (e) {}
        });
        expandedContentPanelOpaqueModified.clear();
        expandedContentPanelStateHistory = new WeakMap();
        floatingIconControlModified.forEach(el => {
            try {
                el.style.removeProperty('background-color');
                el.style.removeProperty('background-image');
            } catch (e) {}
        });
        floatingIconControlModified.clear();
        revertGoogleImagesMosaic();
        contrastModified.forEach(el => {
            try { el.style.removeProperty('color'); } catch (e) {}
        });
        contrastModified.clear();
        shellModified.forEach(el => {
            try {
                el.style.removeProperty('background-color');
                el.style.removeProperty('background-image');
            } catch (e) {}
        });
        shellModified.clear();
        chromeModified.forEach(el => {
            try {
                el.style.removeProperty('background-color');
                el.style.removeProperty('background-image');
                el.style.removeProperty('color');
            } catch (e) {}
        });
        chromeModified.clear();
        chromeOuterModified.clear();
        chromeFixedInnerModified.clear();
        chromeAuthoredModified.forEach(el => {
            try {
                el.style.removeProperty('background-color');
                el.style.removeProperty('background-image');
            } catch (e) {}
        });
        chromeAuthoredModified.clear();
        if (pseudoBgStyleEl) {
            try { pseudoBgStyleEl.remove(); } catch (e) {}
            pseudoBgStyleEl = null;
        }
        pseudoBgCleared.forEach(el => {
            try { el.removeAttribute('data-aura-pbg'); } catch (e) {}
        });
        pseudoBgCleared.clear();
        pseudoBgNavPanelHosts.forEach(el => {
            try { el.removeAttribute('data-aura-pbg'); } catch (e) {}
        });
        pseudoBgNavPanelHosts.clear();
        pseudoBgRulesByToken.clear();
        loaderBgModified.forEach(el => {
            try { el.style.removeProperty('background-image'); } catch (e) {}
        });
        loaderBgModified.clear();
        logoContrastModified.forEach(el => {
            try { el.style.removeProperty('filter'); } catch (e) {}
        });
        logoContrastModified.clear();
        inlineHighlightModified.forEach(el => {
            try {
                el.style.removeProperty('background-color');
                el.style.removeProperty('background-image');
                el.style.removeProperty('color');
                el.style.removeProperty('-webkit-text-fill-color');
            } catch (e) {}
        });
        inlineHighlightModified.clear();
        revertAskAnythingComposer();
        revertGoogleAiChatSurface();
        document.querySelectorAll('style[data-aura-shadow]').forEach(s => {
            try { s.remove(); } catch (e) {}
        });
        sameOriginIframeModified.forEach(el => {
            try {
                const doc = el.contentDocument;
                const s = doc && doc.querySelector('style[data-aura-iframe]');
                if (s) s.remove();
            } catch (e) {}
        });
        sameOriginIframeModified.clear();
    }

    // Same-origin iframes (help panels, embedded settings, same-origin
    // widgets) get no theming at all otherwise — unlike shadow DOM, whose
    // light-DOM stylesheet doesn't inherit into shadow roots either, but has
    // the handling right above. A cross-origin iframe's contentDocument
    // throws/returns null on access (same-origin policy) — that failure is
    // caught and treated as a safe, expected no-op, not an error.
    function visitSameOriginIframe(iframeEl) {
        if (!iframeEl || !H) return;
        try {
            let host = '';
            try { host = new URL(iframeEl.src, window.location.href).hostname; } catch (e) {}
            if (host && (
                (H.isAdNetworkHost && H.isAdNetworkHost(host)) ||
                (H.isChatWidgetHost && H.isChatWidgetHost(host))
            )) {
                return;
            }
            const doc = iframeEl.contentDocument;
            if (!doc) return;
            const target = doc.head || doc.documentElement;
            if (!target) return;
            let style = doc.querySelector('style[data-aura-iframe]');
            if (!style) {
                style = doc.createElement('style');
                style.setAttribute('data-aura-iframe', 'true');
                target.appendChild(style);
            }
            style.textContent = getFullStyleSheet(currentTheme);
            sameOriginIframeModified.add(iframeEl);
        } catch (e) {
            // Cross-origin, or the iframe document isn't in a themeable
            // state yet — safe, expected no-op.
        }
    }

    // 5. SHADOW DOM + SAME-ORIGIN IFRAME HANDLER - Prevent duplicate style injections
    function handleShadowDOM(root) {
        if (!root) return;

        if (root.shadowRoot) {
            const existingStyle = root.shadowRoot.querySelector('style[data-aura-shadow]');
            if (existingStyle) {
                existingStyle.textContent = getFullStyleSheet(currentTheme);
            } else {
                const style = document.createElement('style');
                style.setAttribute('data-aura-shadow', 'true');
                style.textContent = getFullStyleSheet(currentTheme);
                root.shadowRoot.appendChild(style);
            }
            processedShadowRoots.add(root.shadowRoot);

            // The universal stylesheet just injected strips background-color
            // from every layout tag inside this shadow root too — but none
            // of the JS safety-net passes below (which recognize legitimate
            // sticky/fixed chrome and restore its opaque background) ever
            // see shadow-root content: querySelectorAll cannot cross a
            // shadow boundary, so collectElements(document...) never finds
            // these elements at all. Confirmed on workspace.google.com's
            // <gws-action-bar>: a position:fixed, white "Sign in / Get
            // Gmail / For work" bottom bar rendered entirely inside an open
            // shadow root goes fully transparent (universal rule strips it)
            // with nothing to ever repaint it. Re-run the sticky/fixed
            // re-opaque pass over this shadow root's own elements to
            // restore parity with the light-DOM walk.
            try {
                const { vh, vw } = passViewport();
                const shadowElements = root.shadowRoot.querySelectorAll('*');
                for (let i = 0; i < shadowElements.length; i++) {
                    safeVisit(e => visitStickyElement(e, vh, vw), shadowElements[i]);
                }
            } catch (e2) {}
        }

        if (root.tagName === 'IFRAME') {
            visitSameOriginIframe(root);
        }

        // Only process direct children, not all descendants
        for (let i = 0; i < root.children.length; i++) {
            const child = root.children[i];
            if (child.nodeType === 1) {
                handleShadowDOM(child);
            }
        }
    }

    // REQUEST THEME UPDATE: Ask background script to sync from App Group
    async function requestThemeUpdate() {
        try {
            console.log("Aura Content: Requesting theme update");
            
            // Ask background script to sync from App Group
            if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
                try {
                    console.log("Aura Content: Sending checkThemeUpdate to background script");
                    const response = await browser.runtime.sendMessage({ type: "checkThemeUpdate" });
                    console.log("Aura Content: Background script response:", response);
                    return true;
                } catch (e) {
                    console.error("Aura Content: Error sending message to background:", e);
                }
            }
            
            // Fallback: Try direct native messaging
            const freshData = await tryDirectNativeSync();
            if (freshData?.globalTheme) {
                await browser.storage.local.set({ tintThemeData: freshData });
                window.__TINT_THEME_DATA__ = freshData;
                window.__TINT_THEME_DATA__._ready = true;
                window.__TINT_THEME__ = freshData.globalTheme;
                applyTheme(freshData.globalTheme);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error("Aura Content: Error in requestThemeUpdate:", error);
            return false;
        }
    }

    // 6. MESSAGE LISTENER (fallback only)
    browser.runtime.onMessage.addListener((message) => {
        console.log("Aura Content: Message received", message);
        if (message.type === 'UPDATE_THEME' || message.type === 'THEME_UPDATED') {
            // Prefer full themeData (so we can resolve site/time-based); fall
            // back to the pre-resolved theme the background script sent.
            const themeData = message.themeData || window.__TINT_THEME_DATA__;
            if (themeData) {
                window.__TINT_THEME_DATA__ = themeData;
                window.__TINT_THEME_DATA__._ready = true;
            }
            const theme = (themeData && resolveTheme(themeData))
                || message.theme
                || message.themeData?.globalTheme;
            if (theme) {
                window.__TINT_THEME__ = theme;
                applyTheme(theme);
            }
        }
    });

    // 7. STORAGE CHANGE LISTENER - Direct application without re-fetch
    browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.tintThemeData?.newValue) {
            const newThemeData = changes.tintThemeData.newValue;
            const newTheme = resolveTheme(newThemeData);
            if (!newTheme) return;
            console.log("Aura Content: Storage changed, applying new theme");
            
            // Update coordination variables immediately
            window.__TINT_THEME_DATA__ = newThemeData;
            window.__TINT_THEME_DATA__._ready = true;
            window.__TINT_THEME__ = newTheme;
            
            // Apply theme DIRECTLY without async re-fetch
            applyTheme(newTheme);
        }
    });

    // 8. CUSTOM EVENT LISTENER - Listen for updates from injected script (attach only once)
    function attachCustomEventListener() {
        if (customEventListenerAttached) return;
        
        window.addEventListener('aura-theme-updated', (event) => {
            if (event.detail?.themeData) {
                console.log("Aura Content: Custom event received, applying theme");
                const newThemeData = event.detail.themeData;
                const newTheme = resolveTheme(newThemeData);
                if (!newTheme) return;
                
                window.__TINT_THEME_DATA__ = newThemeData;
                window.__TINT_THEME_DATA__._ready = true;
                window.__TINT_THEME__ = newTheme;
                
                applyTheme(newTheme);
            }
        });
        
        customEventListenerAttached = true;
    }

    // FALLBACK: Direct native messaging from content script
    async function tryDirectNativeSync() {
        try {
            if (!browser.runtime?.sendNativeMessage) return null;
            
            console.log("Aura Content: Trying direct native messaging");
            
            const response = await new Promise((resolve, reject) => {
                let completed = false;
                
                const timeout = setTimeout(() => {
                    if (!completed) {
                        completed = true;
                        console.warn("Aura Content: Direct native message timeout");
                        resolve(null);
                    }
                }, 2000);
                
                browser.runtime.sendNativeMessage(
                    "com.alexmartens.aura.SafariExtension",
                    { type: "getTheme" },
                    (response) => {
                        if (!completed) {
                            completed = true;
                            clearTimeout(timeout);
                            
                            if (browser.runtime.lastError) {
                                console.warn("Aura Content: Direct native message error:", browser.runtime.lastError.message);
                                resolve(null);
                            } else {
                                console.log("Aura Content: Direct native message SUCCESS");
                                resolve(response);
                            }
                        }
                    }
                );
            });
            
            if (response?.themeData?.globalTheme) {
                console.log("Aura Content: Got theme via direct native messaging");
                return response.themeData;
            }
        } catch (error) {
            console.error("Aura Content: Direct native messaging failed:", error);
        }
        
        return null;
    }

    function dedupeMutationTargets(records) {
        const seen = new Set();
        const out = [];
        for (let i = 0; i < records.length; i++) {
            const target = records[i].target;
            if (target && !seen.has(target)) {
                seen.add(target);
                out.push(target);
            }
        }
        return out;
    }

    // Runs on the MutationObserver's 150ms debounce. Classifies the batch
    // of records queued since the last dispatch (see pendingMutationRecords
    // — mutations arriving while a pass is running are buffered, not
    // dropped, so a burst that straddles two passes is still judged as one
    // batch here) and scopes the repaint to the mutated subtree when the
    // batch is small/localized (typing/streaming) instead of always walking
    // the full document. Any ambiguity — empty batch, a disconnected/
    // unresolvable common ancestor — falls back to the full document, which
    // is always correct; only a confidently "small and localized" batch
    // narrows the walk.
    function dispatchSafetyPasses() {
        const records = pendingMutationRecords;
        pendingMutationRecords = [];
        if (!currentTheme || !records.length) return;
        let root = document.documentElement;
        try {
            let addedNodeCount = 0;
            let removedNodeCount = 0;
            for (let i = 0; i < records.length; i++) {
                addedNodeCount += records[i].addedNodes.length;
                removedNodeCount += records[i].removedNodes.length;
            }
            const classification = H && H.classifyMutationBatchInfo
                ? H.classifyMutationBatchInfo({ recordCount: records.length, addedNodeCount, removedNodeCount })
                : 'full';
            if (classification === 'scoped' && H && H.findCommonMutationAncestor) {
                const ancestor = H.findCommonMutationAncestor(
                    dedupeMutationTargets(records),
                    document.documentElement
                );
                if (ancestor && ancestor.nodeType === 1) root = ancestor;
            }
        } catch (e) {
            root = document.documentElement;
        }
        runSafetyPasses(root);
    }

    // 9. INITIALIZATION
    async function init() {
        // Nested ad creative frames: never theme.
        try {
            const host = String(window.location.hostname || '');
            if (H && H.isAdNetworkHost && H.isAdNetworkHost(host)) return;
        } catch (eHost) {}

        const data = await browser.storage.local.get('tintThemeData');
        const td = data?.tintThemeData;
        if (td) {
            const theme = resolveTheme(td);
            if (theme) {
                window.__TINT_THEME_DATA__ = td;
                window.__TINT_THEME_DATA__._ready = true;
                window.__TINT_THEME__ = theme;
                applyTheme(theme);
            }
        }

        // Attach custom event listener (only once)
        attachCustomEventListener();

        // AMP documents and the AMP consent iframe use their own static-CSS
        // path (see applyTheme()) and never call into the JS engine below —
        // don't even wire up its triggers for them.
        if (!IS_AMP_DOCUMENT && !IS_AMP_CONSENT_FRAME) {
            // Set up mutation observer for Shadow DOM (only once)
            if (!mutationObserver) {
                mutationObserver = new MutationObserver((mutationsList) => {
                    // Queue-and-coalesce, not drop-while-busy: buffer even
                    // while a pass is running (ignoreMutations === true) so
                    // dispatchSafetyPasses' scoping decision reflects
                    // everything that happened, not just whatever arrives
                    // after the pass's cooldown ends. Cheap — array push,
                    // no DOM work.
                    for (let i = 0; i < mutationsList.length; i++) {
                        pendingMutationRecords.push(mutationsList[i]);
                    }
                    if (ignoreMutations) return;
                    if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
                    mutationDebounceTimer = setTimeout(() => {
                        mutationDebounceTimer = null;
                        dispatchSafetyPasses();
                    }, 150);
                });
                mutationObserver.observe(document.documentElement, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    // 'data-state' covers Radix UI / Headless UI / Ariakit
                    // (the foundation of shadcn/ui and a large share of
                    // modern React sites) — those toggle open/closed via
                    // data-state="open"|"closed" instead of aria-expanded/
                    // class, so without it every transition-gated pass
                    // (nav-drawer, nav-menu-panel, overlay) never re-runs
                    // when one of these components opens.
                    attributeFilter: ['style', 'class', 'hidden', 'open', 'aria-expanded', 'aria-hidden', 'data-state'],
                });
            }

            // Shopping / SERP headers often become sticky only after scroll, or
            // clone a second bar. Re-paint chrome without waiting for a mutation.
            if (!scrollListenerAttached) {
                scrollListenerAttached = true;
                window.addEventListener('scroll', () => {
                    if (!currentTheme || ignoreMutations) return;
                    if (scrollPassTimer) return;
                    scrollPassTimer = setTimeout(() => {
                        scrollPassTimer = null;
                        if (!currentTheme) return;
                        const { vh, vw } = passViewport();
                        safePass(() => revertGrownModalCards(vh, vw));
                        safePass(() => reopaqueTopChrome(document.documentElement));
                        safePass(() => reopaqueStickyFixed(document.documentElement));
                        if (isGoogleImagesPage()) {
                            safePass(() => paintGoogleImagesViewer(document.documentElement));
                        }
                    }, 200);
                }, { passive: true });
            }
        }

        // Re-evaluate time-based day/night every minute so themes flip at
        // boundary times without waiting for a storage sync.
        setInterval(() => {
            const td = window.__TINT_THEME_DATA__;
            if (!td?.timeBasedRule?.enabled) return;
            const next = resolveTheme(td);
            if (!next) return;
            const prev = window.__TINT_THEME__;
            if (!prev
                || prev.background !== next.background
                || prev.text !== next.text
                || prev.link !== next.link
                || prev.backgroundGradient !== next.backgroundGradient) {
                window.__TINT_THEME__ = next;
                applyTheme(next);
            }
        }, 60000);
    }

    // Safari tab focus detection - request theme update
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            requestThemeUpdate();
        }
    });

    init();
    
    // CRITICAL: Immediately trigger background script to sync from App Group
    // This ensures we get fresh theme data even if background script hasn't run yet
    setTimeout(() => {
        requestThemeUpdate();
    }, 100);
})();
