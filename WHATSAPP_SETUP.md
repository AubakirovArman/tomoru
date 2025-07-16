# WhatsApp Integration

This project can respond to WhatsApp messages using **whatsapp-web.js**. The integration runs in the Next.js API route `/api/whatsapp/webhook`.

## 1. Install dependencies

```bash
npm install whatsapp-web.js qrcode-terminal
```

## 2. Environment variables

Set the ID of the bot that should answer WhatsApp messages in the environment variable `WHATSAPP_BOT_ID` and make sure `OPENAI_API_KEY` is also configured.

```
WHATSAPP_BOT_ID=1
OPENAI_API_KEY=your_openai_key
```

The WhatsApp session data is stored locally using `LocalAuth` from `whatsapp-web.js`.

## 3. Running the client

1. Start the Next.js dev server:

```bash
npm run dev
```

2. In a separate terminal, send a request to the webhook to initialise the WhatsApp client:

```bash
curl http://localhost:3000/api/whatsapp/webhook
```

A QR code will appear in the console. Scan it with the WhatsApp application on your phone to authorise the client.

Once authorised, the client will stay connected and handle incoming messages. Voice messages are transcribed with Whisper and the bot reply is sent back through WhatsApp.

