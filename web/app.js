import {
  createEncryptedPrivateCapsule,
  createMessagingIdentity,
  createTonConnectOwnershipPayload,
  createVaultMessagingKeyDraft,
  exportSignedPublicKeyBundle,
  runPlathoCryptoSelfTest,
  verifySignedPublicKeyBundle,
  verifyTonConnectWalletOwnershipProof,
} from './crypto/platho-crypto.mjs';
import { resolveTonWalletPublicKeyFromStateInit } from './crypto/ton-wallet-stateinit.mjs';
import { createIndexedDbReplayStore, createMemoryReplayStore } from './replay-store.mjs';
import {
  createIndexedDbEncryptedMessageHistoryStore,
  createMemoryEncryptedMessageHistoryStore,
} from './encrypted-message-store.mjs';
import {
  VaultChainProviderUnavailableError,
  bindVaultRecordFromChain,
} from './vault-chain-provider.mjs';
import { PLATHO_APP_CONFIG } from './platho-config.mjs';
import {
  PLATHO_TRANSPORT_KIND,
  createPrivateCapsuleTransportPackage,
  createPublicBundleTransportPackage,
  openPrivateCapsuleTransportPackage,
  readPublicBundleTransportPackage,
  serializeTransportPackage,
} from './no-backend-transport.mjs';
import {
  canRenderTransportQr,
  createTransportQrSvg,
  createTransportSharePayload,
  parseTransportShareText,
} from './transport-share.mjs';

const appConfig = PLATHO_APP_CONFIG;
const threads = (appConfig.preview?.threads ?? []).map((thread) => ({
  ...thread,
  messages: (thread.messages ?? []).map((message) => ({ ...message })),
}));

const appShell = document.querySelector('.app-shell');
const railItems = [...document.querySelectorAll('.rail-item')];
const panels = [...document.querySelectorAll('.view-panel')];
const threadList = document.querySelector('#threadList');
const messageStrip = document.querySelector('#messageStrip');
const activeAvatar = document.querySelector('#activeAvatar');
const activeTitle = document.querySelector('#activeTitle');
const activeSubtitle = document.querySelector('#activeSubtitle');
const search = document.querySelector('#threadSearch');
const composer = document.querySelector('#composer');
const messageInput = document.querySelector('#messageInput');
const encryptionStatus = document.querySelector('#encryptionStatus');
const keySuiteStatus = document.querySelector('#keySuiteStatus');
const keyAuthStatus = document.querySelector('#keyAuthStatus');
const vaultDraftStatus = document.querySelector('#vaultDraftStatus');
const capsulePolicyStatus = document.querySelector('#capsulePolicyStatus');
const tonConnectStatus = document.querySelector('#tonConnectStatus');
const walletProofStatus = document.querySelector('#walletProofStatus');
const walletKeyStatus = document.querySelector('#walletKeyStatus');
const vaultRecordStatus = document.querySelector('#vaultRecordStatus');
const replayStoreStatus = document.querySelector('#replayStoreStatus');
const brandNetworkLabel = document.querySelector('#brandNetworkLabel');
const chatCountLabel = document.querySelector('#chatCountLabel');
const publicSubtitle = document.querySelector('#publicSubtitle');
const publicFeed = document.querySelector('#publicFeed');
const vaultSubtitle = document.querySelector('#vaultSubtitle');
const balanceGrid = document.querySelector('#balanceGrid');
const actionGrid = document.querySelector('#actionGrid');
const ledgerRows = document.querySelector('#ledgerRows');
const profileHandle = document.querySelector('#profileHandle');
const identityName = document.querySelector('#identityName');
const identitySubtitle = document.querySelector('#identitySubtitle');
const walletRuntimeLabel = document.querySelector('#walletRuntimeLabel');
const localStateLabel = document.querySelector('#localStateLabel');
const networkRuntimeLabel = document.querySelector('#networkRuntimeLabel');
const transportStatus = document.querySelector('#transportStatus');
const exportKeyBundleButton = document.querySelector('#exportKeyBundleButton');
const showKeyQrButton = document.querySelector('#showKeyQrButton');
const copyKeyBundleButton = document.querySelector('#copyKeyBundleButton');
const importTransportButton = document.querySelector('#importTransportButton');
const exportCapsuleButton = document.querySelector('#exportCapsuleButton');
const shareCapsuleButton = document.querySelector('#shareCapsuleButton');
const transportFileInput = document.querySelector('#transportFileInput');
const transportPeerStatus = document.querySelector('#transportPeerStatus');
const transportOutboxStatus = document.querySelector('#transportOutboxStatus');
const transportInboxStatus = document.querySelector('#transportInboxStatus');
const transportLastStatus = document.querySelector('#transportLastStatus');
const transportQrOutput = document.querySelector('#transportQrOutput');
const transportPackageText = document.querySelector('#transportPackageText');
const copyTransportTextButton = document.querySelector('#copyTransportTextButton');
const importTransportTextButton = document.querySelector('#importTransportTextButton');
const shareTransportTextButton = document.querySelector('#shareTransportTextButton');

let activeThreadId = threads[0].id;
let localIdentity = null;
let localRecipientKeyPair = null;
let localRecipientPublicBundle = null;
let localSignedPublicBundle = null;
let localVaultDraft = null;
let localReplayStore = createMemoryReplayStore();
let encryptedMessageStore = null;
let tonConnectUI = null;
let tonConnectExpectedDomain = null;
let pendingTonConnectWallet = null;
let tonProofPayloadTimer = null;
let vaultProviderLoadPromise = null;
let peerSignedPublicBundle = null;
let peerPublicBundle = null;
let lastCapsuleTransportPackage = null;
let transportState = { peers: [], outbox: [], inbox: [] };
let visibleTransportPackage = null;

const TRANSPORT_STATE_KEY = 'platho.transport.v1';
const TRANSPORT_MAX_ITEMS = 20;

function setText(node, value) {
  if (node) node.textContent = value ?? '';
}

function appendIcon(parent, icon) {
  const span = document.createElement('span');
  span.className = `icon icon-${icon}`;
  parent.append(span);
}

function renderPublicFeed(items) {
  if (!publicFeed) return;
  publicFeed.replaceChildren();
  for (const item of items ?? []) {
    const article = document.createElement('article');
    article.className = `feed-item${item.compact ? ' compact' : ''}`;
    const meta = document.createElement('div');
    meta.className = 'feed-meta';
    for (const label of item.meta ?? []) {
      const span = document.createElement('span');
      span.textContent = label;
      meta.append(span);
    }
    article.append(meta);
    if (item.title) {
      const title = document.createElement('h2');
      title.textContent = item.title;
      article.append(title);
    }
    const text = document.createElement('p');
    text.textContent = item.text ?? '';
    article.append(text);
    publicFeed.append(article);
  }
}

function renderVaultCards(cards) {
  if (!balanceGrid) return;
  balanceGrid.replaceChildren();
  for (const card of cards ?? []) {
    const article = document.createElement('article');
    article.className = `balance-card${card.tone ? ` ${card.tone}` : ''}`;
    const label = document.createElement('span');
    label.textContent = card.label ?? '';
    const value = document.createElement('strong');
    value.textContent = card.value ?? '';
    const caption = document.createElement('small');
    caption.textContent = card.caption ?? '';
    article.append(label, value, caption);
    balanceGrid.append(article);
  }
}

function renderVaultActions(actions) {
  if (!actionGrid) return;
  actionGrid.replaceChildren();
  for (const action of actions ?? []) {
    const button = document.createElement('button');
    button.type = 'button';
    appendIcon(button, action.icon ?? 'bolt');
    button.append(document.createTextNode(action.label ?? ''));
    actionGrid.append(button);
  }
}

function renderLedgerRows(rows) {
  if (!ledgerRows) return;
  ledgerRows.replaceChildren();
  for (const row of rows ?? []) {
    const item = document.createElement('div');
    item.className = 'ledger-row';
    const icon = document.createElement('span');
    icon.className = `ledger-icon ${row.tone ?? 'cyan'}`;
    const body = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = row.title ?? '';
    const detail = document.createElement('small');
    detail.textContent = row.detail ?? '';
    const value = document.createElement('span');
    value.textContent = row.value ?? '';
    body.append(title, detail);
    item.append(icon, body, value);
    ledgerRows.append(item);
  }
}

function renderConfiguredShell() {
  const ui = appConfig.ui ?? {};
  setText(brandNetworkLabel, ui.brandNetworkLabel ?? appConfig.network?.label ?? appConfig.mode);
  setText(chatCountLabel, ui.chatCountLabel);
  setText(publicSubtitle, ui.publicSubtitle);
  setText(vaultSubtitle, ui.vaultSubtitle);
  setText(profileHandle, ui.profileHandle);
  setText(identityName, ui.identityName);
  setText(identitySubtitle, ui.identitySubtitle);
  setText(walletRuntimeLabel, ui.walletLabel);
  setText(localStateLabel, ui.localStateLabel);
  setText(networkRuntimeLabel, ui.networkLabel ?? appConfig.network?.label);
  renderPublicFeed(ui.publicFeed);
  renderVaultCards(ui.vaultCards);
  renderVaultActions(ui.vaultActions);
  renderLedgerRows(ui.ledgerRows);
}

async function bootReplayStore() {
  try {
    localReplayStore = await createIndexedDbReplayStore();
    replayStoreStatus.textContent = 'device db';
  } catch {
    localReplayStore = createMemoryReplayStore();
    replayStoreStatus.textContent = 'memory';
  }
}

function historyStatusLabel() {
  if (!encryptedMessageStore) return 'history off';
  return encryptedMessageStore.type === 'indexeddb' ? 'encrypted db' : 'encrypted memory';
}

function serializeMessageForHistory(message) {
  return {
    type: message.type,
    text: message.text,
    meta: message.meta,
    capsule: message.capsule ?? null,
    transportPackage: message.transportPackage ?? null,
  };
}

function ensureHistoryThread(threadId) {
  let thread = threads.find((item) => item.id === threadId);
  if (thread) return thread;
  thread = {
    id: threadId,
    name: 'Imported',
    subtitle: 'local encrypted history',
    avatar: 'P',
    preview: 'encrypted local history',
    state: 'sealed',
    time: 'local',
    messages: [],
  };
  threads.push(thread);
  return thread;
}

async function persistMessageToEncryptedHistory(thread, message) {
  if (!encryptedMessageStore || message.localHistoryId) return null;
  try {
    const stored = await encryptedMessageStore.putMessage({
      threadId: thread.id,
      message: serializeMessageForHistory(message),
      createdAt: Date.now(),
    });
    message.localHistoryId = stored.id;
    setText(localStateLabel, historyStatusLabel());
    return stored;
  } catch (error) {
    setText(localStateLabel, 'history blocked');
    console.error(error);
    return null;
  }
}

async function restoreEncryptedMessageHistory() {
  if (!encryptedMessageStore) return;
  try {
    const restored = await encryptedMessageStore.listMessages();
    let changed = false;
    for (const item of restored) {
      const thread = ensureHistoryThread(item.threadId);
      if (thread.messages.some((message) => message.localHistoryId === item.id)) continue;
      const message = {
        ...item.message,
        localHistoryId: item.id,
      };
      thread.messages.push(message);
      thread.preview = message.text;
      thread.time = 'local';
      thread.state = message.capsule ? 'sealed' : 'local';
      changed = true;
    }
    setText(localStateLabel, restored.length > 0 ? `${historyStatusLabel()} ${restored.length}` : historyStatusLabel());
    if (changed) {
      renderThreads();
      renderConversation();
    }
  } catch (error) {
    setText(localStateLabel, 'history blocked');
    console.error(error);
  }
}

async function bootEncryptedMessageHistory() {
  try {
    encryptedMessageStore = await createIndexedDbEncryptedMessageHistoryStore();
  } catch (indexedDbError) {
    try {
      encryptedMessageStore = await createMemoryEncryptedMessageHistoryStore();
    } catch (memoryError) {
      encryptedMessageStore = null;
      setText(localStateLabel, 'history unavailable');
      console.error(indexedDbError);
      console.error(memoryError);
      return;
    }
  }
  await restoreEncryptedMessageHistory();
}

function shortKeyId(keyId) {
  const text = String(keyId ?? '');
  if (!text) return 'none';
  if (text.length <= 15) return text;
  return `${text.slice(0, 6)}...${text.slice(-6)}`;
}

function safeJsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeTransportList(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

function normalizeTransportState(value = {}) {
  return {
    peers: normalizeTransportList(value.peers),
    outbox: normalizeTransportList(value.outbox),
    inbox: normalizeTransportList(value.inbox),
  };
}

function readTransportState() {
  try {
    const raw = localStorage.getItem(TRANSPORT_STATE_KEY);
    return normalizeTransportState(raw ? JSON.parse(raw) : {});
  } catch {
    return normalizeTransportState();
  }
}

function writeTransportState(statusText) {
  try {
    localStorage.setItem(TRANSPORT_STATE_KEY, JSON.stringify(transportState));
  } catch {
    refreshTransportUi('device storage blocked');
    return;
  }
  refreshTransportUi(statusText);
}

function prependTransportEntry(list, entry) {
  return [entry, ...list].slice(0, TRANSPORT_MAX_ITEMS);
}

function refreshTransportUi(statusText) {
  const peerKeyId = peerPublicBundle?.keyId ?? transportState.peers[0]?.keyId ?? null;
  const latestPackage = lastCapsuleTransportPackage ?? transportState.outbox[0]?.package ?? transportState.inbox[0]?.package;
  const latestId = latestPackage?.capsuleId ?? latestPackage?.bundleKeyId ?? null;
  const defaultStatus = !localSignedPublicBundle
    ? 'checking'
    : peerKeyId
      ? 'peer key ready'
      : 'local key ready';

  setText(transportStatus, statusText ?? defaultStatus);
  setText(transportPeerStatus, peerKeyId ? shortKeyId(peerKeyId) : 'none');
  setText(transportOutboxStatus, String(transportState.outbox.length));
  setText(transportInboxStatus, String(transportState.inbox.length));
  setText(transportLastStatus, latestId ? shortKeyId(latestId) : 'none');
  if (exportKeyBundleButton) exportKeyBundleButton.disabled = !localSignedPublicBundle;
  if (showKeyQrButton) showKeyQrButton.disabled = !localSignedPublicBundle;
  if (copyKeyBundleButton) copyKeyBundleButton.disabled = !localSignedPublicBundle;
  if (shareCapsuleButton) {
    shareCapsuleButton.disabled = !lastCapsuleTransportPackage && !transportState.outbox[0]?.package;
  }
  if (exportCapsuleButton) {
    exportCapsuleButton.disabled = !lastCapsuleTransportPackage && !transportState.outbox[0]?.package;
  }
  if (copyTransportTextButton) copyTransportTextButton.disabled = !transportPackageText?.value;
  if (shareTransportTextButton) shareTransportTextButton.disabled = !visibleTransportPackage && !transportPackageText?.value;
}

function rememberPeerTransport(pkg, verifiedBundle, statusText) {
  peerSignedPublicBundle = pkg.signedBundle;
  peerPublicBundle = verifiedBundle.bundle;
  const entry = {
    kind: pkg.kind,
    keyId: verifiedBundle.bundle.keyId,
    suite: verifiedBundle.bundle.suite,
    label: pkg.label ?? null,
    createdAt: pkg.createdAt ?? null,
    package: safeJsonClone(pkg),
  };
  transportState = {
    ...transportState,
    peers: prependTransportEntry(
      transportState.peers.filter((item) => item.keyId !== entry.keyId),
      entry,
    ),
  };
  writeTransportState(statusText ?? `peer ${shortKeyId(entry.keyId)} imported`);
}

function rememberOutboxTransport(pkg, statusText) {
  const entry = {
    kind: pkg.kind,
    capsuleId: pkg.capsuleId,
    recipientKeyId: pkg.recipientKeyId,
    threadId: pkg.threadId ?? null,
    suite: pkg.suite,
    createdAt: pkg.createdAt ?? null,
    package: safeJsonClone(pkg),
  };
  lastCapsuleTransportPackage = entry.package;
  transportState = {
    ...transportState,
    outbox: prependTransportEntry(
      transportState.outbox.filter((item) => item.capsuleId !== entry.capsuleId),
      entry,
    ),
  };
  writeTransportState(statusText ?? `capsule ${shortKeyId(entry.capsuleId)} ready`);
}

function rememberInboxTransport(pkg, statusText) {
  const entry = {
    kind: pkg.kind,
    capsuleId: pkg.capsuleId,
    senderKeyId: pkg.senderKeyId,
    threadId: pkg.threadId ?? null,
    suite: pkg.suite,
    createdAt: pkg.createdAt ?? null,
    package: safeJsonClone(pkg),
  };
  transportState = {
    ...transportState,
    inbox: prependTransportEntry(
      transportState.inbox.filter((item) => item.capsuleId !== entry.capsuleId),
      entry,
    ),
  };
  writeTransportState(statusText ?? `capsule ${shortKeyId(entry.capsuleId)} opened`);
}

function transportFilename(pkg) {
  const rawId = pkg.capsuleId ?? pkg.bundleKeyId ?? 'package';
  const id = String(rawId).replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || 'package';
  if (pkg.kind === PLATHO_TRANSPORT_KIND.PUBLIC_BUNDLE) return `platho-key-${id}.platho.json`;
  if (pkg.kind === PLATHO_TRANSPORT_KIND.PRIVATE_CAPSULE) return `platho-capsule-${id}.platho.json`;
  return `platho-${id}.json`;
}

function downloadTransportPackage(pkg) {
  const blob = new Blob([serializeTransportPackage(pkg)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = transportFilename(pkg);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function createLocalKeyTransportPackage() {
  if (!localSignedPublicBundle) throw new Error('Local public key bundle is not ready');
  return createPublicBundleTransportPackage(localSignedPublicBundle, {
    label: appConfig.ui?.identityName ?? 'Platho device',
  });
}

function latestCapsuleTransportPackage() {
  return lastCapsuleTransportPackage ?? transportState.outbox[0]?.package ?? null;
}

function renderVisibleTransportPackage(pkg, statusText) {
  visibleTransportPackage = pkg;
  const payload = createTransportSharePayload(pkg);
  if (transportPackageText) transportPackageText.value = payload.text;
  if (transportQrOutput) {
    transportQrOutput.replaceChildren();
    if (canRenderTransportQr(pkg)) {
      const qr = createTransportQrSvg(pkg);
      transportQrOutput.innerHTML = qr.svg;
      transportQrOutput.dataset.bytes = String(qr.bytes);
      transportQrOutput.dataset.modules = String(qr.moduleCount);
    } else {
      transportQrOutput.textContent = `${payload.bytes} bytes`;
    }
  }
  refreshTransportUi(statusText);
}

async function writeClipboardText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  if (!transportPackageText) return false;
  transportPackageText.value = text;
  transportPackageText.focus();
  transportPackageText.select();
  return document.execCommand?.('copy') === true;
}

async function copyTransportPackage(pkg, statusText) {
  const payload = createTransportSharePayload(pkg);
  renderVisibleTransportPackage(pkg);
  const copied = await writeClipboardText(payload.text);
  refreshTransportUi(copied ? statusText : 'copy unavailable');
  return copied;
}

async function shareTransportPackage(pkg, statusText) {
  const payload = createTransportSharePayload(pkg);
  renderVisibleTransportPackage(pkg);
  try {
    const file = typeof File !== 'undefined'
      ? new File([payload.text], payload.filename, { type: payload.mimeType })
      : null;
    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: 'Platho package', files: [file] });
      refreshTransportUi(statusText);
      return true;
    }
    if (navigator.share) {
      await navigator.share({ title: 'Platho package', text: payload.text });
      refreshTransportUi(statusText);
      return true;
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      refreshTransportUi('share cancelled');
      return false;
    }
    console.error(error);
  }
  return copyTransportPackage(pkg, 'share copied');
}

async function appendImportedCapsuleMessage(opened, pkg) {
  const targetThread = threads.find((item) => item.id === pkg.threadId)
    ?? threads.find((item) => item.id === activeThreadId)
    ?? threads[0];
  activeThreadId = targetThread.id;
  const message = {
    type: 'in',
    text: opened.plaintext,
    meta: `${pkg.suite} import ${shortKeyId(pkg.senderKeyId)}`,
    capsule: opened.capsule,
  };
  targetThread.messages.push(message);
  targetThread.preview = opened.plaintext;
  targetThread.time = 'now';
  targetThread.state = 'sealed';
  await persistMessageToEncryptedHistory(targetThread, message);
  renderThreads();
  renderConversation();
}

async function importTransportPackageText(text) {
  const pkg = parseTransportShareText(text);
  if (pkg.kind === PLATHO_TRANSPORT_KIND.PUBLIC_BUNDLE) {
    const imported = await readPublicBundleTransportPackage(pkg, { now: Date.now() });
    rememberPeerTransport(imported.package, imported.verifiedBundle);
    return imported;
  }
  if (pkg.kind === PLATHO_TRANSPORT_KIND.PRIVATE_CAPSULE) {
    if (!localRecipientKeyPair) throw new Error('Local private key is not ready yet');
    const opened = await openPrivateCapsuleTransportPackage(pkg, localRecipientKeyPair, {
      replayCache: localReplayStore,
    });
    rememberInboxTransport(pkg);
    await appendImportedCapsuleMessage(opened, pkg);
    return opened;
  }
  throw new Error('Unknown Platho transport package kind');
}

async function restoreTransportState() {
  transportState = readTransportState();
  const peerEntry = transportState.peers.find((item) => item.package);
  if (!peerEntry) {
    lastCapsuleTransportPackage = transportState.outbox[0]?.package ?? null;
    refreshTransportUi();
    return;
  }
  try {
    const imported = await readPublicBundleTransportPackage(peerEntry.package, { now: Date.now() });
    peerSignedPublicBundle = imported.signedBundle;
    peerPublicBundle = imported.verifiedBundle.bundle;
    lastCapsuleTransportPackage = transportState.outbox[0]?.package ?? null;
    refreshTransportUi();
  } catch (error) {
    peerSignedPublicBundle = null;
    peerPublicBundle = null;
    transportState = {
      ...transportState,
      peers: transportState.peers.filter((item) => item !== peerEntry),
    };
    writeTransportState('stored peer rejected');
    console.error(error);
  }
}

function setView(view) {
  appShell.dataset.view = view;
  if (view !== 'chats') {
    appShell.dataset.chatOpen = 'false';
  }
  railItems.forEach((item) => item.classList.toggle('is-active', item.dataset.tab === view));
  panels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panel === view));
}

function renderThreads() {
  const q = search.value.trim().toLowerCase();
  threadList.innerHTML = '';
  threads
    .filter((thread) => `${thread.name} ${thread.preview} ${thread.state}`.toLowerCase().includes(q))
    .forEach((thread) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `thread-item${thread.id === activeThreadId ? ' is-selected' : ''}`;
      item.dataset.thread = thread.id;
      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = thread.avatar;
      const main = document.createElement('div');
      main.className = 'thread-main';
      const top = document.createElement('div');
      top.className = 'thread-top';
      const name = document.createElement('div');
      name.className = 'thread-name';
      name.textContent = thread.name;
      const preview = document.createElement('div');
      preview.className = 'thread-preview';
      preview.textContent = thread.preview;
      const state = document.createElement('div');
      state.className = 'thread-state';
      state.textContent = thread.state;
      const time = document.createElement('div');
      time.className = 'thread-time';
      time.textContent = thread.time;
      top.append(name);
      main.append(top, preview, state);
      item.append(avatar, main, time);
      item.addEventListener('click', () => {
        activeThreadId = thread.id;
        appShell.dataset.chatOpen = 'true';
        renderThreads();
        renderConversation();
      });
      threadList.append(item);
    });
}

function renderConversation() {
  const thread = threads.find((item) => item.id === activeThreadId) ?? threads[0];
  activeAvatar.textContent = thread.avatar;
  activeTitle.textContent = thread.name;
  activeSubtitle.textContent = thread.subtitle;
  messageStrip.innerHTML = '';

  thread.messages.forEach((message) => {
    const row = document.createElement('div');
    row.className = `message ${message.type}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = message.text;
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.textContent = message.meta;
    row.append(bubble, meta);
    messageStrip.append(row);
  });

  requestAnimationFrame(() => {
    messageStrip.scrollTop = messageStrip.scrollHeight;
  });
}

railItems.forEach((item) => {
  item.addEventListener('click', () => setView(item.dataset.tab));
});

search.addEventListener('input', renderThreads);

composer.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  const thread = threads.find((item) => item.id === activeThreadId) ?? threads[0];
  const message = { type: 'out', text, meta: 'local' };
  if (localIdentity && localRecipientKeyPair && localSignedPublicBundle) {
    try {
      const recipientBundle = peerSignedPublicBundle ?? localSignedPublicBundle;
      const capsule = await createEncryptedPrivateCapsule(text, recipientBundle, localIdentity, {
        threadId: activeThreadId,
      });
      const transportPackage = createPrivateCapsuleTransportPackage(capsule, {
        label: thread.name,
      });
      rememberOutboxTransport(transportPackage);
      renderVisibleTransportPackage(transportPackage, `capsule ${shortKeyId(transportPackage.capsuleId)} ready`);
      message.capsule = capsule;
      message.transportPackage = transportPackage;
      message.meta = peerSignedPublicBundle
        ? `${capsule.header0.suite} capsule export`
        : `${capsule.header0.suite} local capsule`;
    } catch (error) {
      message.meta = 'encryption blocked';
      refreshTransportUi('capsule blocked');
      console.error(error);
    }
  }
  thread.messages.push(message);
  thread.preview = text;
  thread.time = 'now';
  thread.state = message.capsule ? 'sealed' : 'local';
  await persistMessageToEncryptedHistory(thread, message);
  messageInput.value = '';
  renderThreads();
  renderConversation();
});

exportKeyBundleButton?.addEventListener('click', () => {
  try {
    const pkg = createLocalKeyTransportPackage();
    renderVisibleTransportPackage(pkg);
    downloadTransportPackage(pkg);
    refreshTransportUi(`key ${shortKeyId(pkg.bundleKeyId)} saved`);
  } catch (error) {
    refreshTransportUi('local key not ready');
    console.error(error);
  }
});

showKeyQrButton?.addEventListener('click', () => {
  try {
    const pkg = createLocalKeyTransportPackage();
    renderVisibleTransportPackage(pkg, canRenderTransportQr(pkg)
      ? `key ${shortKeyId(pkg.bundleKeyId)} QR ready`
      : 'key QR too large');
  } catch (error) {
    refreshTransportUi('local key not ready');
    console.error(error);
  }
});

copyKeyBundleButton?.addEventListener('click', async () => {
  try {
    const pkg = createLocalKeyTransportPackage();
    await copyTransportPackage(pkg, `key ${shortKeyId(pkg.bundleKeyId)} copied`);
  } catch (error) {
    refreshTransportUi('copy blocked');
    console.error(error);
  }
});

importTransportButton?.addEventListener('click', () => {
  transportFileInput?.click();
});

transportFileInput?.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await importTransportPackageText(await file.text());
  } catch (error) {
    refreshTransportUi('import blocked');
    console.error(error);
  } finally {
    event.target.value = '';
  }
});

copyTransportTextButton?.addEventListener('click', async () => {
  if (!transportPackageText?.value) {
    refreshTransportUi('nothing to copy');
    return;
  }
  try {
    const copied = await writeClipboardText(transportPackageText.value);
    refreshTransportUi(copied ? 'text copied' : 'copy unavailable');
  } catch (error) {
    refreshTransportUi('copy blocked');
    console.error(error);
  }
});

importTransportTextButton?.addEventListener('click', async () => {
  const text = transportPackageText?.value.trim();
  if (!text) {
    refreshTransportUi('paste empty');
    return;
  }
  try {
    await importTransportPackageText(text);
  } catch (error) {
    refreshTransportUi('import blocked');
    console.error(error);
  }
});

shareTransportTextButton?.addEventListener('click', async () => {
  try {
    const pkg = visibleTransportPackage ?? parseTransportShareText(transportPackageText?.value ?? '');
    await shareTransportPackage(pkg, 'package shared');
  } catch (error) {
    refreshTransportUi('share blocked');
    console.error(error);
  }
});

transportPackageText?.addEventListener('input', () => {
  visibleTransportPackage = null;
  refreshTransportUi();
});

shareCapsuleButton?.addEventListener('click', async () => {
  try {
    const pkg = latestCapsuleTransportPackage();
    if (!pkg) {
      refreshTransportUi('no capsule yet');
      return;
    }
    await shareTransportPackage(pkg, `capsule ${shortKeyId(pkg.capsuleId)} shared`);
  } catch (error) {
    refreshTransportUi('share blocked');
    console.error(error);
  }
});

exportCapsuleButton?.addEventListener('click', () => {
  const pkg = latestCapsuleTransportPackage();
  if (!pkg) {
    refreshTransportUi('no capsule yet');
    return;
  }
  renderVisibleTransportPackage(pkg);
  downloadTransportPackage(pkg);
  refreshTransportUi(`capsule ${shortKeyId(pkg.capsuleId)} saved`);
});

function shortAddress(address) {
  const text = String(address ?? '');
  if (text.length <= 16) return text || 'connected';
  return `${text.slice(0, 6)}...${text.slice(-6)}`;
}

function tonConnectManifestUrl() {
  const configured = window.location.protocol === 'https:'
    ? appConfig.tonConnect?.manifestUrl
    : appConfig.tonConnect?.insecureOriginManifestUrl ?? appConfig.tonConnect?.manifestUrl;
  return new URL(configured ?? './tonconnect-manifest.json', window.location.href).href;
}

async function resolveVaultChainProvider(explicitProvider) {
  if (explicitProvider) return explicitProvider;
  const providerConfig = appConfig.vault?.provider ?? {};
  if (providerConfig.globalName && globalThis[providerConfig.globalName]) {
    return globalThis[providerConfig.globalName];
  }
  if (!providerConfig.moduleUrl) return undefined;
  if (!vaultProviderLoadPromise) {
    const moduleUrl = new URL(providerConfig.moduleUrl, window.location.href).href;
    vaultProviderLoadPromise = import(moduleUrl).then((module) => {
      const exportName = providerConfig.exportName ?? 'default';
      return module[exportName] ?? module.default ?? module.provider;
    });
  }
  return vaultProviderLoadPromise;
}

async function refreshTonConnectPayload(options = {}) {
  if (!localSignedPublicBundle) return null;
  const payload = await createTonConnectOwnershipPayload(localSignedPublicBundle, {
    vaultAddress: appConfig.vault?.address ?? null,
  });
  globalThis.plathoTonProofPayload = payload;
  if (tonConnectUI) {
    tonConnectUI.setConnectRequestParameters({
      state: 'ready',
      value: { tonProof: payload },
    });
  }
  if (options.updateStatus !== false && !globalThis.plathoWalletProof) {
    walletProofStatus.textContent = 'payload ready';
  }
  return payload;
}

async function handleTonConnectWallet(wallet) {
  pendingTonConnectWallet = wallet;
  if (!wallet) {
    delete globalThis.plathoWalletProof;
    delete globalThis.plathoVaultBinding;
    tonConnectStatus.textContent = 'not connected';
    walletProofStatus.textContent = localSignedPublicBundle ? 'payload ready' : 'checking';
    walletKeyStatus.textContent = 'state init required';
    vaultRecordStatus.textContent = 'proof required';
    return;
  }
  tonConnectStatus.textContent = shortAddress(wallet.account?.address);
  if (!localSignedPublicBundle) return;

  const proof = wallet.connectItems?.tonProof;
  if (!proof || !('proof' in proof)) {
    walletProofStatus.textContent = 'proof missing';
    walletKeyStatus.textContent = 'state init required';
    vaultRecordStatus.textContent = 'proof required';
    await refreshTonConnectPayload({ updateStatus: false });
    return;
  }

  try {
    let walletKeyVersion = null;
    const verifiedProof = await verifyTonConnectWalletOwnershipProof(
      localSignedPublicBundle,
      { account: wallet.account, proof: proof.proof },
      {
        expectedDomain: tonConnectExpectedDomain,
        getWalletPublicKey: async (account) => {
          const resolved = await resolveTonWalletPublicKeyFromStateInit(account);
          walletKeyVersion = resolved.walletVersion;
          return resolved.publicKey;
        },
      },
    );
    globalThis.plathoWalletProof = verifiedProof;
    walletProofStatus.textContent = 'proof accepted';
    walletKeyStatus.textContent = walletKeyVersion ?? 'verified';
    await bindVaultRecordForProof(verifiedProof);
  } catch (error) {
    walletProofStatus.textContent = 'proof rejected';
    walletKeyStatus.textContent = 'blocked';
    vaultRecordStatus.textContent = 'proof required';
    console.error(error);
    await refreshTonConnectPayload({ updateStatus: false });
  }
}

async function bindVaultRecordForProof(walletProof, options = {}) {
  if (!walletProof || !localSignedPublicBundle) {
    vaultRecordStatus.textContent = 'proof required';
    return null;
  }
  try {
    const provider = await resolveVaultChainProvider(options.provider);
    const binding = await bindVaultRecordFromChain(localSignedPublicBundle, walletProof, {
      ...options,
      provider,
      vaultAddress: options.vaultAddress ?? appConfig.vault?.address ?? null,
    });
    globalThis.plathoVaultBinding = binding;
    vaultRecordStatus.textContent = 'bound';
    return binding;
  } catch (error) {
    delete globalThis.plathoVaultBinding;
    vaultRecordStatus.textContent = error instanceof VaultChainProviderUnavailableError
      ? appConfig.vault?.provider?.unavailableStatus ?? 'provider unavailable'
      : 'record blocked';
    console.error(error);
    return null;
  }
}

function bootTonConnect() {
  const TonConnectUI = globalThis.TON_CONNECT_UI?.TonConnectUI;
  if (!TonConnectUI || !document.querySelector('#tonConnectButton')) {
    tonConnectStatus.textContent = 'ui missing';
    return;
  }
  const manifestUrl = tonConnectManifestUrl();
  tonConnectExpectedDomain = appConfig.tonConnect?.expectedDomain ?? new URL(manifestUrl).host;
  tonConnectUI = new TonConnectUI({
    manifestUrl,
    buttonRootId: 'tonConnectButton',
    restoreConnection: true,
    analytics: { mode: 'off' },
  });
  if (globalThis.TON_CONNECT_UI?.THEME) {
    tonConnectUI.uiOptions = {
      uiPreferences: {
        theme: globalThis.TON_CONNECT_UI.THEME.DARK,
      },
    };
  }
  globalThis.plathoTonConnectUI = tonConnectUI;
  tonConnectUI.onStatusChange(
    (wallet) => {
      handleTonConnectWallet(wallet);
    },
    (error) => {
      tonConnectStatus.textContent = 'connect error';
      walletProofStatus.textContent = 'blocked';
      console.error(error);
    },
  );
}

async function bootCrypto() {
  try {
    localIdentity = await createMessagingIdentity();
    localRecipientKeyPair = localIdentity.encryptionKeyPair;
    localSignedPublicBundle = await exportSignedPublicKeyBundle(localIdentity, {
      purpose: appConfig.crypto?.signedBundlePurpose ?? 'pwa-runtime',
    });
    const verifiedBundle = await verifySignedPublicKeyBundle(localSignedPublicBundle);
    localRecipientPublicBundle = verifiedBundle.bundle;
    localVaultDraft = await createVaultMessagingKeyDraft(verifiedBundle.bundle, verifiedBundle.signingPublicKey);
    await restoreTransportState();
    await refreshTonConnectPayload();
    if (tonConnectUI) {
      clearInterval(tonProofPayloadTimer);
      tonProofPayloadTimer = setInterval(() => {
        refreshTonConnectPayload({ updateStatus: false }).catch((error) => {
          walletProofStatus.textContent = 'payload blocked';
          console.error(error);
        });
      }, 9 * 60 * 1000);
    }
    globalThis.plathoVerifyTonConnectProof = async (tonConnectProof, options = {}) => {
      const expectedDomain = options.expectedDomain ?? tonConnectExpectedDomain ?? window.location.host;
      return verifyTonConnectWalletOwnershipProof(localSignedPublicBundle, tonConnectProof, {
        getWalletPublicKey: async (account) => {
          const resolved = await resolveTonWalletPublicKeyFromStateInit(account);
          return resolved.publicKey;
        },
        ...options,
        expectedDomain,
      });
    };
    globalThis.plathoBindVaultRecord = async (provider) => bindVaultRecordForProof(
      globalThis.plathoWalletProof,
      { provider },
    );
    const result = await runPlathoCryptoSelfTest();
    encryptionStatus.textContent = result.hybrid.aadTamperRejected ? 'hybrid passed' : 'review';
    keySuiteStatus.textContent = `${result.hybrid.suite} / ${result.hybrid.mlKem768PublicKeyBytes}b`;
    keyAuthStatus.textContent = verifiedBundle.signingPublicKey.length === 32 ? 'signed bundle' : 'review';
    vaultDraftStatus.textContent = `${localVaultDraft.json.crypto_suite_mask} / ${localVaultDraft.json.pq_kem_pubkey_len}b`;
    capsulePolicyStatus.textContent = result.capsule.replayRejected ? 'replay guarded' : 'review';
    if (pendingTonConnectWallet) {
      await handleTonConnectWallet(pendingTonConnectWallet);
    } else {
      walletProofStatus.textContent = result.identity.tonProofVerified ? 'payload ready' : 'review';
      walletKeyStatus.textContent = 'state init required';
      vaultRecordStatus.textContent = 'proof required';
    }
  } catch (error) {
    encryptionStatus.textContent = 'unavailable';
    keySuiteStatus.textContent = 'blocked';
    keyAuthStatus.textContent = 'blocked';
    vaultDraftStatus.textContent = 'blocked';
    capsulePolicyStatus.textContent = 'blocked';
    refreshTransportUi('transport blocked');
    tonConnectStatus.textContent = 'blocked';
    walletProofStatus.textContent = 'blocked';
    walletKeyStatus.textContent = 'blocked';
    vaultRecordStatus.textContent = 'blocked';
    console.error(error);
  }
}

if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#0b0d0f');
  tg.setBackgroundColor('#0b0d0f');
}

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

renderConfiguredShell();
renderThreads();
renderConversation();
transportState = readTransportState();
refreshTransportUi();
bootTonConnect();
bootReplayStore();
bootEncryptedMessageHistory();
bootCrypto();
