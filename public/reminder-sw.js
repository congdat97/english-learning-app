/**
 * Nhắc học tiếng Anh - Service Worker
 *
 * notificationclick: bấm thông báo ->
 * mở/focus app, vào trang Sổ từ vựng.
 */

self.addEventListener('notificationclick', function (event) {

  event.notification.close();

  var target =
    (event.notification.data &&
      event.notification.data.url) ||
    '/bookmarks';

  event.waitUntil(

    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true
      })
      .then(function (list) {

        for (var i = 0; i < list.length; i++) {
          if ('focus' in list[i]) {
            return list[i].focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(target);
        }

      })

  );

});
