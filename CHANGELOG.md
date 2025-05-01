# Changelog

## [0.4.90] (2025-05-01)

### Features

- Account details dropdown menu will now hide the email update and account deletion buttons, if either requests are ongoing.
- Implemented rendering logic for the friends list in `account.html`.
- Implemented logic to search friends in `account.html`.


## [0.4.89] (2025-04-30)

### Features

- Added DELETE `accounts/details/updateEmail/abort`.
- Added DELETE `accounts/deletion/abort`.
- Implemented logic to abort ongoing email update requests.
- Implemented logic to abort ongoing account deletion requests.


### Bug Fixes

- Fixed `ongoing_hangouts_count` being `null` if the user hasn't joined any hangouts in `GET accounts/`.


## [0.4.88] (2025-04-29)

### Features

- Updated the phrasing and structure of email templates in `emailTemplates.ts` to align with the changes made in the meantime.
- PATCH `accounts/details/updateEmail/confirm` now also returns the new email in a successful response.
- Implemented logic to confirm the account's new email.
- Implemented logic to confirm account deletion.


### Code Refactoring

- Refactored out request suspension state tracking in `account.html` to simplify the logic.
- Slightly improved the wording in the info modal created after starting the email update process.


### Bug Fixes

- Fixed incorrect endpoint being referenced by `confirmAccountDeletionService()` in `accountService.ts`.
- Fixed a pair of typos in one of the SQL statements under DELETE `accounts/deletion/confirm`.
- Fixed a typo in handleAuthSessionExpired().
- Fixed DELETE `accounts/deletion/confirm` to purging the user's auth sessions after deleting their account.


## [0.4.87] (2025-04-28)

### Features

- Implemented logic to reveal passwords in the account details update form.


### Code Refactoring

- Renamed `verification_code` column in `email_update` table to `confirmation_code`, and update relevant code to align with this change.
- Reworked PATCH `accounts/details/updateEmail/confirm` to not require a password.
- Reworked DELETE `accounts/details/deletion/confirm` to not require a password.
- Reworked DELETE `accounts/details/deletion/start` to use a body to avoid exposing a password within the request URL.
- Updated `sendEmailUpdateEmail()` to no longer refer to the `confirmation_code` column as `verification_code`, and improved the template slightly.


### Bug Fixes

- Fixed details update form not being cleared when the user changes the purpose.


## [0.4.86] (2025-04-27)

### Features

- Updated GET `accounts/` to fetch data about any ongoing email update or account deletion requests.
- Implemented rendering logic for the confirmation form in `account.html`.
- Implemented email resending logic for email update requests.
- Implemented email resending logic for account deletion requests.


### Bug Fixes

- Fixed a number of bugs in DELETE `accounts/deletion/start` and DELETE `accounts/deletion/resendEmail`.
- Fixed `resendDeletionEmailService()` in `accountServices.ts` attempting a DELETE call instead of GET.
- Fixed a few issues with rendering and state management when starting an email update or account deletion process.
- Fixed a typo in GET accounts/details/updateEmail/resendEmail causing undefined to be passed as the recipient in sendEmailUpdateEmail().


### Code Refactoring

- Renamed `resendEmailUpdateService()` to `resendEmailUpdateEmailService()`.


## [0.4.85] (2025-04-26)

### Features

- Users will no longer be able to start an account deletion request alongside an email update request, or vice versa, at the same time.
- Implemented logic to start the email update process, and partially implemented the confirmation form.
- Implemented logic to start the account deletion process.


### Bug Fixes

- Fixed `updateDisplayName()` and `updatePassword()` in `accountDetails.ts` not accounting for incorrect password error responses.


## [0.4.84] (2025-04-24)

### Features

- Implemented logic for users to update their account's display name.
- Implemented logic for users to update their account's password.


## [0.4.83] (2025-04-24)

### Features

- Added rendering logic to the account's details in `account.html`.
- Added `deletion_emails_sent` column to `account_deletion` table, and updated DELETE `accounts/deletion/start` accordingly.
- Added GET `accounts/deletion/resendEmail`.
- Added all the account services to correspond with all the account router's endpoints.
- Implemented details-update form in `account.html` to handle all potential update requests in one form.


### Bug Fixes

- Fixed DELETE `accounts/deletion/start` and DELETE `accounts/deletion/confirm` using a request body.
- Fixed DELETE `accounts/friends/requests/decline` and DELETE `accounts/friends/manage/remove` using a request body.


### Code Refactoring

- Renamed DELETE `accounts/friends/requests/decline` to DELETE `accounts/friends/requests/reject`.


## [0.4.82] (2025-04-22)

### Features

- Added GET `accountsRouter/`.
- Added `getAccountInfoService()` to `accountServices.ts`.
- Implemented the module infrastructure for `accounts.html`.


## [0.4.81] (2025-04-21)

### Features

- Implemented most of the UI structure for `account.html`.


### Build Changes

- Created the files and build instructions for the account page.


### Bug Fixes

- Fixed `progressHangouts()` cron job attempting to insert conclusion events when there are no hangouts to conclude.


## [0.4.80] (2025-04-20)

### Features

- Slightly refined the behavior of the new messages flag in the hangout chat section.
- Added a scroll-to-bottom button in the hangout chat section to improve the user experience.


### Code Refactoring

- Slightly improved type safety in a few modules.


### Bug Fixes

- Fixed `progressHangouts()` cron job adding a hangout conclusion event, even if the function only progressed the hangout.
- Fixed `autoInsertColon()` causing an error when autofill is used.
- Fixed the next stage timer not being reinitialized when a hangout is automatically progressed or concluded.


## [0.4.79] (2025-04-18)

### Features

- Removed the likes count from the winning suggestions, in favour of showing who they were suggested by.
- Time picker inputs will not automatically insert a colon when valid numbers are entered.
- Added a flag to separate new hangout chat messages.
  - Further improvements on the way.


### Code Refactoring

- Removed duplicate `createDetailsElement()` functions, and exported the one in `suggestionUtils.ts` to reduce bundle size.


### Bug Fixes

- Fixed the members count span in the hangout settings section showing the members limit instead.
- Fixed a tiny bug in rendering older hangout chat messages.


## [0.4.78] (2025-04-16)

### Features

- Added a cron job to periodically clear the hangout websocket map of any stale sets.
- Implemented live websocket updates to reflect changes to a registered user's display name.
- Reworked the hangout conclusion section to display tied suggestions, instead of picking one at random.
  - It's worth noting that the now-abolished logic to select a random winning suggestion was temporary.
- Improved the wording for failed hangout conclusions, both in the conclusion section and in the generated event.


### Code Refactoring

- Removed a few unused variables and imports.
- Changed the event listener a few search inputs from `keyup` to `input` for better consistency and performance.
- Aligned search debouncing in `suggestionFilters.ts` with other modules within the app for consistency.
- Changed the "Learn more" button in the dashboard stage description, when the hangout is concluded, to "View outcome" for better consistency.


### Bug Fixes

- Fixed the update password button in the hangout settings section not being dimmed/undimmed properly.
- Fixed the form buttons in the hangout settings section not being dimmed after a successful form submission.
- Fixed a flaw with how the count of tied suggestions is calculated.


## [0.4.77] (2025-04-14)

### Features

- Implemented live websocket updates for suggestion likes.
- Implemented live websocket updates for suggestion votes.
- Added popups to signify to hangout members when a new stage starts.
- Added an event when the hangout is naturally concluded.


### Bug Fixes

- Fixed a bad SQL query in GET `hangouts/details/initial` leading to issues with counting the user's availability slots, suggestions, and votes.
- Fixed the availability slots count not being decremented after an availability slot is deleted.


## [0.4.76] (2025-04-13)

### Features

- Implemented live websocket updates to reflect changes to the hangout title.
- Implemented live websocket updates for all hangout availability slots related updates.
  - Massively improved the rendering logic for the availability calender, and fixed a few bugs, in the process.
- Implemented live websocket updates for all hangout suggestions related updates.
  - This doesn't include likes and votes, which will be implemented in the following patch.


### Code Refactoring

- Refactored `hangoutSettings.ts` to not reinitialize the next stage timer, and instead rely on websocket updated to do it.
- Replaced verbose type checks for websocket data with type casting in `hangoutWebSocketRouter.ts` to avoid inflating it. 


## [0.4.75] (2025-04-13)

### Features

- Added PATCH `hangout/details/updateTitle`.
- Added logic for the hangout leader to update its title.
- Added logic to disable the hangout setting form buttons, effectively dimming them, to avoid overloading the user with a lot of call-to-action buttons, especially on smaller devices.


## [0.4.74] (2025-04-12)

### Features

- Implemented live websocket updates for all hangout config related updates.


### Bug Fixes

- Fixed the current stage span in the hangout settings section not being updated.


## [0.4.73] (2025-04-11)

### Code Refactoring

- Removed unnecessary code from `hangoutWebsocket.ts`.
- Removed a number of unused imports throughout the app.
- Removed `hangoutWebSocketRouter.ts` from the backend, as it's currently not used, with no plans for it be used in sight.
- Refactored how latest hangout events are rendered in the dashboard, to use `createEventElement()` in `hangoutEvents.ts` for better consistency and reduced bundle size.


### Bug Fixes

- Fixed an issue where the user's websocket wouldn't be included in the hangout's websocket map in `app.ts`.
- Fixed `hangoutDashboardState.latestHangoutEvents` always being popped after a live event is inserted, instead of only being popped if it's length is greater than 2.
- Fixed the "No messages found" element not showing in the chat section when no messages are found.


## [0.4.72] (2025-04-10)

### Features

- The title in InfoModal can now be set to null.
- Implemented live websocket updates for all hangout member related updates.


### Code Refactoring

- Added `getAsyncErrorData()` to abstract the process of extracting data from a caught error in client-side try-catch statements.


## [0.4.71] (2025-04-09)

### Features

- Implemented logic to load older chat messages when the user scrolls up to the first tenth of the chat container.
- Improved chat date stamps to now be sticky, helping users know at every point when the messages they're viewing were sent.
- Added a shadow to date stamps to help them hover over messages more naturally.


### Bug Fixes

- Fixed and issue where the earliest message in a fetched batch, despite being by the same sender as the oldest rendered message, being rendered as if it were sent be a different sender.


## [0.4.70] (2025-04-07)

### Features

- Redesigned the filter icon in the suggestion section to be more recognizable for users.


### Code Refactoring

- Refactored how the latest chat messages in the dashboard section are rendered and updated to align with the chat section.
- Renamed `HANGOUT_CHAT_FETCH_CHUNK_SIZE` to `HANGOUT_CHAT_FETCH_BATCH_SIZE`.


### Bug Fixes

- Fixed a number of bugs with the members section caused mostly by typos.
- Reworked how batch chat messages are inserted to fix duplicate date stamps.
- Fixed a typo where "Keep me signed in" was written as "Keep my signed in".


## [0.4.69] (2025-04-04)

### Features

- Improved text display in a few locations within the app using `word-break: break-word;`.
- Users can now join a concluded hangout.
- Guest accounts will now be deleted two months after their associated hangout is concluded.


### Code Refactoring

- Changed the color of the edit button for availability slots to better match the app's theme.
- Changed "View details" button in suggestion cards to "View description", and implemented logic to change its text content to "Hide description" after the suggestion card is expanded.


### Bug Fixes

- Changed `will-change` property to `scroll-position` in the chat container to address elements with a absolute positions becoming invisible.
- Fixed a broken link in `create-hangout.html`.
- Fixed a flaw in how the cookie map is created in `Cookies.ts`, which caused issues with query parameters when links were stored.
- Fixed buttons in the dropdown menu for suggestion and member cards not having a transition.


### Documentation Changes

- Fixed a typo in the patch notes for patch `0.4.30`.


## [0.4.68] (2025-04-04)

### Features

- Reworked the hangout websocket logic on the backend to be more suited towards sending updates to the clients, instead of active, back-and-forth communication, which won't be necessary.
- Integrated websocket logic into the chat section to allow for live updates for all members.


### Code Refactoring

- Removed the hard-coded "no messages" element in the chat container, in favor of appending it only if no messages are found after the initial fetch.


### Bug Fixes

- Implemented another fix to address V8 rendering glitchy lines below chat elements in the chat container.


## [0.4.67] (2025-04-02)

### Features

- Disabled auto focusing the chat textarea when a touchscreen is detected.
- Hangout phone navbar button is now nudged up to not cover the button for sending chat messages when the user is in the chat section.
- Added an indicator if to relay to the user if no messages have been sent in the hangout chat so far.
- Added date stamp logic to the hangout chat.
- Chat container will now scroll to the bottom when the user navigates to the chat section, regardless of whether new messages have been received in the meantime.
- Chat messages are now intuitively rendered from the bottom up.


### Bug Fixes

- Implemented a workaround to fix an issue with the V8 engine causing lines to render randomly below the last message in the chat section.
- Fixed chat messages not piling from the bottom up


## [0.4.66] (2025-04-01)

### Features

- Vastly improved the look of chat messages and how they're rendered.
- Raised the character limit on chat messages from 500 to 2000.
- Implemented chat sending logic.


### Bug Fixes

- Fixed a few bugs in `chatRouter.ts`.


## [0.4.65] (2025-03-29)

### Features

- Added logic to render more events in hangout events section.
- Added chatServices.ts and a pair of services.
- Implemented the layout of the chat section, partially implemented rendering logic.


### Code Refactoring

- Renamed POST `chat/add` to POST `chat/`.
- Reworked POST `chat/retrieve` to GET `chat/`, and slightly improved functionality.


## [0.4.64] (2025-03-26)

### Features

- Added hangout member search functionality.
- Added GET `hangouts/events`.
- Fully implemented the hangout events section.


### Bug Fixes

- Fixed settings navigation buttons not being updated when the user's leaderships status changes.
- Fixed issues with loading the hangout members section when joining.
- Fixed guest sign up form being rendered below the footer.


## [0.4.63] (2025-03-25)

### Features

- Reworked the `hangout_members` table to include a username column, and refactored surrounding logic throughout the app to align accordingly.
- Usernames are now unique across both registered and guest users.
- Added PATCH `hangouts/relinquishLeadership`.
- Added a number of hangout member services.
- Updated the members section to always render when navigated to.
- Implemented logic to claim hangout leadership, and fixed a few bugs in the process.


### Code Refactoring

- Reworked `ConfirmModal.ts` to allow for the title to be null.


### Bug Fixes

- Fixed DELETE `suggestions/kick` using a request body.
- Fixed hangout leadership changes being possible after hangout conclusion.
- Fixed "hangout concluded" responses having a 403 code instead of 409 when attempting join a concluded hangout.


## [0.4.62] (2025-03-22)

### Features

- Added a cron job to progress hangouts in the voting stage with a single suggestion.


### Code Refactoring

- Slightly improved the logic in `concludeNoSuggestionHangouts()` under `hangoutCronJobs.ts`.
- Improved the no-suggestion conclusion hangout event.
- Removed an unnecessary step in PATCH `hangouts/details/stages/progress`, which was meant to delete availability slots and suggestions with a start timestamp less than the conclusion timestamp, as progressing the hangout would only lower the conclusion timestamp.


### Bug Fixes

- Fixed pages with short content having issues with the html element's background color not matching the footer's.


## [0.4.61] (2025-03-22)

### Features

- Changed "Votes count" to "Votes" in suggestion cards to avoid overly specific language.
- Hangout conclusion section and logic implemented.


### Code Refactoring

- Added a small abstraction to improve readability in `suggestionUtils.ts`.
- Updated the suggestions form header to better align with the possibility of a failed hangout conclusion.


### Bug Fixes

- Fixed `hangoutNav()` being called before the hangout data is fetched, leading to the settings navigation buttons behind hidden for the hangout leader.
- Fixed `directlyNavigateHangoutSections()` not dispatching a render event if the destination is the dashboard.
- Fixed users being able to navigate to the conclusion section before the hangout has been concluded.
- Fixed an ID collision causing rendering issues with the hangout members side panel in the hangout's dashboard, and simplified its rendering logic.
- Fixed an inconsistency between the hangout dashboard and suggestion sections in terms of the message shown to the user inviting them to vote for suggestions.
- Fixed latest hangout detection not taking into account different hangouts, leading to unnecessary confusion for users.


## [0.4.60] (2025-03-19)

### Features

- Users will no longer be able to like or unlike a suggestion after the hangout is concluded.


### Code Refactoring

- Removed the limit of 100 maximum hangouts to progress using `progressHangouts()` in `hangoutCronJob.ts`.
  - A limit will be reintroduced after release if proven necessary.
- Reworked suggestion likes and votes to not be delete if a member leaves a hangout, or is kicked, but the hangout is concluded.
  - This is done in preparation for implementing hangout conclusion logic.


### Bug Fixes

- Removed function call that was accidentally leftover from testing in `hangoutCronJobs.ts`.
- Fixed the votes count for suggestions not showing up after the hangout is concluded.
- Fixed the vote toggle button remaining visible when the hangout is concluded, and the suggestions section is rerendered upon user navigation.
- Fixed hangout members being able to access the settings section even if they're not the hangout leader.


## [0.4.59] (2025-03-18)

### Features

- Slightly reworked `SliderInput.ts` to allow for its value to be changed with a single click, instead of dragging being the only option.
- Slightly improved the look of text in the password previewer located in the hangout settings section.


### Bug Fixes

- Fixed the dashboard dropdown menu not closing after one of the buttons are clicked.


## [0.4.58] (2025-03-18)

### Features

- Added logic to delete the hangout in the hangout settings section.
- Added a dropdown menu to the hangout dashboard.
- Added logic to leave a hangout.
- Hangout settings will now first initiate the availability and suggestions sections before being initiated. 


### Code Refactoring

- Removed `handleIrrecoverableError()` as the vision for it was pivoted from many patches ago.


### Bug Fixes

- Fixed DELETE `hangoutMembers/leave` using a request body.
- Fixed the hangout's loading skeleton being placed below the footer in `hangout.html`.
- Fixed incorrect timeout value being used in a two locations.


## [0.4.57] (2025-03-17)

### Features

- Added logic to update the next stage timer when the hangout stages are updated.
- Improved hangout dashboard navigation logic.


### Code Refactoring

- Renamed `initiateNextStageTimer()` to `initNextStageTimer()`.


### Bug Fixes

- Fixed a bug with how the settings section is rerendered when updating the hangout stages.
- Fixed the hangout's dashboard password data not showing or updating correctly.
- Fixed the hangout's dashboard password copy button having an event listener attached to it every time the dashboard is rendered,, and improved the overall logic around it.


## [0.4.56] (2025-03-16)

### Features

- Added logic to update members limit.
- Added logic to copy the hangout password in the settings section.
- Added logic to reveal the hangout password.
- Added logic to update and remove the hangout password.


### Code Refactoring

- Moved `copyToClipboard()` to `globalHangoutUtils.ts`.


### Bug Fixes

- Fixed `updateHangoutMembersLimitService()` in `hangoutServices.ts` having an invalid endpoint.
- Fixed invalid SQL query in PATCH `hangouts/details/updatePassword`.


## [0.4.55] (2025-03-15)

### Features

- Added confirmation logic for progressing hangouts.
- Suggestions can no longer be deleted after the suggestions stage ends.


### Bug Fixes

- Fixed areas where the hangout's stage would be set to `concluded` without updating the `is_concluded` value on the global state.
- Fixed areas where the hangout's stage is updated thanks to an error message, but the section isn't rerendered.


## [0.4.54] (2025-03-15)

### Features

- Updated PATCH `hangouts/details/stages/progress` now returns updated data, and made tiny improvements.
- Added hangout progression logic.
- Added a public function to disable a slider in `SliderInput.ts`.
- Added further rendering logic to `hangoutSettings.ts`.


### Code Refactoring

- Renamed PATCH `hangouts/details/stages/progressForward` to `hangouts/details/stages/progress`.


## [0.4.53] (2025-03-13)

### Features

- Added a number of hangout-related services to `hangoutServices.ts`.
- Added the ability to directly update the slider value for `SliderInput.ts`.
- Added logic to update the duration of hangout stages.


### Code Refactoring

- Renamed PATCH `hangouts/details/changeMembersLimit` to `hangouts//details/updateMembersLimit`.
- Refactored DELETE `hangouts/` to not use a request body.
- Renamed `settingsUtils.ts` to `hangoutSettingsUtils.ts` to avoid potential future name collisions.


### Bug Fixes

- Fixed a few bugs with how new hangout periods are validated.


## [0.4.52] (2025-03-13)

### Features

- Further implemented settings section logic, and prepared the structure for the rest of the logic.

 
### Code Refactoring

- Renamed PATCH `hangouts/details/steps/update` and PATCH `hangouts//details/steps/update` to `hangouts/details/stages/update` and `hangouts//details/stages/update` respectively.


## [0.4.51] (2025-03-12)

### Features

- Added initial layout for the settings section in `hangout.html`.
- Added an option for `SliderInput.ts` to be disabled if needed.
- Implemented initial hangout settings section logic.


### Bug Fixes

- Fixed resizing not being detected correctly to update the slider's DomRect in `SliderInput.ts`.


## [0.4.50] (2025-03-10)

### Features

- Added `conclusionTimestamp` to `globalHangoutState` to have it available throughout the hangout.


### Bug Fixes

- Fixed faulty conditioning in PATCH `hangout/details/steps/progressForward` incorrectly updating the hangout periods.
  - Also removed a few unused variable, and slightly improved efficiency.
- Reworked POST `hangouts/create/accountLeader` to fix it relying on concluded hangouts being archived, which was abolished many patches ago.


## [0.4.49] (2025-03-09)

### Features

- Set `touch-action: manipulation;` globally to prevent touch-related interactivity delays.


### Code Refactoring

- Reworked the dashboard hangout description to be dynamically set, and slightly reworked it, for better efficiency.


### Bug Fixes

- Fixed the slot extension button not being reset when the date-time picker is closed.
- Fixed flawed logic leading to inconsistencies in displayed availability slots when using `availabilityPreviewer.ts`.


## [0.4.48] (2025-03-08)

### Features

- Suggestion cards now show their votes count if the hangout is in the voting stage.
  - Logic concerning flagging edited suggestions was reworked as a result.
- Added logic to update the suggestions form header to reflect the current stage, and display the remaining votes count.


### Bug Fixes

- Fixed suggestions, when filtered by likes or votes, not being filtered out after being unliked or having their vote removed, leading to unintuitive behavior for the user.
- Fixed flawed logic causing inconsistencies in when `dateTimePicker` slots can start on the hangout conclusion date.
- Fixed a few bugs with how the hangout stage affected suggestions being editable.
- Fixed label elements for mock inputs violating recommended practices in `hangout.html`.


### Code Refactoring

- Reordered latest events in the hangout dashboard to show the latest one first.
- Refactored `authUtils.ts` to improve efficiency.


## [0.4.47] (2025-03-06)

### Features

- Users no longer need to be available for a suggestion to vote for it, as it would otherwise be way too restrictive and unintuitive.
- Added suggestion voting logic.


### Code Refactoring

- Refactored some catch blocks on the client end to reduce verbosity.


### Bug Fixes

- Fixed other members' availability slots being rendered as the user's own. 


## [0.4.46] (2025-03-05)

### Features

- Added `votesServices.ts` and necessary services.
- Implemented initial structure for voting logic.


### Code Refactoring

- Implemented `noUncheckedIndexedAccess` in `tsconfig.ts` and refactored backend code for improved safety.
- Removed a few unused variables.
- Renamed `HangoutMessage` interface to `ChatMessage` for better readability.
- Removed DELETE `votes/clear` as it won't be used.
- Reworked DELETE `votes/` to no longer use a request body, improved code efficiency, and fixed a few bugs.
- Changed POST `votes/` to no longer return a vote ID, as iit won't be needed.


## [0.4.45] (2025-03-04)

### Features

- Abolished the proposed pagination system in favor of a `load more` approach.


### Code Refactoring

- Added a spin animation to `tailwind.config.js` and improved how the loading modal's spinner looks and is styled.
- Implemented `noUncheckedIndexedAccess` in `tsconfig.ts` and refactored client-side code to improve safety.


## [0.4.44] (2025-03-02)

### Features

- Added `debounce.ts` as a general global module to be used throughout the app where needed.
- Added suggestions search logic.


### Code Refactoring

- Changed the footer's border color to bg-dark when the light theme is on to blend well.
- Refactored how the `disabled` attribute is added and removed throughout the app.


### Bug Fixes

- Fixed a small bug in how filter changes are cancelled.
- Fixed theme-related flickering being reintroduced in the last patch.
  - Nested `requestAnimationFrame()` statements are now used in `themeSwitcher()` to guarantee that transitions start being allowed after the next repaint.


## [0.4.43] (2025-02-27)

### Bug Fixes

- Fixed incorrect use of `queueMicrotask()` in `hangoutDashboard.ts` leading to other sections failing to load properly.


## [0.4.42] (2025-02-27)

### Features

- Suggestion filtering and sorting fully implemented.


### Code Refactoring

- Simplified some module and state variable names.
- A few other minor refactors.


## [0.4.41] (2025-02-24)

### Features

- Removed DELETE `suggestions/clear` as it won't be used in the app.


### Code Refactoring

- Improved the efficiency of the main SQL query in DELETE `suggestions/`.
- Improved efficiency of DELETE `suggestions/leader`.
- Refactored out excessive `LoadingModal` usage when rerendering the suggestions section.


### Bug Fixes

- Fixed availability section being rerendered after the `LoadingModal` is removed, instead of before, in a few spots.
- Fixed `getDateOrdinalSuffix()` not handling 11th, 12th, and 13th correctly.


## [0.4.40] (2025-02-23)

### Features

- Added hangout leader suggestion deletion logic.


### Code Refactoring

- Refactored `e.target instanceof HTMLElement` to `e.target instanceof HTMLButtonElement` where applicable.
- Reduced suggestion dropdown menu text size.
- Made the button for deleting a different member's suggestion distinct for the hangout leader.


### Bug Fixes

- Fixed next stage timer being initiated every time the user navigates to the dashboard section.
- Fixed `pendingSignInHangoutId` not being removed from cookies if the user accepts being redirected to the hangout.
- Fixed suggestions not being sorted when fetched, and the `renderSuggestionsSection()` not correctly sorting them.


## [0.4.39] (2025-02-23)

### Features

- Added suggestion editing logic.


### Code Refactoring

- PATCH `suggestions/` now returns a `isMajorChange` value to reflect whether the suggestion's likes and votes were removed.


### Bug Fixes

- Fixed PATCH `suggestions/` not correctly defining a major change when updating a suggestion, not deleting suggestion likes, and not rejecting requests where there are no changes provided.
- Fixed `renderDashboardSection()` being unnecessarily called in a number of modules.
  - Further improvements are to be expected in future patches to address how sections are rerendered.


## [0.4.38] (2025-02-21)

### Features

- Rendered suggestions now take into account whether or not the hangout is concluded, hiding certain options if needed.
- Added appropriate `title` and `aria-label` properties to the like button in suggestion cards.


## [0.4.37] (2025-02-21)

### Code Refactoring

- Improved which status codes are used for some error responses, and fixed some actions being possible even after the hangout has been concluded.
- Renamed `hideLoadingSkeleton()` to `removeLoadingSkeleton()` to better reflect the purpose of the function.


## [0.4.36] (2025-02-20)

### Code Refactoring

- Implemented further improvements to error handling throughout the app, especially in regards to state updates.


### Bug Fixes

- Fixed users being allowed to join a concluded hangout.


## [0.4.35] (2025-02-19)

### Code Refactoring

- Refactored a lot of code throughout the app to improve efficiency and fix a few bugs.


### Bug Fixes

- Fixed time values being incorrectly calculated in some of the email templates in `emailTemplates.ts`.
- Fixed the parent div element of popup created by `popup.ts` preventing users from clicking around it.


## [0.4.34] (2025-02-16)

### Features

- Added suggestion dropdown menu expansion logic.
- Added suggestion deletion logic.


### Bug Fixes

- Fixed `validateSuggestionDescription()` not accounting for whitespace and line breaks at either ends of the string in `hangoutSuggestionsForm.ts`.
- Fixed invalid 400-error handling in `addHangoutSuggestion()`.


## [0.4.33] (2025-02-13)

### Features

- Added `removeHangoutSuggestionLike()` and suggestion unlike logic in `hangoutSuggestions.ts`.


### Code Refactoring

- Reworked DELETE `suggestions/likes` to rely on the suggestion ID instead of the like ID for removing suggestion likes.


### Bug Fixes

- Fixed a few incorrect error responses in `suggestionsRouter.ts`.
- Fixed `removeHangoutSuggestionLikeService()` pointing to the incorrect endpoint in `suggestionServices.ts`.


## [0.4.32] (2025-02-13)

### Features

- Implemented suggestion liking logic.
- Added `sortHangoutSuggestions()` to centralize sorting.
- Added `sortingMode` into `HangoutSuggestionsState` and improved how `sortHangoutSuggestions()` is used.


### Code Refactoring

- Changed POST `suggestions/likes` to no longer return the suggestion like ID unnecessarily.


### Bug Fixes

- Fixed `datePickerDatesContainer` being correct without the correct ID in `dateTimePicker.ts`.


## [0.4.31] (2025-02-11)

### Features

- Simplified the use of `handleAuthSessionExpired()` and `handleAuthSessionDestroyed()`.
- Added `dateTimeUtils.ts` as a global utility module.


### Code Refactoring

- Reworked DOM-related functions to leverage `domUtils.ts` where necessary.


## [0.4.30] (2025-02-10)

### Features

- Added a ribbon to distinguish suggestions made by the user.
- Added logic to render user likes and votes on respective suggestions in `suggestionUtils.ts`.
- User will now be informed if they try to expand the suggestions form when they've already reached the suggestions limit.
- Suggestion form now collapses after a suggestion is successfully added.


### Code Refactoring

- Reversed the order of buttons in suggestion elements in `hangout.html`.
- Changed `memberLikes` and `memberVotes` to a set containing suggestions IDs, instead of an array of suggestions.
- Improved suggestion filtering options in `hangout.html`.


### Bug Fixes

- Fixed suggestions not being resorted after a new one is added by the user in `hangoutSuggestionsForm.ts`.
  - This is a temporary solution until further sorting logic is implemented.
- Fixed `getHangoutSuggestions()` being called every time the user navigated to the suggestions section in `hangoutSuggestions.ts`.
- Fixed the hangout member ID being appended to the suggestion instead of the suggestion ID in `suggestionUtils.ts`.


## [0.4.29] (2025-02-09)

### Features

- Improved the look of grid-structured data in `hangout.html`.
- Added `domUtils.ts`.
- Added `hangoutMembersMap` to the global hangout state.
- Added `createSuggestionElement()` in `suggestionUtils.ts`.
- Added suggestions rendering logic in `hangoutSuggestions.ts`.


### Code Refactoring

- A few miscellaneous changes.


### Bug Fixes

- Fixed the `Suggestion` interface not having a potential null value fo the suggestion ID.


## [0.4.28] (2025-02-06)

### Code Refactoring

- Improved how errors affect mock inputs in the suggestions form in `hangoutSuggestionsForm.ts`.
- Improved how availability section is initiated and loaded in `hangoutAvailability.ts`.


### Bug Fixes

- Fixed selected suggestion date and time values not being reflected in the suggestions form mock inputs in `hangoutSuggestionsForm.ts`.
- Fixed label value for second dateTime mock input being "Start" instead of "End" in `hangout.html`.
- Fixed a number of minor bugs in `getHangoutAvailabilitySlots()` in `hangoutAvailability.ts`.
- Fixed `GetHangoutSuggestionsData` interface being incorrectly formed in `suggestionsServices.ts`.


## [0.4.27] (2025-02-06)

### Features

- Added a few necessary error reasons to some responses in POST `suggestions/`.
- Mostly implemented logic to add hangout suggestions in `hangoutSuggestionsForm.ts`.
- Implemented logic to first initializing availability slots before initializing suggestions in `hangoutSuggestions.ts`.


### Bug Fixes

- Fixed `dateTimePicker-selection` event listener throwing an error for selections not meant for availability slots in `hangoutAvailability.ts`.
- Fixed a typo in `dateTimePicker.ts`.


### Bug Fixes

- Fixed incorrect auth session SQL statements in `votesRouter.ts`.


## [0.4.26] (2025-02-05)

### Build Changes

- Removed `.cpanel.yml`.
- Added `suggestionsServices.ts` and all suggestions-related services.


### Code Refactoring

- Renamed DELETE `suggestions/leader/delete` to `suggestions/leader`.
- Improved data sent to the client in GET `suggestions/`.


### Bug Fixes

- Fixed DELETE requests in `suggestionsRouter.ts` using a request body.


## [0.4.25] (2025-02-03)

### Features

- Explicitly set a placeholder color for all inputs and textarea elements.
- Updated `ErrorSpan.ts` to accept textarea and paragraph elements.
- Partially implemented hangout suggestions logic.


## [0.4.24] (2025-01-31)

### Features

- Added GET `suggestions/`.
- Created `suggestion_likes` table.
- Added POST `suggestions/likes`.
- Added DELETE `suggestions/likes`.


### Code Refactoring

- Simplified the usage of `removeRequestCookie()`.
- Abolished the usage of the `success` property in server responses to reduce redundancies.


## [0.4.23] (2025-01-27)

### Features

- Miscellaneous changes to the hangout dashboard.
- Improved the look of scroll bars throughout the app.
- Implemented availability previewer.


### Bug Fixes

- Fixed the two header buttons in the hangout phone menu having issues with the the SVGs within them.
- Fixed the time picker inputs in `dateTimePicker.ts` not resetting their errors when closing the modal.


## [0.4.22] (2025-01-19)

### Features

- Improved the logic of rendering the latest hangout events and chat messages.
- Websocket logic to update the next stage timer and rerender necessary elements is completed.
- Updated websocket logic to allow connections in staging environment.


### Bug Fixes

- Implemented a new fix to transition-related flickering since the previous one was no longer valid since a CSP was introduced.


## [0.4.21] (2025-01-16)

### Features

- Implemented general error handling and fallback logic in `hangoutWebSocket.ts`.
- Implemented websocket logic for updating the hangout dashboard next stage timer and stage descriptions.


## [0.4.20] (2025-01-12)

### Code Refactoring

- Renamed `hangoutWebsocketServerRouter.ts` to `hangoutWebSocketRouter.ts`.
- Improved websocket logic on both the frond and back ends and implemented its initialization on the front end.


### Bug Fixes

- Fixed websockets being incorrectly stored in a set within the client's map, which failed to take into account how objects are referenced, and could've resulted in a memory leak.


## [0.4.19] (2025-01-12)

### Code Refactoring

- Unified messages about hangouts being concluded to "Hangout has already been concluded".
- Miscellaneous improvements in a few modules.


### Bug Fixes

- Fixed incorrect references to `member_limit` instead of `members_limit` when querying the `hangouts` table in some modules.


## [0.4.18] (2025-01-10)

### Features

- Implemented the ability for the user to clear all their availability slots in `hangout.html`.
- Implemented the ability to edit availability slots in `hangout.html`.


### Bug Fixes

- Fixed `ConfirmModal.remove()`being incorrectly called in a few modules.
- Fixed deleting an availability slot not updating the remaining availability slots count.
- Fixed a typo in DELETE `availabilitySlots/clear`.
- Fixed there not being any checks as to whether the user reached the availability slot limit before sending a request to the server in `hangoutAvailability.ts`.


## [0.4.17] (2025-01-09)

### Features

- Implemented the ability to delete availability slots in `hangout.html`.


## [0.4.16] (2025-01-05)

### Features

- Added `editHangoutAvailabilitySlotService()`, `deleteHangoutAvailabilitySlotService()`, and `clearHangoutAvailabilitySlotService()` in `availabilitySlotsService.ts`.


### Code Refactoring

- Centered the text in popup messages displayed using `popup()`.


### Bug Fixes

- Fixed a few bugs with the recent changes to POST `availabilitySlots/` and PATCH `availabilitySlots/`.
- Fixed DELETE `availabilitySlots/` and DELETE `availabilitySlots/clear` using a request body.


## [0.4.15] (2025-01-04)

### Features

- Added `addHangoutAvailabilitySlotService()` in `availabilitySlotsServices.ts`.
- Hangout availability section almost fully implemented in `hangout.html`.


### Code Refactoring

- Removed `hangoutUtils.ts` in favour of `hangoutTypes.d.ts`.
- Updated POST `availabilitySlots/` and PATCH `availabilitySlots/` to reflect the changes to how slot overlap is detected.


## [0.4.14] (2025-01-01)

### Features

- Reworked `updateNextStageTimer()` in `hangoutDashboardUtils.ts` to still display days and hours in the time remaining counter, even if only minutes are remaining.
- Reworked the user's personal availability slots section in `hangout.html` to only show up if they've added any slots.
- Added span to display remaining slots in the availability calendar section in `hangout.html`.


### Bug Fixes

- Fixed `concludeNoSuggestionHangouts() `in `hangoutCronJobs.ts` not updating the value of voting_period in the database, leading to the conclusion date being incorrectly calculated.
- Fixed the recent changes to the links container in the top navbar covering the logo's link.
- Fixed the sign out confirm modal's sign out button having a period at the end in `topNavbar.ts`.
- Fixed latest hangout events in the dashboard not showing the latest event at the top.


## [0.4.13] (2024-12-31)

### Features

- Centered top navbar links to the middle of the viewport instead of relatively to its siblings to avoid unnatural alignment.


### Code Refactoring

- Removed `__temp-data.html`, which contained date picker and time picker HTML, as they're no longer needed.
- Refactored the availability calendar title to just use a paragraph element instead of two span elements.
- Disabled hovering on date-cell elements on screens smaller than 830px in `hangout.html`.


## [0.4.12] (2024-12-31)

### Features

- Added `dateTimePicker.ts` to handle the function of both `datePicker.ts` and `timePicker.ts`.


### Code Refactoring

- Refactored `availabilityCalendar.ts` to avoid too much code duplication and align with `dateTimePicker.ts`.
- Removed `datePicker.ts`, `timePicker.ts`, and their styling as they're no longer needed.
- Removed `form-group-date-picker` and `form-group-time-picker` styling in all scss files.
- Refactored hangoutId query parameter into just id for hangout URLs.


## [0.4.11] (2024-12-28)

### Features

- Implemented render logic for availability slot cards.


### Code Refactoring

- Renamed `hangoutUtils.ts` to `globalHangoutUtils.ts`.
- Removed `hangoutDataTypes.ts` in favor of `hangoutTypes.d.ts`.


## [0.4.10] (2024-12-27)

### Features

- Added an optional `specificTimestamp` parameter in `addHangoutEvent()`.
- Added a hangout event announcing the creation of the hangout in POST `hangouts/create/accountLeader` and POST `hangouts/create/guestLeader`.
- Implemented hangout dashboard calendar.
- Added GET `availabilitySlots/`.


### Code Refactoring

- Refactored out a number of statements using a ternary operators in favor of a logical AND (&&) approach for better readability and convenience.


### Bug Fixes

- Fixed the hangout navbar dropdown menu clipping under some elements by adjusting its z-index.


## [0.4.9] (2024-12-22)

### Features

- Added a few more constants to `clientConstants.ts`.
- Implemented hangout dashboard logic.


### Code Refactoring

- Renamed GET `hangouts/dashboard` to GET `hangouts/initial`, and made a few tiny refactors.


### Bug Fixes

- Fixed a bug with how the value of `decryptedHangoutPassword` was determined in GET `hangouts/details/dashboard`.
- Fixed a bug with the condition in `progressHangouts()` in `hangoutCronJobs.ts`.


## [0.4.8] (2024-12-18)

### Features

- Increased database queue limit to 100.
- Added confirmation logic to prevent the user from accidentally signing out in `hangoutFormThirdStep.ts`.
- Added a Content Security Policy to protect against potential XSS attacks.


### Code Refactoring

- Added `clientConstants.ts` to act similarly to `constants.ts`, and imported its values where needed.
  - Some tiny efficiency improvements were made alongside this change. 
- Added a check for `res.headersSent` in the `catch` block for all routers.
- Improved validation using `containsInvalidWhitespace()` in `globalUtils.ts`.


### Bug Fixes

- Fixed a typo in `constants.ts` where `MIN_HANGOUT_MEMBERS_LIMIT` is equal to 20 instead of 2.
- Fixed a redirect bug with `handleAuthSessionDestroyed()` in `authUtils.ts`.
- Fixed incorrect number of place holders being used in POST `hangouts/create/guestLeader`.
- Fixed suggestions being allowed to start up to a year after the hangout conclusion, instead of only up to half a year.
- Fixed step 3 in the hangout creation form being way too tall when a user is signed in.


## [0.4.7] (2024-12-17)

### Features

- Reworked the `hangouts` table and associated logic throughout the app to reduce unnecessary complexity.
- Removed hangout archiving functionality for now.
  - This feature might be reimplemented in a future patch.


## [0.4.6] (2024-12-16)

### Features

- Implemented a memory threshold check for accepting websocket connections to protect against extreme traffic, despite how unlikely.


### Code Refactoring

- Simplified event message when stages are updated in PATCH hangouts/details/steps/update.


### Bug Fixes

- Fixed minor UI inconsistencies when signing out through `topNavbar.ts` or `botNavbar.ts`. 


## [0.4.5] (2024-12-14)

### Code Refactoring

- Reworked the recovery process to use a 6-digit code instead of a token.
- Renamed `generateUniqueCode()` and `generateUniqueToken()` to `generateRandomCode()` and `generateRandomToken()` respectively in `tokenGenerator.ts`.


### Bug Fixes

- Fixed request cookies not being properly returned in `getRequestCookie()` in `cookieUtils.ts`.
- Fixed an if-statement typo in DELETE `hangoutMembers/leave`.


## [0.4.4] (2024-12-12)

### Code Refactoring

- Improved the general look of emails in `emailTemplates.ts`.
- Fixed error handling in a number of endpoints and services, fixing a few bugs along the way.
- Included missing `authSessionDestroyed` reason in some 401 responses.
- Removed unused date picker and time picker CSS from all scss files apart from `hangout.scss`.
- Removed unnecessary `.html` from links in `emailTemplates.ts`.


### Bug Fixes

- Fixed auth sessions being deleted based off of an incorrect condition in `authCronJobs.ts`.
- Fixed a bug in the auth session INSERT statement in `authSessions.ts`.


## [0.4.3] (2024-12-12)

### Features

- Added `constants.ts` to improve readability and modularity.
- Added POST `accounts/recovery/start` to decouple the start of the recovery process from email-resend functionality.


### Code Refactoring

- Removed `marked_for_deletion` column from the `accounts` table as it's no longer needed.
- Renamed POST `/recovery/sendEmail` to `POST /recovery/start`.
- Improved the look aesthetic look of `INSERT` statements throughout the app.


### Bug Fixes

- Fixed the account `INSERT` query in POST `accounts/signUp` having an incorrect number of placeholders.
- Fixed `isValidAuthSessionDetails()` not specifying an `account` user type when used in account-only endpoints.


## [0.4.2] (2024-12-11)

### Features

- Reworked the account deletion process.
  - Users will now submit a request and receive an email with a confirmation code, which they'll use to authenticate the request.
  - Requests last a maximum of an hour, and multiple failures result in a 24-hour suspension, a warning email sent to the user, and all auth sessions purged.
- Reworked the following processes to use an expiry timestamp to simplify logic:
  - Account verification process.
  - Account recovery process.
  - Account email update process.
- Removed `UserUtils.ts` as it's no longer needed.


### Bug Fixes

- Fixed `eventValues` in DELETE `accounts/deletion/start` not being sliced properly in `accountsRouter.ts`.


## [0.4.1] (2024-12-09)

### Features

- Added `handleAuthSessionExpired.ts`.
- Added `accountServices.ts`.


### Code Refactoring

- Further polished API error handling on the front end to align with the changes in the previous patch.
- Implemented optional chaining for rollback'ing and releasing connections to improve readability.
- Renamed all occurrences of `logDescription` to `eventDescription` when `addHangoutEvent()` is used.
- Moved email services back to being called after a response is sent, as they're contained within their own try-catch block.
- Abstracted account-locking logic using `handleIncorrectAccountPassword()`.
- Improved the readability of `SELECT 1` statements using the `AS` keyword.
- Removed unnecessary `ResultSetHeader` types when making SQL requests.


## [0.4.0] (2024-12-08)

### Features

- **Completely reworked authentication and authorization throughout the app into a cookie session system.**
  - This change comes with a huge amount of added/removed functions, lots of refactoring, slight improvements, and a few bug fixes. Highly relevant changes will be noted in this patch.
  - Further polishing meant to complete this change are to be expected in the next few patches.
- Added `deleteNoMemberHangouts()` in `cronInit.ts` to handle potential edge cases where a hangout remains without any members. 
- Added deleteNoMemberHangouts() to handle potential edge cases where a hangout remains without any members. 
- Updated `Cookies.ts` to include `SameSite=Strict` when setting cookies for better security.
- Added `authRouter.ts`.
- Renamed all routers by adding `Router` at the end.
- Added POST `auth/signOut`.
- Moved some hangout member related requests to `hangoutMembersRouter.ts`, and removed the previous endpoints in said router.
- Added DELETE `hangoutMembers/leave` to `hangoutMembersRouter.ts`.


### Bug Fixes

- Fixed a few error handling bugs in `hangoutFormThirdStep.ts`.
- Fixed `guestHangoutId` being assigned the `authToken` in cookies in `hangoutFormThirdStep.ts`.


### Code Refactoring

- Refactored emails to be sent before a response is provided to the user.
  - The decision to send them after the response was made to avoid waiting for the transporter to send an email, which could drastically increase the response time. However, there isn't any bespoke error handling for transporter errors, which could result in a response being attempted twice, effectively crashing the server.
  - A future patch might improve the whole process.


### Build Changes

- Split `main.scss` into multiple modules to reduce unused CSS in some pages.
- Set up proxy between webpack and the HTTP server on the backend.


## [0.3.6] (2024-11-25)

### Features

- Updated chat bubbles in the hangout loading skeleton to not take up 100% of the available width, to align with how chat bubbles actually look like when loaded.
- Fixed the theme switcher button noticeably moving into position when the dark theme is selected, due to its transition properties.
- Added `htmlRouter.ts` to remove the `.html` part from HTML GET requests, further polishing the user experience.


### Code Refactoring

- Removed unnecessary console logs when an email is sent.
- Improved URL query string extraction using `searchParams` through the URL web API in `verificationForm.ts` and `recoveryEmailForm.ts`.
- Refactored out no-longer-necessary `.html` extensions throughout the app to align with the new HTML router.
- Refactored out no-longer-necessary .html extensions throughout the app to align with the new HTML router.


### Bug Fixes

- Fixed transaction not being committed in `deleteMarkedAccounts()`.
- Fixed users being able to create an account (guest accounts included), or update their password, and have their username and password be identical.


### Build Changes

- Updated `cross-spawn` module using `npm audit fix` to address a high severity vulnerability.
- Renamed `routes` directory to `routers`.
- Added a proxy to `webpack.config.js` to reroute requests to the backend in development mode.
- Implemented `setupMiddlewares` in `webpack.config.js` to properly handle the recent change to how `.html` is no longer required to reach the app's HTML pages.


## [0.3.5] (2024-11-23)

### Features

- Ensured that the hangout password form in `initJoinHangoutForm.ts` is focused, making the input next in line, to improve accessability.


### Code Refactoring

- Updated a few modules to use `signOut()` instead of `Cookies.remove('authToken')`.
- Updated `isSqlError()` to now use a type guard to avoid type casting.
- Implemented mysql2 named placeholders where it makes sense.
- Refactored a few modules to not use unnecessary deconstruction.
- Renamed `hangoutLogger.ts` to `addHangoutEvent.ts`, and renamed `addHangoutLogger()` to `addHangoutEvent()`.
- Renamed a few functions and interfaces in `hangoutServices.ts` and `hangoutFormThirdStep.ts` to improve readability.
- Refactored out a few unnecessary `return;` statements.
- Refactored out a few unnecessary `e.preventDefault()` statements.
- Simplified the use of `InfoModal` and `ConfirmModal` throughout the app.


### Bug Fixes

- Fixed `createHangoutAsAccountService()` expecting a hangoutMemberId in the response, which is no longer the case.
- Fixed leftover references of hangout_logs and changed them to hangout_events.
- Fixed a few tiny bugs with the use of SQL transactions.
- Fixed leftover references of `log_description` and `event_timestamp` from the now renamed hangoutLogs table.


## [0.3.4] (2024-11-22)

### Features

- Updated `signUpForm.ts` to have `VerificationAccountId` and `verificationTimestamp` stored in cookies only for 15 minutes instead of for the whole session.


### Code Refactoring

- Improved overall readability of a number of modules, mostly on the client end.


## [0.3.3] (2024-11-20)

### Features

- Improved the authentication logic in GET `hangouts/details/dashboard`.
- Added a check for the ongoing hangout limit in POST `hangouts/details/members/join/account`.
- Updated GET `hangouts/details/hangoutExists` to no longer return a `isFull` value to avoid potential data leaks.
- Updated GET `hangouts/details/dashboard` to exclude `hangout_id` and `encrypted_password` when fetching data from the database.
- Added `hangoutDashboardUtils.ts`.
- Added `handleNotHangoutMember.ts`.
- Added `iniJoinHangoutForm.ts`.
- Hangout dashboard will now handle cases where users attempt to join a hangout they're not a member of yet.


### Bug Fixes

- Fixed `concludeNoSuggestionHangouts()` in `hangoutCronJobs.ts` referring to `hangout_logs` instead of `hangout_events`.


### Code Refactoring

- Changed the type of `resData`, in `AxiosErrorResponseData` interface in `client/globals.d.ts`, to be `unknown`. 


## [0.3.2] (2024-11-16)

### Features

- Added `hangoutDataTypes.ts`.
- Added `getHangoutDashboardData()` in `HangoutServices.ts`.
- Added a loading skeleton for the dashboard in `hangout.html`.
- Updated GET `hangouts/dashboard` to GET `hangouts/details/dashboard`.
- Added pending hangout ID detection for when a user signs in or signs up.
  - This is detected when a user attempts to join a hangout without being signed in.
  - This won't apply to guest users.
- Added GET `hangouts/details/hangoutExists`.
- Added `getHangoutExistsService()` in `hangoutServices.ts`.
- Added POST `hangouts/details/members/join/account`.
- Added POST `hangouts/details/members/join/guest`.
- Added `joinHangoutAsAccountService()` and `joinHangoutAsGuestService()` in `hangoutServices.ts`.
- Added `initHangoutGuestSignUp`.
- Users can now create a guest account to join the hangout if they're not signed in already.
- Increased the margin between the two main buttons and the third button in `ConfirmModal.ts`.
- Added a custom pulsing animation to `tailwind.config.js`.


### Code Refactoring

- Reworked `ConfirmModal.ts` and `InfoModal.ts` to look for `\n` without whitespace on both sides for multiline descriptions.
- Increased the margin between the cancel and other buttons in modals created by `ConfirmModal.ts`.


### Bug Fixes

- Fixed a typo where the `resendVerificationCodeBtn` was listening to a "slick" event, instead of a `click` event.


## [0.3.1] (2024-11-13)

### Features

- Implemented gzip compression middleware.
- Added `encryptionUtils.ts`.
- Renamed `hashed_password` to `encrypted_password` in the `hangouts` table.
- Reworked hangout passwords to now be encrypted, not hashed, before being stored.
  - This will help the hangout leader retrieve the password to share with potential new members.
  - Updated `hangouts.ts` to align with the above change.
- Added GET `hangouts/dashboard`.


### Code Refactoring

- Renamed `hangout_logs` table to `hangout_events`.
- Unified the use of `Id` instead of `ID` where applicable for consistency throughout the app.


### Build Changes

- Enabled `multipleStatements` and `namedPlaceholders` in the connection pool config in `db.ts`.


## [0.3.0] (2024-11-10)

### Features

- Added `chat` table.
- Added `chat.ts` router.
- Added POST `chat/add`.
- Added POST `chat/retrieve`.
- Implemented basic websocket structure for hangouts.
  - Hangout websockets will be used for live chat as well as live hangout-related updates. 


### Bug Fixes

- Fixed suggestion descriptions being trimmed before validation in `suggestionValidation.ts`.


## [0.2.31] (2024-11-05)

### Features

- Greatly improved the look of chat bubbles on the dashboard in `hangout.html.`
- Slightly improved the logic for enabling hangout password protection in `hangoutFormFirstStep.ts`.
- Improved redirect modals throughout the app.
- Improved new line logic for message elements in `hangout.html`.
- Implemented basic section navigation in `hangout.html`.


## [0.2.30] (2024-11-02)

### Features

- Updated `fallbackMiddleware.ts` error pages are now always sent unless the request's headers accept text/html.
- Reduced the maximum an availability slot can be away from the hangout conclusion from a year down to 6 months.
- Improved the overall look and structure of the sections implemented so far in `hangout.html`.
- Improved the look of the hangout phone navbar in `hangout.html`.
- Added an `Events` button to both navbars in `hangout.html`.
- Changed the light theme background to `bg-secondary` and added a shadow for both `InfoModal` and `ConfirmModal`.
- Added a small simple shadow to popup messages generated by `popup.ts`.
- Removed the hangout phone navbar header in `hangout.html`, and fixed a ham-menu button at the bottom right instead.
- Improved font size throughout the app.
- Improved the look of the footer.


### Code Refactoring

- Moved repetitive classes used with checkbox buttons to `main.scss` to avoid unnecessary clutter.


### Bug Fixes

- Fixed the the hangout phone navbar overlay shifting off the top when scrolling down on mobile browsers.


## [0.2.29] (2024-10-29)

### Features

- Added `initDb.ts` to create any missing tables when the server is initialized.
  - This will also help keep track of any database schema changes.
- Removed buttons meant to navigate the user to the votes section in `hangout.html`, which is no longer needed.
- Implemented sorting UI for the suggestions section in `hangout.html`.
- Added UI elements to allow for liking a suggestion in `hangout.html`.


## [0.2.28] (2024-10-26)

### Features

- Fully implemented the availability section UI for `hangout.html`.
- Fully implemented the suggestions section UI for `hangout.html`.


## [0.2.27] (2024-10-23)

### Features

- Fully implemented the UI the dashboard and navbar UI for `hangout.html`.


## [0.2.26] (2024-10-18)

### Code Refactoring

- Improved TS configuration throughout the app to improve type safety, and updated a few files to align with these changes.
- Renamed createHangout modules and their function for improved readability.
- Added a drop shadow to the hero's SVG in `index.html`.
- Added `hangout.html` and implemented a portion of the dashboard.


### Bug Fixes

- Fixed error message when the guest's username and password are identical appearing below the username input instead of the password input.


## [0.2.25] (2024-10-15)

### Features

- Improved error code SVGs in `errorPages`.
- Improved the bottom navbar.
- Improved footers.
- Added aria labels to utility buttons without any text to improve accessability.


## [0.2.24] (2024-10-14)

### Features

- Added standard 404, 403, and 401 error pages.
- Added `fallBackMiddleware.ts` and implemented basic 404 functionality for now.


## [0.2.23] (2024-10-12)

### Features

- Split `signUpForm.ts` into multiple, easily-managed modules and improved code quality.
- Improved signup validation to not allow passwords to be identical to usernames.


### Code Refactoring

- Improved the phrasing of the `InfoModal` button responsible for taking the user back to their account if they're signed in for both the recovery and sign up forms. 


### Bug Fixes

- Fixed request timer not showing up properly in the last recovery stage in the account recovery form.
- Fixed &timestamp in some email links leading to &time being perceiving the &time part as an x symbol.


## [0.2.22] (2024-10-11)

### Features

- Added a simple catch-all middleware for unexpected API endpoints.
- Improved form shadow throughout the app.
- Added a slight expansion to SliderInput thumbs when being dragged.


### Documentation Changes

- Removed unnecessary lines from CHANGELOG.md.


### Bug Fixes

- Fixed `SliderInput.ts` causing issues when a device has both a mouse and a touchscreen.
  - Also removed unnecessary functions.
- Fixed the last button in botNav having a right border.
- Fixed hero section in `index.html` overflowing and breaking the layout on widths larger than `830px` but with a small height.


## [0.2.21] (2024-10-10)

### Features

- Updated PATCH `accounts/details/updateEmail/confirm` to reset the request_timestamp value when suspending further requests.
  - This will ensure that further requests are denied for 24 hours from when the request was suspended, not initially created.
- Improved the phrasing in `getEmailUpdateWarningTemplate`.
- Added an optional `options` parameter to `InfoModal.display()`.
  - Simplified InfoModal implementation where applicable.
- Added a popup for users trying to sign into a locked account.
- Improved redirection logic in a few modules.


### Chore Changes

- Removed leftover `temp.ts` under the `accountRecovery` modules.


## [0.2.20] (2024-10-10)

### Features

- Improved Axios return types.
- Reworked the previous step button left arrow SVG in the `create-hangout.html` form to a chevron for an improved look.
- Improved the margin between sub-forms and form navigation in `create-hangout.html`.
- Updated `SliderInput.ts` to disable scrolling on touch devices while `dragSlider()` is being called to make it more useable.
- Increased font size for inputs on screen sizes `830px` and smaller to `16px` to prevent the auto-zoom behavior on touch devices without resorting to `user-scalable=no` and any unexpected potential behavior it might cause.


### Bug Fixes

- Fixed incorrect use of bind in `SliderInput.ts` causing `stopDrag()` to be called for every instance of `SliderInput` that has been interacted with.


## [0.2.19] (2024-10-08)

### Features

- Fully implemented `account-recovery.html` and the recovery process.
  - Renamed POST `accounts/recovery/start` to `accounts/recovery/sendEmail`.
  - Removed `latest_attempt_timestamp` from the `account_recovery` table, as the recovery logic has changed in the meantime from when it was added.
- Updated the `AxiosErrorResponseData` global type to accept a potential `resData` object with string keys and unknown values.
- Renamed `infoModal.ts` to `InfoModal.ts` and reworked it into a static class.
- Slightly increased the width of both InfoModal and ConfirmModal.
- `InfoModal.ts` and `ConfirmModal.ts` now split the description into separate HTML paragraph elements when ' \n ' (whitespace included) is present in the description string.
- Both the InfoModal and ConfirmModal now prime their buttons to be next in the tabindex chain to improve user experience.
  - This also helps with preventing form submission or other actions from taking place despite the modals blocking the window.
- Reworked `LoadingModal.ts` to now create and append the LoadingModal element when called, instead of being a static part of every HTML page.
  - Renamed `hide()` to `remove()` as a result.
- Users attempting to sign into their account after it has been locked  will now have an infoModal alongside the error popup to make their next step clear.
- Users attempting to sign into an unverified account will now have an InfoModal displayed alongside the error popup to make their next step clear.
- Slightly improved the code efficiency handling the switch between two sub-forms in `create-hangout.html` and `sign-in.html`.
- Added an  to make sure the user is informed when their account is locked due to too many failed sign in attempts.
- Improved the text in the final stage of the hangout creation form in `create-hangout.html`.
- Reworked title-cased sub-form titles in `create-hangout.html` to be sentence-cased in alignment with the rest of the app.
- Renamed `isValidToken()` to `isValidUniqueToken()`.
- Renamed `formState.ts` in `modules/createHangout` to `hangoutCreationFormState.ts`.


### Code Refactoring

- Renamed DELETE `accounts/friends/remove` router to DELETE `accounts/friends/manage/remove` to improve clarity and consistency.


### Bug Fixes

- Fixed the background in the account-guest toggle button in `sign-in.html` shrinking by a pixel when moving.
- Fixed an edge case in `signUpForm.ts` where `detectSignedInUser()` would display a modal asking the user to sign out to proceed, while a verification attempt is made due to a verification link being detected.
- Fixed `InfoModal.ts` (previously `infoModal.ts`) attempting to remove an existing ConfirmModal instead of an existing InfoModal, when `display()` (previously `displayInfoModal()`) is called.
- Fixed sign up verification failing due to verification codes not being capitalized before a verification request is made.
- Fixed `isValidUniqueToken()` (previously `isValidToken()`) not validating the token's length or characters.
- Fixed `getVerificationData()` in `signUpForm.ts` not correctly handling substrings without a `=` in the query string parameters, and renamed it to `getVerificationLinkDetails()`.


## [0.2.18] (2024-10-01)

### Features

- Improved the email validation regex to allow more than 2 Top Level Domains.


### Code Refactoring

- Improved how parameters are passed into functions in `emailService.ts` and `emailTemplates.ts`.


### Bug Fixes

- Fixed account verification links pointing to an incorrect html page.


### Build Changes

- Removed `process.env.NODE_ENV` from `webpack.config.js` as it didn't make sense, and replaced with a `buildEnvironment` variable instead.


## [0.2.17] (2024-09-30)

### Features

- Added a `created_on_timestamp` column to the `account_verification` table and updated the relevant functions.
- Fully implemented sign up functionality through `sign-in.html` and `signUp.ts`.


### Bug Fixes

- Fixed `archiveHangouts()` in `hangoutCronJobs.ts` incorrectly attempting to insert the `hangout_title` as `title`.
- Fixed `ConfirmModal.ts` not correctly creating a description.
- Fixed buttons without `type="button"` causing form-submission issues.


## [0.2.16] (2024-09-27)

### Features

- Sign out functionality fully implemented into both navbars.
- Signing out through the navbars now creates a confirm modal to complete the action.
- Removed `getAuthToken.ts` to avoid an unnecessary abstraction.
- Clicking Enter while an input is focused in the final step of the hangout creation form in `create-hangout.html` will now submit the form.


### Bug Fixes

- Fixed unwanted form submission when clicking the password reveal button for the guest password confirm input in `create-hangout.html`.


### Build Changes

- Removed `axios` from the backend, which was leftover from previous patches and wasn't used.


## [0.2.15] (2024-09-25)

### Features

- Moved the contents of `signIn.ts` to `signInForm.ts`, which is now imported as a module.
- Completed sign in functionality in `signInForm.ts`.
- Added `getAuthToken.ts` to fetch authTokens and automatically sign the user out if they have an invalid authToken in cookies.
- Added `confirmModal.ts`.
- Improved the email validation regex and removed the room for potential abuse the previous regex had.
- Slightly reduced the size of the account menu icon in the top navbar.


### Code Refactoring

- Removed some redundancies from the methods in `Cookies.ts`.


## [0.2.14] (2024-09-23)

### Features

- Improved the text content on the homepage.
- Added a mandatory `hangout_title` column to the `hangouts` table, and updated the necessary endpoints.
- Added a mandatory hangout title field for the hangout creation form in `create-hangout.html`.
- Added a password confirmation field when a guest signs up to create a hangout in `create-hangout.html`.
- Slightly rearranged the flow of the hangout creation form in `create-hangout.html`.
- Added sign out functionality.
- Improved some of the functions in `validation.ts`.
- Added `sign-in.html`, implemented its UI, and a portion of the functionality.


### Bug Fixes

- Fixed hangout step sliders not updating the form state with their values.


## [0.2.13] (2024-09-21)

### Features

- Completely reworked both navbars.
- Added a full favicon collection as well as a manifest for all html files.


### Bug Fixes

- Fixed a few minor typing issues in `hangoutCronJobs.ts`.


## [0.2.12] (2024-09-20)

### Features

- Added a left arrow icon to next to the previous step button in the hangout creation form.
- Improved the look and functionality of both navbars.
- Reworked the top navbar to now include a better signed-in menu with user-relevant links.
- Reduced ongoing hangouts limit from 20 down to 12.


## [0.2.11] (2024-09-19)

### Features

- Improved how POST `accounts/signUp` checks if username is already taken.
- Improved error type checking in all routers.
- Improved authToken validation for requests in `accounts.ts`.


## [0.2.10a] (2024-09-19)

### Bug Fixes

- Fixed not all updates being pushed in the last patch.


## [0.2.10] (2024-09-19)

### Features

- Changed account sign up for registered users to now require an email address instead of a username to improve security.
- Fully reworked `create-hangout.html`.
- Added a `reason` key-value pair in error responses for some of API's endpoints to improve the front-end flow.
  - Further improvements to be expected in future patches.
- Added a `globals.d.ts` file to share global types in `client`.
- Added `validation.ts` as a global module in `client`.


### Bug Fixes

- Fixed a bug in `SliderInput.ts` where event listeners weren't being removed properly due to an incorrect use of binding.
- Fixed DOMRect issues with `SliderInput.ts` caused by elements being hidden or moving around in the hangout creation form.


### Code Refactoring

- Updated the text and border error color for the light theme to improve border error visibility.
- Updated some of the error messages in `accounts.ts`.
- Slightly improved `Cookies.ts`.
- Fixed navigating the form not updating the current step number above the progress bar.
- Changed the color of informative popups to now have a neutral background.


## [0.2.9] (2024-09-14)

**Note:**: Development was paused for 9 days due to personal reasons.

### Features

- Redesigned the hangout creation form, and started with reworking its code.
- Implemented form navigation for the hangout creation form. 


### Code Refactoring

- Renamed `hangoutFormConfig.ts` to `hangoutFormStepsConfig.ts`
- The progress bar in the hangout form is now filled by the percentage value of the current step divided by the total number of steps.
  - This change makes it more intuitive for users, despite not being technically completely accurate.
- Reworked all 200ms transition properties to 150ms.


### Bug Fixes

- Potential fix for transitions causing dark theme colors to flash for a moment before the light theme is applied.


## [0.2.8] (2024-09-04)

### Features

- **New cron jobs:**
  - `archiveHangouts()`:
    - Runs every hour.
    - Archives hangouts, as well as their respective members, if they have been concluded for a week or longer.
    - Archived hangouts contain basic information about the hangout and the overall conclusion.
    - The function isn't extremely efficient, and is subject to changes in the future, but will do for now.
- Moving on to the front end after this patch. Rate limiting will be implemented later. 

## [0.2.7] (2024-09-03)

### Features

- **New endpoints:**
  - DELETE `suggestions/leader/delete`: Allows the hangout leader to delete unwanted suggestions during the suggestions step.
  - DELETE `votes/clear`: Clears a member's votes unless the hangout is concluded.
- Hangouts can no longer be progressed to the voting step if they contain no suggestions.
- Reduced the number of suggestions a member can make from 10 down to 3.
  - This change is meant to prevent members from being overwhelmed with choices during the voting step.
- Suggestions can no longer be deleted after the suggestions step is completed.
  - Suggestions remain editable in both the suggestions and voting steps.
  - This is done to prevent unwanted edge cases as well as potential confusion within the hangout.
- reduced the number of allowed ongoing hangouts from 30 down to 30.
- Changed request for `hangouts/details/members/claimLeadership` from PUT to POST.


### Code Refactoring

- Renamed `isValidHangoutIDString()` to `isValidHangoutID()`.
- Fixed hangout member ID validation not being well implemented in `hangouts.ts`.
- Improved the efficiency of all endpoints by using an INNER JOIN where appropriate.
- Replaced PUT with PATCH where it makes sense to better align with REST conventions and semantics.


### Bug Fixes

- Fixed a few minor bugs in `hangouts.ts`.
- `availabilitySlots.ts`:
  - Fixed an invalid LEFT JOIN in the POST request under.
  - Fixed an issue where availability slots being updated with identical timestamps didn't return a 409 in the PUT request.


### Documentation Changes

- Added a missing new endpoint in last patch's notes.


## [0.2.6] (2024-08-29)

### Features

- Suggestions are no longer removed if their respective member leaves the hangout.
  - This will improve the user experience, as the member's suggestion might be one others would like to vote for. It also prevents a situation where no suggestions remain during the voting step, rendering the whole hangout pointless.
- Votes are no longer removed if their respective member leaves the hangout, but the hangout has been concluded.
  - This prevents a winning suggestion from losing its spot due to members who've voted for it leaving.
- Reworked PUT `hangoutMembers/details/leaveHangout` to DELETE `hangoutMembers/` to align with the aforementioned reworks.
- A new hangout leader is no longer automatically assigned to a random member. Instead, an option to become the hangout leader is presented to all members, and the first member to click it becomes the new leader.
  - This will prevent situations where a barely active, or inactive, member being randomly assigned as leader.
- Hangouts will remain accessible for 7 days after being concluded, after which they will be archived.
  - Archiving will be introduced in future patches.
- **New endpoints:**
  - DELETE `hangouts/details/members/claimLeadership`: Allows a member to become the hangout leader if the leader has left.


### Bug Fixes

- Fixed `hangoutMembers.ts` having an incorrect number of mysql2 placeholders when creating a new hangout member.


## [0.2.5] (2024-08-24)

### Features

- Hangout requests that change its conclusion timestamp now also delete suggestions with a no-longer valid start timestamp.
- Added a `is_edited` column to the `suggestions` table, which is set to true if a suggestion is at any point edited.
- If a suggestion's title is edited, it will automatically remove any votes it had accumulated to prevent abuse.
- Added a `display_name` column to the `hangout_member` table to better streamline some requests and updates.
- Added a `hangout_logs` table, and implemented logging functionality for relevant hangout-related requests.
- **New cron jobs:**:
  - `concludeNoSuggestionHangouts()`:
    - Concludes hangouts that are within the voting step without any suggestions, and creates a log for it.
    - Runs every minute.


### Bug Fixes

- Fixed `hangoutMembers.ts` not returning the hangout member ID when users join a hangout.


### Code Refactoring

- Slight readability improvements to `availabilitySlots.ts`.


### Documentation Changes

- Fixed incorrect date in last patch.


## [0.2.4a] (2024-08-23)

### Bug Fixes

- Fixed missing build files in `dist`.


## [0.2.4] (2024-08-23)

### Features

- Reworked the suggestions router and table to now support a time slot for when the suggestion is supposed to take place.
- Added time slot validation functions into `suggestionValidation.ts`.
  - These functions are nearly identical to the ones in `availabilitySlotValidation.ts`, but adding an extra layer of abstraction solely for time slots is not worth the additional complexity it will bring to the abstraction hierarchy, at least for now.
- **New endpoints:**
  - POST `votes/`: Adds a vote for its respective hangout member.
  - DELETE `votes/`: Removes a vote.
- Members have a limit of 3 votes per hangout.
- Members can't vote for a suggestion if they don't have an availability slot that intersects with the suggestion time window for at least an hour.


### Code Refactoring

- **Renamed validation modules:**
  - `availabilitySlotsValidation.ts` to `availabilitySlotValidation.ts`.
  - `suggestionsValidation.ts` to `suggestionValidation.ts`.
- Improved the efficiency of validating the hangoutMember details in `suggestions.ts` and `availabilitySlots.ts`.


### Bug Fixes

- Fixed a missing placeholder in `availabilitySlots.ts`.


## [0.2.3] (2024-08-20)

### Features

- Successfully creating a hangout now also returns the hangoutMemberID.
- Updated the string validation for suggestions titles and descriptions:
  - Title:
    - Allowed characters: English alphanumerical characters, whitespace, parentheses, exclamation marks, question marks, fullstops, and hyphens.
    - Double whitespace not allowed
    - Length: Between 3 and 40 (inclusive).
  - Description:
    - Allowed characters: All printable ASCII characters, line breaks, and the euro symbol.
    - Length: Between 10 and 500 (inclusive).
- Improved the validation of user display names to now prevent double spaces.
- Improved authToken and hangoutID validation.
- **New endpoints:**:
  - POST `suggestions/`: Adds a suggestions.
  - PUT `suggestions/`: Updates an existing suggestion.
  - DELETE `suggestions/`: Deletes a suggestion.
  - DELETE `suggestions/clear`: Deletes all suggestions for its respective hangout member. 


### Code Refactoring

- Slight efficiency improvements for the `availabilitySlots` router.


### Bug Fixes

- Fixed the `availabilitySlots` router not accurately authenticating the requester using their hangoutMemberID.


## [0.2.2] (2024-08-18)

### Features

- Reworked the `hangouts` table:
  - Renamed `availability_period`, `suggestions_period`, and `voting_period` to `availability_step`, `suggestions_step`, and `voting_step`.
  - The data types for these steps is now `BIGINT` and they represent days in milliseconds.
  - Renamed `step_timestamp` to `current_step_timestamp`.
  - Added `next_step_timestamp`. It represents the timestamp when the next step is supposed to start.
  - Replaced `concluded_on_timestamp` with `conclusion_timestamp`. It represents the timestamp of when all 3 hangouts steps are concluded, and is updated dynamically whenever steps are changed or progressed.
  - Added `is_concluded` as a boolean.
  - Hangout steps are now all limited between 1 and 7 days.
  - These changes were implemented to help with ensuring availability slots added by the user are not set before the hangout is concluded, which would render them pointless.
- Renamed the `availability` table to `availability_slots` and completely reworked it:
  - Slots now consists of a starting and ending timestamp to represent both the date and time.
  - Slots can't start before their respective hangout's conclusion timestamp.
    - If a hangout's conclusion timestamp is updated for whatever reason, any availability slots starting before the new conclusion timestamp are automatically deleted.
  - Slots can't start beyond a year from their respective hangout's conclusion timestamp.
    - If a hangout's conclusion timestamp is updated for whatever reason, any availability slots starting a year beyond the new conclusion timestamp are automatically deleted.
  - Slots can't be shorter than an hour or longer than 24 hours.
  - Slots can't intersect.
  - Slots can't connect. The start of a slot has to at least be a minute after the end of a nearby slot.
  - Hangout members are limited to a maximum of 10 availability slots.
- **New endpoints:**
  - POST `availabilitySlots/`: Adds an availability slot.
  - PUT `availabilitySlots/`: Updates an existing availability slot.
  - DELETE `availabilitySlots/`: Deletes an availability slot.
  - DELETE `availabilitySlots/clear`: Deletes all availability slots for its respective hangout member. 
- **New cron jobs:**
  - `progressHangouts()`:
    - Progresses unconcluded hangouts to their respective next step.
    - Runs every minute.


### Bug Fixes

- Fixed a few spots where transactions weren't rolled back before a failed response is returned.
- Fixed a few `LEFT JOIN` statements indirectly acting as an `INNER JOIN` due to how their `WHERE` constraint was constructed.


## [0.2.1] (2024-08-12)

### Features

- Implemented a limit of 30 ongoing hangouts an account can be included in at any given time.
- Password recovery attempts now suspend the request for an hour after 3 failed attempts have been made.
- Email update requests now inform the user of the remaining time before a new request can be made, after 3 failed attempts have been made.
- **New cron jobs:**
  - `removeUnverifiedAccounts()`:
    - Removes accounts left unverified 20 minutes after they've been created.
    - Runs every minute.
  - `removeExpiredRecoveryRequests()`:
    - Removes account recovery requests if an hour has passed since they were created.
    - Runs every minute.
  - `removeExpiredEmailUpdateRequests()`:
    - Removes email update requests if a day has passed since they were created.
    - Runs every minute.
  - `deleteMarkedAccounts()`:
    - Completely deletes account marked for deletion for longer than 48 hours.
    - Runs every hour.
- Updated the account deletion email template to now specify that the account will be fully deleted after 48 hours.


### Code Refactoring

- Ditched the use of environmental variables for the hangout member limit.


## [0.2.0] (2024-08-09)

### Features

- Reworked how authTokens are added to the `Accounts` and `Guests` table:
  - Once the row is inserted, the authToken is updated to have `_userID` at the end, where the userID is the primary, auto-generated, `account_id` or `guest_id`.
  - This ensures authTokens, on the extremely unlikely chance of a duplicate being generated, are always unique without the need to handle potential insertion issues with a recursive functions, and also makes app logic way simpler since the user's ID is now appended to their authToken.
- Reworked how hangout ID's are generated by appending `_[timestamp]` at the end.
  - This makes the generation of a duplicate hangout ID astronomically low, as two identical 32-character long IDs need to be generated and inserted at the same exact milliseconds.
  - Client side code will still handle this unlikely event and retry the request.
- A new authToken is now generated if an account is locked.
- Sign in attempts are now rejected before password validation of the account is unverified.
- Failing to update the email due to providing the incorrect verification code now suspends the process for 24 hours, and sends an email to the   account's registered email warning them of the potentially suspicious activity.
- Hangout leaders no longer need to provide the hangout password when changing it to a new one, or making a major change to the hangout.
- Cancelling an account's deletion now generates a new authToken instead of just un-marking the previous one.
- Added a `GLOBAL_HANGOUT_MEMBER_LIMIT` environmental variable to dynamically update the limit if needed without refactoring the code base.
- Changing a hangout's member limit now uses a transaction to set a lock and prevent hangout members from being removed or added before the new limit is applied or denied.
- Removed `availability.ts`, `suggestions.ts`, and `voting.ts`, as they need to be full reworked in future patches.
- Completely removed all the modules in `services/` as they're no longer used.
- All emails now include the user's display name to make them more personalized.


### Code Refactoring

- Vastly improved type-checking, safety, and overall code structure in all the routers.
- Renamed all the tables in the database to now follow the `snake_case` naming standard to better differentiate database variables in the code, and help with some dynamic queries.
- Renamed the `/details/steps/progress` endpoint to `/details/steps/progressForward` to avoid potential confusion.


### Bug Fixes

- Fixed an incorrectly formed if-statement for checking if a valid hangout ID was provided in `/details/steps/progressForward`
- Fixed a few missing transaction rollback statements.

## [0.1.11] (2024-07-30)

### Features

- Added a `username` column to the `Accounts` table schema.
- Removed `friends_id_string` column from the `Accounts` table schema.
- Removed GET `accounts/` endpoint.
- **New tables:**
  - `FriendRequests`: Tracks pending friend requests.
  - `Friendships`: Tracks a user's friends.
- **New endpoints:**
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

## [0.1.10] (2024-07-27)

### Features

- Brought back the `guest.ts` router.
- Renamed `user_name` in the `Accounts` and `Guests` tables to `display_name`.
- Guests now have to create a unique username apart from choosing their display name.
  - This is meant to help with guests logging into their accounts.
- **New endpoints:**
  - PUT `hangoutMembers/details/leaveHangout`: Leaves the hangout.
    - If the user has a guest account, it's automatically deleted.
    - If the user is the leader, a new leader is randomly assigned.
    - If the user is a leader and the only member, the hangout is automatically deleted.
  - POST `guests/signIn`: Used to sign in a guest into their respective hangout.


## [0.1.9] (2024-07-25)

### Features

- **New endpoints:**
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


## [0.1.8] (2024-07-22)

### Features

- Reworked how guest accounts are created.
  - They're now only created when a user wants to join or create a hangout.
  - Removed the `guests.ts` router.
- Added `routerServices.ts`.
- **New endpoints:**
  - PUT `hangouts/details/updatePassword`: Updates the hangout password.
  - POST `hangoutMembers//create/accountMember`: Creates a hangout member from an existing account.
  - POST `hangoutMembers//create/guestMember`: Creates a guest account then a corresponding hangout member.
  - POST `hangouts//create/accountLeader`: Creates a hangout and a leader hangout member using the user's account.
  - POST `hangouts//create/guestLeader`: Creates a hangout, guest account, and a leader hangout member using the guest account.
- **Removed endpoints:**
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


## [0.1.7] (2024-07-15)

### Features

- **New endpoints:**
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


## [0.0.4] (2024-05-07)

### Features

- Homepage layout full implemented.
  - Links and further functionality to be added later.


## [0.0.3] (2024-05-03)

### Features

- Theme switcher button is now keyboard navigable.
- Bottom navbar implemented.
  - The navbar is only available on smaller screens (800px or smaller).
- Hero section implemented.


## [0.0.2] (2024-05-01)

### Features

- Desktop navbar added.
- Them switcher implemented.