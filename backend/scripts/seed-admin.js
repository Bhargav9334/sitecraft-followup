// Saves (or resets) the admin login in MongoDB.
//   npm run seed                         -> uses ADMIN_USERNAME / ADMIN_PASSWORD from .env
//   npm run seed -- <username> <password> -> sets a specific username/password
const { readConfig, loadDotEnv } = require('../src/config');
const { createMongoRepo } = require('../src/db/mongoRepo');
const { setAdmin } = require('../src/services/admin');

(async () => {
  loadDotEnv();
  const config = readConfig();
  const [, , argUser, argPass] = process.argv;
  const username = argUser || config.adminUsername;
  const password = argPass || config.adminPassword;
  const repo = await createMongoRepo({ uri: config.mongoUri, dbName: config.mongoDb });
  await repo.init();
  try {
    const r = await setAdmin(repo, username, password);
    console.log(`✓ Admin "${username}" ${r.created ? 'created' : 'password updated'} (database: ${config.mongoDb})`);
    console.log('  You can now log in with this username and password. The username is not case-sensitive.');
  } catch (e) {
    console.error('✗ ' + e.message);
    process.exitCode = 1;
  } finally {
    await repo.close();
  }
})();
