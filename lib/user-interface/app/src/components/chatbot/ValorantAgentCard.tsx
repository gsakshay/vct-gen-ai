import
{
    Box,
    Card,
    CardContent,
    Typography,
    ThemeProvider,
    createTheme,
    styled,
    Badge,
} from '@mui/material';

// Define the agent type
interface Agent
{
    agentName: string;
    role: string;
    difficulty: number;
    playerName: string;
    isIGL: boolean; // New flag to indicate if the agent is an IGL
    abilities: {
        key: string;
        name?: string;
    }[];
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
    height: '192px',
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
    opacity: 0.6,
} );

const RoleBadge = styled( Box )( {
    display: 'inline-block',
    padding: '0.25rem',
    background: 'rgba(255, 70, 85, 0.2)',
    border: '1px solid #FF4655',
    borderRadius: '2px',
    width: '100%',
    textAlign: 'center',
} );

// New IGL Badge styled component
const IGLBadge = styled( Box )( ( { theme } ) => ( {
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
} ) );

const AbilityBox = styled( Box )( {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    backgroundColor: 'rgba(31, 35, 38, 0.8)',
    border: '1px solid rgba(255, 70, 85, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.2s ease',
    position: 'relative',
    '&:hover': {
        borderColor: '#FF4655',
        '& .ability-tooltip': {
            opacity: 1,
        },
    },
} );

const AbilityTooltip = styled( Box )( {
    position: 'absolute',
    top: '-32px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#1F2326',
    padding: '4px 8px',
    borderRadius: '4px',
    opacity: 0,
    transition: 'opacity 0.2s ease',
    whiteSpace: 'nowrap',
    zIndex: 1,
} );

interface ValorantAgentCardProps
{
    agent: Agent; // Expecting the agent type
}

const ValorantAgentCard: React.FC<ValorantAgentCardProps> = ( { agent } ) =>
{
    return (
        <StyledCard elevation={0}>
            {/* Glowing Border */}
            <GlowingBorder />

            {/* Image Container */}
            <ImageContainer>
                <AgentImage
                    className="agent-image"
                    src={agent.image}
                    alt={agent.agentName}
                />
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
                        mb: 1.5,
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
                        }}
                    >
                        {agent.role}
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
                        mb: 1.5,
                    }}
                >
                    {agent.playerName}
                </Typography>
            </CardContent>
        </StyledCard>
    );
};

// Define Preview props
interface PreviewProps
{
    agentDetails: Agent;
}

const Preview: React.FC<PreviewProps> = ( { agentDetails } ) =>
{
    return <ValorantAgentCard agent={agentDetails} />;
};

export default Preview;
