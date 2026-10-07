-- Add location, dates, and description to tournaments
ALTER TABLE tournaments
  ADD COLUMN location VARCHAR(255) DEFAULT NULL AFTER logo_url,
  ADD COLUMN start_date DATE DEFAULT NULL AFTER location,
  ADD COLUMN end_date DATE DEFAULT NULL AFTER start_date,
  ADD COLUMN description TEXT DEFAULT NULL AFTER end_date;
