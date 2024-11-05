import { useContext, useEffect, useRef, useState } from "react";
import
{
  ChatBotHistoryItem,
  ChatBotMessageType,
  FeedbackData,
  TeamComposition,
  MapComposition,
} from "./types";
import { Auth } from "aws-amplify";
import
{
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
import ValorantMapCard from "./ValorantMapCard";
import { valorantAgentsMap, valorantMapsMap } from "./utils";
import { Utils } from "../../common/utils";
import { Grid2 } from "@mui/material";

export default function Chat( props: { sessionId?: string } )
{
  const appContext = useContext( AppContext );
  const [running, setRunning] = useState<boolean>( true );
  const [session, setSession] = useState<{ id: string; loading: boolean }>( {
    id: props.sessionId ?? uuidv4(),
    loading: typeof props.sessionId !== "undefined",
  } );

  const [loadAdditionalPrompts, setLoadAdditionalPrompts] = useState<boolean>( false );

  const initialPrompts = [
    "<bold> Build a team </bold> using only players from <bold> VCT International </bold> Assign roles to each player and explain why this composition would be effective in a competitive match.",
    "<bold>Build a team </bold> using only players from <bold> VCT Challengers </bold> Assign roles to each player and explain why this composition would be effective in a competitive match.",
    "<bold> Build a team </bold> using only players from <bold> VCT Game Changers </bold> Assign roles to each player and explain why this composition would be effective in a competitive match.",
    "<bold> Build a team </bold> that includes at least <bold> two players from an underrepresented group </bold> such as the <bold> Game Changers program </bold> Define roles and discuss the advantages of this inclusive team structure.",
    "<bold> Build a team </bold> with players from at least <bold> three different regions </bold> Assign each player a role and explain the benefits of this diverse composition.",
    "<bold> Build a team </bold> that includes at least <bold> two semi - professional players </bold> such as from <bold> VCT Challengers </bold> or <bold> VCT Game Changers </bold> Define roles and discuss details of how these players were chosen.",
  ]
  const initialAdditionalPrompts =
    [
      "⁠What recent <bold> performances or statistics </bold> justify the inclusion of <bold> TenZ </bold> in the team?",
      "⁠If ZEKKEN were unavailable,<bold> who would be a suitable replacement </bold> and why?",
      "⁠How effective is Aspas in <bold> initiating fights and securing entry kills? </bold>",
    ]

  const [examplePrompts, setExamplePrompts] = useState<string[]>( initialPrompts.map( ( prompt ) =>
    prompt.replace( /<bold>/g, "<b>" ).replace( /<\/bold>/g, "</b>" )
  ) )
  const [additionalExamplePrompts, setAdditionalExamplePrompts] = useState<string[]>(
    initialAdditionalPrompts.map( ( prompt ) =>
      prompt.replace( /<bold>/g, "<b>" ).replace( /<\/bold>/g, "</b>" )
    )
  )
  const [selectedExamplePrompt, setSelectedExamplePrompt] = useState<string>( "" );

  const { notifications, addNotification } = useNotifications();
  const [messageHistory, setMessageHistory] = useState<ChatBotHistoryItem[]>( [] );
  const [teamComposition, setTeamComposition] = useState<TeamComposition>( {
    players: [],
    teamVersion: 0,
    errors: [],
  } );
  const [mapComposition, setMapComposition] = useState<MapComposition>( {
    maps: [],
    errors: [],
  } );

  /** Loads session history */
  useEffect( () =>
  {
    if ( !appContext ) return;
    setMessageHistory( [] );
    setSelectedExamplePrompt( "" );

    ( async () =>
    {
      if ( !props.sessionId )
      {
        setSession( { id: uuidv4(), loading: false } );
        return;
      }

      setSession( { id: props.sessionId, loading: true } );
      const apiClient = new ApiClient( appContext );
      try
      {
        let username;
        await Auth.currentAuthenticatedUser().then(
          ( value ) => ( username = value.username )
        );
        if ( !username ) return;

        const hist = await apiClient.sessions.getSession(
          props.sessionId,
          username
        );
        const teamComp = await apiClient.sessions.getTeamComposition(
          props.sessionId,
          username
        );
        const mapComp = await apiClient.sessions.getMapComposition(
          props.sessionId,
          username
        );

        if ( mapComp.maps.length > 0 )
        {
          setMapComposition( mapComp );
        } else
        {
          setMapComposition( {
            ...mapComposition,
            maps: [],
          } );
        }

        if ( teamComp.players.length > 0 )
        {
          setTeamComposition( teamComp );
        } else
        {
          setTeamComposition( {
            ...teamComposition,
            players: [],
          } );
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
        addNotification( "error", error.message );
        addNotification( "info", "Please refresh the page" );
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

  // const handleSendMessage = async ( messageToSend: string ) =>
  // {
  //   if ( running ) return;
  //   if ( appContext?.wsEndpoint )
  //   {
  //     let username;
  //     await Auth.currentAuthenticatedUser().then(
  //       ( value ) => ( username = value.username )
  //     );
  //     if ( !username ) return;

  //     if ( messageToSend.trim().length === 0 )
  //     {
  //       addNotification( "error", "Please do not submit blank text!" );
  //       return;
  //     }

  //     try
  //     {
  //       setRunning( true );
  //       let receivedData = "";

  //       const TEST_URL = appContext.wsEndpoint + "/";
  //       const TOKEN = await Utils.authenticate();
  //       const wsUrl = TEST_URL + "?Authorization=" + TOKEN;
  //       const ws = new WebSocket( wsUrl );

  //       let incomingMetadata: boolean = false;
  //       let sources = {};

  //       ws.addEventListener( "open", function open()
  //       {
  //         const message = JSON.stringify( {
  //           action: "getChatbotResponse",
  //           data: {
  //             userMessage: messageToSend,
  //             chatHistory: [],
  //             user_id: username,
  //             session_id: session.id,
  //             saveSession: false
  //           },
  //         } );
  //         ws.send( message );
  //       } );

  //       ws.addEventListener( "message", function incoming( data )
  //       {
  //         if ( data.data.includes( "<!ERROR!>:" ) )
  //         {
  //           addNotification( "error", data.data );
  //           ws.close();
  //           return;
  //         }

  //         if ( data.data === "!<|EOF_STREAM|>!" )
  //         {
  //           incomingMetadata = true;
  //           return;
  //         }

  //         if ( !incomingMetadata )
  //         {
  //           receivedData += data.data;
  //         } else
  //         {
  //           const sourceData = JSON.parse( data.data );
  //           sources = { Sources: sourceData };
  //         }

  //       } );

  //       ws.addEventListener( "error", ( err ) =>
  //       {
  //         console.error( "WebSocket error:", err );
  //       } );

  //       ws.addEventListener( "close", async () =>
  //       {
  //         await refreshTeam();
  //         await refreshMap();
  //         setRunning( false );
  //       } );
  //     } catch ( error )
  //     {
  //       console.error( "Error sending message:", error );
  //       alert( "Something went wrong. Please try again." );
  //       setRunning( false );
  //     }
  //   }
  // };

  const handleAgentOptionSelect = ( agent, option ) =>
  {
    if ( option === "in-place-replace" )
    {
      setSelectedExamplePrompt( `Replace this ${agent.playerName} with another ${agent.agentName}` );
    } else if ( option === "initiator" )
    {
      setSelectedExamplePrompt( `Replace ${agent.playerName} with an Initiator` );
    } else if ( option === "duelist" )
    {
      setSelectedExamplePrompt( `Replace ${agent.playerName} with an Duelist` );
    } else if ( option === "controller" )
    {
      setSelectedExamplePrompt( `Replace ${agent.playerName} with an Controller` );
    } else if ( option === "sentinel" )
    {
      setSelectedExamplePrompt( `Replace ${agent.playerName} with a Sentinel` );
    }
  };

  const refreshTeam = async () =>
  {
    let username: string;
    await Auth.currentAuthenticatedUser().then( ( value ) => ( username = value.username ) );
    if ( !username ) return;
    if ( !appContext ) return;
    const apiClient = new ApiClient( appContext );
    const teamComp = await apiClient.sessions.getTeamComposition(
      props.sessionId,
      username
    );
    if ( teamComp?.players?.length > 0 )
    {
      setTeamComposition( teamComp );
    }
  };

  const refreshMap = async () =>
  {
    let username: string;
    await Auth.currentAuthenticatedUser().then( ( value ) => ( username = value.username ) );
    if ( !username ) return;
    if ( !appContext ) return;
    const apiClient = new ApiClient( appContext );
    const mapComp = await apiClient.sessions.getMapComposition(
      props.sessionId,
      username
    );
    if ( mapComp?.maps?.length > 0 )
    {
      setMapComposition( mapComp );
    }
  };

  console.log( "teamComposition", teamComposition );

  const chatEndRef = useRef<HTMLDivElement | null>( null );

  // Function to scroll to the bottom
  const scrollToBottom = () =>
  {
    chatEndRef.current?.scrollIntoView( { behavior: "auto" } );
  };

  // Auto-scroll whenever messageHistory changes
  useEffect( () =>
  {
    scrollToBottom();
  }, [messageHistory] );


  return (
    <div className={styles.chat_container}>
      <Grid gridDefinition={teamComposition?.players?.length ? [{ colspan: 7 }, { colspan: 5 }] : [{ colspan: 12 }]}>
        <div className="ChatHistoryDiv">
          <SpaceBetween direction="vertical" size="m">
            {messageHistory.map( ( message, idx ) =>
            {
              return (
                <ChatMessage
                  key={idx}
                  idx={idx}
                  message={message}
                  onThumbsUp={() => handleFeedback( 1, idx, message )}
                  onThumbsDown={( feedbackTopic, feedbackType, feedbackMessage ) =>
                    handleFeedback( 0, idx, message, feedbackTopic, feedbackType, feedbackMessage )
                  }
                />
              );
            } )}
            <div ref={chatEndRef} />
          </SpaceBetween>
          {messageHistory.length == 0 && !session?.loading && (
            <div>
              <div className={styles.welcome_text}><center>{CHATBOT_NAME}</center></div>
              <Grid2 container spacing={2} justifyContent="space-around">
                {examplePrompts.map( ( prompt, idx ) =>
                {
                  return (
                    <Grid2
                      className="examplePrompt"
                      onClick={() =>
                      {
                        setSelectedExamplePrompt( prompt?.replace( /<\/?[^>]+(>|$)/g, "" ) );
                      }}
                      key={idx} style={{
                        color: "#E9EFEC",
                        border: "1px solid #FF4654",
                        borderRadius: "0.25rem",
                        padding: "0.75rem",
                        cursor: "pointer"
                      }} size={5.5}><div dangerouslySetInnerHTML={{ __html: prompt }} /></Grid2>
                  );
                } )}
                {
                  loadAdditionalPrompts && additionalExamplePrompts.map( ( prompt, idx ) =>
                  {
                    return (
                      <Grid2
                        className="examplePrompt"
                        onClick={() =>
                        {
                          setSelectedExamplePrompt( prompt?.replace( /<\/?[^>]+(>|$)/g, "" ) );
                        }}
                        key={idx} style={{
                          color: "#E9EFEC",
                          border: "1px solid #FF4654",
                          borderRadius: "0.25rem",
                          padding: "0.75rem",
                          cursor: "pointer"
                        }} size={5.5}><div dangerouslySetInnerHTML={{ __html: prompt }} /></Grid2>
                    );
                  } )
                }
              </Grid2>
              {
                !loadAdditionalPrompts &&
                <center><button onClick={() => setLoadAdditionalPrompts( true )} className="morePromptsButton">LOAD MORE</button></center>
              }
            </div>
          )}
          {session?.loading && (
            <div className={styles.welcome_text}>
              <center>
                <StatusIndicator type="loading">
                  Loading session
                </StatusIndicator>
              </center>
            </div>
          )}
          <ChatInputPanel
            selectedPrompt={selectedExamplePrompt}
            session={session}
            running={running}
            setRunning={setRunning}
            messageHistory={messageHistory}
            setMessageHistory={( history ) => setMessageHistory( history )}
            refreshTeam={refreshTeam}
            refreshMap={refreshMap}
          />
        </div>
        {
          teamComposition?.players?.length &&
          <Grid gridDefinition={mapComposition?.maps?.length ? [{ colspan: 8 }, { colspan: 4 }] : [{ colspan: 12 }]}>
            <div className="TeamDisplayDiv">
              <h2>Team Formation</h2>
              {teamComposition?.players?.length
                ? teamComposition.players
                  .sort( ( a, b ) => ( b.igl ? 1 : 0 ) - ( a.igl ? 1 : 0 ) )
                  .map( ( player ) => (
                    <div style={{ width: "90%" }} className="child" key={player.name}>
                      <ValorantAgentCard
                        agentDetails={{
                          image: valorantAgentsMap[
                            player.agent.toLowerCase().replace( /[^a-z0-9]/g, "" )
                          ]?.image,
                          isIGL: player?.igl,
                          agentName: player?.agent,
                          role: valorantAgentsMap[
                            player.agent.toLowerCase().replace( /[^a-z0-9]/g, "" )
                          ]?.role,
                          playerName: player?.name,
                          averageKills: player?.averageKills,
                          averageDeaths: player?.averageDeaths,
                          gamesPlayed: player?.gamesPlayed,
                        }}
                        onOptionSelect={( agent, option ) =>
                          handleAgentOptionSelect( agent, option )
                        }
                      />
                    </div>
                  ) )
                : null}
            </div>
            {
              mapComposition?.maps?.length &&
              <div className="ValorantMapDisplay">
                <h2>TOP MAPS</h2>
                {
                  mapComposition?.maps?.map( ( map, i ) => (
                    <div style={{ width: "90%" }} className="child" key={map?.rank}>
                      <ValorantMapCard
                        map={{
                          name: valorantMapsMap[
                            typeof map?.name === 'string' ? map.name.toLowerCase() : ''
                          ]?.name,
                          image: valorantMapsMap[
                            typeof map?.name === 'string' ? map.name.toLowerCase() : ''
                          ]?.image,
                          rank: map?.rank,
                        }}
                      ></ValorantMapCard>
                    </div>
                  ) )
                }
              </div>
            }
          </Grid>
        }
      </Grid >
    </div >
  );
}
