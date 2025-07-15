-- CreateTable
CREATE TABLE "bot_knowledge_bases" (
    "id" SERIAL NOT NULL,
    "botId" INTEGER NOT NULL,
    "knowledgeBaseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bot_knowledge_bases_botId_knowledgeBaseId_key" ON "bot_knowledge_bases"("botId", "knowledgeBaseId");

-- AddForeignKey
ALTER TABLE "bot_knowledge_bases" ADD CONSTRAINT "bot_knowledge_bases_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_knowledge_bases" ADD CONSTRAINT "bot_knowledge_bases_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
