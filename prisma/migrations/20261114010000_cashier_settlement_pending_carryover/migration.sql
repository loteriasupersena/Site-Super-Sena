ALTER TABLE "CashierSettlement"
  ADD COLUMN "pendingCashSalesCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pendingCashSalesCents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "CashierSettlement"
  ADD CONSTRAINT "CashierSettlement_pendingCashSalesCount_check"
    CHECK ("pendingCashSalesCount" >= 0),
  ADD CONSTRAINT "CashierSettlement_pendingCashSalesCents_check"
    CHECK ("pendingCashSalesCents" >= 0);
