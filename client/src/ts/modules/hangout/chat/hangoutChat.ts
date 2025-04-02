import axios, { AxiosError } from "../../../../../node_modules/axios/index";
import { handleAuthSessionDestroyed, handleAuthSessionExpired } from "../../global/authUtils";
import { dayMilliseconds, HANGOUT_CHAT_FETCH_CHUNK_SIZE } from "../../global/clientConstants";
import { getDateAndTimeString, getTime } from "../../global/dateTimeUtils";
import { createDivElement, createParagraphElement, createSpanElement } from "../../global/domUtils";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { getHangoutMessagesService, sendHangoutMessageService } from "../../services/chatServices";
import { globalHangoutState } from "../globalHangoutState";
import { ChatMessage } from "../hangoutTypes";

interface HangoutChatState {
  isLoaded: boolean,
  oldestMessageLoaded: boolean,
  chatSectionMutationObserverActive: boolean,

  messageOffset: number,
  fetchChunkSize: number,

  messages: ChatMessage[],
};

const hangoutChatState: HangoutChatState = {
  isLoaded: false,
  oldestMessageLoaded: false,
  chatSectionMutationObserverActive: false,

  messageOffset: 0,
  fetchChunkSize: HANGOUT_CHAT_FETCH_CHUNK_SIZE,

  messages: [],
};

const chatSection: HTMLElement | null = document.querySelector('#chat-section');
const chatContainer: HTMLDivElement | null = document.querySelector('#chat-container');
const hangoutPhoneNavBtn: HTMLButtonElement | null = document.querySelector('#hangout-phone-nav-btn');

const chatForm: HTMLFormElement | null = document.querySelector('#chat-form');
const chatTextarea: HTMLTextAreaElement | null = document.querySelector('#chat-textarea');
const chatErrorSpan: HTMLSpanElement | null = document.querySelector('#chat-error-span');

export function hangoutChat(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-chat', initHangoutChat);
  chatForm?.addEventListener('submit', sendHangoutMessage);

  chatTextarea?.addEventListener('keydown', handleChatTextareaKeydownEvents);
  chatTextarea?.addEventListener('input', () => {
    autoExpandChatTextarea();
    validateChatMessage();
  });
};

async function initHangoutChat(): Promise<void> {
  scrollChatToBottom();

  if (navigator.maxTouchPoints === 0) {
    chatTextarea?.focus();
  };

  if (!hangoutChatState.chatSectionMutationObserverActive) {
    initChatSectionMutationObserver();
  };

  if (hangoutChatState.isLoaded) {
    return;
  };

  await getHangoutMessages();
};

function insertChatMessages(messages: ChatMessage[]): void {
  if (!chatContainer) {
    return;
  };

  if (hangoutChatState.messages.length === 0) {
    return;
  };

  if (hangoutChatState.messages[0]?.hangout_member_id === messages[messages.length - 1]?.hangout_member_id) {
    chatContainer.firstElementChild?.querySelector('.message-sent-by')?.remove();
  };

  let senderMemberId: number = 0;
  let lastMessageTimestamp: number = messages[0]!.message_timestamp; // guaranteed not undefined

  const fragment: DocumentFragment = new DocumentFragment();
  fragment.appendChild(createDateStampElement(lastMessageTimestamp));

  for (const message of messages) {
    const isSameSender: boolean = message.hangout_member_id === senderMemberId;
    const isUser: boolean = message.hangout_member_id === globalHangoutState.data?.hangoutMemberId;

    const notInSameDay: boolean = Math.abs(lastMessageTimestamp - message.message_timestamp) > dayMilliseconds || new Date(lastMessageTimestamp).getDate() !== new Date(message.message_timestamp).getDate();

    if (notInSameDay) {
      fragment.appendChild(createDateStampElement(message.message_timestamp));
    };

    fragment.appendChild(createMessageElement(message, isSameSender, isUser));
    lastMessageTimestamp = message.message_timestamp;

    if (!isSameSender) {
      senderMemberId = message.hangout_member_id;
    };
  };

  chatContainer.insertBefore(fragment, chatContainer.firstElementChild);

  scrollChatToBottom();
  removeNoMessagesElement();
};

function insertSingleChatMessage(message: ChatMessage): void {
  const messages: ChatMessage[] = hangoutChatState.messages;
  const isSameSender: boolean = messages[messages.length - 1]?.hangout_member_id === globalHangoutState.data?.hangoutMemberId;

  if (messages.length === 1) {
    chatContainer?.appendChild(createDateStampElement(message.message_timestamp));

  } else {
    // length - 2 since the message passed in is now at the last index based on where this function is called
    let lastMessageTimestamp: number | undefined = messages[messages.length - 2]?.message_timestamp;

    if (lastMessageTimestamp) {
      const notInSameDay: boolean = Math.abs(lastMessageTimestamp - message.message_timestamp) > dayMilliseconds || new Date(lastMessageTimestamp).getDate() !== new Date(message.message_timestamp).getDate();

      notInSameDay && chatContainer?.appendChild(createDateStampElement(message.message_timestamp));
    };
  };

  const chatElement: HTMLDivElement = createMessageElement(message, isSameSender, true);
  chatContainer?.appendChild(chatElement);

  scrollChatToBottom();
  removeNoMessagesElement();
};

async function getHangoutMessages(): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data) {
    popup('Failed to load hangout chat.', 'error');
    LoadingModal.remove();

    return;
  };

  if (hangoutChatState.oldestMessageLoaded) {
    popup('All messages loaded.', 'success');
    LoadingModal.remove();

    return;
  };

  const { hangoutId, hangoutMemberId } = globalHangoutState.data;

  try {
    const messages: ChatMessage[] = (await getHangoutMessagesService(hangoutId, hangoutMemberId, hangoutChatState.messageOffset)).data;

    hangoutChatState.messages = [...messages, ...hangoutChatState.messages];
    hangoutChatState.messageOffset += hangoutChatState.fetchChunkSize;
    hangoutChatState.isLoaded = true;

    if (messages.length < hangoutChatState.fetchChunkSize) {
      hangoutChatState.oldestMessageLoaded = true;
    };

    if (messages.length === 0) {
      chatContainer?.appendChild(createParagraphElement('no-messages', 'No messages found'));
    };

    insertChatMessages(messages);
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Something went wrong.', 'error');
      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;

    if (status === 400) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 401) {
      handleAuthSessionExpired();
      return;
    };

    if (status === 404) {
      LoadingModal.display();
      setTimeout(() => window.location.reload(), 1000);
    };
  };
};

async function sendHangoutMessage(e: SubmitEvent): Promise<void> {
  e.preventDefault();

  if (!globalHangoutState.data || !chatTextarea) {
    popup('Failed to send message.', 'error');
    return;
  };

  const isValidMessage: boolean = validateChatMessage();
  if (!isValidMessage) {
    return;
  };

  const messageContent: string = chatTextarea.value.trim();
  const { hangoutMemberId, hangoutId } = globalHangoutState.data;

  try {
    const sentMessage: ChatMessage = (await sendHangoutMessageService({ hangoutMemberId, hangoutId, messageContent })).data;

    hangoutChatState.messages.push(sentMessage);
    insertSingleChatMessage(sentMessage);

    chatTextarea.value = '';
    autoExpandChatTextarea();
    scrollChatToBottom();

  } catch (err: unknown) {
    console.log(err);

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Something went wrong.', 'error');
      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    if (status === 400 && !errReason) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 404) {
      LoadingModal.display();
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    if (status === 401) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      handleAuthSessionDestroyed();
    };
  };
};

async function handleChatTextareaKeydownEvents(e: KeyboardEvent): Promise<void> {
  if (navigator.maxTouchPoints > 0) {
    return;
  };

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    e.stopImmediatePropagation();

    await sendHangoutMessage(new SubmitEvent('submit'));
  };
};

function validateChatMessage(): boolean {
  if (!chatTextarea || !chatErrorSpan) {
    return false;
  };

  const message: string = chatTextarea.value;

  if (message.length > 2000) {
    chatErrorSpan.textContent = `Message can't exceed 500 characters.`;
    chatErrorSpan.classList.remove('hidden');

    return false;
  };

  if (message.trim() === '') {
    chatErrorSpan.textContent = '';
    chatErrorSpan.classList.add('hidden');

    return false;
  };

  const messageRegex: RegExp = /^[ -~\r\n]{1,2000}$/;
  if (!messageRegex.test(message)) {
    chatErrorSpan.textContent = 'Only English letters, numbers, and common symbols are allowed.';
    chatErrorSpan.classList.remove('hidden');

    return false;
  };

  chatErrorSpan.textContent = '';
  chatErrorSpan.classList.add('hidden');

  return true;
};

function autoExpandChatTextarea(): void {
  if (!chatTextarea) {
    return;
  };

  const minHeight: number = 42;
  const heightLimit: number = 200;

  chatTextarea.style.height = '0px';
  const newHeight: number = Math.min(heightLimit, chatTextarea.scrollHeight);

  if (newHeight < minHeight) {
    chatTextarea.style.height = `${minHeight}px`;
    return;
  };

  chatTextarea.style.height = `${newHeight}px`;
};

function initChatSectionMutationObserver(): void {
  if (!chatSection) {
    return;
  };

  const mutationObserver: MutationObserver = new MutationObserver((mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class' && chatSection.classList.contains('hidden')) {
        repositionHangoutNavBtn(false);
        hangoutChatState.chatSectionMutationObserverActive = false;

        mutationObserver.disconnect();
        return;
      };
    };
  });

  mutationObserver.observe(chatSection, { attributes: true, attributeFilter: ['class'] });
  hangoutChatState.chatSectionMutationObserverActive = true;

  repositionHangoutNavBtn(true);
};

function repositionHangoutNavBtn(nudgeUp: boolean): void {
  if (!nudgeUp) {
    hangoutPhoneNavBtn?.classList.remove('nudge-up');
    return;
  };

  hangoutPhoneNavBtn?.classList.add('nudge-up');
};

function scrollChatToBottom(): void {
  chatContainer?.scrollTo(0, chatContainer.scrollHeight);
};

function removeNoMessagesElement(): void {
  chatContainer?.querySelector('.no-messages')?.remove();
};

function createMessageElement(message: ChatMessage, isSameSender: boolean, isUser: boolean): HTMLDivElement {
  const messageElement: HTMLDivElement = createDivElement('message');

  if (!isSameSender) {
    messageElement.classList.add('new-sender');

    if (!isUser) {
      const senderDisplayName: string | undefined = globalHangoutState.data?.hangoutMembersMap.get(message.hangout_member_id);
      messageElement.appendChild(createSpanElement('message-sent-by', senderDisplayName || 'Former member'));
    };
  };

  if (isUser) {
    messageElement.classList.add('sent-by-user');
  };

  const messageContainer: HTMLDivElement = createDivElement('message-container');
  messageContainer.appendChild(createParagraphElement('message-container-content', message.message_content));
  messageContainer.appendChild(createSpanElement('message-container-time', getTime(new Date(message.message_timestamp))));

  messageElement.appendChild(messageContainer);


  return messageElement;
};

function createDateStampElement(timestamp: number): HTMLSpanElement {
  const dateStampElement: HTMLSpanElement = createSpanElement('date-stamp', getDateAndTimeString(timestamp, true));
  return dateStampElement;
};