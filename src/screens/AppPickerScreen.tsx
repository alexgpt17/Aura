import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  Image,
} from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface AppPickerScreenProps {
  navigation: any;
  route: {
    params?: {
      onSelectApp?: (bundleId: string, appName: string) => void;
    };
  };
}

// Common iOS apps with their bundle IDs, display names, and categories
interface AppInfo {
  bundleId: string;
  name: string;
  icon: string;
  category: string;
}

// Enhanced app icon component with better Apple app support and fallbacks
const AppIcon: React.FC<{ bundleId: string; name: string; size?: number }> = ({ bundleId, name, size = 32 }) => {
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Get app info for this bundle ID
  const appInfo = COMMON_APPS.find(app => app.bundleId === bundleId);
  const displayIcon = appInfo?.icon;

  useEffect(() => {
    // Fetch app icon from App Store API
    const fetchIcon = async () => {
      try {
        // Try fetching for all apps, not just non-Apple ones
        const response = await fetch(`https://itunes.apple.com/lookup?bundleId=${bundleId}`);
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          // Use artworkUrl60 for smaller icon, artworkUrl100 for larger
          const icon = data.results[0].artworkUrl60 || data.results[0].artworkUrl100;
          setIconUrl(icon);
        } else {
          setFailed(true);
        }
      } catch (error) {
        console.error('Error fetching app icon:', error);
        setFailed(true);
      } finally {
        setLoading(false);
      }
    };

    // Always try to fetch, but have timeouts for Apple apps
    const timeout = bundleId.startsWith('com.apple.') ? 2000 : 5000;
    const timeoutId = setTimeout(() => {
      setFailed(true);
      setLoading(false);
    }, timeout);

    fetchIcon().finally(() => {
      clearTimeout(timeoutId);
    });

    return () => clearTimeout(timeoutId);
  }, [bundleId]);

  // Show emoji icon if we have one and loading failed
  if ((loading || failed || !iconUrl) && displayIcon) {
    return (
      <View style={[styles.iconPlaceholder, { width: size, height: size, borderRadius: 6, marginRight: 12, backgroundColor: getIconBackgroundColor(bundleId) }]}>
        <Text style={[styles.iconEmojiText, { fontSize: size * 0.6 }]}>
          {displayIcon}
        </Text>
      </View>
    );
  }

  // Show loading or failed state
  if (loading || !iconUrl) {
    return (
      <View style={[styles.iconPlaceholder, { width: size, height: size, borderRadius: 6, marginRight: 12, backgroundColor: getIconBackgroundColor(bundleId) }]}>
        <Text style={[styles.iconPlaceholderText, { fontSize: size * 0.4 }]}>
          {name.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }

  // Show actual fetched icon
  return (
    <View style={{ marginRight: 12 }}>
      <Image
        source={{ uri: iconUrl }}
        style={{ width: size, height: size, borderRadius: 6 }}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    </View>
  );
};

// Helper function to get background color for app icon
const getIconBackgroundColor = (bundleId: string): string => {
  // Generate consistent color based on bundle ID
  let hash = 0;
  for (let i = 0; i < bundleId.length; i++) {
    const char = bundleId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  // Convert to a pleasant color
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
  return colors[Math.abs(hash) % colors.length];
};

const COMMON_APPS: AppInfo[] = [
  // Apple Apps
  { bundleId: 'com.apple.mail', name: 'Mail', icon: '✉️', category: 'Apple' },
  { bundleId: 'com.apple.mobilesafari', name: 'Safari', icon: '🌐', category: 'Apple' },
  { bundleId: 'com.apple.MobileSMS', name: 'Messages', icon: '💬', category: 'Apple' },
  { bundleId: 'com.apple.mobilephone', name: 'Phone', icon: '📞', category: 'Apple' },
  { bundleId: 'com.apple.calculator', name: 'Calculator', icon: '🔢', category: 'Apple' },
  { bundleId: 'com.apple.mobilecal', name: 'Calendar', icon: '📅', category: 'Apple' },
  { bundleId: 'com.apple.mobilecontacts', name: 'Contacts', icon: '👤', category: 'Apple' },
  { bundleId: 'com.apple.reminders', name: 'Reminders', icon: '📝', category: 'Apple' },
  { bundleId: 'com.apple.notes', name: 'Notes', icon: '📄', category: 'Apple' },
  { bundleId: 'com.apple.Music', name: 'Music', icon: '🎵', category: 'Apple' },
  { bundleId: 'com.apple.mobileslideshow', name: 'Photos', icon: '📷', category: 'Apple' },
  { bundleId: 'com.apple.camera', name: 'Camera', icon: '📸', category: 'Apple' },
  { bundleId: 'com.apple.mobiletimer', name: 'Clock', icon: '⏰', category: 'Apple' },
  { bundleId: 'com.apple.mobileweather', name: 'Weather', icon: '☁️', category: 'Apple' },
  { bundleId: 'com.apple.mobilemaps', name: 'Maps', icon: '🗺️', category: 'Apple' },
  { bundleId: 'com.apple.Preferences', name: 'Settings', icon: '⚙️', category: 'Apple' },
  { bundleId: 'com.apple.AppStore', name: 'App Store', icon: '🛒', category: 'Apple' },
  { bundleId: 'com.apple.mobileme.fmf1', name: 'Find My', icon: '📍', category: 'Apple' },
  { bundleId: 'com.apple.podcasts', name: 'Podcasts', icon: '🎙️', category: 'Apple' },
  { bundleId: 'com.apple.tv', name: 'TV', icon: '📺', category: 'Apple' },
  
  // Social Media
  { bundleId: 'com.burbn.instagram', name: 'Instagram', icon: '📷', category: 'Social' },
  { bundleId: 'com.atebits.Tweetie2', name: 'Twitter', icon: '🐦', category: 'Social' },
  { bundleId: 'com.twitter.twitter', name: 'X (Twitter)', icon: '🐦', category: 'Social' },
  { bundleId: 'com.facebook.Facebook', name: 'Facebook', icon: '👥', category: 'Social' },
  { bundleId: 'com.zhiliaoapp.musically', name: 'TikTok', icon: '🎵', category: 'Social' },
  { bundleId: 'com.toyopagroup.picaboo', name: 'Snapchat', icon: '👻', category: 'Social' },
  { bundleId: 'com.linkedin.LinkedIn', name: 'LinkedIn', icon: '💼', category: 'Social' },
  { bundleId: 'com.reddit.Reddit', name: 'Reddit', icon: '🤖', category: 'Social' },
  { bundleId: 'com.pinterest.Pinterest', name: 'Pinterest', icon: '📌', category: 'Social' },
  
  // Communication
  { bundleId: 'net.whatsapp.WhatsApp', name: 'WhatsApp', icon: '💬', category: 'Communication' },
  { bundleId: 'ph.telegra.Telegraph', name: 'Telegram', icon: '✈️', category: 'Communication' },
  { bundleId: 'com.hammerandchisel.discord', name: 'Discord', icon: '💬', category: 'Communication' },
  { bundleId: 'com.tinyspeck.chatlyio', name: 'Slack', icon: '💬', category: 'Communication' },
  { bundleId: 'us.zoom.videomeetings', name: 'Zoom', icon: '📹', category: 'Communication' },
  { bundleId: 'com.microsoft.skype', name: 'Skype', icon: '💬', category: 'Communication' },
  { bundleId: 'com.viber.voip', name: 'Viber', icon: '💬', category: 'Communication' },
  { bundleId: 'com.wechat.WeChat', name: 'WeChat', icon: '💬', category: 'Communication' },
  
  // Productivity
  { bundleId: 'notion.id', name: 'Notion', icon: '📝', category: 'Productivity' },
  { bundleId: 'com.evernote.iPhone.Evernote', name: 'Evernote', icon: '📝', category: 'Productivity' },
  { bundleId: 'net.shinyfrog.bear', name: 'Bear', icon: '🐻', category: 'Productivity' },
  { bundleId: 'com.culturedcode.ThingsiPhone', name: 'Things', icon: '✅', category: 'Productivity' },
  { bundleId: 'com.omnigroup.OmniFocus3', name: 'OmniFocus', icon: '📋', category: 'Productivity' },
  { bundleId: 'com.microsoft.Office.Outlook', name: 'Outlook', icon: '📧', category: 'Productivity' },
  { bundleId: 'com.google.Gmail', name: 'Gmail', icon: '📧', category: 'Productivity' },
  { bundleId: 'com.dropbox.Dropbox', name: 'Dropbox', icon: '📦', category: 'Productivity' },
  { bundleId: 'com.google.Drive', name: 'Google Drive', icon: '📁', category: 'Productivity' },
  { bundleId: 'com.microsoft.Office.Word', name: 'Word', icon: '📄', category: 'Productivity' },
  { bundleId: 'com.microsoft.Office.Excel', name: 'Excel', icon: '📊', category: 'Productivity' },
  { bundleId: 'com.microsoft.Office.PowerPoint', name: 'PowerPoint', icon: '📽️', category: 'Productivity' },
  { bundleId: 'com.todoist.Todoist', name: 'Todoist', icon: '✅', category: 'Productivity' },
  { bundleId: 'com.ticktick.ticktick', name: 'TickTick', icon: '✅', category: 'Productivity' },
  
  // Entertainment
  { bundleId: 'com.google.ios.youtube', name: 'YouTube', icon: '📺', category: 'Entertainment' },
  { bundleId: 'com.netflix.Netflix', name: 'Netflix', icon: '🎬', category: 'Entertainment' },
  { bundleId: 'com.spotify.client', name: 'Spotify', icon: '🎵', category: 'Entertainment' },
  { bundleId: 'tv.twitch', name: 'Twitch', icon: '🎮', category: 'Entertainment' },
  { bundleId: 'com.hulu.plus', name: 'Hulu', icon: '📺', category: 'Entertainment' },
  { bundleId: 'com.amazon.aiv.AIVApp', name: 'Prime Video', icon: '📺', category: 'Entertainment' },
  { bundleId: 'com.disney.disneyplus', name: 'Disney+', icon: '🏰', category: 'Entertainment' },
  { bundleId: 'com.hbo.hbomax', name: 'HBO Max', icon: '📺', category: 'Entertainment' },
  { bundleId: 'com.apple.Podcasts', name: 'Apple Podcasts', icon: '🎙️', category: 'Entertainment' },
  { bundleId: 'com.spotify.Podcasts', name: 'Spotify Podcasts', icon: '🎙️', category: 'Entertainment' },
  
  // Shopping
  { bundleId: 'com.amazon.Amazon', name: 'Amazon', icon: '🛒', category: 'Shopping' },
  { bundleId: 'com.ebay.iphone', name: 'eBay', icon: '💰', category: 'Shopping' },
  { bundleId: 'com.target.TargetApp', name: 'Target', icon: '🎯', category: 'Shopping' },
  { bundleId: 'com.walmart.ios.Walmart', name: 'Walmart', icon: '🛒', category: 'Shopping' },
  { bundleId: 'com.etsy.etsy', name: 'Etsy', icon: '🛍️', category: 'Shopping' },
  { bundleId: 'com.alibaba.iPhoneAlibaba', name: 'AliExpress', icon: '📦', category: 'Shopping' },
  
  // News & Reading
  { bundleId: 'com.apple.news', name: 'Apple News', icon: '📰', category: 'News' },
  { bundleId: 'com.nytimes.NYTimes', name: 'NYTimes', icon: '📰', category: 'News' },
  { bundleId: 'com.cnn.iphone', name: 'CNN', icon: '📺', category: 'News' },
  { bundleId: 'com.medium.reader', name: 'Medium', icon: '📖', category: 'News' },
  { bundleId: 'com.reeder.r3', name: 'Reeder', icon: '📰', category: 'News' },
  { bundleId: 'com.amazon.Lassen', name: 'Kindle', icon: '📚', category: 'News' },
  { bundleId: 'com.apple.iBooks', name: 'Apple Books', icon: '📚', category: 'News' },
  
  // Banking & Finance
  { bundleId: 'com.chase.sig.android', name: 'Chase', icon: '🏦', category: 'Finance' },
  { bundleId: 'com.bankofamerica.BofA', name: 'Bank of America', icon: '🏦', category: 'Finance' },
  { bundleId: 'com.wellsfargo.mobile', name: 'Wells Fargo', icon: '🏦', category: 'Finance' },
  { bundleId: 'com.citibank.CitiMobile', name: 'Citi', icon: '🏦', category: 'Finance' },
  { bundleId: 'com.venmo.touch', name: 'Venmo', icon: '💵', category: 'Finance' },
  { bundleId: 'com.squareup.cash', name: 'Cash App', icon: '💵', category: 'Finance' },
  { bundleId: 'com.paypal.ppclient.touchstone', name: 'PayPal', icon: '💳', category: 'Finance' },
  { bundleId: 'com.yourcompany.PP', name: 'PayPal', icon: '💳', category: 'Finance' },
  { bundleId: 'com.robinhood.Robinhood', name: 'Robinhood', icon: '📈', category: 'Finance' },
  { bundleId: 'com.etrade.mobilepro', name: 'E*TRADE', icon: '📊', category: 'Finance' },
  
  // Travel & Navigation
  { bundleId: 'com.google.Maps', name: 'Google Maps', icon: '🗺️', category: 'Travel' },
  { bundleId: 'com.ubercab.UberClient', name: 'Uber', icon: '🚗', category: 'Travel' },
  { bundleId: 'com.ubercab.UberEats', name: 'Uber Eats', icon: '🍔', category: 'Travel' },
  { bundleId: 'com.lyft.ios', name: 'Lyft', icon: '🚗', category: 'Travel' },
  { bundleId: 'com.airbnb.app', name: 'Airbnb', icon: '🏠', category: 'Travel' },
  { bundleId: 'com.booking.BookingApp', name: 'Booking.com', icon: '🏨', category: 'Travel' },
  { bundleId: 'com.expedia.iphone', name: 'Expedia', icon: '✈️', category: 'Travel' },
  { bundleId: 'com.kayak.iphone', name: 'Kayak', icon: '✈️', category: 'Travel' },
  
  // Food & Delivery
  { bundleId: 'com.grubhub.Grubhub', name: 'Grubhub', icon: '🍔', category: 'Food' },
  { bundleId: 'com.doordash.DoorDash', name: 'DoorDash', icon: '🍔', category: 'Food' },
  { bundleId: 'com.postmates.ios', name: 'Postmates', icon: '📦', category: 'Food' },
  { bundleId: 'com.yelp.yelpiphone', name: 'Yelp', icon: '⭐', category: 'Food' },
  { bundleId: 'com.opentable.OpenTable', name: 'OpenTable', icon: '🍽️', category: 'Food' },
  
  // Health & Fitness
  { bundleId: 'com.apple.Health', name: 'Health', icon: '❤️', category: 'Health' },
  { bundleId: 'com.nike.nikeplus', name: 'Nike Run Club', icon: '🏃', category: 'Health' },
  { bundleId: 'com.strava.strava', name: 'Strava', icon: '🚴', category: 'Health' },
  { bundleId: 'com.myfitnesspal.mfp', name: 'MyFitnessPal', icon: '💪', category: 'Health' },
  { bundleId: 'com.fitbit.FitbitMobile', name: 'Fitbit', icon: '⌚', category: 'Health' },
  { bundleId: 'com.headspace.headspace', name: 'Headspace', icon: '🧘', category: 'Health' },
  
  // Photo & Video
  { bundleId: 'com.vsco.cam', name: 'VSCO', icon: '📷', category: 'Photo' },
  { bundleId: 'com.burbn.boomerang', name: 'Boomerang', icon: '📹', category: 'Photo' },
  { bundleId: 'com.adobe.PhotoshopExpress', name: 'Photoshop Express', icon: '🎨', category: 'Photo' },
  { bundleId: 'com.snapchat.snapchat', name: 'Snapchat', icon: '👻', category: 'Photo' },
];

const AppPickerScreen: React.FC<AppPickerScreenProps> = ({ navigation, route }) => {
  const { appThemeColor } = useAppTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredApps, setFilteredApps] = useState(COMMON_APPS);
  const [customBundleId, setCustomBundleId] = useState('');

  // Group apps by category
  const groupAppsByCategory = (apps: AppInfo[]) => {
    const grouped: { [key: string]: AppInfo[] } = {};
    apps.forEach((app) => {
      if (!grouped[app.category]) {
        grouped[app.category] = [];
      }
      grouped[app.category].push(app);
    });
    return grouped;
  };

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredApps(COMMON_APPS);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredApps(
        COMMON_APPS.filter(
          (app) =>
            app.name.toLowerCase().includes(query) ||
            app.bundleId.toLowerCase().includes(query) ||
            app.category.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery]);

  const groupedApps = groupAppsByCategory(filteredApps);
  const categories = Object.keys(groupedApps).sort();

  const handleSelectApp = (bundleId: string, appName: string) => {
    const onSelectApp = route.params?.onSelectApp;
    if (onSelectApp) {
      onSelectApp(bundleId, appName);
    }
    navigation.goBack();
  };

  const isValidBundleId = (bundleId: string): boolean => {
    const trimmed = bundleId.trim();
    if (!trimmed) return false;
    // Basic validation: should contain at least one dot and be alphanumeric with dots and hyphens
    const bundleIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z0-9][a-zA-Z0-9.-]*$/;
    return bundleIdPattern.test(trimmed) && trimmed.length >= 3;
  };

  const handleCustomApp = () => {
    const cleanBundleId = customBundleId.trim();
    if (cleanBundleId && isValidBundleId(cleanBundleId)) {
      handleSelectApp(cleanBundleId, cleanBundleId);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backButtonText, { color: appThemeColor }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select App</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search apps..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {searchQuery.trim() === '' ? (
          // Show grouped by category when not searching
          categories.map((category) => (
            <View key={category} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{category}</Text>
              {groupedApps[category].map((app) => (
                <TouchableOpacity
                  key={app.bundleId}
                  style={styles.appRow}
                  onPress={() => handleSelectApp(app.bundleId, app.name)}
                >
                  <AppIcon bundleId={app.bundleId} name={app.name} size={32} />
                  <View style={styles.appInfo}>
                    <Text style={styles.appName}>{app.name}</Text>
                    <Text style={styles.appBundleId}>{app.bundleId}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
                </TouchableOpacity>
              ))}
            </View>
          ))
        ) : (
          // Show flat list when searching
          <>
            <Text style={styles.sectionTitle}>Search Results</Text>
        <FlatList
          data={filteredApps}
          scrollEnabled={false}
          keyExtractor={(item, index) => `${item.bundleId}-${index}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.appRow}
              onPress={() => handleSelectApp(item.bundleId, item.name)}
            >
                  <AppIcon bundleId={item.bundleId} name={item.name} size={32} />
              <View style={styles.appInfo}>
                <Text style={styles.appName}>{item.name}</Text>
                <Text style={styles.appBundleId}>{item.bundleId}</Text>
              </View>
              <Text style={[styles.arrow, { color: appThemeColor }]}>→</Text>
            </TouchableOpacity>
          )}
        />
          </>
        )}

        <View style={styles.customSection}>
          <Text style={styles.sectionTitle}>Custom App</Text>
          <Text style={styles.sectionDescription}>
            Enter a bundle ID for an app not listed above. Bundle IDs typically follow the format: com.company.appname
          </Text>
          <Text style={styles.exampleText}>
            Examples: com.spotify.client, com.netflix.Netflix, com.google.ios.youtube
          </Text>
          <TextInput
            style={[
              styles.customInput,
              customBundleId.trim() !== '' && !isValidBundleId(customBundleId) && styles.customInputError
            ]}
            placeholder="com.example.app"
            placeholderTextColor="#666"
            value={customBundleId}
            onChangeText={setCustomBundleId}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {customBundleId.trim() !== '' && !isValidBundleId(customBundleId) && (
            <Text style={styles.errorText}>
              Invalid bundle ID format. Should be like: com.company.appname
            </Text>
          )}
          <TouchableOpacity
            style={[
              styles.customButton,
              { backgroundColor: appThemeColor },
              (!customBundleId.trim() || !isValidBundleId(customBundleId)) && styles.customButtonDisabled
            ]}
            onPress={handleCustomApp}
            disabled={!customBundleId.trim() || !isValidBundleId(customBundleId)}
          >
            <Text style={[styles.customButtonText, { color: appThemeColor }]}>Add Custom App</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  searchInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888888',
    marginBottom: 8,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 12,
    color: '#666666',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  customInputError: {
    borderColor: '#ff4444',
  },
  errorText: {
    fontSize: 12,
    color: '#ff4444',
    marginTop: -8,
    marginBottom: 8,
  },
  customButtonDisabled: {
    opacity: 0.5,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  iconPlaceholder: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconPlaceholderText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  iconEmojiText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  appBundleId: {
    fontSize: 12,
    color: '#888888',
  },
  arrow: {
    // Style no longer used - replaced with Ionicons
  },
  customSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  customInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  customButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  customButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AppPickerScreen;
