import cron from 'node-cron';
import * as accountCronJobs from './accountCronJobs';
import * as hangoutCronJobs from './hangoutCronJobs';
import { cleanHangoutClients } from '../webSockets/hangout/cleanHangoutClients';

export function initCronJobs(): void {
  // every minute
  cron.schedule('* * * * *', async () => {
    cleanHangoutClients();

    await accountCronJobs.removeUnverifiedAccounts();
    await accountCronJobs.removeExpiredRecoveryRequests();
    await accountCronJobs.removeExpiredEmailUpdateRequests();
    await hangoutCronJobs.progressHangouts();
    await hangoutCronJobs.concludeNoSuggestionHangouts();
  });

  // every hour
  cron.schedule('0 * * * *', async () => {
    await accountCronJobs.deleteMarkedAccounts();
    await hangoutCronJobs.deleteNoMemberHangouts();
    await hangoutCronJobs.archiveHangouts();
  });

  console.log('CRON jobs started.');
};