-- Classify each holiday as FIXED (company-observed festival etc.) or
-- NATIONAL (India's gazetted holidays) - a distinction requested directly,
-- not present in legacy's hrm_holidays. Defaults every existing row to
-- FIXED; a follow-up data fix reclassifies the actual national ones
-- (Republic Day, Independence Day, Mahatma Gandhi Jayanti).
ALTER TABLE `holidays` ADD COLUMN `type` ENUM('FIXED', 'NATIONAL') NOT NULL DEFAULT 'FIXED';
