const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Each app uses only its own node_modules — no workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'jimp-compact': path.resolve(projectRoot, 'mocks/jimp-compact.js'),
  'use-sync-external-store/with-selector': path.resolve(projectRoot, 'node_modules/use-sync-external-store/with-selector.js'),
};

module.exports = withRorkMetro(config);
