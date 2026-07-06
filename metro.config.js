const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");
const path = require('path');

const config = getDefaultConfig(__dirname);

// Alias jimp-compact to mock for web to fix bundling issues
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'jimp-compact': path.resolve(__dirname, 'mocks/jimp-compact.js'),
  '@tanstack/react-query': path.resolve(__dirname, 'node_modules/@tanstack/react-query'),
};

module.exports = withRorkMetro(config);
