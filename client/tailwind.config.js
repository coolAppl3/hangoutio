/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js}"],
  darkMode: 'selector',
  theme: {
    extend: {
      colors: {
        // light mode
        'primary': '#D5D5D7',
        'secondary': '#EBEBEB',
        'title': '#191A1C',
        'description': '#3C3D3E',
        'cta': '#29D0C5',

        // dark mode
        'primary-dark': '#191A1C',
        'secondary-dark': '#2E2F31',
        'title-dark': '#EBEBEB',
        'description-dark': '#BCBCBD',
        'cta-dark': '#E7BF23',

        // navbar
        'nav-light': '#f2f2f2',
        'nav-dark': '#131416',

        // global
        'light': '#EBEBEB',
        'dark': '#191A1C',

        // utility
      },
      borderColor: {
        // light mode
        'primary': '#D5D5D7',
        'secondary': '#EBEBEB',
        'title': '#191A1C',
        'description': '#3C3D3E',
        'cta': '#29D0C5',

        // dark mode
        'primary-dark': '#191A1C',
        'secondary-dark': '#2E2F31',
        'title-dark': '#EBEBEB',
        'description-dark': '#BCBCBD',
        'cta-dark': '#E7BF23',

        // navbar
        'nav-light': '#f2f2f2',
        'nav-dark': '#131416',

        // global
        'light': '#EBEBEB',
        'dark': '#191A1C',

        // border-only utility
        'light-gray': 'rgba(30, 30, 30, 0.25)',
        'light-black': 'rgba(200, 200, 200, 0.25)'
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
      gridTemplateColumns: {
        '16': 'repeat(16, minmax(0, 1fr))',
      },
    },

    screens: {
      'md': {'max': '800px'},
      'sm': {'max': '650px'},
      'xs': {'max': '400px'},
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