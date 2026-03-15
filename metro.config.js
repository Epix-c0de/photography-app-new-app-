const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");
const path = require('path');

const config = getDefaultConfig(__dirname);

// Alias jimp-compact to mock for web to fix bundling issues
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'jimp-compact': path.resolve(__dirname, 'mocks/jimp-compact.js'),
};

module.exports = withRorkMetro(config);
