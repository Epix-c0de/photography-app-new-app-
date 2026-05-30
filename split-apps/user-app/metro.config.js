const { getDefaultConfig } = require('expo/metro-config');
const { withRorkMetro } = require('@rork-ai/toolkit-sdk/metro');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'mjs',
];

// Prevent Metro from pulling mismatched deps from parent/root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'jimp-compact': path.resolve(projectRoot, 'mocks/jimp-compact.js'),
};

// Exclude test files from bundling to prevent import errors
config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  new RegExp(`${projectRoot.replace(/\\/g, '\\\\')}\\\\__tests__\\\\.*`),
];

module.exports = withRorkMetro(config);
