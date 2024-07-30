# Changelog

---
## [0.1.11] (2024-07-30)

### Features

- Added a `username` column to the `Accounts` table schema.
- Removed `friends_id_string` column from the `Accounts` table schema.
- Removed GET `accounts/` endpoint.
- **New tables**:
  - `FriendRequests`: Tracks pending friend requests.
  - `Friendships`: Tracks a user's friends.
- **New endpoints**:
  - POST `accounts/friends/requests/send`: Sends a friend request.
  - PUT `accounts/friends/requests/accept`: Accepts a friend request.
  - DELETE `accounts/friends/requests/decline`: Declines a friend request.
  - DELETE `accounts/friends/remove`: Removes a friend from a user's friend list.
- If a starts their account deletion process, all hangouts where they're the leader are deleted, and they automatically leave any hangout they're a member of.
  - Users will be informed of this before confirming.

### Bug Fixes

- Fixed an issue with incrementing the count of recovery emails sent.
- Fixed updating an account's password through the `details/updatePassword` endpoint not generating a new authToken.
  - Next patch will deal with updating the hangout member rows the user was a part of.
- Fixed the start of the email update process not checking if the email is in use first.

---
## [0.1.10] (2024-07-27)

### Features

- Brought back the `guest.ts` router.
- Renamed `user_name` in the `Accounts` and `Guests` tables to `display_name`.
- Guests now have to create a unique username apart from choosing their display name.
  - This is meant to help with guests logging into their accounts.
- **New endpoints**:
  - PUT `hangoutMembers/details/leaveHangout`: Leaves the hangout.
    - If the user has a guest account, it's automatically deleted.
    - If the user is the leader, a new leader is randomly assigned.
    - If the user is a leader and the only member, the hangout is automatically deleted.
  - POST `guests/signIn`: Used to sign in a guest into their respective hangout.


---
## [0.1.9] (2024-07-25)

### Features

- **New endpoints**:
  - PUT `hangouts/details/changeLimit`: Changes the hangout member limit.
  - PUT `hangouts/details/steps/changePeriods`: Changes availability, suggestions, or voting periods for a given hangouts.
  - PUT `hangouts/details/steps/progress`: Progresses the hangout to the next step immediately.
  - PUT `hangouts/details/members/kick`: Kicks a hangout member.
  - PUT `hangouts/details/members/transferLeadership`: Transfers the hangout leadership.
  - DELETE `hangouts/`: Deletes hangout.
- Added `step_timestamp` to the `Hangouts` table schema.
- Altered `current_step` in the `Hangouts` table schema to now be between 1 and 4 (inclusive), with 4 referring to a completed hangout.


### Code Refactoring

- Improved the structure and consistency of SQL queries throughout all routers. 


---
## [0.1.8] (2024-07-22)

### Features

- Reworked how guest accounts are created.
  - They're now only created when a user wants to join or create a hangout.
  - Removed the `guests.ts` router.
- Added `routerServices.ts`.
- **New endpoints**:
  - PUT `hangouts/details/updatePassword`: Updates the hangout password.
  - POST `hangoutMembers//create/accountMember`: Creates a hangout member from an existing account.
  - POST `hangoutMembers//create/guestMember`: Creates a guest account then a corresponding hangout member.
  - POST `hangouts//create/accountLeader`: Creates a hangout and a leader hangout member using the user's account.
  - POST `hangouts//create/guestLeader`: Creates a hangout, guest account, and a leader hangout member using the guest account.
- **Removed endpoints**:
  - POST `hangoutMembers/`.
  - POST `guests/`.
- Removed the option to approve members from hangouts.
- Added an option to set up a password for hangouts.
- Reworked how a hangout member is created to now check for a potential password.

### Code Refactoring

- Removed `hangoutServices.ts` and implemented its logic directly where needed.
- Moved `emailServices.ts` into `email` under `util`.

### Bug Fixes

- Fixed the endpoint for creating guests checking for a valid password using `isValidEmailString()` instead of `isValidNewPasswordString()`.


---
## [0.1.7] (2024-07-15)

### Features

- **New endpoints**:
  - POST `accounts/details/updateEmail/start`: Initiates the email update process.
  - PUT `accounts/details/updateEmail/confirm`: Updates the user's email and generates a new authToken.
  - PUT `accounts/details/updateName`: Handles user name changes.
- Enhanced the appearance and phrasing of email templates.
- Renamed endpoint `accounts/details/changePassword` to `accounts/details/updatePassword`.
- Endpoint `accounts/details/updatePassword` now tracks failed sign in attempts and locks the account after reaching the limit.
- Simplified token generation by removing unique identifiers, except for account, guest, and hangout tokens.
  - Added `generateUniqueToken()` for basic token generation.
  - Introduced `isValidToken()` in `userValidation.ts` for validating basic tokens.
- Updated the recovery process to allow up to 3 recovery emails before reaching the limit.
- Added a `marked_for_deletion` column to the `Accounts` table for better readability and logic.
- Recovery requests now generate a new authToken to enhance account security.

### Bug Fixes

- Fixed missing `await` keyword in transaction connections within `accounts.ts`.
- Corrected endpoints in `accounts.ts` to increment failed sign-in attempts on incorrect password entries.
- Addressed several unnoticed bugs in `accounts.ts`.

### Code Refactoring

- Refactored `accounts.ts` for improved efficiency and readability.
- Consolidated modules in `util/generators` into `tokenGenerator.ts`, except for `generatePlaceholders.ts`, which is now at the root level of the `util` directory.
  - Removed `generators` directory.


---
## [0.1.6] (2024-07-11)

### Features

- Added a listener for DELETE requests to `accounts/deletion/start`, which will start the deletion process.
  - This marks the account for deletion, and the account behaves fully as if it is deleted.
  - Deleting the account will take place within 48-72 hours from when the request is made, through a a cron job which will be added in a future patch.
  - The user will receive an email with a link containing a cancellation token meant as a last chance to cancel the process.
- Added a listener for PUT requests to `accounts/deletion/cancel`, which will cancel the process if a valid cancellation token is provided.
- Added a listener for PUT requests to `accounts/details/changePassword`, which will handle password change requests by the user.


### Code Refactoring

- Fully refactored `accounts.ts` to improve error handling, logic, and readability.
  - It no longer uses `accountServices.ts` or `passwordServices.ts`.
  - Transactions have been added where necessary.
- Removed `accountServices.ts`.
- Removed `passwordServices.ts`.
- Renamed the `accounts/recovery/sendEmail` endpoint to `accounts/recovery/start`
- Refactored the `accounts/recovery/start` endpoint to now include the account ID in the recovery email.
- Refactored the `accounts/deletion/start` endpoint to now include the account ID in the deletion email.
- Renamed `password_hash` column in both `Accounts` and `Guests` to `hashed_password` to avoid potential confusion.


### Documentation Changes

- Slightly improved the phrasing in last patch's notes.


---
## [0.1.5] (2024-07-09)

### Code Refactoring

- Renamed `authTokens.ts` to `generateAuthTokens.ts`.
- Moved all code/token generation modules to a new `generators` directory under `util`.
- Renamed `failed_signin_attempts` in the `Accounts` table to `failed_sign_in_attempts` for consistency.
- Successful sign in attempts to now reset the number of failed sign in attempts back to 0.
- Added `AccountRecovery` table to the database.
- Removed `recovery_email_timestamp` which is now redundant with the new `AccountRecovery`table.
- Added `generateRecoveryToken.ts`.
- Added a listener for POST requests to `accounts/recovery/sendEmail`, which will send a recovery email to start the recovery process.
  - The request fails if a `RecoveryAccount` row with the user ID in question is found.
  - A cron job, which will be introduced in a later patch, will handle the removal of `RecoveryAccount` rows after a set period of time.
- Added a listener for PUT requests to `accounts/recovery/updatePassword`, which will validate the recovery token and update the password.

### Bug Fixes

- Fixed a typo in the 500 error message in `createAccount()` under `accounts.ts`.


### Code Refactoring

- Renamed the functions under `userValidation.ts` to now better reflect that they validate the structure of the string itself, without making any requests to the database.
- Refactored how the functions in `userValidation.ts` and `accountServices.ts` are imported in `accounts.ts` to now use namespaces.
- Moved all modules responsible for generating codes or tokens to a `generators` directory under `util`.


---
## [0.1.4] (2024-07-07)

### Features

- Updated how the count for verification emails sent is incremented in the database to reduce unnecessary complexity.
- Updated `isValidEmail()`, `isValidName()`, and `isValidPassword()` in `userValidation.ts` to now ensure that the argument passed in is of type string.
- Reworked `createAccount()` in `accounts.ts` to now return the user ID, instead of the authToken, which should only be supplied once the account is verified.
- Reworked the `/resendVerificationCode` endpoint in `accounts.ts` to now validate the request based on the user ID.
  - The router now listens for a POST request instead of GET for this endpoint.
- Added `isValidVerificationCode()` under `userValidation.ts`.
- Added `incrementFailedVerificationAttempts()` under `accountServices.ts`.
- Added `deleteAccount()` under `accountServices.ts`.
- Added `verifyAccount` as a POST endpoint in the `accounts.ts` router.
- Added `/signIn` as a POST endpoint in the `accounts.ts` router.
- Added `/` as a GET endpoint in the `accounts.ts`.
  - This request, for now, only fetches the account's name and friends ID string.

### Bug Fixes

- Fixed a leftover hardcoded dummy authToken in `accounts.ts`, which wasn't removed prior to pushing last patch.

### Code Refactoring

- Reworked the `Accounts` table to now only rely on the number of `failed_signing_attempts` to determine if the account is locked, effectively skipping an unnecessary step.


---
## [0.1.3] (2024-07-06)

### Features

- Increased idle timeout for pool connections from 1 to 5 minutes.
- Increased the pool connections limit from 20 to 50.
- Moved the authToken logic for all endpoints to check for it in the `Authorization` header as a `Bearer` token.
- Added `initTransporter.ts`.
- Added `emailServices.ts`.
- Added `emailTemplates.ts`.
- Restructured the form of the `Accounts` table in the database.
- Added verification code email logic when signing up.
- Added verification code resending logic to `accounts.ts`, which now listens to GET requests made to `/resendVerificationCode`.
- Added `accountServices.ts`.
- Added `generatePlaceHolders.ts` to help make `mysql2` execute statements more readable and less error-prone.
- Added `generateVerificationCode.ts`.
  - Generated codes are 6 characters long, and only use uppercase letters and numbers, with the letter `O` being excluded.

### Code Refactoring

- Refactored some of the logic in existent routers for better readability and efficiency.


### Bug Fixes

- Fixed static files in `app.ts` being incorrectly pointed to the `public` directory. 


### Build Changes

- Added a `.cpanel.yml` file to automate the deployment process.
- Added `global.d.ts`.
  - The file is empty for now, but might be used down the line.


---
## [0.1.2] (2024-07-01)

### Features

- Added `suggestions.ts` as a router to handle suggestion-related requests.
- Added `suggestionServices.ts`.
- Added `suggestionValidation.ts`.
- Added `votes.ts` as a router to handle suggestion-related requests.
- Added `voteServices.ts`.
- Added `add_vote.sql` as reference to the `add_vote` procedure now in the database.
- Added `validate_auth_token.sql` as a reference to the `validate_auth_token.sql` function now in the database.
  - Both the procedure and function above are not used currently within the app. They will be tested at some point in the future to measure how significant of a performance improvement they provide, and will subsequently either be implemented further or removed.
- Added `logUnexpectedError.ts` which will be used if procedures end up being implemented for monitoring purposes.


---
## [0.1.1] (2024-06-27)

### Features

- Improved the regex used for testing a valid 24-hour format in `timePicker.ts` to make it more robust.
- Added `timeSlotValidation.ts` to validate time slot strings in the backend.
- Added a `member_limit` column in the `Hangouts` table and implemented the functionality.
  - The column's value can be between 2 and 20 (inclusive).
  - Future patches will reflect this one the front end.
- Removed the indexes set for `created_on_timestamp` and `completed_on_timestamp` in the `Hangouts` table.
- Added `undefinedValuesDetected()` under `requestValidation.ts` to detect invalid request data and return an intentionally vague 400 response.
  - This is only a part of the validation process, and is meant to prevent bad actors from guessing the correct request structure.
- Added `authTokenServices.ts` and `hangoutServices.ts`.
- Renamed `passwordHash.ts` to `passwordServices.ts` and moved it to the services directory.
- Renamed `hashPassword()` to `getHashedPassword()` and reworked the function into a service that takes in the Response object.
- Added `Availability.ts` as a router to handle availability-related requests.


### Code Refactoring

- Reworked the general structure of routers to make them more readable and efficient.
- Reworked the `HangoutMembers` table to now store authTokens instead of the user's type and ID.
- Removed `isValidUserType()` from `accountValidation.ts` as it's no longer needed.
- Changed `account_name` in the `Accounts` table and `guest_name` in the `Guests` table to now both be `user_name`, to simplify data fetching queries down the line, and avoid redundancies.


### Bug Fixes

- Fixed the ability to set multiple hangout members as a leader for the same hangout.
- Fixed `includesExistingSlots()` in `timePicker.ts` not converting the dates to numbers before executing the comparisons.
  - JavaScript's Lexicographical comparison was automatically used (and worked so far), but the function now properly converts strings into numbers to avoid unexpected behavior.
- Fixed responses resulting from request keys 


### Documentation Changes

- Removed redundancies from the changelog, and rephrased some of the patch notes.


---
## [0.1.0] (2024-06-21)

### Build Changes

- Backend typescript build process implemented.
  - Production-ready code will be created into `dist` in the root level.


### Features

- Added `db.ts` to handle the connection to the MariaDB database and create a connection pool.
- Added `app.ts` and set up the following routes: `/api/hangouts`, `/api/accounts`, `/api/guests`, `api/hangoutMembers`.
- Added `accounts.ts`.
  - POST requests to `/accounts/signup` are meant for creating an account.
  - Validation functionality to be implemented in a future patch.
- Added `guests.ts`.
  - POST requests to `/guests/` are meant for creating a guest user.
  - Guest accounts are created for their respective hangout, and are automatically removed once the hangout is concluded.
  - Guests will have to provide a name and a password for their respective hangout to ensure proper identification within the hangout.
- Duplicate account and guest names within the same hangout is allowed, and the front-end should help distinguish two people with the same name. This logic might change in a future patch if it proves ineffective.
- Added `hangouts.ts`.
  - POST requests to `/hangouts/` are meant for creating a hangout.
  - Hangouts are automatically removed from the database upon being concluded.
- Added `hangoutMembers.ts`.
  - POST requests to `/hangoutMembers/` are meant for creating data linking an account or a guest user to a specific hangout within the database.
  - Hangout member data will also specify whether a user is the leader of the hangout.
- Added `generateAuthToken.ts`, which has two functions responsible for generating authTokens for accounts and guest users.
- Added `generateHangoutID.ts`, which is responsible for generating a 32-character hangout ID.
- Added `userValidation.ts`, which contains validation functions used during the creation of accounts and guest users.
- Added `hangoutValidation.ts`, which contains validation functions used during the creation of a hangout.
- Added `passwordHash.ts`, which contains a function to hash and salt passwords before returning it, using the `bcrypt` library.

### Bug Fixes

- Fixed `__datePicker.html` and `__timePicker.html` not being removed despite last patches' notes stating they were.


### Code Refactoring

- Added missing `RegExp` type in `validatePassword()` under `hangoutAccount.ts`.
- Names no longer get mutated to lowercase when added to the state in `validateAccountName()`.
  - Changed the regex to no longer accept whitespace in general, but rather a space.
  - The input value is now also trimmed before being tested against the regex, to prevent a single space value passing.
  - Added a note above the name input to express to the user that the input is case-sensitive.


---
## [0.0.10] (2024-06-05)

### Features

- Added a getter for the sliderValue in `SliderInput.ts`.
- Moved the hangout account creation step in `hangoutForm.ts` and `create-hangout.html` to now be last. 
- `hangoutForm.ts` completed apart from the final step to persist the data, which will be coming in future steps.
- Added `hangoutFormConfig.ts`  to control the sliders in the configuration step in `create-hangout.html`.
- Added `hangoutAvailability.ts` `modules/createHangout/` to control the availability step in `create-hangout.html`.
- Added `hangoutAccount.ts` to control the group leader credentials, and trigger the final event to begin processing the form.
- Added `hangoutFormState.ts` to hold the state of the above-mentioned modules.
- Slight adjustments to `datePicker.ts` and `timePicker.ts`.


### Bug Fixes

- Removed leftover console log in `LoadingModal.ts`.
- Fixed the password reveal icon's position changing if the error message is multi-lined.


### Style Changes

- Made general, fine-tuning changes in `main.scss`.


### Build Changes

- Removed `__datePicker.html` and `__timePicker.html` templates, as they've been implemented in `create-hangout.html` and can be retrieved again that way


---
## [0.0.9] (2024-06-03)

### Features

- Amended some of the text in `index.html`.
- Added `timePicker.ts`.
  - Added a temporary `__timePicker.html` under `src/html/`.
- Rephrased some of the content in `index.html`.
- Added `ErrorSpan.ts`.
- Added `LoadingModal.ts`.
- Implemented the UI for the 3rd step in `create-hangout.html`.


### Style Changes

- Simple additions to `tailwind.config.js`.


### Code Refactoring

- Changed any occurrence of `setAttribute('disabled', 'disabled')` to `setAttribute('disabled', '')` throughout the app for better readability and consistency.


### Bug Fixes

- Replaced any use of `isNan()` with `Number.isNaN()` to avoid any potential unexpected behavior down the line.
- Specified touch events in `SliderInput.ts` to be passive to avoid potential scrolling issues.
- Fixed keyboard navigation being possible on sliders controlled by `SliderInput.ts` while in the process of being dragged.
  - This didn't negatively affect the state or cause unexpected behavior with the final result, but simply isn't user intuitive.


### Build Changes

- Changed the target in `tsconfig.js` to ES2015 (ES6) instead of ES5.

---
## [0.0.8] (2024-05-26)

### Features

- Created `SliderInput.ts` to handle custom `range` inputs throughout the app.
- Further UI elements added to `create-hangout.html`.


### Style Changes

- Changed the shape of the toggle button in the theme switcher from a circle to a pill.


### Bug Fixes

- Removed leftover date picker HTML in `create-hangout.html`.
  - A temporary template `__datePicker.html` has been added for now until the date picker is used permanently in of the HTML files.


### Documentation Changes

- Added an extra point about the `datePicker.ts` module which was not noted in the last patch.


---
## [0.0.7] (2024-05-23)

### Features

- Added more UI elements in `create-hangout.html`.
- Added `hangoutForms.ts`.
  - It should handle the form navigation, as well as the form submission later down the line.
- Added `datePicker.ts`.
  - This module will be used throughout the app where needed, and will provide a consistent way for users to select a date and for the app to store them.
  - The module dispatches a custom event with a payload to the window when a date is selected.
  - The date picker doesn't allow picking any dates in the past, or dates beyond the two following months to the current one.
- Added `popup.ts` to handle popup messages throughout the app where needed.


### Build Changes

- Removed `_utils.scss` and `media-queries.scss` completely.
  - Any extra/complicated styling will take place in `main.scss` to avoid over-complicating future styling changes.
- Removed `_variables.scss` and moved the font definitions to `main.scss` considering their simplicity.


---
## [0.0.6] (2024-05-14)

### Features

- Added `botNavbar.ts`.
- Added a sign out button in the top navbar when a user is logged in.
- The page the user is on is not gently highlighted in the bottom navbar.
- Added `create-hangout.html` and part of the UI has been implemented.
- Added `createHangout.ts`.
- Added `revealPassword.ts`.

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
## [0.0.5] (2024-05-11)

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
## [0.0.4] (2024-05-07)

### Features

- Homepage layout full implemented.
  - Links and further functionality to be added later.


---
## [0.0.3] (2024-05-03)

### Features

- Theme switcher button is now keyboard navigable.
- Bottom navbar implemented.
  - The navbar is only available on smaller screens (800px or smaller).
- Hero section implemented.


---
## [0.0.2] (2024-05-01)

### Features

- Desktop navbar added.
- Them switcher implemented.
