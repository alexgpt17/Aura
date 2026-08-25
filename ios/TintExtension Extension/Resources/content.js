/**
 * AURA THEME ENGINE - Fixed Version with Memory Leak Prevention
 */

(function() {
    let currentTheme = null;
    const processedShadowRoots = new WeakSet();
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
    // Google Ask-anything pill ancestors / decorative siblings we cleared.
    const askAnythingModified = new Set();
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

    let lastAppliedThemeKey = '';
    let mutationDebounceTimer = null;
    let safetyPassesRaf = 0;
    const SPLIT_LAYER_ID = 'aura-split-bg';
    let bodyPositionForced = false;
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

    function forEachSliced(elements, visit, onDone) {
        const gen = walkGeneration;
        let i = 0;
        function step() {
            if (gen !== walkGeneration) return;
            const end = Math.min(i + WALK_SLICE, elements.length);
            for (; i < end; i++) {
                const el = elements[i];
                if (el && el.nodeType === 1) visit(el);
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
            ':not([role="dialog"]):not([role="alertdialog"]):not([role="menu"]):not([role="listbox"]):not([aria-modal="true"]):not(dialog):not([popover])';
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
                /* Semantic / design-system tokens (Wikipedia Codex, etc.) */
                --color-base: var(--aura-text);
                --color-emphasized: var(--aura-text);
                --color-subtle: var(--aura-muted);
                --color-progressive: var(--aura-link);
                --color-visited: var(--aura-link);
                --color-link: var(--aura-link);
                --color-link-red: var(--aura-link);
                --color-base-fixed: var(--aura-text);
                --color-emphasized-fixed: var(--aura-text);
                --background-color-base: var(--aura-bg);
                --background-color-neutral: var(--aura-surface);
                --background-color-neutral-subtle: transparent;
                --background-color-interactive: var(--aura-elevated);
                --background-color-interactive-subtle: var(--aura-surface);
                /* Discord / common app-shell tokens */
                --background-primary: var(--aura-bg);
                --background-secondary: var(--aura-surface);
                --background-tertiary: var(--aura-elevated);
                --md-sys-color-surface: var(--aura-surface);
                --bg-primary: var(--aura-bg);
                --color-background: var(--aura-bg);
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

            ${siteFix}
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
        overlayModified.add(el);
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
        if (inner) paintOverlaySheet(inner);
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
        if (H.isLikelyModalCard && H.isLikelyModalCard(el, getComputedStyle, { vh, vw })) {
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
    function visitStickyElement(el, vh, vw) {
        if (!el || el.nodeType !== 1 || !H) return;
        let style;
        try { style = getComputedStyle(el); } catch (e) { return; }
        let rect;
        try { rect = el.getBoundingClientRect(); } catch (e) { return; }
        const mask = style.webkitMaskImage || style.maskImage;
        if (H.shouldSkipStickyElement({
            position: style.position,
            mask: mask || 'none',
            visibility: style.visibility,
            opacity: style.opacity,
            overlayChrome: H.isOverlayChrome(el),
            tag: el.tagName,
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
            vh,
            vw,
        })) {
            return;
        }
        el.style.setProperty('background-color', 'var(--aura-bg)', 'important');
        stickyModified.add(el);
    }

    function reopaqueStickyFixed(root) {
        if (!root || !currentTheme || !H) return;
        const { vh, vw } = passViewport();
        const elements = collectElements(root);
        const limit = Math.min(elements.length, WALK_SLICE);
        for (let i = 0; i < limit; i++) {
            visitStickyElement(elements[i], vh, vw);
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
            } catch (e) {}
        });
        askAnythingModified.clear();
    }

    // 3d-bis. TOP CHROME — headers/search bars that are not sticky/fixed yet
    // (Google Shopping <header>, many SERP toolbars). Site color-scheme:dark
    // fills beat the universal `header { transparent }` rule. Paint the
    // outermost bar and clear inner layout fills so scroll doesn't leave a
    // gray slab stacked on a themed one.
    function reopaqueTopChrome(root) {
        if (!root || !currentTheme || !H || !H.isTopChromeBar) return;

        const { vh, vw } = passViewport();
        const scope = root.nodeType === 1 ? root : document.documentElement;
        const painted = new Set();

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
            painted.add(el);
            el.style.setProperty('background-color', 'var(--aura-bg)', 'important');
            el.style.setProperty('background-image', 'none', 'important');
            chromeModified.add(el);

            let inners;
            try {
                inners = el.querySelectorAll(
                    'div, nav, header, form, section, ul, ol, li, fieldset'
                );
            } catch (e) {
                return;
            }
            let n = 0;
            for (const inner of inners) {
                if (!inner || inner.nodeType !== 1) continue;
                if (++n > 250) break;
                if (H.BRIGHT_SKIP_TAGS && H.BRIGHT_SKIP_TAGS[inner.tagName]) continue;
                if (inner.getAttribute('role') === 'button') continue;
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
            seeds = scope.querySelectorAll(
                'header, nav, [role="banner"], [role="search"], form, #searchform'
            );
        } catch (e) {
            return;
        }
        seeds.forEach(el => {
            const rootEl = outermost(el);
            if (rootEl) paintChrome(rootEl);
        });
    }


    // 3d. TEXT CONTRAST SAFETY NET — pick black/white against the visible stack.
    // Skipped for split themes so invert (white + difference) is not flattened.
    // Painted aria-hidden copies (Airbnb host stats, currentColor icons) are
    // rewritten; unused stacked Google Images labels are still skipped.
    function visitContrastElement(el) {
        if (!el || el.nodeType !== 1 || !H || !H.hasPoorContrast || !currentTheme) return;
        if (isActiveSplitTheme(currentTheme)) return;
        const tag = el.tagName;
        if (H.BRIGHT_SKIP_TAGS && H.BRIGHT_SKIP_TAGS[tag]) return;
        if (typeof el.className === 'string' && /icon/i.test(el.className)) return;
        if (H.isStackedDuplicateLabel && H.isStackedDuplicateLabel(el)) return;
        let style;
        try { style = getComputedStyle(el); } catch (e) { return; }
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
            ? H.effectiveBackground(el, getComputedStyle, currentTheme.background)
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

    function rethemeOpaqueShells(root) {
        if (!root || !currentTheme || !H || !H.shouldClearShellBackground) return;
        const { vh, vw } = passViewport();
        rethemeKnownShells(root);
        const elements = collectElements(root);
        const limit = Math.min(elements.length, WALK_SLICE);
        for (let i = 0; i < limit; i++) {
            visitShellElement(elements[i], vh, vw);
        }
    }

    function promoteEngineStylesheet() {
        const el = document.getElementById('aura-core-engine');
        if (!el || !el.parentNode) return;
        if (el.parentNode.lastElementChild === el) return;
        el.parentNode.appendChild(el);
    }

    function runSafetyPasses(root) {
        if (!root || !currentTheme) return;
        cancelWalkSlices();
        const gen = walkGeneration;
        ignoreMutations = true;
        promoteEngineStylesheet();
        handleShadowDOM(root);

        const { vh, vw } = passViewport();
        rethemeKnownShells(root);
        reopaqueOverlays(root);
        paintGoogleImagesViewer(root);
        reopaqueTopChrome(root);
        rethemeAskAnythingComposer(root);

        const overlaySeen = new Set();
        const skipContrast = isActiveSplitTheme(currentTheme);
        const elements = collectElements(root);

        function finish() {
            if (gen !== walkGeneration) return;
            paintGoogleImagesViewer(root);
            if (ignoreMutationsTimer) clearTimeout(ignoreMutationsTimer);
            ignoreMutationsTimer = setTimeout(() => {
                ignoreMutations = false;
                ignoreMutationsTimer = null;
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
        }, function () {
            if (gen !== walkGeneration) return;
            if (skipContrast) {
                finish();
                return;
            }
            forEachSliced(elements, visitContrastElement, finish);
        });
    }

    // 4. THEME APPLICATION
    function applyTheme(theme) {
        if (!theme || theme.enabled === false) {
            lastAppliedThemeKey = '';
            return removeTheme();
        }
        const themeKey = [
            theme.background, theme.text, theme.link,
            theme.backgroundType || '', theme.backgroundGradient || '',
            theme.enabled === false ? '0' : '1'
        ].join('|');
        if (themeKey === lastAppliedThemeKey && document.getElementById('aura-core-engine')) {
            return;
        }
        lastAppliedThemeKey = themeKey;
        currentTheme = theme;
        cancelWalkSlices();

        const oldStyleEl = document.getElementById('aura-core-engine');
        if (oldStyleEl) oldStyleEl.remove();

        const styleEl = document.createElement('style');
        styleEl.id = 'aura-core-engine';
        styleEl.textContent = getFullStyleSheet(theme);
        (document.head || document.documentElement).appendChild(styleEl);

        applyBackgroundColors(theme);
        const earlyShield = document.getElementById('aura-early-shield');
        if (earlyShield) earlyShield.remove();
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
            try { el.style.removeProperty('background-color'); } catch (e) {}
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
            } catch (e) {}
        });
        overlayModified.clear();
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
            } catch (e) {}
        });
        chromeModified.clear();
        revertAskAnythingComposer();
        document.querySelectorAll('style[data-aura-shadow]').forEach(s => {
            try { s.remove(); } catch (e) {}
        });
    }

    // 5. SHADOW DOM HANDLER - Prevent duplicate style injections
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

    // 9. INITIALIZATION
    async function init() {
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

        // Set up mutation observer for Shadow DOM (only once)
        if (!mutationObserver) {
            mutationObserver = new MutationObserver(() => {
                if (ignoreMutations) return;
                if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
                mutationDebounceTimer = setTimeout(() => {
                    mutationDebounceTimer = null;
                    if (!currentTheme) return;
                    runSafetyPasses(document.documentElement);
                }, 150);
            });
            mutationObserver.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class', 'hidden', 'open'],
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
                    reopaqueTopChrome(document.documentElement);
                    reopaqueStickyFixed(document.documentElement);
                    if (isGoogleImagesPage()) {
                        paintGoogleImagesViewer(document.documentElement);
                    }
                }, 200);
            }, { passive: true });
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
