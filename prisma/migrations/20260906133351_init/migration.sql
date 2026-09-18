-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'viewer');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "WheelStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "AlertOutcome" AS ENUM ('exploited', 'ignored', 'missed', 'pending');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'viewer',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "ticker" TEXT NOT NULL,
    "entry_price" DECIMAL(18,4) NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "sl" DECIMAL(18,4),
    "tp1" DECIMAL(18,4),
    "tp2" DECIMAL(18,4),
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "asset" TEXT NOT NULL,
    "strategy" TEXT,
    "direction" TEXT NOT NULL,
    "entry_price" DECIMAL(18,4),
    "entry_date" TIMESTAMP(3),
    "exit_price" DECIMAL(18,4),
    "exit_date" TIMESTAMP(3),
    "sizing_usd" DECIMAL(18,2),
    "sizing_pct" DECIMAL(8,4),
    "sl" DECIMAL(18,4),
    "tp1" DECIMAL(18,4),
    "tp2" DECIMAL(18,4),
    "thesis" TEXT,
    "lesson" TEXT,
    "pnl_usd" DECIMAL(18,2),
    "pnl_pct" DECIMAL(8,4),
    "tags" TEXT,
    "status" "TradeStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wheel_cycles" (
    "id" SERIAL NOT NULL,
    "phase" INTEGER NOT NULL,
    "strike" DECIMAL(18,2),
    "premium" DECIMAL(18,2),
    "expiry" DATE,
    "sl" DECIMAL(18,2),
    "result" DECIMAL(18,2),
    "scenario" TEXT,
    "pnl" DECIMAL(18,2),
    "status" "WheelStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wheel_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_recaps" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model_used" TEXT,

    CONSTRAINT "market_recaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "asset" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT,
    "relevance_score" INTEGER,
    "outcome" "AlertOutcome" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
