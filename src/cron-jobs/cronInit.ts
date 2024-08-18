import cron from 'node-cron';
import * as accountCronJobs from './accountCronJobs';
import * as hangoutCronJobs from './hangoutCronJobs';

export function initCronJobs(): void {
  // every minute
  cron.schedule('* * * * *', async () => {
    await accountCronJobs.removeUnverifiedAccounts();
    await accountCronJobs.removeExpiredRecoveryRequests();
    await accountCronJobs.removeExpiredEmailUpdateRequests();
    await hangoutCronJobs.progressHangouts();
  });

  // every hour
  cron.schedule('0 * * * *', async () => {
    await accountCronJobs.deleteMarkedAccounts();
  });
};