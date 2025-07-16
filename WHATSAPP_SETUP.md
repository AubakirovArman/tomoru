# WhatsApp Integration

This project can respond to WhatsApp messages using **whatsapp-web.js**. The integration runs in the Next.js API route `/api/whatsapp/webhook`.

Starting from the new UI, you can initialise the WhatsApp client directly from the Channels page. The endpoint `/api/whatsapp/connect` returns a QR code string which is shown in the browser.

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

2. Откройте раздел "Каналы" в интерфейсе приложения и нажмите кнопку **Подключить WhatsApp**. В браузере появится QR‑код, который нужно просканировать приложением WhatsApp.

После сканирования клиент будет авторизован и продолжит работу в фоне, обрабатывая входящие сообщения так же, как это описано выше.

