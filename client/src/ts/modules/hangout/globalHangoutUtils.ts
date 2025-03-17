import popup from "../global/popup";
import { globalHangoutState } from "./globalHangoutState";

export function calculateHangoutConclusionTimestamp(): number | null {
  if (!globalHangoutState.data) {
    return null;
  };

  const { created_on_timestamp, availability_period, suggestions_period, voting_period } = globalHangoutState.data.hangoutDetails;
  const hangoutConclusionTimestamp: number = created_on_timestamp + availability_period + suggestions_period + voting_period;

  return hangoutConclusionTimestamp;
};


export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    popup('Copied to clipboard.', 'success');

  } catch (err: unknown) {
    console.log(err);
    popup('Failed to copy to clipboard.', 'error');
  };
};