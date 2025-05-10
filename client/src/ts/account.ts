import '../scss/account.scss';

import topNavbar from './modules/global/topNavbar';
import botNavbar from './modules/global/botNavbar';
import { initAccount } from './modules/account/initAccount';
import { disableBackForwardCache } from './modules/global/disableBackForwardCache';

disableBackForwardCache();

topNavbar();
botNavbar();

await initAccount();