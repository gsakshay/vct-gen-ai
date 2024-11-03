import { ApiGatewayManagementApiClient, PostToConnectionCommand, DeleteConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { BedrockAgentRuntimeClient, RetrieveCommand as KBRetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda"
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  QueryExecutionState,
  GetQueryResultsCommand,
} from '@aws-sdk/client-athena';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';


import { readFile } from 'fs/promises';
import ClaudeModel from "./models/claude3Sonnet.mjs";
import Mistral7BModel from "./models/mistral7b.mjs"

import * as cheerio from 'cheerio';

/*global fetch*/

const ENDPOINT = process.env.WEBSOCKET_API_ENDPOINT;
const SYS_PROMPT = process.env.PROMPT;
const wsConnectionClient = new ApiGatewayManagementApiClient({ endpoint: ENDPOINT });

const ATHENA_OUTPUT_BUCKET = "s3://riot-unzipped/athena-results/"  // S3 bucket where Athena will put the results
const DATABASE = 'default-db'  // The name of the database in Athena

let agents = JSON.parse(await readFile("agents.json", "utf8"));

const client = new DynamoDBClient({ region: 'us-east-1' }); // Replace with your region
const dynamo = DynamoDBDocumentClient.from(client);

export async function runQuery(query) {
  const client = new AthenaClient();

  const params = {
    QueryString: query, // Replace with your query
    ResultConfiguration: {
      OutputLocation: ATHENA_OUTPUT_BUCKET, // Replace with your S3 output location
    },
    QueryExecutionContext: {
      Database: DATABASE,
      // Catalog: this.catalog,
    },

  };

  try {
    const startQueryExecutionCommand = new StartQueryExecutionCommand(params);
    const startQueryResponse = await client.send(startQueryExecutionCommand);

    const queryExecutionId = startQueryResponse.QueryExecutionId;

    let getQueryResponse = {}
    // Poll for query completion
    let queryStatus = "RUNNING";
    while (queryStatus === "RUNNING" || queryStatus === "QUEUED") {
      const getQueryExecutionCommand = new GetQueryExecutionCommand({
        QueryExecutionId: queryExecutionId,
      });
      getQueryResponse = await client.send(getQueryExecutionCommand);
      queryStatus = getQueryResponse.QueryExecution.Status.State;

      if (queryStatus === "FAILED" || queryStatus === "CANCELLED") {
        throw new Error(`Query failed: ${getQueryResponse.QueryExecution.Status.StateChangeReason}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before polling again
    }

    // Query is successful
    // console.log("Query results available at:", getQueryResponse.QueryExecution.ResultConfiguration.OutputLocation);
    const getQueryResultsCommand = new GetQueryResultsCommand({
      QueryExecutionId: queryExecutionId,
    });
    const response = await client.send(getQueryResultsCommand);

    const resultSet = response.ResultSet;

    const mappedData = [];

    const columns = resultSet.Rows[0].Data.map((column) => {
      return column.VarCharValue;
    });

    resultSet.Rows.forEach((item, i) => {
      if (i === 0) {
        return;
      }

      const mappedObject = {};
      item.Data.forEach((value, i) => {
        if (value.VarCharValue) {
          mappedObject[columns[i]] = value.VarCharValue;
        } else {
          mappedObject[columns[i]] = '';
        }
      });

      mappedData.push(mappedObject);
    });

    return mappedData;

  } catch (err) {
    console.error("Error running query:", err);
  }
}

async function retrievePlayers(sortBy = "games_played", tournament = null, agentType = null) {

  const agentMap = agents.data.reduce((map, agent) => {
    map[agent.displayName] = agent.uuid.toUpperCase();
    return map;
  }, {});

  const agentRoles = {
    "duelist": ["Jett", "Phoenix", "Reyna", "Raze", "Yoru", "Neon", "Iso"],
    "controller": ["Brimstone", "Omen", "Viper", "Astra", "Harbor", "Clove"],
    "initiator": ["Sova", "Breach", "Skye", "KAY/O", "Fade", "Gekko"],
    "sentinel": ["Sage", "Cypher", "Killjoy", "Chamber", "Deadlock", "Vyse"]
  };

  const agentRoleUUIDs = {
    "duelist": [],
    "controller": [],
    "initiator": [],
    "sentinel": []
  };

  // Dynamically fill the agentRoleUUIDs using agentMap and agentRoles
  for (let role in agentRoles) {
    agentRoles[role].forEach(agentName => {
      if (agentMap[agentName]) {
        agentRoleUUIDs[role].push(agentMap[agentName]);
      }
    });
  }

  let baseQuery = `
  select player_name, ${agentType ? 'agent_guid,' : ''} sum(total_kills) as total_kills, sum(total_deaths) as total_deaths,
  sum(games_played) as games_played, avg(average_kills) as average_kills,
  avg(average_deaths) as average_deaths
  from esports_data_v2.new_tournament_data
  `;

  // Add conditions for tournament and agent_type
  let conditions = [];
  if (tournament) {
    conditions.push(`tournament = '${tournament}'`);
  }
  if (agentType) {
    const agentUUIDs = agentRoleUUIDs[agentType];
    if (agentUUIDs && agentUUIDs.length > 0) {
      const uuidList = agentUUIDs.map(uuid => `'${uuid}'`).join(", ");
      conditions.push(`agent_guid IN (${uuidList})`);
    }
  }

  // If there are conditions, add them to the query
  if (conditions.length > 0) {
    baseQuery += `where ${conditions.join(' and ')} `;
  }

  // Group by and order by clauses
  baseQuery += `
  group by 
  player_name ${agentType ? ', agent_guid' : ''}
  order by
  ${sortBy} desc
  limit 30;
  `;

  let result = await runQuery(baseQuery)
  result = replaceUUIDsWithAgentNames(result, agents);

  return result.map(player => {
    return `Player: ${player.player_name}, ${agentType ? 'Agent: ' + player.agent_guid + ',' : ''}  Avg Kills: ${player.average_kills}, Avg Assists: ${player.average_assists}, Avg Deaths: ${player.average_deaths}, Avg Score: ${player.avg_score}, KDR: ${player.kdr}, Games Played: ${player.games_played}`;
  }).join('\n');
}

function replaceUUIDsWithAgentNames(playerData, agentData) {
  // Create a map of UUIDs to agent names
  const agentMap = agentData.data.reduce((map, agent) => {
    map[agent.uuid.toUpperCase()] = agent.displayName;
    return map;
  }, {});

  // Replace UUIDs in player data with agent names
  return playerData.map(player => {
    const agentName = agentMap[player.agent_guid] || player.agent_guid; // Default to the UUID if not found
    return {
      ...player,
      agent_guid: agentName // Replace the UUID with the agent name
    };
  });
}

async function retrievePlayerList(region, tournament, agent, map) {
  const mapMap = {
    "all": "all",
    "abyss": 13,
    "ascent": 5,
    "bind": 1,
    "breeze": 8,
    "fracture": 9,
    "haven": 2,
    "icebox": 6,
    "lotus": 11,
    "pearl": 10,
    "split": 3,
    "sunset": 12
  }

  const tournamentMap = {
    "international": 61,
    "game-changers": 62,
    "challengers": 59,
    "all": "all"
  }

  const url = `https://www.vlr.gg/stats/?event_group_id=${tournament ? tournamentMap[tournament] : "all"}&event_id=all&region=${region ? region : "all"}&min_rounds=100&min_rating=${1550}&agent=${agent ? agent : "all"}&map_id=${map ? mapMap[map] : "all"}&timespan=all`
  const response = await fetch(url);
  console.log(response);
  const html = await response.text();

  const $ = cheerio.load(html);
  const table = $("table");
  const data = [];

  table.find("tr").each((i, row) => {
    const rowData = [];

    if (i == 0) {
      // do nothing, we don't care about the header row

    } else {

      const cells = $(row).find("td")
      const player = {
        name: $(cells[0]).find("a").attr("href"),
        agents: [],
        rounds_played: $(cells[2]).text().trim(),
        rating: $(cells[3]).text().trim(),
        avg_combat_score: $(cells[4]).text().trim(),
        kill_death_ratio: $(cells[5]).text().trim(),
        kill_assist_trade_survive_pct: $(cells[6]).text().trim(),
        avg_damage_per_round: $(cells[7]).text().trim(),
        kills_per_round: $(cells[8]).text().trim(),
        assist_per_round: $(cells[9]).text().trim(),
        first_kill_per_round: $(cells[10]).text().trim(),
        first_deaths_per_round: $(cells[11]).text().trim(),
        headshot_pct: $(cells[12]).text().trim(),
        clutch_pct: $(cells[13]).text().trim(),
        clutches: $(cells[14]).text().trim(),
        kmax: $(cells[15]).text().trim(),
        kills: $(cells[16]).text().trim(),
        deaths: $(cells[17]).text().trim(),
        assists: $(cells[18]).text().trim(),
        first_kills: $(cells[19]).text().trim(),
        first_deaths: $(cells[20]).text().trim(),
      }

      $(cells[1]).find("img").each((k, img) => {
        const src = $(img).attr("src");
        if (src) {
          // Clean up the image path if needed
          player.agents.push(src.replace("/img/vlr/game/agents/", '').replace(".png", ""));
        }
      });

      data.push(player);
    }
  });

  // we want to save all of the retrieved player URLs to dynamodb
  // definitely a bit expensive but that's okay I hope
  for (const player of data.slice(0, 50)) {
    const url = player.name;
    console.log(player.name)
    const userID = player.name.split("/")[3]
    const params = {
      TableName: process.env.PLAYER_TABLE, // Replace with your table name
      Item: {
        userID: userID.toLowerCase(), // Replace with your primary key and value
        userPage: url,
      },
    };

    try {
      const command = new PutCommand(params);
      const result = await dynamo.send(command);
      console.log('Item saved successfully:', result);
    } catch (error) {
      console.error('Error saving item:', error);
    }
  };

  return data.slice(0, 50);

}

async function retrievePlayer(playerID) {
  const params = {
    TableName: process.env.PLAYER_TABLE, // Replace with your table name
    Key: {
      userID: playerID.toLowerCase(), // Replace with your primary key and value
      // Include SortKey if your table uses a composite key
    },
  };

  try {
    const command = new GetCommand(params);
    const result = await dynamo.send(command);
    let url;
    if (result.Item) {
      console.log('Item retrieved:', result.Item);
      url = "https://vlr.gg" + result.Item.userPage + "/?timespan=all"
    } else {
      console.log('Item not found');
    }

    const response = await fetch(url);
    console.log(response);
    const html = await response.text();

    const $ = cheerio.load(html);
    const table = $("table");

    const data = []

    table.find("tr").each((i, row) => {
      if (i == 0) {
        // do nothing, we don't care about the header row

      } else {

        const cells = $(row).find("td")
        const agent = {
          name: $(cells[0]).find("img").attr("src").replace("/img/vlr/game/agents/", '').replace(".png", ""),
          use_pct: $(cells[1]).text().trim(),
          rounds_played: $(cells[2]).text().trim(),
          rating: $(cells[3]).text().trim(),
          acs: $(cells[4]).text().trim(),
          kill_death_ratio: $(cells[5]).text().trim(),
          avg_damage_per_round: $(cells[6]).text().trim(),
          kill_assist_trade_survive_pct: $(cells[7]).text().trim(),
          kills_per_round: $(cells[8]).text().trim(),
          assist_per_round: $(cells[9]).text().trim(),
          first_kill_per_round: $(cells[10]).text().trim(),
          first_deaths_per_round: $(cells[11]).text().trim(),
          kills: $(cells[12]).text().trim(),
          deaths: $(cells[13]).text().trim(),
          assists: $(cells[14]).text().trim(),
          first_kills: $(cells[15]).text().trim(),
          first_deaths: $(cells[16]).text().trim(),
        }

        data.push(agent);
      }


    });

    // return data;

    const matches = []

    const pieces = result.Item.userPage.split("/")
    const id = pieces[2]
    const name = pieces[3]

    const matchUrl = `https://vlr.gg/player/matches/${id}/${name}/?timespan=all`

    const matchesResponse = await fetch(matchUrl);
    console.log(response);
    const matchHTML = await matchesResponse.text();

    const match$ = cheerio.load(matchHTML);

    match$('a.wf-card.fc-flex.m-item').each((index, element) => {
      const link = match$(element).attr('href');

      // Extract event name and match stage
      const matchEventDiv = match$(element).find('.m-item-event.text-of');
      const eventName = matchEventDiv.find('div[style*="font-weight: 700"]').text().trim();
      const matchStage = matchEventDiv
        .clone()    // Clone the element
        .children() // Remove all child elements
        .remove()
        .end()
        .text()
        .replace(/•/g, '•') // Replace any special characters if necessary
        .trim();

      // Extract result
      const resultDiv = match$(element).find('.m-item-result');
      const scores = resultDiv.find('span');
      const team1Score = match$(scores[0]).text().trim();
      const team2Score = match$(scores[1]).text().trim();
      const result = `${team1Score} : ${team2Score}`;

      // Extract teams
      const team1Div = match$(element).find('.m-item-team.text-of').first();
      const team2Div = match$(element).find('.m-item-team.text-of.mod-right');

      const team1Name = team1Div.find('.m-item-team-name').text().trim();
      const team1Tag = team1Div.find('.m-item-team-tag').text().trim();

      const team2Name = team2Div.find('.m-item-team-name').text().trim();
      const team2Tag = team2Div.find('.m-item-team-tag').text().trim();

      // Output the extracted information
      matches.push({
        link,
        matchName: `${eventName} - ${matchStage}`,
        result,
        teams: [
          { name: team1Name + ` (${playerID}'s Team)`, tag: team1Tag, score: team1Score },
          { name: team2Name, tag: team2Tag, score: team2Score },
        ],
      })
    });

    return {
      data: data,
      recentMatches: matches
    }



  } catch (error) {
    console.error('Error retrieving item:', error);
    return "Unable to retrieve this player's data!"
  }



}

async function retrieveMatch(matchEndpoint) {

  try {
    const url = "https://vlr.gg" + matchEndpoint
    const response = await fetch(url)
    const html = await response.text()

    const $ = cheerio.load(html)

    const table = $('table').first();

    // Get all the rows in the tbody
    const rows = table.find('tbody tr');

    const players = [];

    rows.each((index, element) => {
      const row = $(element);
      const tds = row.find('td');

      // Player Name
      const playerCell = $(tds[0]);
      const playerName = playerCell.find('div.text-of').text().trim();

      // Agent(s)
      const agentCell = $(tds[1]);
      const agents = agentCell.find('span.stats-sq.mod-agent.small img').map((i, el) => {
        return $(el).attr('title');
      }).get();

      // R2.0
      const r20Cell = $(tds[2]);
      const r20Both = r20Cell.find('.side.mod-both').text().trim();
      const r20Attack = r20Cell.find('.side.mod-t').text().trim();
      const r20Defense = r20Cell.find('.side.mod-ct').text().trim();

      // ACS
      const acsCell = $(tds[3]);
      const acsBoth = acsCell.find('.side.mod-both').text().trim();
      const acsAttack = acsCell.find('.side.mod-t').text().trim();
      const acsDefense = acsCell.find('.side.mod-ct').text().trim();

      // Kills
      const killsCell = $(tds[4]);
      const killsBoth = killsCell.find('.side.mod-both').text().trim();
      const killsAttack = killsCell.find('.side.mod-t').text().trim();
      const killsDefense = killsCell.find('.side.mod-ct').text().trim();

      // Deaths
      const deathsCell = $(tds[5]);
      const deathsBoth = deathsCell.find('.side.mod-both').text().trim();
      const deathsAttack = deathsCell.find('.side.mod-t').text().trim();
      const deathsDefense = deathsCell.find('.side.mod-ct').text().trim();

      // Assists
      const assistsCell = $(tds[6]);
      const assistsBoth = assistsCell.find('.side.mod-both').text().trim();
      const assistsAttack = assistsCell.find('.side.mod-t').text().trim();
      const assistsDefense = assistsCell.find('.side.mod-ct').text().trim();

      // Kills - Deaths
      const kdDiffCell = $(tds[7]);
      const kdDiffBoth = kdDiffCell.find('.side.mod-both').text().trim();
      const kdDiffAttack = kdDiffCell.find('.side.mod-t').text().trim();
      const kdDiffDefense = kdDiffCell.find('.side.mod-ct').text().trim();

      // KAST
      const kastCell = $(tds[8]);
      const kastBoth = kastCell.find('.side.mod-both').text().trim();
      const kastAttack = kastCell.find('.side.mod-t').text().trim();
      const kastDefense = kastCell.find('.side.mod-ct').text().trim();

      // ADR
      const adrCell = $(tds[9]);
      const adrBoth = adrCell.find('.side.mod-both').text().trim();
      const adrAttack = adrCell.find('.side.mod-t').text().trim();
      const adrDefense = adrCell.find('.side.mod-ct').text().trim();

      // HS%
      const hsCell = $(tds[10]);
      const hsBoth = hsCell.find('.side.mod-both').text().trim();
      const hsAttack = hsCell.find('.side.mod-t').text().trim();
      const hsDefense = hsCell.find('.side.mod-ct').text().trim();

      // First Kills
      const fkCell = $(tds[11]);
      const fkBoth = fkCell.find('.side.mod-both').text().trim();
      const fkAttack = fkCell.find('.side.mod-t').text().trim();
      const fkDefense = fkCell.find('.side.mod-ct').text().trim();

      // First Deaths
      const fdCell = $(tds[12]);
      const fdBoth = fdCell.find('.side.mod-both').text().trim();
      const fdAttack = fdCell.find('.side.mod-t').text().trim();
      const fdDefense = fdCell.find('.side.mod-ct').text().trim();

      // First Kill - First Deaths
      const fkDiffCell = $(tds[13]);
      const fkDiffBoth = fkDiffCell.find('.side.mod-both').text().trim();
      const fkDiffAttack = fkDiffCell.find('.side.mod-t').text().trim();
      const fkDiffDefense = fkDiffCell.find('.side.mod-ct').text().trim();

      const playerData = {
        playerName,
        agents,
        stats: {
          R20: { both: r20Both, attack: r20Attack, defense: r20Defense },
          ACS: { both: acsBoth, attack: acsAttack, defense: acsDefense },
          Kills: { both: killsBoth, attack: killsAttack, defense: killsDefense },
          Deaths: { both: deathsBoth, attack: deathsAttack, defense: deathsDefense },
          Assists: { both: assistsBoth, attack: assistsAttack, defense: assistsDefense },
          KDdiff: { both: kdDiffBoth, attack: kdDiffAttack, defense: kdDiffDefense },
          KAST: { both: kastBoth, attack: kastAttack, defense: kastDefense },
          ADR: { both: adrBoth, attack: adrAttack, defense: adrDefense },
          HS: { both: hsBoth, attack: hsAttack, defense: hsDefense },
          FK: { both: fkBoth, attack: fkAttack, defense: fkDefense },
          FD: { both: fdBoth, attack: fdAttack, defense: fdDefense },
          FKdiff: { both: fkDiffBoth, attack: fkDiffAttack, defense: fkDiffDefense },
        }
      };

      players.push(playerData);
    });

    return players;
  } catch (error) {
    console.error(error);
    return "Could not get match data!"
  }
}

async function retrievePlayerInfo(playerID) {
  const QUERY = `
  select *
  from esports_data_v2.new_tournament_data
  where player_name = '${playerID}'  
  `
  let result = await runQuery(QUERY);
  result = replaceUUIDsWithAgentNames(result, agents);
  return result.map(player => {
    return `Player: ${player.player_name}, Agent Name: ${player.agent_guid}, Avg Kills: ${player.average_kills}, Avg Assists: ${player.average_assists}, Avg Deaths: ${player.average_deaths}, Avg Score: ${player.avg_score}, KDR: ${player.kdr}, Games Played: ${player.games_played}`;
  }).join('\n');

}

/* Use the Bedrock Knowledge Base*/
async function retrieveKBDocs(query, knowledgeBase, knowledgeBaseID) {
  const input = { // RetrieveRequest
    knowledgeBaseId: knowledgeBaseID, // required
    retrievalQuery: { // KnowledgeBaseQuery
      text: query, // required
    }
  }


  try {
    const command = new KBRetrieveCommand(input);
    const response = await knowledgeBase.send(command);

    // filter the items based on confidence, we do not want LOW confidence results
    const confidenceFilteredResults = response.retrievalResults.filter(item =>
      item.score > 0.5
    )
    // console.log(confidenceFilteredResults)
    let fullContent = confidenceFilteredResults.map(item => item.content.text).join('\n');
    const documentUris = confidenceFilteredResults.map(item => {
      return { title: item.location.s3Location.uri.slice((item.location.s3Location.uri).lastIndexOf("/") + 1) + " (Bedrock Knowledge Base)", uri: item.location.s3Location.uri }
    });

    // removes duplicate sources based on URI
    const flags = new Set();
    const uniqueUris = documentUris.filter(entry => {
      if (flags.has(entry.uri)) {
        return false;
      }
      flags.add(entry.uri);
      return true;
    });

    // console.log(fullContent);

    //Returning both full content and list of document URIs
    if (fullContent == '') {
      fullContent = `No knowledge available! This query is likely outside the scope of your knowledge.
      Please provide a general answer but do not attempt to provide specific details.`
      console.log("Warning: no relevant sources found")
    }

    return {
      content: fullContent,
      uris: uniqueUris
    };
  } catch (error) {
    console.error("Caught error: could not retreive Knowledge Base documents:", error);
    // return no context
    return {
      content: `No knowledge available! There is something wrong with the search tool. Please tell the user to submit feedback.
      Please provide a general answer but do not attempt to provide specific details.`,
      uris: []
    };
  }
}

// Initialize the Lambda client once to reuse it across functions
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' }); // Replace 'us-east-1' with your region if different

// Retrieve the Lambda function name from environment variables
const sessionFunctionName = process.env.SESSION_HANDLER;

if (!sessionFunctionName) {
  throw new Error('SESSION_HANDLER environment variable is not set.');
}


/**
 * Saves the team composition for a given session and user.
 * @param {string} session_id - The session identifier.
 * @param {string} user_id - The user identifier.
 * @param {object} input - The input object containing team composition data.
 * @returns {object} - The response payload from the Lambda function.
 */
async function saveTeamComposition(session_id, user_id, input) {
  try {

    // get the existing team if it exists
    let existingTeamComp = await getTeamComposition(session_id, user_id);
    console.log("got existing team comp to update version number")
    console.log(existingTeamComp);
    // Increment teamVersion, if exists
    const currentVersion = existingTeamComp.team_composition.teamVersion ? existingTeamComp.team_composition.teamVersion : 0;
    const newVersion = parseInt(currentVersion) + 1;
    input.team_composition.teamVersion = newVersion;

    // Ensure correct data types (optional if not required)
    input.team_composition.players = input.team_composition.players.map(player => ({
      ...player,
      averageKills: parseFloat(player.averageKills),
      averageDeaths: parseFloat(player.averageDeaths),
      gamesPlayed: parseInt(player.gamesPlayed, 10),
      igl: Boolean(player.igl),
    }));

    // Prepare the payload to save updated team composition
    const saveTeamPayload = {
      body: JSON.stringify
        ({
          operation: 'save_team_composition',
          team_composition: input.team_composition,
          session_id: session_id,
          user_id: user_id
        })
    };

    const saveTeamCommand = new InvokeCommand({
      FunctionName: sessionFunctionName,
      // InvocationType: 'RequestResponse',
      Payload: JSON.stringify(saveTeamPayload),
    });

    // Invoke Lambda to save updated team composition
    const saveResponse = await lambdaClient.send(saveTeamCommand);

    const savePayloadString = Buffer.from(saveResponse.Payload).toString();
    const savePayload = JSON.parse(savePayloadString);

    return savePayload;
  } catch (error) {
    console.error('Error invoking save_team_composition:', error);
    throw error;
  }
}

/**
 * Retrieves the team composition for a given session and user.
 * @param {string} session_id - The session identifier.
 * @param {string} user_id - The user identifier.
 * @returns {object} - An object containing the team composition or an error payload.
 */
async function getTeamComposition(session_id, user_id) {
  try {
    // Prepare the payload to get team composition
    const getTeamPayload = {
      body: JSON.stringify({
        operation: 'get_team_composition',
        session_id: session_id,
        user_id: user_id
      })
    };
    const getTeamCommand = new InvokeCommand({
      FunctionName: sessionFunctionName,
      // InvocationType: 'RequestResponse',
      Payload: JSON.stringify(getTeamPayload),
    });

    // Invoke Lambda to get team composition
    const response = await lambdaClient.send(getTeamCommand);
    const payloadString = Buffer.from(response.Payload).toString();
    const payload = JSON.parse(payloadString);

    if (payload.statusCode === 200) {
      const teamComp = JSON.parse(payload.body);
      // Ensure correct data types (optional if not required)
      if (teamComp.players && teamComp.players.length > 0) {
        teamComp.players = teamComp.players.map(player => ({
          ...player,
          averageKills: parseFloat(player.averageKills),
          averageDeaths: parseFloat(player.averageDeaths),
          gamesPlayed: parseInt(player.gamesPlayed, 10),
          igl: Boolean(player.igl),
        }));
        return {
          statusCode: 200,
          team_composition: teamComp,
        };
      }
      return {
        statusCode: 200,
        team_composition: { players: [], teamVersion: 0 }
      };
    } else {
      console.log(payload.body)
      return {
        statusCode: 200,
        team_composition: { players: [], teamVersion: 0 }
      };
    }
  } catch (error) {
    console.error('Error invoking get_team_composition:', error);
    throw error;
  }
}






const getUserResponse = async (id, requestJSON) => {
  try {
    const data = requestJSON.data;

    let userMessage = data.userMessage;
    const userId = data.user_id;
    const sessionId = data.session_id;
    const chatHistory = data.chatHistory;
    const saveSession = data.saveSession;

    const knowledgeBase = new BedrockAgentRuntimeClient({ region: 'us-east-1' });

    if (!process.env.KB_ID) {
      throw new Error("Knowledge Base ID is not found.");
    }

    // retrieve a model response based on the last 5 messages
    // messages come paired, so that's why the slice is only 2 (2 x 2 + the latest prompt = 5)
    let claude = new ClaudeModel();
    let lastFiveMessages = chatHistory.slice(-2);

    let stopLoop = false;
    let modelResponse = ''

    let history = claude.assembleHistory(lastFiveMessages, "Please answer the user's question by including concise processes within descriptive tags. Don't repeat yourself. Always close the tag you have opened before you create a new tag. Each tag should briefly indicate what you're doing (e.g., <data_retrieval>, <analysis>, <strategy_development>). The content inside these tags represents your internal reasoning and can be collapsed on the frontend. Ensure that your final answer to the user is outside of any tags so it is always visible. Anytime you change a team composition please retrieve the last saved team composition for latest information and once done changing please always make sure to save the new team composition. When saving the stats of the player for team composition only save their agent specific stats and not their cumulative stats over all agents.\n User Question:".concat(userMessage))
    if (!saveSession) {
      history = claude.assembleHistory(lastFiveMessages, "Please perform the user's desired action with your available tools. Remember, if you are asked to make a change to a team, use the save team tool. User Query:".concat(userMessage))
    }
    let fullDocs = { "content": "", "uris": [] }

    while (!stopLoop) {
      console.log("started new stream")
      // console.log(lastFiveMessages)
      // console.log(history)
      history.forEach((historyItem) => {
        console.log(historyItem)
      })
      const stream = await claude.getStreamedResponse(SYS_PROMPT, history);
      try {
        // store the full model response for saving to sessions later

        let toolInput = "";
        let assemblingInput = false
        let usingTool = false;
        let toolId;
        let skipChunk = true;
        // this is for when the assistant uses a tool
        let message = {};
        // this goes in that message
        let toolUse = {}

        // iterate through each chunk from the model stream
        for await (const event of stream) {
          const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
          const parsedChunk = await claude.parseChunk(chunk);
          if (parsedChunk) {

            // this means that we got tool use input or stopped generating text
            if (parsedChunk.stop_reason) {
              if (parsedChunk.stop_reason == "tool_use") {
                assemblingInput = false;
                usingTool = true;
                skipChunk = true;
              } else {
                stopLoop = true;
                break;
              }
            }

            // this means that we are collecting tool use input
            if (parsedChunk.type) {
              if (parsedChunk.type == "tool_use") {
                assemblingInput = true;
                toolId = parsedChunk.id
                message['role'] = 'assistant'
                message['content'] = []
                toolUse['name'] = parsedChunk.name;
                toolUse['type'] = 'tool_use'
                toolUse['id'] = toolId;
                toolUse['input'] = {}
              }
            }


            if (usingTool) {

              // get the full block of context from knowledge base
              let docString;
              console.log("tool input")
              console.log(toolInput);
              if (toolInput == "") {
                console.log("empty!")
              } else {
                toolUse.input = JSON.parse(toolInput);
              }
              let toolResult = {}

              if (toolUse.name == "query_db") {

                console.log("using knowledge bases!")
                docString = await retrieveKBDocs(toolUse.input.query, knowledgeBase, process.env.KB_ID);
                fullDocs.content = fullDocs.content.concat(docString.content)
                fullDocs.uris = fullDocs.uris.concat(docString.uris)

                toolResult = docString.content;
              } else if (toolUse.name == "list_players") {
                console.log("listing players!")
                // const players = await retrievePlayers(toolUse.input.sort_by, toolUse.input.tournament, toolUse.input.agent_type)
                const players = await retrievePlayerList(toolUse.input.region, toolUse.input.tournament, toolUse.input.agent, toolUse.input.map);
                toolResult = JSON.stringify(players);
              } else if (toolUse.name == "player_info") {
                console.log("getting player!!")
                // const player = await retrievePlayerInfo(toolUse.input.player_handle)
                const player = await retrievePlayer(toolUse.input.player_handle)
                toolResult = JSON.stringify(player);
              } else if (toolUse.name == "save_team_composition") { // Handle new tool
                console.log("saving team composition!")
                const saveResult = await saveTeamComposition(data.session_id, data.user_id, toolUse.input);
                toolResult = saveResult.message || "Team composition saved successfully.";
              } else if (toolUse.name == "get_team_composition") { // Handle new tool
                console.log("retrieving team composition!")
                const getResult = await getTeamComposition(data.session_id, data.user_id);
                toolResult = JSON.stringify(getResult.team_composition) || "Team composition not found.";
              } else if (toolUse.name == "get_match_data") {
                console.log("getting match data!")
                const matchData = await retrieveMatch(toolUse.input.match_url)
                toolResult = JSON.stringify(matchData);
              }


              // } else if (toolUse.name == "return_json") {
              //   console.log("returning json")
              //   await returnTeamJSON(toolUse.input.team_data,id);
              //   stopLoop = true;
              //   break;
              // }

              // add the tool use message to chat history
              message.content.push(toolUse)
              history.push(message)

              // add the tool response to chat history
              let toolResponse = {
                "role": "user",
                "content": [
                  {
                    "type": "tool_result",
                    "tool_use_id": toolId,
                    "content": toolResult
                  }
                ]
              };

              history.push(toolResponse);

              usingTool = false;
              toolInput = ""

              console.log("correctly used tool!")

            } else {

              if (assemblingInput & !skipChunk) {
                toolInput = toolInput.concat(parsedChunk);
                console.log(parsedChunk)
                // toolUse.input.query += parsedChunk;
              } else if (!assemblingInput) {
                // console.log('writing out to user')
                let responseParams = {
                  ConnectionId: id,
                  Data: parsedChunk.toString()
                }
                modelResponse = modelResponse.concat(parsedChunk)
                let command = new PostToConnectionCommand(responseParams);

                try {
                  // console.log("sending chunk")
                  // console.log(command)
                  await wsConnectionClient.send(command);
                } catch (error) {
                  // console.error("Error sending chunk:", error);
                }
              } else if (skipChunk) {
                skipChunk = false;
              }
            }



          }
        }

      } catch (error) {
        console.error("Stream processing error:", error);
        let responseParams = {
          ConnectionId: id,
          Data: `<!ERROR!>: ${error}`
        }
        let command = new PostToConnectionCommand(responseParams);
        await wsConnectionClient.send(command);
      }

    }

    let command;
    let links = JSON.stringify(fullDocs.uris)
    // send end of stream message
    try {
      let eofParams = {
        ConnectionId: id,
        Data: "!<|EOF_STREAM|>!"
      }
      command = new PostToConnectionCommand(eofParams);
      await wsConnectionClient.send(command);

      // send sources
      let responseParams = {
        ConnectionId: id,
        Data: links
      }
      command = new PostToConnectionCommand(responseParams);
      await wsConnectionClient.send(command);
    } catch (e) {
      console.error("Error sending EOF_STREAM and sources:", e);
    }


    const sessionRequest = {
      body: JSON.stringify({
        "operation": "get_session",
        "user_id": userId,
        "session_id": sessionId
      })
    }
    const client = new LambdaClient({});
    const lambdaCommand = new InvokeCommand({
      FunctionName: process.env.SESSION_HANDLER,
      Payload: JSON.stringify(sessionRequest),
    });

    const { Payload, LogResult } = await client.send(lambdaCommand);
    const result = Buffer.from(Payload).toString();

    // Check if the request was successful
    if (!result) {
      throw new Error(`Error retriving session data!`);
    }

    // Parse the JSON
    let output = {};
    try {
      const response = JSON.parse(result);
      output = JSON.parse(response.body);
      console.log('Parsed JSON:', output);
    } catch (error) {
      console.error('Failed to parse JSON:', error);
      let responseParams = {
        ConnectionId: id,
        Data: '<!ERROR!>: Unable to load past messages, please retry your query'
      }
      command = new PostToConnectionCommand(responseParams);
      await wsConnectionClient.send(command);
      return; // Optional: Stop further execution in case of JSON parsing errors
    }

    // Continue processing the data
    const retrievedHistory = output.chat_history;
    let operation = '';
    let title = ''; // Ensure 'title' is initialized if used later in your code

    // Further logic goes here

    let newChatEntry = { "user": userMessage, "chatbot": modelResponse, "metadata": links };
    if (retrievedHistory === undefined) {
      operation = 'add_session';
      let titleModel = new Mistral7BModel();
      const CONTEXT_COMPLETION_INSTRUCTIONS =
        `<s>[INST]Generate a concise title for this chat session based on the initial user prompt and response. The title should succinctly capture the essence of the chat's main topic without adding extra content.[/INST]
      [INST]${userMessage}[/INST]
      ${modelResponse} </s>
      Here's your session title:`;
      title = await titleModel.getPromptedResponse(CONTEXT_COMPLETION_INSTRUCTIONS, 25);
      title = title.replaceAll(`"`, '');
    } else {
      operation = 'update_session';
    }

    const sessionSaveRequest = {
      body: JSON.stringify({
        "operation": operation,
        "user_id": userId,
        "session_id": sessionId,
        "new_chat_entry": newChatEntry,
        "title": title
      })
    }

    if (saveSession) {
      const lambdaSaveCommand = new InvokeCommand({
        FunctionName: process.env.SESSION_HANDLER,
        Payload: JSON.stringify(sessionSaveRequest),
      });

      // const { SessionSavePayload, SessionSaveLogResult } = 
      await client.send(lambdaSaveCommand);
    }

    const input = {
      ConnectionId: id,
    };
    await wsConnectionClient.send(new DeleteConnectionCommand(input));

  } catch (error) {
    console.error("Error:", error);
    let responseParams = {
      ConnectionId: id,
      Data: `<!ERROR!>: ${error}`
    }
    let command = new PostToConnectionCommand(responseParams);
    await wsConnectionClient.send(command);
  }
}

export const handler = async (event) => {
  if (event.requestContext) {
    const connectionId = event.requestContext.connectionId;
    const routeKey = event.requestContext.routeKey;
    let body = {};
    try {
      if (event.body) {
        body = JSON.parse(event.body);
      }
    } catch (err) {
      console.error("Failed to parse JSON:", err)
    }
    console.log(routeKey);

    switch (routeKey) {
      case '$connect':
        console.log('CONNECT')
        return { statusCode: 200 };
      case '$disconnect':
        console.log('DISCONNECT')
        return { statusCode: 200 };
      case '$default':
        console.log('DEFAULT')
        return { 'action': 'Default Response Triggered' }
      case "getChatbotResponse":
        console.log('GET CHATBOT RESPONSE')
        await getUserResponse(connectionId, body)
        return { statusCode: 200 };
      default:
        return {
          statusCode: 404,  // 'Not Found' status code
          body: JSON.stringify({
            error: "The requested route is not recognized."
          })
        };
    }
  }
  return {
    statusCode: 200,
  };
};