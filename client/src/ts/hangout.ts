import '../scss/hangout.scss';

import topNavbar from './modules/global/topNavbar';
import botNavbar from './modules/global/botNavbar';
import { hangoutNav } from './modules/hangout/hangoutNav';
import { initHangoutWebSocket } from './webSockets/hangout/hangoutWebSocket';
import { hangoutDashboard } from './modules/hangout/dashboard/hangoutDashboard';
import { hangoutAvailability } from './modules/hangout/availability/hangoutAvailability';

// initializing imports
topNavbar();
botNavbar();

hangoutNav();
await hangoutDashboard();
hangoutAvailability();

// web socket
// initHangoutWebSocket('dummyHangoutId', 123);