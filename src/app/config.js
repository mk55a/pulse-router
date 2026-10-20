// Game identity and build switches. tools/package_release.ps1 rewrites `environment` to
// "production" and turns the testing switches off for release builds.
export const config = Object.freeze({
  gameId: 'pulse-router',
  title: 'Pulse Router',
  version: '1.1.0',
  environment: 'development',
  // Development-only test switches; ignored when environment is "production".
  testing: Object.freeze({ unlockAllCircuits: true })
});
