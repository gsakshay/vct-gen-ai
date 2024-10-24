import { useContext, useEffect, useState } from "react";
import {
  ChatBotHistoryItem,
  ChatBotMessageType,
  FeedbackData,
  TeamPlayer,
  TeamComposition,
} from "./types";
import { Auth } from "aws-amplify";
import {
  SpaceBetween,
  StatusIndicator,
  Button,
  Grid,
} from "@cloudscape-design/components";
import { v4 as uuidv4 } from "uuid";
import { AppContext } from "../../common/app-context";
import { ApiClient } from "../../common/api-client/api-client";
import ChatMessage from "./chat-message";
import ChatInputPanel, { ChatScrollState } from "./chat-input-panel";
import styles from "../../styles/chat.module.scss";
import { CHATBOT_NAME } from "../../common/constants";
import { useNotifications } from "../notif-manager";
import ValorantAgentCard from "./ValorantAgentCard";
import valorantAgentsMap from "./utils";
import { Utils } from "../../common/utils";

export default function Chat(props: { sessionId?: string }) {
  const appContext = useContext(AppContext);
  const [running, setRunning] = useState<boolean>(true);
  const [session, setSession] = useState<{ id: string; loading: boolean }>({
    id: props.sessionId ?? uuidv4(),
    loading: typeof props.sessionId !== "undefined",
  });

  const { notifications, addNotification } = useNotifications();
  const [messageHistory, setMessageHistory] = useState<ChatBotHistoryItem[]>([]);
  const [teamComposition, setTeamComposition] = useState<TeamComposition>({
    players: [],
    teamVersion: 0,
    errors: [],
  });

  /** Loads session history */
  useEffect(() => {
    if (!appContext) return;
    setMessageHistory([]);

    (async () => {
      if (!props.sessionId) {
        setSession({ id: uuidv4(), loading: false });
        return;
      }

      setSession({ id: props.sessionId, loading: true });
      const apiClient = new ApiClient(appContext);
      try {
        let username;
        await Auth.currentAuthenticatedUser().then(
          (value) => (username = value.username)
        );
        if (!username) return;

        const hist = await apiClient.sessions.getSession(
          props.sessionId,
          username
        );
        const teamComp = await apiClient.sessions.getTeamComposition(
          props.sessionId,
          username
        );

        if (teamComp.players.length > 0) {
          setTeamComposition(teamComp);
        } else {
          setTeamComposition({
            ...teamComposition,
            players: [],
          });
        }

        if (hist) {
          ChatScrollState.skipNextHistoryUpdate = true;
          ChatScrollState.skipNextScrollEvent = true;

          setMessageHistory(
            hist
              .filter((x) => x !== null)
              .map((x) => ({
                type: x!.type as ChatBotMessageType,
                metadata: x!.metadata!,
                content: x!.content,
              }))
          );

          window.scrollTo({
            top: 0,
            behavior: "instant",
          });
        }
        setSession({ id: props.sessionId, loading: false });
        setRunning(false);
      } catch (error) {
        console.log(error);
        addNotification("error", error.message);
        addNotification("info", "Please refresh the page");
      }
    })();
  }, [appContext, props.sessionId]);

    /** Adds some metadata to the user's feedback */
    const handleFeedback = ( feedbackType: 1 | 0, idx: number, message: ChatBotHistoryItem, feedbackTopic?: string, feedbackProblem?: string, feedbackMessage?: string ) =>
      {
        if ( props.sessionId )
        {
          console.log( "submitting feedback..." )
    
          const prompt = messageHistory[idx - 1].content
          const completion = message.content;
    
          const feedbackData = {
            sessionId: props.sessionId,
            feedback: feedbackType,
            prompt: prompt,
            completion: completion,
            topic: feedbackTopic,
            problem: feedbackProblem,
            comment: feedbackMessage,
            sources: JSON.stringify( message.metadata.Sources )
          };
          addUserFeedback( feedbackData );
        }
      };
    
      /** Makes the API call via the ApiClient to submit the feedback */
      const addUserFeedback = async ( feedbackData: FeedbackData ) =>
      {
        if ( !appContext ) return;
        const apiClient = new ApiClient( appContext );
        await apiClient.userFeedback.sendUserFeedback( feedbackData );
      }

  const handleSendMessage = async (messageToSend: string) => {
    if (running) return;
    if (appContext?.wsEndpoint) {
      let username;
      await Auth.currentAuthenticatedUser().then(
        (value) => (username = value.username)
      );
      if (!username) return;

      if (messageToSend.trim().length === 0) {
        addNotification("error", "Please do not submit blank text!");
        return;
      }

      try {
        setRunning(true);
        let receivedData = "";
        
        const TEST_URL = appContext.wsEndpoint + "/";
        const TOKEN = await Utils.authenticate();
        const wsUrl = TEST_URL + "?Authorization=" + TOKEN;
        const ws = new WebSocket(wsUrl);

        let incomingMetadata: boolean = false;
        let sources = {};

        ws.addEventListener("open", function open() {
          const message = JSON.stringify({
            action: "getChatbotResponse",
            data: {
              userMessage: messageToSend,
              chatHistory: [],              
              user_id: username,
              session_id: session.id,  
              saveSession: false            
            },
          });
          ws.send(message);
        });

        ws.addEventListener("message", function incoming(data) {
          if (data.data.includes("<!ERROR!>:")) {
            addNotification("error", data.data);
            ws.close();
            return;
          }

          if (data.data === "!<|EOF_STREAM|>!") {
            incomingMetadata = true;
            return;
          }

          if (!incomingMetadata) {
            receivedData += data.data;
          } else {
            const sourceData = JSON.parse(data.data);
            sources = { Sources: sourceData };
          }
          
        });

        ws.addEventListener("error", (err) => {
          console.error("WebSocket error:", err);
        });

        ws.addEventListener("close", async () => {
          await refreshTeam();
          setRunning(false);
        });
      } catch (error) {
        console.error("Error sending message:", error);
        alert("Something went wrong. Please try again.");
        setRunning(false);
      }
    }
  };

  const handleAgentOptionSelect = (agent, option) => {
    if (option === "in-place-replace") {
      handleSendMessage(`Replace this ${agent.playerName} with another ${agent.agentName}`);
    } else if (option === "initiator") {
      handleSendMessage(`Replace ${agent.playerName} with an Initiator`);
    }else if (option === "duelist") {
      handleSendMessage(`Replace ${agent.playerName} with an Duelist`);
    }else if (option === "controller") {
      handleSendMessage(`Replace ${agent.playerName} with an Controller`);
    }else if (option === "sentinel") {
      handleSendMessage(`Replace ${agent.playerName} with a Sentinel`);
    }
  };

  const refreshTeam = async () => {
    let username: string;
    await Auth.currentAuthenticatedUser().then((value) => (username = value.username));
    if (!username) return;
    if (!appContext) return;
    const apiClient = new ApiClient(appContext);
    const teamComp = await apiClient.sessions.getTeamComposition(
      props.sessionId,
      username
    );
    if (teamComp.players.length > 0) {
      setTeamComposition(teamComp);
    }
  };

  return (
    <div className={styles.chat_container}>
      <Grid gridDefinition={[{ colspan: 9 }, { colspan: 3 }]}>
        <div>
          <div className="ChatHistoryDiv">
            <SpaceBetween direction="vertical" size="m">
              {messageHistory.map((message, idx) => {
                return (
                  <ChatMessage
                    key={idx}
                    message={message}
                    onThumbsUp={() => handleFeedback(1, idx, message)}
                    onThumbsDown={(feedbackTopic, feedbackType, feedbackMessage) =>
                      handleFeedback(0, idx, message, feedbackTopic, feedbackType, feedbackMessage)
                    }
                  />
                );
              })}
            </SpaceBetween>
            <div className={styles.welcome_text}>
              {messageHistory.length === 0 && !session?.loading && (
                <center>{CHATBOT_NAME}</center>
              )}
              {session?.loading && (
                <center>
                  <StatusIndicator type="loading">
                    Loading session
                  </StatusIndicator>
                </center>
              )}
            </div>
            <ChatInputPanel
              session={session}
              running={running}
              setRunning={setRunning}
              messageHistory={messageHistory}
              setMessageHistory={(history) => setMessageHistory(history)}
              refreshTeam={refreshTeam}
            />
          </div>
        </div>
        <div className="TeamDisplayDiv">
          <h2>Team Formation</h2>
          {teamComposition?.players?.length
            ? teamComposition.players
                .sort((a, b) => (b.igl ? 1 : 0) - (a.igl ? 1 : 0))
                .map((player) => (
                  <div className="child" key={player.name}>
                    <ValorantAgentCard
                      agentDetails={{
                        image: valorantAgentsMap[
                          player.agent.toLowerCase().replace(/[^a-z0-9]/g, "")
                        ]?.image,
                        isIGL: player?.igl,
                        agentName: player?.agent,
                        role: player?.role,
                        playerName: player?.name,
                        averageKills: player?.averageKills,
                        averageDeaths: player?.averageDeaths,
                        gamesPlayed: player?.gamesPlayed,
                      }}
                      onOptionSelect={(agent, option) =>
                        handleAgentOptionSelect(agent, option)
                      }
                    />
                  </div>
                ))
            : null}
        </div>
      </Grid>
    </div>
  );
}
