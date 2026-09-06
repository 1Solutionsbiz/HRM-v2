-- Allow an employee to have more than one emergency contact (legacy data
-- has real employees with 2-3 contacts; V2's 1:1 unique constraint silently
-- dropped all but one during import). Create the plain index before
-- dropping the unique one - MariaDB won't drop a unique index that's the
-- only index backing the `employeeId` foreign key.
CREATE INDEX `employee_emergency_contacts_employeeId_idx` ON `employee_emergency_contacts`(`employeeId`);

ALTER TABLE `employee_emergency_contacts` DROP INDEX `employee_emergency_contacts_employeeId_key`;
