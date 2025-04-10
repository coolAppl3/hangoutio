import axios, { AxiosError } from "../../../../../node_modules/axios/index";
import { handleAuthSessionDestroyed, handleAuthSessionExpired } from "../../global/authUtils";
import { dayMilliseconds, HANGOUT_CHAT_FETCH_BATCH_SIZE } from "../../global/clientConstants";
import { getDateAndTimeString, getTime } from "../../global/dateTimeUtils";
import { debounce } from "../../global/debounce";
import { createDivElement, createParagraphElement, createSpanElement } from "../../global/domUtils";
import { AsyncErrorData, getAsyncErrorData } from "../../global/errorUtils";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { getHangoutMessagesService, sendHangoutMessageService } from "../../services/chatServices";
import { hangoutDashboardState } from "../dashboard/hangoutDashboard";
import { globalHangoutState } from "../globalHangoutState";
import { ChatMessage } from "../hangoutTypes";

interface HangoutChatState {
  isLoaded: boolean,
  oldestMessageLoaded: boolean,
  chatSectionMutationObserverActive: boolean,

  messageOffset: number,
  fetchBatchSize: number,
  latestChatContainerScrollTop: number,

  messages: ChatMessage[],
};

export const hangoutChatState: HangoutChatState = {
  isLoaded: false,
  oldestMessageLoaded: false,
  chatSectionMutationObserverActive: false,

  messageOffset: 0,
  fetchBatchSize: HANGOUT_CHAT_FETCH_BATCH_SIZE,
  latestChatContainerScrollTop: 0,

  messages: [],
};

const chatSection: HTMLElement | null = document.querySelector('#chat-section');
const chatElement: HTMLDivElement | null = document.querySelector('#chat');
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
  chatContainer?.addEventListener('scroll', debounceLoadOlderMessages);

  chatTextarea?.addEventListener('keydown', handleChatTextareaKeydownEvents);
  chatTextarea?.addEventListener('input', () => {
    autoExpandChatTextarea();
    validateChatMessage();
  });
};

async function initHangoutChat(): Promise<void> {
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

  scrollChatToBottom();
  hangoutChatState.latestChatContainerScrollTop = chatContainer?.scrollTop || 0;
};

function insertChatMessages(messages: ChatMessage[]): void {
  if (!globalHangoutState.data || !chatContainer) {
    return;
  };

  if (messages.length === 0) {
    return;
  };

  if (messages[messages.length - 1]?.hangout_member_id === hangoutChatState.messages[messages.length]?.hangout_member_id) {
    const firstMessage: HTMLDivElement | null = chatContainer.querySelector('.message');

    firstMessage?.classList.remove('new-sender');
    firstMessage?.querySelector('.message-sent-by')?.remove();
  };

  const fragment: DocumentFragment = new DocumentFragment();
  const hangoutMemberId: number = globalHangoutState.data.hangoutMemberId;

  for (let i = 0; i < messages.length; i++) {
    const message: ChatMessage | undefined = messages[i];
    const previousMessage: ChatMessage | undefined = messages[i - 1];

    if (!message) {
      break;
    };

    const isSameSender: boolean = message.hangout_member_id === previousMessage?.hangout_member_id;
    const isUser: boolean = message.hangout_member_id === hangoutMemberId;

    if (i === 0 || (previousMessage && !messageIsInSameDay(message.message_timestamp, previousMessage.message_timestamp))) {
      fragment.appendChild(createMessageDateStampElement(message.message_timestamp));
    };

    fragment.appendChild(createMessageElement(message, isSameSender, isUser));

    if (i < messages.length - 1) {
      continue;
    };

    const previousOldestMessage: ChatMessage | undefined = hangoutChatState.messages[messages.length];
    if (previousOldestMessage && messageIsInSameDay(message.message_timestamp, previousOldestMessage.message_timestamp)) {
      chatContainer.querySelector('.date-stamp')?.remove();
    };
  };

  chatContainer.insertBefore(fragment, chatContainer.firstElementChild);
  removeNoMessagesElement();
};

export function insertSingleChatMessage(message: ChatMessage, isUser: boolean): void {
  const messages: ChatMessage[] = hangoutChatState.messages;

  // length - 2 since the message passed in is now at the last index based on where this function is called
  const isSameSender: boolean = messages[messages.length - 2]?.hangout_member_id === message.hangout_member_id;
  const lastMessageTimestamp: number | undefined = messages[messages.length - 2]?.message_timestamp;

  if (messages.length === 1) {
    chatContainer?.appendChild(createMessageDateStampElement(message.message_timestamp));

  } else if (lastMessageTimestamp && !messageIsInSameDay(lastMessageTimestamp, message.message_timestamp)) {
    chatContainer?.appendChild(createMessageDateStampElement(message.message_timestamp));
  };

  chatContainer?.appendChild(createMessageElement(message, isSameSender, isUser));
  removeNoMessagesElement();

  hangoutDashboardState.latestChatMessages.push(message);

  if (hangoutDashboardState.latestChatMessages.length > 2) {
    hangoutDashboardState.latestChatMessages.shift();
  };
};

async function getHangoutMessages(): Promise<void> {
  chatElement?.classList.add('loading');

  if (!globalHangoutState.data) {
    popup('Failed to load hangout chat.', 'error');
    chatElement?.classList.remove('loading');

    return;
  };

  const { hangoutId, hangoutMemberId } = globalHangoutState.data;

  try {
    const messages: ChatMessage[] = (await getHangoutMessagesService(hangoutId, hangoutMemberId, hangoutChatState.messageOffset)).data;

    hangoutChatState.messages = [...messages, ...hangoutChatState.messages];
    hangoutChatState.messageOffset += hangoutChatState.fetchBatchSize;
    hangoutChatState.isLoaded = true;

    if (messages.length < hangoutChatState.fetchBatchSize && hangoutChatState.messages.length !== 0) {
      hangoutChatState.oldestMessageLoaded = true;
      popup('All messages loaded.', 'success');
    };

    if (messages.length === 0 && hangoutChatState.messageOffset === hangoutChatState.fetchBatchSize) { // initial fetch
      chatContainer?.appendChild(createParagraphElement('no-messages', 'No messages found'));
    };

    insertChatMessages(messages);
    chatElement?.classList.remove('loading');

  } catch (err: unknown) {
    console.log(err);
    chatElement?.classList.remove('loading');

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      popup('Something went wrong.', 'error');
      return;
    };

    const { status, errMessage } = asyncErrorData;

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

    insertSingleChatMessage(sentMessage, true);
    scrollChatToBottom();

    chatTextarea.value = '';
    autoExpandChatTextarea();

  } catch (err: unknown) {
    console.log(err);

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      popup('Something went wrong.', 'error');
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

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

const debounceLoadOlderMessages = debounce(loadOlderMessages, 300);

async function loadOlderMessages(): Promise<void> {
  if (!chatContainer) {
    return;
  };

  if (hangoutChatState.oldestMessageLoaded) {
    return;
  };

  const initialScrollHeight: number = chatContainer.scrollHeight;
  const initialScrollTop: number = chatContainer.scrollTop;

  const isScrollingUp: boolean = initialScrollTop < hangoutChatState.latestChatContainerScrollTop;
  if (!isScrollingUp) {
    hangoutChatState.latestChatContainerScrollTop = initialScrollTop;
    return;
  };

  hangoutChatState.latestChatContainerScrollTop = initialScrollTop;

  if (initialScrollTop > chatContainer.scrollHeight / 10) {
    return;
  };

  await getHangoutMessages();

  chatContainer.scrollTop = chatContainer.scrollHeight - initialScrollHeight + initialScrollTop;
  hangoutChatState.latestChatContainerScrollTop = chatContainer.scrollTop;
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

function messageIsInSameDay(firstTimestamp: number, secondTimestamp: number): boolean {
  if (Math.abs(firstTimestamp - secondTimestamp) > dayMilliseconds) {
    return false;
  };

  if (new Date(firstTimestamp).getDate() !== new Date(secondTimestamp).getDate()) {
    return false;
  };

  return true;
};

export function createMessageElement(message: ChatMessage, isSameSender: boolean, isUser: boolean): HTMLDivElement {
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

export function createMessageDateStampElement(timestamp: number): HTMLSpanElement {
  const dateStampElement: HTMLSpanElement = createSpanElement('date-stamp', getDateAndTimeString(timestamp, true));
  return dateStampElement;
};