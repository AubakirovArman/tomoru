-- AlterTable
ALTER TABLE "bots" ADD COLUMN     "model" TEXT,
ADD COLUMN     "temperature" DOUBLE PRECISION,
ADD COLUMN     "topP" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "whatsappMessageId" TEXT,
ADD COLUMN     "whatsappUserId" INTEGER;

-- CreateTable
CREATE TABLE "whatsapp_users" (
    "id" SERIAL NOT NULL,
    "whatsappId" TEXT NOT NULL,
    "pushName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quick_replies" (
    "id" SERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "variations" TEXT[],
    "answer" TEXT NOT NULL,
    "botId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_users_whatsappId_key" ON "whatsapp_users"("whatsappId");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_whatsappUserId_fkey" FOREIGN KEY ("whatsappUserId") REFERENCES "whatsapp_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_replies" ADD CONSTRAINT "quick_replies_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
