-- AlterTable
ALTER TABLE "market_recaps" ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "antecede_nodes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "ticker" TEXT,
    "chokepoint" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "antecede_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "antecede_edges" (
    "id" SERIAL NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "edge_type" TEXT NOT NULL,
    "edge_category" TEXT NOT NULL,
    "weight_financial_pct" INTEGER,
    "direction" TEXT,
    "status" TEXT,
    "confidence" TEXT,
    "chokepoint_type" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "antecede_edges_pkey" PRIMARY KEY ("id")
);
