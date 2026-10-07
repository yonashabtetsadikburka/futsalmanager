-- Indici per performance con 120+ squadre
-- Esegui: mysql -u futsal_user -p'0919880197Yh.' futsal < migrations/add_indexes.sql

-- matches: query frequenti su tournament_id + status
CREATE INDEX idx_matches_tournament_status ON matches(tournament_id, status);
CREATE INDEX idx_matches_tournament_round ON matches(tournament_id, round);
CREATE INDEX idx_matches_group ON matches(group_id);
CREATE INDEX idx_matches_home ON matches(home_team_id);
CREATE INDEX idx_matches_away ON matches(away_team_id);

-- teams: query su tournament_id per standings
CREATE INDEX idx_teams_tournament ON teams(tournament_id);

-- group_teams: JOIN frequenti
CREATE INDEX idx_group_teams_group ON group_teams(group_id);
CREATE INDEX idx_group_teams_team ON group_teams(team_id);
CREATE UNIQUE INDEX idx_group_teams_unique ON group_teams(group_id, team_id);

-- match_players: JOIN su match_id e player_id
CREATE INDEX idx_match_players_match ON match_players(match_id);
CREATE INDEX idx_match_players_player ON match_players(player_id);

-- players: JOIN su team_id
CREATE INDEX idx_players_team ON players(team_id);
