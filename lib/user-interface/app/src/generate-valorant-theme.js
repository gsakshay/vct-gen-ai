import { join } from 'path';
import { buildThemedComponents } from '@cloudscape-design/components-themeable/theming';

const theme = {
  tokens: {
    // Color values
    colorBackgroundLayoutMain: {
      light: '#FFFFFF', // Light background for light mode
      dark: '#0A0A0A',  // Dark background for dark mode
    },
    colorTextAccent: {
      light: '#FF4654', // Valorant red for accents in light mode
      dark: '#D73A45',  // Darker variant for dark mode
    },
    // Using color tokens that are themeable
    colorBackgroundButtonPrimaryDefault: {
      light: '#FF4654', // Primary button color in light mode
      dark: '#D73A45',  // Primary button color in dark mode
    },
    // Font family
    fontFamilyBase: "Rajdhani", 
  },
  contexts: {
    'top-navigation': {
      tokens: {
        colorTextAccent: '#FF4654', // Accent color for navigation items
      },
    },
    header: {
      tokens: {
        // Additional themable properties for the header can be added here
      },
    },
    flashbar: {
      tokens: {
        // Additional themable properties for the flashbar can be added here
      },
    },
    alert: {
      tokens: {
        // Additional themable properties for alerts can be added here
      },
    },
  },
};




buildThemedComponents({
  theme,
  outputDir: join(process.cwd(), './themed'), // Output directory for the generated components and tokens
});
