-- Run once in MySQL (Workbench or the mysql command line) before starting the backend.
-- The tables are created automatically by the backend on first start.
CREATE DATABASE IF NOT EXISTS crewdesk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Optional: a dedicated user instead of root
-- CREATE USER 'crewdesk'@'localhost' IDENTIFIED BY 'choose_a_password';
-- GRANT ALL PRIVILEGES ON crewdesk.* TO 'crewdesk'@'localhost';
-- FLUSH PRIVILEGES;
