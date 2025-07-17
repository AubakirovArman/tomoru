# Wazzup24 Integration

This guide explains how to connect a bot to Wazzup24 for processing WhatsApp messages.

## 1. Obtain credentials

1. Log in to your Wazzup24 account.
2. Create an API token.
3. Copy the ID of the channel that will send and receive messages.

## 2. Save credentials in the app

1. Open the **Channels** page.
2. Choose a bot and enter the API key and channel ID in the Wazzup24 section.
3. Click **Сохранить Wazzup24** to store the data.

## 3. Configure webhook

Set the webhook URL in your Wazzup24 dashboard to:

```
https://your-domain.com/api/wazzup/webhook
```

## 4. Send webhook URL from the app

On the **Channels** page you will now see an additional field "URL веб-хука". Enter the public URL to your webhook and click **Отправить веб-хук**. The app will send a request to Wazzup24 to register this URL.

Incoming messages will be handled automatically and answered using the selected bot.

## Notes

- Each bot can have its own Wazzup24 credentials.
- Make sure the bot is linked to an OpenAI assistant for replies.
