// Only needed for the Expo web preview build: expo-sqlite's web worker imports
// a .wasm file, which Metro doesn't treat as an asset by default.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

module.exports = config;
