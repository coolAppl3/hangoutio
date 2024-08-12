import cron from 'node-cron';
import * as accountCronJobs from './accountCronJobs';

export function initCronJobs(): void {
  // every minute
  cron.schedule('* * * * *', async () => {
    await accountCronJobs.removeUnverifiedAccounts();
    await accountCronJobs.removeExpiredRecoveryRequests();
    await accountCronJobs.removeExpiredEmailUpdateRequests();
  });

  // every hour
  cron.schedule('0 * * * *', async () => {
    await accountCronJobs.deleteMarkedAccounts();
  });

  // every day
  cron.schedule('0 0 * * *', async () => {
    // to be added
  });
};

