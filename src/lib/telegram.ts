export const sendTelegramNotification = async (message: string) => {
  const BOT_TOKEN = '8637637985:AAEHJX0E6HdP0wDAYtQwt24l9DosqQw5_QE';
  const CHAT_ID = '8968701306';
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
  }
};
