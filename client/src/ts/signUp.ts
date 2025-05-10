import '../scss/sign-up.scss';

import topNavbar from './modules/global/topNavbar';
import botNavbar from './modules/global/botNavbar';
import { signUpForm } from './modules/signUp/signUpForm';
import { verificationForm } from './modules/signUp/verificationForm';
import { disableBackForwardCache } from './modules/global/disableBackForwardCache';

disableBackForwardCache();

topNavbar();
botNavbar();

await verificationForm();
signUpForm();