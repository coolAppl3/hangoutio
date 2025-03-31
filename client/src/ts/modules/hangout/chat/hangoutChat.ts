import axios, { AxiosError } from "../../../../../node_modules/axios/index";
import { handleAuthSessionExpired } from "../../global/authUtils";
import { HANGOUT_CHAT_FETCH_CHUNK_SIZE } from "../../global/clientConstants";
import { getTime } from "../../global/dateTimeUtils";
import { createDivElement, createParagraphElement, createSpanElement } from "../../global/domUtils";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { getHangoutMessagesService } from "../../services/chatServices";
import { globalHangoutState } from "../globalHangoutState";
import { ChatMessage } from "../hangoutTypes";

interface HangoutChatState {
  isLoaded: boolean,
  oldestMessageLoaded: boolean,

  messageOffset: number,
  fetchChunkSize: number,

  messages: ChatMessage[],
};

const hangoutChatState: HangoutChatState = {
  isLoaded: false,
  oldestMessageLoaded: false,

  messageOffset: 0,
  fetchChunkSize: HANGOUT_CHAT_FETCH_CHUNK_SIZE,

  messages: [],
};

const chatContainer: HTMLDivElement | null = document.querySelector('#chat-container');

const chatTextarea: HTMLTextAreaElement | null = document.querySelector('#chat-textarea');
const hangoutPhoneNavBtn: HTMLButtonElement | null = document.querySelector('#hangout-phone-nav-btn');

export function hangoutChat(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-chat', initHangoutChat);


  chatTextarea?.addEventListener('focus', () => hideHangoutPhoneNav(true));
  chatTextarea?.addEventListener('blur', () => hideHangoutPhoneNav(false));
};

async function initHangoutChat(): Promise<void> {
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
  const fragment: DocumentFragment = new DocumentFragment();

  for (const message of messages) {
    const isSameSender: boolean = message.hangout_member_id === senderMemberId;
    const isUser: boolean = message.hangout_member_id === globalHangoutState.data?.hangoutMemberId;

    fragment.appendChild(createMessageElement(message, isSameSender, isUser));

    if (!isSameSender) {
      senderMemberId = message.hangout_member_id;
    };
  };

  chatContainer.insertBefore(fragment, chatContainer.firstElementChild);
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

function hideHangoutPhoneNav(hide: boolean): void {
  if (!hide) {
    hangoutPhoneNavBtn?.classList.remove('hidden');
    return;
  };

  hangoutPhoneNavBtn?.classList.add('hidden');
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