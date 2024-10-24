-- Create a database:

CREATE DATABASE IF NOT EXISTS esports_data;
SHOW DATABASES;

-- Create table game_events. Partition it by tournament (vct internationals, challengers, game changers)

CREATE EXTERNAL TABLE IF NOT EXISTS esports_data.game_events (
  platformGameId string,
  damageEvent struct<
    location: string,
    causerId: struct<value: int>,
    victimId: struct<value: int>,
    killEvent: boolean,
    damageAmount: int
  >,
  playerDied struct<
    deceasedId: struct<value: int>,
    weapon: struct<
      type: string,
      fallback: struct<
        displayName: string,
        guid: string,
        inventorySlot: struct<slot: string>
      >
    >,
    assistants: array<struct<assistantId: struct<value: int>>>,
    killerId: struct<value: int>
  >,
  metadata struct<
    serverInfo: struct<processId: string, rfc190Scope: string>,
    playback: int,
    sequenceNumber: int,
    stage: int,
    gameVersion: string,
    gameId: struct<value: string>,
    eventTime: struct<includedPauses: string, omittingPauses: string>,
    wallTime: string
  >
)
PARTITIONED BY (tournament string)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
LOCATION 's3://riot-unzipped/'
TBLPROPERTIES ('has_encrypted_data'='false');

ALTER TABLE esports_data.game_events
ADD PARTITION (tournament='game-changers') LOCATION 's3://riot-unzipped/game-changers/games/';

ALTER TABLE esports_data.game_events
ADD PARTITION (tournament='vct-challengers') LOCATION 's3://riot-unzipped/vct-challengers/games/';

ALTER TABLE esports_data.game_events
ADD PARTITION (tournament='vct-international') LOCATION 's3://riot-unzipped/vct-international/games/';

-- Create players table and partition by tournament.

CREATE EXTERNAL TABLE IF NOT EXISTS esports_data.players (
  id string,
  handle string,
  first_name string,
  last_name string,
  status string,
  photo_url string,
  home_team_id string
)
PARTITIONED BY (tournament string)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
LOCATION 's3://riot-unzipped/'
TBLPROPERTIES ('has_encrypted_data'='false');

ALTER TABLE esports_data.players
ADD PARTITION (tournament='game-changers') LOCATION 's3://riot-unzipped/game-changers/esports-data/players/';

ALTER TABLE esports_data.players
ADD PARTITION (tournament='vct-challengers') LOCATION 's3://riot-unzipped/vct-challengers/esports-data/players/';

ALTER TABLE esports_data.players
ADD PARTITION (tournament='vct-international') LOCATION 's3://riot-unzipped/vct-international/esports-data/players/';

-- Create mapping data table and partition by tournaments

CREATE EXTERNAL TABLE IF NOT EXISTS esports_data.mapping_data (
  platformGameId string,
  esportsGameId string,
  tournamentId string,
  teamMapping map<string, string>,
  participantMapping map<string, string>
)
PARTITIONED BY (tournament string)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
LOCATION 's3://riot-unzipped/'
TBLPROPERTIES ('has_encrypted_data'='false');

ALTER TABLE esports_data.mapping_data
ADD PARTITION (tournament='game-changers') LOCATION 's3://riot-unzipped/game-changers/esports-data/mapping_data/';

ALTER TABLE esports_data.mapping_data
ADD PARTITION (tournament='vct-challengers') LOCATION 's3://riot-unzipped/vct-challengers/esports-data/mapping_data/';

ALTER TABLE esports_data.mapping_data
ADD PARTITION (tournament='vct-international') LOCATION 's3://riot-unzipped/vct-international/esports-data/mapping_data/';

-- Agent wise extraction
-- Forming this table for all tournaments at once will not work as the data size is huge
-- Split by tournament (vct-internationals, vct-challengers, game-changers) and merge everything

WITH unique_players AS (
  SELECT
    id,
    arbitrary(handle) AS handle
  FROM
    esports_data.players
  GROUP BY
    id
),
player_died_events AS (
  SELECT
    platformGameId AS platform_game_id,
    CAST(playerDied.deceasedId.value AS VARCHAR) AS deceased_id,
    CAST(playerDied.killerId.value AS VARCHAR) AS killer_id,
    tournament
  FROM
    esports_data.game_events
  WHERE
    playerDied IS NOT NULL
    AND tournament IN ('game-changers', 'vct-challengers', 'vct-international')
),
unique_mapping_data AS (
  SELECT
    platformGameId,
    arbitrary(participantMapping) AS participantMapping
  FROM
    esports_data.mapping_data
  WHERE
    platformGameId IN (SELECT platform_game_id FROM player_died_events)
  GROUP BY
    platformGameId
),
player_agents AS (
  SELECT
    platform_game_id,
    esports_player_id,
    MAX(agent_guid) AS agent_guid,
    MAX(tournament) AS tournament
  FROM (
    SELECT
      ge.platformGameId AS platform_game_id,
      md.participantMapping[CAST(p.playerId.value AS VARCHAR)] AS esports_player_id,
      p.selectedAgent.fallback.guid AS agent_guid,
      ge.tournament
    FROM (
      SELECT ge.*
      FROM
        esports_data.game_events ge
      INNER JOIN (
        SELECT
          platformGameId,
          MIN(metadata.sequenceNumber) AS min_sequence
        FROM
          esports_data.game_events
        WHERE
          configuration IS NOT NULL
          AND tournament IN ('game-changers', 'vct-challengers', 'vct-international')
        GROUP BY
          platformGameId
      ) min_seq
      ON
        ge.platformGameId = min_seq.platformGameId
        AND ge.metadata.sequenceNumber = min_seq.min_sequence
      WHERE
        ge.configuration IS NOT NULL
        AND ge.tournament IN ('game-changers', 'vct-challengers', 'vct-international')
    ) ge
    JOIN
      unique_mapping_data md
    ON
      ge.platformGameId = md.platformGameId
    CROSS JOIN UNNEST(
      FILTER(ge.configuration.players, p -> md.participantMapping[CAST(p.playerId.value AS VARCHAR)] IS NOT NULL)
    ) AS t(p)
  ) pa
  GROUP BY
    platform_game_id,
    esports_player_id
),
player_kills_deaths AS (
  SELECT
    pde.platform_game_id,
    pde.tournament,
    md.participantMapping[pde.deceased_id] AS deceased_esports_id,
    md.participantMapping[pde.killer_id] AS killer_esports_id,
    da.agent_guid AS deceased_agent_guid,
    ka.agent_guid AS killer_agent_guid
  FROM
    player_died_events pde
  JOIN
    unique_mapping_data md
  ON
    pde.platform_game_id = md.platformGameId
  LEFT JOIN
    player_agents da
  ON
    pde.platform_game_id = da.platform_game_id
    AND md.participantMapping[pde.deceased_id] = da.esports_player_id
  LEFT JOIN
    player_agents ka
  ON
    pde.platform_game_id = ka.platform_game_id
    AND md.participantMapping[pde.killer_id] = ka.esports_player_id
),
kill_counts AS (
  SELECT
    tournament,
    killer_esports_id AS esports_player_id,
    killer_agent_guid AS agent_guid,
    COUNT(*) AS total_kills
  FROM
    player_kills_deaths
  WHERE
    killer_agent_guid IS NOT NULL
  GROUP BY
    tournament,
    killer_esports_id,
    killer_agent_guid
),
death_counts AS (
  SELECT
    tournament,
    deceased_esports_id AS esports_player_id,
    deceased_agent_guid AS agent_guid,
    COUNT(*) AS total_deaths
  FROM
    player_kills_deaths
  WHERE
    deceased_agent_guid IS NOT NULL
  GROUP BY
    tournament,
    deceased_esports_id,
    deceased_agent_guid
),
game_counts AS (
  SELECT
    tournament,
    esports_player_id,
    agent_guid,
    COUNT(DISTINCT platform_game_id) AS games_played
  FROM (
    SELECT
      pde.tournament,
      killer_esports_id AS esports_player_id,
      killer_agent_guid AS agent_guid,
      platform_game_id
    FROM
      player_kills_deaths pde
    WHERE
      killer_agent_guid IS NOT NULL
    UNION ALL
    SELECT
      pde.tournament,
      deceased_esports_id AS esports_player_id,
      deceased_agent_guid AS agent_guid,
      platform_game_id
    FROM
      player_kills_deaths pde
    WHERE
      deceased_agent_guid IS NOT NULL
  ) AS games
  GROUP BY
    tournament,
    esports_player_id,
    agent_guid
)
SELECT
  up.handle AS player_name,
  stats.esports_player_id,
  stats.tournament,
  stats.agent_guid,
  stats.total_kills,
  stats.total_deaths,
  gc.games_played,
  ROUND(CAST(stats.total_kills AS DOUBLE) / NULLIF(gc.games_played, 0), 2) AS average_kills,
  ROUND(CAST(stats.total_deaths AS DOUBLE) / NULLIF(gc.games_played, 0), 2) AS average_deaths
FROM (
  SELECT
    COALESCE(k.esports_player_id, d.esports_player_id) AS esports_player_id,
    COALESCE(k.tournament, d.tournament) AS tournament,
    COALESCE(k.agent_guid, d.agent_guid) AS agent_guid,
    COALESCE(k.total_kills, 0) AS total_kills,
    COALESCE(d.total_deaths, 0) AS total_deaths
  FROM
    kill_counts k
  FULL OUTER JOIN
    death_counts d
  ON
    k.esports_player_id = d.esports_player_id
    AND k.tournament = d.tournament
    AND k.agent_guid = d.agent_guid
) AS stats
JOIN
  game_counts gc
ON
  stats.esports_player_id = gc.esports_player_id
  AND stats.tournament = gc.tournament
  AND stats.agent_guid = gc.agent_guid
LEFT JOIN
  unique_players up
ON
  stats.esports_player_id = up.id
ORDER BY
  stats.tournament,
  up.handle,
  stats.agent_guid

-- Creating a table for vct-internationals. Similarly create for other two
CREATE TABLE vct_international_results AS
WITH unique_players AS (
  SELECT
    id,
    arbitrary(handle) AS handle
  FROM
    esports_data.players
  WHERE
    tournament = 'vct-international'
  GROUP BY
    id
),
vct_mapping AS (
  SELECT
    platformGameId,
    participantMapping
  FROM
    esports_data.mapping_data
  WHERE
    tournament = 'vct-international'
),
config_events AS (
  SELECT
    ge.platformGameId,
    ge.configuration.players AS players,
    ge.metadata.sequenceNumber
  FROM
    esports_data_v2.game_events ge
  WHERE
    ge.tournament = 'vct-international'
    AND ge.configuration IS NOT NULL
),
first_config_events AS (
  SELECT
    platformGameId,
    players,
    ROW_NUMBER() OVER (PARTITION BY platformGameId ORDER BY metadata.sequenceNumber) AS rn
  FROM
    config_events
),
game_players AS (
  SELECT
    fce.platformGameId,
    fce.players
  FROM
    first_config_events fce
  WHERE
    fce.rn = 1
),
player_participation AS (
  SELECT
    gp.platformGameId,
    pm.participantMapping[CAST(p.playerId.value AS VARCHAR)] AS esports_player_id
  FROM
    game_players gp
  JOIN
    vct_mapping pm
    ON gp.platformGameId = pm.platformGameId
  CROSS JOIN UNNEST(gp.players) AS t(p)
  WHERE
    pm.participantMapping[CAST(p.playerId.value AS VARCHAR)] IS NOT NULL
),
game_counts AS (
  SELECT
    esports_player_id,
    COUNT(DISTINCT platformGameId) AS games_played
  FROM
    player_participation
  GROUP BY
    esports_player_id
)
SELECT
  up.handle AS player_name,
  gc.esports_player_id,
  gc.games_played
FROM
  game_counts gc
LEFT JOIN
  unique_players up
ON
  gc.esports_player_id = up.id
ORDER BY
  gc.games_played DESC;

-- Merge all results
CREATE TABLE all_tournaments_results AS
SELECT * FROM vct_international_results
UNION ALL
SELECT * FROM vct_challengers_results
UNION ALL
SELECT * FROM game_changers_results;
