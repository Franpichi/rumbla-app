const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = ['js', 'jsx', 'ts', 'tsx', 'json', 'cjs', 'mjs'];
config.resolver.unstable_enablePackageExports = false;

config.transformer = {
  ...config.transformer,
  minifierConfig: {
    ...config.transformer?.minifierConfig,
  },
};

const originalGetTransformOptions = config.transformer.getTransformOptions;
config.transformer.getTransformOptions = async (entryPoints, options, getDependenciesOf) => {
  const result = originalGetTransformOptions 
    ? await originalGetTransformOptions(entryPoints, options, getDependenciesOf)
    : {};
  return {
    ...result,
    transform: {
      ...(result.transform || {}),
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  };
};

config.serializer = {
  ...config.serializer,
  getModulesRunBeforeMainModule: () => [require.resolve('./shim.js')],
};

module.exports = config;
