import { supabase } from './supabase';

const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export async function askNotificationPermission(userId: string) {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notification');
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    console.log('Notification permission granted.');
    await subscribeUserToPush(userId);
  } else {
    console.warn('Notification permission denied.');
  }
}

async function subscribeUserToPush(userId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
     console.warn('Push messaging is not supported');
     return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      if (!publicVapidKey) {
        console.warn('VITE_VAPID_PUBLIC_KEY is not set in environment.');
        return;
      }
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });
    }

    // Save subscription to the database
    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      subscription: subscription.toJSON(),
    }, { onConflict: 'user_id, subscription' });
    
    console.log('Push subscription saved.');
  } catch (err) {
    console.error('Failed to subscribe the user: ', err);
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
