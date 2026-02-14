import React from 'react';
import { View, StyleSheet } from 'react-native';

interface KeyboardIconProps {
  size?: number;
  color?: string;
}

/**
 * Keyboard icon - simple rectangle.
 */
const KeyboardIcon: React.FC<KeyboardIconProps> = ({ size = 20, color = '#FFFFFF' }) => {
  return (
    <View 
      style={[
        styles.rectangle, 
        { 
          width: size * 1.2, 
          height: size * 0.65, 
          borderColor: color,
          borderWidth: 1.5,
        }
      ]} 
    />
  );
};

const styles = StyleSheet.create({
  rectangle: {
    borderRadius: 2,
  },
});

export default KeyboardIcon;
