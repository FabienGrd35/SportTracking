// Enregistre le délégué de permissions de react-native-health-connect dans MainActivity.
// Sans lui, requestPermission() plante ("lateinit property requestPermission has not been initialized").
const { withMainActivity } = require('expo/config-plugins');

const IMPORT = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

module.exports = function withHealthConnectDelegate(config) {
  return withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (cfg.modResults.language !== 'kt') throw new Error('withHealthConnectDelegate : MainActivity Kotlin attendue');
    if (!src.includes(IMPORT)) src = src.replace(/^(package .+)$/m, `$1\n\n${IMPORT}`);
    if (!src.includes(CALL)) {
      if (!/super\.onCreate\([^)]*\)/.test(src)) throw new Error('withHealthConnectDelegate : onCreate introuvable');
      src = src.replace(/(super\.onCreate\([^)]*\))/, `$1\n    ${CALL}`);
    }
    cfg.modResults.contents = src;
    return cfg;
  });
};
