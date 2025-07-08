-- CreateTable
ALTER TABLE "bots" ADD COLUMN "telegramBotToken" TEXT;
ALTER TABLE "bots" ADD COLUMN "telegramWebhookUrl" TEXT;
ALTER TABLE "bots" ADD COLUMN "telegramEnabled" BOOLEAN NOT NULL DEFAULT false;