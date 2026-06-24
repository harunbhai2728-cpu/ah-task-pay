self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);
  
  // Use Network-Only / No-Cache strategy for proxy API and Supabase requests
  if (url.pathname.includes('/api/proxy') || url.pathname.includes('/rest/v1/')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch((err) => {
        console.warn('Network request failed for API', err);
        throw err;
      })
    );
    return;
  }
});

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icon.png',
      })
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
