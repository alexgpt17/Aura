import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';

interface SnackbarProps {
  visible: boolean;
  message: string;
  undoText?: string;
  onUndo?: () => void;
  onDismiss: () => void;
  duration?: number;
}

const Snackbar: React.FC<SnackbarProps> = ({
  visible,
  message,
  undoText = 'Undo',
  onUndo,
  onDismiss,
  duration = 3000,
}) => {
  const { appThemeColor } = useAppTheme();
  const slideAnim = new Animated.Value(100);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      slideAnim.setValue(100);
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.timing(slideAnim, {
      toValue: 100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.message}>{message}</Text>
        {onUndo && (
          <TouchableOpacity onPress={() => {
            onUndo();
            handleDismiss();
          }}>
            <Text style={[styles.undoText, { color: appThemeColor }]}>{undoText}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 40,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  message: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },
  undoText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 16,
  },
});

export default Snackbar;
