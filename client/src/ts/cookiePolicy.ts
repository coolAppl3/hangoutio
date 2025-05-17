import '../scss/terms-of-service.scss';

import topNavbar from './modules/global/topNavbar';
import botNavbar from './modules/global/botNavbar';
import { disableBackForwardCache } from './modules/global/disableBackForwardCache';

disableBackForwardCache();

topNavbar();
botNavbar();