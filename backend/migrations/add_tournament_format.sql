-- Migration: Add format column to tournaments table
-- Supported values: 'girone' (default, groups + optional knockout), 'round_robin' (mini campionato, tutti vs tutti)

ALTER TABLE tournaments ADD COLUMN format VARCHAR(20) DEFAULT 'girone' AFTER type;
