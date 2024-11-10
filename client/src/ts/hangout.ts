import '../scss/main.scss';

import topNavbar from './modules/global/topNavbar';
import botNavbar from './modules/global/botNavbar';
import { hangoutNav } from './modules/hangout/hangoutNav';
import { initHangoutWebSocket } from './webSockets/hangout/hangoutWebSocket';

// initializing imports
topNavbar();
botNavbar();

hangoutNav();

// web socket
initHangoutWebSocket('dummyAuthToken', 'dummyHangoutId', 123);