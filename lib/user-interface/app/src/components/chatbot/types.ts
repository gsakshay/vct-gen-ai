
export interface ChatBotConfiguration {
  streaming: boolean;
  showMetadata: boolean;
  maxTokens: number;
  temperature: number;
  topP: number;
}

export interface ChatInputState {
  value: string;
}

export enum ChatBotMessageType {
  AI = "ai",
  Human = "human",
}

export interface ChatBotHistoryItem {
  type: ChatBotMessageType;
  content: string;
  metadata: Record<
    string,
    | string
    | boolean
    | number
    | null
    | undefined
    | string[]
    | string[][]
  >;
}

export interface FeedbackData {
  sessionId: string;
  feedback: number;
  prompt: string;
  completion: string;
  topic: string,
  problem: string,
  comment: string,
  sources: string
}

export interface TeamPlayer {
  name: string,
  averageKills: number,
  averageDeaths: number,
  gamesPlayed: number,
  agent: string,
  role: string,
  igl: boolean
}

export interface TeamComposition {
  players: TeamPlayer[],
  teamVersion: number,
  errors: string[]
}

// Sample API response type
export interface Map
{
    name: string | unknown;
    rank: number;  // Rank of the map
}

export interface MapComposition
{
  maps: Map[],
  errors: string[]
}