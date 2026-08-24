import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export type ThemeSwatchTheme = {
  id?: string;
  name?: string;
  background: string;
  text?: string;
  link?: string;
  backgroundType?: 'color' | 'gradient' | 'split' | string;
  backgroundGradient?: string | null;
};

export function extractSplitColors(
  gradient?: string | null,
): { dark: string; light: string } | null {
  if (!gradient) return null;
  const match = gradient.match(/#[0-9a-fA-F]{6}/g);
  if (match && match.length >= 2) {
    return { dark: match[0], light: match[1] };
  }
  return null;
}

export function isDualToneTheme(theme: ThemeSwatchTheme): boolean {
  // Split/dual themes are retired; leftover records paint as a solid colour.
  return (
    theme.backgroundType === 'gradient' &&
    !!theme.backgroundGradient &&
    !!extractSplitColors(theme.backgroundGradient)
  );
}

export function buildSplitGradient(dark: string, light: string): string {
  return `linear-gradient(135deg, ${dark} 0%, ${light} 100%)`;
}

export function themeAccessibilityLabel(
  theme: ThemeSwatchTheme,
  selected?: boolean,
): string {
  const name =
    theme.name?.trim() ||
    (theme.id ? `Custom ${String(theme.id).slice(0, 6)}` : 'Custom theme');
  const dual = isDualToneTheme(theme) ? ', dual colour' : '';
  const sel = selected ? ', selected' : '';
  return `${name} theme${dual}${sel}`;
}

function isLightHex(hex?: string): boolean {
  if (!hex || !/^#([0-9a-fA-F]{6})$/.test(hex)) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.72;
}

type ThemeColorDotsProps = {
  theme: ThemeSwatchTheme;
  size?: number;
  style?: ViewStyle;
};

/** Leading colour-dot cluster (bg / text / link; dual adds second bg). */
export const ThemeColorDots: React.FC<ThemeColorDotsProps> = ({
  theme,
  size = 11,
  style,
}) => {
  const dual = isDualToneTheme(theme);
  const split = dual ? extractSplitColors(theme.backgroundGradient) : null;
  const colors: string[] = split
    ? [split.dark, split.light, theme.text || '#FFFFFF', theme.link || '#1E90FF']
    : [
        theme.background || '#888888',
        theme.text || '#FFFFFF',
        theme.link || '#1E90FF',
      ];

  return (
    <View
      style={[styles.dotsTray, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {colors.map((color, index) => {
        const light = isLightHex(color);
        return (
          <View
            key={`${color}-${index}`}
            style={[
              styles.dot,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: color,
                // Always ring so dark dots stay visible on dark UI chrome
                borderColor: light ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.55)',
                borderWidth: 1,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

type ThemeListRowProps = {
  theme: ThemeSwatchTheme;
  label?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  onLongPress?: (e: any) => void;
  onPressOut?: () => void;
  accentColor?: string;
  textColor?: string;
  /** Elevated row surface so dots don’t sit on pure black. */
  surfaceColor?: string;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  showChevron?: boolean;
  accessibilityLabel?: string;
};

/**
 * Theme Library row: [colour dots] [name] …… [check | heart | chevron]
 */
export const ThemeListRow: React.FC<ThemeListRowProps> = ({
  theme,
  label,
  selected = false,
  disabled = false,
  onPress,
  onLongPress,
  onPressOut,
  accentColor = '#228B22',
  textColor = '#FFFFFF',
  surfaceColor,
  favorite,
  onToggleFavorite,
  showChevron = false,
  accessibilityLabel,
}) => {
  const name = (label ?? theme.name?.trim()) || 'Custom';
  const a11y = accessibilityLabel ?? themeAccessibilityLabel(theme, selected);

  const body = (
    <>
      <ThemeColorDots theme={theme} />
      <Text
        style={[styles.rowLabel, { color: textColor, opacity: disabled ? 0.4 : 1 }]}
        numberOfLines={1}
      >
        {name}
      </Text>
      {onToggleFavorite ? (
        <TouchableOpacity
          onPress={onToggleFavorite}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'}
          style={styles.trailingBtn}
        >
          <Ionicons
            name={favorite ? 'heart' : 'heart-outline'}
            size={18}
            color={favorite ? accentColor : 'rgba(128,128,128,0.7)'}
          />
        </TouchableOpacity>
      ) : null}
      {selected ? (
        <Ionicons name="checkmark" size={20} color={textColor} style={styles.check} />
      ) : showChevron ? (
        <Ionicons name="chevron-forward" size={18} color={accentColor} />
      ) : (
        <View style={styles.checkSpacer} />
      )}
    </>
  );

  const rowStyle = [
    styles.row,
    surfaceColor ? { backgroundColor: surfaceColor } : null,
  ];

  if (onPress || onLongPress) {
    return (
      <TouchableOpacity
        style={rowStyle}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressOut={onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={a11y}
        activeOpacity={0.65}
      >
        {body}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={rowStyle}
      accessible
      accessibilityRole="text"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={a11y}
    >
      {body}
    </View>
  );
};

const styles = StyleSheet.create({
  dotsTray: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 12,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#3A3A3C',
  },
  dot: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
  },
  trailingBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  check: {
    marginLeft: 4,
  },
  checkSpacer: {
    width: 20,
  },
});

/** @deprecated Prefer ThemeListRow / ThemeColorDots */
const ThemeSwatch = ThemeColorDots;
export default ThemeSwatch;
