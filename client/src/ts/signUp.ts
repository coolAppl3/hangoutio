import '../scss/sign-up.scss';

import topNavbar from './modules/global/topNavbar';
import botNavbar from './modules/global/botNavbar';
import { signUpForm } from './modules/signUp/signUpForm';
import { verificationForm } from './modules/signUp/verificationForm';

topNavbar();
botNavbar();

verificationForm();
signUpForm();