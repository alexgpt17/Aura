//
//  AppIconGenerator.swift
//  Icon Generator Utility
//
//  This file provides a utility to generate app icons using SF Symbols
//  Run this in a Swift playground or as a script to generate icons
//

import UIKit
import SwiftUI

#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

struct AppIconGenerator {
    static let forestGreen = UIColor(red: 0.133, green: 0.545, blue: 0.133, alpha: 1.0) // #228B22
    static let black = UIColor.black
    
    // Icon sizes needed for iOS
    static let iconSizes: [(size: CGFloat, scale: Int, filename: String)] = [
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
    
    /// Generates an app icon using SF Symbol
    /// - Parameters:
    ///   - size: Base size in points
    ///   - scale: Scale factor (2x, 3x)
    ///   - symbolName: SF Symbol name (e.g., "location.north.fill")
    /// - Returns: UIImage of the icon
    static func generateIcon(size: CGFloat, scale: Int, symbolName: String = "location.north.fill") -> UIImage? {
        let actualSize = size * CGFloat(scale)
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: actualSize, height: actualSize))
        
        return renderer.image { context in
            let rect = CGRect(origin: .zero, size: CGSize(width: actualSize, height: actualSize))
            
            // Draw rounded rectangle background
            let cornerRadius = actualSize * 0.226 // iOS standard corner radius
            let path = UIBezierPath(roundedRect: rect, cornerRadius: cornerRadius)
            forestGreen.setFill()
            path.fill()
            
            // Draw SF Symbol
            let config = UIImage.SymbolConfiguration(pointSize: actualSize * 0.6, weight: .medium)
            if let symbolImage = UIImage(systemName: symbolName, withConfiguration: config) {
                // Tint symbol to black
                let tintedSymbol = symbolImage.withTintColor(black, renderingMode: .alwaysOriginal)
                
                // Center the symbol
                let symbolSize = tintedSymbol.size
                let symbolRect = CGRect(
                    x: (actualSize - symbolSize.width) / 2,
                    y: (actualSize - symbolSize.height) / 2,
                    width: symbolSize.width,
                    height: symbolSize.height
                )
                
                tintedSymbol.draw(in: symbolRect)
            }
        }
    }
    
    /// Alternative: Generate icon with custom compass design (fallback if SF Symbols unavailable)
    static func generateCustomCompassIcon(size: CGFloat, scale: Int) -> UIImage? {
        let actualSize = size * CGFloat(scale)
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: actualSize, height: actualSize))
        
        return renderer.image { context in
            let rect = CGRect(origin: .zero, size: CGSize(width: actualSize, height: actualSize))
            
            // Draw rounded rectangle background
            let cornerRadius = actualSize * 0.226
            let path = UIBezierPath(roundedRect: rect, cornerRadius: cornerRadius)
            forestGreen.setFill()
            path.fill()
            
            // Draw compass
            let center = CGPoint(x: actualSize / 2, y: actualSize / 2)
            let radius = actualSize * 0.35
            
            // Compass circle
            let compassCircle = UIBezierPath(arcCenter: center, radius: radius, startAngle: 0, endAngle: .pi * 2, clockwise: true)
            black.setStroke()
            compassCircle.lineWidth = actualSize * 0.04
            compassCircle.stroke()
            
            // North arrow (pointing up)
            let arrowPath = UIBezierPath()
            arrowPath.move(to: CGPoint(x: center.x, y: center.y + radius * 0.7))
            arrowPath.addLine(to: CGPoint(x: center.x - radius * 0.2, y: center.y))
            arrowPath.addLine(to: CGPoint(x: center.x, y: center.y - radius * 0.3))
            arrowPath.addLine(to: CGPoint(x: center.x + radius * 0.2, y: center.y))
            arrowPath.close()
            black.setFill()
            arrowPath.fill()
            
            // Center dot
            let centerDot = UIBezierPath(arcCenter: center, radius: actualSize * 0.03, startAngle: 0, endAngle: .pi * 2, clockwise: true)
            black.setFill()
            centerDot.fill()
        }
    }
}

// Usage instructions:
// 1. Run this in a Swift playground
// 2. Or create a command-line tool
// 3. Generate all sizes and save to AppIcon.appiconset folder
//
// Example:
// for iconSize in AppIconGenerator.iconSizes {
//     if let image = AppIconGenerator.generateIcon(size: iconSize.size, scale: iconSize.scale) {
//         // Save image to file
//         if let pngData = image.pngData() {
//             try? pngData.write(to: URL(fileURLWithPath: "path/to/\(iconSize.filename)"))
//         }
//     }
// }
