-- CreateTable
CREATE TABLE "_AnalysisConfigToChat" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AnalysisConfigToChat_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AnalysisConfigToChat_B_index" ON "_AnalysisConfigToChat"("B");

-- AddForeignKey
ALTER TABLE "_AnalysisConfigToChat" ADD CONSTRAINT "_AnalysisConfigToChat_A_fkey" FOREIGN KEY ("A") REFERENCES "AnalysisConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AnalysisConfigToChat" ADD CONSTRAINT "_AnalysisConfigToChat_B_fkey" FOREIGN KEY ("B") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
