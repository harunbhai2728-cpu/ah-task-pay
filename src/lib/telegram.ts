import { realSupabase } from './supabase';

export type TelegramTopicKey =
  | 'submission'
  | 'withdraw'
  | 'deposit'
  | 'registration'
  | 'login'
  | 'profile_update'
  | 'account_deletion'
  | 'support'
  | 'job_post'
  | 'job_edit'
  | 'job_delete_request'
  | 'ad_post'
  | 'balance_transfer'
  | 'redeem_code'
  | 'referral';

export const notifyTelegramEvent = async (
  topic: TelegramTopicKey,
  data: Record<string, unknown>,
) => {
  try {
    const {
      data: { session },
    } = await realSupabase.auth.getSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    await fetch('/api/telegram/event', {
      method: 'POST',
      headers,
      body: JSON.stringify({ topic, data }),
    });
  } catch (error) {
    console.error('Failed to trigger Telegram event:', error);
  }
};
