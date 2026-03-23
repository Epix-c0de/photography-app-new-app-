const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");
const path = require('path');

// Find the project and workspace roots
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve modules and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Force Metro to resolve the entry point from the workspace root
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'jimp-compact': path.resolve(projectRoot, 'mocks/jimp-compact.js'),
  'expo-router': path.resolve(workspaceRoot, 'node_modules/expo-router'),
};

module.exports = withRorkMetro(config);
