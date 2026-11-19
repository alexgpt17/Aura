/**
 * AURA THEME ENGINE - Fixed Version with Memory Leak Prevention
 */

(function() {
    // Verbose tracing only — flip to true when diagnosing a sync issue.
    // Genuine console.error/console.warn calls on unexpected-failure paths
    // stay on regardless (mirrors background.js's AURA_DEBUG_LOGGING).
    const AURA_DEBUG_LOGGING = false;
    let currentTheme = null;
    // <iframe> elements whose same-origin contentDocument we've injected a
    // themed <style data-aura-iframe> into (see shadowRootSteps /
    // visitSameOriginIframe) — tracked only for removeTheme() cleanup.
    const sameOriginIframeModified = new Set();
    // Every copy of the engine sheet outside the document (one per open
    // shadow root, one per same-origin iframe). A theme change rewrites
    // them in the same task as the main sheet; removing the theme removes
    // them. document.querySelectorAll can't reach the shadow-root ones.
    const auraSheetCopies = new Set();
    // Site theme-color metas we overwrote: meta -> original content.
    const themeColorMetaOriginals = new Map();
    // Set when the opt-in Dark Mode toggle (nativeDarkModeEnabled) has
    // successfully flipped the site's own native dark-mode convention (see
    // applyNativeDarkModeIfEnabled) — records exactly what was changed on
    // <html> so revertNativeDarkMode() can put it back precisely, including
    // restoring a pre-existing attribute value rather than just deleting it.
    let nativeDarkModeApplied = null;
    // True while the site's own dark mode is in use instead of Aura's
    // theme (including a site that was already dark, where
    // nativeDarkModeApplied stays null). The engine is idle then.
    let nativeModeActive = false;
    let mutationObserver = null;
    let customEventListenerAttached = false;
    // Layer & overlay engine (section 3c-bis). Every element the authored-
    // paint rule wrote a background on: el -> { root, bg, opaque }.
    const layerPaints = new Map();
    // Every fixed/sticky layer or overlay root the rule evaluated:
    // root -> { mode, source, pass, dirty, painted: Set }.
    const layerRoots = new Map();
    // Tracked roots a mutation batch landed inside; the next pass
    // re-evaluates them (see runSafetyPasses).
    const pendingLayerRecheck = new Set();
    // Near-white / light-gray opaque surfaces cleared by visitBrightElement().
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
    // Nav/menu/header elements repainted opaque because the site's own CSS
    // gave them an !important background we out-specificity'd (see
    // restoreAuthoredChromeOpacity). Tracked only for removeTheme() cleanup —
    // unlike the fixed-position tiers above, a non-fixed menu can't grow
    // into a curtain by scrolling, so there's no separate revert pass.
    const chromeAuthoredModified = new Set();
    // Per-element collapsed/expanded history for menus that expand IN PLACE
    // rather than as a position:fixed/sticky overlay (see
    // classifyNavMenuPanelState / reopaqueExpandedNavMenuPanels) — e.g. a
    // Bootstrap-style ".navbar-collapse" mobile menu, which isLikelyNavDrawer
    // can never reach since it requires position fixed/sticky. Painted only
    // on a confirmed collapsed -> expanded transition, never merely because
    // it "currently looks expanded" (the wtatennis.com ambient-nav curtain).
    let navMenuPanelStateHistory = new WeakMap();
    // Pending-revert streak for navMenuPanelStateHistory's collapsed
    // direction, via notePendingRevert.
    let navMenuPanelPendingCollapse = new WeakMap();
    // In-place nav panels reopaqueExpandedNavMenuPanels saw open (state
    // only: the authored-paint rule does the painting, as layer root
    // source 'navpanel').
    const navMenuPanelOpaqueModified = new Set();
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
    let changeListenerAttached = false;
    let transitionendListenerAttached = false;
    let focusListenersAttached = false;
    let toggleListenerAttached = false;
    let userInputListenersAttached = false;
    // Reveal-animation properties worth forcing a repaint pass over —
    // opacity is deliberately excluded: opacity-only hover/focus micro-
    // transitions (buttons, cards, tooltips) are extremely common and would
    // be the largest source of unwanted full-document walks, while every
    // CSS-only reveal pattern checked (including Wikipedia's, which
    // transitions opacity/visibility/transform together) also transitions
    // at least one of the properties below — so omitting opacity costs
    // nothing against the actual bug.
    const TRANSITIONEND_REVEAL_PROPERTIES = {
        transform: 1, visibility: 1, 'max-height': 1, height: 1, width: 1,
    };

    const H = (typeof AuraThemeHeuristics !== 'undefined' && AuraThemeHeuristics)
        ? AuraThemeHeuristics
        : null;
    const Split = (typeof AuraSplitTheme !== 'undefined' && AuraSplitTheme)
        ? AuraSplitTheme
        : null;
    const Resolve = (typeof AuraThemeResolve !== 'undefined' && AuraThemeResolve)
        ? AuraThemeResolve
        : null;
    // Debug HUD hooks (auraDebug.js). null unless the tab opted in with
    // #aura-debug; Release builds ship a stub that is never enabled.
    const DBG = (typeof AuraDebug !== 'undefined' && AuraDebug && AuraDebug.enabled)
        ? AuraDebug
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
    // Cache for getFullStyleSheet()'s ~400-line CSS build — keyed on
    // lastAppliedThemeKey, which is already recomputed/assigned exactly when
    // the active theme changes (applyTheme) and cleared exactly when it's
    // removed (removeTheme), so it's always in sync with what a fresh build
    // would produce. Without this, shadowRootSteps rebuilds the full sheet
    // from scratch for EVERY shadow root it finds on EVERY dispatched pass —
    // on a page like reddit.com with one shadow root per comment, that's a
    // real, self-inflicted lag source of exactly the same class already
    // fixed once for googleAiAnswerRootsCache (see below).
    let styleSheetCacheKey = null;
    let styleSheetCacheCss = '';
    let mutationDebounceTimer = null;
    // MutationRecords buffered across the debounce window AND across any
    // pass currently running (queue-and-coalesce, not drop-while-busy) — see
    // dispatchSafetyPasses. Used only to decide how to scope the next walk;
    // never read for its own content beyond target/addedNodes/removedNodes.
    let pendingMutationRecords = [];
    let safetyPassesRaf = 0;
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
    // CSSStyleSheet -> its last scan (see getAuthoredOpaqueBgSelectors).
    const importantBgSheetScans = new WeakMap();
    let walkGeneration = 0;
    let walkSliceTimer = 0;
    const WALK_SLICE = 4000; // cap for the per-pass element loops (unrelated to yielding — see SLICE_BUDGET_MS)
    // A safety pass runs as a queue of steps (runSteps), sliced by time
    // rather than element count so one slow step on a big page can't block
    // input: each slice is its own task and stops after SLICE_BUDGET_MS.
    // While the user is typing (a key/input event in the last
    // TYPING_WINDOW_MS) slices shrink and are spaced out, so keystrokes
    // never wait behind more than a few ms of engine work. Measured with
    // tools/harness (Session 3): the old fixed 300-element rAF chunks plus
    // a synchronous shadow-root phase produced 200+ ms tasks during
    // hydration.
    const SLICE_BUDGET_MS = 8;
    const TYPING_SLICE_BUDGET_MS = 3;
    const TYPING_SLICE_GAP_MS = 16;
    const TYPING_WINDOW_MS = 600;
    let lastUserInputAt = -Infinity;

    // How many consecutive disagreeing readings a revert/downgrade path must
    // see before it actually acts — see notePendingRevert below.
    const REVERT_CONFIRM_READINGS = 2;
    // Two calls to notePendingRevert for the SAME element during one pass
    // (same pendingRevertReading), or inside this window, are treated as
    // one reading, not two — needed because reopaqueExpandedNavMenuPanels
    // re-checks its already-opaque Set and then
    // separately re-walk the full element list within one runSafetyPasses
    // call, visiting an already-tracked element twice per real pass. Passes
    // are time-sliced (runSteps), so those two visits can be more than
    // 100ms apart; the per-pass reading counter covers that, and the time
    // window still merges calls from outside a pass. Either way the only
    // consequence of merging is slightly MORE tolerance before a revert,
    // never a wrongful paint.
    const PENDING_REVERT_DEDUP_WINDOW_MS = 100;
    let pendingRevertReading = 0;

    // Shared "require N consecutive disagreeing readings before reverting an
    // already-opaque/expanded element" gate. Originated as a one-off fix for
    // Wikipedia's mobile nav menu going transparent mid-donate-banner-image-
    // decode — generalized here after
    // confirming every other transition-gated/revert-capable pass had NO
    // such protection at all, meaning any already-correctly-painted overlay/
    // panel/sticky element anywhere was one unrelated nearby DOM change away
    // from being wrongly reverted.
    //
    // Stability-only by design: every call site below uses this ONLY on its
    // revert/downgrade path, never on its paint/upgrade path — it can only
    // make a pass more reluctant to un-paint something already correctly
    // opaque, never more willing to paint something new. `map` is a WeakMap
    // private to one call site, holding { count, lastReadAt, reading }.
    function notePendingRevert(map, el, threshold) {
        const now = Date.now();
        const entry = map.get(el);
        if (entry && (entry.reading === pendingRevertReading
            || (now - entry.lastReadAt) < PENDING_REVERT_DEDUP_WINDOW_MS)) {
            return entry.count >= threshold;
        }
        const count = (entry ? entry.count : 0) + 1;
        if (count >= threshold) {
            map.delete(el);
            return true;
        }
        map.set(el, { count, lastReadAt: now, reading: pendingRevertReading });
        return false;
    }

    function isActiveSplitTheme(theme) {
        if (!theme || !Split || !Split.isSplitTheme(theme)) return false;
        return !!Split.parseSplitColors(theme.backgroundGradient || theme);
    }

    // Mosaic tiles hidden while the Images viewer is open (reverted each pass).
    const googleImagesMosaicHidden = new Set();

    // Google Search / Images / AI Mode (not Google's apps on google.com
    // subdomains; see Resolve.GOOGLE_APP_HOSTS).
    function isGoogleHost() {
        try {
            const host = String(window.location.hostname || '').toLowerCase();
            if (Resolve && Resolve.isGoogleSearchHost) return Resolve.isGoogleSearchHost(host);
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

    // Re-visit elements a pass painted earlier (they may have changed
    // outside this pass's scope); drop the disconnected ones.
    function recheckTracked(set, visit) {
        Array.from(set).forEach(el => {
            if (!el || !el.isConnected) { set.delete(el); return; }
            safeVisit(visit, el);
        });
    }

    function cancelWalkSlices() {
        walkGeneration += 1;
        if (walkSliceTimer) {
            clearTimeout(walkSliceTimer);
            walkSliceTimer = 0;
        }
    }

    function noteUserInput() {
        lastUserInputAt = performance.now();
    }

    function isUserTyping() {
        return (performance.now() - lastUserInputAt) < TYPING_WINDOW_MS;
    }

    // Every slice runs in its own task, and MutationObserver records are
    // delivered at the end of each task, so whatever is queued when a slice
    // ends came from our own writes in that slice (no site code ran in
    // between). Dropping them keeps Aura's inline-style writes from widening
    // the next pass's scope to <html> or re-triggering passes. (A custom
    // element reacting synchronously to one of our writes would be dropped
    // too; the next site mutation picks it up.)
    function discardOwnMutationRecords() {
        if (!mutationObserver) return;
        try { mutationObserver.takeRecords(); } catch (e) {}
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

    // Runs `steps` in time-budgeted slices (see SLICE_BUDGET_MS). A step is
    // either a function (run once; may return an array of further steps,
    // which run next) or { items, visit } (visit(el) per element, split
    // across slices as needed). onDone runs after the last step unless a
    // newer pass cancelled this one (cancelWalkSlices).
    function runSteps(steps, onDone) {
        const gen = walkGeneration;
        let s = 0;
        let i = 0;
        function slice() {
            walkSliceTimer = 0;
            if (gen !== walkGeneration) return;
            const typing = isUserTyping();
            const deadline = performance.now() + (typing ? TYPING_SLICE_BUDGET_MS : SLICE_BUDGET_MS);
            while (s < steps.length) {
                const step = steps[s];
                if (typeof step === 'function') {
                    const more = safePass(step);
                    s++;
                    if (Array.isArray(more) && more.length) steps.splice(s, 0, ...more);
                } else {
                    const items = step.items;
                    for (; i < items.length; i++) {
                        const el = items[i];
                        if (el && el.nodeType === 1) safeVisit(step.visit, el);
                        if ((i & 15) === 15 && performance.now() >= deadline) { i++; break; }
                    }
                    // A batching step writes what it queued (see
                    // contrastBatchStep) when its items are done; the queue
                    // stays open across slices, since a slice that starts
                    // after writes pays a style recalc on its first read.
                    if (i >= items.length) {
                        if (step.flush) safePass(step.flush);
                        s++; i = 0;
                    }
                }
                if (performance.now() >= deadline) break;
            }
            discardOwnMutationRecords();
            if (gen !== walkGeneration) return;
            if (s < steps.length) {
                walkSliceTimer = setTimeout(slice, typing ? TYPING_SLICE_GAP_MS : 0);
            } else if (onDone) {
                onDone();
            }
        }
        slice();
    }

    // 1. SITE-SPECIFIC OVERRIDES
    // Each entry: { match: [hostnames], css }. A site matches when the current
    // hostname equals a listed host or is a subdomain of it (suffix match), so
    // e.g. 'google.com' also covers 'www.google.com'.
    const SITE_FIXES = [
        {
            match: ['google.com'],
            // Search, Images and AI Mode only: Forms (docs.google.com)
            // matched these rules and isGoogleHost before Session 6.
            exclude: Resolve ? Resolve.GOOGLE_APP_HOSTS : [],
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
                /* :where() keeps the specificity; the probe exemption lets
                   readAuthoredPaint see what Google painted (a sticky bar
                   or the composer inside #rso read as transparent before
                   Session 7, so the layer rule never painted them). The
                   composer is painted by its own rule below. */
                #rso div:not([role="dialog"]):not([role="menu"]):where(:not([data-aura-probe], [data-aura-composer])) {
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
                /* Set by paintGoogleImagesViewer while a viewer covers the
                   page (was body:has(...), which WebKit re-checks on almost
                   every DOM change: typing cost). */
                html[data-aura-gimg-viewer] #islrg,
                html[data-aura-gimg-viewer] #islmp {
                    visibility: hidden !important;
                }

                /* AI Overview collapse-fade: an empty div whose following
                   sibling (source chips may sit in between on mobile)
                   contains the expander. Marked by markGoogleAiOverview (was
                   an unscoped div:has(~ div ...):empty, re-checked on every
                   DOM change). */
                [data-aura-ai-fade] {
                    background-color: transparent !important;
                    background-image: linear-gradient(transparent, var(--aura-bg)) !important;
                }
                [data-aura-ai-more],
                [aria-controls="m-x-content"],
                [aria-label*="Show more AI" i],
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

                /* AI answer card (found by its disclaimer, marked once by
                   rethemeGoogleAiChatSurface): its blocks stay clear,
                   including content streamed in later, without per-element
                   inline writes. */
                [data-aura-ai-card] :is(div, p, li, span):not(button, [role="button"], button *, [role="button"] *):where(:not([data-aura-probe])) {
                    background-color: transparent !important;
                    background-image: none !important;
                }
                /* Ask-anything composer shell + field (marked by
                   rethemeAskAnythingComposer). */
                [data-aura-composer]:where(:not([data-aura-probe])) {
                    background-color: var(--aura-overlay) !important;
                    background-image: none !important;
                }

                /* Ask-anything field only — outer chip/icon buttons still
                   cleared in JS (rethemeAskAnythingComposer), since they're
                   found by a runtime geometry check CSS can't express. Do
                   not paint --aura-bg. background-color here is mostly
                   redundant with the universal input/div-transparency rules
                   elsewhere in this stylesheet, but stated explicitly so
                   this rule fully states its own contract. The broad "Ask"
                   match uses ~= (whitespace-token) rather than *= to better
                   approximate isAskAnythingField's \bask\b word-boundary
                   check — avoids matching unrelated words like "Mask". */
                :is(textarea, input, [contenteditable="true"], [role="textbox"]):is(
                    [placeholder*="ask anything" i],
                    [aria-label*="ask anything" i],
                    [placeholder~="ask" i],
                    [aria-label~="ask" i]
                ):not(.gLFyf):not([aria-label*="search" i]):not([placeholder*="search" i]) {
                    background-color: transparent !important;
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
                    /* Color only: a 1px border shorthand here resized the
                       infobox on mobile Wikipedia (no authored border),
                       re-wrapping every cell below it (Session 8c). */
                    border-color: var(--aura-border) !important;
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
                    /* border-color, not border: none — removing the border
                       would shrink the button (layout invariance). */
                    border-color: transparent !important;
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
        },
        {
            // youtube.com and x.com/twitter.com were verified to need no
            // override: the universal transparency + sticky/fixed pass
            // themes them cleanly. reddit.com's subreddit-info bar (name /
            // member count / "Open App") was reported still see-through on
            // device, but its live markup hasn't been inspected — this is a
            // best-guess selector list for Reddit's shreddit web-component
            // subreddit header, not a confirmed one. Being hostname-scoped
            // and selector-based, if these selectors don't match anything
            // this is simply inert; it can't affect any other element or
            // site. Replace with a precise selector once the real markup is
            // available.
            match: ['reddit.com'],
            css: `
                shreddit-subreddit-header,
                [slot="subreddit-header"] {
                    background-color: var(--aura-bg) !important;
                    color: var(--aura-text) !important;
                }
            `
        }
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
    // The app stores the native "Dark Mode" switch at the top level of the
    // theme data, not on a theme (X-5): it's carried onto the resolved
    // theme here, so applyTheme, its key and the cache all see it.
    function resolveTheme(themeData) {
        let theme;
        if (Resolve) {
            theme = Resolve.resolveTheme(themeData, window.location.hostname);
        } else {
            if (!themeData) return null;
            const host = window.location.hostname;
            const siteTheme = themeData.siteThemes && themeData.siteThemes[host];
            theme = siteTheme || resolveTimeBasedTheme(themeData.timeBasedRule) || themeData.globalTheme || null;
        }
        if (!theme || !themeData || themeData.nativeDarkModeEnabled === undefined) return theme;
        return Object.assign({}, theme, { nativeDarkModeEnabled: !!themeData.nativeDarkModeEnabled });
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

        // A hairline that reads on the theme's own background: white-alpha
        // vanishes on a light theme, so light themes get black-alpha.
        const border = isSplit
            ? 'rgba(128, 128, 128, 0.35)'
            : (H && H.isThemeBackgroundLight && H.isThemeBackgroundLight(bgColor))
                ? 'rgba(0, 0, 0, 0.15)'
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
        const probeNot = ':where(:not([data-aura-probe]))';
        // Checkbox/radio/switch and selected controls keep their own state
        // fill; JS maps it (settleStateControls), and restores the parts
        // inside one from the authored-paint probe (a descendant clause
        // here would make every element's match walk its ancestors on
        // every style recalc). Zero specificity, like probeNot.
        const stateNot = ':where(:not([role="checkbox"], [role="radio"], [role="switch"], [aria-checked], [aria-selected="true"]))';
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
                /* Collapsed to flat --aura-bg (no elevation/depth tint): any
                   white/black blend produces a visibly different shade for
                   a colored theme, which reads as inconsistent rather than
                   as intentional depth. Keeping these as distinct tokens
                   (rather than deleting them and rewriting every call site)
                   means every dialog/chrome-bar/composer-pill/authored-
                   surface pass that already reads --aura-surface/-elevated/
                   -overlay now renders perfectly flat, with zero risk of
                   missing a usage site. */
                --aura-surface: var(--aura-bg);
                --aura-elevated: var(--aura-bg);
                --aura-muted: color-mix(in srgb, var(--aura-text) 65%, transparent);
                --aura-border: ${border};
                --aura-overlay: var(--aura-bg);
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


            /* probeNot (zero specificity, so the cascade is unchanged) is on
               every rule that strips or repaints a background:
               readAuthoredPaint sets data-aura-probe to read what the site
               itself painted. */
            :is(${layoutTags})${overlayNot}${probeNot}${stateNot} {
                background-color: transparent !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
            }
            [data-aura-notrans] {
                transition: none !important;
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
            :is(#app, #app-mount, #root, #__next, #__nuxt)${probeNot} {
                background-color: transparent !important;
                background-image: none !important;
            }

            /* [role="tooltip"] included here (and in the matching JS-side
               OVERLAY_SELECTOR in themeHeuristics.js): Tippy/Popper/Floating
               UI-style tooltip bubbles are almost always position:absolute,
               not fixed — unlike an arbitrary absolute div (which the JS
               modal-card path deliberately never paints, since "absolute" is
               too common a position for ordinary promo tiles/carousel
               items), role="tooltip" is an unambiguous, intentional ARIA
               declaration with no equivalent false-positive risk, so it's
               safe to paint on the same unconditional CSS rule as
               dialog/menu/listbox rather than needing the JS pass's
               position-based gating. CSS-level (not JS-pass-only) because
               tooltips are often shown/hidden faster than the ~150ms
               mutation-debounce window, so waiting for the JS pass would
               mean many tooltips flash transparent or never get themed
               before they're gone. */
            dialog${probeNot},
            [popover]${probeNot},
            [role="dialog"]${probeNot},
            [role="alertdialog"]${probeNot},
            [role="menu"]${probeNot},
            [role="listbox"]${probeNot},
            [role="tooltip"]${probeNot},
            [aria-modal="true"]${probeNot} {
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
            [role="tooltip"] *,
            [aria-modal="true"] * {
                mix-blend-mode: normal !important;
                -webkit-text-fill-color: var(--aura-text) !important;
                color: var(--aura-text) !important;
                background-clip: border-box !important;
                -webkit-background-clip: border-box !important;
            }
            /* Buttons inside dialogs/sheets/menus take the theme text
               color from the rule above like everything else; the button
               pass (settleButtons) then sets a readable color against each
               button's own fill. The old 'color: revert' here reverted to
               the user-agent ButtonText, which is light under a forced
               dark color-scheme: light text on light buttons (Reddit's
               "Save"). */
            dialog::backdrop {
                background-color: rgba(0, 0, 0, 0.45) !important;
            }
            dialog a,
            [popover] a,
            [role="dialog"] a,
            [role="alertdialog"] a,
            [role="menu"] a,
            [role="listbox"] a,
            [role="tooltip"] a,
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
            ):not(button):not([role="button"]):not(input):not(select):not(textarea):not(svg):not(img):not([class*="icon" i]):not([class*="Icon"]):not([role="dialog"]):not([role="alertdialog"]):not([role="menu"]):not([role="listbox"]):not([aria-modal="true"]):not(dialog):not([popover])${probeNot} {
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
            /* Excludes text-entry surfaces: those already have their
               background stripped by the input/textarea/select rule below,
               so a forced link-color ring floats around an otherwise-empty
               box with nothing to anchor it — confirmed on reddit.com's
               reply composer as a stray "colored line" appearing exactly
               while focused/typing. Everything else keeps the branded ring
               this rule was written for. */
            :focus-visible:not(input):not(textarea):not(select):not([contenteditable]) {
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

    // Memoized wrapper around getFullStyleSheet() — see styleSheetCacheKey
    // above. `key` must be the caller's current lastAppliedThemeKey (or the
    // freshly-computed equivalent, e.g. applyTheme's local `themeKey` right
    // before it's assigned to lastAppliedThemeKey) so a stale cache entry is
    // never served across a real theme change.
    function getFullStyleSheetCached(theme, key) {
        if (key === styleSheetCacheKey) return styleSheetCacheCss;
        styleSheetCacheCss = getFullStyleSheet(theme);
        styleSheetCacheKey = key;
        return styleSheetCacheCss;
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

    function visitBrightElement(el, vh, vw, modalCardCache) {
        if (!el || el.nodeType !== 1 || !H || overlayModified.has(el) || layerPaints.has(el) || maskPaints.has(el)) return;
        if (el === document.documentElement || el === document.body) return;
        if (el.id === 'aura-core-engine') return;
        // State controls and the parts inside them belong to
        // settleStateControls (their fill is their state).
        if (isStateControlElement(el) || stateControlModified.has(el)
            || (el.closest && el.closest(STATE_CONTROL_SELECTOR))) return;

        let style;
        try { style = getComputedStyle(el); } catch (e) { return; }
        // The only writes below need a background image (the layout-gradient
        // clear) or a light fill: anything else is skipped before the rect,
        // modal-card and search-field reads (Session 8c: most elements).
        const isLight = H.isLightContentSurface || H.isNearWhiteSurface;
        const parsed = H.parseCssRgb(style.backgroundColor);
        if (style.backgroundImage === 'none' && !isLight(parsed)) return;

        let rect;
        try { rect = el.getBoundingClientRect(); } catch (e) { return; }

        const mask = style.webkitMaskImage || style.maskImage;
        const overlayRoot = H.isOverlayRoot(el);
        const floatingBannerRoot = H.isFloatingBannerRoot(el, getComputedStyle, { vh, vw });
        const modalCard = isLikelyModalCardCached(el, modalCardCache, vh, vw);
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

        if (!isLight(parsed)) return;

        // Light themes (Sepia, Paper, Light Mode): Google Images viewer cards
        // are beige/white stacked layers. Clearing them makes Visit/Share/Save
        // and captions overlap. Keep author fills when the page is already light.
        if (H.isThemeBackgroundLight && currentTheme && H.isThemeBackgroundLight(currentTheme.background)) {
            return;
        }

        if (el.style.getPropertyValue('background-color') !== 'transparent') snapNextWrite(el);
        el.style.setProperty('background-color', 'transparent', 'important');
        brightModified.add(el);
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

    function isOverlayCoveringSheet(rect, vh, vw) {
        if (!rect) return false;
        if (H.isFullViewportRect(rect, vh, vw)) return true;
        return !!(H.isCoveringSheetRect && H.isCoveringSheetRect(rect, vh, vw));
    }

    // 3c-bis. LAYER & OVERLAY ENGINE — decide by AUTHORED paint, not geometry.
    // The universal rule strips every layout background before any JS runs,
    // so a plain getComputedStyle can't tell whether the site's own header,
    // tab bar, drawer or cookie card was opaque. readAuthoredPaint asks the
    // cascade directly: every rule that strips or repaints a background is
    // guarded by :where(:not([data-aura-probe])) (zero specificity), so an
    // element carrying data-aura-probe computes the site's own paint again.
    // A batch is flagged, read in one style recalc and unflagged in the same
    // task, so no frame ever renders the probe state. data-aura-* isn't in
    // the observer's attributeFilter, so probing creates no mutation records.
    // data-aura-notrans holds transitions off until the next frame so
    // neither flip animates. Aura's own inline writes on a probed element
    // are lifted for the read and put back after it.
    //
    // Results are cached per element, keyed by className. A class or style
    // mutation inside a tracked root marks the root dirty (markDirtyLayerRoots),
    // which forces a fresh read for its whole subtree on the next evaluation.
    const authoredPaintCache = new WeakMap(); // el -> { key, paint }
    // The site's own inline background/color, saved before the engine's
    // first write on an element so a release (or a probe) can restore it.
    const siteInlinePaint = new WeakMap();
    const LAYER_INLINE_PROPS = ['background-color', 'background-image', 'color'];
    let notransPending = [];
    let notransRaf = 0;

    function probeKey(el) {
        if (typeof el.className === 'string') return el.className;
        try { return el.getAttribute('class') || ''; } catch (e) { return ''; }
    }

    // Other passes' inline background writes (all !important) hide the
    // authored value from a probe too, so they're lifted for the read.
    function auraWroteInlineBg(el) {
        return overlayModified.has(el) || brightModified.has(el) || shellModified.has(el)
            || chromeModified.has(el) || chromeAuthoredModified.has(el)
            || askAnythingModified.has(el) || googleAiChatModified.has(el)
            || inlineHighlightModified.has(el) || maskPaints.has(el) || buttonFillKept.has(el)
            || fadePaints.has(el);
    }

    // The write about to happen on el lands at once instead of animating
    // through the site's own transitions (`transition: all .1s` on
    // Walmart's tiles, `color .15s` on its text): an Aura fix fading in
    // late reads as a flash (X-11). Transitions return next frame.
    function snapNextWrite(el) {
        if (el.hasAttribute('data-aura-notrans')) return;
        el.setAttribute('data-aura-notrans', '');
        notransPending.push(el);
        if (!notransRaf) notransRaf = requestAnimationFrame(clearNotrans);
    }

    function clearNotrans() {
        notransRaf = 0;
        const list = notransPending;
        notransPending = [];
        for (let i = 0; i < list.length; i++) {
            try { list[i].removeAttribute('data-aura-notrans'); } catch (e) {}
        }
    }

    // Authored { bg, backdrop } per element of `els` (null if unreadable).
    function readAuthoredPaint(els, force) {
        const out = new Array(els.length);
        const todo = [];
        for (let i = 0; i < els.length; i++) {
            const c = force ? null : authoredPaintCache.get(els[i]);
            if (c && c.key === probeKey(els[i])) out[i] = c.paint;
            else todo.push(i);
        }
        if (!todo.length) return out;
        const lifted = [];
        for (let t = 0; t < todo.length; t++) {
            const el = els[todo[t]];
            if (layerPaints.has(el)) {
                lifted.push([el, null]);
                restoreSiteInline(el);
            } else if (auraWroteInlineBg(el)) {
                const saved = LAYER_INLINE_PROPS.slice(0, 2).map(p => [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]);
                lifted.push([el, saved]);
                saved.forEach(([p]) => el.style.removeProperty(p));
            }
            el.setAttribute('data-aura-notrans', '');
            el.setAttribute('data-aura-probe', '');
        }
        for (let t = 0; t < todo.length; t++) {
            const el = els[todo[t]];
            let paint = null;
            try {
                const cs = getComputedStyle(el);
                paint = {
                    bg: cs.backgroundColor,
                    backdrop: cs.webkitBackdropFilter || cs.backdropFilter || 'none',
                    img: cs.backgroundImage,
                    opacity: cs.opacity,
                };
            } catch (e) {}
            out[todo[t]] = paint;
            authoredPaintCache.set(el, { key: probeKey(el), paint });
        }
        for (let t = 0; t < todo.length; t++) {
            const el = els[todo[t]];
            el.removeAttribute('data-aura-probe');
            notransPending.push(el);
        }
        for (let l = 0; l < lifted.length; l++) {
            const [el, saved] = lifted[l];
            if (saved) saved.forEach(([p, v, prio]) => { if (v) el.style.setProperty(p, v, prio); });
            else applyLayerPaint(el, layerPaints.get(el));
        }
        if (!notransRaf) notransRaf = requestAnimationFrame(clearNotrans);
        return out;
    }

    function restoreSiteInline(el) {
        const saved = siteInlinePaint.get(el);
        LAYER_INLINE_PROPS.forEach((p, i) => {
            const s = saved && saved[i];
            if (s && s[1]) el.style.setProperty(p, s[1], s[2]);
            else el.style.removeProperty(p);
        });
    }

    function applyLayerPaint(el, rec) {
        const st = el.style;
        // The layer rule owns this surface: an inline-highlight write
        // (text pinned dark against the authored white) would leave dark
        // text on the theme fill (Session 8, a white share disc on a photo).
        if (rec.opaque && inlineHighlightModified.has(el)) revertInlineHighlightElement(el);
        if (st.getPropertyValue('background-color') !== rec.bg || st.getPropertyPriority('background-color') !== 'important') {
            snapNextWrite(el);
            st.setProperty('background-color', rec.bg, 'important');
        }
        // A gradient-painted surface: the gradient in the theme color.
        if (rec.img && (st.getPropertyValue('background-image') !== rec.img || st.getPropertyPriority('background-image') !== 'important')) {
            st.setProperty('background-image', rec.img, 'important');
        }
        // Same icon/text legibility pairing as paintOverlaySheet: an opaque
        // theme surface gets the theme text color.
        if (rec.opaque && st.getPropertyValue('color') !== 'var(--aura-text)') {
            st.setProperty('color', 'var(--aura-text)', 'important');
        }
    }

    function writeLayerPaint(el, entry, root, bg, opaque, img) {
        let rec = layerPaints.get(el);
        if (!rec) {
            if (!siteInlinePaint.has(el)) {
                // Another pass's inline write isn't the site's paint.
                const ours = auraWroteInlineBg(el);
                siteInlinePaint.set(el, LAYER_INLINE_PROPS.map(p => (ours && p !== 'color')
                    ? [p, '', '']
                    : [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]));
            }
            rec = { root: null, bg: '', opaque: false, img: '' };
            layerPaints.set(el, rec);
        }
        if (rec.root !== root) {
            const prev = rec.root && layerRoots.get(rec.root);
            if (prev) prev.painted.delete(el);
            rec.root = root;
            entry.painted.add(el);
        }
        if (rec.opaque && !opaque) {
            const saved = siteInlinePaint.get(el);
            const c = saved && saved[2];
            if (c && c[1]) el.style.setProperty('color', c[1], c[2]);
            else el.style.removeProperty('color');
        }
        if (rec.img && !img) {
            const saved = siteInlinePaint.get(el);
            const b = saved && saved[1];
            if (b && b[1]) el.style.setProperty('background-image', b[1], b[2]);
            else el.style.removeProperty('background-image');
        }
        rec.bg = bg;
        rec.opaque = opaque;
        rec.img = img || '';
        applyLayerPaint(el, rec);
        // Store the browser's serialization so the style-rewrite check in
        // the observer compares like with like.
        rec.bg = el.style.getPropertyValue('background-color');
        if (rec.img) rec.img = el.style.getPropertyValue('background-image');
    }

    function releaseLayerPaint(el) {
        const rec = layerPaints.get(el);
        if (!rec) return;
        try { restoreSiteInline(el); } catch (e) {}
        const entry = rec.root && layerRoots.get(rec.root);
        if (entry) entry.painted.delete(el);
        layerPaints.delete(el);
    }

    // source: only release roots registered by that path (null = any).
    function releaseLayerRoot(root, source) {
        const entry = layerRoots.get(root);
        if (!entry || (source && entry.source !== source)) return;
        Array.from(entry.painted).forEach(releaseLayerPaint);
        layerRoots.delete(root);
    }

    // Root plus the descendants worth judging: depth-limited, wide enough
    // relative to the root (narrow children are buttons/pills/icons, not
    // the layer's surface), not a control or media element, and not itself
    // fixed/sticky (that one is its own root). A custom element's open
    // shadow root is descended too: Reddit's sticky bars are hosts with no
    // paint of their own whose surface is a plain div inside the shadow
    // root. A node this root already painted stays a candidate regardless
    // of width, so a transient reflow can't drop and re-add its paint.
    const LAYER_MAX_DEPTH = { layer: 3, overlay: 6 };
    const LAYER_MIN_WIDTH_FRAC = { layer: 0.4, overlay: 0.3 };
    const LAYER_MAX_NODES = 48;

    function collectLayerCandidates(root, mode) {
        const nodes = [root];
        const parent = [-1];
        let rootWidth = 0;
        try { rootWidth = root.getBoundingClientRect().width; } catch (e) {}
        const minWidth = Math.max(1, rootWidth * LAYER_MIN_WIDTH_FRAC[mode]);
        let level = [0];
        for (let depth = 1; depth <= LAYER_MAX_DEPTH[mode] && level.length; depth++) {
            const next = [];
            for (let li = 0; li < level.length && nodes.length < LAYER_MAX_NODES; li++) {
                const node = nodes[level[li]];
                const kids = node.shadowRoot
                    ? [...node.shadowRoot.children, ...node.children]
                    : node.children;
                for (let k = 0; kids && k < kids.length && nodes.length < LAYER_MAX_NODES; k++) {
                    const kid = kids[k];
                    if (H.BRIGHT_SKIP_TAGS && H.BRIGHT_SKIP_TAGS[kid.tagName]) continue;
                    const rec = layerPaints.get(kid);
                    if (!(rec && rec.root === root)) {
                        let r;
                        try { r = kid.getBoundingClientRect(); } catch (e) { continue; }
                        if (r.width < minWidth || r.height < 1) continue;
                        let pos = '';
                        try { pos = getComputedStyle(kid).position; } catch (e) { continue; }
                        if (pos === 'fixed' || pos === 'sticky') continue;
                    }
                    nodes.push(kid);
                    parent.push(level[li]);
                    next.push(nodes.length - 1);
                }
            }
            level = next;
        }
        return { nodes, parent };
    }

    // The rule itself. mode 'layer' (fixed/sticky bars, sidebars): paint the
    // first authored-opaque node per branch --aura-bg and stop descending
    // there; never paint an authored-transparent node. mode 'overlay'
    // (drawers, modals, cookie sheets): same, with --aura-overlay for the
    // card, plus a dark translucent backdrop keeps its authored scrim
    // color. An authored-transparent wrapper is left alone and descended
    // through. Evaluated at most once per pass per root.
    function evaluateAuthoredLayer(root, mode, source) {
        if (!root || root.nodeType !== 1 || !H || !H.classifyAuthoredPaint) return;
        let entry = layerRoots.get(root);
        if (entry && entry.pass === pendingRevertReading && entry.mode === mode) return;
        if (!entry) {
            entry = { mode, source, pass: 0, dirty: false, painted: new Set() };
            layerRoots.set(root, entry);
        }
        entry.mode = mode;
        entry.source = source;
        entry.pass = pendingRevertReading;
        const force = entry.dirty;
        entry.dirty = false;

        // An authored-opaque root covers everything under it: no need to
        // walk or probe its descendants.
        const rootPaint = readAuthoredPaint([root], force)[0];
        let rootCovering = false;
        if (mode === 'overlay') {
            const { vh, vw } = passViewport();
            try { rootCovering = isOverlayCoveringSheet(root.getBoundingClientRect(), vh, vw); } catch (e) {}
        }
        const rootOpaque = H.classifyAuthoredPaint(rootPaint, mode, rootCovering) === 'opaque';
        const { nodes, parent } = rootOpaque ? { nodes: [root], parent: [-1] } : collectLayerCandidates(root, mode);
        const paints = [rootPaint].concat(nodes.length > 1 ? readAuthoredPaint(nodes.slice(1), force) : []);
        const token = mode === 'overlay' ? 'var(--aura-overlay)' : 'var(--aura-bg)';
        const covered = new Array(nodes.length);
        const wanted = new Map();
        let anyOpaque = false;
        for (let i = 0; i < nodes.length; i++) {
            if (parent[i] >= 0 && covered[parent[i]]) { covered[i] = true; continue; }
            const verdict = H.classifyAuthoredPaint(paints[i], mode, i === 0 && rootCovering);
            // A gradient the site painted (with or without a color under
            // it) is repainted in the theme color, so a white band or edge
            // fade doesn't stay white over a themed surface.
            const img = (verdict === 'opaque' || verdict === 'fade') && paints[i]
                ? H.themeGradient(paints[i].img, token) : null;
            if (verdict === 'opaque') {
                wanted.set(nodes[i], [token, true, img]);
                covered[i] = true;
                anyOpaque = true;
            } else if (verdict === 'fade' && img) {
                wanted.set(nodes[i], ['transparent', false, img]);
            } else if (verdict === 'scrim') {
                wanted.set(nodes[i], [paints[i].bg, false]);
            }
        }
        // A covering ARIA overlay is painted by the static OVERLAY_SELECTOR
        // rule, so "leave the wrapper alone" means writing transparent.
        // Fallback kept from the old path: an ARIA overlay with no
        // authored-opaque surface anywhere (e.g. a date-picker grid of plain
        // cells) keeps the static paint rather than floating its content
        // over the page.
        if (source === 'aria' && !wanted.has(root)) {
            if (anyOpaque) wanted.set(root, ['transparent', false]);
            else wanted.set(root, [token, true]);
        }
        if (mode === 'overlay' && anyOpaque) addOverlayNubs(nodes, paints, wanted, token);
        Array.from(entry.painted).forEach(el => { if (!wanted.has(el)) releaseLayerPaint(el); });
        wanted.forEach(([bg, opaque, img], el) => writeLayerPaint(el, entry, root, bg, opaque, img));
        // Small-surface roots (icon controls, popovers) are re-found by
        // every pass's walk, so one that painted nothing isn't tracked for
        // scroll re-checks.
        if (SMALL_SURFACE_SOURCES[source] && !entry.painted.size) layerRoots.delete(root);
    }

    const SMALL_SURFACE_SOURCES = { icon: 1, popover: 1 };

    // A tooltip/popover arrow is a small absolutely positioned child
    // (usually a rotated square) painted the card's own color. It's far
    // narrower than the card, so it's never a layer candidate, and a white
    // nub would be left on a theme-painted card. Same authored color as
    // the card it sits on = part of that surface: paint it with the card.
    const NUB_MAX_SIZE = 24;
    function addOverlayNubs(nodes, paints, wanted, token) {
        const nubs = [];
        const cardBg = [];
        for (let i = 0; i < nodes.length; i++) {
            const w = wanted.get(nodes[i]);
            if (!w || !w[1]) continue;
            const kids = nodes[i].children;
            for (let k = 0; kids && k < kids.length && nubs.length < 16; k++) {
                const kid = kids[k];
                if (wanted.has(kid) || (H.BRIGHT_SKIP_TAGS && H.BRIGHT_SKIP_TAGS[kid.tagName])) continue;
                if (kid.childElementCount || String(kid.textContent || '').trim()) continue;
                let r, pos;
                try { r = kid.getBoundingClientRect(); pos = getComputedStyle(kid).position; } catch (e) { continue; }
                if (pos !== 'absolute' || r.width < 1 || r.height < 1 || r.width > NUB_MAX_SIZE || r.height > NUB_MAX_SIZE) continue;
                nubs.push(kid);
                cardBg.push(paints[i] && paints[i].bg);
            }
        }
        if (!nubs.length) return;
        const nubPaints = readAuthoredPaint(nubs);
        for (let n = 0; n < nubs.length; n++) {
            if (nubPaints[n] && nubPaints[n].bg === cardBg[n]) wanted.set(nubs[n], [token, true]);
        }
    }

    // Overlay entry point shared by reopaqueOverlays, visitOverlayModalWalk
    // and visitStickyElement. Google Images' viewer is a full-screen second
    // page, not a cookie scrim: it stays opaque (see paintGoogleImagesSheet).
    function paintAuthoredOverlay(el, source) {
        if (isGoogleImagesPage()) {
            paintGoogleImagesSheet(el);
            return;
        }
        evaluateAuthoredLayer(el, 'overlay', source);
    }

    // Persistence. A class/style mutation inside a tracked root forces a
    // fresh probe for that root; any mutation inside one re-evaluates it
    // (new nodes, a late donate banner) even when the pass is scoped below
    // it. Returns the touched roots.
    function markDirtyLayerRoots(records) {
        const touched = new Set();
        if (!layerRoots.size) return touched;
        const seen = new Set();
        for (let i = 0; i < records.length; i++) {
            const rec = records[i];
            const dirty = rec.type === 'attributes' && (rec.attributeName === 'class' || rec.attributeName === 'style');
            let node = rec.target;
            for (let d = 0; node && d < 40; d++) {
                const key = dirty ? node : null;
                if (key && seen.has(key)) break;
                if (key) seen.add(key);
                const entry = layerRoots.get(node);
                if (entry) {
                    touched.add(node);
                    if (dirty) entry.dirty = true;
                }
                node = node.parentNode || node.host;
            }
        }
        return touched;
    }

    // Re-check tracked roots only (scroll, resize, mutations inside a root):
    // cached probes, so this is a handful of rect reads and no-op writes.
    function recheckLayerRoots(roots) {
        const { vh, vw } = passViewport();
        roots.forEach(root => {
            const entry = layerRoots.get(root);
            if (!entry) return;
            if (!root.isConnected) {
                releaseLayerRoot(root);
                return;
            }
            if (entry.source === 'sticky') visitStickyElement(root, vh, vw);
            else evaluateAuthoredLayer(root, entry.mode, entry.source);
        });
    }

    // The site rewrote `style` on an element we painted (React style props,
    // animation libraries): its inline paint is the new authored value, so
    // save it, put ours back right away (no transparent frame), and have
    // the root re-probe on the next pass.
    function repairRewrittenLayerPaints(records) {
        let repaired = false;
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            if (r.type !== 'attributes' || r.attributeName !== 'style') continue;
            const el = r.target;
            const rec = layerPaints.get(el);
            if (!rec || el.style.getPropertyValue('background-color') === rec.bg) continue;
            siteInlinePaint.set(el, LAYER_INLINE_PROPS.map(p => [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]));
            const entry = layerRoots.get(rec.root);
            if (entry) entry.dirty = true;
            applyLayerPaint(el, rec);
            repaired = true;
        }
        if (repaired) discardOwnMutationRecords();
    }

    // isLikelyModalCard is independently recomputed up to 4x per element per
    // runSafetyPasses invocation (here, plus visitOverlayModalWalk,
    // visitBrightElement, visitStickyElement) — each call redoes
    // modalCardInfoFromElement's el.textContent subtree serialization plus
    // 2 querySelector subtree scans, the single most expensive per-element
    // check in the engine. Nothing mutates `el` between these calls within
    // one invocation, so the result is safe to memoize per element for the
    // lifetime of one cache (created fresh each runSafetyPasses call, same
    // pattern as effectiveBgCache). `cache` is optional — falls back to
    // uncached behavior for call sites that don't have one (shadowRootSteps'
    // shadow-root sweep, the scroll-triggered layer re-check).
    function isLikelyModalCardCached(el, cache, vh, vw) {
        if (!H || !H.isLikelyModalCard) return false;
        if (!cache) return !!H.isLikelyModalCard(el, getComputedStyle, { vh, vw });
        if (cache.has(el)) return cache.get(el);
        const result = !!H.isLikelyModalCard(el, getComputedStyle, { vh, vw });
        cache.set(el, result);
        return result;
    }

    function reopaqueOverlays(root) {
        if (!root || !currentTheme || !H) return;

        const { vh, vw } = passViewport();
        const seen = new Set();
        // ShadowRoot (nodeType 11) implements the same ParentNode interface
        // as Element, so scope.querySelectorAll(...) below works identically
        // when scope is a shadow root — see the identical fix already made
        // for reopaqueTopChrome's scope resolution.
        const scope = (root.nodeType === 1 || root.nodeType === 11) ? root : document.documentElement;
        const candidates = [];

        try {
            const listed = scope.querySelectorAll(
                (H && H.OVERLAY_SELECTOR) ||
                'dialog, [popover], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="tooltip"], [aria-modal="true"]'
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

            // A covering ARIA overlay is backdrop + card: decide each by
            // authored paint. A smaller one (menu, listbox, popover) keeps
            // the flat --aura-overlay sheet: its own surface is very often
            // an unstyled wrapper inside the site's real popup box, which
            // isn't part of this root.
            if (isOverlayCoveringSheet(rect, vh, vw)) {
                paintAuthoredOverlay(el, 'aria');
                return;
            }
            if (layerRoots.has(el)) releaseLayerRoot(el);

            paintOverlaySheet(el);
        }

        candidates.forEach(consider);
    }

    function visitOverlayModalWalk(el, vh, vw, seen, modalCardCache) {
        if (!el || el.nodeType !== 1 || !H || seen.has(el)) return;
        if (isAdThemingSkipped(el)) {
            releaseLayerRoot(el, 'overlay');
            return;
        }
        if (H.isAmpOverlayChrome && H.isAmpOverlayChrome(el)) {
            releaseLayerRoot(el, 'overlay');
            return;
        }
        let style;
        try { style = getComputedStyle(el); } catch (e) { return; }
        const pinned = style.position === 'fixed' || style.position === 'sticky';
        if (style.visibility === 'hidden' || style.opacity === '0' || style.display === 'none') return;
        // Nav drawers (hamburger menus) go through the overlay rule even at
        // overlay-tier z-index (the modal-card veto below). Classification
        // is gated to fixed/sticky elements: a drawer is one by definition
        // (isLikelyNavDrawerInfo requires it), and navSignalsFromElement's
        // subtree link query was O(n²) when run for every element. No
        // collapsed -> expanded transition gate any more: it stopped
        // ambient link rows (store.hypixel.net's hero) from being painted
        // on shape alone, and the authored-paint rule now leaves anything
        // the site didn't paint opaque untouched. wtatennis.com stays
        // excluded via isChromeRepaintDisabledForHost.
        if (pinned && H.classifyNavDrawerState && !isChromeRepaintDisabledForHost()
            && H.classifyNavDrawerState(el, getComputedStyle, { vh, vw }) === 'expanded') {
            seen.add(el);
            paintAuthoredOverlay(el, 'overlay');
            return;
        }
        // Non-ARIA, position:fixed covering sheet: a custom modal, cookie
        // sheet or drawer (truthfinder.com's .modal-container, a Shopify
        // cart drawer, Airbnb's cookie card). reopaqueOverlays only sees
        // ARIA roles, so route it through the overlay rule here: backdrop
        // keeps its authored scrim, the authored-opaque card is painted,
        // transparent wrappers are left alone. Gated on !isOverlayChrome so
        // this never double-handles an element reopaqueOverlays owns.
        if (style.position === 'fixed' && !H.isOverlayChrome(el)) {
            let fixedRect;
            try { fixedRect = el.getBoundingClientRect(); } catch (eRect) { fixedRect = null; }
            if (fixedRect && fixedRect.width >= 1 && fixedRect.height >= 1
                && isOverlayCoveringSheet(fixedRect, vh, vw)) {
                seen.add(el);
                paintAuthoredOverlay(el, 'overlay');
                return;
            }
        }
        if (isLikelyModalCardCached(el, modalCardCache, vh, vw)) {
            seen.add(el);
            if (H.isSearchChrome && H.isSearchChrome(el)) return;
            // Overlay-tier cards (z-index >= 1000: Google's app-promo
            // bottom sheet, Wikipedia's fundraising banner) go through the
            // authored-paint rule like any other card; until Session 7
            // they were all skipped as the fox5sandiego.com curtain class.
            // A curtain is a transparent wrapper, which the rule leaves
            // alone; fox5's own shells stay skipped by host.
            if (isChromePaintHostSkipped(el)) {
                releaseLayerRoot(el, 'overlay');
                return;
            }
            let rect;
            try { rect = el.getBoundingClientRect(); } catch (e) { return; }
            if (rect.width < 1 || rect.height < 1) return;
            paintAuthoredOverlay(el, 'overlay');
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
    function setGoogleImagesViewerOpen(open) {
        const html = document.documentElement;
        if (!html || html.hasAttribute('data-aura-gimg-viewer') === open) return;
        if (open) html.setAttribute('data-aura-gimg-viewer', '');
        else html.removeAttribute('data-aura-gimg-viewer');
    }

    function paintGoogleImagesViewer(root) {
        revertGoogleImagesMosaic();
        if (!isGoogleImagesPage() || !H) { setGoogleImagesViewerOpen(false); return; }

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
        setGoogleImagesViewerOpen(covers.size > 0);
    }

    // 3d. STICKY/FIXED LAYERS
    // The universal transparency rule strips backgrounds off sticky/fixed
    // headers and bars, so page content would scroll through them. CSS
    // can't select by computed position, so visitStickyElement hands every
    // fixed/sticky element to the authored-paint rule (section 3c-bis).
    // Curtains (fox5sandiego.com / usopen.com-class CMP wrappers) stay
    // unpainted because their authored paint is transparent, not because
    // of their size.
    // H.isInsideAdSurface, with each node's own verdict cached (Session 8c:
    // the walk asked this for every element from several visitors, each a
    // dozen regexes on 8 ancestors). The cache is keyed on the strings the
    // verdict reads, so a class/id/aria change is a fresh read.
    const adSelfCache = new WeakMap(); // node -> [key, isAd]
    function isAdSurfaceSelf(node) {
        const info = H.adSurfaceInfoFromElement(node);
        if (!info) return false;
        const key = info.className + '|' + (info.id || '') + '|' + (info.ariaLabel || '') + '|' + (info.ariaRoledescription || '') + '|' + info.tag;
        const hit = adSelfCache.get(node);
        if (hit && hit[0] === key) return hit[1];
        const v = !!H.isLikelyAdSurfaceInfo(info);
        adSelfCache.set(node, [key, v]);
        return v;
    }

    function isAdThemingSkipped(el) {
        if (!el || !H) return false;
        try {
            if (H.adSurfaceInfoFromElement && H.isLikelyAdSurfaceInfo) {
                // Same walk as H.isInsideAdSurface: el and up to 7
                // ancestors, stopping at <html>.
                const root = document.documentElement;
                for (let node = el, depth = 0; node && node.nodeType === 1 && node !== root && depth < 8; node = node.parentElement, depth++) {
                    if (isAdSurfaceSelf(node)) return true;
                }
                return false;
            }
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
    // while later sections scroll up over it. Both visitStickyElement
    // (generic sticky layer rule) AND reopaqueTopChrome (which treats any
    // semantic <header>/<nav> near the top as chrome, regardless of nav
    // signal, since the UC Davis relaxation) paint it opaque independently —
    // it has to be excluded from both. Painting it opaque produces exactly
    // the reported bug: page looks fine, then gets curtained by the theme
    // color, with content only flashing through while actively scrolling.
    const CHROME_PAINT_HOST_SKIPS = [
        {
            match: ['wtatennis.com'],
            selectors: ['.page-hero', '[data-widget*="sticky-page-hero"]']
        },
        {
            // fox5sandiego.com (X-2): the overlay-tier shells its SITE_FIXES
            // entry keeps transparent. Before Session 7 every z-index >=
            // 1000 modal card was skipped; these stay skipped by host.
            match: ['fox5sandiego.com'],
            selectors: [
                '#onesignal-slidedown-container', '.onesignal-slidedown-container',
                '#onetrust-consent-sdk', '#onetrust-consent-sdk *',
                '.login-registration-modal', '.nexstar-video.video-float',
                'aside.ad-unit--adhesion', 'amp-consent', 'amp-sticky-ad',
                '.popupOverlay', '.consentPopup', '#myConsentFlow'
            ]
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
    // This host-disable is checked in FOUR places: the scroll/resize layer
    // re-check (formerly reopaqueStickyFixed), reopaqueTopChrome,
    // restoreAuthoredChromeOpacity, and the nav-drawer branch in
    // visitOverlayModalWalk.
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

    // Builds the info object stickySkipReason reads. Shared by
    // visitStickyElement and the debug inspector so the HUD shows exactly
    // what the engine saw. Only identity/visibility facts: whether a layer
    // gets painted is the authored-paint rule's call (section 3c-bis), not
    // its size, z-index or how much of it its children cover.
    function stickyInfoFor(el, style, rect, vh, vw) {
        const mask = style.webkitMaskImage || style.maskImage;
        return {
            position: style.position,
            mask: mask || 'none',
            visibility: style.visibility,
            opacity: style.opacity,
            // A sticky bar inside an overlay scrolls over the overlay's own
            // content (Urban Plates' category header in its open, non-modal
            // <dialog>, U-1): the overlay's paint doesn't cover it, so it's
            // judged as a layer. Only the overlay root itself is the static
            // overlay rule's.
            overlayChrome: style.position === 'sticky' && H.isOverlayRoot ? H.isOverlayRoot(el) : H.isOverlayChrome(el),
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
        };
    }

    // Every fixed/sticky layer: a covering sheet (drawer, cookie sheet,
    // full-screen menu) goes through the overlay rule, anything else
    // (header, toolbar, tab bar, search bar, sidebar) through the layer
    // rule. Both paint only what the site painted opaque.
    function visitStickyElement(el, vh, vw, modalCardCache) {
        if (!el || el.nodeType !== 1 || !H) return;
        let style;
        try { style = getComputedStyle(el); } catch (e) { return; }
        if (style.position !== 'fixed' && style.position !== 'sticky') {
            releaseLayerRoot(el, 'sticky');
            return;
        }
        if (isAdThemingSkipped(el) || isChromePaintHostSkipped(el)
            || (H.isAmpOverlayChrome && H.isAmpOverlayChrome(el))) {
            releaseLayerRoot(el, 'sticky');
            return;
        }
        // Modal cards are the overlay walk's (same rule, overlay mode).
        if (isLikelyModalCardCached(el, modalCardCache, vh, vw)) return;
        let rect;
        try { rect = el.getBoundingClientRect(); } catch (e) { return; }
        if (H.stickySkipReason(stickyInfoFor(el, style, rect, vh, vw))) {
            releaseLayerRoot(el, 'sticky');
            return;
        }
        const covering = style.position === 'fixed' && isOverlayCoveringSheet(rect, vh, vw);
        if (covering && isGoogleImagesPage()) {
            paintGoogleImagesSheet(el);
            return;
        }
        evaluateAuthoredLayer(el, covering ? 'overlay' : 'layer', 'sticky');
    }

    // Debug-only (HUD inspect): which layer/overlay rule applies to `el` and
    // why. Never called by the engine itself.
    function explainLayer(el) {
        const out = {};
        if (!el || el.nodeType !== 1 || !H) return out;
        const { vh, vw } = passViewport();
        let style, rect;
        try { style = getComputedStyle(el); rect = el.getBoundingClientRect(); } catch (e) { return out; }
        try { out.modalCard = !!isLikelyModalCardCached(el, null, vh, vw); } catch (e) {}
        out.coveringSheet = isOverlayCoveringSheet(rect, vh, vw);
        out.overlayRoot = !!H.isOverlayRoot(el);
        out.overlayChrome = !!H.isOverlayChrome(el);
        out.adSkipped = isAdThemingSkipped(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
            try { out.stickySkip = H.stickySkipReason(stickyInfoFor(el, style, rect, vh, vw)) || 'none (rule applies)'; } catch (e) {}
        }
        try {
            const paint = readAuthoredPaint([el], true)[0];
            out.authoredLayer = H.classifyAuthoredPaint(paint, out.coveringSheet ? 'overlay' : 'layer');
        } catch (e) {}
        const entry = layerRoots.get(el);
        if (entry) out.layerRoot = entry.mode + '/' + entry.source + ', painted ' + entry.painted.size;
        const rec = layerPaints.get(el);
        if (rec) out.layerPaint = rec.bg;
        if (H.classifyNavDrawerState && (style.position === 'fixed' || style.position === 'sticky')) {
            try { out.navDrawer = H.classifyNavDrawerState(el, getComputedStyle, { vh, vw }); } catch (e) {}
        }
        return out;
    }

    // 3d-bis. SMALL SURFACES — floating icon controls and positioned
    // popovers, through the same authored-paint rule (overlay mode).
    //
    // Small icon-only controls (close/share/kebab-menu) pinned via
    // position:fixed/absolute to float over media — a product photo, a map
    // — often carry their own translucent scrim so the icon stays legible
    // (Google Shopping's item-photo share/kebab-menu/close cluster). The
    // shape alone doesn't say whether the site painted one: Airbnb's
    // category chips match it with a transparent 28x28 span around an
    // emoji <video>, and a chat launcher's square wrapper matches it around
    // a round button. So the shape only nominates; the rule decides: a
    // dark scrim keeps its authored color, an opaque fill becomes
    // --aura-overlay, a transparent element is never painted (its opaque
    // child, e.g. the round button, is). A fixed/sticky element the layer
    // rule already owns is left to it.
    function visitFloatingIconControlElement(el, vh, vw, out) {
        if (!el || el.nodeType !== 1 || !H || !H.isLikelyFloatingIconControl) return;
        const entry = layerRoots.get(el);
        if (entry && entry.source !== 'icon') return;
        if (layerPaints.has(el) && !entry) return;
        // The shape test first: it rejects nearly every element on cheap
        // style reads (Session 8c).
        if (H.isLikelyFloatingIconControl(el, getComputedStyle, { vh, vw })
            && !isChromeRepaintDisabledForHost() && !isAdThemingSkipped(el)) {
            out.push(el);
            return;
        }
        if (entry) releaseLayerRoot(el, 'icon');
    }

    // Positioned popovers with no ARIA role (Walmart's "Spanish/Español
    // now available" tooltip): position:absolute with an explicit z-index,
    // so it stacks over the page, but not fixed, not a covering sheet and
    // not a modal card, so no other overlay path sees it. The shape only
    // nominates (size-bounded, cheap reads the walk already makes); the
    // site's own paint decides, so an absolute caption or badge row the
    // site left transparent stays transparent.
    const POPOVER_MIN_WIDTH = 40;
    const POPOVER_MIN_HEIGHT = 24;
    function visitPopoverElement(el, vh, vw, out) {
        if (!el || el.nodeType !== 1 || !H) return;
        const entry = layerRoots.get(el);
        if (entry && entry.source !== 'popover') return;
        let style;
        try { style = getComputedStyle(el); } catch (e) { return; }
        let nominated = style.position === 'absolute'
            && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
            && !(H.BRIGHT_SKIP_TAGS && H.BRIGHT_SKIP_TAGS[el.tagName])
            && !H.isOverlayChrome(el) && !(H.isSearchChrome && H.isSearchChrome(el))
            && !(layerPaints.has(el) && !entry) && !isAdThemingSkipped(el);
        let rect = null;
        if (nominated) {
            try { rect = el.getBoundingClientRect(); } catch (e) { rect = null; }
            nominated = !!rect && rect.width >= POPOVER_MIN_WIDTH && rect.height >= POPOVER_MIN_HEIGHT
                && !isOverlayCoveringSheet(rect, vh, vw);
        }
        // No z-index (Walmart's "Spanish / Español" and country popups,
        // X-12: an absolute layer hung off a 48 px anchor): still stacked
        // over the page. What sets a popup apart from a badge or an icon
        // laid over its own box is that it hangs out of its anchor.
        // A layer laid over a photo (Airbnb's listing photos, A-5: the
        // "Guest favorite" pill, frosted white, in a transparent absolute
        // layer the size of the photo) is the same kind of surface.
        if (nominated && style.zIndex === 'auto') {
            nominated = hangsOutOfAnchor(el, rect) || laidOverMedia(el, rect);
            if (nominated) hangingPopovers.add(el);
        }
        if (nominated) out.push(el);
        else if (entry) releaseLayerRoot(el, 'popover');
    }

    // Hung-off popups are often a transparent positioning wrapper around
    // the painted card, so their roots are evaluated even when clear.
    const hangingPopovers = new WeakSet();
    const POPOVER_HANG_MIN_PX = 16;
    function laidOverMedia(el, rect) {
        const anchor = el.offsetParent;
        if (!anchor || anchor === document.body || anchor === document.documentElement) return false;
        let media = null;
        try { media = anchor.querySelector('img, picture, video'); } catch (e) { return false; }
        if (!media || el.contains(media)) return false;
        let m;
        try { m = media.getBoundingClientRect(); } catch (e) { return false; }
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        return cx >= m.left && cx <= m.right && cy >= m.top && cy <= m.bottom;
    }
    function hangsOutOfAnchor(el, rect) {
        const anchor = el.offsetParent;
        if (!anchor || anchor === document.body || anchor === document.documentElement) return false;
        let a;
        try { a = anchor.getBoundingClientRect(); } catch (e) { return false; }
        return rect.bottom - a.bottom >= POPOVER_HANG_MIN_PX || a.top - rect.top >= POPOVER_HANG_MIN_PX
            || rect.right - a.right >= POPOVER_HANG_MIN_PX || a.left - rect.left >= POPOVER_HANG_MIN_PX;
    }

    // Steps that settle what the walk nominated: one batched probe for all
    // of them (one style recalc), then the rule per element, sliced.
    function smallSurfaceSteps(icons, popovers) {
        return [
            () => { if (icons.length || popovers.length) readAuthoredPaint(icons.concat(popovers)); },
            { items: icons, visit: el => evaluateAuthoredLayer(el, 'overlay', 'icon') },
            {
                items: popovers,
                visit: function (el) {
                    const v = H.classifyAuthoredPaint(readAuthoredPaint([el])[0], 'overlay');
                    if (v === 'clear' && !hangingPopovers.has(el)) releaseLayerRoot(el, 'popover');
                    else evaluateAuthoredLayer(el, 'overlay', 'popover');
                },
            },
        ];
    }

    // Google-only: clear dark Ask-anything pill shells that CSS :has misses.
    // Walk ancestors of the Ask field and empty previous siblings with an
    // opaque fill (decorative chip layers). Never paint --aura-bg / surface.
    function clearAskAnythingFill(el) {
        if (!el || el.nodeType !== 1) return;
        let position = '';
        try { position = getComputedStyle(el).position; } catch (e) {}
        if (position === 'fixed' || position === 'sticky') {
            // A fixed/sticky composer bar renders in its own layer over
            // independently-scrolling content — transparent here reveals
            // whatever's genuinely rendered underneath (confirmed via
            // device screenshot: sharp AI Overview text visible through the
            // pill, not blurred — a floating-layer reveal, not a residual
            // timing gap). Give it its own opaque surface instead, matching
            // how paintChrome already treats fixed/sticky chrome elsewhere.
            el.style.setProperty('background-color', 'var(--aura-overlay)', 'important');
        } else {
            el.style.setProperty('background-color', 'transparent', 'important');
        }
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
        // The band behind the pill fades the answer out under the
        // composer: the fade rule repaints it in the theme color.
        if (!hasOpaque && isFadePaint(style.backgroundColor, style.backgroundImage)) return;
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
    // True if a button's SVG shapes carry >=2 distinct explicit fill colors
    // — a multi-color logo/brand mark, not a single-color icon glyph.
    // Mirrors isNearMonochromeColorStats's "never touch genuinely
    // multi-color content" philosophy (rethemeLogoContrast), applied to
    // explicit fill attributes instead of sampled pixels: confirmed cause
    // of the AI Mode header Google logo rendering as a flat single-color
    // blob — this loop force-painted every path's fill to one theme color
    // with no color-count check, and it's reachable whenever a brand
    // logo's clickable wrapper falls inside the composer's ancestor sweep.
    function svgShapesLookMultiColor(shapes) {
        const seen = new Set();
        for (let i = 0; i < shapes.length; i++) {
            let fill = '';
            try { fill = shapes[i].getAttribute('fill') || ''; } catch (e) {}
            fill = fill.trim().toLowerCase();
            if (!fill || fill === 'none' || fill === 'currentcolor' || fill === 'transparent') continue;
            seen.add(fill);
            if (seen.size > 1) return true;
        }
        return false;
    }

    // True if `shape` and every ancestor up to (excluding) `boundary` is
    // currently visible. A common icon-button pattern keeps both an
    // enabled- and disabled-state icon in the DOM at once, toggling
    // visibility via class/attribute rather than swapping nodes — if those
    // two variants use different explicit fill colors,
    // svgShapesLookMultiColor would (incorrectly) see 2 colors and treat
    // the button as a multi-color logo the moment the second variant
    // appears, even though only one is ever visible at a time. Filtering to
    // visible shapes first keeps the multi-color check (and the paint
    // below) scoped to what's actually on screen.
    function isShapeVisible(shape, boundary) {
        try {
            let node = shape;
            while (node && node !== boundary) {
                const style = getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden') return false;
                node = node.parentElement;
            }
            return true;
        } catch (e) {
            return true; // unknown — default to visible rather than silently excluding
        }
    }

    function clearAskAnythingIconButton(btn) {
        if (!btn || btn.nodeType !== 1) return;
        let text = '';
        // innerText (not textContent): a common accessible-icon-button
        // pattern keeps a visually-hidden label (e.g. a screen-reader-only
        // "Send" span) alongside the icon — textContent counts that as a
        // visible label and skips the button entirely, leaving its icon
        // untouched. Harmless while the pill was transparent (the icon
        // still showed against real page content behind it), but once the
        // pill is painted opaque an untouched icon can blend straight into
        // it and disappear. innerText respects CSS visibility, so a
        // hidden label no longer counts.
        try { text = String(btn.innerText || '').trim(); } catch (e) {}
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
        // Force every descendant shape directly so it's correct either way
        // — but never for a multi-color mark (a brand logo), only a
        // genuine single-color icon glyph, and only among currently-visible
        // shapes (see isShapeVisible).
        let shapes;
        try { shapes = btn.querySelectorAll('svg, path, circle, rect, line, polygon, polyline, use'); } catch (e) { shapes = null; }
        const visibleShapes = shapes ? Array.from(shapes).filter(s => isShapeVisible(s, btn)) : [];
        if (visibleShapes.length && !svgShapesLookMultiColor(visibleShapes)) {
            for (let i = 0; i < visibleShapes.length; i++) {
                visibleShapes[i].style.setProperty('fill', 'var(--aura-text)', 'important');
                askAnythingModified.add(visibleShapes[i]);
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
        // Typing mutates the composer; once it's marked, passes during
        // typing leave it alone (the marks are CSS, they don't need
        // re-applying).
        if (isUserTyping() && document.querySelector('[data-aura-composer]')) return;
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
            let node = field;
            // Composer-row-shaped ancestors collected during the climb;
            // painted below once the climb finishes (see the paint step).
            const sizedAncestors = [];
            // Innermost position:fixed/sticky ancestor seen during the
            // climb, tracked separately from sizedAncestors — see its use
            // in the paint step below. Google has since added an extra
            // inner wrapper div (confirmed live: a ~42px-tall sliver that
            // also happens to satisfy the size band below) between the
            // field and its real floating pill, pushing the actual pill to
            // the 9th ancestor — one level past this climb's old 8-hop
            // limit. sizedAncestors[0] (the innermost size-matching
            // ancestor) resolved to that inner sliver instead of the real
            // pill, so only a thin strip got painted opaque while the
            // pill's own background — and the +/mic/send icon buttons that
            // live inside IT, not inside the sliver — stayed untouched,
            // reproducing the on-device report (AI Overview text visible
            // through the composer, icons gone). 10 gives a couple of
            // hops' margin beyond the 9 currently needed.
            let floatingAncestor = null;
            for (let depth = 0; depth < 10; depth++) {
                const parent = node.parentElement;
                if (!parent || parent === document.body || parent === document.documentElement) {
                    break;
                }
                let rect;
                try { rect = parent.getBoundingClientRect(); } catch (e2) { break; }
                // The height/width band below is only a proxy for "this
                // looks like the composer row" — it says nothing about
                // whether THIS ancestor is the actual floating layer.
                // Checking position independently catches a floating shell
                // that's taller than 180px (padding/safe-area/extra rows)
                // or that doesn't itself fall in the 36-180/160 band while
                // an inner, position:static row does — both would otherwise
                // leave the true floating layer never painted opaque,
                // reproducing "composer sees through to page content"
                // regardless of Google's exact markup shape.
                let position = '';
                try { position = getComputedStyle(parent).position; } catch (ePos) {}
                const isFloating = position === 'fixed' || position === 'sticky';
                if (!isFloating && rect.height > 180) break;
                if (isFloating || (rect.height >= 36 && rect.width >= 160)) {
                    sizedAncestors.push(parent);
                }
                if (isFloating && !floatingAncestor) {
                    floatingAncestor = parent;
                }
                // Decorative empty previous siblings behind the field / pill.
                let sib = node.previousElementSibling;
                while (sib) {
                    clearAskAnythingDecorativeSibling(sib);
                    sib = sib.previousElementSibling;
                }
                node = parent;
            }
            // Paint step: always opaque, never transparent, regardless of
            // whether any ancestor turned out to be floating. Three rounds
            // of fixes here all previously branched on foundFloatingAncestor
            // — but that's a live getComputedStyle(...).position read that
            // can genuinely flip true mid-session (Google very plausibly
            // pins the composer via a JS/IntersectionObserver class toggle
            // only once the page scrolls, not an always-on CSS position).
            // The moment it flipped to true, the old code ran
            // clearAskAnythingFill on every sized ancestor, which paints
            // TRANSPARENT on any of them that isn't itself fixed/sticky —
            // reproducing exactly the on-device report: the box looked
            // normal at first, then went transparent, then its +/send
            // icons blended into whatever real page content was now
            // showing through. Only ever paint the single INNERMOST sized
            // ancestor (closest to the field — established in round 2 to
            // be the actual rounded pill, not an outer square layout
            // wrapper) plus the field itself, opaque, unconditionally, on
            // every pass — no code path left that can ever set either back
            // to transparent. clearAskAnythingFill is intentionally not
            // used here anymore; it's still used elsewhere for genuinely
            // decorative empty siblings, where transparent is correct.
            // The fill is a scoped sheet rule on [data-aura-composer]
            // (SITE_FIXES), so Google rewriting the shell's inline style or
            // classes can't undo it; this used to be an inline write plus a
            // dedicated MutationObserver re-applying it on every change.
            const paintComposerShell = el => {
                markGoogleNode(el, 'data-aura-composer');
                clearAskAnythingIconButtons(el);
            };
            if (sizedAncestors.length) {
                paintComposerShell(sizedAncestors[0]);
            }
            // Additive: paint the real floating pill too when the climb
            // found one distinct from the innermost size-matching wrapper
            // above (see floatingAncestor's doc comment). Every
            // previously-working case is untouched — sizedAncestors[0] is
            // still painted exactly as before — this only adds coverage
            // for the shape where the two differ.
            if (floatingAncestor && floatingAncestor !== sizedAncestors[0]) {
                paintComposerShell(floatingAncestor);
            }
            markGoogleNode(field, 'data-aura-composer');
        });
    }

    // Marks (data-aura-*) Aura puts on Google's own nodes for scoped
    // SITE_FIXES rules. Not in the observer's attributeFilter, so setting
    // them causes no pass.
    const googleMarkedNodes = new Set();
    function markGoogleNode(el, attr) {
        if (!el.hasAttribute(attr)) el.setAttribute(attr, '');
        googleMarkedNodes.add(el);
    }
    function unmarkGoogleNodes() {
        googleMarkedNodes.forEach(el => {
            try {
                el.removeAttribute('data-aura-composer');
                el.removeAttribute('data-aura-ai-card');
                el.removeAttribute('data-aura-ai-fade');
                el.removeAttribute('data-aura-ai-more');
            } catch (e) {}
        });
        googleMarkedNodes.clear();
    }

    // AI Overview "Show more": the expander's parent, and the empty divs
    // before any ancestor of it (the collapse fade; source chips may sit in
    // between on mobile). Replaces two unscoped :has() rules.
    const GOOGLE_AI_EXPANDER_SELECTOR = '[aria-controls="m-x-content"], [aria-label*="Show more AI" i]';
    function markGoogleAiOverview() {
        let expanders;
        try { expanders = document.querySelectorAll(GOOGLE_AI_EXPANDER_SELECTOR); } catch (e) { return; }
        for (let i = 0; i < expanders.length && i < 10; i++) {
            const x = expanders[i];
            if (x.parentElement && x.parentElement.tagName === 'DIV') markGoogleNode(x.parentElement, 'data-aura-ai-more');
            let node = x.parentElement;
            for (let depth = 0; node && node !== document.body && depth < 8; depth++, node = node.parentElement) {
                if (node.tagName !== 'DIV') continue;
                for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
                    if (sib.tagName === 'DIV' && !sib.firstChild) markGoogleNode(sib, 'data-aura-ai-fade');
                }
            }
        }
    }

    function revertAskAnythingComposer() {
        unmarkGoogleNodes();
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

    // An ancestor that also holds the Ask-anything composer is the page
    // column, not the card: marking it cleared every icon button on the
    // page, and the card's repaint observer and the composer's fed each
    // other's mutations forever (a runaway on the AI Mode fixture with the
    // Session 5 engine too).
    const ASK_FIELD_SELECTOR = 'textarea[aria-label*="ask" i], textarea[placeholder*="ask" i], [contenteditable="true"][aria-label*="ask" i]';
    function findGoogleAiAnswerRoot(el) {
        let node = el;
        let best = null;
        for (let depth = 0; node && depth < 10; depth++) {
            if (node === document.body || node === document.documentElement) break;
            try { if (node.querySelector(ASK_FIELD_SELECTOR)) break; } catch (e) {}
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

    // The card's blocks are cleared by a scoped sheet rule on
    // [data-aura-ai-card] (SITE_FIXES), which also covers streamed-in
    // content; this used to rewrite every div/p/li/span inline from a
    // dedicated observer on each mutation while the answer streamed.
    function repaintGoogleAiAnswerContainer(container) {
        markGoogleNode(container, 'data-aura-ai-card');
        clearAskAnythingIconButtons(container);
    }

    function rethemeGoogleAiChatSurface(root) {
        if (!root || !currentTheme || !isGoogleHost()) return;
        markGoogleAiOverview();
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
        const auraPerfCacheMiss = googleAiAnswerRootsCache.length === 0
            || now - googleAiAnswerRootsCacheAt > GOOGLE_AI_ANSWER_ROOT_RESCAN_MS;
        if (AURA_DEBUG_LOGGING) {
            // Temporary instrumentation for the Google lag/flash investigation
            // (SUBMISSION_READINESS.md items 6/7) — see the matching note in
            // dispatchSafetyPasses.
            console.log('Aura perf: AI answer root cache', auraPerfCacheMiss ? 'miss (rescanning)' : 'hit');
        }
        if (auraPerfCacheMiss) {
            // Search from the document root, not just `scope` — a scoped,
            // typing-triggered pass's root is very likely inside the
            // composer, nowhere near the answer card the disclaimer lives
            // in, and this call is already throttled above so the extra
            // reach doesn't reintroduce the per-keystroke cost.
            googleAiAnswerRootsCache = findGoogleAiAnswerRoots(document.documentElement);
            googleAiAnswerRootsCacheAt = now;
        }
        googleAiAnswerRootsCache.forEach(repaintGoogleAiAnswerContainer);
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
        // ShadowRoot (nodeType 11) implements the same ParentNode interface
        // as Element, so scope.querySelectorAll(...) below works identically
        // when scope is a shadow root — it just can't cross a FURTHER shadow
        // boundary from there, which is fine: nested shadow roots are
        // handled by shadowRootSteps (via runSafetyPasses), not by this function.
        const scope = (root.nodeType === 1 || root.nodeType === 11) ? root : document.documentElement;
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

        // Fixed/sticky bars and everything inside them belong to the
        // layer engine (visitStickyElement), which paints by authored
        // paint. Painting or clearing them here too would fight it.
        function isPinned(node) {
            try {
                const pos = getComputedStyle(node).position;
                return pos === 'fixed' || pos === 'sticky';
            } catch (e) { return false; }
        }

        function paintChrome(el) {
            if (!el || painted.has(el)) return;
            if (isAdThemingSkipped(el) || isChromePaintHostSkipped(el)) return;
            if (isPinned(el) || layerPaints.has(el)) {
                if (layerPaints.has(el)) {
                    chromeOuterModified.delete(el);
                    chromeModified.delete(el);
                } else if (chromeOuterModified.has(el)) {
                    revertChromeOuterPaint(el);
                }
                return;
            }
            let rect;
            try { rect = el.getBoundingClientRect(); } catch (e) { return; }
            // Never paint a covering sheet as top chrome — same curtain class.
            if (isOverlayCoveringSheet(rect, vh, vw)) return;
            // Shape says "top bar"; the site's own paint says whether it's
            // a surface. A bar the site left transparent (a header laid
            // over a hero image) stays transparent, and so do its insides:
            // the universal rule already clears them.
            if (H.classifyAuthoredPaint(readAuthoredPaint([el])[0], 'layer') !== 'opaque') {
                if (chromeOuterModified.has(el)) revertChromeOuterPaint(el);
                return;
            }
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
            const pinnedInners = [];
            for (const inner of inners) {
                if (!inner || inner.nodeType !== 1) continue;
                if (++n > 250) break;
                if (H.BRIGHT_SKIP_TAGS && H.BRIGHT_SKIP_TAGS[inner.tagName]) continue;
                if (inner.getAttribute('role') === 'button') continue;
                // Overlay-role elements (menus, listboxes/autocomplete
                // dropdowns, dialogs) are already correctly painted by the
                // static OVERLAY_SELECTOR CSS rule the instant they appear.
                // Every other paint pass in this file defers to that via
                // isOverlayChrome — this loop was the one place that didn't,
                // so an autocomplete suggestions list nested inside top
                // chrome got its correct CSS paint clobbered by the
                // unconditional transparent write below on every debounced
                // mutation pass (i.e. every keystroke), producing a
                // continuous correct-then-transparent flash.
                if (H.isOverlayChrome && H.isOverlayChrome(inner)) continue;
                if (isUniversalTransparencyHostExcluded(inner)) continue;
                // A fixed/sticky descendant renders in its own layer,
                // detached from this element's box: it and its subtree are
                // the layer engine's.
                if (layerPaints.has(inner)) continue;
                if (pinnedInners.length && pinnedInners.some(p => p.contains(inner))) continue;
                if (isPinned(inner)) {
                    pinnedInners.push(inner);
                    continue;
                }
                if (authoredOpaqueDescendants && authoredOpaqueDescendants.has(inner)
                    && !isAdThemingSkipped(inner) && !isChromePaintHostSkipped(inner)
                    && (H.isLikelyNavMenu(inner, getComputedStyle, { vh, vw })
                        || (H.isLikelyAuthoredSurface && H.isLikelyAuthoredSurface(inner, getComputedStyle, { vh, vw })))
                    && H.classifyAuthoredPaint(readAuthoredPaint([inner])[0], 'layer') === 'opaque') {
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
        // A semantic wrapper whose real bar is a position:fixed child (UC
        // Davis's .header__bar) needs nothing here: the fixed child is a
        // layer root of its own.
        seeds.forEach(el => {
            const rootEl = outermost(el);
            if (rootEl) paintChrome(rootEl);
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
                // Aura's own sheets aren't the site's paint: their
                // !important rules nominated elements Aura itself paints
                // (Google's "Show more" row), and a rule without the probe
                // exemption then read back as "authored opaque".
                const sheet = sheets[i];
                const owner = sheet.ownerNode;
                if (owner && owner.id && owner.id.indexOf('aura-') === 0) continue;
                let rules;
                try { rules = sheet.cssRules || sheet.rules; } catch (e) { continue; }
                if (!rules) continue;
                // A sheet whose rule count and starting budget are unchanged
                // gives the same selectors: reused instead of reading four
                // CSSOM values per rule again every TTL (Session 8c:
                // 15,000 rules, 20-60 ms, on Airbnb/GitHub/Reddit).
                const len = rules.length;
                const prev = importantBgSheetScans.get(sheet);
                if (prev && prev.len === len && prev.scannedBefore === budget.scanned && prev.outBefore === selectors.length) {
                    budget.scanned += prev.scanned;
                    for (let k = 0; k < prev.selectors.length; k++) selectors.push(prev.selectors[k]);
                    continue;
                }
                const scannedBefore = budget.scanned;
                const outBefore = selectors.length;
                collectImportantBgSelectors(rules, selectors, budget);
                importantBgSheetScans.set(sheet, {
                    len, scannedBefore, outBefore,
                    scanned: budget.scanned - scannedBefore,
                    selectors: selectors.slice(outBefore),
                });
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
    // The transition gate decides WHEN a panel counts as open; what gets
    // painted is the authored-paint rule's call (overlay mode), like a
    // drawer: the panel's own surface if the site painted it, else its
    // authored-opaque inner list, never a transparent wrapper.
    function revertNavMenuPanelPaint(el) {
        releaseLayerRoot(el, 'navpanel');
        navMenuPanelOpaqueModified.delete(el);
    }

    // H.navSignalsFromElement for every element of a walk in one sweep:
    // visited in reverse document order, each element's descendants are
    // already counted when it is reached. Same values as the per-element
    // subtree queries (links: a[href] descendants; nav: a nav/navigation
    // descendant), O(n) instead of O(n x subtree).
    function navSignalSweep(elements) {
        const map = new WeakMap();
        const reversed = elements.slice().reverse();
        return {
            get: el => map.get(el) || null,
            step: {
                items: reversed,
                visit(el) {
                    let links = 0;
                    let navDesc = false;
                    for (let c = el.firstElementChild; c; c = c.nextElementSibling) {
                        if (c.localName === 'a' && c.hasAttribute('href')) links++;
                        const tag = c.tagName;
                        if (tag === 'NAV' || c.getAttribute('role') === 'navigation') navDesc = true;
                        const sub = map.get(c);
                        if (sub) { links += sub.linkCount; navDesc = navDesc || sub.hasNavDescendant || sub.isNavTagOrRole; }
                    }
                    const isNavTagOrRole = el.tagName === 'NAV' || el.getAttribute('role') === 'navigation';
                    // navSignalsFromElement only looks for a nav descendant
                    // when the element isn't one itself.
                    map.set(el, { isNavTagOrRole, hasNavDescendant: !isNavTagOrRole && navDesc, linkCount: links });
                },
            },
        };
    }

    function visitNavMenuPanelElement(el, vh, vw, navSignals) {
        if (!el || el.nodeType !== 1 || !H || !H.classifyNavMenuPanelState) return;
        if (isChromeRepaintDisabledForHost()) return;
        const navState = H.classifyNavMenuPanelState(el, getComputedStyle, { vh, vw }, navSignals);
        if (navState === 'expanded') {
            const prevNavState = navMenuPanelStateHistory.get(el);
            // Deliberately has no "freshly mounted" fallback (the removed
            // content-panel pass had one) — see the
            // matching comment on the nav-drawer branch in
            // visitOverlayModalWalk for why: a permanent, always-visible,
            // nav-shaped element (no real 'collapsed' sighting to ever
            // transition from) gets misclassified as "just opened" on every
            // page load, painting it opaque over whatever it was sitting on
            // (confirmed regression on store.hypixel.net). Reverted.
            const isOpenTransition = !!(H.isNavDrawerOpenTransition
                && H.isNavDrawerOpenTransition(prevNavState, navState));
            navMenuPanelPendingCollapse.delete(el);
            // Same history-poisoning fix as the nav-drawer branch of
            // visitOverlayModalWalk: only record 'expanded' once actually treated as an
            // open. A panel that ever mounts pre-expanded (no earlier
            // 'collapsed' sighting — e.g. opened via a URL hash on load)
            // would otherwise get prevNavState stuck at 'expanded' forever,
            // and isNavDrawerOpenTransition (which requires prevState ===
            // 'collapsed') could never fire again for it.
            if (isOpenTransition || navMenuPanelOpaqueModified.has(el)) {
                // Written only once geometry/visibility are confirmed below
                // (immediately before the paint itself), not here at the top
                // of the block — otherwise a pass that catches this element
                // mid-CSS-transition (still hidden/zero-size for this one
                // debounced pass, a near-universal shape for an animating
                // menu) would still commit 'expanded' to history despite
                // never actually painting, permanently poisoning prevNavState
                // and locking the element out of ever being painted. See the
                // matching comment in visitOverlayModalWalk's nav-drawer branch.
                let style;
                try { style = getComputedStyle(el); } catch (e) { return; }
                if (style.visibility === 'hidden' || style.opacity === '0') return;
                if (style.display === 'none') return;
                let rect;
                try { rect = el.getBoundingClientRect(); } catch (e2) { return; }
                if (rect.width < 1 || rect.height < 1) return;
                navMenuPanelStateHistory.set(el, 'expanded');
                // A fixed/sticky panel is already a drawer/layer root.
                const owner = layerRoots.get(el);
                if (!owner || owner.source === 'navpanel') evaluateAuthoredLayer(el, 'overlay', 'navpanel');
                navMenuPanelOpaqueModified.add(el);
            }
            return;
        }
        if (navState === 'collapsed') {
            // "Don't flicker on one disagreeing sample" — see
            // notePendingRevert's doc comment.
            if (navMenuPanelStateHistory.get(el) === 'expanded') {
                if (notePendingRevert(navMenuPanelPendingCollapse, el, REVERT_CONFIRM_READINGS)) {
                    navMenuPanelStateHistory.set(el, 'collapsed');
                    if (navMenuPanelOpaqueModified.has(el)) revertNavMenuPanelPaint(el);
                }
            } else {
                navMenuPanelStateHistory.set(el, 'collapsed');
                if (navMenuPanelOpaqueModified.has(el)) revertNavMenuPanelPaint(el);
            }
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
        // A matching !important rule is only a nomination: a later or more
        // specific site rule can still win, and `background: url(...)
        // !important` passes the text filter with a transparent color. The
        // probe (one batch) says what the site actually paints.
        const accepted = [];
        for (let ci = 0; ci < candidates.length && accepted.length <= 200; ci++) {
            const el = candidates[ci];
            if (chromeAuthoredModified.has(el)) continue;
            if (isAdThemingSkipped(el) || isChromePaintHostSkipped(el)) continue;
            if (H.isAmpOverlayChrome && H.isAmpOverlayChrome(el)) continue;
            let style;
            try { style = getComputedStyle(el); } catch (e2) { continue; }
            const parsed = H.parseCssRgb && H.parseCssRgb(style.backgroundColor);
            const currentlyTransparent = !parsed || parsed.a < 0.5;
            if (!currentlyTransparent) continue;
            if (layerPaints.has(el)) continue;
            if (H.isLikelyNavMenu(el, getComputedStyle, { vh, vw })
                || (H.isLikelyAuthoredSurface && H.isLikelyAuthoredSurface(el, getComputedStyle, { vh, vw }))) {
                accepted.push(el);
            }
        }
        if (!accepted.length) return;
        const paints = readAuthoredPaint(accepted);
        for (let i = 0; i < accepted.length; i++) {
            if (H.classifyAuthoredPaint(paints[i], 'layer') !== 'opaque') continue;
            const el = accepted[i];
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
        const picked = contrastDecision(el, effectiveBgCache);
        if (picked != null) writeContrastColor(el, picked);
    }

    // First-screen text first (Session 8c, Load-6): the contrast step is a
    // pass's last, after every surface step, so on a big page at phone
    // speed visible text kept the site's dark color for seconds. These
    // steps run at the start of a pass, for elements on the first screen
    // (1.25 viewports), and decide only text sitting straight on the theme
    // background, as contrastAddedNodes does: the steps after this can't
    // change that background, so the final contrast step agrees and
    // nothing changes twice.
    const FIRST_SCREEN_VH = 1.25;
    function firstScreenContrastSteps(elements, vh) {
        if (!currentTheme || !H || !H.effectiveBackground || isActiveSplitTheme(currentTheme)) return [];
        const themeBg = H.parseHexColor && H.parseHexColor(currentTheme.background);
        if (!themeBg) return [];
        const onScreen = [];
        const bottom = vh * FIRST_SCREEN_VH;
        const bgCache = new WeakMap();
        return [
            {
                items: elements,
                visit(el) {
                    if (!el.firstChild) return;
                    const r = el.getBoundingClientRect();
                    if (r.bottom > 0 && r.top < bottom && r.width > 0 && r.height > 0) onScreen.push(el);
                },
            },
            () => [{
                items: onScreen,
                visit(el) {
                    const picked = contrastDecision(el, bgCache);
                    if (picked == null) return;
                    const bg = H.effectiveBackground(el, getComputedStyle, currentTheme.background, bgCache);
                    if (!bg || bg.r !== themeBg.r || bg.g !== themeBg.g || bg.b !== themeBg.b) return;
                    writeContrastColor(el, picked);
                    // Its descendants inherit the new color: cached
                    // backgrounds stay valid, but their own decisions
                    // must read it (a style read after a write is one
                    // recalc, paid only where text was fixed).
                },
            }],
        ];
    }

    // The pass's contrast step decides first and writes in batches
    // (Session 8c): a write followed by the next element's reads cost a
    // style recalc per write (late-text: 1500 writes, the step that left
    // visible text dark for seconds at phone speed). A queued write's
    // descendants inherit its color, so the queue is written out before
    // one of them is decided; and at the end of every slice (runSteps
    // calls `flush`), so no frame shows a half-applied batch.
    function contrastBatchStep(items, getCache) {
        const queue = [];
        const open = []; // queued elements, in document order, that may still contain what comes next
        function flush() {
            for (let i = 0; i < queue.length; i += 2) {
                try { writeContrastColor(queue[i], queue[i + 1]); } catch (e) {}
            }
            queue.length = 0;
            open.length = 0;
        }
        return {
            items,
            flush,
            visit(el) {
                while (open.length && !open[open.length - 1].contains(el)) open.pop();
                if (open.length) flush();
                const picked = contrastDecision(el, getCache());
                if (picked == null) return;
                queue.push(el, picked);
                open.push(el);
            },
        };
    }

    function writeContrastColor(el, picked) {
        // A late text-color fix snaps instead of fading through the site's
        // own `transition: color` (Walmart: 24 elements): the old color
        // animating into the new one read as a flash (X-11). Transitions
        // come back next frame, as after a probe.
        if (el.style.getPropertyValue('color') !== picked) snapNextWrite(el);
        el.style.setProperty('color', picked, 'important');
        contrastModified.add(el);
    }

    // Read-only half of the contrast pass: the color to write, or null.
    // contrastAddedNodes decides a whole batch before writing any of it.
    // Per-pass cache for H.isStackedDuplicateLabel (parent -> child text
    // counts); reset with the effective-background cache.
    let duplicateLabelCache = new WeakMap();

    // Text in nodes the site just added (hydration, infinite scroll,
    // streamed answers) is fixed here, in the observer callback before the
    // next frame, instead of at the next pass's contrast step. Only text
    // that sits straight on the theme background is decided: under an
    // authored surface the pass's bright/shell steps may still change the
    // background, so that text waits for the pass (one change, not two).
    // Off until the first full-document pass has collected its elements:
    // everything parsed before then is in that pass, and running here on
    // every parser batch of a cache-applied load forced style recalcs of
    // the half-built page (a 25-30 ms task). Off, too, while the document
    // is still parsing (Session 8c): a pass started mid-parse turned it
    // on, and each parser chunk then forced a style recalc and layout of
    // the growing page (GitHub: 30 of them in one 500 ms task); the end of
    // parsing restarts the full pass, first-screen text first
    // (watchParseEnd).
    const FAST_CONTRAST_MAX_ELEMENTS = 300;
    let fullPassCollected = false;
    function contrastAddedNodes(records) {
        if (!fullPassCollected || document.readyState === 'loading' || !currentTheme || !H || !H.effectiveBackground || isUserTyping() || isActiveSplitTheme(currentTheme)) return;
        const els = [];
        for (let r = 0; r < records.length; r++) {
            const rec = records[r];
            if (rec.type !== 'childList') continue;
            for (let n = 0; n < rec.addedNodes.length; n++) {
                const node = rec.addedNodes[n];
                if (node.nodeType !== 1 || !node.isConnected || isOwnNode(node)) continue;
                els.push(node);
                const inner = node.getElementsByTagName('*');
                if (els.length + inner.length > FAST_CONTRAST_MAX_ELEMENTS) return;
                for (let k = 0; k < inner.length; k++) els.push(inner[k]);
            }
        }
        fastContrast(els);
    }

    // Text in an element that starts a CSS animation (a cookie sheet or
    // toast sliding in): decided as it starts, the same way as added
    // nodes. A first-screen pass can miss it while it's still translated
    // below the screen, leaving its text to the pass's last step (Airbnb's
    // cookie sheet: dark text for up to 3 s, Session 8c).
    function contrastAnimatedSubtree(event) {
        if (!fullPassCollected || !currentTheme || !H || !H.effectiveBackground || isUserTyping() || isActiveSplitTheme(currentTheme)) return;
        const root = event.target;
        if (!root || root.nodeType !== 1 || !root.isConnected || isOwnNode(root)) return;
        // Once a second per element: a pulsing or repeating animation
        // restarts often, a sheet opened again later is decided again.
        const now = performance.now();
        if (now - (animatedContrastAt.get(root) || -Infinity) < 1000) return;
        animatedContrastAt.set(root, now);
        const inner = root.getElementsByTagName('*');
        if (!inner.length || inner.length + 1 > FAST_CONTRAST_MAX_ELEMENTS) return;
        const els = [root];
        for (let k = 0; k < inner.length; k++) els.push(inner[k]);
        fastContrast(els);
    }
    const animatedContrastAt = new WeakMap();

    function fastContrast(els) {
        if (!els.length) return;
        const themeBg = H.parseHexColor && H.parseHexColor(currentTheme.background);
        if (!themeBg) return;
        const bgCache = new WeakMap();
        const dupCache = new WeakMap();
        const out = [];
        for (let i = 0; i < els.length; i++) {
            const el = els[i];
            let picked = null;
            try { picked = contrastDecision(el, bgCache, dupCache); } catch (e) {}
            if (picked == null) continue;
            const bg = H.effectiveBackground(el, getComputedStyle, currentTheme.background, bgCache);
            if (!bg || bg.r !== themeBg.r || bg.g !== themeBg.g || bg.b !== themeBg.b) continue;
            out.push(el, picked);
        }
        for (let i = 0; i < out.length; i += 2) {
            try { writeContrastColor(out[i], out[i + 1]); } catch (e) {}
        }
        // Our writes must not come back as the next batch.
        if (out.length) discardOwnMutationRecords();
    }

    function isOwnNode(node) {
        const id = node.id || '';
        return id.indexOf('aura-') === 0 || node.hasAttribute('data-aura-shadow') || node.hasAttribute('data-aura-iframe');
    }

    function contrastDecision(el, effectiveBgCache, dupCache) {
        if (!el || el.nodeType !== 1 || !H || !H.hasPoorContrast || !currentTheme) return null;
        if (isActiveSplitTheme(currentTheme)) return null;
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
        if (H.BRIGHT_SKIP_TAGS && H.BRIGHT_SKIP_TAGS[tag] && tag !== 'BUTTON') return null;
        if (buttonPaints.has(el) || buttonTextEls.has(el)) return null;
        if (typeof el.className === 'string' && /icon/i.test(el.className)) return null;
        let style;
        try { style = getComputedStyle(el); } catch (e) { return null; }
        // A button whose own visible surface comes from a background-image
        // (a solid-color-simulating gradient — a common flat-button
        // technique) rather than backgroundColor is invisible to
        // effectiveBackground below: that helper only ever checks
        // backgroundColor, so it walks straight past this element to
        // whatever ancestor has a real backgroundColor next (often a
        // dialog/sheet already repainted dark by an earlier pass) and
        // judges contrast against THAT instead of the button's own actual
        // surface — dark-ancestor-vs-light-text looks fine, so nothing gets
        // fixed, leaving whatever color a previous pass forced standing
        // (confirmed as the actual cause of a "Save" button rendering
        // illegible light-on-light on reddit.com — general pattern, not
        // site-specific). We can't safely know what color an arbitrary
        // gradient actually renders without sampling, so the safe choice is
        // to leave this element alone entirely rather than guess against
        // the wrong background — matching this codebase's existing
        // philosophy elsewhere of never fighting a site's own styling when
        // a change can't be confirmed to help. Scoped to button-like
        // elements only, matching the reported bug.
        const isButtonLike = tag === 'BUTTON' || (el.getAttribute && el.getAttribute('role') === 'button');
        if (isButtonLike && H.isGradientBackgroundImage && H.isGradientBackgroundImage(style.backgroundImage)) {
            return null;
        }
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
            return null;
        }
        let rect;
        try { rect = el.getBoundingClientRect(); } catch (e2) { return null; }
        if (H.isUnpaintedForContrast && H.isUnpaintedForContrast({
            visibility: style.visibility,
            opacity: style.opacity,
            display: style.display,
            width: rect.width,
            height: rect.height,
        })) return null;
        const fg = H.parseCssRgb(style.color);
        const bgParsed = H.effectiveBackground
            ? H.effectiveBackground(el, getComputedStyle, currentTheme.background, effectiveBgCache)
            : (H.parseHexColor && H.parseHexColor(currentTheme.background));
        if (!fg || !bgParsed) return null;
        if (!H.hasPoorContrast(fg, bgParsed, 3.0)) return null;
        // Last, for the few elements with poor contrast: it reads the
        // element's and its siblings' text (Session 8c: it ran first, for
        // every element, <head> and <body> included).
        if (H.isStackedDuplicateLabel && H.isStackedDuplicateLabel(el, dupCache || duplicateLabelCache)) return null;
        const themeText = currentTheme.text || '#ffffff';
        const themeLink = currentTheme.link || '#8ab4f8';
        const isLink = tag === 'A' || (el.closest && el.closest('a'));
        const preferred = isLink ? themeLink : themeText;
        const picked = H.pickReadableAgainstSurface
            ? H.pickReadableAgainstSurface(bgParsed, preferred, 3.0)
            : preferred;
        return picked;
    }

    // 3d-ter. BUTTONS AND STATEFUL CONTROLS
    // Buttons keep their own fill; their text is made readable against it
    // (H.buttonPaintDecision). A full-width neutral strip against the theme
    // is painted as a theme surface instead. Checkbox/radio/switch and
    // selected controls show their state with their own fill, which the
    // universal strip leaves alone for them (see stateNot in
    // getFullStyleSheet); H.stateControlDecision maps a neutral one so on
    // and off stay distinct. Light DOM and shadow roots both.
    // button -> { els: [written elements], surface: bool }
    const buttonPaints = new Map();
    // Elements whose text color settleButtons wrote (the button and the
    // descendants it recolored). The contrast step leaves them alone: it
    // judged a GitHub button's spans against a fill read mid-pass and
    // wrote black `color` under settleButtons' white text-fill, turning
    // the icon black (Session 8c).
    const buttonTextEls = new WeakSet();
    // element -> true (inline background written by settleStateControls)
    const stateControlModified = new Set();
    const BUTTON_MAX_PER_PASS = 400;
    const BUTTON_MAX_DESCENDANTS = 20;
    const BUTTON_CONTAINER_DEPTH = 6;
    const BUTTON_DISTINCT_MIN_CONTRAST = 1.15;
    const BUTTON_DISTINCT_MAX_CONTRAST = 1.6;
    const BUTTON_DISTINCT_MAX_MIX = 0.4;
    // Buttons whose surface/distinct fill stays on while settleButtons
    // re-decides them (the probe lifts it).
    const buttonFillKept = new Set();
    const STATE_CONTROL_MAX_NODES = 40;
    const STATE_HIGHLIGHT = 'color-mix(in srgb, var(--aura-text) 18%, var(--aura-bg))';
    const STATE_CONTROL_SELECTOR = '[role="checkbox"], [role="radio"], [role="switch"]';

    function isButtonLikeElement(el) {
        const tag = el.tagName;
        if (tag === 'BUTTON') return true;
        if (tag === 'INPUT') {
            const t = (el.getAttribute('type') || '').toLowerCase();
            return t === 'button' || t === 'submit' || t === 'reset';
        }
        return el.getAttribute('role') === 'button';
    }

    const NESTED_BUTTON_SELECTOR = 'button, input[type="button"], input[type="submit"], input[type="reset"], [role="button"]';

    function isStateControlElement(el) {
        const role = el.getAttribute('role');
        if (role === 'checkbox' || role === 'radio' || role === 'switch') return true;
        return el.hasAttribute('aria-checked') || el.getAttribute('aria-selected') === 'true';
    }

    // Walk visitor: nominates only (cheap attribute reads).
    function visitControlElement(el, buttons, states) {
        if (!el || el.nodeType !== 1) return;
        if (isButtonLikeElement(el) || buttonPaints.has(el)) {
            if (buttons.length < BUTTON_MAX_PER_PASS) buttons.push(el);
        }
        if (isStateControlElement(el) || stateControlModified.has(el)) states.push(el);
    }

    // keepFill: settleButtons re-deciding; the fill stays on (the probe
    // lifts it for the read) and is rewritten only if the decision changes.
    function releaseButtonPaint(btn, keepFill) {
        const entry = buttonPaints.get(btn);
        if (!entry) return;
        // A distinct decision doesn't depend on the text color, so its
        // paint stays on untouched while it's re-decided (lifting and
        // rewriting it every pass restyled every such button).
        if (keepFill && entry.mode === 'distinct') {
            buttonFillKept.add(btn);
            return;
        }
        for (let i = 0; i < entry.els.length; i++) {
            const el = entry.els[i];
            buttonTextEls.delete(el);
            try {
                el.style.removeProperty('color');
                el.style.removeProperty('-webkit-text-fill-color');
                if (entry.surface && el === btn && !keepFill) {
                    el.style.removeProperty('background-color');
                    el.style.removeProperty('background-image');
                }
            } catch (e) {}
        }
        if (keepFill && entry.surface) {
            entry.els = [btn];
            buttonFillKept.add(btn);
        } else {
            buttonPaints.delete(btn);
            buttonFillKept.delete(btn);
        }
    }

    function settleButtons(buttons) {
        if (!buttons.length || !currentTheme || !H || !H.buttonPaintDecision) return;
        const vw = passViewport().vw || 1;
        const themeText = currentTheme.text || '#ffffff';
        const themeBgParsed = H.parseHexColor(currentTheme.background || '#121212');
        const textParsed = H.parseHexColor(themeText);
        // The ancestors a filled button sits on are probed in the same batch
        // as the buttons (one style recalc per shadow root, not two), for
        // the buttons whose fill could need them: a neutral one, or one
        // that doesn't stand apart from the theme background. A <button>'s
        // computed fill is its authored one (the strip skips buttons). Read
        // before our writes are lifted: a read after the lift forced a
        // second style recalc per shadow root.
        const probeList = [];
        const probeIndex = new Map();
        for (let i = 0; i < buttons.length; i++) {
            const b = buttons[i];
            let cs;
            try { cs = getComputedStyle(b); } catch (e) { continue; }
            const f = H.firstGradientStop(cs.backgroundImage) || H.parseCssRgb(cs.backgroundColor);
            if (!f || f.a < 0.5) continue;
            if (H.fillStandsApart(f, themeBgParsed)) {
                // Still needed for a full-width neutral strip (the
                // surface rule asks whether it blended into its container).
                if (!H.isNeutralFill(f)) continue;
                const parent = b.parentElement || (b.getRootNode() && b.getRootNode().host);
                let wide = false;
                try { wide = !!parent && b.getBoundingClientRect().width >= 0.8 * (parent.getBoundingClientRect().width || vw); } catch (e) {}
                if (!wide) continue;
            }
            for (let n = maskParentOf(b), d = 0; n && d < BUTTON_CONTAINER_DEPTH
                && n !== document.body && n !== document.documentElement; n = maskParentOf(n), d++) {
                if (!probeIndex.has(n)) { probeIndex.set(n, buttons.length + probeList.length); probeList.push(n); }
            }
        }
        // Lift our previous writes so every read below sees the site's own
        // paint and text, then decide again (a button's fill can change).
        for (let i = 0; i < buttons.length; i++) {
            if (buttonPaints.has(buttons[i])) releaseButtonPaint(buttons[i], true);
        }
        const allPaints = readAuthoredPaint(probeList.length ? buttons.concat(probeList) : buttons);
        const paints = allPaints;
        const chainPaints = allPaints;
        // Reads: each visible button's style, and the themed container.
        const seen = [];
        for (let i = 0; i < buttons.length; i++) {
            const b = buttons[i];
            if (!b.isConnected) continue;
            let style, rect;
            try { style = getComputedStyle(b); rect = b.getBoundingClientRect(); } catch (e) { continue; }
            if (style.display === 'none' || style.visibility === 'hidden' || rect.width < 1 || rect.height < 1) continue;
            const parent = b.parentElement || (b.getRootNode() && b.getRootNode().host);
            let pw = vw;
            try { if (parent) pw = parent.getBoundingClientRect().width || vw; } catch (e) {}
            const fill = H.firstGradientStop(style.backgroundImage) || H.parseCssRgb(paints[i] && paints[i].bg);
            // The container as themed now: the nearest ancestor that paints.
            const chain = [];
            let themed = '';
            // A fill that stands apart from the theme background and can't
            // be a surface strip is kept whatever it sits on: no walk.
            const surfaceShape = fill && rect.width / pw >= 0.8 && H.isNeutralFill(fill);
            if (fill && fill.a >= 0.5 && (surfaceShape || !H.fillStandsApart(fill, themeBgParsed))) {
                for (let n = maskParentOf(b), d = 0; n && d < BUTTON_CONTAINER_DEPTH
                    && n !== document.body && n !== document.documentElement; n = maskParentOf(n), d++) {
                    chain.push(n);
                }
                themed = themedPaintFrom(chain, 0);
            }
            const themedParsed = themed ? H.parseCssRgb(themed) : themeBgParsed;
            // The authored container only matters for a fill that now
            // blends into the themed one, or a strip that could become a
            // surface: only those chains are probed (deduplicated: the
            // buttons of one shadow root share most of their ancestors).
            const needsContainer = !!fill && fill.a >= 0.5 && (surfaceShape || !H.fillStandsApart(fill, themedParsed));
            seen.push({ b, i, style, rect, pw, fill, chain: needsContainer ? chain : [], themed, themedParsed });
        }
        const decisions = [];
        for (let s = 0; s < seen.length; s++) {
            const { b, i, style, rect, pw, fill: shownFill, chain, themed, themedParsed } = seen[s];
            // The container as authored: the nearest ancestor that painted.
            let container = null;
            for (let j = 0; j < chain.length && !container; j++) {
                const p = chainPaints[probeIndex.get(chain[j])];
                const c = H.parseCssRgb(p && p.bg);
                if (c && c.a >= 0.5) container = c;
            }
            const distinctFill = container && shownFill && themedParsed && textParsed
                ? distinctButtonFill(themedParsed, textParsed, H.fillContrast(shownFill, container)) : null;
            const d = H.buttonPaintDecision({
                fill: H.parseCssRgb(paints[i] && paints[i].bg),
                gradientStop: H.firstGradientStop(style.backgroundImage),
                text: H.parseCssRgb(style.color),
                themeBg: currentTheme.background || '#121212',
                themeText,
                widthFrac: rect.width / pw,
                container,
                themedContainer: themedParsed,
                distinctFill,
            });
            if (d.mode === 'none') {
                if (buttonFillKept.has(b)) releaseButtonPaint(b);
                continue;
            }
            // Written as rgb(): the other passes parse what they read back.
            if (d.mode === 'distinct') d.bg = 'rgb(' + distinctFill.r + ', ' + distinctFill.g + ', ' + distinctFill.b + ')';
            const prev = buttonPaints.get(b);
            if (prev && prev.mode === 'distinct' && buttonFillKept.has(b)) {
                if (d.mode === 'distinct' && d.bg === prev.bg && d.color === prev.color) {
                    buttonFillKept.delete(b);
                    continue;
                }
                releaseButtonPaint(b);
            }
            // Descendants keep their own color (a muted subtitle) unless it
            // fails against the fill the button ends up with.
            const fill = d.mode === 'surface'
                ? H.parseHexColor(currentTheme.background || '#121212')
                : d.mode === 'distinct' ? distinctFill
                : (H.firstGradientStop(style.backgroundImage) || H.parseCssRgb(paints[i] && paints[i].bg));
            const els = [b];
            const inner = b.querySelectorAll('*');
            for (let k = 0, n = 0; k < inner.length && n < BUTTON_MAX_DESCENDANTS; k++) {
                if (inner[k] instanceof SVGElement) continue;
                n++;
                let c = null;
                try { c = H.parseCssRgb(getComputedStyle(inner[k]).color); } catch (e) {}
                if (!c || !fill || H.hasPoorContrast(c, fill, 3.0)) els.push(inner[k]);
            }
            decisions.push(b, d, els);
        }
        // Writes after all reads (one style recalc).
        for (let i = 0; i < decisions.length; i += 3) {
            const b = decisions[i];
            const d = decisions[i + 1];
            const els = decisions[i + 2];
            const surface = d.mode === 'surface' || d.mode === 'distinct';
            const bg = d.mode === 'surface' ? 'var(--aura-elevated)' : d.mode === 'distinct' ? d.bg : '';
            buttonFillKept.delete(b);
            if (bg) {
                // Snapped: the contrast step after this reads the fill
                // behind the button's text, and a site transition
                // (GitHub's `background-color .08s`) showed it a
                // half-way light fill, so it wrote black text over ours.
                if (b.style.getPropertyValue('background-color') !== bg) {
                    snapNextWrite(b);
                    b.style.setProperty('background-color', bg, 'important');
                }
                if (d.mode === 'distinct' && b.style.getPropertyValue('background-image') !== 'none') b.style.setProperty('background-image', 'none', 'important');
                if (d.mode === 'surface' && b.style.getPropertyValue('background-image')) b.style.removeProperty('background-image');
            } else if (buttonPaints.has(b) && buttonPaints.get(b).surface) {
                b.style.removeProperty('background-color');
                b.style.removeProperty('background-image');
            }
            for (let k = 0; k < els.length; k++) {
                els[k].style.setProperty('color', d.color, 'important');
                els[k].style.setProperty('-webkit-text-fill-color', d.color, 'important');
                buttonTextEls.add(els[k]);
            }
            buttonPaints.set(b, { els, surface, mode: d.mode, bg, color: d.color });
        }
    }

    // The nearest of chain[from..] that paints now (its computed background),
    // memoized per node for the pass: the buttons of a page's shadow roots
    // climb through the same ancestors.
    let themedPaintMemo = new WeakMap();
    let themedPaintMemoPass = -1;
    function themedPaintFrom(chain, from) {
        if (themedPaintMemoPass !== pendingRevertReading) {
            themedPaintMemo = new WeakMap();
            themedPaintMemoPass = pendingRevertReading;
        }
        if (from >= chain.length) return '';
        const n = chain[from];
        if (themedPaintMemo.has(n)) return themedPaintMemo.get(n);
        let bg = '';
        try { bg = getComputedStyle(n).backgroundColor; } catch (e) {}
        const c = H.parseCssRgb(bg);
        const out = c && c.a >= 0.5 ? bg : themedPaintFrom(chain, from + 1);
        themedPaintMemo.set(n, out);
        return out;
    }

    // The distinct control fill: theme text mixed into the themed container
    // until it stands apart as much as the button did from its container
    // as authored (contrast clamped to 1.15..1.6): a subtle gray button
    // stays subtle, Reddit's Save stays clearly a button.
    function distinctButtonFill(themed, text, authoredContrast) {
        const target = Math.min(BUTTON_DISTINCT_MAX_CONTRAST, Math.max(BUTTON_DISTINCT_MIN_CONTRAST, authoredContrast || 0));
        let mix = null;
        for (let t = 0.04; t <= BUTTON_DISTINCT_MAX_MIX + 1e-9; t += 0.02) {
            mix = {
                r: Math.round(themed.r + (text.r - themed.r) * t),
                g: Math.round(themed.g + (text.g - themed.g) * t),
                b: Math.round(themed.b + (text.b - themed.b) * t),
                a: 1,
            };
            if (H.fillContrast(mix, themed) >= target) break;
        }
        return mix;
    }

    function revertButtonPaints() {
        Array.from(buttonPaints.keys()).forEach(b => releaseButtonPaint(b));
        buttonPaints.clear();
        buttonFillKept.clear();
    }

    function settleStateControls(controls) {
        if (!controls.length || !currentTheme || !H || !H.stateControlDecision) return;
        const themeBg = currentTheme.background || '#121212';
        const groups = [];
        const parts = [];
        for (let c = 0; c < controls.length; c++) {
            const ctrl = controls[c];
            if (!ctrl.isConnected) continue;
            const nodes = [ctrl];
            const inner = ctrl.querySelectorAll('*');
            for (let k = 0; k < inner.length && nodes.length < STATE_CONTROL_MAX_NODES; k++) nodes.push(inner[k]);
            // Lift our own earlier writes first: the state may have flipped.
            for (let k = 0; k < nodes.length; k++) {
                if (stateControlModified.has(nodes[k])) {
                    nodes[k].style.removeProperty('background-color');
                    stateControlModified.delete(nodes[k]);
                }
            }
            if (!isStateControlElement(ctrl)) continue;
            groups.push([ctrl, nodes, parts.length]);
            for (let k = 1; k < nodes.length; k++) parts.push(nodes[k]);
        }
        // The control itself isn't stripped (stateNot); the parts inside it
        // are, so their fill comes from the authored-paint probe (one batch).
        const partPaints = parts.length ? readAuthoredPaint(parts) : [];
        const writes = [];
        for (let g = 0; g < groups.length; g++) {
            const [ctrl, nodes, offset] = groups[g];
            const checked = ctrl.getAttribute('aria-checked');
            const on = checked === 'true' || checked === 'mixed' || ctrl.getAttribute('aria-selected') === 'true';
            // Inside a kept (brand) fill the site's own paint stays: a white
            // check mark on a purple box.
            const kept = [];
            for (let k = 0; k < nodes.length; k++) {
                const el = nodes[k];
                if (kept.some(x => x !== el && x.contains(el))) continue;
                let fill;
                try {
                    fill = H.parseCssRgb(k === 0 ? getComputedStyle(el).backgroundColor : (partPaints[offset + k - 1] || {}).bg);
                } catch (e) { continue; }
                if (!fill || fill.a < 0.5) continue;
                const d = H.stateControlDecision({ fill, on, themeBg });
                if (d === 'keep') {
                    kept.push(el);
                    // A part's own fill was stripped: put the authored one back.
                    if (k > 0) writes.push(el, 'rgba(' + fill.r + ', ' + fill.g + ', ' + fill.b + ', ' + fill.a + ')');
                } else if (d === 'highlight') {
                    writes.push(el, STATE_HIGHLIGHT);
                } else if (k === 0) {
                    writes.push(el, 'transparent');
                }
            }
        }
        for (let k = 0; k < writes.length; k += 2) {
            writes[k].style.setProperty('background-color', writes[k + 1], 'important');
            stateControlModified.add(writes[k]);
        }
    }

    function revertStateControls() {
        stateControlModified.forEach(el => {
            try { el.style.removeProperty('background-color'); } catch (e) {}
        });
        stateControlModified.clear();
    }

    // 3d-ter. MASK ELEMENTS — a small absolutely positioned element painted
    // its container's color to hide a line under it: a floating label on an
    // outlined input's top border, the square that cuts a comment thread
    // line off below the last reply. Kept as authored it's a white box on a
    // light theme or a black square on a site in its own dark mode; cleared
    // (a div, or the bright pass on dark themes) the line runs through it.
    // It takes the themed color of what's behind it instead. Nominated in
    // the walk by cheap reads (position, size); the line check, the
    // authored-paint probe (the mask and its ancestors, one batch) and the
    // writes run in one step after the walk.
    // Same rule, second shape (Session 8b, G-6): a stacked cover, a
    // relative z-indexed bar inside an absolutely positioned container,
    // painted its container's color so the content it's lifted over
    // doesn't show (Google's AI Overview "Show more" backing, .zNsLfb).
    // No line check: if nothing is under it, the themed color is what
    // showed through anyway.
    // el -> [site inline background-color, priority]
    const maskPaints = new Map();
    const stackedMasks = new WeakSet();
    const MASK_MAX_PER_PASS = 120;
    const MASK_MAX_NEIGHBORS = 24;
    const MASK_ANCESTOR_DEPTH = 6;

    function maskParentOf(n) {
        return n.parentElement || (n.parentNode && n.parentNode.host) || null;
    }

    function isStackedCover(el, style) {
        const z = parseInt(style.zIndex, 10);
        if (style.position !== 'relative' || !(z > 0)) return false;
        for (let n = el.parentElement, d = 0; n && d < 2; n = n.parentElement, d++) {
            let pos = '';
            try { pos = getComputedStyle(n).position; } catch (e) { return false; }
            if (pos === 'absolute') return true;
        }
        return false;
    }

    // The longest transition (duration + delay) among els, capped at 1 s.
    function longestTransitionMs(els) {
        const ms = (v) => {
            const n = parseFloat(v);
            return isNaN(n) ? 0 : (/ms$/.test(v) ? n : n * 1000);
        };
        let longest = 0;
        for (let i = 0; i < els.length; i++) {
            let cs;
            try { cs = getComputedStyle(els[i]); } catch (e) { continue; }
            const durs = String(cs.transitionDuration || '').split(',');
            const delays = String(cs.transitionDelay || '').split(',');
            for (let j = 0; j < durs.length; j++) {
                longest = Math.max(longest, ms(durs[j].trim()) + ms((delays[j % delays.length] || '0s').trim()));
            }
        }
        return Math.min(longest, 1000);
    }

    function visitMaskElement(el, out) {
        if (out.length >= MASK_MAX_PER_PASS) return;
        if (maskPaints.has(el)) { out.push(el); return; }
        if (H.BRIGHT_SKIP_TAGS && H.BRIGHT_SKIP_TAGS[el.tagName]) return;
        if (layerPaints.has(el) || buttonPaints.has(el) || isButtonLikeElement(el)) return;
        let style;
        try { style = getComputedStyle(el); } catch (e) { return; }
        if (style.display === 'none' || style.visibility === 'hidden') return;
        if (style.position !== 'absolute') {
            if (style.position !== 'relative' || style.zIndex === 'auto') return;
            let rect;
            try { rect = el.getBoundingClientRect(); } catch (e) { return; }
            if (H.isStackedCoverShape && H.isStackedCoverShape(rect) && isStackedCover(el, style)) {
                stackedMasks.add(el);
                out.push(el);
            }
            return;
        }
        let rect;
        try { rect = el.getBoundingClientRect(); } catch (e) { return; }
        if (H.isMaskShape(rect)) out.push(el);
    }

    function visibleBorder(cs, side) {
        const st = cs['border' + side + 'Style'];
        if (!st || st === 'none' || st === 'hidden') return 0;
        const c = H.parseCssRgb(cs['border' + side + 'Color']);
        if (!c || c.a < 0.2) return 0;
        return parseFloat(cs['border' + side + 'Width']) || 0;
    }

    function maskNeighbors(el) {
        const container = el.parentNode;
        if (!container) return [];
        const list = [];
        if (container.nodeType === 1) list.push(container);
        const kids = container.children || [];
        for (let i = 0; i < kids.length && list.length < MASK_MAX_NEIGHBORS; i++) {
            if (kids[i] !== el) list.push(kids[i]);
        }
        // One level up too (Session 8c, F-4): an outlined field often draws
        // its box as a sibling of the input's wrapper (Google sign-in:
        // .Xb9hP > input + label, its outline .mIZh1c beside .Xb9hP), so the
        // line the label sits on isn't next to the label itself.
        const outer = container.nodeType === 1 ? container.parentElement : null;
        const outerKids = outer && outer !== document.body ? outer.children : [];
        for (let i = 0; i < outerKids.length && list.length < MASK_MAX_NEIGHBORS; i++) {
            if (outerKids[i] !== container) list.push(outerKids[i]);
        }
        const out = [];
        for (let i = 0; i < list.length; i++) {
            const n = list[i];
            if (H.BRIGHT_SKIP_TAGS && H.BRIGHT_SKIP_TAGS[n.tagName] && n.tagName !== 'INPUT' && n.tagName !== 'TEXTAREA' && n.tagName !== 'SELECT') continue;
            let cs, r;
            try { cs = getComputedStyle(n); r = n.getBoundingClientRect(); } catch (e) { continue; }
            const bg = H.parseCssRgb(cs.backgroundColor);
            out.push({
                rect: r,
                top: visibleBorder(cs, 'Top'),
                right: visibleBorder(cs, 'Right'),
                bottom: visibleBorder(cs, 'Bottom'),
                left: visibleBorder(cs, 'Left'),
                hairline: !!(bg && bg.a >= 0.5),
            });
        }
        return out;
    }

    // A floating label beside the field that has focus (Session 8c, F-2):
    // it takes its fill on :focus and moves onto the border with a
    // transition, so where it is now says nothing (mid-field when the focus
    // settle runs; on the phone the settle after the transition didn't
    // catch it either). The fill test below still decides: only a label
    // that paints what's behind it is a mask. On blur the line check is
    // back, and a label resting inside the box is released.
    function isLabelOfFocusedField(el) {
        const active = document.activeElement;
        if (!active || active === el || active.parentElement !== el.parentElement) return false;
        const tag = active.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || active.isContentEditable === true;
    }

    function releaseMaskPaint(el) {
        const saved = maskPaints.get(el);
        if (!saved) return;
        try {
            if (saved[0]) el.style.setProperty('background-color', saved[0], saved[1]);
            else el.style.removeProperty('background-color');
        } catch (e) {}
        maskPaints.delete(el);
    }

    // fresh: read the authored paint again instead of the per-class cache.
    // A focus change repaints through :focus / :focus-within with no class
    // change (Urban Plates' label is transparent at rest and fills on
    // focus), so the cached rest paint said "no fill" for as long as the
    // field had focus (F-2 on the phone, found Session 8c).
    function settleMasks(cands, fresh) {
        if (!cands.length || !currentTheme || !H || !H.isMaskOverLine) return;
        const masks = [];
        for (let i = 0; i < cands.length; i++) {
            const el = cands[i];
            let rect;
            try { rect = el.isConnected ? el.getBoundingClientRect() : null; } catch (e) { rect = null; }
            if (rect && (stackedMasks.has(el)
                ? H.isStackedCoverShape(rect) && !layerPaints.has(el) && isStackedCover(el, getComputedStyle(el))
                : H.isMaskShape(rect) && (isLabelOfFocusedField(el) || H.isMaskOverLine(rect, maskNeighbors(el))))) masks.push(el);
            else releaseMaskPaint(el);
        }
        if (!masks.length) return;
        const chains = masks.map(el => {
            const chain = [];
            for (let n = maskParentOf(el), d = 0; n && d < MASK_ANCESTOR_DEPTH
                && n !== document.body && n !== document.documentElement; n = maskParentOf(n), d++) chain.push(n);
            return chain;
        });
        const own = readAuthoredPaint(masks, fresh);
        const flat = [].concat(...chains);
        const ancestorPaint = flat.length ? readAuthoredPaint(flat, fresh) : [];
        const writes = [];
        for (let i = 0, k = 0; i < masks.length; k += chains[i].length, i++) {
            const chain = chains[i];
            let behind = null;
            for (let j = 0; j < chain.length && !behind; j++) {
                const c = H.parseCssRgb(ancestorPaint[k + j] && ancestorPaint[k + j].bg);
                if (c && c.a >= 0.5) behind = c;
            }
            if (!H.isMaskFill(H.parseCssRgb(own[i] && own[i].bg), behind)) {
                releaseMaskPaint(masks[i]);
                continue;
            }
            // What's behind it now, themed: the nearest ancestor that paints
            // (a layer the engine painted, a kept card), else the page.
            let color = 'var(--aura-bg)';
            for (let j = 0; j < chain.length; j++) {
                let bg = '';
                try { bg = getComputedStyle(chain[j]).backgroundColor; } catch (e) { continue; }
                const c = H.parseCssRgb(bg);
                if (c && c.a >= 0.5) { color = bg; break; }
            }
            writes.push(masks[i], color);
        }
        for (let i = 0; i < writes.length; i += 2) {
            const el = writes[i];
            if (!maskPaints.has(el)) {
                maskPaints.set(el, [el.style.getPropertyValue('background-color'), el.style.getPropertyPriority('background-color')]);
            }
            if (el.style.getPropertyValue('background-color') !== writes[i + 1]
                || el.style.getPropertyPriority('background-color') !== 'important') {
                el.style.setProperty('background-color', writes[i + 1], 'important');
            }
        }
    }

    // 3d-quater. BLENDED MEDIA — product photos multiplied onto a light tile
    // (Amazon): the white of the shot drops out into the tile's gray. With
    // the tile stripped on a dark theme they multiply with the dark page
    // and turn nearly black. The sheet has always set `img { mix-blend-mode:
    // normal }`; a blend on a wrapper around the photo (a div, <picture>)
    // gets the same here, so the photo shows on its own white background
    // like a bare <img>. Light themes keep the blend (it still drops out
    // into a light page, as with Aura off).
    const blendNeutralized = new Set();
    const DARKENING_BLENDS = { multiply: 1, darken: 1, 'color-burn': 1 };
    const BLEND_MEDIA_SELECTOR = 'img, picture, video, canvas, svg';

    function visitBlendElement(el) {
        if (blendNeutralized.has(el)) {
            if (!currentTheme || (H.isThemeBackgroundLight && H.isThemeBackgroundLight(currentTheme.background || '#121212'))) {
                try { el.style.removeProperty('mix-blend-mode'); } catch (e) {}
                blendNeutralized.delete(el);
            }
            return;
        }
        if (H.BRIGHT_SKIP_TAGS && H.BRIGHT_SKIP_TAGS[el.tagName] && el.tagName !== 'SVG') return;
        let mode;
        try { mode = getComputedStyle(el).mixBlendMode; } catch (e) { return; }
        if (!DARKENING_BLENDS[mode]) return;
        if (H.isThemeBackgroundLight && H.isThemeBackgroundLight(currentTheme.background || '#121212')) return;
        let media = el.tagName === 'PICTURE';
        try { media = media || !!el.querySelector(BLEND_MEDIA_SELECTOR); } catch (e) {}
        if (!media) return;
        el.style.setProperty('mix-blend-mode', 'normal', 'important');
        blendNeutralized.add(el);
    }

    function revertBlendedMedia() {
        blendNeutralized.forEach(el => { try { el.style.removeProperty('mix-blend-mode'); } catch (e) {} });
        blendNeutralized.clear();
    }

    function revertMaskPaints() {
        Array.from(maskPaints.keys()).forEach(releaseMaskPaint);
        maskPaints.clear();
        revertBorderPaints();
    }

    // 3d-ter-bis. SUBTLE LIGHT BORDERS (Session 8b, F-3) — a card's light
    // hairline (#e9e9e9 on #fff) is a bright line once the card is themed
    // dark: the white lines up Urban Plates' checkout card. A border that
    // barely differs from the authored fill it edges takes --aura-border.
    // Dark themes only (on a light theme the authored line still reads);
    // controls keep theirs (an input's outline is its shape). Nominated by
    // cheap reads in the walk, decided in one probe batch after it.
    const borderPaints = new Map();      // el -> [site inline border-color, priority]
    const authoredBorders = new WeakMap(); // el -> { key: probeKey, color: the site's border (parsed) }
    const BORDER_MAX_PER_PASS = 80;
    const BORDER_SIDES = ['Top', 'Right', 'Bottom', 'Left'];

    function visitBorderElement(el, out) {
        if (out.length >= BORDER_MAX_PER_PASS) return;
        if (borderPaints.has(el)) { out.push([el, null]); return; }
        if (H.BRIGHT_SKIP_TAGS && H.BRIGHT_SKIP_TAGS[el.tagName]) return;
        if (isButtonLikeElement(el)) return;
        let cs;
        try { cs = getComputedStyle(el); } catch (e) { return; }
        for (let i = 0; i < 4; i++) {
            const s = BORDER_SIDES[i];
            if (cs['border' + s + 'Style'] === 'none' || !(parseFloat(cs['border' + s + 'Width']) > 0)) continue;
            // A border in the text's color (currentColor: an icon's ring)
            // is the element's shape, not a hairline.
            if (cs['border' + s + 'Color'] === cs.color) continue;
            const c = H.parseCssRgb(cs['border' + s + 'Color']);
            // Light only here; the fill it's compared with is read in settle.
            if (c && c.a >= 0.5 && H.relativeLuminance(c.r, c.g, c.b) >= 0.7) { out.push([el, c]); return; }
        }
    }

    function releaseBorderPaint(el) {
        const saved = borderPaints.get(el);
        if (!saved) return;
        try {
            if (saved[0]) el.style.setProperty('border-color', saved[0], saved[1]);
            else el.style.removeProperty('border-color');
        } catch (e) {}
        borderPaints.delete(el);
    }

    function revertBorderPaints() {
        Array.from(borderPaints.keys()).forEach(releaseBorderPaint);
    }

    function settleBorders(cands) {
        if (!cands.length || !currentTheme || !H || !H.isSubtleLightBorder) return;
        if (H.isThemeBackgroundLight && H.isThemeBackgroundLight(currentTheme.background || '#121212')) {
            cands.forEach(([el]) => releaseBorderPaint(el));
            return;
        }
        // Our own border-color is lifted for the read (a re-check of a
        // painted card reads the site's border again), unless the element's
        // class is the one its border was read with: lifting, reading and
        // re-writing every painted card cost two style recalcs a pass
        // (Session 8c, Airbnb: 50-85 ms), like the probe's cache key.
        const els = cands.map(([el]) => el);
        const borders = new Array(els.length);
        const read = [];
        els.forEach((el, i) => {
            const known = authoredBorders.get(el);
            if (known && known.key === probeKey(el)) borders[i] = known.color;
            else read.push(i);
        });
        const lifted = read.map(i => borderPaints.has(els[i]) ? els[i].style.getPropertyValue('border-color') : null);
        read.forEach((i, r) => { if (lifted[r] != null) els[i].style.removeProperty('border-color'); });
        read.forEach(i => {
            const el = els[i];
            let color = null;
            try {
                const cs = getComputedStyle(el);
                for (let k = 0; k < 4; k++) {
                    const s = BORDER_SIDES[k];
                    if (cs['border' + s + 'Style'] !== 'none' && parseFloat(cs['border' + s + 'Width']) > 0) {
                        color = cs['border' + s + 'Color'] === cs.color ? null : H.parseCssRgb(cs['border' + s + 'Color']);
                        break;
                    }
                }
            } catch (e) {}
            borders[i] = color;
            authoredBorders.set(el, { key: probeKey(el), color });
        });
        read.forEach((i, r) => { if (lifted[r] != null) els[i].style.setProperty('border-color', lifted[r], 'important'); });
        const chains = els.map(el => {
            const chain = [el];
            for (let n = maskParentOf(el), d = 0; n && d < MASK_ANCESTOR_DEPTH
                && n !== document.body && n !== document.documentElement; n = maskParentOf(n), d++) chain.push(n);
            return chain;
        });
        const paints = readAuthoredPaint([].concat(...chains));
        for (let i = 0, k = 0; i < els.length; k += chains[i].length, i++) {
            const el = els[i];
            let fill = null;
            for (let j = 0; j < chains[i].length && !fill; j++) {
                const c = H.parseCssRgb(paints[k + j] && paints[k + j].bg);
                if (c && c.a >= 0.5) fill = c;
            }
            if (!el.isConnected || !H.isSubtleLightBorder(borders[i], fill)) { releaseBorderPaint(el); continue; }
            if (!borderPaints.has(el)) borderPaints.set(el, [el.style.getPropertyValue('border-color'), el.style.getPropertyPriority('border-color')]);
            if (el.style.getPropertyValue('border-color') !== 'var(--aura-border)') {
                snapNextWrite(el);
                el.style.setProperty('border-color', 'var(--aura-border)', 'important');
            }
        }
    }

    // 3d-quinquies. FADES — a gradient from transparent into the color of
    // what it sits on, laid over the end of a scrolling row or of clipped
    // text (GitHub's carousel rows, Airbnb's category row, WebMD's tab row:
    // ::before/::after; Google's AI Overview "Show more" collapse: a div).
    // The strip leaves gradients alone, so a white fade stayed white on a
    // dark page; a large div fade was cleared as a layout gradient, so the
    // collapsed text ran under the "Show more" button (G-6). Same idea as
    // the mask rule: when the fade's opaque color matches the authored
    // paint behind it, repaint the gradient in the themed color of what's
    // behind it now (H.themeGradient keeps each stop's alpha). Anything
    // else (a dark text scrim over a photo) keeps its authored gradient.
    // Element fades are written inline; pseudo-element fades as rules in
    // the pseudo override sheet (document only: that sheet doesn't reach
    // into shadow roots).
    const fadePaints = new Map();        // element -> saved inline background-image
    const fadePseudoRules = new Map();   // "token::before" -> rule
    let fadeTokenCounter = 0;
    const FADE_MAX_PER_PASS = 80;
    const FADE_ANCESTOR_DEPTH = 8;

    function isFadePaint(bg, img) {
        return !!(img && img !== 'none' && H.classifyAuthoredPaint
            && H.classifyAuthoredPaint({ bg, img }, 'layer') === 'fade');
    }

    // Nominates [el, pseudo|null, img]. Pseudo-elements are read only on
    // positioned hosts: an absolutely positioned fade is laid out against
    // its host, and reading ::before/::after on every static element would
    // double the walk's style reads.
    function visitFadeElement(el, out) {
        if (out.length >= FADE_MAX_PER_PASS) return;
        if (H.BRIGHT_SKIP_TAGS && H.BRIGHT_SKIP_TAGS[el.tagName] && el.tagName !== 'BUTTON') return;
        let cs;
        try { cs = getComputedStyle(el); } catch (e) { return; }
        if (fadePaints.has(el)) {
            out.push([el, null]);
        } else if (cs.backgroundImage !== 'none' && isFadePaint(cs.backgroundColor, cs.backgroundImage)) {
            out.push([el, null]);
        } else if (cs.position === 'absolute' && !el.firstChild) {
            // An empty overlay whose gradient one of our rules hides (the
            // Google answer-card rule clears every block's background-image,
            // the AI Overview's collapse fade included): settleFades reads
            // its authored paint through the probe.
            out.push([el, null]);
        }
        if (cs.position === 'static' || el.getRootNode() !== document) return;
        for (let i = 0; i < 2; i++) {
            const pseudo = i === 0 ? '::before' : '::after';
            const token = el.getAttribute('data-aura-fade');
            if (token && fadePseudoRules.has(token + pseudo)) { out.push([el, pseudo]); continue; }
            let ps;
            try { ps = getComputedStyle(el, pseudo); } catch (e) { continue; }
            if (ps.content === 'none' || ps.content === 'normal' || ps.backgroundImage === 'none') continue;
            if (ps.position !== 'absolute' && ps.position !== 'fixed') continue;
            if (isFadePaint(ps.backgroundColor, ps.backgroundImage)) out.push([el, pseudo]);
        }
    }

    function writeFadePseudoRules() {
        pseudoBgRulesByToken.set('fades', Array.from(fadePseudoRules.values()).join('\n'));
        const css = Array.from(pseudoBgRulesByToken.values()).join('\n');
        const sheet = ensurePseudoBgStyleEl();
        if (sheet.textContent !== css) sheet.textContent = css;
    }

    function releaseFade(el, pseudo) {
        if (pseudo) {
            const token = el.getAttribute('data-aura-fade');
            return !!(token && fadePseudoRules.delete(token + pseudo));
        }
        const saved = fadePaints.get(el);
        if (!saved) return false;
        try {
            if (saved[0]) el.style.setProperty('background-image', saved[0], saved[1]);
            else el.style.removeProperty('background-image');
        } catch (e) {}
        fadePaints.delete(el);
        return false;
    }

    function settleFades(cands) {
        if (!cands.length || !currentTheme || !H || !H.gradientFadeColor) return;
        // The authored gradient: element fades are read through the probe
        // (our inline repaint is lifted); a pseudo-element's gradient is
        // read with our rule off.
        const els = [];
        const elIndex = new Map();
        const pseudos = [];
        for (let i = 0; i < cands.length; i++) {
            const [el, pseudo] = cands[i];
            if (!el.isConnected) { releaseFade(el, pseudo); continue; }
            if (pseudo) pseudos.push(i);
            else if (!elIndex.has(el)) { elIndex.set(el, els.length); els.push(el); }
        }
        let rulesChanged = false;
        const pseudoImg = new Map();
        if (pseudos.length) {
            const sheet = pseudoBgStyleEl;
            if (sheet && fadePseudoRules.size) sheet.disabled = true;
            for (const i of pseudos) {
                const [el, pseudo] = cands[i];
                let ps;
                try { ps = getComputedStyle(el, pseudo); } catch (e) { continue; }
                pseudoImg.set(i, isFadePaint(ps.backgroundColor, ps.backgroundImage) ? ps.backgroundImage : null);
            }
            if (sheet) sheet.disabled = false;
        }
        const own = els.length ? readAuthoredPaint(els) : [];
        // What each fade sits on: the host for a pseudo-element, else the
        // parent, up the tree.
        const chains = cands.map(([el, pseudo]) => {
            const chain = [];
            for (let n = pseudo ? el : maskParentOf(el), d = 0; n && d < FADE_ANCESTOR_DEPTH
                && n !== document.body && n !== document.documentElement; n = maskParentOf(n), d++) chain.push(n);
            return chain;
        });
        const flat = [].concat(...chains);
        const behindPaint = flat.length ? readAuthoredPaint(flat) : [];
        for (let i = 0, k = 0; i < cands.length; k += chains[i].length, i++) {
            const [el, pseudo] = cands[i];
            if (!el.isConnected) continue;
            const o = pseudo ? null : own[elIndex.get(el)];
            // A cover over the element's own fill (scroll shadows) fades
            // into that fill, which the strip removed: it sits on that.
            let selfFill = o && !isFadePaint(o.bg, o.img) && H.selfCoverFadeFill ? H.selfCoverFadeFill(o) : null;
            // Only once that fill is gone (a kept fill keeps its covers).
            if (selfFill) {
                let live = null;
                try { live = H.parseCssRgb(getComputedStyle(el).backgroundColor); } catch (e) {}
                if (live && live.a >= 0.5) selfFill = null;
            }
            const img = pseudo ? pseudoImg.get(i) : (o && (selfFill || isFadePaint(o.bg, o.img)) ? o.img : null);
            const chain = chains[i];
            // What it sits on: the nearest authored fill. A photo (a url()
            // background) first means it's a text scrim over an image, not
            // a fade into the page: kept as authored.
            let behind = selfFill;
            let onImage = false;
            for (let j = 0; j < chain.length && !behind && !onImage; j++) {
                const p = behindPaint[k + j];
                const c = H.parseCssRgb(p && p.bg);
                if (c && c.a >= 0.5) behind = c;
                else if (p && p.img && /url\(/i.test(p.img)) onImage = true;
            }
            if (!img || onImage || !H.isMaskFill(H.gradientFadeColor(img), behind)) {
                if (releaseFade(el, pseudo)) rulesChanged = true;
                continue;
            }
            // Fade into what's behind it now: the nearest painted node (a
            // themed layer, a kept card or button), else the page. A
            // button's own pseudo fade (Airbnb's row arrow) fades the row
            // into what's behind the button, not into the button.
            let color = 'var(--aura-bg)';
            const from = pseudo && isButtonLikeElement(el) ? 1 : 0;
            for (let j = from; j < chain.length; j++) {
                let bg = '';
                try { bg = getComputedStyle(chain[j]).backgroundColor; } catch (e) { continue; }
                const c = H.parseCssRgb(bg);
                if (c && c.a >= 0.5) { color = bg; break; }
            }
            const themed = H.themeGradient(img, color);
            if (!themed) continue;
            if (pseudo) {
                let token = el.getAttribute('data-aura-fade');
                if (!token) { token = String(++fadeTokenCounter); el.setAttribute('data-aura-fade', token); }
                const rule = `[data-aura-fade="${token}"]${pseudo} { background-image: ${themed} !important; }`;
                if (fadePseudoRules.get(token + pseudo) !== rule) { fadePseudoRules.set(token + pseudo, rule); rulesChanged = true; }
            } else {
                if (!fadePaints.has(el)) fadePaints.set(el, [el.style.getPropertyValue('background-image'), el.style.getPropertyPriority('background-image')]);
                if (el.style.getPropertyValue('background-image') !== themed || el.style.getPropertyPriority('background-image') !== 'important') {
                    el.style.setProperty('background-image', themed, 'important');
                }
            }
        }
        if (rulesChanged) writeFadePseudoRules();
    }

    // 3d-sexies. BACKGROUND IMAGES UNDER TEXT (X-10, decided Nov 14) — a
    // large text section painted with a url() background keeps it while its
    // text is themed (light on a dark theme): WebMD's drug-page hero is
    // near-white decorative art under now-white text. A decorative image
    // (flat: its pixels barely vary) is dropped so the section themes like
    // any stripped fill; a photo, or an image that can't be read (no CORS),
    // is kept with a scrim of the theme color under the text. The image is
    // sampled once per URL, off the pass (async decode).
    const bgImagePaints = new Map();     // element -> { saved: [value, priority], wrote }
    const bgImageStats = new Map();      // url -> 'pending' | { flat: bool } | null (unreadable)
    const bgImageWaiting = new Map();    // url -> Set of elements
    const BG_IMAGE_MAX_PER_PASS = 12;
    const BG_IMAGE_MIN_TEXT = 20;
    const BG_IMAGE_FLAT_MAX_SD = 14;
    const BG_IMAGE_SCRIM = 'linear-gradient(color-mix(in srgb, var(--aura-bg) 62%, transparent), color-mix(in srgb, var(--aura-bg) 62%, transparent))';
    const URL_IN_BG_RE = /url\(\s*["']?([^"')]+)["']?\s*\)/i;

    function visitBackgroundImageElement(el, vh, vw, out) {
        if (out.length >= BG_IMAGE_MAX_PER_PASS) return;
        if (H.BRIGHT_SKIP_TAGS && H.BRIGHT_SKIP_TAGS[el.tagName]) return;
        if (el === document.documentElement || el === document.body) return;
        const rec = bgImagePaints.get(el);
        let cs;
        try { cs = getComputedStyle(el); } catch (e) { return; }
        const img = cs.backgroundImage;
        if (rec) {
            // Still ours: nothing to do. Rewritten by the site: decide again.
            if (img === rec.wrote) return;
            releaseBackgroundImage(el);
        }
        if (!img || img === 'none' || !URL_IN_BG_RE.test(img) || /gradient\(/i.test(img)) return;
        let rect;
        try { rect = el.getBoundingClientRect(); } catch (e) { return; }
        if (rect.width < vw * 0.5 || rect.height < 80) return;
        let text = 0;
        try { text = String(el.textContent || '').trim().length; } catch (e) {}
        if (text < BG_IMAGE_MIN_TEXT) return;
        out.push([el, img]);
    }

    function sampleBackgroundImage(url) {
        bgImageStats.set(url, 'pending');
        const done = (stats) => {
            bgImageStats.set(url, stats);
            const els = bgImageWaiting.get(url);
            bgImageWaiting.delete(url);
            if (!els || !currentTheme) return;
            els.forEach(el => { if (el.isConnected) applyBackgroundImageDecision(el, url); });
            discardOwnMutationRecords();
        };
        try {
            const im = new Image();
            im.crossOrigin = 'anonymous';
            im.onload = () => {
                let stats = null;
                try {
                    const c = document.createElement('canvas');
                    c.width = 24;
                    c.height = 24;
                    const x = c.getContext('2d');
                    x.drawImage(im, 0, 0, 24, 24);
                    const d = x.getImageData(0, 0, 24, 24).data;
                    let s = 0, s2 = 0, n = 0;
                    for (let i = 0; i < d.length; i += 4) {
                        if (d[i + 3] < 128) continue;
                        const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
                        s += l; s2 += l * l; n++;
                    }
                    if (n) {
                        const mean = s / n;
                        stats = { flat: Math.sqrt(Math.max(0, s2 / n - mean * mean)) <= BG_IMAGE_FLAT_MAX_SD };
                    }
                } catch (e) { stats = null; }
                done(stats);
            };
            im.onerror = () => done(null);
            im.src = url;
        } catch (e) {
            done(null);
        }
    }

    function applyBackgroundImageDecision(el, url) {
        const stats = bgImageStats.get(url);
        if (stats === 'pending' || stats === undefined) return;
        let rec = bgImagePaints.get(el);
        if (!rec) {
            rec = { saved: [el.style.getPropertyValue('background-image'), el.style.getPropertyPriority('background-image')], wrote: '' };
            bgImagePaints.set(el, rec);
        }
        let authored = '';
        try { authored = getComputedStyle(el).backgroundImage; } catch (e) { return; }
        const value = stats && stats.flat ? 'none' : BG_IMAGE_SCRIM + ', ' + authored;
        el.style.setProperty('background-image', value, 'important');
        rec.wrote = el.style.getPropertyValue('background-image') === 'none' ? 'none' : getComputedStyle(el).backgroundImage;
    }

    function settleBackgroundImages(cands) {
        if (!cands.length || !currentTheme) return;
        for (let i = 0; i < cands.length; i++) {
            const [el, img] = cands[i];
            const m = URL_IN_BG_RE.exec(img);
            if (!m) continue;
            let url;
            try { url = new URL(m[1], document.baseURI).href; } catch (e) { continue; }
            const stats = bgImageStats.get(url);
            if (stats === undefined || stats === 'pending') {
                if (!bgImageWaiting.has(url)) bgImageWaiting.set(url, new Set());
                bgImageWaiting.get(url).add(el);
                if (stats === undefined) sampleBackgroundImage(url);
                continue;
            }
            applyBackgroundImageDecision(el, url);
        }
    }

    function releaseBackgroundImage(el) {
        const rec = bgImagePaints.get(el);
        if (!rec) return;
        try {
            if (rec.saved[0]) el.style.setProperty('background-image', rec.saved[0], rec.saved[1]);
            else el.style.removeProperty('background-image');
        } catch (e) {}
        bgImagePaints.delete(el);
    }

    function revertBackgroundImages() {
        Array.from(bgImagePaints.keys()).forEach(releaseBackgroundImage);
        bgImageWaiting.clear();
    }

    function revertFadePaints() {
        Array.from(fadePaints.keys()).forEach(el => releaseFade(el, null));
        fadePaints.clear();
        fadePseudoRules.forEach((rule, key) => {
            const el = document.querySelector(`[data-aura-fade="${key.replace(/::.*$/, '')}"]`);
            if (el) el.removeAttribute('data-aura-fade');
        });
        fadePseudoRules.clear();
    }

    // 3e. SPA SHELL / GRADIENT SAFETY NET
    // Sites like Discord paint #app with a gradient or ID+!important fill after
    // first paint. Inline !important beats those rules; never clear photos.
    function visitShellElement(el, vh, vw) {
        if (!el || el.nodeType !== 1 || !H || !H.shouldClearShellBackground) return;
        if (el === document.documentElement || el === document.body) return;
        if (overlayModified.has(el) || layerPaints.has(el)) return;
        // shellModified is never reverted per-element anywhere (only wiped
        // entirely by removeTheme()) — this pass runs twice per safety-pass
        // invocation (once via the explicit rethemeOpaqueShells pre-pass,
        // once again in the main per-element walk), so for any element
        // already confirmed here, re-deriving style/rect and re-applying
        // the identical transparent fill is pure redundant work with no
        // possible different outcome. Skipping it is behavior-identical,
        // not a heuristic change.
        if (shellModified.has(el)) return;
        if (el.id === 'aura-core-engine' || el.id === 'aura-split-bg') return;
        if (el.closest && el.closest('#aura-split-bg')) return;

        let style;
        try { style = getComputedStyle(el); } catch (e) { return; }
        if (style.visibility === 'hidden' || style.opacity === '0') return;
        const parsed = H.parseCssRgb(style.backgroundColor);
        const opaqueFill = !!(parsed && parsed.a >= 0.5);
        // shouldClearShellBackground only clears a fill or a gradient:
        // nothing to clear, no rect or heuristics (Session 8c).
        if (!opaqueFill && style.backgroundImage === 'none') return;

        let rect;
        try { rect = el.getBoundingClientRect(); } catch (e) { return; }

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

    function rethemeOpaqueShells(root, precollected) {
        if (!root || !currentTheme || !H || !H.shouldClearShellBackground) return;
        const { vh, vw } = passViewport();
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

    function isInsidePinnedLayer(el) {
        for (let n = el; n && n !== document.body && n !== document.documentElement; n = maskParentOf(n)) {
            let pos = '';
            try { pos = getComputedStyle(n).position; } catch (e) { return false; }
            if (pos === 'fixed' || pos === 'sticky') return true;
        }
        return false;
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
            if (!hasOpaqueColor && isFadePaint(pStyle.backgroundColor, pStyle.backgroundImage)) continue;
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
            // Inside a fixed/sticky layer, a covering pseudo fill is that
            // layer's authored-opaque surface (Google's AI Mode composer
            // pill is `.d4HWzd::before`, inset 0, under a transparent
            // textarea): themed opaque, as the layer rule paints any
            // authored-opaque surface. Clearing it showed the answer
            // through the field (G-5). In page flow it's still a stale
            // card layer over themed content: cleared.
            const fill = isInsidePinnedLayer(el) ? 'var(--aura-overlay)' : 'transparent';
            pseudoBgRulesByToken.set(token,
                `[data-aura-pbg="${token}"]${matched} { background-color: ${fill} !important; background-image: none !important; }`
            );
            pseudoBgCleared.add(el);
        }
        const pseudoCss = Array.from(pseudoBgRulesByToken.values()).join('\n');
        const pseudoEl = ensurePseudoBgStyleEl();
        if (pseudoEl.textContent !== pseudoCss) pseudoEl.textContent = pseudoCss;
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
    // className at the time we cleared each loader. The re-check below has to
    // lift our override (two style mutations), so it only runs when the
    // site has actually changed the element's classes since.
    const loaderBgClassAtClear = new WeakMap();

    function revertLoaderBgElement(el) {
        try { el.style.removeProperty('background-image'); } catch (e) {}
        loaderBgModified.delete(el);
    }

    function visitLoaderBgElement(el) {
        if (!el || el.nodeType !== 1 || !H || !H.isLoaderBackgroundImageUrl) return;
        if (loaderBgModified.has(el)) {
            if (loaderBgClassAtClear.get(el) === el.className
                && el.style.getPropertyValue('background-image') === 'none') return;
            // Re-check: a site can reuse the same element for real content
            // later (a shimmer/loading container swapped to a real photo).
            // Our own override reads back as 'none' via computed style, so
            // lift it briefly to see the site's current underlying value.
            el.style.removeProperty('background-image');
            let underlying;
            try { underlying = getComputedStyle(el).backgroundImage; } catch (e) { underlying = null; }
            if (underlying && H.isLoaderBackgroundImageUrl(underlying)) {
                el.style.setProperty('background-image', 'none', 'important');
                loaderBgClassAtClear.set(el, el.className);
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
        loaderBgClassAtClear.set(el, el.className);
    }

    function clearLoaderBackgroundImages(root, precollected) {
        if (!root || !currentTheme || !H) return;
        // Re-check prior clears first — same pattern as
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
        // walk this frame.
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

    // className + text at the time each span was painted. An unchanged span
    // keeps its paint without the remove/re-set churn (four style mutations
    // per span per pass, which re-triggered the observer).
    const inlineHighlightKeyAtPaint = new WeakMap();
    function inlineHighlightKey(el) {
        let text = '';
        try { text = String(el.textContent || ''); } catch (e) {}
        return el.className + '|' + text;
    }

    function visitInlineHighlightElement(el) {
        if (!el || el.nodeType !== 1 || el.tagName !== 'SPAN' || !H || !H.isLikelyInlineHighlightSpanInfo) return;
        if (layerPaints.has(el)) return;
        if (inlineHighlightModified.has(el)) {
            if (inlineHighlightKeyAtPaint.get(el) === inlineHighlightKey(el)
                && el.style.getPropertyValue('background-color') === 'var(--aura-elevated)') return;
            el.style.removeProperty('background-color');
            el.style.removeProperty('background-image');
            el.style.removeProperty('color');
            el.style.removeProperty('-webkit-text-fill-color');
        }
        let style;
        try { style = getComputedStyle(el); } catch (e) { return; }
        // No fill, no highlight (H.isLikelyInlineHighlightSpanInfo needs
        // alpha >= 0.15): decided before the text and ancestor reads below,
        // which ran for every span (Session 8c).
        const backgroundColor = H.parseCssRgb(style.backgroundColor);
        if (!backgroundColor || !(backgroundColor.a >= 0.15)) {
            if (inlineHighlightModified.has(el)) revertInlineHighlightElement(el);
            return;
        }
        let ownText = '';
        try { ownText = String(el.textContent || '').replace(/\s+/g, ' ').trim(); } catch (e) {}
        const info = {
            tag: el.tagName,
            backgroundColor,
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
        inlineHighlightKeyAtPaint.set(el, inlineHighlightKey(el));
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

    // Re-appending our <style> is a childList mutation plus a full style
    // recalc, and Reddit/Google add styles constantly, so cap it at once per
    // PROMOTE_ENGINE_MIN_INTERVAL_MS.
    const PROMOTE_ENGINE_MIN_INTERVAL_MS = 2000;
    let lastEnginePromoteAt = 0;
    function promoteEngineStylesheet() {
        const el = document.getElementById('aura-core-engine');
        if (!el || !el.parentNode) return;
        if (el.parentNode.lastElementChild === el) return;
        const now = Date.now();
        if (now - lastEnginePromoteAt < PROMOTE_ENGINE_MIN_INTERVAL_MS) return;
        lastEnginePromoteAt = now;
        el.parentNode.appendChild(el);
    }

    // Guards a single pass so a failure in one (arbitrary third-party DOM,
    // a throwing getter, a stack overflow from a pathologically deep tree,
    // etc.) can't stop the rest of the sequence
    // — and, critically, can't prevent finish() from ever resetting
    // ignoreMutations, which would otherwise silently wedge the
    // MutationObserver into ignoring all future DOM changes on the page.
    function safePass(fn) {
        try { return fn(); } catch (e) {}
    }

    // A full pass that starts while the document is still parsing walks
    // only what has arrived (Airbnb: 1300 of 5300 elements); the rest is
    // queued for the next pass, which redoes all of it. At the end of
    // parsing that pass is restarted, or the queued records dispatched,
    // without the debounce: late-parsed first-screen text (a cookie sheet
    // at the end of <body>) stayed dark until the first pass had finished
    // (Session 8c, Load-6).
    let parsePassGen = -1;
    let parseEndListening = false;
    function watchParseEnd(gen) {
        parsePassGen = gen;
        if (parseEndListening) return;
        parseEndListening = true;
        document.addEventListener('DOMContentLoaded', () => {
            parseEndListening = false;
            if (!currentTheme) return;
            const running = parsePassGen === walkGeneration;
            parsePassGen = -1;
            if (running || pendingMutationRecords.length) runSafetyPasses(document.documentElement);
        }, { once: true });
    }

    function runSafetyPasses(root) {
        if (!root || !currentTheme) return;
        DBG?.passStart(root);
        cancelWalkSlices();
        pendingRevertReading++;
        const gen = walkGeneration;
        ignoreMutations = true;
        safePass(() => promoteEngineStylesheet());
        safePass(() => syncRootSurfaces());

        // Collected once and shared across every step below (previously each
        // of the 7 full-element walks re-queried `root.querySelectorAll('*')`
        // independently — 7 full-document scans per single reactive
        // repaint). Safe to share: none of the passes fed this array
        // structurally mutate `root`'s light-DOM subtree (verified directly
        // — they only ever write inline style/attributes); the couple that
        // DO touch the DOM tree (promoteEngineStylesheet reordering the
        // engine's own <style>, ensurePseudoBgStyleEl appending an
        // #aura-pseudo-overrides <style> to <head>) never touch elements any
        // pass below cares about.
        // A full-document pass covers every mutation queued before it
        // collects its elements (parser records from before the theme was
        // applied, for one): they must not start another pass.
        if (root === document.documentElement) {
            pendingMutationRecords = [];
            if (mutationDebounceTimer) { clearTimeout(mutationDebounceTimer); mutationDebounceTimer = null; }
        }
        nestedButtons = [];
        const elements = collectElements(root);
        if (root === document.documentElement) {
            fullPassCollected = true;
            if (document.readyState === 'loading') watchParseEnd(gen);
        }
        const capped = elements.length > WALK_SLICE ? elements.slice(0, WALK_SLICE) : elements;
        DBG?.passElements(elements.length);
        // Shared across every isLikelyModalCard call this invocation makes
        // (visitOverlayModalWalk/
        // visitBrightElement/visitStickyElement in the element walk)
        // — see isLikelyModalCardCached's doc comment.
        const modalCardCache = new WeakMap();
        const { vh, vw } = passViewport();
        const overlaySeen = new Set();
        const iconCandidates = [];
        const popoverCandidates = [];
        const buttonCandidates = [];
        const stateCandidates = [];
        const maskCandidates = [];
        const fadeCandidates = [];
        const bgImageCandidates = [];
        const borderCandidates = [];
        const darkTheme = !(H.isThemeBackgroundLight && H.isThemeBackgroundLight(currentTheme.background || '#121212'));
        const skipContrast = isActiveSplitTheme(currentTheme);
        const navSweep = navSignalSweep(elements);
        let effectiveBgCache = null;

        function finish() {
            if (gen !== walkGeneration) return;
            if (parsePassGen === gen) parsePassGen = -1;
            DBG?.passEnd();
            safePass(() => paintGoogleImagesViewer(root));
            discardOwnMutationRecords();
            if (ignoreMutationsTimer) clearTimeout(ignoreMutationsTimer);
            ignoreMutationsTimer = setTimeout(() => {
                ignoreMutations = false;
                ignoreMutationsTimer = null;
                // Mutations (including synthetic ones pushed by the
                // 'change'/'transitionend'/'toggle' listeners) that arrived
                // while this pass was running were queued, not dropped —
                // re-arm the same debounce path so they're not lost.
                // ignoreMutations is already false at this point (just
                // cleared above), so scheduleSafetyPassDispatch will
                // actually arm the timer.
                if (pendingMutationRecords.length && !mutationDebounceTimer) {
                    scheduleSafetyPassDispatch();
                }
            }, 50);
        }

        // Shadow roots and same-origin iframes first, as before (each one is
        // its own step, expanded by shadowRootSteps into sliced sub-steps).
        const steps = [];
        // Tracked layer roots the mutations landed inside of (a late donate
        // banner in a drawer, a class flip on a header's inner row) are
        // re-evaluated even when this pass is scoped below them.
        if (pendingLayerRecheck.size) {
            const recheck = Array.from(pendingLayerRecheck).filter(r => !root.contains(r));
            pendingLayerRecheck.clear();
            if (recheck.length) steps.push(() => recheckLayerRoots(recheck));
        }
        // All elements, not the capped list: fixed banners and bottom bars
        // are usually appended at the end of <body>, past the cap, yet on
        // the first screen (Airbnb's cookie sheet: element 5000 of 5341).
        // The collect step is one rect read per element.
        if (!skipContrast) steps.push(...firstScreenContrastSteps(elements, vh));
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            if (el.shadowRoot) steps.push(() => shadowRootSteps(el));
            if (el.tagName === 'IFRAME') steps.push(() => visitSameOriginIframe(el));
        }
        steps.push(
            // AMP (and other custom-element-heavy) pages route real content
            // through hyphenated tags like <amp-layout>/<i-amphtml-wrapper>
            // that the universal `div, section, ... { transparent }`
            // stylesheet rule (getFullStyleSheet's layoutTags list) can never
            // match by name. rethemeOpaqueShells extends the same "clear
            // large opaque shells" treatment to any large custom element via
            // shouldClearShellBackground / isCustomLayoutElement (SPA roots
            // like #app/#root/#__next included, since they're just elements
            // in this same walk) — without it, a site's own opaque (often
            // white) fill on one of these wrappers sits on top of the
            // correctly-themed html/body and reads as "the whole page is
            // white".
            // The per-element pre-passes run as sliced item steps (they
            // were single functions looping over every element: a 40-100 ms
            // task on a 4600-element page, the longest Aura task).
            { items: capped, visit: el => visitShellElement(el, vh, vw) },
            { items: capped, visit: el => visitPseudoBgElement(el, vh, vw) },
            () => recheckTracked(loaderBgModified, visitLoaderBgElement),
            { items: capped, visit: visitLoaderBgElement },
            () => recheckTracked(logoContrastModified, visitLogoContrastElement),
            { items: capped, visit: visitLogoContrastElement },
            () => recheckTracked(inlineHighlightModified, visitInlineHighlightElement),
            { items: capped, visit: visitInlineHighlightElement },
            () => reopaqueOverlays(root),
            () => paintGoogleImagesViewer(root),
            () => reopaqueTopChrome(root),
            () => restoreAuthoredChromeOpacity(root),
            () => recheckTracked(navMenuPanelOpaqueModified, el => visitNavMenuPanelElement(el, vh, vw)),
            navSweep.step,
            { items: capped, visit: el => visitNavMenuPanelElement(el, vh, vw, navSweep.get) },
            () => rethemeAskAnythingComposer(root),
            () => rethemeGoogleAiChatSurface(root),
            {
                items: elements,
                visit: function (el) {
                    visitShellElement(el, vh, vw);
                    visitOverlayModalWalk(el, vh, vw, overlaySeen, modalCardCache);
                    visitBrightElement(el, vh, vw, modalCardCache);
                    visitStickyElement(el, vh, vw, modalCardCache);
                    visitPopoverElement(el, vh, vw, popoverCandidates);
                    visitFloatingIconControlElement(el, vh, vw, iconCandidates);
                    visitControlElement(el, buttonCandidates, stateCandidates);
                    visitMaskElement(el, maskCandidates);
                    visitFadeElement(el, fadeCandidates);
                    visitBackgroundImageElement(el, vh, vw, bgImageCandidates);
                    visitBlendElement(el);
                    if (darkTheme) visitBorderElement(el, borderCandidates);
                },
            },
            ...smallSurfaceSteps(iconCandidates, popoverCandidates),
            () => settleButtons(buttonCandidates),
            () => settleStateControls(stateCandidates),
            () => settleMasks(maskCandidates),
            () => settleBorders(borderCandidates),
            // After buttons and masks: a fade takes the themed color of
            // what's behind it, which those may have painted.
            () => settleFades(fadeCandidates),
            () => settleBackgroundImages(bgImageCandidates),
            // Last: nested roots are expanded as the steps above run.
            // In chunks, one step each, so a page of nested comments
            // doesn't settle hundreds of buttons in one task.
            () => {
                const list = nestedButtons;
                nestedButtons = [];
                const chunks = [];
                for (let i = 0; i < list.length; i += NESTED_BUTTON_CHUNK) {
                    const part = list.slice(i, i + NESTED_BUTTON_CHUNK);
                    chunks.push(() => settleButtons(part));
                }
                return chunks;
            }
        );
        // Contrast must run after bright/shell clears so muted spans are
        // judged against the theme background, not a still-white ancestor.
        if (!skipContrast) {
            steps.push(
                // Cache lives only for this one pass, created after every
                // background-mutating step above has already run — see
                // effectiveBackground's doc comment in themeHeuristics.js
                // for why that ordering is what makes caching safe here.
                () => { effectiveBgCache = new WeakMap(); duplicateLabelCache = new WeakMap(); },
                contrastBatchStep(elements, () => effectiveBgCache)
            );
        }
        runSteps(steps, finish);
        DBG?.passSync();
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
        try {
            if (H && H.isAdSafeFrameContext && H.isAdSafeFrameContext()) return;
        } catch (eSafeFrame) {}
        if (!theme || theme.enabled === false) {
            lastAppliedThemeKey = '';
            removeTheme();
            writeThemeCache(null);
            return;
        }
        const themeKey = [
            theme.background, theme.text, theme.link,
            theme.backgroundType || '', theme.backgroundGradient || '',
            theme.enabled === false ? '0' : '1',
            theme.nativeDarkModeEnabled ? '1' : '0',
        ].join('|');
        if (themeKey === lastAppliedThemeKey && (document.getElementById('aura-core-engine') || nativeModeActive)) {
            return;
        }

        // Fully undo any prior paint — generic overrides OR a previous
        // native-dark-mode flip — before deciding what this call should do.
        // The two modes are mutually exclusive and must never blend
        // leftover state from one into the other.
        removeTheme(true);

        lastAppliedThemeKey = themeKey;
        currentTheme = theme;
        cancelWalkSlices();
        writeThemeCache(theme);

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
                removeSheetCopies();
                // No passes, meta syncs or fast contrast on the site's own
                // dark mode: they all stop on a null theme (before this,
                // the first site mutation started a full Aura pass here).
                currentTheme = null;
                nativeModeActive = true;
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
            removeSheetCopies();
            return;
        }

        const css = getFullStyleSheetCached(theme, themeKey);
        styleEl.textContent = css + (IS_AMP_DOCUMENT ? getAmpDocumentOverrideCss() : '');
        (document.head || document.documentElement).appendChild(styleEl);
        rewriteSheetCopies(css);

        applyBackgroundColors(theme);
        syncThemeColorMetas();
        // The records queued now are this apply's own writes (sheet, root
        // styles, meta), plus parser records the full pass scheduled below
        // covers anyway; they must not start a second full pass.
        discardOwnMutationRecords();
        DBG?.cssApplied();
        const earlyShield = document.getElementById('aura-early-shield');
        if (earlyShield) earlyShield.remove();

        if (IS_AMP_DOCUMENT) {
            // Dedicated path: static CSS only — skip the general JS
            // safety-net engine entirely for AMP documents.
            return;
        }
        scheduleSafetyPasses();
    }

    // A cached theme is applied at document_start, before <body> and the
    // site's theme-color metas exist; every pass finishes those.
    function syncRootSurfaces() {
        if (!currentTheme || nativeDarkModeApplied) return;
        syncThemeColorMetas();
        if (document.body && !document.body.style.getPropertyValue('background-color')) {
            applyBackgroundColors(currentTheme);
        }
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
        // Two frames, kept (Session 8b tried one for Load-5: the first
        // slice then also paid the page's first full style/layout, a
        // 45-90 ms Aura task at load in the A/B).
        if (typeof requestAnimationFrame === 'function') {
            safetyPassesRaf = requestAnimationFrame(function () {
                safetyPassesRaf = requestAnimationFrame(run);
            });
        } else {
            setTimeout(run, 0);
        }
    }

    // keepSheetCopies: applyTheme is about to rewrite the shadow/iframe
    // copies with the new theme's sheet, so they aren't removed (removing
    // them would leave those roots unthemed until a pass re-adds them).
    function removeTheme(keepSheetCopies) {
        lastAppliedThemeKey = '';
        styleSheetCacheKey = null;
        // Passes, observers and listeners all stop on a null theme; without
        // this, mutation-triggered passes kept painting (and re-adding
        // sheet copies) with the old theme after it was turned off.
        currentTheme = null;
        nativeModeActive = false;
        fullPassCollected = false;
        restoreThemeColorMetas();
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
        // Revert every layer/overlay paint (restores the site's own inline
        // values).
        Array.from(layerPaints.keys()).forEach(releaseLayerPaint);
        layerPaints.clear();
        layerRoots.clear();
        pendingLayerRecheck.clear();
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
        navMenuPanelOpaqueModified.clear();
        navMenuPanelStateHistory = new WeakMap();
        navMenuPanelPendingCollapse = new WeakMap();
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
        revertButtonPaints();
        revertStateControls();
        revertMaskPaints();
        revertFadePaints();
        revertBackgroundImages();
        revertBlendedMedia();
        if (!keepSheetCopies) removeSheetCopies();
    }

    function removeSheetCopies() {
        shadowCopyWatchers.forEach(mo => { try { mo.disconnect(); } catch (e) {} });
        shadowCopyWatchers.clear();
        auraSheetCopies.forEach(s => {
            try { s.remove(); } catch (e) {}
        });
        auraSheetCopies.clear();
        sameOriginIframeModified.clear();
    }

    // A component that re-renders with shadowRoot.innerHTML (or
    // replaceChildren) deletes our sheet copy along with its old content,
    // and the document observer never sees inside shadow roots, so the
    // content stayed unthemed (Reddit's draft sheet). Watch each shadow
    // root's direct children; put the copy back in the same microtask and
    // queue a pass scoped to the host for the new content.
    const shadowCopyWatchers = new Map();

    // A shadow root seen before the pass reaches it gets the sheet copy (and
    // its watcher) at once; so do the roots nested in it, a few levels
    // deep. One <style> per root, no per-element reads.
    const SHADOW_SHEET_NOW_DEPTH = 3;
    const SHADOW_SHEET_NOW_MAX = 64;
    function ensureShadowSheetNow(host, depth) {
        const shadow = host.shadowRoot;
        if (!shadow || !currentTheme) return;
        if (!shadow.querySelector(':scope > style[data-aura-shadow]')) {
            const style = document.createElement('style');
            style.setAttribute('data-aura-shadow', 'true');
            style.textContent = getFullStyleSheetCached(currentTheme, lastAppliedThemeKey);
            shadow.appendChild(style);
            auraSheetCopies.add(style);
        }
        watchShadowCopy(host, shadow);
        if (depth >= SHADOW_SHEET_NOW_DEPTH) return;
        let all = [];
        try { all = shadow.querySelectorAll('*'); } catch (e) {}
        for (let i = 0, n = 0; i < all.length && n < SHADOW_SHEET_NOW_MAX; i++) {
            if (all[i].shadowRoot) { n++; ensureShadowSheetNow(all[i], depth + 1); }
        }
    }

    function watchShadowCopy(host, shadow) {
        if (shadowCopyWatchers.has(shadow)) return;
        // SPAs drop shadow hosts all the time; don't keep them alive.
        if (shadowCopyWatchers.size > 500) {
            shadowCopyWatchers.forEach((mo, sr) => {
                if (!sr.host || !sr.host.isConnected) { mo.disconnect(); shadowCopyWatchers.delete(sr); }
            });
        }
        try {
            const mo = new MutationObserver((records) => {
                if (!currentTheme || !host.isConnected) return;
                // A component nested in this root that attached its own
                // shadow root after this one was themed (Reddit-style
                // nested comments hydrate later): attachShadow makes no
                // mutation the document observer sees, so theme it now
                // through a pass scoped to it (Session 8: nested cards kept
                // their white fill under themed white text).
                for (let i = 0; i < records.length; i++) {
                    const r = records[i];
                    const cands = r.type === 'attributes' ? [r.target] : r.addedNodes;
                    for (let k = 0; k < cands.length; k++) {
                        const n = cands[k];
                        if (n.nodeType === 1 && n.shadowRoot && !n.shadowRoot.querySelector(':scope > style[data-aura-shadow]')) {
                            // The sheet now, the per-element work with the
                            // pass: waiting for the pass left hydrating cards
                            // white for ~0.8 s (Load-5, Session 8b).
                            ensureShadowSheetNow(n, 0);
                            pendingMutationRecords.push({ target: n, addedNodes: [], removedNodes: [] });
                            scheduleSafetyPassDispatch();
                        }
                    }
                }
                if (shadow.querySelector(':scope > style[data-aura-shadow]')) return;
                const style = document.createElement('style');
                style.setAttribute('data-aura-shadow', 'true');
                style.textContent = getFullStyleSheetCached(currentTheme, lastAppliedThemeKey);
                shadow.appendChild(style);
                auraSheetCopies.add(style);
                mo.takeRecords();
                pendingMutationRecords.push({ target: host, addedNodes: [], removedNodes: [] });
                scheduleSafetyPassDispatch();
            });
            mo.observe(shadow, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
            shadowCopyWatchers.set(shadow, mo);
        } catch (e) {}
    }

    // A theme change rewrites every copy in the same task as the main sheet
    // (it used to wait for the next pass to reach each shadow root).
    function rewriteSheetCopies(css) {
        auraSheetCopies.forEach(s => {
            if (!s.isConnected) { auraSheetCopies.delete(s); return; }
            try { if (s.textContent !== css) s.textContent = css; } catch (e) {}
        });
    }

    // Safari tints its toolbar, the status bar and the area around the page
    // from the first theme-color meta whose media matches. Sites often ship
    // a pair split by prefers-color-scheme; each one gets the theme color,
    // or the one matching the OS appearance keeps the site's color under
    // Aura's theme (the "old theme in the bottom strip" after a switch).
    // Runs on apply and at the start of every pass (site metas parse after
    // document_start).
    function syncThemeColorMetas() {
        if (!currentTheme || nativeDarkModeApplied) return;
        const color = themeColorFor(currentTheme);
        try {
            const metas = document.querySelectorAll('meta[name="theme-color"]');
            let own = null;
            for (let i = 0; i < metas.length; i++) {
                const m = metas[i];
                if (m.id === 'aura-theme-color') { own = m; continue; }
                if (!themeColorMetaOriginals.has(m)) themeColorMetaOriginals.set(m, m.getAttribute('content'));
                if (m.getAttribute('content') !== color) m.setAttribute('content', color);
            }
            if (!own) {
                own = document.createElement('meta');
                own.id = 'aura-theme-color';
                own.setAttribute('name', 'theme-color');
                (document.head || document.documentElement).appendChild(own);
            }
            if (own.getAttribute('content') !== color) own.setAttribute('content', color);
        } catch (e) {}
    }

    function restoreThemeColorMetas() {
        themeColorMetaOriginals.forEach((value, m) => {
            try {
                if (value == null) m.removeAttribute('content');
                else m.setAttribute('content', value);
            } catch (e) {}
        });
        themeColorMetaOriginals.clear();
        const own = document.getElementById('aura-theme-color');
        if (own) own.remove();
    }

    function themeColorFor(theme) {
        if (isActiveSplitTheme(theme)) {
            return Split.parseSplitColors(theme.backgroundGradient || theme).dark;
        }
        return theme.background || '#121212';
    }

    // Per-site theme cache (themeResolve.js): written after every apply so
    // the next load of this site applies at document_start. Top frame only
    // (see injected.js readThemeCache).
    function writeThemeCache(theme) {
        if (window.top !== window || IS_AMP_CONSENT_FRAME || !Resolve || !Resolve.serializeThemeCache) return;
        try {
            const value = Resolve.serializeThemeCache(theme);
            const key = Resolve.THEME_CACHE_KEY;
            if (value == null) {
                if (window.localStorage.getItem(key) != null) window.localStorage.removeItem(key);
            } else if (window.localStorage.getItem(key) !== value) {
                window.localStorage.setItem(key, value);
            }
        } catch (e) {}
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
            style.textContent = getFullStyleSheetCached(currentTheme, lastAppliedThemeKey);
            sameOriginIframeModified.add(iframeEl);
            auraSheetCopies.add(style);
            // Deliberately just the stylesheet — an earlier version also
            // re-ran the sticky/overlay/nav-menu/top-chrome JS passes
            // against the iframe's own document here (mirroring the shadow-
            // DOM handling below), but that was never tied to a confirmed
            // bug, only spec symmetry, and it adds real per-pass cost on
            // iframe-heavy pages. Reverted after confirming other changes
            // in the same batch were causing real regressions elsewhere, to
            // remove a plausible contributor with nothing confirmed given up.
        } catch (e) {
            // Cross-origin, or the iframe document isn't in a themeable
            // state yet — safe, expected no-op.
        }
    }

    // 5. SHADOW DOM - Prevent duplicate style injections
    // Steps for one open shadow root (see runSafetyPasses): inject our
    // stylesheet, then the sticky/overlay/nav-panel/top-chrome passes over
    // its elements. Returned as separate steps so a large shadow root is
    // sliced like the light DOM instead of running in one task — Reddit
    // has hundreds of these, and walking them all synchronously on every
    // full-document pass was the main source of input lag during load.
    // nested: a shadow root inside another shadow root. Those were never
    // reached before Session 8 (their white cards kept their fill under
    // themed text); they get the sheet copy (the strip and text colors)
    // and their own nested roots, not the per-element steps, which on a
    // Reddit-sized comment tree tripled Aura's time on the hydration
    // fixture.
    // One root's steps run in order, so one cache at a time is enough.
    let shadowContrastCache = new WeakMap();
    // Buttons found in nested shadow roots during the current pass.
    let nestedButtons = [];
    const NESTED_BUTTON_CHUNK = 64;

    function shadowRootSteps(host, nested) {
        const shadow = host.shadowRoot;
        if (!shadow) return null;
        const css = getFullStyleSheetCached(currentTheme, lastAppliedThemeKey);
        const existingStyle = shadow.querySelector('style[data-aura-shadow]');
        if (existingStyle) {
            // Comparison is cheap (no layout); skip the write when
            // unchanged so an unrelated pass doesn't force a style
            // recalc in every shadow root on the page — the common
            // case, since most passes are triggered by content
            // mutations, not a theme change.
            if (existingStyle.textContent !== css) existingStyle.textContent = css;
            auraSheetCopies.add(existingStyle);
        } else {
            const style = document.createElement('style');
            style.setAttribute('data-aura-shadow', 'true');
            style.textContent = css;
            shadow.appendChild(style);
            auraSheetCopies.add(style);
        }
        watchShadowCopy(host, shadow);
        if (nested) {
            const inner = [];
            const all = shadow.querySelectorAll('*');
            for (let i = 0; i < all.length; i++) if (all[i].shadowRoot) inner.push(all[i]);
            // Buttons only (X-9, Reddit's "Save Draft?" Save: a light fill
            // with the theme's light text). Found by selector, not by the
            // per-element walk the top-level roots get (that walk tripled
            // Aura's time on the hydration fixture).
            // Collected for the whole pass and settled in one batch at its
            // end (one probe for every nested root: per-root batches cost
            // 4x the button time on the hydration fixture).
            let found = [];
            try { found = shadow.querySelectorAll(NESTED_BUTTON_SELECTOR); } catch (e) {}
            for (let i = 0; i < found.length && nestedButtons.length < BUTTON_MAX_PER_PASS; i++) {
                if (isButtonLikeElement(found[i])) nestedButtons.push(found[i]);
            }
            return inner.map(el => () => shadowRootSteps(el, true));
        }

        // The universal stylesheet just injected strips background-color
        // from every layout tag inside this shadow root too — but none
        // of the JS safety-net passes (which recognize legitimate
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
        const { vh, vw } = passViewport();
        const shadowElements = shadow.querySelectorAll('*');
        // Shadow-scoped caches, cheap to allocate per shadow root
        // (mirrors modalCardCache/overlaySeen in runSafetyPasses,
        // just not shared across the whole page's shadow roots).
        const shadowOverlaySeen = new Set();
        const shadowModalCardCache = new WeakMap();
        const shadowIcons = [];
        const shadowPopovers = [];
        const shadowButtons = [];
        const shadowStates = [];
        const shadowMasks = [];
        const shadowFades = [];
        // Components nested in this root carry their own shadow roots.
        const nestedHosts = [];
        for (let i = 0; i < shadowElements.length; i++) {
            if (shadowElements[i].shadowRoot) nestedHosts.push(shadowElements[i]);
        }
        return [
            ...nestedHosts.map(el => () => shadowRootSteps(el, true)),
            {
                items: shadowElements,
                visit: function (shadowEl) {
                    safeVisit(e => visitStickyElement(e, vh, vw), shadowEl);
                    // Covers both the ARIA-role-based modal-card/nav-drawer
                    // path and the position:fixed-based one — see
                    // visitOverlayModalWalk's own doc comments. Without
                    // this, a shadow-DOM-hosted dialog/CMP (e.g. a
                    // Transcend/OneTrust consent manager rendered inside an
                    // open shadow root) has its background stripped by the
                    // universal transparency rule injected above with
                    // nothing to ever repaint it opaque — confirmed on
                    // depop.com's #transcend-consent-manager cookie banner.
                    safeVisit(e => visitOverlayModalWalk(e, vh, vw, shadowOverlaySeen, shadowModalCardCache), shadowEl);
                    safeVisit(e => visitPopoverElement(e, vh, vw, shadowPopovers), shadowEl);
                    safeVisit(e => visitFloatingIconControlElement(e, vh, vw, shadowIcons), shadowEl);
                    safeVisit(e => visitControlElement(e, shadowButtons, shadowStates), shadowEl);
                    safeVisit(e => visitMaskElement(e, shadowMasks), shadowEl);
                    safeVisit(e => visitFadeElement(e, shadowFades), shadowEl);
                    safeVisit(visitBlendElement, shadowEl);
                },
            },
            ...smallSurfaceSteps(shadowIcons, shadowPopovers),
            () => settleButtons(shadowButtons),
            () => settleStateControls(shadowStates),
            () => settleMasks(shadowMasks),
            () => settleFades(shadowFades),
            // ARIA-role overlay roots (dialog/menu/listbox/aria-modal)
            // get their own direct pass too — visitOverlayModalWalk
            // above only handles the position:fixed/nav-drawer shapes,
            // while reopaqueOverlays is what actually paints a plain
            // ARIA dialog/listbox opaque (or its scrim transparent).
            () => reopaqueOverlays(shadow),
            // Nav-semantic shadow-DOM panels (Bootstrap-style
            // .navbar-collapse, WordPress/Divi dropdowns). Nav-drawer
            // parity already exists via visitOverlayModalWalk above.
            () => reopaqueExpandedNavMenuPanels(shadow, shadowElements),
            // visitStickyElement above only paints elements that are
            // themselves position:fixed/sticky — it can't help a top bar
            // that's simply the first thing in this shadow root's flow
            // at the top of the page, with no pinning CSS at all.
            // reopaqueTopChrome exists for exactly that shape in the
            // light DOM. Gate behind a cheap, single getBoundingClientRect
            // on the HOST element (not a subtree scan) so only a host
            // shaped like a top bar (near top of viewport, near full
            // width) pays for the more expensive seed scan. Mirrors
            // isTopChromeBarInfo's own geometry thresholds
            // (themeHeuristics.js) minus its tag/role requirement, since a
            // custom-element host's tag name is never literally
            // "header"/"nav".
            () => {
                let hostRect = null;
                try { hostRect = host.getBoundingClientRect(); } catch (eHostRect) {}
                const looksLikeTopBarHost = !!hostRect
                    && hostRect.width >= vw * 0.7
                    && hostRect.height >= 40 && hostRect.height <= vh * 0.55
                    && hostRect.top >= -20 && hostRect.top <= 80;
                if (looksLikeTopBarHost) reopaqueTopChrome(shadow);
            },
            // Text contrast, as in the light DOM (Session 8b, decided
            // Nov 16): the last step, after every fill above is settled,
            // sliced like the walk. Top-level roots only; nested roots get
            // the sheet and their buttons.
            ...(isActiveSplitTheme(currentTheme) ? [] : [
                () => { shadowContrastCache = new WeakMap(); },
                contrastBatchStep(shadowElements, () => shadowContrastCache),
            ]),
        ];
    }

    // REQUEST THEME UPDATE: Ask background script to sync from App Group
    async function requestThemeUpdate() {
        try {
            if (AURA_DEBUG_LOGGING) console.log("Aura Content: Requesting theme update");
            
            // Ask background script to sync from App Group
            if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
                try {
                    if (AURA_DEBUG_LOGGING) console.log("Aura Content: Sending checkThemeUpdate to background script");
                    const response = await browser.runtime.sendMessage({ type: "checkThemeUpdate" });
                    if (AURA_DEBUG_LOGGING) console.log("Aura Content: Background script response:", response);
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
        if (AURA_DEBUG_LOGGING) console.log("Aura Content: Message received", message);
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
            DBG?.storageChanged();
            const newThemeData = changes.tintThemeData.newValue;
            const newTheme = resolveTheme(newThemeData);
            if (!newTheme) return;
            if (AURA_DEBUG_LOGGING) console.log("Aura Content: Storage changed, applying new theme");
            
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
                if (AURA_DEBUG_LOGGING) console.log("Aura Content: Custom event received, applying theme");
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
            
            if (AURA_DEBUG_LOGGING) console.log("Aura Content: Trying direct native messaging");
            
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
                                if (AURA_DEBUG_LOGGING) console.log("Aura Content: Direct native message SUCCESS");
                                resolve(response);
                            }
                        }
                    }
                );
            });
            
            if (response?.themeData?.globalTheme) {
                if (AURA_DEBUG_LOGGING) console.log("Aura Content: Got theme via direct native messaging");
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

    // Shared debounce arm/reset, used by the MutationObserver callback below
    // and by the 'change'/'transitionend'/'toggle' listeners in init() —
    // identical behavior either way, just named once so neither caller has
    // to duplicate the timer bookkeeping.
    // 150 ms of quiet, but never more than MUTATION_MAX_WAIT_MS after the
    // first queued change (Session 8c): a menu that animates with inline
    // style writes every frame (Walmart's ☰ slide) restarted the debounce
    // on each one, so its rows kept their authored white for the whole
    // animation plus 150 ms (X-11 "white bars when the menu opens").
    // Session 8d: the cap doubles for each pass it forces in a row (300,
    // 600, 1200, 2400 ms) and resets once a pass runs after real quiet. A
    // short stream (a menu slide) still gets its pass at 300 ms; a long one
    // (Reddit-style hydration, ~3 s of mutations) got a full-document pass
    // every ~480 ms with a flat cap, about twice the Aura time, for no text
    // or surface that the end-of-stream pass doesn't fix anyway.
    const MUTATION_QUIET_MS = 150;
    const MUTATION_MAX_WAIT_MS = 300;
    let mutationFirstQueuedAt = 0;
    let mutationCappedStreak = 0;
    function scheduleSafetyPassDispatch() {
        if (ignoreMutations) return;
        const now = performance.now();
        if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
        else mutationFirstQueuedAt = now;
        const maxWait = MUTATION_MAX_WAIT_MS * (1 << Math.min(mutationCappedStreak, 3));
        const wait = Math.max(0, Math.min(MUTATION_QUIET_MS, mutationFirstQueuedAt + maxWait - now));
        const capped = wait < MUTATION_QUIET_MS;
        mutationDebounceTimer = setTimeout(() => {
            mutationDebounceTimer = null;
            mutationCappedStreak = capped ? mutationCappedStreak + 1 : 0;
            dispatchSafetyPasses();
        }, wait);
    }

    // Shared by the 'change'/'transitionend'/'toggle' listeners in init() —
    // none of them carry a real MutationRecord, so this pushes a synthetic
    // one (real target, empty addedNodes/removedNodes) into the same
    // pendingMutationRecords queue the MutationObserver callback uses,
    // letting dispatchSafetyPasses' existing classify/scope logic handle it
    // identically to a real mutation, including correctly merging with any
    // real mutations that land in the same debounce window.
    //
    // target is event.target's PARENT, not event.target itself: for
    // 'change', event.target is the checkbox/form control, and the content
    // a CSS-only reveal shows (e.g. Wikipedia's mobile nav drawer) is its
    // sibling — only guaranteed reachable because sibling combinators
    // (~ / +) require a shared parent by definition, so scoping to the
    // parent is structurally correct, not a heuristic guess. For
    // 'transitionend'/'toggle', event.target is normally the revealed
    // element itself; scoping one level up is a small, cheap safety margin.
    // An earlier version of this forced a full-document walk instead,
    // specifically to avoid this containment question — that turned out to
    // cost real, repeated full walks on pages where these events fire often
    // (an auto-resizing textarea's height transition on every few
    // keystrokes, for example), causing visible lag/flicker. Scoping here
    // is cheap and correct, so there's no need for that trade-off.
    function queueScopedSafetyPass(event) {
        if (!currentTheme) return;
        const target = (event && event.target && event.target.nodeType === 1)
            ? (event.target.parentElement || event.target)
            : null;
        if (!target) return;
        pendingMutationRecords.push({ target, addedNodes: [], removedNodes: [] });
        scheduleSafetyPassDispatch();
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
    //
    // The 'change'/'transitionend'/'toggle' listeners in init() also feed
    // this same pipeline — they push a synthetic record (real target, empty
    // addedNodes/removedNodes) into pendingMutationRecords rather than
    // bypassing scoping, so a CSS-only reveal (Wikipedia's mobile nav
    // drawer, a general SIBLING of the checkbox that reveals it) gets
    // scoped to that target's parent (guaranteed to contain any sibling-
    // combinator-revealed content) instead of forcing a full-document walk
    // on every such event — the earlier full-walk-always design caused real
    // lag/flicker on pages where this fires often (an auto-resizing
    // textarea's height transition on every few keystrokes, for example).
    function dispatchSafetyPasses() {
        const records = pendingMutationRecords;
        pendingMutationRecords = [];
        if (!currentTheme || !records.length) return;
        try {
            markDirtyLayerRoots(records).forEach(r => pendingLayerRecheck.add(r));
        } catch (e) {}
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
            if (AURA_DEBUG_LOGGING) {
                // Temporary instrumentation for the Google lag/flash investigation
                // (SUBMISSION_READINESS.md items 6/7) — measures real mutation-batch
                // shapes so classifyMutationBatchInfo's thresholds can be tuned from
                // data instead of guessed. Safe to leave in behind the flag; remove
                // once that investigation concludes.
                console.log('Aura perf: mutation batch', {
                    recordCount: records.length,
                    addedNodeCount,
                    removedNodeCount,
                    classification,
                    host: String(window.location.hostname || ''),
                });
            }
            // A large batch is scoped too when it all landed inside one
            // container below <body> (Session 8c: a feed appending 200 rows,
            // a streamed answer): the common ancestor contains every change,
            // and a page-wide change resolves to <body>/<html> anyway. Only
            // a small batch may scope to <body> itself, as before.
            if (H && H.findCommonMutationAncestor) {
                const ancestor = H.findCommonMutationAncestor(
                    dedupeMutationTargets(records),
                    document.documentElement
                );
                if (ancestor && ancestor.nodeType === 1
                    && (classification === 'scoped' || ancestor !== document.body)) root = ancestor;
            }
        } catch (e) {
            root = document.documentElement;
        }
        runSafetyPasses(root);
    }

    // 9. INITIALIZATION
    async function init() {
        DBG?.registerEngine({
            sets: {
                layer: layerPaints, layerRoot: layerRoots, bright: brightModified, contrast: contrastModified,
                overlay: overlayModified, shell: shellModified,
                chrome: chromeModified, chromeOuter: chromeOuterModified,
                chromeAuthored: chromeAuthoredModified,
                navMenuPanel: navMenuPanelOpaqueModified,
                askAnything: askAnythingModified,
                pseudoBgCleared, pseudoBgNavPanel: pseudoBgNavPanelHosts, loaderBg: loaderBgModified,
                googleAiChat: googleAiChatModified, logoContrast: logoContrastModified,
                inlineHighlight: inlineHighlightModified,
                button: buttonPaints, stateControl: stateControlModified,
                mask: maskPaints, blendNeutralized,
            },
            explain: explainLayer,
        });
        // Nested ad creative frames: never theme.
        try {
            const host = String(window.location.hostname || '');
            if (H && H.isAdNetworkHost && H.isAdNetworkHost(host)) return;
        } catch (eHost) {}

        // Safari runs document_start scripts after <html> exists; other
        // engines (and the harness's Chromium) can run them before it.
        if (!document.documentElement) {
            await new Promise(resolve => {
                const mo = new MutationObserver(() => {
                    if (!document.documentElement) return;
                    mo.disconnect();
                    resolve();
                });
                mo.observe(document, { childList: true });
            });
        }

        // Per-site theme cache (read by injected.js): apply it now, at
        // document_start, through the same applyTheme the storage read uses
        // below, so the first frame is already themed.
        const cachedTheme = window.__AURA_CACHED_THEME__;
        if (cachedTheme) {
            window.__TINT_THEME__ = cachedTheme;
            applyTheme(cachedTheme);
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
                    DBG?.mutations(mutationsList);
                    if (layerPaints.size) repairRewrittenLayerPaints(mutationsList);
                    contrastAddedNodes(mutationsList);
                    for (let i = 0; i < mutationsList.length; i++) {
                        pendingMutationRecords.push(mutationsList[i]);
                        // A component added with its shadow root attached,
                        // or one that attached it in place and flipped a
                        // class (hydration): its sheet copy now (Load-5).
                        if (currentTheme && fullPassCollected) {
                            const rec = mutationsList[i];
                            const added = rec.type === 'attributes' ? [rec.target] : rec.addedNodes;
                            for (let k = 0; k < added.length; k++) {
                                const n = added[k];
                                if (n.nodeType === 1 && n.shadowRoot && !shadowCopyWatchers.has(n.shadowRoot)) safePass(() => ensureShadowSheetNow(n, 1));
                            }
                        }
                    }
                    scheduleSafetyPassDispatch();
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
                    attributeFilter: ['style', 'class', 'hidden', 'open', 'aria-expanded', 'aria-hidden', 'data-state', 'aria-checked', 'aria-selected'],
                });
                // A site script that rewrites its theme-color meta after
                // Aura synced it (a color-mode script resolving "auto")
                // left the site's color in Safari's tint until an
                // unrelated mutation started a pass. `content` changes
                // only on <meta> in practice, so this is near-free; the
                // site's new value becomes the one restored on theme off.
                new MutationObserver(records => {
                    if (!currentTheme || nativeDarkModeApplied) return;
                    const color = themeColorFor(currentTheme);
                    let changed = false;
                    for (let i = 0; i < records.length; i++) {
                        const m = records[i].target;
                        if (m.tagName !== 'META' || m.id === 'aura-theme-color' || m.getAttribute('name') !== 'theme-color') continue;
                        const v = m.getAttribute('content');
                        if (v === color) continue;
                        themeColorMetaOriginals.set(m, v);
                        changed = true;
                    }
                    if (changed) syncThemeColorMetas();
                }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['content'] });
            }

            // Scroll / resize: re-check only the tracked layer and overlay
            // roots (cached probes — a handful of rect reads, no document
            // walk). A header that becomes sticky on scroll does so through a
            // class/style change, which the observer already turns into a
            // pass; iOS toolbar collapse resizes the visual viewport, which
            // can flip a sheet's overlay/layer mode.
            if (!scrollListenerAttached) {
                scrollListenerAttached = true;
                const onViewportChange = () => {
                    if (!currentTheme || ignoreMutations) return;
                    if (scrollPassTimer) return;
                    scrollPassTimer = setTimeout(() => {
                        scrollPassTimer = null;
                        if (!currentTheme) return;
                        DBG?.scrollPass();
                        pendingRevertReading++;
                        if (!isChromeRepaintDisabledForHost()) {
                            safePass(() => recheckLayerRoots(Array.from(layerRoots.keys())));
                        }
                        if (isGoogleImagesPage()) {
                            safePass(() => paintGoogleImagesViewer(document.documentElement));
                        }
                        // Our own writes above must not come back as a
                        // mutation batch and trigger a full pass.
                        discardOwnMutationRecords();
                    }, 200);
                };
                window.addEventListener('scroll', onViewportChange, { passive: true });
                window.addEventListener('resize', onViewportChange, { passive: true });
                if (window.visualViewport) window.visualViewport.addEventListener('resize', onViewportChange, { passive: true });
            }

            // CSS-only reveals (checkbox/radio-hack menus, :target/:hover/
            // :focus-within accordions) toggle purely via the pseudo-class
            // engine — no attribute, no childList mutation anywhere, so the
            // MutationObserver above never fires for them. Confirmed live
            // on en.wikipedia.org's mobile nav drawer (#mw-mf-page-left): a
            // general SIBLING of the checkbox that reveals it
            // (#main-menu-input:checked ~ #mw-mf-page-left), toggled by a
            // native checkbox `checked` STATE change, which is a DOM
            // property — never an attribute mutation. 'change' catches the
            // toggle instantly, even with no CSS transition at all;
            // 'transitionend' (filtered to TRANSITIONEND_REVEAL_PROPERTIES)
            // catches the broader :hover/:focus-within/:target class that
            // uses a transition without any attribute change either. Both
            // feed queueScopedSafetyPass (see its own doc comment for why
            // this is scoped to event.target's parent, not forced full-
            // document).
            if (!changeListenerAttached) {
                changeListenerAttached = true;
                document.addEventListener('animationstart', contrastAnimatedSubtree, { capture: true, passive: true });
                document.addEventListener('change', (event) => {
                    queueScopedSafetyPass(event);
                }, { capture: true, passive: true });
            }
            if (!transitionendListenerAttached) {
                transitionendListenerAttached = true;
                document.addEventListener('transitionend', (event) => {
                    if (!currentTheme) return;
                    // Google's search-suggestions dropdown and AI composer
                    // (already the subject of unresolved, previously
                    // regression-prone lag/flicker issues — see
                    // SUBMISSION_READINESS.md items 6/7, and the dedicated
                    // low-latency repaint observer elsewhere in this file
                    // that exists specifically because the general full-
                    // document-walk pipeline has caused Google problems
                    // before) plausibly transition exactly the properties
                    // this listener watches on open/close. Excluding Google
                    // here stops this trigger from reaching an already-
                    // fragile area without touching any of that existing,
                    // explicitly off-limits code — kept even though scoping
                    // (vs. the earlier always-full-document design) already
                    // reduces the risk this was originally added against.
                    if (isGoogleHost()) return;
                    if (!TRANSITIONEND_REVEAL_PROPERTIES[event.propertyName]) return;
                    queueScopedSafetyPass(event);
                }, { capture: true, passive: true });
            }
            // The native Popover API (popover attribute, .showPopover()/
            // .hidePopover()) has no reflected content attribute for open/
            // closed state — unlike <dialog>'s "open" attribute, already
            // covered by attributeFilter above — so toggling one produces
            // no MutationRecord either, the same blind-spot class as the
            // :checked-driven menus 'change'/'transitionend' exist to catch.
            // State is exposed only via :popover-open and a dedicated
            // 'toggle' event (fired after the state change, same timing as
            // 'change'). Per spec this 'toggle' event (both <dialog>'s and
            // the Popover API's) does NOT bubble — capture:true is load-
            // bearing here, not stylistic: a bubble-phase listener on
            // document would never fire for it at all, since bubbling-up is
            // the only phase a non-bubbling event skips; the top-down
            // capture phase still reaches every element regardless.
            // Typing makes runSteps use smaller, spaced-out slices (see
            // TYPING_WINDOW_MS). keydown covers hardware and most soft
            // keyboards; 'input' catches IME/autocorrect/dictation.
            if (!userInputListenersAttached) {
                userInputListenersAttached = true;
                document.addEventListener('keydown', noteUserInput, { capture: true, passive: true });
                document.addEventListener('input', noteUserInput, { capture: true, passive: true });
            }
            if (!toggleListenerAttached) {
                toggleListenerAttached = true;
                document.addEventListener('toggle', (event) => {
                    queueScopedSafetyPass(event);
                }, { capture: true, passive: true });
            }
            // Focus changes paint through :focus / :focus-within / `:focus +
            // label` rules with no mutation (Urban Plates' floating label
            // gets its white fill only while the input is focused, F-2).
            // One scoped pass per focus change, on the field's parent (the
            // label is the input's sibling), never per keystroke; plus the
            // mask rule right away on that parent's children, so a label
            // that isn't animating doesn't show the site's white for the
            // debounce.
            if (!focusListenersAttached) {
                focusListenersAttached = true;
                const onFocusChange = (event) => {
                    if (!currentTheme) return;
                    const parent = event.target && event.target.nodeType === 1 && event.target.parentElement;
                    if (!parent || parent === document.body || parent === document.documentElement) return;
                    const cands = [];
                    const kids = parent.children;
                    for (let i = 0; i < kids.length && i < MASK_MAX_NEIGHBORS; i++) safeVisit(e => visitMaskElement(e, cands), kids[i]);
                    if (cands.length) {
                        safePass(() => settleMasks(cands, true));
                        discardOwnMutationRecords();
                        // The label is still where it was: its move onto the
                        // border is a transition (Urban Plates: `all .3s`),
                        // longer than the scoped pass's debounce, so the line
                        // check above and that pass both see it mid-field
                        // (F-2, Session 8b). Settle again once it has landed.
                        const wait = longestTransitionMs(cands);
                        if (wait > 0) {
                            setTimeout(() => {
                                if (!currentTheme) return;
                                safePass(() => settleMasks(cands.filter(el => el.isConnected), true));
                                discardOwnMutationRecords();
                            }, wait + 34);
                        }
                    }
                    queueScopedSafetyPass(event);
                };
                document.addEventListener('focusin', onFocusChange, { capture: true, passive: true });
                document.addEventListener('focusout', onFocusChange, { capture: true, passive: true });
            }
        }

        let data = null;
        try {
            data = await (window.__AURA_STORAGE_PROMISE__ || browser.storage.local.get('tintThemeData'));
        } catch (eStorage) {}
        DBG?.storageResolved();
        const td = data?.tintThemeData;
        if (td) {
            // Reconcile: same theme as the cached apply → applyTheme is a
            // no-op; changed → reapplied (and the cache rewritten); off or
            // nothing for this page → removed (and the cache deleted).
            const theme = resolveTheme(td);
            window.__TINT_THEME_DATA__ = td;
            window.__TINT_THEME_DATA__._ready = true;
            window.__TINT_THEME__ = theme;
            applyTheme(theme);
        } else {
            // Cold cache (fresh install, or the background page hasn't
            // written yet): ask it once, now. background.js also syncs on
            // its own load; the storage write that follows applies the theme
            // through onChanged. A merely slow read never gets here, so it
            // no longer triggers an extra native round trip.
            requestThemeUpdate();
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
})();
