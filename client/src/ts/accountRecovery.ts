import '../scss/main.scss';

import topNavbar from './modules/global/topNavbar';
import botNavbar from './modules/global/botNavbar';
import { recoveryEmailForm } from './modules/accountRecovery/recoveryEmailForm';
import { recoveryConfirmationForm } from './modules/accountRecovery/recoveryConfirmationForm';
import { passwordUpdateForm } from './modules/accountRecovery/passwordUpdateForm';

// initializing imports
topNavbar();
botNavbar();

recoveryEmailForm();
recoveryConfirmationForm();
passwordUpdateForm();