// Aggressive cache clearing utility
export async function clearAllCache() {
  console.log('🧹 Starting aggressive cache clear...');
  
  // 1. Clear localStorage
  try {
    localStorage.clear();
    console.log('✅ localStorage cleared');
  } catch (e) {
    console.error('Failed to clear localStorage:', e);
  }

  // 2. Clear sessionStorage
  try {
    sessionStorage.clear();
    console.log('✅ sessionStorage cleared');
  } catch (e) {
    console.error('Failed to clear sessionStorage:', e);
  }

  // 3. Clear IndexedDB
  try {
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        await indexedDB.deleteDatabase(db.name);
        console.log(`✅ Deleted IndexedDB: ${db.name}`);
      }
    }
  } catch (e) {
    console.error('Failed to clear IndexedDB:', e);
  }

  // 4. Unregister all service workers
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        console.log(`✅ Unregistered service worker: ${registration.scope}`);
      }
    }
  } catch (e) {
    console.error('Failed to unregister service workers:', e);
  }

  // 5. Clear all caches (service worker caches)
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
        console.log(`✅ Deleted cache: ${cacheName}`);
      }
    }
  } catch (e) {
    console.error('Failed to clear caches:', e);
  }

  // 6. Clear cookies for localhost
  try {
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    console.log('✅ Cookies cleared');
  } catch (e) {
    console.error('Failed to clear cookies:', e);
  }

  console.log('🎉 Cache clear complete! Reloading...');
  
  // Force reload without cache
  setTimeout(() => {
    window.location.reload();
  }, 100);
} 