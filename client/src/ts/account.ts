import '../scss/account.scss';

import topNavbar from './modules/global/topNavbar';
import botNavbar from './modules/global/botNavbar';
import { accountFriends } from './modules/account/accountFriends';
import { accountDetails } from './modules/account/accountDetails';
import { initAccount } from './modules/account/initAccount';

// initializing imports
topNavbar();
botNavbar();

await initAccount();
accountDetails();
accountFriends();