import { createTheme } from '@aws-amplify/ui-react';

export const valorantTheme = createTheme( {
    name: 'valorant-theme',
    tokens: {
        colors: {
            background: {
                primary: { value: '#fffbf5' },  // Light background
                secondary: { value: '#fd4556' }, // Primary red
            },
            font: {
                primary: { value: '#000000' }, // Dark text for light theme
                secondary: { value: '#bd3944' }, // Secondary red
                // accent: { value: '#53212b' }, // Dark red for accents
            }
        },
    },
    overrides: [
        {
            colorMode: 'dark',
            tokens: {
                colors: {
                    background: {
                        primary: { value: '#53212b' }, // Dark background
                        secondary: { value: '#fd4556' }, // Primary red
                    },
                    font: {
                        primary: { value: '#ffffff' }, // White text for dark theme
                        secondary: { value: '#bd3944' }, // Secondary red
                        // accent: { value: '#fffbf5' }, // Light color for accents
                    },
                },
            },
        },
    ],
} );