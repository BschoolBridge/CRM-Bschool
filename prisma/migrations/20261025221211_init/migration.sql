-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `password` VARCHAR(128) NOT NULL,
    `last_login` DATETIME(3) NULL,
    `is_superuser` BOOLEAN NOT NULL DEFAULT false,
    `first_name` VARCHAR(150) NOT NULL DEFAULT '',
    `last_name` VARCHAR(150) NOT NULL DEFAULT '',
    `is_staff` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `date_joined` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `email` VARCHAR(254) NOT NULL,
    `user_type` VARCHAR(1) NOT NULL DEFAULT '1',
    `gender` VARCHAR(1) NOT NULL DEFAULT '',
    `profile_pic` VARCHAR(100) NULL,
    `address` TEXT NOT NULL,
    `phone` VARCHAR(15) NOT NULL DEFAULT '',
    `fcm_token` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_user_type_idx`(`user_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_id` INTEGER NOT NULL,
    `is_superadmin` BOOLEAN NOT NULL DEFAULT true,
    `can_delete` BOOLEAN NOT NULL DEFAULT true,
    `can_view_performance` BOOLEAN NOT NULL DEFAULT true,
    `can_view_counsellor_work` BOOLEAN NOT NULL DEFAULT true,
    `can_manage_settings` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `admins_admin_id_key`(`admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `counsellors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_id` INTEGER NOT NULL,
    `employee_id` VARCHAR(20) NOT NULL,
    `department` VARCHAR(100) NOT NULL DEFAULT '',
    `joining_date` DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `can_handle_admission_followup` BOOLEAN NOT NULL DEFAULT false,
    `performance_rating` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `total_leads_assigned` INTEGER NOT NULL DEFAULT 0,
    `total_business_generated` DECIMAL(12, 2) NOT NULL DEFAULT 0,

    UNIQUE INDEX `counsellors_admin_id_key`(`admin_id`),
    UNIQUE INDEX `counsellors_employee_id_key`(`employee_id`),
    INDEX `counsellors_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `counsellor_activity_freeze_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `counsellor_id` INTEGER NOT NULL,
    `frozen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `activities_in_window` SMALLINT NOT NULL DEFAULT 5,
    `window_seconds` SMALLINT NOT NULL DEFAULT 120,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `unfrozen_at` DATETIME(3) NULL,
    `unfrozen_by_id` INTEGER NULL,

    INDEX `counsellor_activity_freeze_logs_counsellor_id_is_active_idx`(`counsellor_id`, `is_active`),
    INDEX `counsellor_activity_freeze_logs_frozen_at_idx`(`frozen_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_sources` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_sources_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_statuses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NOT NULL,
    `color` VARCHAR(20) NOT NULL DEFAULT 'secondary',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `lead_statuses_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` VARCHAR(20) NOT NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `phone` VARCHAR(15) NOT NULL,
    `alternate_phone` VARCHAR(15) NOT NULL DEFAULT '',
    `school_name` VARCHAR(200) NOT NULL DEFAULT '',
    `position` VARCHAR(100) NOT NULL DEFAULT '',
    `graduation_status` VARCHAR(3) NOT NULL DEFAULT 'NO',
    `graduation_course` VARCHAR(200) NOT NULL DEFAULT 'Not Specified',
    `graduation_year` INTEGER NULL,
    `graduation_college` VARCHAR(200) NOT NULL DEFAULT 'Not Specified',
    `course_interested` VARCHAR(200) NOT NULL DEFAULT '',
    `is_graduated` VARCHAR(3) NOT NULL DEFAULT 'NO',
    `industry` VARCHAR(100) NOT NULL DEFAULT '',
    `source_id` INTEGER NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'NEW',
    `priority` VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
    `assigned_counsellor_id` INTEGER NULL,
    `previous_counsellor_id` INTEGER NULL,
    `expected_value` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `actual_value` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `notes` TEXT NOT NULL,
    `address` TEXT NOT NULL,
    `city` VARCHAR(100) NOT NULL DEFAULT '',
    `state` VARCHAR(100) NOT NULL DEFAULT '',
    `country` VARCHAR(100) NOT NULL DEFAULT '',
    `postal_code` VARCHAR(30) NOT NULL DEFAULT '',
    `website` VARCHAR(200) NOT NULL DEFAULT '',
    `linkedin` VARCHAR(200) NOT NULL DEFAULT '',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `last_contact_date` DATETIME(3) NULL,
    `next_follow_up` DATETIME(3) NULL,
    `conversion_score` INTEGER NULL,
    `enriched_job_title` VARCHAR(150) NOT NULL DEFAULT '',
    `enrichment_notes` TEXT NOT NULL,
    `routed_to` VARCHAR(100) NOT NULL DEFAULT '',
    `routing_reason` TEXT NOT NULL,

    UNIQUE INDEX `leads_lead_id_key`(`lead_id`),
    INDEX `leads_status_idx`(`status`),
    INDEX `leads_priority_idx`(`priority`),
    INDEX `leads_phone_idx`(`phone`),
    INDEX `leads_created_at_idx`(`created_at`),
    INDEX `leads_last_contact_date_idx`(`last_contact_date`),
    INDEX `leads_next_follow_up_idx`(`next_follow_up`),
    INDEX `leads_updated_at_idx`(`updated_at`),
    INDEX `leads_assigned_counsellor_id_status_idx`(`assigned_counsellor_id`, `status`),
    INDEX `leads_assigned_counsellor_id_last_contact_date_created_at_idx`(`assigned_counsellor_id`, `last_contact_date`, `created_at`),
    INDEX `leads_source_id_status_idx`(`source_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_alternate_phones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `label` VARCHAR(50) NOT NULL DEFAULT '',
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_alternate_phones_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NOT NULL,
    `icon` VARCHAR(50) NOT NULL DEFAULT 'fas fa-tasks',
    `color` VARCHAR(20) NOT NULL DEFAULT 'info',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `activity_types_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `next_actions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `next_actions_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_activities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `counsellor_id` INTEGER NOT NULL,
    `activity_type` VARCHAR(30) NOT NULL,
    `subject` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `outcome` VARCHAR(200) NOT NULL DEFAULT '',
    `next_action` VARCHAR(200) NOT NULL DEFAULT '',
    `scheduled_date` DATETIME(3) NULL,
    `completed_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `edited_at` DATETIME(3) NULL,
    `logged_by_admin_id` INTEGER NULL,
    `duration` INTEGER NOT NULL DEFAULT 0,
    `is_completed` BOOLEAN NOT NULL DEFAULT true,

    INDEX `lead_activities_activity_type_idx`(`activity_type`),
    INDEX `lead_activities_scheduled_date_idx`(`scheduled_date`),
    INDEX `lead_activities_completed_date_idx`(`completed_date`),
    INDEX `lead_activities_is_completed_idx`(`is_completed`),
    INDEX `lead_activities_next_action_idx`(`next_action`),
    INDEX `lead_activities_lead_id_completed_date_idx`(`lead_id`, `completed_date`),
    INDEX `lead_activities_counsellor_id_completed_date_idx`(`counsellor_id`, `completed_date`),
    INDEX `lead_activities_counsellor_id_is_completed_scheduled_date_idx`(`counsellor_id`, `is_completed`, `scheduled_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `businesses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `counsellor_id` INTEGER NOT NULL,
    `business_id` VARCHAR(32) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `value` DECIMAL(12, 2) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `payment_terms` TEXT NOT NULL,
    `notes` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `businesses_business_id_key`(`business_id`),
    INDEX `businesses_status_idx`(`status`),
    INDEX `businesses_start_date_idx`(`start_date`),
    INDEX `businesses_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admitted_students` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `course` VARCHAR(200) NOT NULL,
    `lead_id` INTEGER NULL,
    `assigned_counsellor_id` INTEGER NULL,
    `call_status` VARCHAR(20) NOT NULL DEFAULT 'NEW',
    `notes` TEXT NOT NULL,
    `next_follow_up` DATETIME(3) NULL,
    `fee_due_date` DATE NULL,
    `documents_due_date` DATE NULL,
    `last_called_at` DATETIME(3) NULL,
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `admitted_students_phone_idx`(`phone`),
    INDEX `admitted_students_call_status_idx`(`call_status`),
    INDEX `admitted_students_next_follow_up_idx`(`next_follow_up`),
    INDEX `admitted_students_fee_due_date_idx`(`fee_due_date`),
    INDEX `admitted_students_documents_due_date_idx`(`documents_due_date`),
    INDEX `admitted_students_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admitted_student_remarks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `remark` TEXT NOT NULL,
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admitted_student_remarks_student_id_created_at_idx`(`student_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admitted_student_activities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `counsellor_id` INTEGER NULL,
    `activity_type` VARCHAR(30) NOT NULL,
    `subject` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `scheduled_date` DATETIME(3) NULL,
    `completed_date` DATETIME(3) NULL,
    `is_completed` BOOLEAN NOT NULL DEFAULT false,
    `is_auto_generated` BOOLEAN NOT NULL DEFAULT false,
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `admitted_student_activities_activity_type_idx`(`activity_type`),
    INDEX `admitted_student_activities_scheduled_date_idx`(`scheduled_date`),
    INDEX `admitted_student_activities_completed_date_idx`(`completed_date`),
    INDEX `admitted_student_activities_is_completed_idx`(`is_completed`),
    INDEX `admitted_student_activities_counsellor_id_completed_date_idx`(`counsellor_id`, `completed_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `counsellor_notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `counsellor_id` INTEGER NOT NULL,
    `message` TEXT NOT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `counsellor_notifications_counsellor_id_is_read_idx`(`counsellor_id`, `is_read`),
    INDEX `counsellor_notifications_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_id` INTEGER NULL,
    `message` TEXT NOT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `admin_notifications_admin_id_is_read_idx`(`admin_id`, `is_read`),
    INDEX `admin_notifications_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_transfers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `from_counsellor_id` INTEGER NOT NULL,
    `to_counsellor_id` INTEGER NOT NULL,
    `reason` TEXT NOT NULL,
    `admin_approved` BOOLEAN NOT NULL DEFAULT false,
    `approved_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approved_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `counsellor_performance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `counsellor_id` INTEGER NOT NULL,
    `month` DATE NOT NULL,
    `total_leads_assigned` INTEGER NOT NULL DEFAULT 0,
    `total_leads_contacted` INTEGER NOT NULL DEFAULT 0,
    `total_leads_qualified` INTEGER NOT NULL DEFAULT 0,
    `total_business_generated` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `conversion_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `average_response_time` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `counsellor_performance_counsellor_id_month_key`(`counsellor_id`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_access_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `counsellor_id` INTEGER NULL,
    `action` VARCHAR(50) NOT NULL,
    `lead_id` INTEGER NULL,
    `business_id` INTEGER NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `data_access_logs_action_created_at_idx`(`action`, `created_at`),
    INDEX `data_access_logs_counsellor_id_created_at_idx`(`counsellor_id`, `created_at`),
    INDEX `data_access_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_targets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `target_date` DATE NOT NULL,
    `target_count` INTEGER NOT NULL,
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `daily_targets_target_date_idx`(`target_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_target_assignments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `target_id` INTEGER NOT NULL,
    `counsellor_id` INTEGER NOT NULL,
    `completed_count` INTEGER NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `daily_target_assignments_target_id_counsellor_id_key`(`target_id`, `counsellor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meta_integration_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `public_base_url` VARCHAR(500) NOT NULL DEFAULT '',
    `verify_token` VARCHAR(255) NOT NULL DEFAULT '',
    `app_secret` VARCHAR(255) NOT NULL DEFAULT '',
    `access_token` TEXT NOT NULL,
    `whatsapp_phone_number_id` VARCHAR(64) NOT NULL DEFAULT '',
    `facebook_page_id` VARCHAR(64) NOT NULL DEFAULT '',
    `whatsapp_enabled` BOOLEAN NOT NULL DEFAULT false,
    `instagram_enabled` BOOLEAN NOT NULL DEFAULT false,
    `facebook_messenger_enabled` BOOLEAN NOT NULL DEFAULT false,
    `notify_admins_on_message` BOOLEAN NOT NULL DEFAULT true,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `aisensy_integration_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `public_base_url` VARCHAR(500) NOT NULL DEFAULT '',
    `webhook_secret` VARCHAR(255) NOT NULL DEFAULT '',
    `webhook_token` VARCHAR(255) NOT NULL DEFAULT '',
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_chat_threads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `channel` VARCHAR(20) NOT NULL,
    `external_user_id` VARCHAR(128) NOT NULL,
    `page_or_waba_id` VARCHAR(128) NOT NULL DEFAULT '',
    `display_name` VARCHAR(200) NOT NULL DEFAULT '',
    `lead_id` INTEGER NULL,
    `last_message_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_message_preview` VARCHAR(300) NOT NULL DEFAULT '',
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `social_chat_threads_channel_last_message_at_idx`(`channel`, `last_message_at`),
    INDEX `social_chat_threads_last_message_at_idx`(`last_message_at`),
    UNIQUE INDEX `uniq_social_thread_channel_user_page`(`channel`, `external_user_id`, `page_or_waba_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_chat_messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `thread_id` INTEGER NOT NULL,
    `direction` VARCHAR(3) NOT NULL,
    `body` TEXT NOT NULL,
    `external_message_id` VARCHAR(128) NOT NULL DEFAULT '',
    `error_detail` VARCHAR(500) NOT NULL DEFAULT '',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `social_chat_messages_thread_id_created_at_idx`(`thread_id`, `created_at`),
    INDEX `social_chat_messages_direction_idx`(`direction`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `sid` VARCHAR(128) NOT NULL,
    `data` MEDIUMTEXT NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,

    INDEX `sessions_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`sid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `admins` ADD CONSTRAINT `admins_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `counsellors` ADD CONSTRAINT `counsellors_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `counsellor_activity_freeze_logs` ADD CONSTRAINT `counsellor_activity_freeze_logs_counsellor_id_fkey` FOREIGN KEY (`counsellor_id`) REFERENCES `counsellors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `counsellor_activity_freeze_logs` ADD CONSTRAINT `counsellor_activity_freeze_logs_unfrozen_by_id_fkey` FOREIGN KEY (`unfrozen_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `lead_sources`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_assigned_counsellor_id_fkey` FOREIGN KEY (`assigned_counsellor_id`) REFERENCES `counsellors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_previous_counsellor_id_fkey` FOREIGN KEY (`previous_counsellor_id`) REFERENCES `counsellors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_alternate_phones` ADD CONSTRAINT `lead_alternate_phones_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_alternate_phones` ADD CONSTRAINT `lead_alternate_phones_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `counsellors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_activities` ADD CONSTRAINT `lead_activities_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_activities` ADD CONSTRAINT `lead_activities_counsellor_id_fkey` FOREIGN KEY (`counsellor_id`) REFERENCES `counsellors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_activities` ADD CONSTRAINT `lead_activities_logged_by_admin_id_fkey` FOREIGN KEY (`logged_by_admin_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `businesses` ADD CONSTRAINT `businesses_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `businesses` ADD CONSTRAINT `businesses_counsellor_id_fkey` FOREIGN KEY (`counsellor_id`) REFERENCES `counsellors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admitted_students` ADD CONSTRAINT `admitted_students_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admitted_students` ADD CONSTRAINT `admitted_students_assigned_counsellor_id_fkey` FOREIGN KEY (`assigned_counsellor_id`) REFERENCES `counsellors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admitted_students` ADD CONSTRAINT `admitted_students_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admitted_student_remarks` ADD CONSTRAINT `admitted_student_remarks_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `admitted_students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admitted_student_remarks` ADD CONSTRAINT `admitted_student_remarks_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admitted_student_activities` ADD CONSTRAINT `admitted_student_activities_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `admitted_students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admitted_student_activities` ADD CONSTRAINT `admitted_student_activities_counsellor_id_fkey` FOREIGN KEY (`counsellor_id`) REFERENCES `counsellors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admitted_student_activities` ADD CONSTRAINT `admitted_student_activities_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `counsellor_notifications` ADD CONSTRAINT `counsellor_notifications_counsellor_id_fkey` FOREIGN KEY (`counsellor_id`) REFERENCES `counsellors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_notifications` ADD CONSTRAINT `admin_notifications_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_transfers` ADD CONSTRAINT `lead_transfers_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_transfers` ADD CONSTRAINT `lead_transfers_from_counsellor_id_fkey` FOREIGN KEY (`from_counsellor_id`) REFERENCES `counsellors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_transfers` ADD CONSTRAINT `lead_transfers_to_counsellor_id_fkey` FOREIGN KEY (`to_counsellor_id`) REFERENCES `counsellors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_transfers` ADD CONSTRAINT `lead_transfers_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `counsellor_performance` ADD CONSTRAINT `counsellor_performance_counsellor_id_fkey` FOREIGN KEY (`counsellor_id`) REFERENCES `counsellors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `data_access_logs` ADD CONSTRAINT `data_access_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `data_access_logs` ADD CONSTRAINT `data_access_logs_counsellor_id_fkey` FOREIGN KEY (`counsellor_id`) REFERENCES `counsellors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `data_access_logs` ADD CONSTRAINT `data_access_logs_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `data_access_logs` ADD CONSTRAINT `data_access_logs_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_targets` ADD CONSTRAINT `daily_targets_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_target_assignments` ADD CONSTRAINT `daily_target_assignments_target_id_fkey` FOREIGN KEY (`target_id`) REFERENCES `daily_targets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_target_assignments` ADD CONSTRAINT `daily_target_assignments_counsellor_id_fkey` FOREIGN KEY (`counsellor_id`) REFERENCES `counsellors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_chat_threads` ADD CONSTRAINT `social_chat_threads_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_chat_messages` ADD CONSTRAINT `social_chat_messages_thread_id_fkey` FOREIGN KEY (`thread_id`) REFERENCES `social_chat_threads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
