// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add polyfill resolvers
config.resolver.extraNodeModules.crypto = require.resolve('expo-crypto');

// Mobile Wallet Adapter is Android-only; on web use the injected browser wallet shim.
const WEB_WALLET_SHIM = path.resolve(__dirname, 'src/web/mobile-wallet-adapter-web.ts');
const MWA_PACKAGES = new Set([
  '@solana-mobile/mobile-wallet-adapter-protocol',
  '@solana-mobile/mobile-wallet-adapter-protocol-web3js',
]);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && MWA_PACKAGES.has(moduleName)) {
    return { type: 'sourceFile', filePath: WEB_WALLET_SHIM };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
