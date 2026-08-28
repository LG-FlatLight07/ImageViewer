const { withAppBuildGradle } = require('@expo/config-plugins');

// expo-updates depends on org.bouncycastle:bcutil-jdk15to18:1.81, which pulls in
// bcprov-jdk15to18 via a dynamic version range ([1.81,1.82)). Resolving that range
// makes Gradle query every configured repository (including jitpack.io) for
// available versions, and jitpack.io times out intermittently, failing the build.
// Pinning the version directly avoids the range lookup entirely.
module.exports = function withBouncyCastleFix(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents += `
configurations.all { c ->
    c.resolutionStrategy.eachDependency { DependencyResolveDetails dependency ->
        if (dependency.requested.group == 'org.bouncycastle') {
            dependency.useTarget 'org.bouncycastle:' + dependency.requested.name + ':1.81'
        }
    }
}
`;
    }
    return config;
  });
};
