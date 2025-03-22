import '../scss/hangout.scss';

import topNavbar from './modules/global/topNavbar';
import botNavbar from './modules/global/botNavbar';
import { hangoutNav } from './modules/hangout/hangoutNav';
import { hangoutDashboard } from './modules/hangout/dashboard/hangoutDashboard';
import { hangoutAvailability } from './modules/hangout/availability/hangoutAvailability';
import { hangoutSuggestions } from './modules/hangout/suggestions/hangoutSuggestions';
import { hangoutSettings } from './modules/hangout/settings/hangoutSettings';
import { hangoutConclusion } from './modules/hangout/conclusion/hangoutConclusion';

// initializing imports
topNavbar();
botNavbar();

await hangoutDashboard();
hangoutNav();
hangoutAvailability();
hangoutSuggestions();
hangoutConclusion();
hangoutSettings();