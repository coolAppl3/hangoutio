import '../scss/create-hangout.scss';

import topNavbar from './modules/global/topNavbar';
import botNavbar from './modules/global/botNavbar';
import { hangoutFormNavigation } from './modules/createHangout/hangoutFormNavigation';
import { hangoutFormFirstStep } from './modules/createHangout/hangoutFormFirstStep';
import { hangoutFormSecondStep } from './modules/createHangout/hangoutFormSecondStep';
import { hangoutFormThirdStep } from './modules/createHangout/hangoutFormThirdStep';
import { disableBackForwardCache } from './modules/global/disableBackForwardCache';

disableBackForwardCache();

topNavbar();
botNavbar();

hangoutFormNavigation();
hangoutFormFirstStep();
hangoutFormSecondStep();
hangoutFormThirdStep();