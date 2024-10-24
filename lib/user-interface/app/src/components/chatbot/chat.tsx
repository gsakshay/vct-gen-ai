import { useContext, useEffect, useState } from "react";
import
{
  ChatBotHistoryItem,
  ChatBotMessageType,
  FeedbackData,
  TeamPlayer,
  TeamComposition
} from "./types";
import { Auth } from "aws-amplify";
import { SpaceBetween, StatusIndicator, Alert, Flashbar, Grid, Button } from "@cloudscape-design/components";
import { v4 as uuidv4 } from "uuid";
import { AppContext } from "../../common/app-context";
import { ApiClient } from "../../common/api-client/api-client";
import ChatMessage from "./chat-message";
import ChatInputPanel, { ChatScrollState } from "./chat-input-panel";
import styles from "../../styles/chat.module.scss";
import { CHATBOT_NAME } from "../../common/constants";
import { useNotifications } from "../notif-manager";
import ValorantAgentCards from "./ValorantAgentCard";
import { Grid2 } from "@mui/material";
import valorantAgentsMap from "./utils";

export default function Chat( props: { sessionId?: string } )
{
  const appContext = useContext( AppContext );
  const [running, setRunning] = useState<boolean>( true );
  const [session, setSession] = useState<{ id: string; loading: boolean }>( {
    id: props.sessionId ?? uuidv4(),
    loading: typeof props.sessionId !== "undefined",
  } );

  const { notifications, addNotification } = useNotifications();

  const [messageHistory, setMessageHistory] = useState<ChatBotHistoryItem[]>(
    []
  );

  const [teamComposition, setTeamComposition] = useState<TeamComposition>(
    {
      players: [],
      teamVersion: 0,
      errors: []
    }
  );


  /** Loads session history */
  useEffect( () =>
  {
    if ( !appContext ) return;
    setMessageHistory( [] );

    ( async () =>
    {
      /** If there is no session ID, then this must be a new session
       * and there is no need to load one from the backend.
       * However, even if a session ID is set and there is no saved session in the 
       * backend, there will be no errors - the API will simply return a blank session
       */
      setTeamComposition( {
        ...teamComposition,
        players: [],
      } )
      if ( !props.sessionId )
      {
        setSession( { id: uuidv4(), loading: false } );
        return;
      }

      setSession( { id: props.sessionId, loading: true } );
      const apiClient = new ApiClient( appContext );
      try
      {
        // const result = await apiClient.sessions.getSession(props.sessionId);
        let username;
        await Auth.currentAuthenticatedUser().then( ( value ) => username = value.username );
        if ( !username ) return;
        const hist = await apiClient.sessions.getSession( props.sessionId, username );
        const teamComp = await apiClient.sessions.getTeamComposition( props.sessionId, username );
        if ( teamComp.players.length > 0 )
        {
          setTeamComposition( teamComp );
        } else
        {
          setTeamComposition( {
            ...teamComposition,
            players: [],
          } )
        }
        if ( hist )
        {

          ChatScrollState.skipNextHistoryUpdate = true;
          ChatScrollState.skipNextScrollEvent = true;

          setMessageHistory(
            hist
              .filter( ( x ) => x !== null )
              .map( ( x ) => ( {
                type: x!.type as ChatBotMessageType,
                metadata: x!.metadata!,
                content: x!.content,
              } ) )
          );

          window.scrollTo( {
            top: 0,
            behavior: "instant",
          } );
        }
        setSession( { id: props.sessionId, loading: false } );
        setRunning( false );
      } catch ( error )
      {
        console.log( error );
        addNotification( "error", error.message )
        addNotification( "info", "Please refresh the page" )
      }
    } )();
  }, [appContext, props.sessionId] );

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

  /** Refreshes the team via the ApiClient */
  const refreshTeam = async () =>
  {
    let username: string;
    await Auth.currentAuthenticatedUser().then( ( value ) => username = value.username );
    if ( !username ) return;
    if ( !appContext ) return;
    const apiClient = new ApiClient( appContext );
    const teamComp = await apiClient.sessions.getTeamComposition( props.sessionId, username );
    console.log( "Team comp", teamComp );
    if ( teamComp.players.length > 0 )
    {
      setTeamComposition( teamComp );
    }
  }


  return (
    <div className={styles.chat_container}>
      <Grid gridDefinition={[{ colspan: 9 }, { colspan: 3 }]}>
        <div>
          <div className="ChatHistoryDiv">
            <SpaceBetween direction="vertical" size="m">
              {messageHistory.map( ( message, idx ) =>
              {
                return <ChatMessage
                  key={idx}
                  message={message}
                  onThumbsUp={() => handleFeedback( 1, idx, message )}
                  onThumbsDown={( feedbackTopic: string, feedbackType: string, feedbackMessage: string ) => handleFeedback( 0, idx, message, feedbackTopic, feedbackType, feedbackMessage )}
                />
              } )}
            </SpaceBetween>
            <div className={styles.welcome_text}>
              {messageHistory.length == 0 && !session?.loading && (
                <center>{CHATBOT_NAME}</center>
              )}
              {session?.loading && (
                <center>
                  <StatusIndicator type="loading">Loading session</StatusIndicator>
                </center>
              )}
            </div>
            <ChatInputPanel
              session={session}
              running={running}
              setRunning={setRunning}
              messageHistory={messageHistory}
              setMessageHistory={( history ) => setMessageHistory( history )}
              refreshTeam={() => refreshTeam()}
            />
          </div>
        </div>
        <div className="TeamDisplayDiv">
          <h2>Team Formation</h2>
          {
            teamComposition?.players?.length ?
              teamComposition.players
                .slice() // Create a shallow copy to avoid mutating original array
                .sort( ( a, b ) => ( b.igl === true ? 1 : 0 ) - ( a.igl === true ? 1 : 0 ) ) // Sort to put igl: true players first
                .map( player => (
                  <div className="child" key={player.name}>
                    <ValorantAgentCards
                      agentDetails={{
                        image: valorantAgentsMap[player.agent.toLowerCase().replace( /[^a-z0-9]/g, '' )]?.image,
                        isIGL: player?.igl,
                        agentName: player?.agent,
                        role: player?.role,
                        playerName: player?.name,
                        averageKills: player?.averageKills,
                        averageDeaths: player?.averageDeaths,
                        gamesPlayed: player?.gamesPlayed
                      }}
                    />
                  </div>
                ) )
              : <></>
          }
        </div>
      </Grid>
    </div>
  );
}
