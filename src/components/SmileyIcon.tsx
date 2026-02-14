import React from 'react';
import { View, StyleSheet } from 'react-native';

interface SmileyIconProps {
  size?: number;
  color?: string;
}

/**
 * Simple smiley face icon matching iOS SF Symbol "face.smiling"
 * Renders a simple circular face with eyes and a smile
 */
const SmileyIcon: React.FC<SmileyIconProps> = ({ size = 20, color = '#FFFFFF' }) => {
  const center = size / 2;
  const radius = size * 0.4;
  const eyeSize = size * 0.1;
  const eyeOffsetX = size * 0.12;
  const eyeOffsetY = size * 0.22; // Moved down from top
  const mouthWidth = size * 0.24; // Smaller width for simpler smile
  const mouthOffsetY = size * 0.15; // Moved up from bottom
  const strokeWidth = Math.max(1.5, size * 0.075);
  const padding = size * 0.05; // Padding to keep features inside circle

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Face circle - outline only */}
      <View
        style={[
          styles.face,
          {
            width: radius * 2,
            height: radius * 2,
            borderRadius: radius,
            borderWidth: strokeWidth,
            borderColor: color,
            top: center - radius,
            left: center - radius,
            backgroundColor: 'transparent',
          },
        ]}
      />
      
      {/* Left eye - simple filled circle, positioned with padding from edges */}
      <View
        style={[
          styles.eye,
          {
            width: eyeSize,
            height: eyeSize,
            borderRadius: eyeSize / 2,
            backgroundColor: color,
            top: center - radius + padding + eyeOffsetY,
            left: center - eyeOffsetX - eyeSize / 2,
          },
        ]}
      />
      
      {/* Right eye - simple filled circle, positioned with padding from edges */}
      <View
        style={[
          styles.eye,
          {
            width: eyeSize,
            height: eyeSize,
            borderRadius: eyeSize / 2,
            backgroundColor: color,
            top: center - radius + padding + eyeOffsetY,
            left: center + eyeOffsetX - eyeSize / 2,
          },
        ]}
      />
      
      {/* Smile - simple curved line using border radius */}
      <View
        style={[
          styles.smile,
          {
            width: mouthWidth,
            height: mouthWidth * 0.5,
            borderBottomLeftRadius: mouthWidth * 0.5,
            borderBottomRightRadius: mouthWidth * 0.5,
            borderWidth: strokeWidth,
            borderColor: color,
            borderTopWidth: 0,
            borderLeftWidth: strokeWidth,
            borderRightWidth: strokeWidth,
            borderBottomWidth: strokeWidth,
            top: center + radius - padding - mouthOffsetY - mouthWidth * 0.5,
            left: center - mouthWidth / 2,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  face: {
    position: 'absolute',
  },
  eye: {
    position: 'absolute',
  },
  smile: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
});

export default SmileyIcon;
