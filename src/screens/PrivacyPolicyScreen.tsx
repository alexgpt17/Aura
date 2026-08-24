import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL } from '../constants/AppConfig';

interface PrivacyPolicyScreenProps {
  navigation: any;
}

const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({ navigation }) => {
  const { backgroundColor, textColor, sectionBgColor, borderColor, appThemeColor } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={[styles.back, { color: appThemeColor }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Privacy Policy</Text>
        <View style={styles.backPlaceholder} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.meta, { color: textColor }]}>Last updated: July 25, 2026</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          Aura does not collect, sell, or transmit personal data to any remote server. Theme preferences and related settings stay on your device and in the shared App Group used by Aura’s Safari extensions.
        </Text>
        <Text style={[styles.heading, { color: textColor }]}>Data on your device</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          Aura may store theme colours, custom themes, per-website overrides, content blocker preferences, and app appearance settings locally. Aura has no backend and does not upload this data.
        </Text>
        <Text style={[styles.heading, { color: textColor }]}>Safari extensions</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          The Safari Web Extension applies your themes on webpages on-device. The Content Blocker uses bundled local blocklists. Page contents are not sent off-device.
        </Text>
        <Text style={[styles.heading, { color: textColor }]}>Permissions</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          You enable Safari Extensions in Settings → Safari → Extensions. Aura does not use location, tracking (ATT), advertising identifiers, or analytics SDKs.
        </Text>
        <TouchableOpacity
          style={[styles.linkRow, { backgroundColor: sectionBgColor, borderColor }]}
          onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          accessibilityRole="link"
          accessibilityLabel="Open full privacy policy in browser"
        >
          <Text style={[styles.linkText, { color: appThemeColor }]}>Open full policy online</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.linkRow, { backgroundColor: sectionBgColor, borderColor }]}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          accessibilityRole="link"
          accessibilityLabel={`Email ${SUPPORT_EMAIL}`}
        >
          <Text style={[styles.linkText, { color: appThemeColor }]}>Contact: {SUPPORT_EMAIL}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  back: { fontSize: 17, fontWeight: '600', minWidth: 56 },
  backPlaceholder: { minWidth: 56 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 40 },
  meta: { fontSize: 13, opacity: 0.7, marginBottom: 16 },
  heading: { fontSize: 18, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  paragraph: { fontSize: 16, lineHeight: 24, opacity: 0.9 },
  linkRow: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: { fontSize: 16, fontWeight: '600' },
});

export default PrivacyPolicyScreen;
