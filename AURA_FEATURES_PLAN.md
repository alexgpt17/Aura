# Aura Features Implementation Plan

## Immediate Changes (Phase 0)

### 1. Navigation Restructure
- ✅ Remove Settings tab from bottom navigation
- ✅ Add Home tab (first position)
- ✅ Reorder: Home → Safari → Keyboard
- ✅ Add home icon (can use text "🏠" or install icon library)
- ✅ Create HomeScreen component

### 2. Home Screen Basic Layout
- ✅ Display current Safari theme (with preview)
- ✅ Display current Keyboard theme (with preview)
- ✅ Settings icon in top right (navigates to SettingsScreen)
- ✅ Basic styling with black/forest green theme

---

## Phase 1: Aura Presets/Vibes (Recommended First)

**Why First:** 
- Foundation for other features
- Users can immediately see value
- Relatively simple to implement
- No iOS permissions needed

**Features:**
- Create "Aura Presets" that combine Safari + Keyboard themes
- Named presets: Calm, Noir, Focus, Neon, Paper
- One-tap to apply preset to both Safari and Keyboard
- Display on Home screen as quick-select cards

**Implementation:**
1. Create `AuraPreset` type in storage
2. Define preset themes (Safari + Keyboard combinations)
3. Add preset selection UI to Home screen
4. Apply preset updates both `globalTheme` and `keyboardTheme`

**Estimated Complexity:** Low-Medium
**Dependencies:** None

---

## Phase 2: Focus Mode Integration

**Why Second:**
- Builds on presets
- Uses iOS Focus Filters API
- Requires native iOS code

**Features:**
- Detect iOS Focus mode (Work, Sleep, etc.)
- Auto-apply themes based on Focus mode:
  - Work → cooler colors, minimal UI
  - Sleep → warm, dim themes
- Toggle to enable/disable Focus integration

**Implementation:**
1. Create native iOS module to detect Focus mode
2. Add Focus mode listener
3. Map Focus modes to Aura Presets
4. Auto-apply when Focus mode changes
5. Settings UI to configure Focus → Preset mappings

**Estimated Complexity:** Medium-High
**Dependencies:** 
- iOS Focus Filters API
- Native module creation
- React Native bridge

---

## Phase 3: Time/Environment Triggers

**Why Third:**
- Builds on auto-apply logic from Phase 2
- More complex scheduling logic

**Features:**
- Auto-switch profiles based on:
  - Time of day (e.g., dark theme at night)
  - Battery level (e.g., warm theme when Low Power Mode)
  - App category (per-app keyboard themes)

**Implementation:**
1. Time-based scheduler
2. Battery level monitoring
3. App category detection (requires native code)
4. Settings UI for trigger configuration

**Estimated Complexity:** Medium-High
**Dependencies:**
- Native modules for battery/app detection
- Background task scheduling

---

## Phase 4: Advanced Keyboard Features

**Why Last:**
- Most complex
- Requires keyboard extension modifications
- May need separate keyboard layouts

**Features:**
- Minimal keyboard (letters only)
- Distraction-free writing mode
- Markdown/code keyboard layouts
- Per-app keyboard themes

**Implementation:**
1. Create multiple keyboard layouts
2. Add layout selection UI
3. Detect current app context
4. Apply appropriate layout/theme

**Estimated Complexity:** High
**Dependencies:**
- Keyboard extension refactoring
- Multiple keyboard view implementations
- App context detection

---

## Recommended Approach

### Step 1: Basic Home Screen (Now)
- Create HomeScreen
- Show current themes
- Add settings icon
- Update navigation

### Step 2: Aura Presets (Next)
- Implement preset system
- Add preset cards to Home screen
- One-tap apply to Safari + Keyboard

### Step 3: Evaluate & Prioritize
- Get user feedback on presets
- Decide which advanced features are most valuable
- Implement Focus Mode or Time Triggers based on feedback

---

## Questions for Clarification

1. **Icons:** Do you want to use an icon library (like `react-native-vector-icons`) or use emoji/text icons for now?

2. **Aura Presets:** Should these be:
   - Pre-defined only (Calm, Noir, Focus, etc.)?
   - Or also allow users to create custom presets?

3. **Settings Screen:** Should it:
   - Be accessible only from Home screen (via icon)?
   - Or also accessible from other screens?

4. **Focus Mode:** Do you want this in Phase 1 or Phase 2?
   - Phase 1 = Quick win, but requires native code
   - Phase 2 = After presets are working

5. **Per-App Keyboard Themes:** Should this be:
   - Part of Phase 1 (basic per-app selection)?
   - Or Phase 4 (with advanced keyboard layouts)?

---

## Proposed Next Steps

1. **Now:** Implement basic Home screen with current themes display
2. **Next:** Add Aura Presets system (Calm, Noir, Focus, etc.)
3. **Then:** Get feedback and prioritize remaining features

Would you like me to proceed with Step 1 (Home screen) now?
