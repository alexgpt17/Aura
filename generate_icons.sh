#!/bin/bash
cd ios/TintApp/Images.xcassets/AppIcon.appiconset

# Generate all required icon sizes from 1024x1024 source
sips -z 40 40 AppIcon-1024.png --out AppIcon-20@2x.png
sips -z 60 60 AppIcon-1024.png --out AppIcon-20@3x.png
sips -z 58 58 AppIcon-1024.png --out AppIcon-29@2x.png
sips -z 87 87 AppIcon-1024.png --out AppIcon-29@3x.png
sips -z 80 80 AppIcon-1024.png --out AppIcon-40@2x.png
sips -z 120 120 AppIcon-1024.png --out AppIcon-40@3x.png
sips -z 120 120 AppIcon-1024.png --out AppIcon-60@2x.png
sips -z 180 180 AppIcon-1024.png --out AppIcon-60@3x.png

echo "All icon sizes generated successfully!"
ls -la
