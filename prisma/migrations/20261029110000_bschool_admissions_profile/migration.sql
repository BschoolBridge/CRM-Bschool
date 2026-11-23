-- Adds MBA counselling tables and nullable lead columns.
-- Does not update or delete existing rows. Existing status codes stay.

ALTER TABLE `leads` ADD COLUMN `whatsapp_phone` VARCHAR(20) NULL;
ALTER TABLE `leads` ADD COLUMN `preferred_language` VARCHAR(50) NULL;
ALTER TABLE `leads` ADD COLUMN `source_campaign` VARCHAR(150) NULL;

CREATE TABLE `lead_academic_profiles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `highest_qualification` VARCHAR(150) NULL,
    `grading_system` VARCHAR(20) NULL,
    `graduation_percentage` DECIMAL(5, 2) NULL,
    `graduation_cgpa` DECIMAL(4, 2) NULL,
    `cgpa_scale` DECIMAL(3, 1) NULL,
    `class10_percentage` DECIMAL(5, 2) NULL,
    `class12_percentage` DECIMAL(5, 2) NULL,
    `academic_gap_months` INTEGER NULL,
    `work_experience_months` INTEGER NULL,
    `employment_status` VARCHAR(40) NULL,
    `professional_background` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `lead_academic_profiles_lead_id_key`(`lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `entrance_exams` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `score_kind` VARCHAR(20) NOT NULL DEFAULT 'MIXED',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `entrance_exams_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lead_exam_attempts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `exam_id` INTEGER NOT NULL,
    `exam_year` INTEGER NULL,
    `admission_cycle` VARCHAR(20) NULL,
    `attempt_number` INTEGER NULL,
    `raw_score` DECIMAL(8, 2) NULL,
    `scaled_score` DECIMAL(8, 2) NULL,
    `percentile` DECIMAL(5, 2) NULL,
    `registration_status` VARCHAR(40) NULL,
    `result_status` VARCHAR(40) NULL,
    `result_date` DATE NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `verification_notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `lead_exam_attempts_lead_id_exam_id_idx`(`lead_id`, `exam_id`),
    INDEX `lead_exam_attempts_exam_id_idx`(`exam_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lead_preferences` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `program_type` VARCHAR(20) NULL,
    `fee_min` DECIMAL(12, 2) NULL,
    `fee_max` DECIMAL(12, 2) NULL,
    `budget_flexibility` VARCHAR(40) NULL,
    `willing_to_relocate` VARCHAR(20) NULL,
    `hostel_preference` VARCHAR(20) NULL,
    `intake_year` INTEGER NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `lead_preferences_lead_id_key`(`lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lead_preference_locations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `preference_id` INTEGER NOT NULL,
    `location` VARCHAR(100) NOT NULL,

    INDEX `lead_preference_locations_preference_id_idx`(`preference_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lead_preference_specializations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `preference_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,

    INDEX `lead_preference_specializations_preference_id_idx`(`preference_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lead_preference_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `preference_id` INTEGER NOT NULL,
    `category` VARCHAR(100) NOT NULL,

    INDEX `lead_preference_categories_preference_id_idx`(`preference_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lead_counselling` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `requirement` TEXT NULL,
    `main_objective` TEXT NULL,
    `budget_concerns` TEXT NULL,
    `location_constraints` TEXT NULL,
    `academic_concerns` TEXT NULL,
    `exam_concerns` TEXT NULL,
    `guardian_involvement` VARCHAR(20) NULL,
    `last_summary` TEXT NULL,
    `next_recommended_action` VARCHAR(200) NULL,
    `counsellor_remarks` TEXT NULL,
    `status_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `lead_counselling_lead_id_key`(`lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `college_shortlist_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `college_name` VARCHAR(200) NOT NULL,
    `program_name` VARCHAR(200) NULL,
    `location` VARCHAR(150) NULL,
    `admission_cycle` VARCHAR(20) NULL,
    `accepted_exams` VARCHAR(300) NULL,
    `eligibility_notes` TEXT NULL,
    `fee_min` DECIMAL(12, 2) NULL,
    `fee_max` DECIMAL(12, 2) NULL,
    `preference_note` VARCHAR(200) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'CONSIDERING',
    `application_deadline` DATE NULL,
    `verification_status` VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED',
    `last_verified_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `college_shortlist_entries_lead_id_status_idx`(`lead_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `mba_applications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `shortlist_entry_id` INTEGER NULL,
    `college_name` VARCHAR(200) NOT NULL,
    `program_name` VARCHAR(200) NULL,
    `admission_cycle` VARCHAR(20) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED',
    `application_reference` VARCHAR(80) NULL,
    `submitted_at` DATETIME(3) NULL,
    `deadline` DATE NULL,
    `outstanding_requirements` TEXT NULL,
    `offer_status` VARCHAR(30) NULL,
    `next_action` VARCHAR(200) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `mba_applications_lead_id_status_idx`(`lead_id`, `status`),
    INDEX `mba_applications_shortlist_entry_id_idx`(`shortlist_entry_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `lead_academic_profiles` ADD CONSTRAINT `lead_academic_profiles_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lead_exam_attempts` ADD CONSTRAINT `lead_exam_attempts_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lead_exam_attempts` ADD CONSTRAINT `lead_exam_attempts_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `entrance_exams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `lead_preferences` ADD CONSTRAINT `lead_preferences_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lead_preference_locations` ADD CONSTRAINT `lead_preference_locations_preference_id_fkey` FOREIGN KEY (`preference_id`) REFERENCES `lead_preferences`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lead_preference_specializations` ADD CONSTRAINT `lead_preference_specializations_preference_id_fkey` FOREIGN KEY (`preference_id`) REFERENCES `lead_preferences`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lead_preference_categories` ADD CONSTRAINT `lead_preference_categories_preference_id_fkey` FOREIGN KEY (`preference_id`) REFERENCES `lead_preferences`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lead_counselling` ADD CONSTRAINT `lead_counselling_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `college_shortlist_entries` ADD CONSTRAINT `college_shortlist_entries_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `college_shortlist_entries` ADD CONSTRAINT `college_shortlist_entries_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `mba_applications` ADD CONSTRAINT `mba_applications_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `mba_applications` ADD CONSTRAINT `mba_applications_shortlist_entry_id_fkey` FOREIGN KEY (`shortlist_entry_id`) REFERENCES `college_shortlist_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `lead_statuses` (`code`, `name`, `description`, `color`, `is_active`, `is_system`, `sort_order`, `created_at`)
SELECT 'CONTACT_PENDING', 'Contact Pending', '', 'secondary', true, false, 90, CURRENT_TIMESTAMP(3) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `lead_statuses` WHERE `code` = 'CONTACT_PENDING');
INSERT INTO `lead_statuses` (`code`, `name`, `description`, `color`, `is_active`, `is_system`, `sort_order`, `created_at`)
SELECT 'COUNSELLING_SCHEDULED', 'Counselling Scheduled', '', 'info', true, false, 100, CURRENT_TIMESTAMP(3) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `lead_statuses` WHERE `code` = 'COUNSELLING_SCHEDULED');
INSERT INTO `lead_statuses` (`code`, `name`, `description`, `color`, `is_active`, `is_system`, `sort_order`, `created_at`)
SELECT 'COUNSELLING_COMPLETED', 'Counselling Completed', '', 'primary', true, false, 110, CURRENT_TIMESTAMP(3) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `lead_statuses` WHERE `code` = 'COUNSELLING_COMPLETED');
INSERT INTO `lead_statuses` (`code`, `name`, `description`, `color`, `is_active`, `is_system`, `sort_order`, `created_at`)
SELECT 'PROFILE_EVALUATION_PENDING', 'Profile Evaluation Pending', '', 'warning', true, false, 120, CURRENT_TIMESTAMP(3) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `lead_statuses` WHERE `code` = 'PROFILE_EVALUATION_PENDING');
INSERT INTO `lead_statuses` (`code`, `name`, `description`, `color`, `is_active`, `is_system`, `sort_order`, `created_at`)
SELECT 'COLLEGE_SHORTLISTING', 'College Shortlisting', '', 'info', true, false, 130, CURRENT_TIMESTAMP(3) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `lead_statuses` WHERE `code` = 'COLLEGE_SHORTLISTING');
INSERT INTO `lead_statuses` (`code`, `name`, `description`, `color`, `is_active`, `is_system`, `sort_order`, `created_at`)
SELECT 'APPLICATION_IN_PROGRESS', 'Application In Progress', '', 'primary', true, false, 140, CURRENT_TIMESTAMP(3) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `lead_statuses` WHERE `code` = 'APPLICATION_IN_PROGRESS');
INSERT INTO `lead_statuses` (`code`, `name`, `description`, `color`, `is_active`, `is_system`, `sort_order`, `created_at`)
SELECT 'APPLICATION_SUBMITTED', 'Application Submitted', '', 'success', true, false, 150, CURRENT_TIMESTAMP(3) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `lead_statuses` WHERE `code` = 'APPLICATION_SUBMITTED');
INSERT INTO `lead_statuses` (`code`, `name`, `description`, `color`, `is_active`, `is_system`, `sort_order`, `created_at`)
SELECT 'ADMISSION_OFFERED', 'Admission Offered', '', 'success', true, false, 160, CURRENT_TIMESTAMP(3) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `lead_statuses` WHERE `code` = 'ADMISSION_OFFERED');
INSERT INTO `lead_statuses` (`code`, `name`, `description`, `color`, `is_active`, `is_system`, `sort_order`, `created_at`)
SELECT 'CONVERTED', 'Converted', '', 'success', true, false, 170, CURRENT_TIMESTAMP(3) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `lead_statuses` WHERE `code` = 'CONVERTED');
INSERT INTO `lead_statuses` (`code`, `name`, `description`, `color`, `is_active`, `is_system`, `sort_order`, `created_at`)
SELECT 'ON_HOLD', 'On Hold', '', 'warning', true, false, 180, CURRENT_TIMESTAMP(3) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `lead_statuses` WHERE `code` = 'ON_HOLD');
INSERT INTO `lead_statuses` (`code`, `name`, `description`, `color`, `is_active`, `is_system`, `sort_order`, `created_at`)
SELECT 'DISQUALIFIED', 'Disqualified', '', 'danger', true, false, 190, CURRENT_TIMESTAMP(3) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `lead_statuses` WHERE `code` = 'DISQUALIFIED');

INSERT INTO `entrance_exams` (`code`, `name`, `score_kind`, `is_active`, `sort_order`)
SELECT 'CAT', 'CAT', 'PERCENTILE', true, 10 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `entrance_exams` WHERE `code` = 'CAT');
INSERT INTO `entrance_exams` (`code`, `name`, `score_kind`, `is_active`, `sort_order`)
SELECT 'XAT', 'XAT', 'PERCENTILE', true, 20 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `entrance_exams` WHERE `code` = 'XAT');
INSERT INTO `entrance_exams` (`code`, `name`, `score_kind`, `is_active`, `sort_order`)
SELECT 'NMAT', 'NMAT', 'SCALED', true, 30 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `entrance_exams` WHERE `code` = 'NMAT');
INSERT INTO `entrance_exams` (`code`, `name`, `score_kind`, `is_active`, `sort_order`)
SELECT 'SNAP', 'SNAP', 'SCALED', true, 40 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `entrance_exams` WHERE `code` = 'SNAP');
INSERT INTO `entrance_exams` (`code`, `name`, `score_kind`, `is_active`, `sort_order`)
SELECT 'CMAT', 'CMAT', 'MIXED', true, 50 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `entrance_exams` WHERE `code` = 'CMAT');
INSERT INTO `entrance_exams` (`code`, `name`, `score_kind`, `is_active`, `sort_order`)
SELECT 'MAT', 'MAT', 'MIXED', true, 60 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `entrance_exams` WHERE `code` = 'MAT');
INSERT INTO `entrance_exams` (`code`, `name`, `score_kind`, `is_active`, `sort_order`)
SELECT 'GMAT', 'GMAT', 'SCALED', true, 70 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `entrance_exams` WHERE `code` = 'GMAT');
INSERT INTO `entrance_exams` (`code`, `name`, `score_kind`, `is_active`, `sort_order`)
SELECT 'MAH_MBA_CET', 'MAH MBA CET', 'PERCENTILE', true, 80 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `entrance_exams` WHERE `code` = 'MAH_MBA_CET');
INSERT INTO `entrance_exams` (`code`, `name`, `score_kind`, `is_active`, `sort_order`)
SELECT 'OTHER', 'Other', 'MIXED', true, 90 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `entrance_exams` WHERE `code` = 'OTHER');
