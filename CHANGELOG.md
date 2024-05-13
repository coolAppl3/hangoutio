# Changelog


---
### [0.0.6] (2024-05-14)

### Features

- Added `botNavbar.ts`.
- Added a sign out button in the top navbar when a user is logged in.
- The page the user is on is not gently highlighted in the bottom navbar.
- Added `create-hangout.html` and part of the UI has been implemented.
- Added `createHangout.ts`.
- Added `revealPassword.ts` under global modules.

### Bug Fixes

- Fixed hovering inconsistencies with the theme switcher.


### Build Changes

- Removed babel from the dependency list as it won't be used in the build process.
- Changed the build target in `tsconfig.json` to `ES5`.
- Implemented `terser-webpack-plugin` into the build process to minify the resulting JavaScript from the build process.
- Added an HTML template `__template.html` for future HTML files.
  - This template won't be included in the build process.
- `_utils.scss` and `_media-queries.scss` will be removed for now, as it seems they won't be needed in this project.
  - `_variables.scss` will continue to hold the font family information and imports.


### Style Changes

- Removed an unused linter config file that was accidentally left in the client directory.
- Renamed the `components` directory in `src/ts/` to `modules` as it's more fitting.


### Documentation Changes

- Removed unnecessary line breaks in the changelog.


---
### [0.0.5] (2024-05-11)

### Features

- Added the logo as a favicon.
- TypeScript introduced to the project.
  - Previous vanilla JavaScript code has been removed.
- Rewrote `themeSwitcher.js` in TypeScript, and it's now `themeSwitcher.ts`.
- Rewrote `index.js` in TypeScript, and it's now `index.ts`.
- Added `Cookies.ts` to handle all browser cookie manipulation.
- Added `topNavbar.ts`.


### Build Changes

- Updated how assets are built in `webpack.config.js`.
- The build process is now integrated with TypeScript.


### Bug Fixes

- Fixed a simple misspell in the homepage.


### Code Refactoring

- Rephrased a sentence in the homepage.


---
### [0.0.4] (2024-05-07)

### Features

- Homepage layout full implemented.
  - Links and further functionality to be added later.


---
### [0.0.3] (2024-05-03)

### Features

- Theme switcher button is now keyboard navigable.
- Bottom navbar implemented.
  - The navbar is only available on smaller screens (800px or smaller).
- Hero section implemented.


---
### [0.0.2] (2024-05-01)

### Features

- Desktop navbar added.
- Them switcher implemented.
