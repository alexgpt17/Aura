import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface ThemePreviewProps {
  background: string;
  text: string;
  link: string;
  backgroundType?: 'color' | 'gradient' | 'split';
  backgroundGradient?: string | null;
}

function surfaceFrom(bg: string, _text: string): string {
  // Subtle elevated surface relative to page bg
  if (bg === '#ffffff' || bg === '#FFFFFF' || bg === '#F1EADF') {
    return 'rgba(0,0,0,0.06)';
  }
  return 'rgba(255,255,255,0.08)';
}

function mutedFrom(text: string): string {
  // Approximate muted text
  if (text === '#000000' || text === '#4A3F35') {
    return 'rgba(0,0,0,0.45)';
  }
  return 'rgba(255,255,255,0.45)';
}

const ThemePreview: React.FC<ThemePreviewProps> = ({
  background,
  text,
  link,
}) => {
  const borderColor =
    background === '#ffffff' || background === '#FFFFFF'
      ? 'rgba(0, 0, 0, 0.12)'
      : 'rgba(255, 255, 255, 0.12)';
  const surface = surfaceFrom(background, text);
  const muted = mutedFrom(text);

  const content = (
    <View style={styles.site}>
      {/* Top chrome */}
      <View style={styles.topBar}>
        <Ionicons name="menu-outline" size={16} color={text} />
        <Text style={[styles.siteName, { color: text }]} numberOfLines={1}>
          Example
        </Text>
        <Ionicons name="search-outline" size={16} color={text} />
      </View>

      {/* Search pill */}
      <View style={[styles.searchPill, { backgroundColor: surface }]}>
        <Ionicons name="search-outline" size={13} color={muted} />
        <Text style={[styles.searchPlaceholder, { color: muted }]}>Search the web</Text>
      </View>

      {/* Title + skeleton lines */}
      <Text style={[styles.title, { color: text }]} numberOfLines={1}>
        Lunar eclipse
      </Text>
      <View style={[styles.skelLine, { backgroundColor: muted, width: '92%' }]} />
      <View style={[styles.skelLine, { backgroundColor: muted, width: '78%', opacity: 0.7 }]} />
      <View style={[styles.skelLine, { backgroundColor: muted, width: '64%', opacity: 0.55 }]} />

      {/* Link + media */}
      <View style={styles.contentRow}>
        <View style={styles.textCol}>
          <Text style={[styles.link, { color: link }]}>Related articles</Text>
          <View style={styles.dotRow}>
            <View style={[styles.infoDot, { backgroundColor: muted }]} />
            <View style={[styles.skelLine, { backgroundColor: muted, width: 72, marginBottom: 0, opacity: 0.6 }]} />
          </View>
          <View style={styles.dotRow}>
            <View style={[styles.infoDot, { backgroundColor: muted }]} />
            <View style={[styles.skelLine, { backgroundColor: muted, width: 56, marginBottom: 0, opacity: 0.5 }]} />
          </View>
        </View>
        <View style={[styles.media, { backgroundColor: surface, borderColor: muted }]} />
      </View>

      {/* URL pill */}
      <View style={[styles.urlPill, { backgroundColor: surface }]}>
        <Ionicons name="lock-closed" size={10} color={muted} />
        <Text style={[styles.urlText, { color: muted }]} numberOfLines={1}>
          example.com
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.previewBox, { backgroundColor: background, borderColor }]}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  previewBox: {
    borderRadius: 14,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 168,
  },
  site: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  siteName: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchPlaceholder: {
    fontSize: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  skelLine: {
    height: 7,
    borderRadius: 3,
    marginBottom: 6,
    opacity: 0.85,
  },
  contentRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  textCol: {
    flex: 1,
    justifyContent: 'flex-start',
    gap: 6,
  },
  link: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
    marginBottom: 2,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.7,
  },
  media: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  urlPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  urlText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export default ThemePreview;
