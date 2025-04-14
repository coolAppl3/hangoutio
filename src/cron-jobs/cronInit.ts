import cron from 'node-cron';
import * as accountCronJobs from './accountCronJobs';
import * as hangoutCronJobs from './hangoutCronJobs';
import { clearExpiredAuthSessions } from './authCronJobs';
import { deleteStaleGuestUsers } from './guestCronJobs';
import { removeEmptyHangoutWebSocketSets } from '../webSockets/hangout/hangoutWebSocketServer';

export function initCronJobs(): void {
  // every minute
  cron.schedule('* * * * *', async () => {
    await hangoutCronJobs.progressHangouts();
    await hangoutCronJobs.concludeSingleSuggestionHangouts();
    await hangoutCronJobs.concludeNoSuggestionHangouts();

    await accountCronJobs.removeUnverifiedAccounts();
    await accountCronJobs.removeExpiredRecoveryRequests();
    await accountCronJobs.removeExpiredEmailUpdateRequests();
    await accountCronJobs.removeExpiredDeletionRequests();

    removeEmptyHangoutWebSocketSets();
  });

  // every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    await clearExpiredAuthSessions();
  });

  // every hour
  cron.schedule('0 * * * *', async () => {
    await hangoutCronJobs.deleteNoMemberHangouts();
  });

  // every day
  cron.schedule('0 0 * * *', async () => {
    await deleteStaleGuestUsers();
  });

  console.log('CRON jobs started.');
};