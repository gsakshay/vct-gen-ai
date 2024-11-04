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

// Styled components
const StyledCard = styled( Card )( ( { theme } ) => ( {
  position: 'relative',
  width: '256px',
  backgroundColor: '#1F2326',
  border: '2px solid #FF4655',
  overflow: 'hidden',
  transition: 'all 0.3s ease',
  cursor: 'pointer',
  fontFamily: 'Rajdhani',
  '&:hover': {
    transform: 'scale(1.05)',
    borderColor: '#FF6B74',
    '& .agent-image': {
      transform: 'scale(1.1)',
    },
    zIndex: 100000,
  }, '&:active': {
    transform: 'scale(0.95)',
    borderColor: '#FF6B74',
    '& .agent-image': {
      transform: 'scale(0.95)',
    },
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
  height: '7.5rem',
  overflow: 'hidden',
} );

const AgentImage = styled( 'img' )( {
  width: '100%',
  height: '100%',
  objectFit: 'contain', // Ensure the whole image is visible without cutting it
  transition: 'transform 0.3s ease',
} );

const ImageOverlay = styled( Box )( {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(to top, rgba(31, 35, 38, 1), transparent)',
  opacity: 0.1,
} );

const RoleBadge = styled( Box )( {
  display: 'inline-block',
  padding: '0.25rem',
  background: 'rgba(255, 70, 85, 0.2)',
  border: '1px solid #FF4655',
  position: 'absolute',
  top: '10px',
  left: '10px',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  borderRadius: '8px',
  zIndex: 10, // Make sure it's on top
} );

// New IGL Badge styled component
const IGLBadge = styled( Box )( {
  position: 'absolute',
  top: '10px',
  right: '10px',
  padding: '0.25rem 0.5rem',
  backgroundColor: '#FF4655',
  color: '#FFFFFF',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  borderRadius: '8px',
  zIndex: 10, // Make sure it's on top
  boxShadow: `0 0 10px 2px #FFFFFF`,
} );

const StatsContainer = styled( Box )( {
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
  marginTop: '0.5rem',
  padding: '0.5rem',
  backgroundColor: '#121517',
  borderRadius: '8px',
  border: '1px solid #FF4655',
} );

const StatBox = styled( Box )( {
  textAlign: 'center',
  color: '#FFFFFF',
  fontFamily: 'Rajdhani',
} );

const StatValue = styled( Typography )( {
  fontWeight: 'bold',
  fontSize: '0.75rem',
  color: '#FFFFFF',
} );

const StatLabel = styled( Typography )( {
  fontSize: '0.8rem',
  textTransform: 'uppercase',
  color: '#FF4655',
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
          <ImageOverlay />
        </ImageContainer>

        {/* If the agent is an IGL, show the IGL badge */}
        {agent.isIGL && <IGLBadge>IGL</IGLBadge>}

        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          {/* Agent Name */}
          <Typography
            variant="h5"
            sx={{
              fontWeight: 'bold',
              color: '#FF4655',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textAlign: 'center',
              fontSize: '1rem',
            }}
          >
            {agent.agentName}
          </Typography>

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
              {agent?.role?.toLowerCase() === 'initiator' ? <a href="https://emoji.gg/emoji/3452-initiator-valorant"><img src="https://cdn3.emoji.gg/emojis/3452-initiator-valorant.png" width="32px" height="32px" alt="Initiator_Valorant" /></a> : agent?.role}
              {agent?.role?.toLowerCase() === 'duelist' ? <a href="https://emoji.gg/emoji/4987-duelist-valorant"><img src="https://cdn3.emoji.gg/emojis/4987-duelist-valorant.png" width="32px" height="32px" alt="Duelist_Valorant" /></a> : agent?.role}
              {agent?.role?.toLowerCase() === 'sentinel' ? <a href="https://emoji.gg/emoji/5030-sentinel-valorant"><img src="https://cdn3.emoji.gg/emojis/5030-sentinel-valorant.png" width="32px" height="32px" alt="Sentinel_Valorant" /></a> : agent?.role}
              {agent?.role?.toLowerCase() === 'controller' ? <a href="https://emoji.gg/emoji/8733-controller-valorant"><img src="https://cdn3.emoji.gg/emojis/8733-controller-valorant.png" width="32px" height="32px" alt="Controller_Valorant" /></a> : agent?.role}
            </Typography>
          </RoleBadge>

          {/* Player Name */}
          <Typography
            variant="h5"
            sx={{
              fontWeight: 'bold',
              color: '#FFFFFF',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textAlign: 'center',
              fontSize: '1.5rem',
            }}
          >
            {agent.playerName}
          </Typography>

          {/* Game Stats */}
          <StatsContainer>
            <StatBox>
              <StatValue>{agent.averageKills}</StatValue>
              <StatLabel>Kills</StatLabel>
            </StatBox>
            <StatBox>
              <StatValue>{agent.averageDeaths}</StatValue>
              <StatLabel>Deaths</StatLabel>
            </StatBox>
            <StatBox>
              <StatValue>{agent.gamesPlayed}</StatValue>
              <StatLabel>Games</StatLabel>
            </StatBox>
          </StatsContainer>
        </CardContent>
      </StyledCard>

      {/* Dialog with options */}
      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>Select an Option</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Choose an action for {agent.agentName}:
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleOptionSelect( 'in-place-replace' )}>Replace this {agent.playerName} with another {agent.agentName}</Button>
          <Button onClick={() => handleOptionSelect( 'initiator' )}>Replace {agent.playerName} with an Initiator</Button>
          <Button onClick={() => handleOptionSelect( 'duelist' )}>Replace {agent.playerName} with an Duelist</Button>
          <Button onClick={() => handleOptionSelect( 'sentinel' )}>Replace {agent.playerName} with a Sentinel</Button>
          <Button onClick={() => handleOptionSelect( 'controller' )}>Replace {agent.playerName} with a Controller</Button>
          <Button onClick={handleCloseDialog}>Cancel</Button>
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
