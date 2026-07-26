#!/usr/bin/env swift

import AppKit
import SwiftUI

// App Icon Generator using SF Symbols
// This script generates app icons using SF Symbols with black/forest green theme

let iconSizes: [(size: CGFloat, scale: Int, filename: String)] = [
    (20, 2, "AppIcon-20@2x.png"),
    (20, 3, "AppIcon-20@3x.png"),
    (29, 2, "AppIcon-29@2x.png"),
    (29, 3, "AppIcon-29@3x.png"),
    (40, 2, "AppIcon-40@2x.png"),
    (40, 3, "AppIcon-40@3x.png"),
    (60, 2, "AppIcon-60@2x.png"),
    (60, 3, "AppIcon-60@3x.png"),
    (1024, 1, "AppIcon-1024.png"),
]

let forestGreen = NSColor(red: 0.133, green: 0.545, blue: 0.133, alpha: 1.0) // #228B22
let black = NSColor.black

func generateIcon(size: CGFloat, scale: Int, symbolName: String) -> NSImage? {
    let actualSize = size * CGFloat(scale)
    let image = NSImage(size: NSSize(width: actualSize, height: actualSize))
    
    image.lockFocus()
    
    // Draw rounded rectangle background with forest green
    let rect = NSRect(origin: .zero, size: NSSize(width: actualSize, height: actualSize))
    let path = NSBezierPath(roundedRect: rect, xRadius: actualSize * 0.226, yRadius: actualSize * 0.226)
    forestGreen.setFill()
    path.fill()
    
    // Note: SF Symbols rendering requires iOS/macOS framework
    // For now, we'll create a simple compass-like design programmatically
    
    // Draw compass/navigation symbol
    let center = NSPoint(x: actualSize / 2, y: actualSize / 2)
    let radius = actualSize * 0.35
    
    // Draw compass circle
    let compassCircle = NSBezierPath()
    compassCircle.appendArc(withCenter: center, radius: radius, startAngle: 0, endAngle: 360)
    black.setStroke()
    compassCircle.lineWidth = actualSize * 0.04
    compassCircle.stroke()
    
    // Draw compass needle (N pointing up)
    let needlePath = NSBezierPath()
    // North arrow
    needlePath.move(to: NSPoint(x: center.x, y: center.y + radius * 0.7))
    needlePath.line(to: NSPoint(x: center.x - radius * 0.2, y: center.y))
    needlePath.line(to: NSPoint(x: center.x, y: center.y - radius * 0.3))
    needlePath.line(to: NSPoint(x: center.x + radius * 0.2, y: center.y))
    needlePath.close()
    black.setFill()
    needlePath.fill()
    
    // Draw center dot
    let centerDot = NSBezierPath()
    centerDot.appendArc(withCenter: center, radius: actualSize * 0.03, startAngle: 0, endAngle: 360)
    black.setFill()
    centerDot.fill()
    
    image.unlockFocus()
    
    return image
}

// Generate all icon sizes
let outputDir = "Images.xcassets/AppIcon.appiconset"
let symbolName = "location.north.fill" // Compass symbol

print("Generating app icons...")

for iconSize in iconSizes {
    if let image = generateIcon(size: iconSize.size, scale: iconSize.scale, symbolName: symbolName) {
        let filePath = "\(outputDir)/\(iconSize.filename)"
        if let tiffData = image.tiffRepresentation,
           let bitmapImage = NSBitmapImageRep(data: tiffData),
           let pngData = bitmapImage.representation(using: .png, properties: [:]) {
            try? pngData.write(to: URL(fileURLWithPath: filePath))
            print("Generated: \(iconSize.filename) (\(iconSize.size * CGFloat(iconSize.scale))x\(iconSize.size * CGFloat(iconSize.scale)))")
        }
    }
}

print("App icon generation complete!")
