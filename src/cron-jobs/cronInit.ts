import cron from 'node-cron';
import * as accountCronJobs from './accountCronJobs';
import * as hangoutCronJobs from './hangoutCronJobs';
import { cleanHangoutClients } from '../webSockets/hangout/cleanHangoutClients';
import { clearExpiredAuthSessions } from './authCronJobs';

export function initCronJobs(): void {
  // every minute
  cron.schedule('* * * * *', async () => {
    cleanHangoutClients();

    await hangoutCronJobs.progressHangouts();
    await hangoutCronJobs.concludeNoSuggestionHangouts();

    await accountCronJobs.removeUnverifiedAccounts();
    await accountCronJobs.removeExpiredRecoveryRequests();
    await accountCronJobs.removeExpiredEmailUpdateRequests();
    await accountCronJobs.removeExpiredDeletionRequests();
  });

  // every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    await clearExpiredAuthSessions();
  });

  // every hour
  cron.schedule('0 * * * *', async () => {
    await hangoutCronJobs.deleteNoMemberHangouts();
  });

  console.log('CRON jobs started.');
};