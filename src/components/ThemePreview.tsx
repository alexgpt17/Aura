import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface ThemePreviewProps {
  background: string;
  text: string;
  link: string;
  backgroundType?: 'color' | 'gradient' | 'split';
  backgroundGradient?: string | null;
}

function extractSplitColors(gradient?: string | null): { dark: string; light: string } | null {
  if (!gradient) return null;
  const match = gradient.match(/#[0-9a-fA-F]{6}/g);
  if (match && match.length >= 2) {
    return { dark: match[0], light: match[1] };
  }
  return null;
}

const ThemePreview: React.FC<ThemePreviewProps> = ({
  background,
  text,
  link,
  backgroundType,
  backgroundGradient,
}) => {
  const isSplit = backgroundType === 'split';
  const splitColors = isSplit ? extractSplitColors(backgroundGradient) : null;
  const useHardDiagonal = !!(isSplit && splitColors);

  const borderColor =
    background === '#ffffff' || background === '#FFFFFF'
      ? 'rgba(0, 0, 0, 0.1)'
      : 'rgba(255, 255, 255, 0.1)';

  const content = (
    <View style={styles.wikiContent}>
      <Text style={[styles.wikiTitle, { color: text }]}>
        Aura - Browser Enhancement Tool
      </Text>

      <View style={styles.articleContainer}>
        <View style={styles.articleTextContainer}>
          <Text style={[styles.wikiText, { color: text }]}>
            Aura is a powerful browser enhancement tool that allows users to customize their Safari browsing experience with beautiful themes and personalized color schemes.
          </Text>

          <View style={styles.linksContainer}>
            <Text style={[styles.wikiText, { color: text }]}>
              See also:{' '}
              <Text style={[styles.wikiLink, { color: link }]}>Dark Mode</Text>
              {' • '}
              <Text style={[styles.wikiLink, { color: link }]}>Theme Customization</Text>
            </Text>
          </View>
        </View>

        <View style={styles.imageContainer}>
          <View style={styles.imagePlaceholder}>
            <View style={styles.imagePattern}>
              <View style={[styles.patternRow, styles.patternRow1]} />
              <View style={[styles.patternRow, styles.patternRow2]} />
              <View style={[styles.patternRow, styles.patternRow3]} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  if (useHardDiagonal && splitColors) {
    // Hard 135° diagonal: dark lower-left → light upper-right (matches Safari split).
    return (
      <View style={[styles.previewBox, { borderColor, overflow: 'hidden' }]}>
        <LinearGradient
          colors={[splitColors.dark, splitColors.dark, splitColors.light, splitColors.light]}
          locations={[0, 0.45, 0.45, 1]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
        {content}
      </View>
    );
  }

  return (
    <View style={[styles.previewBox, { backgroundColor: background, borderColor }]}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  previewBox: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    minHeight: 70,
  },
  wikiContent: {
    flex: 1,
  },
  wikiTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    lineHeight: 22,
  },
  articleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  articleTextContainer: {
    flex: 1,
  },
  wikiText: {
    fontSize: 12,
    lineHeight: 18,
  },
  linksContainer: {
    marginTop: 8,
  },
  wikiLink: {
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  imageContainer: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  imagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    borderWidth: 1,
    borderColor: '#BDBDBD',
    overflow: 'hidden',
  },
  imagePattern: {
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    padding: 2,
  },
  patternRow: {
    flex: 1,
    borderRadius: 2,
    marginVertical: 1,
  },
  patternRow1: {
    backgroundColor: '#9E9E9E',
  },
  patternRow2: {
    backgroundColor: '#BDBDBD',
  },
  patternRow3: {
    backgroundColor: '#9E9E9E',
  },
});

export default ThemePreview;
