self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || 'ProteticFlow';
  const options = {
    body: payload.body || 'Voce recebeu uma nova notificacao.',
    data: {
      url: payload.url || '/',
    },
    badge: '/favicon.ico',
    icon: '/favicon.ico',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const appClient = clientsArr.find((client) => 'focus' in client);
      if (appClient) {
        appClient.focus();
        appClient.navigate(targetUrl);
        return;
      }
      self.clients.openWindow(targetUrl);
    }),
  );
});
