# App Icon Design Specification

## Design Concept
Simple, Apple-style app icon using a compass/navigation symbol in black and forest green theme.

## Color Scheme
- **Primary Background**: Forest Green (#228B22)
- **Symbol Color**: Black (#000000)
- **Alternative**: Black background with forest green symbol

## Design Elements

### Option 1: Compass Symbol (Recommended)
- **Symbol**: Compass/navigation indicator
- **Style**: Minimal, geometric
- **Layout**: Centered compass symbol on forest green rounded square background
- **Details**: 
  - Rounded square with iOS standard corner radius (22.37% of size)
  - Compass circle in center
  - North-pointing arrow/needle in black
  - Simple, clean design

### Option 2: SF Symbol Approach
- Use SF Symbol: `location.north.fill` or `location.north`
- Render in black on forest green background
- Or render in forest green on black background

## Implementation

### Method 1: Using SF Symbols (Recommended for iOS)
1. Open Xcode
2. Create a new Swift playground or script
3. Use `UIImage(systemName: "location.north.fill")` with configuration
4. Apply forest green background and black symbol color
5. Export at all required sizes

### Method 2: Design Tool (Figma/Sketch)
1. Create 1024x1024px canvas
2. Add rounded rectangle (corner radius: ~229px for 22.37%)
3. Fill with forest green (#228B22)
4. Add compass symbol in center (black)
5. Export at all required sizes

### Method 3: Programmatic Generation
Use the provided `GenerateAppIcon.swift` script (requires macOS and proper setup)

## Required Sizes
- 20x20 @2x (40x40px)
- 20x20 @3x (60x60px)
- 29x29 @2x (58x58px)
- 29x29 @3x (87x87px)
- 40x40 @2x (80x80px)
- 40x40 @3x (120x120px)
- 60x60 @2x (120x120px)
- 60x60 @3x (180x180px)
- 1024x1024 (App Store)

## Files Location
Place all generated PNG files in:
`ios/TintApp/Images.xcassets/AppIcon.appiconset/`

## Design Guidelines
- Keep design simple and recognizable at small sizes
- Ensure good contrast between symbol and background
- Follow iOS Human Interface Guidelines
- Test icon at smallest size (20x20pt) to ensure clarity
