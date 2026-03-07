# Frontend Web Push Integration Guide (VAPID)

This guide explains how to integrate **Web Push Notifications** with the backend endpoints already implemented in this repo.

> Scope: Web Push covers the **tab closed** case.
> For the **tab open** case (foreground/background), use Socket.IO + Web Notifications API + sound (see `NOTIFICATION_INTEGRATION_GUIDE.md`).

---

## Prerequisites

### Backend

1) VAPID env vars are set and the server restarted:

- `VAPID_SUBJECT` (e.g. `mailto:support@academia.et`)
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

2) Confirm via Swagger or curl:

- `GET /api/v1/notifications/push/vapid-public-key` returns:

```json
{ "publicKey": "..." }
```

If it returns `null`, the backend is not configured or not restarted.

### Frontend

- You must serve the app over **HTTPS** in production.
  - Web Push is blocked on insecure origins.
  - `http://localhost` is usually allowed for local development.

---

## Endpoints used by the frontend

All routes below require `Authorization: Bearer <accessToken>` except where noted.

### Get VAPID public key

- `GET /api/v1/notifications/push/vapid-public-key`
- Response:

```json
{ "publicKey": "..." }
```

### Subscribe current user

- `POST /api/v1/notifications/push/subscribe`
- Body (exact shape):

```json
{
  "endpoint": "https://...",
  "expirationTime": null,
  "keys": { "p256dh": "...", "auth": "..." }
}
```

### Unsubscribe

- Remove one endpoint:
  - `DELETE /api/v1/notifications/push/unsubscribe?endpoint=<endpoint>`
- Remove all for current user:
  - `DELETE /api/v1/notifications/push/unsubscribe`

---

## Step-by-step integration

### Step 1: Add a Service Worker file

Create a service worker file in your frontend public root.

- Common paths:
  - Next.js: `public/sw.js`
  - Vite/CRA: `public/sw.js`

Example `sw.js`:

```js
/* global self */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || 'Notification';
  const body = data.message || '';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      // icon: '/icon-192.png',
      // badge: '/badge-72.png',
      data: {
        url: data.url || '/',
        notificationId: data.notificationId,
      },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(url);
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })()
  );
});
```

Notes:
- Web Push notifications are displayed by the **service worker**, not the page.
- Custom sound is not reliably supported for true push notifications across browsers/OS.

---

### Step 2: Add a “Enable Push Notifications” button

Permission prompts should be user-initiated (button click), not on page load.

**Helper: base64url public key to Uint8Array**

```ts
export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
```

**Subscribe flow (client-side)**

```ts
export async function enablePushNotifications(params: {
  apiBaseUrl: string; // e.g. http://localhost:3001/api/v1
  accessToken: string;
}) {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers not supported in this browser');
  }

  if (!('PushManager' in window)) {
    throw new Error('Push not supported in this browser');
  }

  // 1) Get VAPID public key
  const keyRes = await fetch(`${params.apiBaseUrl}/notifications/push/vapid-public-key`, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });
  const keyJson = await keyRes.json();

  // Depending on your API wrapper/interceptor, the key might be in keyJson.data.publicKey
  // or keyJson.publicKey. Handle both safely:
  const publicKey = keyJson?.data?.publicKey ?? keyJson?.publicKey ?? null;
  if (!publicKey) {
    throw new Error('Web Push not configured on backend (publicKey is null)');
  }

  // 2) Register SW
  const registration = await navigator.serviceWorker.register('/sw.js');

  // 3) Subscribe
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  // 4) Send subscription to backend
  const subBody = subscription.toJSON();

  const subRes = await fetch(`${params.apiBaseUrl}/notifications/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify(subBody),
  });

  if (!subRes.ok) {
    const text = await subRes.text();
    throw new Error(`Subscribe failed: ${subRes.status} ${text}`);
  }

  return { subscription: subBody };
}
```

---

### Step 3: Unsubscribe flow

```ts
export async function disablePushNotifications(params: {
  apiBaseUrl: string;
  accessToken: string;
}) {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();

  // 1) Unsubscribe in browser
  if (subscription) {
    await subscription.unsubscribe();
  }

  // 2) Remove from backend (remove all for this user)
  const res = await fetch(`${params.apiBaseUrl}/notifications/push/unsubscribe`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Unsubscribe failed: ${res.status} ${text}`);
  }

  return true;
}
```

---

## End-to-end test checklist

1) Login in frontend and obtain `accessToken`.
2) Click “Enable Push Notifications”.
3) In backend (Swagger), trigger a notification (example):
   - `POST /api/v1/auth/forgot-password/request` with `{ "email": "<your email>" }`
4) Confirm:
   - Notification is saved: `GET /api/v1/notifications?status=UNREAD`
   - Browser receives a push notification (even when tab is closed).

---

## Common issues & troubleshooting

- **`publicKey` is null**
  - Backend VAPID env vars not set OR server not restarted.

- **`NotAllowedError: Permission denied`**
  - User blocked notifications for the site (browser settings).

- **`DOMException: Failed to execute 'subscribe'`**
  - Often caused by wrong `applicationServerKey` conversion.
  - Make sure you pass `Uint8Array` (from `urlBase64ToUint8Array`).

- **Backend warns about invalid `p256dh/auth`**
  - Don’t paste dummy strings into subscribe.
  - Use the real `subscription.toJSON()` output.

- **No push received**
  - Confirm the device/browser supports Web Push.
  - Ensure site is HTTPS (or localhost for dev).
  - Confirm there is a stored subscription for that user.
  - Confirm the backend can reach the push service (network).
