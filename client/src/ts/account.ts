import '../scss/account.scss';

import topNavbar from './modules/global/topNavbar';
import botNavbar from './modules/global/botNavbar';
import { initAccount } from './modules/account/initAccount';

// initializing imports
topNavbar();
botNavbar();

await initAccount();