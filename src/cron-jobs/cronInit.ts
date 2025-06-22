import cron from 'node-cron';
import * as accountCronJobs from './accountCronJobs';
import * as hangoutCronJobs from './hangoutCronJobs';
import { clearExpiredAuthSessions } from './authCronJobs';
import { deleteStaleGuestUsers } from './guestCronJobs';
import { removeEmptyHangoutWebSocketSets } from '../webSockets/hangout/hangoutWebSocketServer';
import { removeLightRateAbusers, removeStaleRateTrackerRows, replenishRateRequests } from './rateLimiterCronJobs';
import { minuteMilliseconds } from '../util/constants';
import { clearErrorLogs } from '../logs/loggerCronJobs';

export function initCronJobs(): void {
  // every 30 seconds
  setInterval(async () => {
    await replenishRateRequests();
  }, minuteMilliseconds / 2);

  // every minute
  cron.schedule('* * * * *', async () => {
    await hangoutCronJobs.progressHangouts();
    await hangoutCronJobs.concludeSingleSuggestionHangouts();
    await hangoutCronJobs.concludeNoSuggestionHangouts();

    await accountCronJobs.removeUnverifiedAccounts();
    await accountCronJobs.removeExpiredRecoveryRequests();
    await accountCronJobs.removeExpiredEmailUpdateRequests();
    await accountCronJobs.removeExpiredDeletionRequests();

    await removeStaleRateTrackerRows();

    removeEmptyHangoutWebSocketSets();
  });

  // every hour
  cron.schedule('0 * * * *', async () => {
    await clearExpiredAuthSessions();
    await hangoutCronJobs.deleteNoMemberHangouts();
  });

  // every day
  cron.schedule('0 0 * * *', async () => {
    await deleteStaleGuestUsers();
    await removeLightRateAbusers();
    await clearErrorLogs();
  });

  console.log('CRON jobs started.');
};