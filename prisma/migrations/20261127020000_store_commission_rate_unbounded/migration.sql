ALTER TABLE "Store" DROP CONSTRAINT "Store_commissionRateBasisPoints_check";
ALTER TABLE "Store"
  ADD CONSTRAINT "Store_commissionRateBasisPoints_check"
  CHECK ("commissionRateBasisPoints" >= 0);
