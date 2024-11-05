import React from 'react';
import { Box, Card, Typography, styled } from '@mui/material';

// Define the Map type
interface Map
{
    name: string;
    image: string; // Image source
    rank: number;  // Rank of the map
}

// Styled components for the vertical map card
const StyledCard = styled( Card )( {
    position: 'relative',
    backgroundColor: '#1F2326',
    border: '2px solid #FF4655',
    borderRadius: '8px',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    fontFamily: 'Rajdhani',
    '&:hover': {
        transform: 'scale(1.05)',
        borderColor: '#FF6B74',
    },
    '&:active': {
        transform: 'scale(0.95)',
        borderColor: '#FF6B74',
    },
} );

// Image Container
const ImageContainer = styled( Box )( {
    width: '100%',
    height: '150px', // Adjusted height for the image section
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
} );

const MapImage = styled( 'img' )( {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
} );

// Rank Badge with Valorant theme
const RankBadge = styled( Box )( ( { rank }: { rank: number } ) => ( {
    position: 'absolute',
    top: '5px',
    right: '5px',
    padding: '0.5rem',
    color: rank === 1 ? '#FF4655' : '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'Rajdhani',
    fontSize: rank === 1 ? '1.5rem' : '1rem',
    borderRadius: '8px',
    zIndex: 10,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
} ) );

// Map Info at the bottom
const MapInfoContainer = styled( Box )( {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    padding: '0.5rem',
    backgroundColor: '#121517',
    borderTop: '2px solid #FF4655',
} );

const MapName = styled( Typography )( {
    color: '#FFFFFF',
    fontFamily: 'Rajdhani',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontSize: '1rem',
    letterSpacing: '0.05em',
    textAlign: 'center',
} );

interface MapCardProps
{
    map: Map; // Map data passed to the card
}

const MapCard: React.FC<MapCardProps> = ( { map } ) =>
{
    return (
        <StyledCard elevation={0}>
            {/* Image Section */}
            <ImageContainer>
                <MapImage src={map.image} alt={map.name} />

            </ImageContainer>
            {/* Map Info Section */}
            <MapInfoContainer>
                <RankBadge rank={map.rank}>
                    {`#${map.rank}`}
                </RankBadge>
                <MapName>{map.name}</MapName>
            </MapInfoContainer>
        </StyledCard>
    );
};

export default MapCard;
