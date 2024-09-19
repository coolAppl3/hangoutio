import '../scss/main.scss';

import topNavbar from './modules/global/topNavbar';
import botNavbar from './modules/global/botNavbar';
import { formNavigation } from './modules/createHangout/formNavigation';
import { formFirstStep } from './modules/createHangout/formFirstStep';
import { formSecondStep } from './modules/createHangout/formSecondStep';
import { formThirdStep } from './modules/createHangout/formThirdStep';

// initializing imports
topNavbar();
botNavbar();
formNavigation();
formFirstStep();
formSecondStep();
formThirdStep();