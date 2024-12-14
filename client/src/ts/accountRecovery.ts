import '../scss/account-recovery.scss';

import topNavbar from './modules/global/topNavbar';
import botNavbar from './modules/global/botNavbar';
import { recoveryEmailForm } from './modules/accountRecovery/recoveryEmailForm';
import { recoveryPasswordUpdateForm } from './modules/accountRecovery/recoveryPasswordUpdateForm';

// initializing imports
topNavbar();
botNavbar();

recoveryEmailForm();
recoveryPasswordUpdateForm();