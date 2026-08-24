module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-vector-icons|react-native-safe-area-context|react-native-screens|react-native-reanimated|react-native-gesture-handler|react-native-linear-gradient)/)',
  ],
};
