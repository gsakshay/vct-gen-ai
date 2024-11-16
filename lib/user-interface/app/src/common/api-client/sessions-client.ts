import {
  ChatBotHistoryItem,
  ChatBotMessageType,
  MapComposition,
  TeamComposition
} from "../../components/chatbot/types";

import {
  Utils
} from "../utils"


import { AppConfig } from "../types";

export class SessionsClient {

  private readonly API;
  constructor(protected _appConfig: AppConfig) {
    this.API = _appConfig.httpEndpoint.slice(0, -1);
  }
  // Gets all sessions tied to a given user ID
  // Return format: [{"session_id" : "string", "user_id" : "string", "time_stamp" : "dd/mm/yy", "title" : "string"}...]
  async getSessions(
    userId: string,
    all?: boolean
  ) {
    const auth = await Utils.authenticate();
    let validData = false;
    let output = [];
    let runs = 0;
    let limit = 3;
    let errorMessage = "Could not load sessions"
    while (!validData && runs < limit) {
      runs += 1;
      const response = await fetch(this.API + '/user-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + auth,
        },
        body: JSON.stringify(all ? { "operation": "list_all_sessions_by_user_id", "user_id": userId } : { "operation": "list_sessions_by_user_id", "user_id": userId })
      });
      if (response.status != 200) {
        validData = false;
        let jsonResponse = await response.json()
        errorMessage = jsonResponse;
        break;
      }
      try {
        output = await response.json();
        validData = true;
      } catch (e) {
        // just retry, we get 3 attempts!
        console.log(e);
      }
    }
    if (!validData) {
      throw new Error(errorMessage);
    }
    // console.log(output);
    return output;
  }

  // Returns a chat history given a specific user ID and session ID
  // Return format: ChatBotHistoryItem[]
  async getSession(
    sessionId: string,
    userId: string,
  ): Promise<ChatBotHistoryItem[]> {
    const auth = await Utils.authenticate();
    let validData = false;
    let output;
    let runs = 0;
    let limit = 3;
    let errorMessage = "Could not load session";

    /** Attempt to load a session up to 3 times or until it is validated */
    while (!validData && runs < limit) {
      runs += 1;
      const response = await fetch(this.API + '/user-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + auth,
        },
        body: JSON.stringify({
          "operation": "get_session", "session_id": sessionId,
          "user_id": userId
        })
      });
      /** Check for errors */
      if (response.status != 200) {
        validData = false;
        errorMessage = await response.json()
        break;
      }
      const reader = response.body.getReader();
      let received = new Uint8Array(0);

      /** Read the response stream */
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          let temp = new Uint8Array(received.length + value.length);
          temp.set(received);
          temp.set(value, received.length);
          received = temp;
        }
      }
      // Decode the complete data
      const decoder = new TextDecoder('utf-8');
      const decoded = decoder.decode(received);
      try {
        output = JSON.parse(decoded).chat_history! as any[];
        validData = true;
      } catch (e) {
        console.log(e);
      }
    }
    if (!validData) {
      throw new Error(errorMessage)
    }
    let history: ChatBotHistoryItem[] = [];
    // console.log(output);
    if (output === undefined) {
      return history;
    }
    output.forEach(function (value) {
      let metadata = {}
      if (value.metadata) {
        metadata = { "Sources": JSON.parse(value.metadata) }
      }
      history.push({
        type: ChatBotMessageType.Human,
        content: value.user,
        metadata: {
        },
      },
        {
          type: ChatBotMessageType.AI,
          content: value.chatbot,
          metadata: metadata,
        },)
    })
    return history;
  }

  /** Gets team composition for a given session ID and user ID */
  async getTeamComposition(sessionId: string,
    userId: string): Promise<TeamComposition> {
    let teamComp : TeamComposition = {
      players : [],
      teamVersion : 0,
      errors: []
    }
    const auth = await Utils.authenticate();
    
    const response = await fetch(this.API + '/user-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + auth,
      },
      body: JSON.stringify({
        "operation": "get_team_composition", "session_id": sessionId,
        "user_id": userId
      })
    });
    if (response.status != 200) {                  
      teamComp.errors.push(`Status Code: ${response.status}`)      
    }
    try {
      const output = await response.json();
      console.log("Main outoput", output);
      const players = output.players
      teamComp.players = players.map((player: any) => ({
        name : player.name,
        agent : player.agent,
        averageKills: player.averageKills,
        averageDeaths: player.averageDeaths,
        gamesPlayed: player.gamesPlayed,
        role : player.role,        
        igl: Boolean(player.igl),
      }));
      teamComp.teamVersion = output.teamVersion;
    } catch (e) {      
      console.log(e);
    }     
    console.log("got team comp")
    console.log(teamComp) 
    return teamComp;
  }

  async getMapComposition(sessionId: string, userId: string): Promise<any> {
  let mapComp: MapComposition = {
    maps: [],
    errors: []
  };

  const auth = await Utils.authenticate();

  const response = await fetch(this.API + '/user-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + auth,
    },
    body: JSON.stringify({
      "operation": "get_map",
      "session_id": sessionId,
      "user_id": userId
    })
  });

  if (response.status !== 200) {
    mapComp.errors.push(`Status Code: ${response.status}`);
  }

  try {
    // Parse the JSON response
    const output = await response.json();
    console.log("Main output", output);

    // Transform the output into the desired format
    mapComp.maps = Object.entries(output).map(([rank, name]) => ({
      rank: parseInt(rank, 10), // Convert rank string to number
      name,
    }));
  } catch (e) {
    console.log(e);
    mapComp.errors.push("Failed to parse response JSON.");
  }

  console.log("got MAPS composition");
  console.log(mapComp);
  return mapComp;
}

  /**Deletes a given session but this is not exposed in the UI */
  async deleteSession(
    sessionId: string,
    userId: string,
  ) {
    try {
      const auth = await Utils.authenticate();
      const response = await fetch(this.API + '/user-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + auth,
        },
        body: JSON.stringify({
          "operation": "delete_session", "session_id": sessionId,
          "user_id": userId
        })
      });
    } catch {
      return "FAILED";
    }
    return "DONE";
  }
}
