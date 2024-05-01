/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js}"],
  darkMode: 'selector',
  theme: {
    extend: {
      colors: {
        // Light mode
        'primary': '#C1C1C3',
        'secondary': '#EBEBEB',
        'title': '#191A1C',
        'description': '#5A5B5E',
        'cta': '#29D0C5',

        // Dark mode
        'primary-dark': '#191A1C',
        'secondary-dark': '#2E2F31',
        'title-dark': '#EBEBEB',
        'description-dark': '#BCBCBD',
        'cta-dark': '#E7BF23',

        // Navbar
        'nav-light': '#f2f2f2',
        'nav-dark': '#131416',

        // Global
        'light': '#EBEBEB',
        'dark': '#191A1C',

        // Utility
      },
      borderColor: {
        'primary': '#DDE1E4',
        'secondary': '#FDFDFD',

        // Dark theme
        'primary-dark': '#0F182C',
        'secondary-dark': '#232D45',

        // Global
        'cta': '#09A8EC',
        'light': '#FDFDFD',
        'dark': '#191A1C',

        'soft-gray': 'rgba(255, 255, 255, 0.15)',
        'soft-white': 'rgba(255, 255, 255, 1',
      },
      borderWidth: {
        '1': '1px',
        '3': '3px',
      },
      boxShadowColor: {
        'soft-gray': 'rgba(0, 0, 0, 0.15)',
        'soft-white': 'rgba(255, 255, 255, 1',
      },
      zIndex: {
        '1': '1',
        '3': '3',
        '5': '5',
        '15': '15',
      },
    },

    screens: {
      'xl': {'max': '1279px'},
      'lg': {'max': '1023px'},
      'md': {'max': '767px'},
      'sm': {'max': '639px'},
      'xs': {'max': '449px'},
    },
    
    fontFamily: {
      main: ['adjustedRoboto', 'sans-serif'],
    },

    fontSize: {
      xs: '1.2rem',
      sm: '1.4rem',
      base: '1.6rem',
      md: '1.8rem',
      lg: '2rem',
      xl: '2.2rem',
      '2xl': '2.4rem',
      '3xl': '2.8rem'
    },
    
    spacing: {
      auto: 'auto',
      '0': '0rem',
      '1': '1rem',
      '2': '2rem',
      '3': '3rem',
      '4': '4rem',
      '5': '5rem',
      '6': '6rem',
      '7': '7rem',
      '8': '8rem',
      '9': '9rem',
      '10': '10rem',
    },

    borderRadius: {
      DEFAULT: '3px',
      'sm': '5px',
      'md': '8px',
      'lg': '10px',
      '3xl': '200px',
    },
  },
  plugins: [],
}