import { handleAuthSessionExpired } from "../global/authUtils";
import { AsyncErrorData, getAsyncErrorData } from "../global/errorUtils";
import popup from "../global/popup";
import { getAccountInfoService } from "../services/accountServices";
import { initAccountDetails } from "./accountDetails";
import { initAccountFriends } from "./accountFriends";
import { initHangoutInvites } from "./accountHangoutInvites";
import { initAccountHangouts } from "./accountHangouts";
import { AccountDetails, Friend, FriendRequest, Hangout, HangoutInvite } from "./accountTypes";
import { removeLoadingSkeleton } from "./accountUtils";

interface Account {
  data: null | {
    accountDetails: AccountDetails,
    friends: Friend[],
    friendRequests: FriendRequest[],
    hangoutHistory: Hangout[],
    hangoutInvites: HangoutInvite[],

    hangoutsJoinedCount: number,
    ongoingHangoutsCount: number,
  },
};

export const accountState: Account = {
  data: null,
};

export async function initAccount(): Promise<void> {
  await getAccountInfo();
};

async function getAccountInfo(): Promise<void> {
  try {
    const { accountDetails, friends, friendRequests, hangoutHistory, hangoutInvites, hangoutsJoinedCount, ongoingHangoutsCount } = (await getAccountInfoService()).data;

    accountState.data = {
      accountDetails,
      friends,
      friendRequests,
      hangoutHistory,
      hangoutInvites,

      hangoutsJoinedCount,
      ongoingHangoutsCount,
    };

    initAccountDetails();
    initAccountFriends();
    initAccountHangouts();
    initHangoutInvites();

    removeLoadingSkeleton();

  } catch (err: unknown) {
    console.log(err);

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      popup('Failed to load account details.', 'error');
      return;
    };

    const { status, errMessage } = asyncErrorData;

    popup(errMessage, 'error');

    if (status === 401) {
      handleAuthSessionExpired();
    };
  };
};