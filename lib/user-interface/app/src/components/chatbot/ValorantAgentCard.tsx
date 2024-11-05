import
{
  Box,
  Card,
  CardContent,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  styled,
} from '@mui/material';
import { useState } from 'react';

// Define the agent type
interface Agent
{
  agentName: string;
  role: string;
  playerName: string;
  isIGL: boolean; // New flag to indicate if the agent is an IGL
  averageDeaths: number;
  averageKills: number;
  gamesPlayed: number;
  image: string; // Image source
}

// Styled components for horizontal layout
const StyledCard = styled( Card )( ( { theme } ) => ( {
  position: 'relative',
  width: '100%',  // Increased width for horizontal layout
  height: '128px', // Decreased height for a compact look
  backgroundColor: '#1F2326',
  border: '2px solid #FF4655',
  overflow: 'hidden',
  transition: 'all 0.3s ease',
  cursor: 'pointer',
  fontFamily: 'Rajdhani',
  display: 'flex', // Flex for horizontal layout
  '&:hover': {
    transform: 'scale(1.05)',
    borderColor: '#FF6B74',
    zIndex: 100000,
  },
  '&:active': {
    transform: 'scale(0.95)',
    borderColor: '#FF6B74',
    zIndex: 100000,
  },
} ) );

const GlowingBorder = styled( Box )( {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '4px',
  background: 'linear-gradient(90deg, #FF4655, #FF6B74, #FF4655)',
  animation: 'pulse 2s infinite',
  '@keyframes pulse': {
    '0%': { opacity: 0.6 },
    '50%': { opacity: 1 },
    '100%': { opacity: 0.6 },
  },
} );

const ImageContainer = styled( Box )( {
  position: 'relative',
  width: '100%', // Fixed width for image on the left
  height: '100%', // Full height of the card
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} );

const AgentImage = styled( 'img' )( {
  width: '100%',
  height: '100%',
  objectFit: 'cover', // Image takes full height and width
  transition: 'transform 0.3s ease',
} );

const ContentContainer = styled( Box )( {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  width: '100%',
  padding: '0 0.25rem',
} );

const RoleBadge = styled( Box )( {
  display: 'inline-block',
  padding: '0.25rem',
  position: 'absolute',
  top: '5px',
  right: '5px',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  borderRadius: '8px',
  zIndex: 10,
} );

const IGLBadge = styled( Box )( {
  position: 'absolute',
  top: '5px',
  left: '5px',
  padding: '0.25rem 0.5rem',
  backgroundColor: '#FF4655',
  color: '#FFFFFF',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  borderRadius: '8px',
  zIndex: 10,
  boxShadow: `0 0 10px 2px #FFFFFF`,
} );

const StatsContainer = styled( Box )( {
  display: 'flex',
  flexDirection: 'column',
  padding: '0.5rem 0',
  backgroundColor: '#121517',
  borderRadius: '8px',
} );

const StatBox = styled( Box )( {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  color: '#FFFFFF',
  fontFamily: 'Rajdhani',
  padding: '0rem 0.25rem',
  border: '1px solid #FF4655',
} );

const StatValue = styled( Typography )( {
  fontWeight: 'bold',
  fontSize: '0.75rem',
  color: '#FFFFFF',
  marginRight: '0.5rem',
} );

const StatLabel = styled( Typography )( {
  fontSize: '0.5rem',
  whiteSpace: 'nowrap',
  textTransform: 'uppercase',
  color: '#FF4655',
} );

const DialogOptionButton = styled( Button )( {
  backgroundColor: '#121517',
  color: '#FF4655',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  fontFamily: 'Rajdhani',
  width: '100%',
  border: '1px solid #FF4655',
  '&:hover': {
    backgroundColor: '#FF4655',
    color: '#FFFFFF',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontFamily: 'Rajdhani',
  },
} );

interface ValorantAgentCardProps
{
  agent: Agent; // Expecting the agent type
  onOptionSelect?: ( agent: Agent, option: string ) => void; // Callback for option selection
}

const ValorantAgentCard: React.FC<ValorantAgentCardProps> = ( { agent, onOptionSelect } ) =>
{
  const [openDialog, setOpenDialog] = useState( false );

  const handleCardClick = () =>
  {
    setOpenDialog( true );
  };

  const handleCloseDialog = () =>
  {
    setOpenDialog( false );
  };

  const handleOptionSelect = ( option: string ) =>
  {
    setOpenDialog( false );
    if ( onOptionSelect )
    {
      onOptionSelect( agent, option );
    }
  };

  return (
    <>
      <StyledCard elevation={0} onClick={handleCardClick}>
        {/* Glowing Border */}
        <GlowingBorder />

        {/* Image Container */}
        <ImageContainer>
          <AgentImage className="agent-image" src={agent.image} alt={agent.agentName} />
        </ImageContainer>

        {/* Content Container */}
        <ContentContainer>
          {/* If the agent is an IGL, show the IGL badge */}
          {agent.isIGL && <IGLBadge>IGL</IGLBadge>}

          {/* Role Badge */}
          <RoleBadge>
            <Typography
              variant="caption"
              sx={{
                color: '#FF6B74',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontSize: '0.55rem',
              }}
            >
              {agent?.role?.toLowerCase() === 'initiator' ? <a href="https://emoji.gg/emoji/3452-initiator-valorant"><img src="https://cdn3.emoji.gg/emojis/3452-initiator-valorant.png" width="24px" height="24px" alt="Initiator_Valorant" /></a> : <></>}
              {agent?.role?.toLowerCase() === 'duelist' ? <a href="https://emoji.gg/emoji/4987-duelist-valorant"><img src="https://cdn3.emoji.gg/emojis/4987-duelist-valorant.png" width="24px" height="24px" alt="Duelist_Valorant" /></a> : <></>}
              {agent?.role?.toLowerCase() === 'sentinel' ? <a href="https://emoji.gg/emoji/5030-sentinel-valorant"><img src="https://cdn3.emoji.gg/emojis/5030-sentinel-valorant.png" width="24px" height="24px" alt="Sentinel_Valorant" /></a> : <></>}
              {agent?.role?.toLowerCase() === 'controller' ? <a href="https://emoji.gg/emoji/8733-controller-valorant"><img src="https://cdn3.emoji.gg/emojis/8733-controller-valorant.png" width="24px" height="24px" alt="Controller_Valorant" /></a> : <></>}
            </Typography>
          </RoleBadge>

          {/* Agent and Player Name */}
          <Typography
            sx={{
              fontWeight: 'bold',
              fontSize: '0.75rem',
              color: '#FF4655',
              letterSpacing: '0',
              textTransform: 'uppercase',
            }}
          >
            {agent.agentName}
          </Typography>
          <Typography
            sx={{
              fontWeight: 'bold',
              fontSize: '0.75rem',
              color: '#FFFFFF',
              letterSpacing: '0',
              textTransform: 'uppercase',
            }}
          >
            {agent.playerName}
          </Typography>

          {/* Game Stats */}
          <StatsContainer>
            <StatBox>
              <StatValue>{agent.averageKills}</StatValue>
              <StatLabel>Kills / Round</StatLabel>
            </StatBox>
            <StatBox>
              <StatValue>{agent.averageDeaths}</StatValue>
              <StatLabel>Deaths / Round</StatLabel>
            </StatBox>
            <StatBox>
              <StatValue>{agent.gamesPlayed}</StatValue>
              <StatLabel>Games</StatLabel>
            </StatBox>
          </StatsContainer>
        </ContentContainer>
      </StyledCard>

      {/* Dialog with options */}
      <Dialog open={openDialog} onClose={handleCloseDialog} PaperProps={{
        style: {
          backgroundColor: '#1F2326', // Dark background for Valorant theme
          border: '2px solid #FF4655', // Valorant red border
          borderRadius: '8px',
        },
      }}>
        <DialogTitle sx={{
          color: '#FF4655',
          fontWeight: 'bold',
          textAlign: 'center',
          fontFamily: 'Rajdhani',
          textTransform: 'uppercase',
          fontSize: '1.25rem',
          paddingBottom: '0.5rem',
        }}>
          Select an Option
        </DialogTitle>
        <DialogContent sx={{
          color: '#FFFFFF',
          textAlign: 'center',
          fontFamily: 'Rajdhani',
          paddingBottom: '1rem',
        }}>
          <Typography variant="body1" sx={{ fontSize: '1rem', color: '#D0D0D0' }}>
            Choose an action for <span style={{ color: '#FF4655', fontWeight: 'bold' }}>{agent.agentName}</span>:
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{
            flexDirection: 'column',
            gap: '0.5rem',
            paddingBottom: '1rem',
            justifyContent: 'center',
          }}>
          <DialogOptionButton
            onClick={() => handleOptionSelect( 'in-place-replace' )}>
            Replace {agent.playerName} with another {agent.agentName}
          </DialogOptionButton>
          <DialogOptionButton
            onClick={() => handleOptionSelect( 'initiator' )}
          >
            Replace {agent.playerName} with an Initiator
          </DialogOptionButton>
          <DialogOptionButton
            onClick={() => handleOptionSelect( 'duelist' )}
          >
            Replace {agent.playerName} with a Duelist
          </DialogOptionButton>
          <DialogOptionButton
            onClick={() => handleOptionSelect( 'sentinel' )}
          >
            Replace {agent.playerName} with a Sentinel
          </DialogOptionButton>
          <DialogOptionButton
            onClick={() => handleOptionSelect( 'controller' )}
          >
            Replace {agent.playerName} with a Controller
          </DialogOptionButton>
          <Button
            onClick={handleCloseDialog}
            sx={{
              // marginTop: '0.5rem',
              backgroundColor: '#121517',
              color: '#D0D0D0',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              fontFamily: 'Rajdhani',
              width: '75%',
              border: '1px solid #FF4655',
              '&:hover': {
                backgroundColor: '#2A2D30',
                color: '#FFFFFF',
              },
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Define Preview props
interface PreviewProps
{
  agentDetails: Agent;
  onOptionSelect?: ( agent: Agent, option: string ) => void; // Callback for option selection
}

const Preview: React.FC<PreviewProps> = ( { agentDetails, onOptionSelect } ) =>
{
  return <ValorantAgentCard agent={agentDetails} onOptionSelect={onOptionSelect} />;
};

export default Preview;
