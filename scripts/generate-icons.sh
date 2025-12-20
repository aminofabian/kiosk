#!/bin/bash

# Create a simple icon using ImageMagick or sips
# This creates a simple green icon with a shopping cart symbol

# For now, create a simple colored square icon
# In production, replace with your actual app icon

# Using sips to create a basic icon (macOS)
# Create a 192x192 icon
sips -s format png -z 192 192 /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/com.apple.helpd.icns --out public/icon-192.png 2>/dev/null || \
convert -size 192x192 xc:#4bee2b -pointsize 80 -fill white -gravity center -annotate +0+0 "🛒" public/icon-192.png 2>/dev/null || \
echo "Please create icon-192.png (192x192) and icon-512.png (512x512) manually in the public folder"

# Create a 512x512 icon
sips -s format png -z 512 512 /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/com.apple.helpd.icns --out public/icon-512.png 2>/dev/null || \
convert -size 512x512 xc:#4bee2b -pointsize 200 -fill white -gravity center -annotate +0+0 "🛒" public/icon-512.png 2>/dev/null || \
echo "Please create icon-512.png (512x512) manually in the public folder"

echo "Icons created in public folder"
