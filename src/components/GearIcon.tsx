import React from 'react';
import { View, StyleSheet } from 'react-native';

interface GearIconProps {
  size?: number;
  color?: string;
}

/**
 * Custom gear/settings icon matching the provided design.
 * Features: Outer ring with evenly spaced teeth extending outward, circular center hole.
 */
const GearIcon: React.FC<GearIconProps> = ({ size = 24, color = '#228B22' }) => {
  const radius = size / 2;
  const center = size / 2;
  const ringOuter = radius * 0.72; // Outer edge of ring
  const ringInner = radius * 0.5; // Inner edge of ring (larger = bigger hole)
  const toothCount = 8;
  const toothExtend = radius * 0.4; // How far teeth extend beyond ring
  const toothBaseWidth = radius * 0.4; // Width at base of tooth

  // Create teeth positions
  const teeth = [];
  for (let i = 0; i < toothCount; i++) {
    const angle = (i * 360) / toothCount;
    const rad = (angle * Math.PI) / 180;
    const x = center + Math.cos(rad) * ringOuter;
    const y = center + Math.sin(rad) * ringOuter;
    teeth.push({ x, y, angle, rad });
  }

  // Border width creates the ring thickness
  const ringThickness = ringOuter - ringInner;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <View style={[styles.container, { width: size, height: size }]}>
        {/* Ring created with border - inner edge at ringInner */}
        <View style={[styles.ring, { 
          width: ringOuter * 2, 
          height: ringOuter * 2, 
          borderRadius: ringOuter,
          borderWidth: ringThickness,
          borderColor: color,
          backgroundColor: 'transparent',
          left: center - ringOuter,
          top: center - ringOuter,
        }]} />
        
        {/* Teeth */}
        {teeth.map((tooth, i) => {
          const toothCenterX = tooth.x;
          const toothCenterY = tooth.y;
          
          return (
            <View
              key={i}
              style={[
                styles.tooth,
                {
                  width: toothBaseWidth,
                  height: toothExtend,
                  backgroundColor: color,
                  left: toothCenterX - toothBaseWidth / 2,
                  top: toothCenterY - toothExtend / 2,
                  transform: [{ rotate: `${tooth.angle + 90}deg` }],
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'visible',
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  ring: {
    position: 'absolute',
  },
  tooth: {
    position: 'absolute',
  },
});

export default GearIcon;
