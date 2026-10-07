-- Aggiunta colonne photo_url per foto giocatori e foto gruppo squadre
-- Esegui: mysql -u futsal_user -p'0919880197Yh.' futsal < migrations/add_photo_columns.sql

ALTER TABLE players ADD COLUMN photo_url VARCHAR(500) DEFAULT NULL AFTER tournament_id;
ALTER TABLE teams ADD COLUMN photo_url VARCHAR(500) DEFAULT NULL AFTER logo_url;
