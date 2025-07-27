/**
 * Clear all browser cache and storage
 */
export async function clearAllCache() {
  console.log('🧹 Starting complete cache and storage cleanup...');

  // Clear localStorage
  localStorage.clear();
  console.log('✅ localStorage cleared');

  // Clear sessionStorage
  sessionStorage.clear();
  console.log('✅ sessionStorage cleared');

  // Clear cookies for current domain
  document.cookie.split(';').forEach((c) => {
    document.cookie = c
      .replace(/^ +/, '')
      .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
  });
  console.log('✅ Cookies cleared');

  // Clear IndexedDB
  const databases = await indexedDB.databases();
  await Promise.all(databases.map((db) => db.name && indexedDB.deleteDatabase(db.name)));
  console.log('✅ IndexedDB cleared');

  // Clear cache storage
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
  console.log('✅ Cache storage cleared');

  // Clear WebSQL (deprecated but might still exist)
  // @ts-expect-error - WebSQL is deprecated
  if (window.openDatabase) {
    // @ts-expect-error - WebSQL is deprecated
    const db = window.openDatabase('', '', '', '');
    db.transaction((tx: any) => {
      tx.executeSql(
        "SELECT name FROM sqlite_master WHERE type='table'",
        [],
        (_: any, result: any) => {
          for (let i = 0; i < result.rows.length; i++) {
            const tableName = result.rows.item(i).name;
            if (tableName !== '__WebKitDatabaseInfoTable__') {
              tx.executeSql(`DROP TABLE ${tableName}`);
            }
          }
        }
      );
    });
    console.log('✅ WebSQL cleared');
  }

  console.log('🎉 All cache and storage cleared successfully!');
  console.log('⚠️  Page will reload to apply changes...');

  // Force reload to ensure clean state
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}
