#!/bin/bash
# iOS Simulator check: real Safari + the real extension (background.js,
# native messaging, Safari's own injection timing), which the WebKit harness
# can't reproduce. Screenshots only; timing comes from run.js.
#
#   tools/harness/sim.sh build            build the Debug app for the Simulator
#   tools/harness/sim.sh install          install it on the booted Simulator
#   tools/harness/sim.sh theme dark|light|off   write theme data the way the app does
#   tools/harness/sim.sh shots [label]    open each URL, wait, screenshot
#
# One-time manual step after the first install: enable the extension in the
# Simulator (Settings → Apps → Safari → Extensions → Aura → On, and
# "Allow" for All Websites). See RELEASE_PLAN.md.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
DEVICE="${AURA_SIM_DEVICE:-iPhone 16 Pro}"
DERIVED="${AURA_SIM_DERIVED:-$HERE/out/sim-build}"
BUNDLE_ID="${AURA_SIM_BUNDLE:-}"
GROUP="group.com.alexmartens.tint"
URLS=(
  "https://www.reddit.com/r/iphone/"
  "https://www.google.com/search?q=why+is+the+sky+blue"
  "https://www.google.com/search?udm=50&q=why+is+the+sky+blue"
  "https://en.m.wikipedia.org/wiki/Golden_Gate_Bridge"
  "https://www.airbnb.com/"
  "https://www.airbnb.com/login"
  "https://github.com/"
  "https://fox5sandiego.com/"
)

udid() {
  xcrun simctl list devices booted | grep -m1 -oE '[0-9A-F-]{36}' || {
    local id
    id=$(xcrun simctl list devices available | grep -m1 "$DEVICE (" | grep -oE '[0-9A-F-]{36}')
    xcrun simctl boot "$id" >/dev/null 2>&1 || true
    open -a Simulator || true
    echo "$id"
  }
}

app_path() { find "$DERIVED/Build/Products/Debug-iphonesimulator" -maxdepth 1 -name '*.app' | head -1; }

bundle_id() {
  if [ -n "$BUNDLE_ID" ]; then echo "$BUNDLE_ID"; return; fi
  /usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$(app_path)/Info.plist"
}

case "${1:-}" in
  build)
    xcodebuild -workspace "$REPO/ios/TintApp.xcworkspace" -scheme TintApp -configuration Debug \
      -destination "id=$(udid)" -derivedDataPath "$DERIVED" build | tail -3
    ;;
  install)
    xcrun simctl install "$(udid)" "$(app_path)"
    echo "Installed $(bundle_id)"
    ;;
  theme)
    # Same JSON-string-in-app-group shape SharedGroupPreferences writes and
    # SafariWebExtensionHandler.handleSyncThemeRequest reads.
    case "${2:-dark}" in
      dark)  THEME='{"enabled":true,"id":"dark","background":"#1C1C1E","text":"#FFFFFF","link":"#0A84FF","backgroundType":"color","backgroundImage":null,"backgroundGradient":null}' ;;
      light) THEME='{"enabled":true,"id":"light","background":"#F2F2F7","text":"#000000","link":"#007AFF","backgroundType":"color","backgroundImage":null,"backgroundGradient":null}' ;;
      off)   THEME='null' ;;
      *) echo "theme dark|light|off"; exit 1 ;;
    esac
    DATA="{\"globalTheme\":$THEME,\"siteThemes\":{},\"nativeDarkModeEnabled\":false,\"timeBasedRule\":{\"enabled\":false}}"
    GROUP_DIR=$(xcrun simctl get_app_container "$(udid)" "$(bundle_id)" "$GROUP")
    mkdir -p "$GROUP_DIR/Library/Preferences"
    defaults write "$GROUP_DIR/Library/Preferences/$GROUP.plist" tintThemeData -string "$DATA"
    # Safari only re-syncs on its 5 s poll or a tab focus; restart it so the
    # next page load starts from the new theme.
    xcrun simctl terminate "$(udid)" com.apple.mobilesafari >/dev/null 2>&1 || true
    echo "Theme set to ${2:-dark} in $GROUP_DIR"
    ;;
  shots)
    LABEL="${2:-$(date +%Y%m%d-%H%M%S)}"
    OUT="$HERE/out/sim-$LABEL"
    mkdir -p "$OUT"
    ID=$(udid)
    i=0
    for url in "${URLS[@]}"; do
      i=$((i+1))
      xcrun simctl openurl "$ID" "$url"
      sleep 2;  xcrun simctl io "$ID" screenshot --type=png "$OUT/$(printf %02d $i)-load.png" >/dev/null 2>&1
      sleep 6;  xcrun simctl io "$ID" screenshot --type=png "$OUT/$(printf %02d $i)-8s.png" >/dev/null 2>&1
      echo "$i $url"
    done
    echo "Screenshots: $OUT"
    ;;
  *)
    sed -n '2,13p' "$0"
    ;;
esac
