# Web Push Notifications Setup Guide

This guide details how to complete the Web Push Notifications integration using standard VAPID logic and Supabase Edge Functions.

## 1. Generate VAPID Keys
To send web push notifications securely, you need VAPID keys. You can generate them easily using `web-push` CLI:
```bash
npx web-push generate-vapid-keys
```
This will give you a **Public Key** and a **Private Key**.

## 2. Update Environment Variables 
Add the Public Key to your frontend `.env` so we can ask for permissions:
```env
VITE_VAPID_PUBLIC_KEY="YOUR_PUBLIC_VAPID_KEY"
```

## 3. Create the Database Artifacts
Go to your Supabase SQL Editor and run the SQL provided in `/notifications-upgrade.sql`. This will:
- Create the `push_subscriptions` table.
- Set up automated JSONB triggers to add notifications natively directly into the user's Profile (`notifications` column) on Task and Withdrawal state changes.

## 4. Supabase Edge Function Setup (Backend)
To push messages to mobile devices, you need a backend listener. We will use a Supabase Edge Function listening to Database Webhooks.

1. Initialize a generic edge function:
   ```bash
   npx supabase functions new push-notifications
   ```
2. In `supabase/functions/push-notifications/index.ts`, add the following code (using the `web-push` library via Deno/ESM):

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webPush from "npm:web-push";
import { createClient } from "npm:@supabase/supabase-js";

const publicVapidKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const privateVapidKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

webPush.setVapidDetails("mailto:admin@example.com", publicVapidKey, privateVapidKey);

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  try {
    const payload = await req.json();

    // payload comes from a webhook trigger on the public.profiles table or public.notifications
    // Note: Since we are updating the JSONB array in profiles, it's easier to trigger
    // a webhook when a row in `profiles` is updated and `notifications` array size increases.
    
    // Simplest Webhook: Configure Supabase Database Webhook to hit this Edge Function
    // Table: `profiles`
    // Event: `UPDATE`
    
    const oldRecord = payload.old_record;
    const newRecord = payload.record;
    
    const oldNotifs = oldRecord?.notifications || [];
    const newNotifs = newRecord?.notifications || [];
    
    // Check if a new notification was added
    if (newNotifs.length > oldNotifs.length) {
       const latestNotif = newNotifs[newNotifs.length - 1]; // We appended to the array 
       
       // Get user's push subscriptions
       const { data: subs } = await supabase
         .from("push_subscriptions")
         .select("subscription")
         .eq("user_id", newRecord.id);
         
       if (subs && subs.length > 0) {
         for (const sub of subs) {
           await webPush.sendNotification(
             sub.subscription,
             JSON.stringify({
               title: "AH Task Pay",
               body: latestNotif.message,
             })
           ).catch(err => {
              if (err.statusCode === 410) {
                 // Subscription expired, remove from DB
                 supabase.from("push_subscriptions").delete().eq("subscription", sub.subscription).then();
              }
           });
         }
       }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    return new Response("Error processing push", { status: 500 });
  }
});
```

## 5. Enable the Webhook
1. Go to your **Supabase Dashboard** -> **Database** -> **Webhooks**.
2. Create a new Webhook on the `profiles` table for `UPDATE` events.
3. Set the target to your Edge Function URL (`https://[project-ref].supabase.co/functions/v1/push-notifications`).

## 6. Service Worker for the Frontend
To allow the browser to pop-up the notification card when the tab is closed, put a `service-worker.js` (or `sw.js`) file in your `public` folder:

```javascript
// public/service-worker.js
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icon.png', // Add your icon URL here
        badge: '/badge.png'
      })
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  // Optional: open the app tab
  event.waitUntil(
    clients.openWindow('/')
  );
});
```

And link it in your React `main.tsx` or `App.tsx`:
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(reg => console.log('SW registered!', reg))
    .catch(err => console.error('SW Error!', err));
}
```

That completes the push notification setup!
