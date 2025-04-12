import popup from "../global/popup";

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    popup('Copied to clipboard.', 'success');

  } catch (err: unknown) {
    console.log(err);
    popup('Failed to copy to clipboard.', 'error');
  };
};