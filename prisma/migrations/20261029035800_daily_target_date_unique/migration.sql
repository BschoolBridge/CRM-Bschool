-- One daily target per calendar date.
-- This adds an index only. It does not update or delete existing rows.
-- If any date already has more than one row, this statement fails and the table is unchanged.
CREATE UNIQUE INDEX `daily_targets_target_date_key` ON `daily_targets`(`target_date`);
