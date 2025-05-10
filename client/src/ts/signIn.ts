import '../scss/sign-in.scss';

import topNavbar from './modules/global/topNavbar';
import botNavbar from './modules/global/botNavbar';
import { signInForm } from './modules/signIn/signInForm';
import { disableBackForwardCache } from './modules/global/disableBackForwardCache';

disableBackForwardCache();

topNavbar();
botNavbar();

signInForm();