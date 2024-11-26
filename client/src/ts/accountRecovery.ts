import '../scss/main.scss';
import '../scss/pages/account-recovery.scss';

import topNavbar from './modules/global/topNavbar';
import botNavbar from './modules/global/botNavbar';
import { recoveryEmailForm } from './modules/accountRecovery/recoveryEmailForm';
import { recoveryConfirmationForm } from './modules/accountRecovery/recoveryConfirmationForm';
import { recoveryPasswordUpdateForm } from './modules/accountRecovery/recoveryPasswordUpdateForm';

// initializing imports
topNavbar();
botNavbar();

recoveryEmailForm();
recoveryConfirmationForm();
recoveryPasswordUpdateForm();