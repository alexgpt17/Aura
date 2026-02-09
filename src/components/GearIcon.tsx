import React from 'react';
import { View, StyleSheet } from 'react-native';

interface GearIconProps {
  size?: number;
  color?: string;
}

/**
 * Simple, clean gear icon matching iOS style
 * Compact gear without extra padding or circles
 */
const GearIcon: React.FC<GearIconProps> = ({ size = 24, color = '#228B22' }) => {
  const iconSize = size;
  const center = iconSize / 2;
  const radius = iconSize * 0.35;
  const innerRadius = iconSize * 0.18;
  const strokeWidth = Math.max(1.8, size * 0.08);
  const toothCount = 8;
  const toothLength = iconSize * 0.1;
  const toothWidth = strokeWidth * 1.5;

  // Create gear teeth positions
  const teeth = Array.from({ length: toothCount }, (_, i) => {
    const angle = (i * 360) / toothCount;
    return angle;
  });

  return (
    <View style={[styles.container, { width: iconSize, height: iconSize }]}>
      {/* Main gear body - outer circle */}
      <View
        style={[
          styles.gearBody,
          {
            width: radius * 2,
            height: radius * 2,
            borderRadius: radius,
            borderWidth: strokeWidth,
            borderColor: color,
            top: center - radius,
            left: center - radius,
          },
        ]}
      />
      
      {/* Gear teeth */}
      {teeth.map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const toothX = center + Math.cos(rad) * radius - toothWidth / 2;
        const toothY = center + Math.sin(rad) * radius - toothLength / 2;
        
        return (
          <View
            key={angle}
            style={[
              styles.tooth,
              {
                width: toothWidth,
                height: toothLength,
                backgroundColor: color,
                top: toothY,
                left: toothX,
                transform: [{ rotate: `${angle}deg` }],
              },
            ]}
          />
        );
      })}
      
      {/* Inner circle */}
      <View
        style={[
          styles.innerCircle,
          {
            width: innerRadius * 2,
            height: innerRadius * 2,
            borderRadius: innerRadius,
            backgroundColor: color,
            top: center - innerRadius,
            left: center - innerRadius,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gearBody: {
    position: 'absolute',
  },
  tooth: {
    position: 'absolute',
  },
  innerCircle: {
    position: 'absolute',
  },
});

export default GearIcon;
