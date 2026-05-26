import {
  CRYPTO_SUITES,
  createEncryptedPrivateCapsuleFromPublicBundle,
  createVaultMessagingKeyDraft,
  encodeCompactPayload,
  exportSignedPublicKeyBundle,
  openPrivateCapsuleChainEntry,
  PLATHO_COMPACT_IMAGE_FORMATS,
  parseTonAddress,
  publicKeyBundleFromVaultKeyRecord,
  randomBytes,
  runPlathoCryptoSelfTest,
  verifyVaultKeyRecordBinding,
  verifySignedPublicKeyBundle,
} from './crypto/platho-crypto.mjs';
import {
  PLATHO_WALLET_NETWORK_GLOBAL_IDS,
  createPlathoWallet,
  deriveMessagingIdentityFromWallet,
  exportPlathoWalletSeed,
  importPlathoWallet,
  sendPlathoWalletTransaction,
} from './platho-wallet.mjs';
import { createIndexedDbReplayStore, createMemoryReplayStore } from './replay-store.mjs';
import {
  createIndexedDbEncryptedMessageHistoryStore,
  createMemoryEncryptedMessageHistoryStore,
} from './encrypted-message-store.mjs';
import {
  VaultChainProviderUnavailableError,
} from './vault-chain-provider.mjs';
import { PLATHO_APP_CONFIG } from './platho-config.mjs?v=24';
import {
  DEFAULT_PUBLIC_CHANNELS,
  normalizePublicChannelRegistry,
  normalizePublicChannelFeed,
  publicChannelSubscriptionsToThreads,
  publicChannelThreadsToFeedItems,
  readPublicChannelFeedCache,
  readPublicChannelSubscriptions,
  subscribedPublicChannels,
  writePublicChannelFeedCache,
  writePublicChannelSubscriptions,
} from './public-channel-subscriptions.mjs?v=2';
import {
  createInboundPeerThread,
  createRecipientThread,
  findThreadByIdentityVariants,
  identityKey,
  identityTone,
  identityTypeLabel,
  normalizeIdentityVariants,
  parseRecipientIdentity,
  preferredInboundIdentity,
  primaryThreadIdentity,
  RECIPIENT_IDENTITY_TYPES,
  threadIdentitySearchText,
  threadIdentityVariants,
} from './recipient-identities.mjs';
import {
  SINGLE_CAPSULE_USEFUL_BYTES,
  messagePartCount,
  splitBytesToParts,
  splitUtf8ToParts,
} from './capsule-part-policy.mjs?v=1';
import {
  INCLUDED_NETWORK_FEE_NANOTONS,
  MESSAGE_PRICE_SUITES,
  messagePriceLabel,
  messagePriceNanotons,
  networkFeeSurchargeNanotons,
  resolveNetworkFeeEstimateNanotons,
} from './message-pricing-policy.mjs';
import {
  createAthWalletMessage,
  createPublicPostPayload,
  createWalletTransaction,
  buildVaultBalancePublishExternalBoc,
  createVaultWalletMessage,
  createUsernameRegistryWalletMessage,
  PROFILE_AVATAR_NOTIFY_VALUE_NANOTONS,
  PROFILE_AVATAR_PRICE_ATH,
  PUBLIC_BODY_MEDIA_FORMATS,
  PUBLIC_COMMENT_TEXT_MAX_BYTES,
  PUBLIC_POST_TEXT_MAX_BYTES,
  readPublicPostPayload,
  RECEIVE_ASSETS,
  VAULT_CRYPTO_SUITE,
  VAULT_PUBLISH_KIND,
  VAULT_SIZE_CLASS,
} from './pwa-contract-transactions.mjs?v=4';
import { createAthMasterTonRpcProvider, createAthWalletTonRpcProvider } from './ath-ton-rpc-provider.mjs';
import { createCapsuleHubTonRpcProvider } from './capsulehub-ton-rpc-provider.mjs';
import { createProfileRegistryTonRpcProvider } from './profile-registry-ton-rpc-provider.mjs';
import { createTonDnsProvider } from './ton-dns-provider.mjs';
import { createUsernameRegistryTonRpcProvider } from './username-ton-rpc-provider.mjs';

const appConfig = PLATHO_APP_CONFIG;
const APP_DOCS = [
  {
    id: 'about',
    label: 'About',
    title: 'About Platho',
    path: './docs/about-platho.md',
  },
  {
    id: 'ath',
    label: 'ATH',
    title: 'ATH Whitepaper',
    path: './docs/ath-whitepaper.md',
  },
  {
    id: 'crypto',
    label: 'Crypto',
    title: 'Crypto Protocol',
    path: './docs/crypto-protocol.md',
  },
];
const basePublicChannelRegistry = appConfig.publicChannels ?? DEFAULT_PUBLIC_CHANNELS;
const previewThreads = (appConfig.preview?.threads ?? []).map((thread) => ({
  ...thread,
  messages: (thread.messages ?? []).map((message) => ({ ...message })),
}));

const appShell = document.querySelector('.app-shell');
const railItems = [...document.querySelectorAll('.rail-item[data-tab]')];
const panels = [...document.querySelectorAll('.view-panel')];
const docsButtons = [...document.querySelectorAll('.docs-header-button')];
const installButtons = [...document.querySelectorAll('.install-header-button')];
const docsDialog = document.querySelector('#docsDialog');
const docsCloseButton = document.querySelector('#docsCloseButton');
const docsTitle = document.querySelector('#docsTitle');
const docsLead = document.querySelector('#docsLead');
const docsNav = document.querySelector('#docsNav');
const docsContent = document.querySelector('#docsContent');
const installDialog = document.querySelector('#installDialog');
const installCloseButton = document.querySelector('#installCloseButton');
const installConfirmButton = document.querySelector('#installConfirmButton');
const installDismissButton = document.querySelector('#installDismissButton');
const installHelp = document.querySelector('#installHelp');
const threadList = document.querySelector('#threadList');
const messageStrip = document.querySelector('#messageStrip');
const activeAvatar = document.querySelector('#activeAvatar');
const activeTitle = document.querySelector('#activeTitle');
const activeSubtitle = document.querySelector('#activeSubtitle');
const backToChatsButton = document.querySelector('#backToChatsButton');
const identityMenuButton = document.querySelector('#identityMenuButton');
const search = document.querySelector('#threadSearch');
const newChatButton = document.querySelector('#newChatButton');
const newChatDialog = document.querySelector('#newChatDialog');
const newChatForm = document.querySelector('#newChatForm');
const recipientInput = document.querySelector('#recipientInput');
const recipientLocalLabel = document.querySelector('#recipientLocalLabel');
const recipientHint = document.querySelector('#recipientHint');
const closeNewChatButton = document.querySelector('#closeNewChatButton');
const actionDialog = document.querySelector('#actionDialog');
const actionForm = document.querySelector('#actionForm');
const actionTitle = document.querySelector('#actionTitle');
const actionHint = document.querySelector('#actionHint');
const actionFields = document.querySelector('#actionFields');
const actionSummary = document.querySelector('#actionSummary');
const actionCancelButton = document.querySelector('#actionCancelButton');
const actionSubmitButton = document.querySelector('#actionSubmitButton');
const composer = document.querySelector('#composer');
const messageInput = document.querySelector('#messageInput');
const sendButton = document.querySelector('.send-button');
const privateComposerCostStatus = document.querySelector('#privateComposerCostStatus');
const paymentCheckButton = document.querySelector('#paymentCheckButton');
const privateImageButton = document.querySelector('#privateImageButton');
const privateImageInput = document.querySelector('#privateImageInput');
const privateImageModeSelect = document.querySelector('#privateImageModeSelect');
const privateAttachmentPanel = document.querySelector('#privateAttachmentPanel');
const privateAttachmentLabel = document.querySelector('#privateAttachmentLabel');
const privateClearImageButton = document.querySelector('#privateClearImageButton');
const attachmentControls = [
  ...document.querySelectorAll('[data-requires-wallet="true"], #attachButton, .attachment-button'),
];
const encryptionStatus = document.querySelector('#encryptionStatus');
const keySuiteStatus = document.querySelector('#keySuiteStatus');
const keySuiteSelect = document.querySelector('#keySuiteSelect');
const keyAuthStatus = document.querySelector('#keyAuthStatus');
const vaultDraftStatus = document.querySelector('#vaultDraftStatus');
const capsulePolicyStatus = document.querySelector('#capsulePolicyStatus');
const walletAddressStatus = document.querySelector('#walletAddressStatus');
const createWalletButton = document.querySelector('#createWalletButton');
const importWalletButton = document.querySelector('#importWalletButton');
const exportWalletSeedButton = document.querySelector('#exportWalletSeedButton');
const vaultRecordStatus = document.querySelector('#vaultRecordStatus');
const registerVaultKeysButton = document.querySelector('#registerVaultKeysButton');
const replaceVaultKeysButton = document.querySelector('#replaceVaultKeysButton');
const vaultRotateStatus = document.querySelector('#vaultRotateStatus');
const syncMessagesButton = document.querySelector('#syncMessagesButton');
const messageSyncStatus = document.querySelector('#messageSyncStatus');
const publicSyncWindowSelect = document.querySelector('#publicSyncWindowSelect');
const publicCommentsDefaultSelect = document.querySelector('#publicCommentsDefaultSelect');
const setAvatarButton = document.querySelector('#setAvatarButton');
const profileAvatarInput = document.querySelector('#profileAvatarInput');
const mintUsernameButton = document.querySelector('#mintUsernameButton');
const flushUsernameRefundButton = document.querySelector('#flushUsernameRefundButton');
const burnAthButton = document.querySelector('#burnAthButton');
const athSupplyStatus = document.querySelector('#athSupplyStatus');
const athDropIssuedStatus = document.querySelector('#athDropIssuedStatus');
const replayStoreStatus = document.querySelector('#replayStoreStatus');
const brandNetworkLabel = document.querySelector('#brandNetworkLabel');
const chatCountLabel = document.querySelector('#chatCountLabel');
const publicSubtitle = document.querySelector('#publicSubtitle');
const publicPane = document.querySelector('.public-pane');
const publicFeed = document.querySelector('#publicFeed');
const publicChannelDetail = document.querySelector('#publicChannelDetail');
const publicChannelSearchRow = document.querySelector('#publicChannelSearchRow');
const publicChannelSearch = document.querySelector('#publicChannelSearch');
const addPublicChannelButton = document.querySelector('#addPublicChannelButton');
const publicFeedModeButton = document.querySelector('#publicFeedModeButton');
const publicChannelsModeButton = document.querySelector('#publicChannelsModeButton');
const publicJumpDownButton = document.querySelector('#publicJumpDownButton');
const publicComposer = document.querySelector('#publicComposer');
const publicMessageInput = document.querySelector('#publicMessageInput');
const publicComposerCostStatus = document.querySelector('#publicComposerCostStatus');
const publicImageButton = document.querySelector('#publicImageButton');
const publicImageInput = document.querySelector('#publicImageInput');
const publicImageModeSelect = document.querySelector('#publicImageModeSelect');
const publicAttachmentPanel = document.querySelector('#publicAttachmentPanel');
const publicAttachmentLabel = document.querySelector('#publicAttachmentLabel');
const publicClearImageButton = document.querySelector('#publicClearImageButton');
const publicComposerCommentsCheckbox = document.querySelector('#publicComposerCommentsCheckbox');
const publicPostCommentsToggle = document.querySelector('#publicPostCommentsToggle');
const publicCommentContext = document.querySelector('#publicCommentContext');
const publicCommentContextText = document.querySelector('#publicCommentContextText');
const publicCancelCommentButton = document.querySelector('#publicCancelCommentButton');
const vaultSubtitle = document.querySelector('#vaultSubtitle');
const refreshVaultButton = document.querySelector('#refreshVaultButton');
const balanceGrid = document.querySelector('#balanceGrid');
const vaultMoveCards = Array.from(document.querySelectorAll('[data-vault-move-asset]')).map((form) => ({
  asset: form.dataset.vaultMoveAsset === 'ATH' ? 'ATH' : 'TON',
  form,
  input: form.querySelector('[data-vault-move-input]'),
  walletBalance: form.querySelector('[data-vault-wallet-balance]'),
  vaultBalance: form.querySelector('[data-vault-vault-balance]'),
  fromLabel: form.querySelector('[data-vault-from-label]'),
  toLabel: form.querySelector('[data-vault-to-label]'),
  maxButton: form.querySelector('[data-vault-max-button]'),
  directionButton: form.querySelector('[data-vault-direction-button]'),
  submitButton: form.querySelector('[data-vault-submit-button]'),
}));
const actionGrid = document.querySelector('#actionGrid');
const ledgerRows = document.querySelector('#ledgerRows');
const profileHandle = document.querySelector('#profileHandle');
const profileAvatar = document.querySelector('#profileAvatar');
const identityName = document.querySelector('#identityName');
const identitySubtitle = document.querySelector('#identitySubtitle');
const walletRuntimeLabel = document.querySelector('#walletRuntimeLabel');
const localStateLabel = document.querySelector('#localStateLabel');
const networkRuntimeLabel = document.querySelector('#networkRuntimeLabel');

let threads = [];
let customPublicChannels = [];
let publicChannelRegistry = [];
let publicChannelThreads = [];
let publicChannelSubscriptions = null;
let publicChannelFeedCache = {};
let publicReadCursors = {};
let activeThreadId = null;
let activeDocId = APP_DOCS[0]?.id ?? null;
const docsCache = new Map();
let localIdentity = null;
let localRecipientKeyPair = null;
let localSignedPublicBundle = null;
let localVaultDraft = null;
let plathoWallet = null;
let localReplayStore = createMemoryReplayStore();
let encryptedMessageStore = null;
let vaultProviderLoadPromise = null;
let tonDnsProviderLoadPromise = null;
let identityPopover = null;
let activeActionDialog = null;
let publicDisplayMode = 'feed';
let publicChannelSearchQuery = '';
let publicCommentTarget = null;
let privateImageAttachment = null;
let publicImageAttachment = null;
let localProfileAvatarPointer = null;
let profileAvatarLoadPromises = new Map();
let vaultMoveDirections = { TON: 'to-vault', ATH: 'to-vault' };
let deferredInstallPrompt = null;
const KEY_SUITE_PREF_KEY = 'platho.crypto.suite.v1';
const PLATHO_WALLET_STORAGE_KEY = 'platho.wallet.seed.v1';
const PRIVATE_CHAIN_SCAN_STORAGE_PREFIX = 'platho.private.chain.scan.v1';
const PUBLIC_SYNC_WINDOW_STORAGE_KEY = 'platho.publicSyncWindow.v1';
const PUBLIC_COMMENTS_DEFAULT_STORAGE_KEY = 'platho.publicCommentsDefault.v1';
const PUBLIC_CUSTOM_CHANNELS_STORAGE_KEY = 'platho.publicCustomChannels.v1';
const PUBLIC_READ_CURSORS_STORAGE_KEY = 'platho.publicReadCursors.v1';
const INSTALL_PROMPT_DISMISSED_STORAGE_KEY = 'platho.installPrompt.dismissed.v1';
const PROFILE_AVATAR_POINTER_STORAGE_PREFIX = 'platho.profile.avatar.v1';
const PROFILE_AVATAR_MEDIA_CACHE_PREFIX = 'platho.profile.avatar.media.v1';
const PROFILE_AVATAR_ENTRY_SCAN_PADDING = 96;
const PROFILE_AVATAR_FALLBACK_SCAN_LIMIT = 400;
const PROFILE_AVATAR_PUBLISH_CONFIRM_ATTEMPTS = 20;
const PROFILE_AVATAR_PUBLISH_CONFIRM_DELAY_MS = 1500;
const ATH_FULL_DISCOUNT_AMOUNT_ATOMIC = 10_000_000_000_000n;
const ATH_TOTAL_SUPPLY_ATOMIC = 100_000_000_000_000_000n;
const VAULT_ACTIVITY_AIRDROP_TOTAL_ATH_ATOMIC = 15_000_000_000_000_000n;
const VAULT_ACTIVITY_AIRDROP_DISCOUNT_UNLOCK_REMAINING_ATH_ATOMIC = 0n;
const VAULT_PUBLISH_LOCAL_EXEC_RESERVE_NANOTONS = 6_000_000n;
const VAULT_PUBLISH_NONCE_CONFIRM_TIMEOUT_MS = 90_000;
const VAULT_PUBLISH_NONCE_POLL_MS = 1_500;
const PLATO_PRIVATE_STANDARD_FEE_NANOTONS = 5_000_000n;
const PLATO_PRIVATE_LONG_TERM_FEE_NANOTONS = 10_000_000n;
const PLATO_PUBLIC_POST_FEE_NANOTONS = 5_000_000n;
const CAPSULEHUB_PRIVATE_STANDARD_FIXED_CHARGE_NANOTONS = 3_000_000n + 1_000_000n + 4_000_000n + 30_000_000n;
const CAPSULEHUB_PRIVATE_LONG_TERM_FIXED_CHARGE_NANOTONS = 4_000_000n + 1_000_000n + 4_000_000n + 30_000_000n;
const CAPSULEHUB_PUBLIC_FIXED_CHARGE_NANOTONS = 3_000_000n + 1_000_000n + 1_000_000n + 30_000_000n;
const VAULT_MOVE_WALLET_TON_GAS_KEEP_NANOTONS = 50_000_000n;
const DEFAULT_IMAGE_COMPRESSION_MODE_ID = 'good';
const IMAGE_COMPRESSION_MODES = Object.freeze({
  low: Object.freeze({ id: 'low', label: 'Low', maxBytes: 8 * 1024 }),
  medium: Object.freeze({ id: 'medium', label: 'Medium', maxBytes: 16 * 1024 }),
  good: Object.freeze({ id: 'good', label: 'Good', maxBytes: 32 * 1024 }),
  maximum: Object.freeze({ id: 'maximum', label: 'Maximum', maxBytes: 64 * 1024 }),
});
let vaultPocketState = {
  wallet: { ton_balance: null, ath_balance: null },
  vault: { ton_balance: null, ath_balance: null },
};
let vaultProtocolState = {
  airdrop_remaining_ath: VAULT_ACTIVITY_AIRDROP_TOTAL_ATH_ATOMIC,
  airdrop_total_allocation_ath: VAULT_ACTIVITY_AIRDROP_TOTAL_ATH_ATOMIC,
};
let athProtocolState = {
  total_supply: ATH_TOTAL_SUPPLY_ATOMIC,
};

function localStorageOrNull() {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

function isStandaloneApp() {
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true;
}

function refreshInstallButtons() {
  const canInstall = !isStandaloneApp();
  installButtons.forEach((button) => {
    button.toggleAttribute('hidden', !canInstall);
  });
  if (installConfirmButton) {
    installConfirmButton.textContent = deferredInstallPrompt ? 'Install' : 'How to install';
  }
  if (installHelp) {
    installHelp.textContent = deferredInstallPrompt
      ? 'The next step opens your browser install sheet. If you cancel it, the install button stays here so you can still find the manual path.'
      : installHelpText();
  }
}

function installPromptDismissed() {
  return localStorageOrNull()?.getItem(INSTALL_PROMPT_DISMISSED_STORAGE_KEY) === '1';
}

function markInstallPromptDismissed() {
  localStorageOrNull()?.setItem(INSTALL_PROMPT_DISMISSED_STORAGE_KEY, '1');
}

function openInstallDialogIfUseful() {
  if (!installDialog || installPromptDismissed() || isStandaloneApp()) return;
  installDialog.hidden = false;
  refreshInstallButtons();
}

function closeInstallDialog({ dismissed = true } = {}) {
  if (dismissed) markInstallPromptDismissed();
  if (installDialog) installDialog.hidden = true;
}

async function promptInstallApp() {
  if (!deferredInstallPrompt || isStandaloneApp()) {
    if (!isStandaloneApp() && installDialog) {
      installDialog.hidden = false;
    }
    refreshInstallButtons();
    return;
  }
  const promptEvent = deferredInstallPrompt;
  deferredInstallPrompt = null;
  closeInstallDialog({ dismissed: true });
  refreshInstallButtons();
  try {
    await promptEvent.prompt();
    await promptEvent.userChoice.catch(() => null);
  } finally {
    refreshInstallButtons();
  }
}

function installHelpText() {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) {
    return 'On iPhone or iPad, open this page in Safari, tap Share, then Add to Home Screen.';
  }
  if (/Android/i.test(ua)) {
    return 'On Android Chrome, open the browser menu and choose Install app or Add to Home screen.';
  }
  return 'In Chrome or Edge, use the address bar install icon or the browser menu: Apps / Install this site.';
}

function profileAvatarStorageKey(owner = plathoWallet?.address) {
  return owner ? `${PROFILE_AVATAR_POINTER_STORAGE_PREFIX}:${owner}` : null;
}

function zeroAvatarHashHex() {
  return `0x${'00'.repeat(32)}`;
}

function normalizeAvatarHashHex(value) {
  const text = String(value ?? '').trim().toLowerCase();
  const hex = text.startsWith('0x') ? text.slice(2) : text;
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error('Avatar hash must be uint256 hex');
  return `0x${hex}`;
}

function readStoredProfileAvatarPointer(owner = plathoWallet?.address) {
  const key = profileAvatarStorageKey(owner);
  if (!key) return null;
  try {
    const parsed = JSON.parse(localStorageOrNull()?.getItem(key) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    const profileVersion = Number(parsed.profileVersion ?? parsed.profile_version ?? 0);
    const avatarHash = normalizeAvatarHashHex(parsed.avatarHash ?? parsed.avatar_hash ?? zeroAvatarHashHex());
    if (!Number.isSafeInteger(profileVersion) || profileVersion <= 0) return null;
    if (avatarHash === zeroAvatarHashHex()) return null;
    return { profileVersion, profile_version: profileVersion, avatarHash, avatar_hash: avatarHash };
  } catch {
    return null;
  }
}

function writeStoredProfileAvatarPointer(pointer, owner = plathoWallet?.address) {
  const key = profileAvatarStorageKey(owner);
  if (!key) return;
  const normalized = pointer ? {
    profileVersion: Number(pointer.profileVersion ?? pointer.profile_version ?? 0),
    avatarHash: normalizeAvatarHashHex(pointer.avatarHash ?? pointer.avatar_hash),
  } : null;
  if (!normalized || normalized.profileVersion <= 0) {
    localStorageOrNull()?.removeItem(key);
    localProfileAvatarPointer = null;
    return;
  }
  localStorageOrNull()?.setItem(key, JSON.stringify(normalized));
  localProfileAvatarPointer = {
    profileVersion: normalized.profileVersion,
    profile_version: normalized.profileVersion,
    avatarHash: normalized.avatarHash,
    avatar_hash: normalized.avatarHash,
  };
}

function currentProfileAvatarPointer() {
  localProfileAvatarPointer = localProfileAvatarPointer ?? readStoredProfileAvatarPointer();
  return localProfileAvatarPointer ?? {
    profileVersion: 0,
    profile_version: 0,
    avatarHash: zeroAvatarHashHex(),
    avatar_hash: zeroAvatarHashHex(),
  };
}

function currentProfilePointerFields() {
  const pointer = currentProfileAvatarPointer();
  return {
    profileVersion: pointer.profileVersion ?? 0,
    avatarHash: pointer.avatarHash ?? zeroAvatarHashHex(),
  };
}

function profileAvatarMediaCacheKey(avatarHash) {
  try {
    const normalized = normalizeAvatarHashHex(avatarHash);
    if (normalized === zeroAvatarHashHex()) return null;
    return `${PROFILE_AVATAR_MEDIA_CACHE_PREFIX}:${normalized}`;
  } catch {
    return null;
  }
}

function readProfileAvatarMediaCache(avatarHash) {
  const key = profileAvatarMediaCacheKey(avatarHash);
  if (!key) return null;
  try {
    const parsed = JSON.parse(localStorageOrNull()?.getItem(key) ?? 'null');
    if (!parsed || parsed.hash !== normalizeAvatarHashHex(avatarHash)) return null;
    if (typeof parsed.url !== 'string' || !parsed.url.startsWith('data:image/webp;base64,')) return null;
    return parsed.url;
  } catch {
    return null;
  }
}

function writeProfileAvatarMediaCache(avatarHash, dataUrl) {
  const key = profileAvatarMediaCacheKey(avatarHash);
  if (!key || typeof dataUrl !== 'string') return;
  try {
    localStorageOrNull()?.setItem(key, JSON.stringify({
      hash: normalizeAvatarHashHex(avatarHash),
      url: dataUrl,
      cachedAt: new Date().toISOString(),
    }));
  } catch {
    // Avatar media is reconstructable from chain; local cache is best effort.
  }
}

function avatarPointerFromFields(profileVersion, avatarHash) {
  try {
    const version = Number(profileVersion ?? 0);
    const hash = normalizeAvatarHashHex(avatarHash ?? zeroAvatarHashHex());
    if (!Number.isSafeInteger(version) || version <= 0 || hash === zeroAvatarHashHex()) return null;
    return { profileVersion: version, profile_version: version, avatarHash: hash, avatar_hash: hash };
  } catch {
    return null;
  }
}

function avatarPointerFromPublicPayload(payload) {
  return avatarPointerFromFields(payload?.profileVersion ?? payload?.profile_version, payload?.avatarHash ?? payload?.avatar_hash);
}

function avatarHashHexFromBigInt(value) {
  return normalizeAvatarHashHex(`0x${BigInt(value ?? 0n).toString(16).padStart(64, '0')}`);
}

function streamIdHexFromBigInt(value) {
  return `0x${BigInt(value ?? 0n).toString(16).padStart(32, '0')}`;
}

function setAvatarNode(node, fallback, imageUrl = null) {
  if (!node) return;
  if (imageUrl) {
    node.textContent = '';
    node.classList.add('has-image');
    node.style.backgroundImage = `url("${imageUrl}")`;
    return;
  }
  node.classList.remove('has-image');
  node.style.backgroundImage = '';
  node.textContent = String(fallback ?? 'P').slice(0, 2).toUpperCase();
}

function setText(node, value) {
  if (node) node.textContent = value ?? '';
}

function renderPaneHeaders() {
  setText(chatCountLabel, 'Private chats');
  setText(publicSubtitle, 'Public channels');
  setText(vaultSubtitle, 'Vault');
  setText(profileHandle, 'Profile');
}

function setPublicStatus(value) {
  if (value) console.debug('[public]', value);
}

function setVaultStatus(value) {
  if (value) console.debug('[vault]', value);
}

function appendIcon(parent, icon) {
  const span = document.createElement('span');
  span.className = `icon icon-${icon}`;
  parent.append(span);
}

function setIdentityLabel(node, thread, baseClass = 'identity-label') {
  if (thread?.localLabel) {
    node.textContent = thread.localLabel;
    node.className = baseClass;
    return;
  }
  const identity = primaryThreadIdentity(thread);
  node.textContent = identity?.label ?? thread?.name ?? '';
  node.className = `${baseClass}${identity ? ` identity-label-${identityTone(identity)}` : ''}`;
}

function identityVariantRow(identity, selected, onSelect) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = `identity-variant identity-label-${identityTone(identity)}`;
  row.setAttribute('role', 'menuitemradio');
  row.setAttribute('aria-checked', selected ? 'true' : 'false');
  const label = document.createElement('strong');
  label.textContent = identity.label ?? identity.value;
  const type = document.createElement('span');
  type.textContent = selected ? `${identityTypeLabel(identity)} - selected` : identityTypeLabel(identity);
  row.append(label, type);
  row.addEventListener('click', () => onSelect(identity));
  return row;
}

function ensureIdentityPopover() {
  if (identityPopover) return identityPopover;
  identityPopover = document.createElement('div');
  identityPopover.className = 'identity-popover';
  identityPopover.hidden = true;
  document.body.append(identityPopover);
  return identityPopover;
}

function hideIdentityPopover() {
  if (identityPopover) identityPopover.hidden = true;
  identityMenuButton?.setAttribute('aria-expanded', 'false');
}

function showIdentityPopover(thread, anchor) {
  const variants = threadIdentityVariants(thread);
  if (variants.length === 0 || !anchor) return;
  const selectedKey = identityKey(primaryThreadIdentity(thread));
  const popover = ensureIdentityPopover();
  popover.setAttribute('role', 'menu');
  popover.replaceChildren();
  const title = document.createElement('div');
  title.className = 'identity-popover-title';
  title.textContent = 'Display as';
  popover.append(title);
  for (const variant of variants) {
    popover.append(identityVariantRow(variant, identityKey(variant) === selectedKey, (selected) => {
      thread.displayIdentity = selected;
      thread.name = selected.label ?? selected.value;
      thread.subtitle = identityTypeLabel(selected);
      hideIdentityPopover();
      renderThreads();
      renderConversation();
    }));
  }
  const rect = anchor.getBoundingClientRect();
  popover.style.left = `${Math.min(rect.left, window.innerWidth - 280)}px`;
  popover.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 220)}px`;
  popover.hidden = false;
  identityMenuButton?.setAttribute('aria-expanded', 'true');
}

function renderConversationIdentity(thread) {
  if (thread?.localLabel) {
    activeTitle.textContent = thread.localLabel;
    if (identityMenuButton) {
      identityMenuButton.hidden = true;
      identityMenuButton.setAttribute('aria-expanded', 'false');
    }
    return;
  }
  const identity = primaryThreadIdentity(thread);
  if (!identity) {
    activeTitle.textContent = thread.name;
    if (identityMenuButton) identityMenuButton.hidden = true;
    return;
  }
  const label = document.createElement('span');
  label.className = `identity-title-label identity-label-${identityTone(identity)}`;
  label.textContent = identity.label;
  activeTitle.replaceChildren(label);
  if (identityMenuButton) {
    identityMenuButton.hidden = threadIdentityVariants(thread).length <= 1;
    identityMenuButton.setAttribute('aria-label', `Choose display name for ${identity.label}`);
    identityMenuButton.setAttribute('title', 'Choose display name');
  }
}

function openNewChatDialog() {
  if (!newChatDialog || !recipientInput || !recipientHint) return;
  recipientInput.value = '';
  if (recipientLocalLabel) recipientLocalLabel.value = '';
  recipientHint.textContent = 'Use a wallet address, xxxx.ton, or xxxx.ath. Local label is only shown on this device. Bare @xxxx is not accepted.';
  recipientHint.dataset.tone = 'muted';
  newChatDialog.hidden = false;
  requestAnimationFrame(() => recipientInput.focus());
}

function closeNewChatDialog() {
  if (newChatDialog) newChatDialog.hidden = true;
}

function collectActionDialogValues() {
  const values = {};
  for (const field of actionFields?.querySelectorAll('[name]') ?? []) {
    values[field.name] = field.value;
  }
  return values;
}

function renderActionSummary(summary, values = {}) {
  if (!actionSummary) return;
  const lines = typeof summary === 'function' ? summary(values) : summary;
  actionSummary.replaceChildren();
  if (!Array.isArray(lines) || lines.length === 0) {
    actionSummary.hidden = true;
    return;
  }
  actionSummary.hidden = false;
  for (const line of lines) {
    const row = document.createElement('div');
    if (typeof line === 'string') {
      row.textContent = line;
    } else {
      const label = document.createElement('strong');
      label.textContent = `${line.label}: `;
      row.append(label, document.createTextNode(String(line.value ?? '')));
    }
    actionSummary.append(row);
  }
}

function createActionField(field) {
  const wrapper = document.createElement('div');
  wrapper.className = 'action-field';
  const label = document.createElement('label');
  label.htmlFor = field.id;
  label.textContent = field.label;
  let input;
  if (field.type === 'textarea') {
    input = document.createElement('textarea');
  } else if (field.type === 'select') {
    input = document.createElement('select');
    for (const option of field.options ?? []) {
      const item = document.createElement('option');
      item.value = option.value;
      item.textContent = option.label;
      input.append(item);
    }
  } else {
    input = document.createElement('input');
    input.type = field.type ?? 'text';
  }
  input.id = field.id;
  input.name = field.id;
  if (field.placeholder) input.placeholder = field.placeholder;
  if (field.inputMode) input.inputMode = field.inputMode;
  if (field.autocomplete) input.autocomplete = field.autocomplete;
  if (field.maxLength) input.maxLength = field.maxLength;
  if (field.readOnly) input.readOnly = true;
  if (field.required !== false) input.required = true;
  input.value = field.value ?? '';
  wrapper.append(label, input);
  return wrapper;
}

function closeActionDialog(result = null) {
  if (!activeActionDialog) return;
  const { resolve } = activeActionDialog;
  activeActionDialog = null;
  if (actionDialog) actionDialog.hidden = true;
  actionFields?.replaceChildren();
  resolve(result);
}

async function openActionDialog(config = {}) {
  if (!actionDialog || !actionForm || !actionFields || !actionTitle || !actionHint || !actionSubmitButton) {
    throw new Error('Action dialog is unavailable');
  }
  if (activeActionDialog) closeActionDialog(null);
  return new Promise((resolve) => {
    activeActionDialog = { resolve, summary: config.summary };
    actionTitle.textContent = config.title ?? 'Action';
    actionHint.textContent = config.hint ?? 'Review details before signing.';
    actionHint.dataset.tone = config.tone ?? 'muted';
    actionSubmitButton.textContent = config.submitLabel ?? 'Continue';
    actionFields.replaceChildren(...(config.fields ?? []).map(createActionField));
    renderActionSummary(config.summary, collectActionDialogValues());
    actionDialog.hidden = false;
    requestAnimationFrame(() => actionFields.querySelector('textarea, input:not([readonly]), select')?.focus());
  });
}

function updateActiveActionSummary() {
  if (!activeActionDialog) return;
  renderActionSummary(activeActionDialog.summary, collectActionDialogValues());
}

function appDocById(id) {
  return APP_DOCS.find((doc) => doc.id === id) ?? APP_DOCS[0] ?? null;
}

function renderDocsNav() {
  if (!docsNav) return;
  docsNav.replaceChildren();
  for (const doc of APP_DOCS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.docId = doc.id;
    button.className = doc.id === activeDocId ? 'is-active' : '';
    button.setAttribute('aria-pressed', doc.id === activeDocId ? 'true' : 'false');
    button.textContent = doc.label;
    docsNav.append(button);
  }
}

function setDocsStatus(message, tone = 'muted') {
  if (!docsContent) return;
  const status = document.createElement('div');
  status.className = `docs-status docs-status-${tone}`;
  status.textContent = message;
  docsContent.replaceChildren(status);
}

function closeDocsDialog() {
  if (docsDialog) docsDialog.hidden = true;
}

async function openDocsDialog(docId = activeDocId) {
  if (!docsDialog) return;
  docsDialog.hidden = false;
  await selectDoc(docId);
  requestAnimationFrame(() => docsContent?.focus());
}

async function selectDoc(docId) {
  const doc = appDocById(docId);
  if (!doc || !docsContent) return;
  activeDocId = doc.id;
  renderDocsNav();
  if (docsTitle) docsTitle.textContent = doc.title;
  if (docsLead) docsLead.textContent = 'Protocol notes and application model.';
  setDocsStatus('Loading');
  try {
    let markdown = docsCache.get(doc.id);
    if (!markdown) {
      const response = await fetch(doc.path, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Document fetch failed: ${response.status}`);
      markdown = await response.text();
      docsCache.set(doc.id, markdown);
    }
    renderMarkdownToNode(markdown, docsContent);
    docsContent.scrollTop = 0;
  } catch (error) {
    console.error(error);
    setDocsStatus('Document unavailable', 'error');
  }
}

function appendInlineMarkdown(parent, text) {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(([^)]+)\))/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) {
      parent.append(document.createTextNode(text.slice(cursor, match.index)));
    }
    const token = match[0];
    if (token.startsWith('`')) {
      const code = document.createElement('code');
      code.textContent = token.slice(1, -1);
      parent.append(code);
    } else if (token.startsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = token.slice(2, -2);
      parent.append(strong);
    } else {
      const labelEnd = token.indexOf(']');
      const href = token.slice(labelEnd + 2, -1);
      const anchor = document.createElement('a');
      anchor.textContent = token.slice(1, labelEnd);
      if (/^(https?:|mailto:)/i.test(href)) {
        anchor.href = href;
        anchor.target = '_blank';
        anchor.rel = 'noreferrer';
      }
      parent.append(anchor);
    }
    cursor = match.index + token.length;
  }
  if (cursor < text.length) {
    parent.append(document.createTextNode(text.slice(cursor)));
  }
}

function isMarkdownTableLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|');
}

function isMarkdownTableSeparator(line) {
  if (!isMarkdownTableLine(line)) return false;
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function markdownTableCells(line) {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

function markdownStartsBlock(line, nextLine = '') {
  const trimmed = line.trim();
  return !trimmed
    || trimmed.startsWith('```')
    || /^#{1,4}\s+/.test(trimmed)
    || /^[-*]\s+/.test(trimmed)
    || /^\d+\.\s+/.test(trimmed)
    || (isMarkdownTableLine(line) && isMarkdownTableSeparator(nextLine));
}

function renderMarkdownTable(rows) {
  const wrapper = document.createElement('div');
  wrapper.className = 'docs-table-wrap';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const cellText of rows[0] ?? []) {
    const cell = document.createElement('th');
    appendInlineMarkdown(cell, cellText);
    headRow.append(cell);
  }
  thead.append(headRow);
  table.append(thead);
  const tbody = document.createElement('tbody');
  for (const row of rows.slice(1)) {
    const tr = document.createElement('tr');
    for (const cellText of row) {
      const cell = document.createElement('td');
      appendInlineMarkdown(cell, cellText);
      tr.append(cell);
    }
    tbody.append(tr);
  }
  table.append(tbody);
  wrapper.append(table);
  return wrapper;
}

function renderMarkdownToNode(markdown, target) {
  const root = document.createElement('div');
  root.className = 'docs-rendered';
  const lines = String(markdown ?? '').replace(/\r\n/g, '\n').split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      index += 1;
      continue;
    }
    if (trimmed.startsWith('```')) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = codeLines.join('\n');
      pre.append(code);
      root.append(pre);
      continue;
    }
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 5);
      const node = document.createElement(`h${level}`);
      appendInlineMarkdown(node, heading[2]);
      root.append(node);
      index += 1;
      continue;
    }
    if (isMarkdownTableLine(line) && isMarkdownTableSeparator(lines[index + 1] ?? '')) {
      const rows = [markdownTableCells(line)];
      index += 2;
      while (index < lines.length && isMarkdownTableLine(lines[index])) {
        rows.push(markdownTableCells(lines[index]));
        index += 1;
      }
      root.append(renderMarkdownTable(rows));
      continue;
    }
    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed);
      const list = document.createElement(ordered ? 'ol' : 'ul');
      const itemPattern = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      while (index < lines.length && itemPattern.test(lines[index].trim())) {
        const item = document.createElement('li');
        appendInlineMarkdown(item, lines[index].trim().replace(itemPattern, ''));
        list.append(item);
        index += 1;
      }
      root.append(list);
      continue;
    }
    const paragraphLines = [trimmed];
    index += 1;
    while (index < lines.length && !markdownStartsBlock(lines[index], lines[index + 1] ?? '')) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    const paragraph = document.createElement('p');
    appendInlineMarkdown(paragraph, paragraphLines.join(' '));
    root.append(paragraph);
  }
  target.replaceChildren(root);
}

function activeThread() {
  return threads.find((item) => item.id === activeThreadId) ?? threads[0] ?? null;
}

function selectOrCreateRecipientThread(input, options = {}) {
  const result = createRecipientThread(input, options);
  if (!result.ok) return result;
  const existing = threads.find((thread) => thread.id === result.thread.id);
  if (existing) {
    if (result.thread.localLabel) {
      existing.localLabel = result.thread.localLabel;
      existing.name = result.thread.name;
      existing.avatar = result.thread.avatar;
      existing.subtitle = result.thread.subtitle;
    }
    activeThreadId = existing.id;
  } else {
    threads.push(result.thread);
    activeThreadId = result.thread.id;
  }
  appShell.dataset.chatOpen = 'true';
  closeNewChatDialog();
  hydrateThreadAvatarFromPointer(
    threads.find((thread) => thread.id === activeThreadId),
    ownerWalletFromThread(threads.find((thread) => thread.id === activeThreadId)),
    null,
  ).catch((error) => console.error(error));
  renderThreads();
  renderConversation();
  return { ok: true };
}

function readCustomPublicChannels() {
  try {
    const parsed = JSON.parse(localStorageOrNull()?.getItem(PUBLIC_CUSTOM_CHANNELS_STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    const candidates = parsed.filter((item) => (
      item
      && typeof item === 'object'
      && item.id
      && (item.sourceUrl || item.authorWallet || item.author_wallet)
    ));
    return candidates.length > 0 ? normalizePublicChannelRegistry(candidates) : [];
  } catch {
    return [];
  }
}

function writeCustomPublicChannels() {
  try {
    localStorageOrNull()?.setItem(PUBLIC_CUSTOM_CHANNELS_STORAGE_KEY, JSON.stringify(customPublicChannels));
  } catch {
    // Non-persistent mode still keeps custom channels in memory for this tab.
  }
}

function rebuildPublicChannelRegistry() {
  publicChannelRegistry = normalizePublicChannelRegistry([
    ...basePublicChannelRegistry,
    ...customPublicChannels,
  ]);
  return publicChannelRegistry;
}

function publicChannelAvatar(label) {
  return String(label ?? 'P').trim().slice(0, 1).toUpperCase() || 'P';
}

function publicChannelSubtitleForIdentity(identity) {
  if (identity?.type === RECIPIENT_IDENTITY_TYPES.PLATHO_NFT) return 'Platho NFT public channel';
  if (identity?.type === RECIPIENT_IDENTITY_TYPES.TON_DNS) return 'TON DNS public channel';
  return 'wallet public channel';
}

function publicChannelRouteLabel(identity, authorWallet) {
  if (identity?.type === RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS) return shortAddress(authorWallet ?? identity.value);
  return identity?.label ?? shortAddress(authorWallet);
}

async function resolvePublicChannelIdentity(input) {
  const parsed = parseRecipientIdentity(input);
  if (!parsed.ok) throw new Error(parsed.error);
  const { identity } = parsed;

  if (identity.type === RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS) {
    return {
      identity,
      authorWallet: requireBasechainAddress(identity.value, 'Public channel author'),
    };
  }

  if (identity.type === RECIPIENT_IDENTITY_TYPES.PLATHO_NFT) {
    const provider = await resolveUsernameRegistryProvider();
    if (!provider?.getNameRecordByUsername) throw new Error('UsernameRegistry provider cannot resolve .ath names');
    const record = await provider.getNameRecordByUsername(identity.value, {
      address: requireUsernameRegistryAddress(),
    });
    if (record.exists !== true) throw new Error(`${identity.value} is not registered`);
    return {
      identity,
      authorWallet: requireBasechainAddress(record.owner_wallet, 'Public channel author'),
    };
  }

  if (identity.type === RECIPIENT_IDENTITY_TYPES.TON_DNS) {
    const provider = await resolveTonDnsProvider();
    if (!provider?.resolveWallet) throw new Error('TON DNS provider is not configured');
    const walletAddress = await provider.resolveWallet(identity.value, {
      rootAddress: appConfig.tonDns?.rootAddress ?? null,
    });
    return {
      identity,
      authorWallet: requireBasechainAddress(walletAddress, 'Public channel author'),
    };
  }

  throw new Error('Unsupported public channel identity');
}

function openPrivateThreadForWallet(walletAddress) {
  const result = selectOrCreateRecipientThread(walletAddress);
  if (!result.ok) {
    setPublicStatus(result.error ?? 'private chat unavailable');
    return false;
  }
  setView('chats');
  appShell.dataset.chatOpen = 'true';
  renderThreads();
  renderConversation();
  return true;
}

function addCustomPublicChannel(channel) {
  const normalized = normalizePublicChannelRegistry([channel]).find((item) => item.id === channel.id);
  if (!normalized) throw new Error('Channel needs an author wallet or feed URL');
  customPublicChannels = normalizePublicChannelRegistry([
    ...customPublicChannels.filter((item) => item.id !== normalized.id),
    normalized,
  ]);
  writeCustomPublicChannels();
  rebuildPublicChannelRegistry();
  const subscribedById = new Map((publicChannelSubscriptions?.channels ?? []).map((item) => [item.id, item]));
  subscribedById.set(normalized.id, { id: normalized.id, subscribed: true });
  publicChannelSubscriptions = {
    version: publicChannelSubscriptions?.version ?? 1,
    activeChannelId: normalized.id,
    channels: publicChannelRegistry.map((item) => ({
      id: item.id,
      subscribed: subscribedById.get(item.id)?.subscribed === true,
    })),
  };
  writePublicChannelSubscriptions(localStorageOrNull(), publicChannelSubscriptions);
  rebuildThreadsFromPublicSubscriptions({ preserveActive: true });
  publicDisplayMode = 'channels';
  renderPublicSurface();
}

function readPublicReadCursors() {
  try {
    const parsed = JSON.parse(localStorageOrNull()?.getItem(PUBLIC_READ_CURSORS_STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writePublicReadCursors() {
  try {
    localStorageOrNull()?.setItem(PUBLIC_READ_CURSORS_STORAGE_KEY, JSON.stringify(publicReadCursors));
  } catch {
    // Non-persistent mode still keeps read state for the current tab.
  }
}

function publicEntryIdBigInt(value) {
  if (value === undefined || value === null || value === '') return null;
  try {
    const bigint = BigInt(value);
    return bigint >= 0n ? bigint : null;
  } catch {
    return null;
  }
}

function publicChannelCursor(channelId) {
  return publicEntryIdBigInt(publicReadCursors?.[channelId]) ?? -1n;
}

function isUnreadPublicItem(item) {
  const entryId = publicEntryIdBigInt(item?.readEntryId ?? item?.entryId);
  if (entryId === null) return false;
  return entryId > publicChannelCursor(item.channelId ?? 'platho.app');
}

function publicFeedItemsChronological() {
  return publicChannelThreadsToFeedItems(publicChannelThreads).slice().reverse();
}

function publicUnreadCount(channelId) {
  let count = 0;
  for (const item of publicFeedItemsChronological()) {
    if (item.channelId !== channelId) continue;
    if (isUnreadPublicItem(item)) count += 1;
  }
  return count;
}

function markVisiblePublicFeedRead(items = publicFeedItemsChronological()) {
  let changed = false;
  for (const item of items) {
    const entryId = publicEntryIdBigInt(item.readEntryId ?? item.entryId);
    if (entryId === null) continue;
    const channelId = item.channelId ?? 'platho.app';
    if (entryId > publicChannelCursor(channelId)) {
      publicReadCursors = {
        ...publicReadCursors,
        [channelId]: entryId.toString(),
      };
      changed = true;
    }
  }
  if (changed) writePublicReadCursors();
  return changed;
}

function publicFeedCacheForCurrentWindow() {
  const cutoffMs = publicSyncCutoffMs();
  if (cutoffMs === null) return publicChannelFeedCache;
  const out = {};
  for (const [channelId, record] of Object.entries(publicChannelFeedCache ?? {})) {
    const feed = record?.feed ?? record;
    if (!feed?.posts) {
      out[channelId] = record;
      continue;
    }
    const filteredFeed = {
      ...feed,
      posts: feed.posts
        .filter((post) => isFreshPublicTimestamp(post.createdAt, cutoffMs))
        .map((post) => ({
          ...post,
          comments: (post.comments ?? []).filter((comment) => isFreshPublicTimestamp(comment.createdAt, cutoffMs)),
        })),
    };
    out[channelId] = record?.feed ? { ...record, feed: filteredFeed } : filteredFeed;
  }
  return out;
}

function scrollPublicToOldestUnread() {
  requestAnimationFrame(() => {
    const target = publicFeed?.querySelector?.('.feed-item[data-unread="true"]');
    if (target?.scrollIntoView) {
      target.scrollIntoView({ block: 'start' });
    }
    updatePublicJumpDownVisibility();
  });
}

function updatePublicJumpDownVisibility() {
  if (!publicJumpDownButton || !publicFeed) return;
  if (publicDisplayMode !== 'feed') {
    publicJumpDownButton.hidden = true;
    return;
  }
  const maxScroll = Math.max(0, publicFeed.scrollHeight - publicFeed.clientHeight);
  const awayFromNewest = publicFeed.scrollTop < maxScroll - 80;
  publicJumpDownButton.hidden = !(maxScroll > 24 && awayFromNewest);
}

function updatePublicModeButtons() {
  if (publicPane) publicPane.dataset.publicMode = publicDisplayMode;
  publicFeedModeButton?.setAttribute('aria-pressed', publicDisplayMode === 'feed' ? 'true' : 'false');
  publicChannelsModeButton?.setAttribute('aria-pressed', publicDisplayMode === 'channels' ? 'true' : 'false');
  if (publicChannelSearch) publicChannelSearch.placeholder = publicDisplayMode === 'channels' ? 'Search channels' : 'Search public';
  updatePublicJumpDownVisibility();
  if (publicComposer) publicComposer.hidden = false;
  if (publicChannelDetail) publicChannelDetail.hidden = publicDisplayMode !== 'channels';
}

function publicFeedItemMatchesSearch(item, query) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return true;
  const channel = publicChannelRegistry.find((entry) => entry.id === item.channelId) ?? null;
  const haystack = [
    item.title,
    item.text,
    item.author,
    item.authorWallet,
    item.bodyHash,
    item.channelId,
    channel?.name,
    channel?.subtitle,
    channel?.authorWallet,
    ...(item.meta ?? []),
    ...((item.comments ?? []).flatMap((comment) => [
      comment.author,
      comment.authorWallet,
      comment.text,
    ])),
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(needle);
}

function renderPublicEmpty(titleText, bodyText) {
  if (!publicFeed) return;
  const empty = document.createElement('article');
  empty.className = 'feed-item compact';
  const title = document.createElement('h2');
  title.textContent = titleText;
  const text = document.createElement('p');
  text.textContent = bodyText;
  empty.append(title, text);
  publicFeed.append(empty);
}

function appendPublicItemComments(article, item) {
  const comments = Array.isArray(item?.comments) ? item.comments : [];
  if (comments.length === 0) return;
  const commentList = document.createElement('div');
  commentList.className = 'comment-list';
  for (const comment of comments) {
    const row = document.createElement('article');
    row.className = 'comment-item';
    const commentAuthorRow = document.createElement('div');
    commentAuthorRow.className = 'feed-author-row';
    const commentAvatar = document.createElement('div');
    commentAvatar.className = 'avatar feed-avatar';
    commentAvatar.setAttribute('aria-hidden', 'true');
    setAvatarNode(commentAvatar, String(comment.author ?? 'P').slice(0, 1), comment.avatarImageUrl);
    const commentMeta = document.createElement('div');
    commentMeta.className = 'feed-meta';
    commentMeta.textContent = [comment.author, comment.createdAt?.slice?.(0, 10)].filter(Boolean).join(' - ');
    commentAuthorRow.append(commentAvatar, commentMeta);
    row.append(commentAuthorRow);
    if (comment.text) {
      const commentText = document.createElement('p');
      commentText.textContent = comment.text;
      row.append(commentText);
    }
    if (comment.imageUrl) {
      const image = document.createElement('img');
      image.className = 'feed-image';
      image.src = comment.imageUrl;
      image.alt = '';
      image.loading = 'lazy';
      row.append(image);
    }
    commentList.append(row);
  }
  article.append(commentList);
}

function appendPublicItemActions(article, item) {
  const actions = document.createElement('div');
  actions.className = 'feed-actions';
  const commentButton = document.createElement('button');
  commentButton.type = 'button';
  const commentsAllowed = item.commentsAllowed !== false;
  const hasChainCommentTarget = item.entryId !== undefined
    && item.entryId !== null
    && /^0x[0-9a-fA-F]{64}$/.test(String(item.bodyHash ?? ''));
  const canComment = Boolean(commentsAllowed && plathoWallet && hasChainCommentTarget);
  if (!commentsAllowed) {
    commentButton.textContent = 'Comments off';
  } else if (!hasChainCommentTarget) {
    commentButton.textContent = 'Preview only';
  } else if (!plathoWallet) {
    commentButton.textContent = 'Create wallet';
  } else {
    commentButton.textContent = 'Comment';
  }
  commentButton.disabled = !canComment;
  commentButton.title = !commentsAllowed
    ? 'The author closed comments for this post'
    : (!hasChainCommentTarget
        ? 'This preview post is not an on-chain capsule yet'
        : (canComment ? 'Write one immutable public comment' : 'Create or import a Platho wallet to comment'));
  commentButton.addEventListener('click', async () => {
    if (!canComment) return;
    setPublicCommentTarget(item);
  });
  actions.append(commentButton);

  const privateButton = document.createElement('button');
  privateButton.type = 'button';
  privateButton.textContent = 'Private chat';
  const authorWallet = item.authorWallet ?? item.author_wallet ?? null;
  privateButton.disabled = !authorWallet;
  privateButton.title = authorWallet
    ? 'Open this author in Private'
    : 'Author wallet is not available for this public item';
  privateButton.addEventListener('click', () => {
    if (!authorWallet) return;
    openPrivateThreadForWallet(authorWallet);
  });
  actions.append(privateButton);
  article.append(actions);
}

function renderPublicFeed(items, options = {}) {
  if (!publicFeed) return;
  publicFeed.dataset.publicMode = 'feed';
  if (publicChannelDetail) publicChannelDetail.replaceChildren();
  publicFeed.replaceChildren();
  if ((items ?? []).length === 0) {
    renderPublicEmpty(publicChannelSearchQuery ? 'No public posts found' : 'No public posts', publicChannelSearchQuery ? 'Try another search.' : 'Follow a channel or publish the first post.');
    requestAnimationFrame(updatePublicJumpDownVisibility);
    return;
  }
  for (const item of items ?? []) {
    const unread = isUnreadPublicItem(item);
    const article = document.createElement('article');
    article.className = `feed-item${item.compact ? ' compact' : ''}${unread ? ' is-unread' : ''}`;
    if (unread) article.dataset.unread = 'true';
    if (item.entryId !== undefined && item.entryId !== null) article.dataset.entryId = String(item.entryId);
    if (item.channelId) article.dataset.channelId = item.channelId;
    const authorRow = document.createElement('div');
    authorRow.className = 'feed-author-row';
    const authorAvatar = document.createElement('div');
    authorAvatar.className = 'avatar feed-avatar';
    authorAvatar.setAttribute('aria-hidden', 'true');
    setAvatarNode(authorAvatar, String(item.author ?? item.title ?? 'P').slice(0, 1), item.avatarImageUrl);
    const meta = document.createElement('div');
    meta.className = 'feed-meta';
    for (const label of [...(item.meta ?? []), unread ? 'unread' : null].filter(Boolean)) {
      const span = document.createElement('span');
      span.textContent = label;
      meta.append(span);
    }
    authorRow.append(authorAvatar, meta);
    article.append(authorRow);
    if (item.title) {
      const title = document.createElement('h2');
      title.textContent = item.title;
      article.append(title);
    }
    if (item.text) {
      const text = document.createElement('p');
      text.textContent = item.text;
      article.append(text);
    }
    if (item.imageUrl) {
      const image = document.createElement('img');
      image.className = 'feed-image';
      image.src = item.imageUrl;
      image.alt = '';
      image.loading = 'lazy';
      article.append(image);
    }
    const comments = Array.isArray(item.comments) ? item.comments : [];
    if (comments.length > 0) {
      const commentList = document.createElement('div');
      commentList.className = 'comment-list';
      for (const comment of comments) {
        const row = document.createElement('article');
        row.className = 'comment-item';
        const commentAuthorRow = document.createElement('div');
        commentAuthorRow.className = 'feed-author-row';
        const commentAvatar = document.createElement('div');
        commentAvatar.className = 'avatar feed-avatar';
        commentAvatar.setAttribute('aria-hidden', 'true');
        setAvatarNode(commentAvatar, String(comment.author ?? 'P').slice(0, 1), comment.avatarImageUrl);
        const commentMeta = document.createElement('div');
        commentMeta.className = 'feed-meta';
        commentMeta.textContent = [comment.author, comment.createdAt?.slice?.(0, 10)].filter(Boolean).join(' В· ');
        commentAuthorRow.append(commentAvatar, commentMeta);
        row.append(commentAuthorRow);
        if (comment.text) {
          const commentText = document.createElement('p');
          commentText.textContent = comment.text;
          row.append(commentText);
        }
        if (comment.imageUrl) {
          const image = document.createElement('img');
          image.className = 'feed-image';
          image.src = comment.imageUrl;
          image.alt = '';
          image.loading = 'lazy';
          row.append(image);
        }
        commentList.append(row);
      }
      article.append(commentList);
    }
    const actions = document.createElement('div');
    actions.className = 'feed-actions';
    const commentButton = document.createElement('button');
    commentButton.type = 'button';
    const commentsAllowed = item.commentsAllowed !== false;
    const hasChainCommentTarget = item.entryId !== undefined
      && item.entryId !== null
      && /^0x[0-9a-fA-F]{64}$/.test(String(item.bodyHash ?? ''));
    const canComment = Boolean(commentsAllowed && plathoWallet && hasChainCommentTarget);
    if (!commentsAllowed) {
      commentButton.textContent = 'Comments off';
    } else if (!hasChainCommentTarget) {
      commentButton.textContent = 'Preview only';
    } else if (!plathoWallet) {
      commentButton.textContent = 'Create wallet';
    } else {
      commentButton.textContent = 'Comment';
    }
    commentButton.disabled = !canComment;
    commentButton.title = !commentsAllowed
      ? 'The author closed comments for this post'
      : (!hasChainCommentTarget
          ? 'This preview post is not an on-chain capsule yet'
          : (canComment ? 'Write one immutable public comment' : 'Create or import a Platho wallet to comment'));
    commentButton.addEventListener('click', async () => {
      if (!canComment) return;
      setPublicCommentTarget(item);
    });
    actions.append(commentButton);
    const privateButton = document.createElement('button');
    privateButton.type = 'button';
    privateButton.textContent = 'Private chat';
    const authorWallet = item.authorWallet ?? item.author_wallet ?? null;
    privateButton.disabled = !authorWallet;
    privateButton.title = authorWallet
      ? 'Open this author in Private'
      : 'Author wallet is not available for this public item';
    privateButton.addEventListener('click', () => {
      if (!authorWallet) return;
      openPrivateThreadForWallet(authorWallet);
    });
    actions.append(privateButton);
    article.append(actions);
    publicFeed.append(article);
  }
  if (options.anchorUnread) scrollPublicToOldestUnread();
  requestAnimationFrame(updatePublicJumpDownVisibility);
}

function appendPublicChannelPost(container, item) {
  const article = document.createElement('article');
  article.className = `feed-item compact${isUnreadPublicItem(item) ? ' is-unread' : ''}`;
  const authorRow = document.createElement('div');
  authorRow.className = 'feed-author-row';
  const avatar = document.createElement('div');
  avatar.className = 'avatar feed-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  setAvatarNode(avatar, String(item.author ?? item.title ?? 'P').slice(0, 1), item.avatarImageUrl);
  const meta = document.createElement('div');
  meta.className = 'feed-meta';
  for (const label of [...(item.meta ?? []), item.createdAt?.slice?.(0, 10)].filter(Boolean)) {
    const span = document.createElement('span');
    span.textContent = label;
    meta.append(span);
  }
  authorRow.append(avatar, meta);
  article.append(authorRow);
  if (item.title) {
    const title = document.createElement('h2');
    title.textContent = item.title;
    article.append(title);
  }
  if (item.text) {
    const text = document.createElement('p');
    text.textContent = item.text;
    article.append(text);
  }
  if (item.imageUrl) {
    const image = document.createElement('img');
    image.className = 'feed-image';
    image.src = item.imageUrl;
    image.alt = '';
    image.loading = 'lazy';
    article.append(image);
  }
  appendPublicItemComments(article, item);
  appendPublicItemActions(article, item);
  container.append(article);
}

function renderPublicChannelDetail(channel, items) {
  if (!publicChannelDetail) return;
  publicChannelDetail.replaceChildren();
  if (!channel) {
    const empty = document.createElement('div');
    empty.className = 'empty-state public-channel-empty';
    const title = document.createElement('h2');
    title.textContent = 'No channel selected';
    const body = document.createElement('p');
    body.textContent = 'Choose a public channel from the list.';
    empty.append(title, body);
    publicChannelDetail.append(empty);
    return;
  }
  const latestPost = items?.[items.length - 1] ?? null;
  const header = document.createElement('header');
  header.className = 'public-channel-detail-header';
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.setAttribute('aria-hidden', 'true');
  setAvatarNode(avatar, channel.avatar, latestPost?.avatarImageUrl);
  const titleWrap = document.createElement('div');
  titleWrap.className = 'conversation-title';
  const title = document.createElement('h2');
  title.textContent = channel.name;
  const subtitle = document.createElement('p');
  subtitle.textContent = channel.subtitle ?? 'public channel';
  titleWrap.append(title, subtitle);
  header.append(avatar, titleWrap);

  const list = document.createElement('div');
  list.className = 'public-channel-detail-feed';
  if ((items ?? []).length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state public-channel-empty';
    const emptyTitle = document.createElement('h2');
    emptyTitle.textContent = 'No posts yet';
    const emptyBody = document.createElement('p');
    emptyBody.textContent = 'This channel has no visible posts in the current history window.';
    empty.append(emptyTitle, emptyBody);
    list.append(empty);
  } else {
    for (const item of items ?? []) appendPublicChannelPost(list, item);
  }
  publicChannelDetail.append(header, list);
}

function renderPublicChannels() {
  if (!publicFeed) return;
  publicFeed.dataset.publicMode = 'channels';
  publicFeed.replaceChildren();
  const query = publicChannelSearchQuery.trim().toLowerCase();
  const channels = subscribedPublicChannels(publicChannelSubscriptions, publicChannelRegistry)
    .filter((channel) => {
      if (!query) return true;
      return [
        channel.name,
        channel.id,
        channel.subtitle,
        channel.authorWallet,
        channel.sourceUrl,
      ].filter(Boolean).join(' ').toLowerCase().includes(query);
    });
  if (channels.length === 0) {
    renderPublicEmpty(query ? 'No channels found' : 'No public channels', query ? 'Try another search.' : 'Add a channel to follow public posts.');
    renderPublicChannelDetail(null, []);
    return;
  }
  const activeChannelId = channels.some((channel) => channel.id === publicChannelSubscriptions?.activeChannelId)
    ? publicChannelSubscriptions?.activeChannelId
    : channels[0]?.id;
  for (const channel of channels) {
    const unread = publicUnreadCount(channel.id);
    const cachedFeed = publicChannelFeedCache?.[channel.id]?.feed ?? publicChannelFeedCache?.[channel.id] ?? null;
    const latestPost = cachedFeed?.posts?.[cachedFeed.posts.length - 1] ?? null;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `thread-item public-channel-item${unread > 0 ? ' is-unread' : ''}${channel.id === activeChannelId ? ' is-selected' : ''}`;
    const channelAvatar = document.createElement('div');
    channelAvatar.className = 'avatar';
    channelAvatar.setAttribute('aria-hidden', 'true');
    setAvatarNode(channelAvatar, channel.avatar, latestPost?.avatarImageUrl);
    const main = document.createElement('div');
    main.className = 'thread-main';
    const top = document.createElement('div');
    top.className = 'thread-top';
    const name = document.createElement('div');
    name.className = 'thread-name';
    name.textContent = channel.name;
    top.append(name);
    const preview = document.createElement('div');
    preview.className = 'thread-preview';
    preview.textContent = unread > 0
      ? `${unread} unread post${unread === 1 ? '' : 's'}`
      : (latestPost?.text || 'No unread posts');
    const state = document.createElement('div');
    state.className = 'thread-state';
    state.textContent = channel.authorWallet ? shortAddress(channel.authorWallet) : (channel.subtitle ?? 'public channel');
    main.append(top, preview, state);
    const time = document.createElement('div');
    time.className = 'thread-time';
    time.textContent = unread > 0 ? 'unread' : (latestPost?.createdAt?.slice?.(5, 10) ?? '');
    card.append(channelAvatar, main, time);
    card.addEventListener('click', () => {
      publicChannelSubscriptions = {
        ...publicChannelSubscriptions,
        activeChannelId: channel.id,
      };
      writePublicChannelSubscriptions(localStorageOrNull(), publicChannelSubscriptions);
      renderPublicSurface({ anchorUnread: false });
    });
    publicFeed.append(card);
  }
  const activeChannel = channels.find((channel) => channel.id === activeChannelId) ?? channels[0] ?? null;
  const activeItems = publicFeedItemsChronological().filter((item) => item.channelId === activeChannel?.id);
  renderPublicChannelDetail(activeChannel, activeItems);
}

function renderPublicSurface(options = {}) {
  updatePublicModeButtons();
  if (publicChannelSearchRow) publicChannelSearchRow.hidden = false;
  if (publicDisplayMode === 'channels') {
    renderPublicChannels();
    setPublicStatus('channels');
    updatePublicJumpDownVisibility();
    return;
  }
  const allItems = publicFeedItemsChronological();
  const items = allItems.filter((item) => publicFeedItemMatchesSearch(item, publicChannelSearchQuery));
  renderPublicFeed(items, options);
  const unread = allItems.filter(isUnreadPublicItem).length;
  setPublicStatus(publicChannelSearchQuery ? `${items.length} found` : (unread > 0 ? `${unread} unread` : 'feed'));
}

function setPublicCommentTarget(item = null) {
  publicCommentTarget = item;
  const active = Boolean(item);
  if (publicComposer) publicComposer.dataset.mode = active ? 'comment' : 'post';
  if (publicCommentContext) publicCommentContext.hidden = !active;
  if (publicPostCommentsToggle) publicPostCommentsToggle.hidden = active;
  if (active) {
    setText(publicCommentContextText, `Comment to ${item.title ?? item.id ?? 'post'}`);
    if (publicMessageInput) {
      publicMessageInput.placeholder = publicComposerPlaceholder();
      publicMessageInput.focus();
    }
  } else {
    if (publicMessageInput) {
      publicMessageInput.placeholder = publicComposerPlaceholder();
    }
    if (publicComposerCommentsCheckbox) publicComposerCommentsCheckbox.checked = readPublicCommentsDefault() !== 'disabled';
  }
  refreshComposerPublishPolicy();
  refreshComposerCostStatus();
}

async function confirmPublicCommentsRisk() {
  const result = await openActionDialog({
    title: 'Open public comments?',
    hint: 'Not recommended unless you are ready to keep every comment visible forever.',
    tone: 'error',
    submitLabel: 'Publish with comments',
    fields: [],
    summary: [
      'Anyone can write an immutable public comment under this post.',
      'Spam, ads, illegal links, porn, and other abuse cannot be deleted or hidden by the protocol.',
      'Close comments for this post if you do not want that risk.',
    ],
  });
  return result !== null;
}

function renderVaultCards(cards) {
  if (!balanceGrid) return;
  balanceGrid.replaceChildren();
  const visibleCards = cards ?? [];
  balanceGrid.hidden = visibleCards.length === 0;
  for (const card of visibleCards) {
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
  const visibleActions = actions ?? [];
  actionGrid.hidden = visibleActions.length === 0;
  for (const action of visibleActions) {
    const button = document.createElement('button');
    button.type = 'button';
    if (action.id) button.dataset.action = action.id;
    appendIcon(button, action.icon ?? 'bolt');
    button.append(document.createTextNode(action.label ?? ''));
    actionGrid.append(button);
  }
}

function renderLedgerRows(rows) {
  if (!ledgerRows) return;
  ledgerRows.replaceChildren();
  const visibleRows = rows ?? [];
  ledgerRows.hidden = visibleRows.length === 0;
  for (const row of visibleRows) {
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
  renderPaneHeaders();
  setText(identityName, ui.identityName);
  setText(identitySubtitle, ui.identitySubtitle);
  setText(walletRuntimeLabel, ui.walletLabel);
  setText(localStateLabel, ui.localStateLabel);
  setText(networkRuntimeLabel, ui.networkLabel ?? appConfig.network?.label);
  renderVaultCards(ui.vaultCards);
  renderVaultActions(ui.vaultActions);
  renderLedgerRows(ui.ledgerRows);
}

function clonePreviewThreads() {
  return previewThreads.map((thread) => ({
    ...thread,
    messages: (thread.messages ?? []).map((message) => ({ ...message })),
  }));
}

function rebuildThreadsFromPublicSubscriptions(options = {}) {
  const preserveActive = options.preserveActive ?? true;
  const previousActive = activeThreadId;
  const nonPublicThreads = threads.length > 0
    ? threads.filter((thread) => !thread.publicChannelId)
    : clonePreviewThreads();

  publicChannelThreads = publicChannelSubscriptionsToThreads(
    publicChannelSubscriptions,
    publicChannelRegistry,
    publicFeedCacheForCurrentWindow(),
  );
  threads = nonPublicThreads;

  if (preserveActive && previousActive && threads.some((thread) => thread.id === previousActive)) {
    activeThreadId = previousActive;
  } else {
    activeThreadId = threads[0]?.id ?? null;
  }

  renderPublicSurface({ anchorUnread: false });
  renderPaneHeaders();
}

function configuredCapsuleHubAddress() {
  return appConfig.capsuleHub?.address
    ?? globalThis.plathoCapsuleHubAddress
    ?? globalThis.PLATHO_CAPSULEHUB_ADDRESS
    ?? null;
}

function configuredProfileRegistryAddress() {
  return appConfig.profileRegistry?.address
    ?? globalThis.plathoProfileRegistryAddress
    ?? globalThis.PLATHO_PROFILE_REGISTRY_ADDRESS
    ?? null;
}

async function resolveCapsuleHubProvider() {
  const address = configuredCapsuleHubAddress();
  if (!address) return null;
  const provider = globalThis.plathoCapsuleHubProvider
    ?? createCapsuleHubTonRpcProvider({ capsuleHubAddress: address });
  if (!provider?.getState || !provider?.getPublicEntry || !provider?.getPrivateEntry) {
    throw new Error('CapsuleHub provider cannot read entries');
  }
  return { provider, address };
}

async function resolveProfileRegistryProvider() {
  const address = configuredProfileRegistryAddress();
  if (!address) return null;
  const provider = globalThis.plathoProfileRegistryProvider
    ?? createProfileRegistryTonRpcProvider({ profileRegistryAddress: address });
  if (!provider?.getAvatar || !provider?.getAvatarVersion) {
    throw new Error('ProfileRegistry provider cannot read avatars');
  }
  return { provider, address };
}

function uint256Hex(value) {
  return `0x${BigInt(value).toString(16).padStart(64, '0')}`;
}

function profileAvatarPointerFromRecord(record) {
  if (!record?.exists) return null;
  const pointer = avatarPointerFromFields(Number(record.version ?? 0n), avatarHashHexFromBigInt(record.avatar_hash ?? 0n));
  if (!pointer) return null;
  return {
    ...pointer,
    ownerWallet: record.owner_wallet,
    owner_wallet: record.owner_wallet,
    avatarEntryId: BigInt(record.avatar_entry_id ?? 0n),
    avatar_entry_id: BigInt(record.avatar_entry_id ?? 0n),
    avatarStreamId: streamIdHexFromBigInt(record.avatar_stream_id ?? 0n),
    avatar_stream_id: streamIdHexFromBigInt(record.avatar_stream_id ?? 0n),
    avatarPartCount: Number(record.avatar_part_count ?? 0n),
    avatar_part_count: Number(record.avatar_part_count ?? 0n),
    mediaFormat: Number(record.media_format ?? 0n),
    media_format: Number(record.media_format ?? 0n),
  };
}

function publicAvatarPartMatches(payload, ownerWallet, pointer) {
  if (payload?.type !== 'avatar') return false;
  if (String(payload.avatarHash ?? payload.avatar_hash ?? '').toLowerCase() !== pointer.avatarHash.toLowerCase()) return false;
  if (pointer.avatarStreamId && String(payload.stream_id ?? '').toLowerCase() !== pointer.avatarStreamId.toLowerCase()) return false;
  if (pointer.avatarPartCount && Number(payload.partCount ?? payload.part_count ?? 0) !== Number(pointer.avatarPartCount)) return false;
  if (ownerWallet && payload.authorWallet && String(payload.authorWallet) !== String(ownerWallet)) return false;
  return true;
}

function assembleAvatarParts(parts, pointer) {
  const expected = Number(pointer.avatarPartCount ?? pointer.partCount ?? 0);
  if (!Number.isSafeInteger(expected) || expected <= 0 || expected > 16) return null;
  const unique = new Map();
  for (const part of parts ?? []) {
    const index = Number(part.partIndex ?? part.part_index ?? -1);
    if (!Number.isSafeInteger(index) || index < 0 || index >= expected) continue;
    unique.set(index, part);
  }
  if (unique.size !== expected) return null;
  const ordered = [...unique.values()].sort((a, b) => Number(a.partIndex ?? 0) - Number(b.partIndex ?? 0));
  const bytes = new Uint8Array(ordered.reduce((sum, item) => sum + (item.imageBytes?.length ?? item.image_bytes?.length ?? 0), 0));
  let offset = 0;
  for (const item of ordered) {
    const chunk = item.imageBytes ?? item.image_bytes;
    if (!chunk?.length) return null;
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

async function cacheAssembledAvatarParts(parts, pointer) {
  const bytes = assembleAvatarParts(parts, pointer);
  if (!bytes) return null;
  const hash = await sha256Hex(bytes);
  if (hash.toLowerCase() !== pointer.avatarHash.toLowerCase()) return null;
  const url = bytesToImageDataUrl(bytes, 'image/webp');
  writeProfileAvatarMediaCache(pointer.avatarHash, url);
  return url;
}

async function readAvatarPartsFromCapsuleHub(ownerWallet, pointer, options = {}) {
  const cached = readProfileAvatarMediaCache(pointer?.avatarHash);
  if (cached) return cached;
  const resolved = await resolveCapsuleHubProvider();
  if (!resolved || !pointer) return null;
  const { provider, address } = resolved;
  const parts = [];
  const start = publicEntryIdBigInt(pointer.avatarEntryId ?? pointer.avatar_entry_id);
  if (start !== null && start > 0n) {
    const maxExtra = BigInt(Math.max(PROFILE_AVATAR_ENTRY_SCAN_PADDING, Number(pointer.avatarPartCount ?? 0) + PROFILE_AVATAR_ENTRY_SCAN_PADDING));
    for (let entryId = start; entryId <= start + maxExtra; entryId += 1n) {
      try {
        const entry = await provider.getPublicEntry(entryId, { capsuleHubAddress: address });
        if (entry.exists !== true) continue;
        const payload = readPublicPostPayload({ header_boc: entry.header_boc, body_boc: entry.body_boc }, { maxBytes: SINGLE_CAPSULE_USEFUL_BYTES });
        payload.authorWallet = String(entry.author_wallet ?? '');
        if (!publicAvatarPartMatches(payload, ownerWallet, pointer)) continue;
        parts.push({
          ...payload,
          entryId: entry.entry_id?.toString?.() ?? entryId.toString(),
          imageBytes: payload.imageBytes ?? payload.image_bytes,
        });
        if (parts.length >= Number(pointer.avatarPartCount ?? 0)) break;
      } catch (error) {
        if (!/not found|missing|does not exist/i.test(String(error?.message ?? error))) console.error(error);
      }
    }
    const assembled = await cacheAssembledAvatarParts(parts, pointer);
    if (assembled) return assembled;
  }

  const state = await provider.getState({ capsuleHubAddress: address });
  const latest = BigInt(state.public_latest_id ?? 0n);
  const limit = BigInt(options.scanLimit ?? appConfig.capsuleHub?.publicAvatarReadLimit ?? PROFILE_AVATAR_FALLBACK_SCAN_LIMIT);
  const floor = latest > limit ? latest - limit : 0n;
  for (let entryId = latest - 1n; entryId >= floor; entryId -= 1n) {
    const entry = await provider.getPublicEntry(entryId, { capsuleHubAddress: address });
    if (entry.exists !== true) {
      if (entryId === 0n) break;
      continue;
    }
    const payload = readPublicPostPayload({ header_boc: entry.header_boc, body_boc: entry.body_boc }, { maxBytes: SINGLE_CAPSULE_USEFUL_BYTES });
    payload.authorWallet = String(entry.author_wallet ?? '');
    if (publicAvatarPartMatches(payload, ownerWallet, pointer)) {
      parts.push({
        ...payload,
        entryId: entry.entry_id?.toString?.() ?? entryId.toString(),
        imageBytes: payload.imageBytes ?? payload.image_bytes,
      });
      if (parts.length >= Number(pointer.avatarPartCount ?? 0)) break;
    }
    if (entryId === 0n) break;
  }
  return cacheAssembledAvatarParts(parts, pointer);
}

async function findPublishedAvatarEntries(ownerWallet, pointer) {
  const resolved = await resolveCapsuleHubProvider();
  if (!resolved) throw new Error('CapsuleHub provider is required to confirm avatar capsules');
  const { provider, address } = resolved;
  const expectedParts = Number(pointer.avatarPartCount ?? 0);
  if (!Number.isSafeInteger(expectedParts) || expectedParts <= 0) throw new Error('Avatar part count is invalid');
  const state = await provider.getState({ capsuleHubAddress: address });
  const latest = BigInt(state.public_latest_id ?? 0n);
  const parts = [];
  const limit = BigInt(Math.max(PROFILE_AVATAR_FALLBACK_SCAN_LIMIT, expectedParts + PROFILE_AVATAR_ENTRY_SCAN_PADDING));
  const floor = latest > limit ? latest - limit : 0n;
  for (let entryId = latest - 1n; entryId >= floor; entryId -= 1n) {
    const entry = await provider.getPublicEntry(entryId, { capsuleHubAddress: address });
    if (entry.exists === true) {
      const payload = readPublicPostPayload({ header_boc: entry.header_boc, body_boc: entry.body_boc }, { maxBytes: SINGLE_CAPSULE_USEFUL_BYTES });
      payload.authorWallet = String(entry.author_wallet ?? '');
      if (publicAvatarPartMatches(payload, ownerWallet, pointer)) {
        parts.push({
          ...payload,
          entryId: entry.entry_id?.toString?.() ?? entryId.toString(),
          imageBytes: payload.imageBytes ?? payload.image_bytes,
        });
        if (parts.length >= expectedParts) break;
      }
    }
    if (entryId === 0n) break;
  }
  const imageUrl = await cacheAssembledAvatarParts(parts, pointer);
  if (!imageUrl) return null;
  const firstEntryId = parts.reduce((min, part) => {
    const value = publicEntryIdBigInt(part.entryId) ?? min;
    return value < min ? value : min;
  }, publicEntryIdBigInt(parts[0]?.entryId) ?? 0n);
  return { imageUrl, firstEntryId, parts };
}

async function waitForPublishedAvatarEntries(ownerWallet, pointer) {
  for (let attempt = 0; attempt < PROFILE_AVATAR_PUBLISH_CONFIRM_ATTEMPTS; attempt += 1) {
    const found = await findPublishedAvatarEntries(ownerWallet, pointer);
    if (found) return found;
    await delay(PROFILE_AVATAR_PUBLISH_CONFIRM_DELAY_MS);
  }
  throw new Error('Avatar capsules are not visible on-chain yet');
}

async function waitForProfileAvatarRegistryUpdate(ownerWallet, avatarHash) {
  const expectedHash = normalizeAvatarHashHex(avatarHash);
  for (let attempt = 0; attempt < PROFILE_AVATAR_PUBLISH_CONFIRM_ATTEMPTS; attempt += 1) {
    const pointer = await readCurrentProfileAvatarPointerFromChain(ownerWallet, { required: true });
    if (pointer?.avatarHash?.toLowerCase() === expectedHash.toLowerCase()) return pointer;
    await delay(PROFILE_AVATAR_PUBLISH_CONFIRM_DELAY_MS);
  }
  throw new Error('Avatar registry update is not visible on-chain yet');
}

async function loadProfileAvatarImage(ownerWallet, pointer = null) {
  if (!ownerWallet) return null;
  const requestedPointer = pointer ? avatarPointerFromFields(pointer.profileVersion ?? pointer.profile_version, pointer.avatarHash ?? pointer.avatar_hash) : null;
  const cached = requestedPointer ? readProfileAvatarMediaCache(requestedPointer.avatarHash) : null;
  if (cached) return cached;
  const key = `${ownerWallet}:${requestedPointer?.profileVersion ?? 'current'}:${requestedPointer?.avatarHash ?? 'current'}`;
  if (profileAvatarLoadPromises.has(key)) return profileAvatarLoadPromises.get(key);
  const promise = (async () => {
    const resolved = await resolveProfileRegistryProvider();
    if (!resolved) return null;
    const record = requestedPointer
      ? await resolved.provider.getAvatarVersion(ownerWallet, requestedPointer.profileVersion, { profileRegistryAddress: resolved.address })
      : await resolved.provider.getAvatar(ownerWallet, { profileRegistryAddress: resolved.address });
    const recordPointer = profileAvatarPointerFromRecord(record);
    if (!recordPointer) return null;
    if (requestedPointer && recordPointer.avatarHash.toLowerCase() !== requestedPointer.avatarHash.toLowerCase()) return null;
    return readAvatarPartsFromCapsuleHub(ownerWallet, recordPointer);
  })().catch((error) => {
    console.error(error);
    return null;
  }).finally(() => {
    profileAvatarLoadPromises.delete(key);
  });
  profileAvatarLoadPromises.set(key, promise);
  return promise;
}

function attachAvatarUrlToPublicFeedCache(ownerWallet, pointer, imageUrl) {
  if (!ownerWallet || !imageUrl) return false;
  const expected = avatarPointerFromFields(pointer?.profileVersion ?? pointer?.profile_version, pointer?.avatarHash ?? pointer?.avatar_hash);
  let changed = false;
  const updateItem = (item) => {
    if (!item || String(item.authorWallet ?? item.author_wallet ?? '') !== String(ownerWallet)) return item;
    const itemPointer = avatarPointerFromFields(item.profileVersion ?? item.profile_version, item.avatarHash ?? item.avatar_hash);
    if (expected && (!itemPointer || itemPointer.avatarHash.toLowerCase() !== expected.avatarHash.toLowerCase())) return item;
    if (!expected && itemPointer) return item;
    if (item.avatarImageUrl === imageUrl) return item;
    changed = true;
    return { ...item, avatarImageUrl: imageUrl };
  };
  const next = {};
  for (const [channelId, record] of Object.entries(publicChannelFeedCache ?? {})) {
    const feed = record?.feed ?? record;
    if (!feed?.posts) {
      next[channelId] = record;
      continue;
    }
    const posts = feed.posts.map((post) => {
      const updatedPost = updateItem(post);
      const comments = (updatedPost.comments ?? []).map(updateItem);
      return comments === updatedPost.comments ? updatedPost : { ...updatedPost, comments };
    });
    const updatedFeed = { ...feed, posts };
    next[channelId] = record?.feed ? { ...record, feed: updatedFeed } : updatedFeed;
  }
  if (changed) publicChannelFeedCache = next;
  return changed;
}

function publicChannelIdForAuthorWallet(authorWallet) {
  const wallet = String(authorWallet ?? '');
  return publicChannelRegistry.find((channel) => channel.authorWallet && String(channel.authorWallet) === wallet)?.id
    ?? publicChannelSubscriptions?.activeChannelId
    ?? publicChannelRegistry[0]?.id
    ?? 'platho.app';
}

function ensurePublicChannelForAuthorWallet(authorWallet, options = {}) {
  const wallet = String(authorWallet ?? '').trim();
  if (!wallet) return publicChannelRegistry[0]?.id ?? 'platho.app';
  const existing = publicChannelRegistry.find((channel) => (
    channel.authorWallet && String(channel.authorWallet) === wallet
  ));
  if (existing) {
    if (options.activate && publicChannelSubscriptions?.activeChannelId !== existing.id) {
      publicChannelSubscriptions = {
        ...publicChannelSubscriptions,
        activeChannelId: existing.id,
      };
      writePublicChannelSubscriptions(localStorageOrNull(), publicChannelSubscriptions);
    }
    return existing.id;
  }

  const id = `wallet:${wallet}`;
  const channel = {
    id,
    name: 'you',
    avatar: 'Y',
    subtitle: `your public channel - ${shortAddress(wallet)}`,
    authorWallet: wallet,
  };
  customPublicChannels = normalizePublicChannelRegistry([
    ...customPublicChannels.filter((item) => item.id !== id),
    channel,
  ]);
  writeCustomPublicChannels();
  rebuildPublicChannelRegistry();

  const subscribedById = new Map((publicChannelSubscriptions?.channels ?? []).map((item) => [item.id, item]));
  subscribedById.set(id, { id, subscribed: true });
  publicChannelSubscriptions = {
    version: publicChannelSubscriptions?.version ?? 1,
    activeChannelId: options.activate ? id : (publicChannelSubscriptions?.activeChannelId ?? id),
    channels: publicChannelRegistry.map((item) => ({
      id: item.id,
      subscribed: subscribedById.get(item.id)?.subscribed === true,
    })),
  };
  writePublicChannelSubscriptions(localStorageOrNull(), publicChannelSubscriptions);
  rebuildThreadsFromPublicSubscriptions({ preserveActive: true });
  return id;
}

async function syncPublicChannelFromChain() {
  const resolved = await resolveCapsuleHubProvider();
  if (!resolved) return false;
  const { provider, address } = resolved;
  const state = await provider.getState({ capsuleHubAddress: address });
  const latest = Number(BigInt(state.public_latest_id ?? 0n));
  const cutoffMs = publicSyncCutoffMs();
  const postParts = [];
  const commentParts = [];
  const avatarParts = [];
  for (let entryId = latest - 1; entryId >= 0; entryId -= 1) {
    const entry = await provider.getPublicEntry(BigInt(entryId), { capsuleHubAddress: address });
    if (entry.exists !== true) continue;
    const createdAt = new Date(Number(BigInt(entry.created_at ?? 0n)) * 1000).toISOString();
    const createdMs = new Date(createdAt).getTime();
    if (cutoffMs !== null && !Number.isNaN(createdMs) && createdMs < cutoffMs) break;
    const payload = readPublicPostPayload({
      header_boc: entry.header_boc,
      body_boc: entry.body_boc,
    }, { maxBytes: SINGLE_CAPSULE_USEFUL_BYTES });
    const authorWallet = String(entry.author_wallet ?? '');
    const base = {
      id: `chain-${entry.entry_id.toString()}`,
      entryId: entry.entry_id.toString(),
      channelId: publicChannelIdForAuthorWallet(authorWallet),
      type: payload.type,
      text: payload.text ?? '',
      imageBytes: payload.imageBytes ?? payload.image_bytes,
      createdAt,
      author: shortAddress(entry.author_wallet),
      authorWallet,
      bodyHash: uint256Hex(entry.body_hash),
      entryUid: entry.entry_uid.toString(16),
      streamId: payload.stream_id,
      partIndex: payload.partIndex ?? 0,
      partCount: payload.partCount ?? 1,
      profileVersion: payload.profileVersion ?? payload.profile_version ?? 0,
      avatarHash: payload.avatarHash ?? payload.avatar_hash ?? zeroAvatarHashHex(),
    };
    if (payload.type === 'avatar') {
      avatarParts.push({
        ...base,
        imageBytes: payload.imageBytes ?? payload.image_bytes,
      });
    } else if (payload.type === 'comment' || payload.type === 'image_comment') {
      commentParts.push({
        ...base,
        parentEntryId: payload.parentEntryId.toString(),
        parentHash: payload.parentHash,
      });
    } else {
      postParts.push({
        ...base,
        commentsAllowed: payload.commentsAllowed !== false,
      });
    }
  }
  const assemblePublicParts = (items) => {
    const groups = new Map();
    for (const item of items) {
      const count = Number(item.partCount ?? 1);
      const index = Number(item.partIndex ?? 0);
      const key = count <= 1
        ? `single:${item.channelId}:${item.entryId}`
        : `${item.channelId}:${item.streamId}:${item.parentEntryId ?? ''}:${item.parentHash ?? ''}`;
      const group = groups.get(key) ?? { expected: count, parts: [] };
      group.expected = Math.max(group.expected, count);
      group.parts.push({ ...item, partIndex: index, partCount: count });
      groups.set(key, group);
    }
    const out = [];
    for (const group of groups.values()) {
      const ordered = group.parts
        .slice()
        .sort((a, b) => Number(a.partIndex ?? 0) - Number(b.partIndex ?? 0));
      const unique = new Set(ordered.map((item) => Number(item.partIndex ?? 0)));
      if (group.expected > 1 && unique.size !== group.expected) continue;
      const first = ordered[0];
      const imageParts = ordered.filter((item) => item.imageBytes?.length);
      const imageBytes = imageParts.length > 0
        ? new Uint8Array(imageParts.reduce((sum, item) => sum + item.imageBytes.length, 0))
        : null;
      if (imageBytes) {
        let offset = 0;
        for (const item of imageParts) {
          imageBytes.set(item.imageBytes, offset);
          offset += item.imageBytes.length;
        }
      }
      const readEntryId = ordered.reduce((max, item) => {
        const value = publicEntryIdBigInt(item.entryId) ?? -1n;
        return value > max ? value : max;
      }, -1n);
      const item = {
        ...first,
        text: ordered.filter((part) => !part.imageBytes?.length).map((part) => part.text ?? '').join(''),
        readEntryId: readEntryId >= 0n ? readEntryId.toString() : first.entryId,
        partCount: group.expected,
        avatarImageUrl: readProfileAvatarMediaCache(first.avatarHash),
      };
      if (imageBytes) {
        item.imageUrl = bytesToImageDataUrl(imageBytes, 'image/webp');
        item.imageBytes = undefined;
      }
      out.push(item);
    }
    return out;
  };
  const avatarGroups = new Map();
  for (const part of avatarParts) {
    const pointer = avatarPointerFromFields(part.profileVersion, part.avatarHash);
    if (!pointer) continue;
    const key = `${part.authorWallet}:${pointer.profileVersion}:${pointer.avatarHash}:${part.streamId}`;
    const group = avatarGroups.get(key) ?? {
      ownerWallet: part.authorWallet,
      pointer: { ...pointer, avatarPartCount: Number(part.partCount ?? 1) },
      parts: [],
    };
    group.parts.push(part);
    avatarGroups.set(key, group);
  }
  for (const group of avatarGroups.values()) {
    await cacheAssembledAvatarParts(group.parts, group.pointer);
  }
  const posts = assemblePublicParts(postParts);
  const comments = assemblePublicParts(commentParts);
  posts.reverse();
  comments.reverse();
  const postsByEntry = new Map(posts.map((post) => [String(post.entryId), post]));
  for (const comment of comments) {
    const parent = postsByEntry.get(String(comment.parentEntryId));
    if (!parent) continue;
    if (parent.commentsAllowed === false) continue;
    if (parent.bodyHash && comment.parentHash && parent.bodyHash.toLowerCase() !== comment.parentHash.toLowerCase()) continue;
    parent.comments = [...(parent.comments ?? []), comment];
  }
  const updatedAt = new Date().toISOString();
  const postsByChannel = new Map();
  for (const post of posts) {
    const channelId = post.channelId ?? publicChannelSubscriptions?.activeChannelId ?? publicChannelRegistry[0]?.id ?? 'platho.app';
    const list = postsByChannel.get(channelId) ?? [];
    list.push(post);
    postsByChannel.set(channelId, list);
  }
  const nextFeedCache = { ...publicChannelFeedCache };
  for (const [channelId, channelPosts] of postsByChannel.entries()) {
    nextFeedCache[channelId] = {
      feed: {
        version: 1,
        channelId,
        updatedAt,
        posts: channelPosts,
      },
      syncedAt: updatedAt,
    };
  }
  publicChannelFeedCache = nextFeedCache;
  return true;
}

async function syncPublicChannels() {
  try {
    const syncedFromChain = await syncPublicChannelFromChain();
    if (syncedFromChain) {
      writePublicChannelFeedCache(localStorageOrNull(), publicChannelFeedCache);
      rebuildThreadsFromPublicSubscriptions();
      renderThreads();
      renderConversation();
      hydratePublicAvatars().catch((error) => console.error(error));
      return;
    }
  } catch (error) {
    console.error(error);
  }

  const channels = subscribedPublicChannels(publicChannelSubscriptions, publicChannelRegistry);
  let changed = false;
  for (const channel of channels) {
    if (!channel.sourceUrl) continue;
    try {
      const response = await fetch(channel.sourceUrl, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Public channel feed unavailable: ${channel.id}`);
      const feed = normalizePublicChannelFeed(await response.json(), channel.id);
      publicChannelFeedCache = {
        ...publicChannelFeedCache,
        [channel.id]: {
          feed,
          syncedAt: new Date().toISOString(),
        },
      };
      changed = true;
    } catch (error) {
      console.error(error);
    }
  }
  if (!changed) return;
  writePublicChannelFeedCache(localStorageOrNull(), publicChannelFeedCache);
  rebuildThreadsFromPublicSubscriptions();
  renderThreads();
  renderConversation();
  hydratePublicAvatars().catch((error) => console.error(error));
}

function collectPublicAvatarRequests() {
  const requests = [];
  const seen = new Set();
  const visit = (item, options = {}) => {
    const ownerWallet = item?.authorWallet ?? item?.author_wallet;
    const pointer = avatarPointerFromFields(item?.profileVersion ?? item?.profile_version, item?.avatarHash ?? item?.avatar_hash);
    if (!ownerWallet || item.avatarImageUrl) return;
    if (!pointer && !options.allowCurrent) return;
    if (pointer && readProfileAvatarMediaCache(pointer.avatarHash)) return;
    const key = `${ownerWallet}:${pointer?.profileVersion ?? 'current'}:${pointer?.avatarHash ?? 'current'}`;
    if (seen.has(key)) return;
    seen.add(key);
    requests.push({ ownerWallet, pointer });
  };
  for (const record of Object.values(publicChannelFeedCache ?? {})) {
    const feed = record?.feed ?? record;
    for (const post of feed?.posts ?? []) {
      visit(post);
      for (const comment of post.comments ?? []) visit(comment, { allowCurrent: true });
    }
  }
  return requests;
}

async function hydratePublicAvatars() {
  const requests = collectPublicAvatarRequests();
  if (requests.length === 0) return false;
  let changed = false;
  for (const request of requests.slice(0, 24)) {
    const imageUrl = await loadProfileAvatarImage(request.ownerWallet, request.pointer);
    if (!imageUrl) continue;
    changed = attachAvatarUrlToPublicFeedCache(request.ownerWallet, request.pointer, imageUrl) || changed;
  }
  if (!changed) return false;
  writePublicChannelFeedCache(localStorageOrNull(), publicChannelFeedCache);
  rebuildThreadsFromPublicSubscriptions({ preserveActive: true });
  renderPublicSurface({ anchorUnread: false });
  renderThreads();
  renderConversation();
  return true;
}

function privateChainScanStorageKey(address = configuredCapsuleHubAddress()) {
  const hub = address ?? 'no-capsulehub';
  const keyId = localRecipientKeyPair?.keyId ?? 'no-key';
  return `${PRIVATE_CHAIN_SCAN_STORAGE_PREFIX}:${hub}:${keyId}`;
}

function readPrivateChainScanCursor(address) {
  try {
    const raw = localStorageOrNull()?.getItem(privateChainScanStorageKey(address));
    if (raw && /^[0-9]+$/.test(raw)) return BigInt(raw);
  } catch {
    // Non-persistent mode rescans the configured read window.
  }
  return null;
}

function writePrivateChainScanCursor(address, nextEntryId) {
  try {
    localStorageOrNull()?.setItem(privateChainScanStorageKey(address), BigInt(nextEntryId).toString());
  } catch {
    // Best-effort cursor only; encrypted history still dedupes by capsule id.
  }
}

function findMessageByCapsuleId(capsuleId) {
  if (!capsuleId) return null;
  for (const thread of threads) {
    const message = (thread.messages ?? []).find((item) => (
      item.capsule?.id === capsuleId
      || (item.capsules ?? []).some((capsule) => capsule?.id === capsuleId)
    ));
    if (message) return { thread, message };
  }
  return null;
}

function threadForChainCapsule(opened, entry) {
  const senderKeyId = opened?.capsule?.header0?.senderKeyId;
  const variants = normalizeIdentityVariants([
    entry?.author_wallet
      ? { type: 'wallet_address', value: entry.author_wallet, label: entry.author_wallet }
      : null,
  ]);
  const identityThread = findThreadByIdentityVariants(threads, variants);
  if (identityThread) return identityThread;
  const created = createInboundPeerThread({
    senderKeyId,
    keyId: senderKeyId,
    label: null,
    ownerWallet: entry?.author_wallet ?? null,
    identity: preferredInboundIdentity(variants),
    identityVariants: variants,
  });
  threads.push(created);
  return created;
}

function ownerWalletFromThread(thread) {
  const variants = threadIdentityVariants(thread);
  const walletIdentity = variants.find((identity) => identity.type === RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS);
  return walletIdentity?.value ?? null;
}

function avatarPointerFromPrivateHeader(header0) {
  return avatarPointerFromFields(header0?.profileVersion ?? header0?.profile_version, header0?.avatarHash ?? header0?.avatar_hash);
}

async function hydrateThreadAvatarFromPointer(thread, ownerWallet, pointer) {
  if (!thread || !ownerWallet) return false;
  const cached = pointer ? readProfileAvatarMediaCache(pointer.avatarHash) : null;
  const imageUrl = cached ?? await loadProfileAvatarImage(ownerWallet, pointer);
  if (!imageUrl || thread.avatarImageUrl === imageUrl) return false;
  thread.avatarImageUrl = imageUrl;
  renderThreads();
  if (thread.id === activeThreadId) renderConversation();
  return true;
}

async function refreshOwnProfileAvatar() {
  const owner = plathoWallet?.address;
  if (!owner) {
    setAvatarNode(profileAvatar, 'P', null);
    return null;
  }
  const onChainPointer = await readCurrentProfileAvatarPointerFromChain(owner, { required: false });
  const pointer = onChainPointer ?? currentProfileAvatarPointer();
  const imageUrl = await loadProfileAvatarImage(owner, pointer.profileVersion > 0 ? pointer : null);
  setAvatarNode(profileAvatar, 'P', imageUrl);
  return imageUrl;
}

async function readCurrentProfileAvatarPointerFromChain(ownerWallet, options = {}) {
  try {
    const resolved = await resolveProfileRegistryProvider();
    if (!resolved) {
      if (options.required === false) return null;
      throw new Error('ProfileRegistry provider is required to read current avatar version');
    }
    const record = await resolved.provider.getAvatar(ownerWallet, { profileRegistryAddress: resolved.address });
    const pointer = profileAvatarPointerFromRecord(record);
    if (pointer) writeStoredProfileAvatarPointer(pointer, ownerWallet);
    return pointer;
  } catch (error) {
    if (options.required === false) {
      console.error(error);
      return null;
    }
    throw error;
  }
}

function messageFromOpenedCapsule(opened, meta) {
  const payment = paymentFromCompactPayload(opened.payload);
  const isImage = opened.payload?.type === 'image';
  const text = payment ? paymentMessageText(payment) : (isImage ? '' : opened.plaintext);
  const message = {
    type: 'in',
    text,
    meta,
    payment,
    capsule: opened.capsule,
    profileVersion: opened.capsule?.header0?.profileVersion ?? 0,
    avatarHash: opened.capsule?.header0?.avatarHash ?? zeroAvatarHashHex(),
  };
  if (isImage) {
    message.attachment = {
      type: 'image',
      url: bytesToImageDataUrl(opened.payload.bytes, 'image/webp'),
      bytes: opened.payload.bytes.length,
    };
  }
  return message;
}

function privatePartKey(opened, entry) {
  const streamId = opened?.payload?.stream_id ?? 'single';
  const sender = entry?.author_wallet ?? opened?.capsule?.header0?.senderKeyId ?? 'unknown';
  return `${sender}:${streamId}`;
}

function messageFromOpenedPrivateParts(parts, meta) {
  const ordered = [...parts].sort((a, b) => (
    Number(a.opened?.payload?.partIndex ?? 0) - Number(b.opened?.payload?.partIndex ?? 0)
  ));
  const first = ordered[0]?.opened;
  const text = ordered
    .filter((part) => part.opened?.payload?.type === 'text')
    .map((part) => part.opened?.payload?.text ?? part.opened?.plaintext ?? '')
    .join('');
  const imageParts = ordered.filter((part) => part.opened?.payload?.type === 'image');
  const imageBytes = imageParts.length > 0
    ? new Uint8Array(imageParts.reduce((sum, part) => sum + (part.opened?.payload?.bytes?.length ?? 0), 0))
    : null;
  if (imageBytes) {
    let offset = 0;
    for (const part of imageParts) {
      imageBytes.set(part.opened.payload.bytes, offset);
      offset += part.opened.payload.bytes.length;
    }
  }
  const message = {
    type: 'in',
    text,
    meta,
    capsule: first?.capsule,
    capsules: ordered.map((part) => part.opened?.capsule).filter(Boolean),
    profileVersion: first?.capsule?.header0?.profileVersion ?? 0,
    avatarHash: first?.capsule?.header0?.avatarHash ?? zeroAvatarHashHex(),
  };
  if (imageBytes) {
    message.attachment = {
      type: 'image',
      url: bytesToImageDataUrl(imageBytes, 'image/webp'),
      bytes: imageBytes.length,
    };
  }
  return message;
}

async function appendOpenedCapsuleMessage(opened, targetThread, meta) {
  if (findMessageByCapsuleId(opened.capsule?.id)) return false;
  const message = messageFromOpenedCapsule(opened, meta);
  targetThread.messages.push(message);
  targetThread.preview = message.text || (message.attachment ? 'Image' : '');
  targetThread.time = 'now';
  targetThread.state = 'sealed';
  await persistMessageToEncryptedHistory(targetThread, message);
  hydrateThreadAvatarFromPointer(
    targetThread,
    ownerWalletFromThread(targetThread),
    avatarPointerFromPrivateHeader(opened.capsule?.header0),
  ).catch((error) => console.error(error));
  return true;
}

async function appendOpenedPrivatePartsMessage(parts, targetThread, meta) {
  if (parts.some((part) => findMessageByCapsuleId(part.opened?.capsule?.id))) return false;
  const message = messageFromOpenedPrivateParts(parts, meta);
  targetThread.messages.push(message);
  targetThread.preview = message.text || (message.attachment ? 'Image' : '');
  targetThread.time = 'now';
  targetThread.state = 'sealed';
  await persistMessageToEncryptedHistory(targetThread, message);
  const firstOpened = parts[0]?.opened;
  hydrateThreadAvatarFromPointer(
    targetThread,
    ownerWalletFromThread(targetThread),
    avatarPointerFromPrivateHeader(firstOpened?.capsule?.header0),
  ).catch((error) => console.error(error));
  return true;
}

async function syncPrivateCapsulesFromChain() {
  if (!localRecipientKeyPair) return false;
  const resolved = await resolveCapsuleHubProvider();
  if (!resolved) return false;
  const { provider, address } = resolved;
  const state = await provider.getState({ capsuleHubAddress: address });
  const latest = BigInt(state.private_latest_id ?? 0n);
  if (latest <= 0n) {
    writePrivateChainScanCursor(address, latest);
    return false;
  }
  const limit = Math.max(1, Number(appConfig.capsuleHub?.privateReadLimit ?? 50));
  const storedCursor = readPrivateChainScanCursor(address);
  const windowStart = latest > BigInt(limit) ? latest - BigInt(limit) : 0n;
  let start = storedCursor === null ? windowStart : storedCursor;
  if (start < windowStart) start = windowStart;
  if (start > latest) start = latest;

  let imported = 0;
  let scanComplete = true;
  const privatePartGroups = new Map();
  for (let entryId = start; entryId < latest; entryId += 1n) {
    let entry = null;
    try {
      entry = await provider.getPrivateEntry(entryId, { capsuleHubAddress: address });
      if (entry.exists !== true) continue;
      const opened = await openPrivateCapsuleChainEntry(entry, localRecipientKeyPair, {
        now: Date.now(),
      });
      const targetThread = threadForChainCapsule(opened, entry);
      const partCount = Number(opened.payload?.partCount ?? 1);
      if (partCount > 1) {
        const key = privatePartKey(opened, entry);
        const existing = privatePartGroups.get(key) ?? { targetThread, parts: [], partCount };
        existing.parts.push({ opened, entry, entryId });
        existing.partCount = Math.max(existing.partCount, partCount);
        privatePartGroups.set(key, existing);
      } else {
        const added = await appendOpenedCapsuleMessage(
          opened,
          targetThread,
          `${opened.capsule.header0.suite} chain #${entry.entry_id?.toString?.() ?? entryId.toString()}`,
        );
        if (added) imported += 1;
      }
    } catch (error) {
      const message = String(error?.message ?? error);
      if (!/recipient|decrypt|key mismatch|expired/i.test(message)) console.error(error);
      if (!/recipient|decrypt|key mismatch|expired/i.test(message)) {
        scanComplete = false;
        break;
      }
    }
  }
  for (const group of privatePartGroups.values()) {
    const uniqueParts = new Map();
    for (const part of group.parts) {
      uniqueParts.set(Number(part.opened?.payload?.partIndex ?? 0), part);
    }
    if (uniqueParts.size !== group.partCount) {
      scanComplete = false;
      continue;
    }
    const ordered = [...uniqueParts.values()].sort((a, b) => Number(a.entryId - b.entryId));
    const firstEntry = ordered[0]?.entry;
    const firstOpened = ordered[0]?.opened;
    const added = await appendOpenedPrivatePartsMessage(
      ordered,
      group.targetThread,
      `${firstOpened?.capsule?.header0?.suite ?? 'private'} chain #${firstEntry?.entry_id?.toString?.() ?? ordered[0]?.entryId?.toString?.() ?? '?'} (${ordered.length} parts)`,
    );
    if (added) imported += 1;
  }
  if (scanComplete) writePrivateChainScanCursor(address, latest);
  if (imported > 0) {
    refreshMessagingControls();
    renderThreads();
    renderConversation();
    return true;
  }
  if (!scanComplete) {
    refreshMessagingControls();
    return false;
  }
  refreshMessagingControls();
  return false;
}

async function bootReplayStore() {
  try {
    localReplayStore = await createIndexedDbReplayStore();
    setText(replayStoreStatus, 'device db');
  } catch {
    localReplayStore = createMemoryReplayStore();
    setText(replayStoreStatus, 'memory');
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
    payment: message.payment ?? null,
    capsule: message.capsule ?? null,
    capsules: message.capsules ?? null,
    attachment: message.attachment ?? null,
    profileVersion: message.profileVersion ?? 0,
    avatarHash: message.avatarHash ?? zeroAvatarHashHex(),
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
      thread.preview = message.text || (message.attachment ? 'Image' : '');
      thread.time = 'local';
      thread.state = message.capsule ? 'sealed' : 'local';
      hydrateThreadAvatarFromPointer(
        thread,
        ownerWalletFromThread(thread),
        avatarPointerFromFields(message.profileVersion, message.avatarHash),
      ).catch((error) => console.error(error));
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

function normalizeCryptoSuite(value) {
  return value === CRYPTO_SUITES.CLASSICAL_V1 || value === CRYPTO_SUITES.HYBRID_V1
    ? value
    : CRYPTO_SUITES.HYBRID_V1;
}

function readPreferredCryptoSuite() {
  try {
    return normalizeCryptoSuite(localStorageOrNull()?.getItem(KEY_SUITE_PREF_KEY));
  } catch {
    return CRYPTO_SUITES.HYBRID_V1;
  }
}

function writePreferredCryptoSuite(suite) {
  try {
    localStorageOrNull()?.setItem(KEY_SUITE_PREF_KEY, normalizeCryptoSuite(suite));
  } catch {
    // Non-persistent mode still uses the current select value for this session.
  }
}

async function readStoredPlathoWallet() {
  try {
    const raw = localStorageOrNull()?.getItem(PLATHO_WALLET_STORAGE_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (record?.kind !== 'platho.wallet.seed.v1' || typeof record.seed !== 'string') return null;
    return importPlathoWallet(record.seed, plathoWalletNetworkOptions());
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function writeStoredPlathoWallet(wallet) {
  try {
    localStorageOrNull()?.setItem(PLATHO_WALLET_STORAGE_KEY, JSON.stringify({
      kind: 'platho.wallet.seed.v1',
      version: 1,
      seed: exportPlathoWalletSeed(wallet),
      address: wallet.address,
      walletKind: wallet.kind,
      networkGlobalId: wallet.networkGlobalId,
      createdAt: Date.now(),
    }));
  } catch {
    // Without persistent storage the current tab still has a working wallet.
  }
}

async function loadPlathoWallet() {
  if (plathoWallet) return plathoWallet;
  plathoWallet = await readStoredPlathoWallet();
  localProfileAvatarPointer = readStoredProfileAvatarPointer(plathoWallet?.address);
  refreshOwnProfileAvatar().catch((error) => console.error(error));
  return plathoWallet;
}

async function setPlathoWallet(wallet) {
  plathoWallet = wallet;
  localProfileAvatarPointer = readStoredProfileAvatarPointer(wallet.address);
  await writeStoredPlathoWallet(wallet);
  await bootCrypto();
  await refreshVaultActivationStatus();
  await refreshOwnProfileAvatar();
  return wallet;
}

async function loadMessagingIdentityFromWallet(suite) {
  const wallet = await loadPlathoWallet();
  if (!wallet) return null;
  return deriveMessagingIdentityFromWallet(wallet, suite);
}

function currentNetworkFeeEstimateNanotons() {
  return resolveNetworkFeeEstimateNanotons(
    globalThis.plathoNetworkFeeEstimate
      ?? appConfig.messaging?.pricing
      ?? appConfig.messaging?.networkFeeEstimateNanotons,
    INCLUDED_NETWORK_FEE_NANOTONS,
  );
}

function updateKeySuiteUi(suite) {
  const normalized = normalizeCryptoSuite(suite);
  if (keySuiteSelect) keySuiteSelect.value = normalized;
  const label = normalized === CRYPTO_SUITES.HYBRID_V1 ? 'postquantum' : 'standard';
  if (keySuiteStatus) {
    const pricingOptions = {
      ...(appConfig.messaging?.pricing ?? {}),
      estimatedNetworkFeeNanotons: currentNetworkFeeEstimateNanotons(),
    };
    keySuiteStatus.textContent = messagePriceLabel(normalized, pricingOptions);
  }
  setText(vaultRotateStatus, label);
  refreshComposerCostStatus();
}

function currentVaultUserSource() {
  return globalThis.plathoVaultBinding?.user
    ?? null;
}

function plathoWalletNetworkOptions() {
  const chain = String(appConfig.network?.chain ?? '').toLowerCase();
  return {
    networkGlobalId: chain === 'testnet'
      ? PLATHO_WALLET_NETWORK_GLOBAL_IDS.TESTNET
      : PLATHO_WALLET_NETWORK_GLOBAL_IDS.MAINNET,
  };
}

function nonNegativeBigInt(value, fallback = 0n) {
  try {
    if (typeof value === 'bigint') return value >= 0n ? value : fallback;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value > 0 ? BigInt(Math.trunc(value)) : fallback;
    }
    if (typeof value === 'string' && /^[0-9]+$/.test(value.trim())) return BigInt(value.trim());
    if (value && typeof value.toString === 'function') {
      const text = value.toString();
      if (/^[0-9]+$/.test(text)) return BigInt(text);
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function currentAthBalanceAtomic() {
  const source = currentVaultUserSource();
  if (!source || typeof source !== 'object') return 0n;
  return nonNegativeBigInt(source.ath_balance ?? source.athBalance ?? source.ath);
}

function currentNetworkFeeSurchargeNanotons() {
  return networkFeeSurchargeNanotons(currentNetworkFeeEstimateNanotons(), appConfig.messaging?.pricing ?? {});
}

function messageDiscountUnlocked() {
  const remaining = vaultProtocolState?.airdrop_remaining_ath;
  if (remaining === null || remaining === undefined) return false;
  return nonNegativeBigInt(remaining) <= VAULT_ACTIVITY_AIRDROP_DISCOUNT_UNLOCK_REMAINING_ATH_ATOMIC;
}

function athDiscountBps() {
  if (!messageDiscountUnlocked()) return 0n;
  const athBalance = currentAthBalanceAtomic();
  if (athBalance >= ATH_FULL_DISCOUNT_AMOUNT_ATOMIC) return 10_000n;
  return (athBalance * 10_000n) / ATH_FULL_DISCOUNT_AMOUNT_ATOMIC;
}

function formatDiscountPercent(bps = athDiscountBps()) {
  const basis = nonNegativeBigInt(bps);
  return basis >= 10_000n ? '100%' : formatBasisPointsPercent(basis);
}

function formatAthDiscountLabel() {
  const percent = formatDiscountPercent();
  return messageDiscountUnlocked()
    ? `ATH discount ${percent}`
    : `ATH discount ${percent} (locked until 15% are distributed)`;
}

function discountedProtocolFeeNanotons(fullFee) {
  const fee = nonNegativeBigInt(fullFee);
  if (!messageDiscountUnlocked()) return fee;
  const athBalance = currentAthBalanceAtomic();
  if (athBalance >= ATH_FULL_DISCOUNT_AMOUNT_ATOMIC) return 0n;
  const remaining = ATH_FULL_DISCOUNT_AMOUNT_ATOMIC - athBalance;
  return ((fee * remaining) + ATH_FULL_DISCOUNT_AMOUNT_ATOMIC - 1n) / ATH_FULL_DISCOUNT_AMOUNT_ATOMIC;
}

function privateComposerPublishProfile() {
  const suite = normalizeCryptoSuite(keySuiteSelect?.value ?? readPreferredCryptoSuite());
  if (suite === CRYPTO_SUITES.CLASSICAL_V1) {
    return {
      publishKind: VAULT_PUBLISH_KIND.PRIVATE,
      sizeClass: VAULT_SIZE_CLASS.STANDARD,
      cryptoSuite: VAULT_CRYPTO_SUITE.CLASSICAL,
      priceSuite: MESSAGE_PRICE_SUITES.CLASSICAL_V1,
      fixedCharge: VAULT_PUBLISH_LOCAL_EXEC_RESERVE_NANOTONS + CAPSULEHUB_PRIVATE_STANDARD_FIXED_CHARGE_NANOTONS,
      protocolFee: PLATO_PRIVATE_STANDARD_FEE_NANOTONS,
    };
  }
  return {
    publishKind: VAULT_PUBLISH_KIND.PRIVATE,
    sizeClass: VAULT_SIZE_CLASS.LONG_TERM,
    cryptoSuite: VAULT_CRYPTO_SUITE.HYBRID,
    priceSuite: MESSAGE_PRICE_SUITES.HYBRID_V1,
    fixedCharge: VAULT_PUBLISH_LOCAL_EXEC_RESERVE_NANOTONS + CAPSULEHUB_PRIVATE_LONG_TERM_FIXED_CHARGE_NANOTONS,
    protocolFee: PLATO_PRIVATE_LONG_TERM_FEE_NANOTONS,
  };
}

function publicComposerPublishProfile() {
  return {
    publishKind: VAULT_PUBLISH_KIND.PUBLIC,
    sizeClass: VAULT_SIZE_CLASS.STANDARD,
    cryptoSuite: VAULT_CRYPTO_SUITE.PUBLIC_NONE,
    priceSuite: MESSAGE_PRICE_SUITES.PUBLIC_V1,
    fixedCharge: VAULT_PUBLISH_LOCAL_EXEC_RESERVE_NANOTONS + CAPSULEHUB_PUBLIC_FIXED_CHARGE_NANOTONS,
    protocolFee: PLATO_PUBLIC_POST_FEE_NANOTONS,
  };
}

function composerPartCount(text, maxTextBytes = SINGLE_CAPSULE_USEFUL_BYTES) {
  return messagePartCount(text ?? '', maxTextBytes);
}

function imageCompressionMode(modeId) {
  return IMAGE_COMPRESSION_MODES[modeId] ?? IMAGE_COMPRESSION_MODES[DEFAULT_IMAGE_COMPRESSION_MODE_ID];
}

function imageAttachmentPartCount(attachment) {
  if (!attachment?.bytes?.length) return 0;
  return splitBytesToParts(attachment.bytes, SINGLE_CAPSULE_USEFUL_BYTES).length;
}

function composerTotalPartCount(text, attachment, maxTextBytes = SINGLE_CAPSULE_USEFUL_BYTES) {
  const hasText = String(text ?? '').trim().length > 0;
  const textParts = hasText ? composerPartCount(text, maxTextBytes) : 0;
  return Math.max(1, textParts + imageAttachmentPartCount(attachment));
}

function composerEstimatedPriceNanotons(profile, parts = 1) {
  const fullProtocolFee = nonNegativeBigInt(profile?.protocolFee);
  const paidProtocolFee = discountedProtocolFeeNanotons(fullProtocolFee);
  const athDiscount = fullProtocolFee > paidProtocolFee ? fullProtocolFee - paidProtocolFee : 0n;
  const basePrice = messagePriceNanotons(profile?.priceSuite ?? MESSAGE_PRICE_SUITES.CLASSICAL_V1, {
    ...(appConfig.messaging?.pricing ?? {}),
    estimatedNetworkFeeNanotons: currentNetworkFeeEstimateNanotons(),
  });
  const perPart = basePrice > athDiscount ? basePrice - athDiscount : 0n;
  return perPart * BigInt(Math.max(1, Number(parts) || 1));
}

function composerEstimatedMaxChargeNanotons(profile, parts = 1) {
  const perPart = nonNegativeBigInt(profile?.fixedCharge)
    + discountedProtocolFeeNanotons(profile?.protocolFee)
    + currentNetworkFeeSurchargeNanotons();
  return perPart * BigInt(Math.max(1, Number(parts) || 1));
}

function composerCostStatusText(profile, text, maxTextBytes, attachment = null) {
  const parts = composerTotalPartCount(text, attachment, maxTextBytes);
  const price = composerEstimatedPriceNanotons(profile, parts);
  const hold = composerEstimatedMaxChargeNanotons(profile, parts);
  const statusParts = [];
  if (!plathoWallet) {
    statusParts.push('Wallet required');
  } else {
    statusParts.push('Ready');
  }
  return {
    text: `Price ${formatTonNanotons(price)} TON - Hold ${formatTonNanotons(hold)} TON - ${formatAthDiscountLabel()}\n${statusParts.join(' - ')}`,
    state: plathoWallet ? 'ready' : 'short',
    parts,
  };
}

function refreshComposerCostStatus() {
  if (privateComposerCostStatus) {
    const status = composerCostStatusText(
      privateComposerPublishProfile(),
      messageInput?.value ?? '',
      SINGLE_CAPSULE_USEFUL_BYTES,
      privateImageAttachment,
    );
    privateComposerCostStatus.textContent = status.text;
    privateComposerCostStatus.dataset.state = status.state;
  }
  if (publicComposerCostStatus) {
    const publicLimit = publicCommentTarget ? PUBLIC_COMMENT_TEXT_MAX_BYTES : PUBLIC_POST_TEXT_MAX_BYTES;
    const status = composerCostStatusText(
      publicComposerPublishProfile(),
      publicMessageInput?.value ?? '',
      publicLimit,
      publicImageAttachment,
    );
    publicComposerCostStatus.textContent = status.text;
    publicComposerCostStatus.dataset.state = status.state;
  }
}

function normalizePublicSyncWindow(value) {
  const text = String(value ?? '7').toLowerCase();
  return ['7', '30', '90', 'all'].includes(text) ? text : '7';
}

function readPublicSyncWindow() {
  try {
    return normalizePublicSyncWindow(localStorageOrNull()?.getItem(PUBLIC_SYNC_WINDOW_STORAGE_KEY));
  } catch {
    return '7';
  }
}

function writePublicSyncWindow(value) {
  const normalized = normalizePublicSyncWindow(value);
  try {
    localStorageOrNull()?.setItem(PUBLIC_SYNC_WINDOW_STORAGE_KEY, normalized);
  } catch {
    // Non-persistent mode still applies the visible selection for this tab.
  }
  return normalized;
}

function normalizePublicCommentsDefault(value) {
  const text = String(value ?? 'enabled').toLowerCase();
  return ['enabled', 'disabled'].includes(text) ? text : 'enabled';
}

function readPublicCommentsDefault() {
  try {
    return normalizePublicCommentsDefault(localStorageOrNull()?.getItem(PUBLIC_COMMENTS_DEFAULT_STORAGE_KEY));
  } catch {
    return 'enabled';
  }
}

function writePublicCommentsDefault(value) {
  const normalized = normalizePublicCommentsDefault(value);
  try {
    localStorageOrNull()?.setItem(PUBLIC_COMMENTS_DEFAULT_STORAGE_KEY, normalized);
  } catch {
    // Non-persistent mode still applies the visible selection for this tab.
  }
  return normalized;
}

function publicCommentsDefaultLabel(value = readPublicCommentsDefault()) {
  return normalizePublicCommentsDefault(value) === 'disabled' ? 'disabled' : 'enabled';
}

function updatePublicCommentsDefaultUi() {
  const value = readPublicCommentsDefault();
  if (publicCommentsDefaultSelect) publicCommentsDefaultSelect.value = value;
  if (!publicCommentTarget && publicComposerCommentsCheckbox) publicComposerCommentsCheckbox.checked = value !== 'disabled';
}

function publicSyncWindowLabel(value = readPublicSyncWindow()) {
  const normalized = normalizePublicSyncWindow(value);
  return normalized === 'all' ? 'all time' : `${normalized} days`;
}

function publicSyncCutoffMs(value = readPublicSyncWindow()) {
  const normalized = normalizePublicSyncWindow(value);
  if (normalized === 'all') return null;
  return Date.now() - Number(normalized) * 24 * 60 * 60 * 1000;
}

function updatePublicSyncWindowUi() {
  const windowValue = readPublicSyncWindow();
  if (publicSyncWindowSelect) publicSyncWindowSelect.value = windowValue;
}

function isFreshPublicTimestamp(value, cutoffMs = publicSyncCutoffMs()) {
  if (cutoffMs === null) return true;
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return true;
  return timestamp >= cutoffMs;
}

function autoResizeComposerTextarea(node) {
  if (!node || node.tagName !== 'TEXTAREA') return;
  node.style.height = '0px';
  const targetHeight = Math.min(144, Math.max(44, node.scrollHeight));
  node.style.height = `${targetHeight}px`;
  node.classList.toggle('is-scrollable', node.scrollHeight > 144);
}

function updateImageAttachmentUi(kind) {
  const attachment = kind === 'public' ? publicImageAttachment : privateImageAttachment;
  const panel = kind === 'public' ? publicAttachmentPanel : privateAttachmentPanel;
  const label = kind === 'public' ? publicAttachmentLabel : privateAttachmentLabel;
  const modeSelect = kind === 'public' ? publicImageModeSelect : privateImageModeSelect;
  if (panel) panel.hidden = !attachment;
  if (label) {
    label.textContent = attachment
      ? `${attachment.name} - ${Math.ceil(attachment.bytes.length / 1024)} KiB ${attachment.mode.label.toLowerCase()}`
      : 'No image';
  }
  if (modeSelect && attachment) modeSelect.value = attachment.mode.id;
}

async function setImageAttachment(kind, file, modeId) {
  const status = kind === 'public' ? publicComposerCostStatus : privateComposerCostStatus;
  const input = kind === 'public' ? publicImageInput : privateImageInput;
  const button = kind === 'public' ? publicImageButton : privateImageButton;
  const mode = imageCompressionMode(modeId);
  try {
    if (status) {
      status.textContent = `Compressing image to ${Math.ceil(mode.maxBytes / 1024)} KiB`;
      status.dataset.state = 'short';
    }
    if (button) button.disabled = true;
    const attachment = await compressImageFile(file, mode.id);
    if (kind === 'public') {
      publicImageAttachment = attachment;
    } else {
      privateImageAttachment = attachment;
    }
    updateImageAttachmentUi(kind);
    refreshComposerPublishPolicy();
  } catch (error) {
    if (kind === 'public') {
      publicImageAttachment = null;
    } else {
      privateImageAttachment = null;
    }
    updateImageAttachmentUi(kind);
    if (status) {
      status.textContent = error?.message ?? 'Image compression blocked';
      status.dataset.state = 'short';
    }
    console.error(error);
  } finally {
    if (input) input.value = '';
    if (button) button.disabled = !plathoWallet;
  }
}

async function recompressImageAttachment(kind) {
  const attachment = kind === 'public' ? publicImageAttachment : privateImageAttachment;
  const modeSelect = kind === 'public' ? publicImageModeSelect : privateImageModeSelect;
  if (!attachment?.sourceFile || !modeSelect) return;
  await setImageAttachment(kind, attachment.sourceFile, modeSelect.value);
}

function privateComposerPlaceholder({ readOnly = false } = {}) {
  if (!plathoWallet) return 'Wallet required';
  if (readOnly) return 'Read-only channel';
  return 'Write a private message';
}

function publicComposerPlaceholder() {
  if (!plathoWallet) return 'Wallet required';
  return publicCommentTarget ? 'Write a public comment' : 'Write a public message';
}

function refreshComposerPublishPolicy() {
  const canPublish = Boolean(plathoWallet);
  if (composer) composer.dataset.publishMode = canPublish ? 'vault-balance' : 'wallet-required';
  if (messageInput) {
    messageInput.removeAttribute('maxlength');
    messageInput.placeholder = privateComposerPlaceholder({
      readOnly: composer?.dataset.readOnly === 'true',
    });
    autoResizeComposerTextarea(messageInput);
  }
  if (publicComposer) publicComposer.dataset.publishMode = canPublish ? 'vault-balance' : 'wallet-required';
  if (publicMessageInput) {
    publicMessageInput.removeAttribute('maxlength');
    publicMessageInput.placeholder = publicComposerPlaceholder();
    autoResizeComposerTextarea(publicMessageInput);
  }
  for (const control of attachmentControls) {
    control.disabled = !canPublish;
    control.hidden = false;
    control.setAttribute('aria-disabled', canPublish ? 'false' : 'true');
    if (control.classList?.contains('attachment-button')) {
      control.title = canPublish ? 'Attach image' : 'Create or import a wallet to attach images';
    }
  }
  if (paymentCheckButton) {
    paymentCheckButton.title = canPublish ? 'Create private payment check' : 'Create or import a wallet to attach a private payment check';
  }
  if (privateImageModeSelect) {
    privateImageModeSelect.disabled = !canPublish;
  }
  if (publicImageModeSelect) {
    publicImageModeSelect.disabled = !canPublish;
  }
  updateImageAttachmentUi('private');
  updateImageAttachmentUi('public');
  refreshComposerCostStatus();
}

function enforceComposerByteLimit() {
  return;
}

function enforcePublicComposerByteLimit() {
  return;
}

function downloadJsonFile(filename, value) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function refreshMessagingControls() {
  if (createWalletButton) createWalletButton.disabled = Boolean(plathoWallet);
  if (importWalletButton) importWalletButton.disabled = false;
  if (exportWalletSeedButton) exportWalletSeedButton.disabled = !plathoWallet;
  if (registerVaultKeysButton) registerVaultKeysButton.disabled = !plathoWallet;
  if (replaceVaultKeysButton) replaceVaultKeysButton.disabled = !plathoWallet;
  if (syncMessagesButton) syncMessagesButton.disabled = !plathoWallet;
  if (refreshVaultButton) refreshVaultButton.disabled = !plathoWallet;
  if (mintUsernameButton) mintUsernameButton.disabled = !plathoWallet;
  if (flushUsernameRefundButton) flushUsernameRefundButton.disabled = !plathoWallet;
  if (setAvatarButton) setAvatarButton.disabled = !plathoWallet;
  if (paymentCheckButton) paymentCheckButton.disabled = !plathoWallet;
  if (messageInput) {
    const privateReadOnly = activeThread()?.readOnly === true;
    messageInput.disabled = privateReadOnly || !plathoWallet;
  }
  if (sendButton) {
    const privateReadOnly = activeThread()?.readOnly === true;
    sendButton.disabled = privateReadOnly || !plathoWallet;
  }
  if (publicMessageInput) publicMessageInput.disabled = !plathoWallet;
  if (publicComposerCommentsCheckbox) publicComposerCommentsCheckbox.disabled = !plathoWallet;
  publicComposer?.querySelector?.('.send-button')?.toggleAttribute('disabled', !plathoWallet);
  if (burnAthButton) burnAthButton.disabled = !plathoWallet;
  for (const button of actionGrid?.querySelectorAll('button[data-action]') ?? []) {
    button.disabled = !plathoWallet;
  }
  refreshVaultMoveWidget();
  refreshComposerCostStatus();
}

function setView(view) {
  appShell.dataset.view = view;
  if (view !== 'chats') {
    appShell.dataset.chatOpen = 'false';
  }
  railItems.forEach((item) => item.classList.toggle('is-active', item.dataset.tab === view));
  panels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panel === view));
  if (view === 'public') renderPublicSurface({ anchorUnread: true });
}

function renderThreads() {
  const q = search.value.trim().toLowerCase();
  threadList.innerHTML = '';
  threads
    .filter((thread) => `${thread.name} ${thread.preview} ${thread.state} ${threadIdentitySearchText(thread)}`.toLowerCase().includes(q))
    .forEach((thread) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `thread-item${thread.id === activeThreadId ? ' is-selected' : ''}`;
      item.dataset.thread = thread.id;
      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.setAttribute('aria-hidden', 'true');
      setAvatarNode(avatar, thread.avatar, thread.avatarImageUrl);
      const main = document.createElement('div');
      main.className = 'thread-main';
      const top = document.createElement('div');
      top.className = 'thread-top';
      const name = document.createElement('div');
      setIdentityLabel(name, thread, 'thread-name identity-label');
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
  const thread = activeThread();
  if (!thread) {
    setAvatarNode(activeAvatar, 'P', null);
    activeTitle.textContent = 'No private chat';
    activeSubtitle.textContent = 'Create or choose a chat';
    messageStrip.innerHTML = '';
    if (identityMenuButton) {
      identityMenuButton.hidden = true;
      identityMenuButton.setAttribute('aria-expanded', 'false');
    }
    if (composer) composer.dataset.readOnly = 'true';
    refreshComposerPublishPolicy();
    if (messageInput) {
      messageInput.disabled = true;
      messageInput.placeholder = plathoWallet ? 'Create or choose a private chat' : 'Wallet required';
      autoResizeComposerTextarea(messageInput);
    }
    if (sendButton) sendButton.disabled = true;
    if (paymentCheckButton) paymentCheckButton.disabled = true;
    if (privateImageButton) privateImageButton.disabled = true;
    if (privateImageModeSelect) privateImageModeSelect.disabled = true;
    return;
  }
  setAvatarNode(activeAvatar, thread.avatar, thread.avatarImageUrl);
  renderConversationIdentity(thread);
  activeSubtitle.textContent = thread.subtitle;
  messageStrip.innerHTML = '';
  const isReadOnly = thread.readOnly === true;

  if (composer) composer.dataset.readOnly = isReadOnly ? 'true' : 'false';
  refreshComposerPublishPolicy();
  if (messageInput) {
    messageInput.disabled = isReadOnly || !plathoWallet;
    messageInput.placeholder = privateComposerPlaceholder({ readOnly: isReadOnly });
  }
  if (sendButton) sendButton.disabled = isReadOnly || !plathoWallet;
  if (paymentCheckButton) paymentCheckButton.disabled = isReadOnly || !plathoWallet;
  if (privateImageButton) privateImageButton.disabled = isReadOnly || !plathoWallet;
  if (privateImageModeSelect) privateImageModeSelect.disabled = isReadOnly || !plathoWallet;

  thread.messages.forEach((message) => {
    const row = document.createElement('div');
    row.className = `message ${message.type}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (message.text) {
      const text = document.createElement('div');
      text.textContent = message.text;
      bubble.append(text);
    }
    if (message.attachment?.type === 'image' && message.attachment.url) {
      const image = document.createElement('img');
      image.className = 'message-image';
      image.src = message.attachment.url;
      image.alt = '';
      image.loading = 'lazy';
      bubble.append(image);
    }
    if (message.payment) {
      const actions = document.createElement('div');
      actions.className = 'payment-actions';
      if (message.type !== 'out') {
        const claim = document.createElement('button');
        claim.type = 'button';
        claim.textContent = 'Claim';
        claim.addEventListener('click', async () => {
          claim.disabled = true;
          try {
            await submitVaultClaimPaymentCheck(message.payment);
            message.meta = 'С‡РµРє Р°РєС‚РёРІРёСЂРѕРІР°РЅ РІР°РјРё';
          } catch (error) {
            message.meta = 'С‡РµРє СѓР¶Рµ Р°РєС‚РёРІРёСЂРѕРІР°РЅ РёР»Рё РѕС‚РјРµРЅС‘РЅ РѕС‚РїСЂР°РІРёС‚РµР»РµРј';
            console.error(error);
          } finally {
            renderConversation();
          }
        });
        actions.append(claim);
      }
      if (message.type === 'out') {
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', async () => {
          cancel.disabled = true;
          try {
            await submitVaultCancelPaymentCheck(message.payment);
            message.meta = 'cancel submitted';
          } catch (error) {
            message.meta = 'cancel blocked';
            console.error(error);
          } finally {
            renderConversation();
          }
        });
        actions.append(cancel);
      }
      if (actions.children.length > 0) bubble.append(actions);
    }
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

docsButtons.forEach((button) => {
  button.addEventListener('click', () => {
    openDocsDialog(activeDocId).catch((error) => {
      console.error(error);
      setDocsStatus('Document unavailable', 'error');
    });
  });
});
installButtons.forEach((button) => {
  button.addEventListener('click', () => {
    promptInstallApp().catch((error) => {
      console.error(error);
      refreshInstallButtons();
    });
  });
});
installConfirmButton?.addEventListener('click', () => {
  promptInstallApp().catch((error) => {
    console.error(error);
    refreshInstallButtons();
  });
});
installCloseButton?.addEventListener('click', () => closeInstallDialog({ dismissed: true }));
installDismissButton?.addEventListener('click', () => closeInstallDialog({ dismissed: true }));
docsCloseButton?.addEventListener('click', closeDocsDialog);
installDialog?.addEventListener('click', (event) => {
  if (event.target === installDialog) closeInstallDialog({ dismissed: true });
});
docsDialog?.addEventListener('click', (event) => {
  if (event.target === docsDialog) closeDocsDialog();
});
docsNav?.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const button = target?.closest('button[data-doc-id]');
  if (!button) return;
  selectDoc(button.dataset.docId).catch((error) => {
    console.error(error);
    setDocsStatus('Document unavailable', 'error');
  });
});

search.addEventListener('input', renderThreads);

backToChatsButton?.addEventListener('click', () => {
  appShell.dataset.chatOpen = 'false';
  hideIdentityPopover();
});

identityMenuButton?.addEventListener('click', (event) => {
  event.stopPropagation();
  const thread = activeThread();
  if (!thread) return;
  if (identityPopover && !identityPopover.hidden) {
    hideIdentityPopover();
  } else {
    showIdentityPopover(thread, identityMenuButton);
  }
});

newChatButton?.addEventListener('click', openNewChatDialog);
closeNewChatButton?.addEventListener('click', closeNewChatDialog);
newChatDialog?.addEventListener('click', (event) => {
  if (event.target === newChatDialog) closeNewChatDialog();
});
newChatForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const result = selectOrCreateRecipientThread(recipientInput?.value, {
    localLabel: recipientLocalLabel?.value,
  });
  if (!result.ok && recipientHint) {
    recipientHint.textContent = result.error;
    recipientHint.dataset.tone = 'error';
    recipientInput?.focus();
  }
});
actionCancelButton?.addEventListener('click', () => closeActionDialog(null));
actionDialog?.addEventListener('click', (event) => {
  if (event.target === actionDialog) closeActionDialog(null);
});
actionFields?.addEventListener('input', updateActiveActionSummary);
actionFields?.addEventListener('change', updateActiveActionSummary);
actionForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  closeActionDialog(collectActionDialogValues());
});
document.addEventListener('click', (event) => {
  if (!identityPopover || identityPopover.hidden) return;
  if (identityPopover.contains(event.target)) return;
  hideIdentityPopover();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  hideIdentityPopover();
  closeNewChatDialog();
  closeActionDialog(null);
  closeDocsDialog();
  closeInstallDialog({ dismissed: false });
});

actionGrid?.addEventListener('click', async (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const button = target?.closest('button[data-action]');
  if (!button) return;
  try {
    button.disabled = true;
    if (button.dataset.action === 'vault-deposit-ton') {
      await submitVaultDepositTon();
    } else if (button.dataset.action === 'vault-withdraw-ton') {
      await submitVaultWithdrawTon();
    } else if (button.dataset.action === 'vault-deposit-ath') {
      await submitVaultDepositAth();
    } else if (button.dataset.action === 'vault-withdraw-ath') {
      await submitVaultWithdrawAth();
    }
  } catch (error) {
    setVaultStatus('transaction blocked');
    console.error(error);
  } finally {
    button.disabled = false;
  }
});

refreshVaultButton?.addEventListener('click', async () => {
  try {
    refreshVaultButton.disabled = true;
    await Promise.all([
      refreshVaultDashboard(),
      refreshVaultActivationStatus(),
      refreshAthProtocolStats(),
    ]);
  } finally {
    refreshVaultButton.disabled = false;
  }
});

for (const card of vaultMoveCards) {
  card.directionButton?.addEventListener('click', () => {
    vaultMoveDirections = {
      ...vaultMoveDirections,
      [card.asset]: vaultMoveDirections[card.asset] === 'to-vault' ? 'from-vault' : 'to-vault',
    };
    refreshVaultMoveWidget();
  });

  card.maxButton?.addEventListener('click', () => {
    const max = vaultMoveMaxAmount(card.asset);
    if (max === null) return;
    if (card.input) card.input.value = formatVaultMoveAmountInput(max);
    refreshVaultMoveWidget();
  });

  card.form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!plathoWallet) return;
    const raw = card.input?.value ?? '';
    const direction = vaultMoveDirection(card.asset);
    try {
      if (card.submitButton) card.submitButton.disabled = true;
      const amount = card.asset === 'ATH' ? parseAthAmountAtomic(raw) : parseTonAmountNanotons(raw);
      if (card.asset === 'TON' && direction === 'to-vault') {
        await submitVaultDepositTonAmount(amount);
      } else if (card.asset === 'TON') {
        await submitVaultWithdrawTonAmount(amount);
      } else if (direction === 'to-vault') {
        await submitVaultDepositAthAmount(amount);
      } else {
        await submitVaultWithdrawAthAmount(amount);
      }
      if (card.input) card.input.value = '';
      await refreshVaultDashboard();
    } catch (error) {
      setVaultStatus('move blocked');
      console.error(error);
    } finally {
      refreshVaultMoveWidget();
    }
  });
}

publicSyncWindowSelect?.addEventListener('change', async () => {
  const value = writePublicSyncWindow(publicSyncWindowSelect.value);
  updatePublicSyncWindowUi();
  setPublicStatus(value === 'all' ? 'syncing all time' : `syncing ${publicSyncWindowLabel(value)}`);
  rebuildThreadsFromPublicSubscriptions({ preserveActive: true });
  renderPublicSurface({ anchorUnread: true });
  try {
    await syncPublicChannels();
  } catch (error) {
    setPublicStatus('sync blocked');
    console.error(error);
  }
});

publicCommentsDefaultSelect?.addEventListener('change', () => {
  const value = writePublicCommentsDefault(publicCommentsDefaultSelect.value);
  updatePublicCommentsDefaultUi();
  setPublicStatus(`comments ${publicCommentsDefaultLabel(value)} by default`);
});

mintUsernameButton?.addEventListener('click', async () => {
  try {
    mintUsernameButton.disabled = true;
    await submitUsernameMint();
  } catch (error) {
    setText(identitySubtitle, 'username blocked');
    console.error(error);
  } finally {
    mintUsernameButton.disabled = false;
  }
});

flushUsernameRefundButton?.addEventListener('click', async () => {
  try {
    flushUsernameRefundButton.disabled = true;
    await submitUsernameRefundFlush();
  } catch (error) {
    setText(identitySubtitle, 'refund blocked');
    console.error(error);
  } finally {
    flushUsernameRefundButton.disabled = false;
  }
});

burnAthButton?.addEventListener('click', async () => {
  try {
    burnAthButton.disabled = true;
    await submitAthWalletBurn();
  } catch (error) {
    setText(identitySubtitle, 'ATH burn blocked');
    console.error(error);
  } finally {
    burnAthButton.disabled = false;
  }
});

replaceVaultKeysButton?.addEventListener('click', async () => {
  try {
    replaceVaultKeysButton.disabled = true;
    await submitVaultReplaceMessagingKeys();
  } catch (error) {
    setText(vaultRotateStatus, 'rotate blocked');
    console.error(error);
  } finally {
    replaceVaultKeysButton.disabled = false;
  }
});

syncMessagesButton?.addEventListener('click', async () => {
  try {
    syncMessagesButton.disabled = true;
    setText(messageSyncStatus, 'syncing');
    await syncPrivateCapsulesFromChain();
    await syncPublicChannels();
    setText(messageSyncStatus, 'synced');
  } catch (error) {
    setText(messageSyncStatus, 'sync blocked');
    console.error(error);
  } finally {
    syncMessagesButton.disabled = false;
  }
});

publicFeedModeButton?.addEventListener('click', () => {
  publicDisplayMode = 'feed';
  renderPublicSurface({ anchorUnread: true });
});

publicChannelsModeButton?.addEventListener('click', () => {
  publicDisplayMode = 'channels';
  renderPublicSurface();
});

publicChannelSearch?.addEventListener('input', () => {
  publicChannelSearchQuery = publicChannelSearch.value;
  renderPublicSurface();
});

addPublicChannelButton?.addEventListener('click', async () => {
  try {
    const result = await openActionDialog({
      title: 'Add public channel',
      hint: 'Use a wallet address, xxxx.ton, or xxxx.ath. Local label is only shown on this device.',
      submitLabel: 'Add channel',
      fields: [
        {
          id: 'channelIdentity',
          label: 'Channel',
          placeholder: 'EQ..., xxxx.ton, or xxxx.ath',
          autocomplete: 'off',
        },
        {
          id: 'localLabel',
          label: 'Local label',
          placeholder: 'Optional, e.g. Anonymous',
          required: false,
          autocomplete: 'off',
        },
      ],
    });
    if (!result) return;
    const resolved = await resolvePublicChannelIdentity(result.channelIdentity);
    const { identity, authorWallet } = resolved;
    const localLabel = result.localLabel?.trim();
    const name = localLabel || (
      identity.type === RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS
        ? shortAddress(authorWallet)
        : identity.label
    );
    const id = `wallet:${authorWallet}`;
    addCustomPublicChannel({
      id,
      name,
      avatar: publicChannelAvatar(name),
      subtitle: localLabel
        ? `${publicChannelSubtitleForIdentity(identity)} - ${publicChannelRouteLabel(identity, authorWallet)}`
        : publicChannelSubtitleForIdentity(identity),
      authorWallet,
    });
    if (publicChannelSearch) {
      publicChannelSearch.value = '';
      publicChannelSearchQuery = '';
    }
    setPublicStatus('channel added');
  } catch (error) {
    setPublicStatus('channel blocked');
    console.error(error);
  }
});

publicJumpDownButton?.addEventListener('click', () => {
  const items = publicFeedItemsChronological();
  markVisiblePublicFeedRead(items);
  renderPublicSurface({ anchorUnread: false });
  requestAnimationFrame(() => {
    publicFeed?.scrollTo?.({ top: publicFeed.scrollHeight, behavior: 'smooth' });
    requestAnimationFrame(updatePublicJumpDownVisibility);
  });
});

publicFeed?.addEventListener('scroll', updatePublicJumpDownVisibility, { passive: true });

publicCancelCommentButton?.addEventListener('click', () => {
  setPublicCommentTarget(null);
  autoResizeComposerTextarea(publicMessageInput);
  refreshComposerCostStatus();
});

publicComposerCommentsCheckbox?.addEventListener('change', () => {
  setPublicStatus(publicComposerCommentsCheckbox.checked
    ? 'next post allows comments'
    : 'next post closes comments');
});

paymentCheckButton?.addEventListener('click', async () => {
  try {
    paymentCheckButton.disabled = true;
    await submitCreatePaymentCheck();
  } catch (error) {
    refreshMessagingControls();
    console.error(error);
  } finally {
    paymentCheckButton.disabled = false;
  }
});

registerVaultKeysButton?.addEventListener('click', async () => {
  try {
    registerVaultKeysButton.disabled = true;
    await submitVaultRegisterMessagingKeys();
  } catch (error) {
    vaultDraftStatus.textContent = 'send blocked';
    console.error(error);
  } finally {
    registerVaultKeysButton.disabled = false;
  }
});

keySuiteSelect?.addEventListener('change', () => {
  const suite = normalizeCryptoSuite(keySuiteSelect.value);
  writePreferredCryptoSuite(suite);
  updateKeySuiteUi(suite);
  setText(encryptionStatus, 'rotating');
  bootCrypto().catch((error) => {
    setText(encryptionStatus, 'blocked');
    console.error(error);
  });
});

messageInput?.addEventListener('input', () => {
  enforceComposerByteLimit();
  autoResizeComposerTextarea(messageInput);
  refreshComposerCostStatus();
});
messageInput?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) return;
  event.preventDefault();
  composer?.requestSubmit?.();
});

publicMessageInput?.addEventListener('input', () => {
  enforcePublicComposerByteLimit();
  autoResizeComposerTextarea(publicMessageInput);
  refreshComposerCostStatus();
});
publicMessageInput?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) return;
  event.preventDefault();
  publicComposer?.requestSubmit?.();
});

privateImageButton?.addEventListener('click', () => {
  if (!plathoWallet) {
    refreshComposerPublishPolicy();
    return;
  }
  privateImageInput?.click();
});

publicImageButton?.addEventListener('click', () => {
  if (!plathoWallet) {
    refreshComposerPublishPolicy();
    return;
  }
  publicImageInput?.click();
});

privateImageInput?.addEventListener('change', async () => {
  const file = privateImageInput.files?.[0];
  if (!file) return;
  await setImageAttachment('private', file, privateImageModeSelect?.value ?? DEFAULT_IMAGE_COMPRESSION_MODE_ID);
});

publicImageInput?.addEventListener('change', async () => {
  const file = publicImageInput.files?.[0];
  if (!file) return;
  await setImageAttachment('public', file, publicImageModeSelect?.value ?? DEFAULT_IMAGE_COMPRESSION_MODE_ID);
});

privateImageModeSelect?.addEventListener('change', () => {
  recompressImageAttachment('private').catch((error) => {
    console.error(error);
  });
});

publicImageModeSelect?.addEventListener('change', () => {
  recompressImageAttachment('public').catch((error) => {
    console.error(error);
  });
});

setAvatarButton?.addEventListener('click', () => {
  if (!plathoWallet) {
    setText(identitySubtitle, 'create wallet first');
    return;
  }
  profileAvatarInput?.click();
});

profileAvatarInput?.addEventListener('change', async () => {
  const file = profileAvatarInput.files?.[0];
  if (!file) return;
  try {
    setAvatarButton?.toggleAttribute('disabled', true);
    await submitProfileAvatarUpdate(file, publicImageModeSelect?.value ?? DEFAULT_IMAGE_COMPRESSION_MODE_ID);
  } catch (error) {
    setText(identitySubtitle, 'avatar blocked');
    console.error(error);
  } finally {
    if (profileAvatarInput) profileAvatarInput.value = '';
    setAvatarButton?.toggleAttribute('disabled', false);
  }
});

privateClearImageButton?.addEventListener('click', () => {
  privateImageAttachment = null;
  updateImageAttachmentUi('private');
  refreshComposerCostStatus();
});

publicClearImageButton?.addEventListener('click', () => {
  publicImageAttachment = null;
  updateImageAttachmentUi('public');
  refreshComposerCostStatus();
});

publicComposer?.addEventListener('submit', async (event) => {
  event.preventDefault();
  enforcePublicComposerByteLimit();
  const text = publicMessageInput?.value.trim() ?? '';
  if (!text && !publicImageAttachment) return;
  if (!plathoWallet) {
    setPublicStatus('create wallet first');
    return;
  }
  const commentsAllowed = publicComposerCommentsCheckbox?.checked !== false;
  if (!publicCommentTarget && commentsAllowed && !(await confirmPublicCommentsRisk())) {
    setPublicStatus('publish cancelled');
    return;
  }
  const send = publicComposer.querySelector('.send-button');
  send?.toggleAttribute('disabled', true);
  try {
    if (publicCommentTarget) {
      await submitPublicCommentThroughVault(publicCommentTarget, text);
    } else {
      await submitPublicPostThroughVault({
        text,
        attachment: publicImageAttachment,
        commentsAllowed,
      });
    }
    publicMessageInput.value = '';
    publicImageAttachment = null;
    updateImageAttachmentUi('public');
    setPublicCommentTarget(null);
    autoResizeComposerTextarea(publicMessageInput);
    refreshComposerCostStatus();
  } catch (error) {
    setPublicStatus(publicCommentTarget ? 'comment blocked' : 'publish blocked');
    console.error(error);
  } finally {
    send?.toggleAttribute('disabled', !plathoWallet);
  }
});

composer?.addEventListener('submit', async (event) => {
  event.preventDefault();
  refreshComposerPublishPolicy();
  enforceComposerByteLimit();
  const text = messageInput.value.trim();
  if (!text && !privateImageAttachment) return;
  const thread = threads.find((item) => item.id === activeThreadId) ?? threads[0];
  if (thread.readOnly) {
    messageInput.value = '';
    renderConversation();
    return;
  }
  if (!plathoWallet?.address || !appConfig.vault?.address) {
    refreshMessagingControls();
    return;
  }
  if (!localIdentity || !localRecipientKeyPair || !localSignedPublicBundle) {
    if (privateComposerCostStatus) {
      privateComposerCostStatus.textContent = 'Activate wallet before messaging';
      privateComposerCostStatus.dataset.state = 'short';
    }
    refreshMessagingControls();
    return;
  }

  const message = { type: 'out', text, meta: 'local' };
  try {
    const recipientEntry = await resolveRecipientPeerEntry(thread);
    const capsules = await createPrivateComposerCapsules(text, privateImageAttachment, recipientEntry, activeThreadId);
    const capsule = capsules[0];
    message.capsule = capsule;
    message.capsules = capsules;
    message.recipientWallet = recipientEntry.walletAddress;
    if (privateImageAttachment) {
      message.attachment = {
        type: 'image',
        url: privateImageAttachment.dataUrl,
        bytes: privateImageAttachment.bytes.length,
        mode: privateImageAttachment.mode.id,
      };
    }
    message.meta = capsules.length > 1
      ? `${capsule.header0.suite} local capsule (${capsules.length} parts)`
      : `${capsule.header0.suite} local capsule`;
    const publishResult = capsules.length > 1
      ? await publishCapsulesThroughVault(capsules)
      : await publishCapsuleThroughVault(capsule);
    message.vaultPublish = publishResult;
    if (publishResult.status !== 'vault-publish-sent') {
      throw new Error('Vault publish was not sent');
    }
    message.meta = 'published';
    refreshMessagingControls();
  } catch (error) {
    refreshMessagingControls();
    console.error(error);
    return;
  }
  thread.messages.push(message);
  thread.preview = text || (message.attachment ? 'Image' : '');
  thread.time = 'now';
  thread.state = message.capsule ? 'sealed' : 'local';
  await persistMessageToEncryptedHistory(thread, message);
  messageInput.value = '';
  privateImageAttachment = null;
  updateImageAttachmentUi('private');
  autoResizeComposerTextarea(messageInput);
  refreshComposerCostStatus();
  renderThreads();
  renderConversation();
});

createWalletButton?.addEventListener('click', async () => {
  try {
    createWalletButton.disabled = true;
    const wallet = await setPlathoWallet(await createPlathoWallet(plathoWalletNetworkOptions()));
    setText(walletAddressStatus, shortAddress(wallet.address));
    setText(identityName, shortAddress(wallet.address));
    setText(identitySubtitle, 'Wallet created');
    await showWalletSeed('Wallet created', exportPlathoWalletSeed(wallet));
  } catch (error) {
    setText(walletAddressStatus, 'blocked');
    console.error(error);
  } finally {
    refreshMessagingControls();
  }
});

importWalletButton?.addEventListener('click', async () => {
  const seed = await requestWalletSeedImport();
  if (!seed) return;
  try {
    importWalletButton.disabled = true;
    const wallet = await setPlathoWallet(await importPlathoWallet(seed, plathoWalletNetworkOptions()));
    setText(walletAddressStatus, shortAddress(wallet.address));
    setText(identityName, shortAddress(wallet.address));
    setText(identitySubtitle, 'Wallet imported');
  } catch (error) {
    setText(walletAddressStatus, 'import blocked');
    console.error(error);
  } finally {
    refreshMessagingControls();
  }
});

exportWalletSeedButton?.addEventListener('click', async () => {
  try {
    const wallet = requirePlathoWallet();
    await showWalletSeed('Wallet seed', exportPlathoWalletSeed(wallet));
  } catch (error) {
    setText(walletAddressStatus, 'export blocked');
    console.error(error);
  }
});

function shortAddress(address) {
  const text = String(address ?? '');
  if (text.length <= 16) return text || 'connected';
  return `${text.slice(0, 6)}...${text.slice(-6)}`;
}

function requireVaultAddress() {
  const address = appConfig.vault?.address;
  if (!address) throw new Error('Vault contract address is not configured');
  return address;
}

function requireVaultDeploymentManifestHash() {
  const hash = appConfig.vault?.deploymentManifestHash ?? globalThis.plathoVaultDeploymentManifestHash;
  if (!hash) throw new Error('Vault deployment manifest hash is not configured');
  return hash;
}

function requireAthMasterAddress() {
  const address = appConfig.ath?.masterAddress ?? globalThis.plathoAthMasterAddress;
  if (!address) throw new Error('ATHMaster contract address is not configured');
  return address;
}

function requireUsernameRegistryAddress() {
  const address = appConfig.usernameRegistry?.address ?? globalThis.plathoUsernameRegistryAddress;
  if (!address) throw new Error('UsernameRegistry contract address is not configured');
  return address;
}

function requireProfileRegistryAddress() {
  const address = appConfig.profileRegistry?.address ?? globalThis.plathoProfileRegistryAddress;
  if (!address) throw new Error('ProfileRegistry contract address is not configured');
  return address;
}

function requireBasechainAddress(address, label) {
  const parsed = parseTonAddress(address);
  if (parsed.workchain !== 0) throw new Error(`${label} must be a basechain address`);
  return parsed.raw;
}

function requirePlathoWallet() {
  if (!plathoWallet?.address) throw new Error('Create or import a Platho wallet first');
  return plathoWallet;
}

function requirePlathoWalletAddress() {
  return requirePlathoWallet().address;
}

function parseDecimalAmount(input, decimals, symbol) {
  const text = String(input ?? '').trim().replace(',', '.');
  const match = text.match(new RegExp(`^([0-9]+)(?:\\.([0-9]{0,${decimals}}))?$`));
  if (!match) throw new Error(`${symbol} amount must be a positive decimal with up to ${decimals} digits after dot`);
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? '').padEnd(decimals, '0'));
  const amount = whole * (10n ** BigInt(decimals)) + fraction;
  if (amount <= 0n) throw new Error(`${symbol} amount must be positive`);
  return amount;
}

function parseTonAmountNanotons(input) {
  return parseDecimalAmount(input, 9, 'TON');
}

function parseAthAmountAtomic(input) {
  return parseDecimalAmount(input, 9, 'ATH');
}

function formatDecimalAmount(units, decimals, fractionDigits = 4) {
  const amount = BigInt(units ?? 0n);
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = amount % scale;
  if (fractionDigits <= 0) return whole.toString();
  const divisor = 10n ** BigInt(decimals - fractionDigits);
  const shown = (fraction / divisor).toString().padStart(fractionDigits, '0').replace(/0+$/, '');
  return shown ? `${whole}.${shown}` : whole.toString();
}

function formatTonNanotons(value) {
  return formatDecimalAmount(value, 9, 4);
}

function formatAthAtomic(value) {
  return formatDecimalAmount(value, 9, 4);
}

function groupDecimalText(text) {
  const [whole, fraction] = String(text ?? '').split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `${grouped}.${fraction}` : grouped;
}

function formatAthProfileAmount(value) {
  if (value === null || value === undefined) return '-';
  return `${groupDecimalText(formatAthAtomic(value))} ATH`;
}

function formatBasisPointsPercent(bps) {
  const basis = nonNegativeBigInt(bps);
  const whole = basis / 100n;
  const fraction = basis % 100n;
  return fraction === 0n
    ? `${whole}%`
    : `${whole}.${fraction.toString().padStart(2, '0').replace(/0+$/, '')}%`;
}

function renderAthProfileStats() {
  setText(athSupplyStatus, formatAthProfileAmount(athProtocolState.total_supply));
  const total = nonNegativeBigInt(
    vaultProtocolState?.airdrop_total_allocation_ath,
    VAULT_ACTIVITY_AIRDROP_TOTAL_ATH_ATOMIC,
  );
  const remainingRaw = vaultProtocolState?.airdrop_remaining_ath;
  if (remainingRaw === null || remainingRaw === undefined || total <= 0n) {
    setText(athDropIssuedStatus, '-');
    return;
  }
  const remaining = nonNegativeBigInt(remainingRaw);
  const issued = remaining >= total ? 0n : total - remaining;
  const percent = (issued * 10_000n) / total;
  setText(athDropIssuedStatus, `${formatBasisPointsPercent(percent)} / ${formatAthProfileAmount(issued)}`);
}

function formatVaultMoveAmountInput(units) {
  if (units === null || units === undefined) return '';
  return formatDecimalAmount(units, 9, 9);
}

function normalizeUsernameInput(input) {
  const raw = String(input ?? '').trim().toLowerCase();
  const username = raw.endsWith('.ath') ? raw.slice(0, -4) : raw;
  if (!/^[a-z0-9]{4,32}$/.test(username)) {
    throw new Error('Username must be 4-32 lowercase letters or digits, with optional .ath suffix');
  }
  return username;
}

async function requestAmountNanotons({ title, hint, symbol, parser, placeholder = '0.00' }) {
  let feedback = hint;
  let tone = 'muted';
  let amountValue = '';
  while (true) {
    const result = await openActionDialog({
      title,
      hint: feedback,
      tone,
      submitLabel: 'Review transaction',
      fields: [{
        id: 'amount',
        label: `${symbol} amount`,
        inputMode: 'decimal',
        placeholder,
        autocomplete: 'off',
        value: amountValue,
      }],
      summary: (values) => [
        { label: 'Asset', value: symbol },
        { label: 'Amount', value: values.amount?.trim() || 'not set' },
      ],
    });
    if (!result) return null;
    amountValue = result.amount;
    try {
      return parser(result.amount);
    } catch (error) {
      feedback = error.message;
      tone = 'error';
    }
  }
}

function requestTonAmountNanotons(title, hint) {
  return requestAmountNanotons({
    title,
    hint,
    symbol: 'TON',
    parser: parseTonAmountNanotons,
  });
}

function requestAthAmountAtomic(title, hint) {
  return requestAmountNanotons({
    title,
    hint,
    symbol: 'ATH',
    parser: parseAthAmountAtomic,
  });
}

async function requestWalletSeedImport() {
  const result = await openActionDialog({
    title: 'Import wallet',
    hint: 'Paste the Platho seed for the wallet that owns your messages.',
    submitLabel: 'Import wallet',
    fields: [{
      id: 'seed',
      label: 'Seed',
      type: 'textarea',
      placeholder: 'Paste seed words or encoded seed',
      autocomplete: 'off',
    }],
    summary: ['This wallet key unlocks on-chain messages and signs protocol transactions.'],
  });
  const seed = result?.seed?.trim();
  return seed ? seed : null;
}

function showWalletSeed(title, seed, hint = 'Keep this seed private. It controls this wallet and its messages.') {
  return openActionDialog({
    title,
    hint,
    submitLabel: 'Done',
    fields: [{
      id: 'seed',
      label: 'Seed',
      type: 'textarea',
      value: seed,
      readOnly: true,
      required: false,
    }],
    summary: ['Store it now. The PWA cannot recover it later without the seed.'],
  });
}

async function requestUsernameMintName() {
  let feedback = 'Choose the exact .ath name to mint.';
  let tone = 'muted';
  let usernameValue = '';
  while (true) {
    const result = await openActionDialog({
      title: 'Mint Platho name',
      hint: feedback,
      tone,
      submitLabel: 'Review mint',
      fields: [{
        id: 'username',
        label: 'Username',
        placeholder: 'xxxx.ath',
        autocomplete: 'off',
        value: usernameValue,
      }],
      summary: (values) => {
        const raw = values.username?.trim() || 'not set';
        return [
          { label: 'Display', value: raw.endsWith('.ath') ? raw : `${raw}.ath` },
          { label: 'Route', value: 'UsernameRegistry' },
        ];
      },
    });
    if (!result) return null;
    usernameValue = result.username;
    try {
      return normalizeUsernameInput(result.username);
    } catch (error) {
      feedback = error.message;
      tone = 'error';
    }
  }
}

async function requestPaymentCheckDetails() {
  let feedback = 'The encrypted check is readable by this chat only.';
  let tone = 'muted';
  let assetValue = 'TON';
  let amountValue = '';
  while (true) {
    const result = await openActionDialog({
      title: 'Create payment check',
      hint: feedback,
      tone,
      submitLabel: 'Create check',
      fields: [
        {
          id: 'asset',
          label: 'Asset',
          type: 'select',
          options: [
            { value: 'TON', label: 'TON' },
            { value: 'ATH', label: 'ATH' },
          ],
          value: assetValue,
        },
        {
          id: 'amount',
          label: 'Amount',
          inputMode: 'decimal',
          placeholder: '0.00',
          autocomplete: 'off',
          value: amountValue,
        },
      ],
      summary: (values) => [
        { label: 'Asset', value: values.asset || 'TON' },
        { label: 'Amount', value: values.amount?.trim() || 'not set' },
      ],
    });
    if (!result) return null;
    assetValue = result.asset;
    amountValue = result.amount;
    try {
      const asset = parsePaymentAsset(result.asset);
      const amount = asset === RECEIVE_ASSETS.TON
        ? parseTonAmountNanotons(result.amount)
        : parseAthAmountAtomic(result.amount);
      return { asset, amount };
    } catch (error) {
      feedback = error.message;
      tone = 'error';
    }
  }
}

function nextQueryId() {
  const entropy = new Uint32Array(1);
  globalThis.crypto?.getRandomValues?.(entropy);
  return (BigInt(Date.now()) << 20n) + BigInt(entropy[0] & 0xfffff);
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? []));
  return `0x${bytesToHex(new Uint8Array(digest))}`;
}

function bytesToBase64(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? []);
  let binary = '';
  for (const byte of input) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesToImageDataUrl(bytes, mime = 'image/webp') {
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

async function blobToBytes(blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

function canvasToWebpBytes(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Image compression failed'));
        return;
      }
      resolve(await blobToBytes(blob));
    }, 'image/webp', quality);
  });
}

async function compressImageFile(file, modeId) {
  if (!file || !/^image\//i.test(file.type ?? '')) throw new Error('Choose an image file');
  const mode = imageCompressionMode(modeId);
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas is unavailable');
  const maxOriginalSide = Math.max(bitmap.width, bitmap.height);
  let best = null;
  for (const side of [1024, 896, 768, 640, 512, 448, 384, 320, 256, 192, 160, 128, 96, 64, 48, 32, 24, 16]) {
    const scale = Math.min(1, side / maxOriginalSide);
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.76, 0.66, 0.56, 0.46, 0.36, 0.28, 0.2, 0.14, 0.08]) {
      const bytes = await canvasToWebpBytes(canvas, quality);
      if (!best || bytes.length < best.bytes.length) {
        best = { bytes, width: canvas.width, height: canvas.height, quality };
      }
      if (bytes.length <= mode.maxBytes) {
        bitmap.close?.();
        return {
          ...best,
          mode,
          name: file.name || 'image.webp',
          sourceFile: file,
          mime: 'image/webp',
          dataUrl: bytesToImageDataUrl(bytes, 'image/webp'),
        };
      }
    }
  }
  bitmap.close?.();
  if (!best) throw new Error('Image compression failed');
  if (best.bytes.length > mode.maxBytes) {
    throw new Error(`Image could not fit ${Math.ceil(mode.maxBytes / 1024)} KiB`);
  }
  return {
    ...best,
    mode,
    name: file.name || 'image.webp',
    sourceFile: file,
    mime: 'image/webp',
    dataUrl: bytesToImageDataUrl(best.bytes, 'image/webp'),
  };
}

function hexToBytes(hex) {
  const text = String(hex ?? '').trim();
  if (!/^[0-9a-fA-F]+$/.test(text) || text.length % 2 !== 0) {
    throw new Error('Invalid hex bytes');
  }
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(text.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToBigIntValue(bytes) {
  let value = 0n;
  for (const byte of bytes ?? []) value = (value << 8n) | BigInt(byte);
  return value;
}

function uint256HexToBigInt(value, name = 'uint256') {
  const text = normalizeAvatarHashHex(value).slice(2);
  const bigint = BigInt(`0x${text}`);
  if (bigint < 0n || bigint >= (1n << 256n)) throw new Error(`${name} is out of range`);
  return bigint;
}

function bigIntToFixedBytes(value, length, name = 'value') {
  const bigint = typeof value === 'bigint' ? value : BigInt(value);
  if (bigint < 0n) throw new Error(`${name} must be unsigned`);
  const hex = bigint.toString(16).padStart(length * 2, '0');
  if (hex.length > length * 2) throw new Error(`${name} does not fit ${length} bytes`);
  return hexToBytes(hex);
}

function formatAtomicAmount(amount, decimals = 9) {
  const value = typeof amount === 'bigint' ? amount : BigInt(amount ?? 0);
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = value % scale;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(decimals, '0').replace(/0+$/, '')}`;
}

function paymentAssetLabel(asset) {
  const value = typeof asset === 'bigint' ? asset : BigInt(asset ?? 0);
  if (value === RECEIVE_ASSETS.TON) return 'TON';
  if (value === RECEIVE_ASSETS.ATH) return 'ATH';
  return `asset ${value.toString()}`;
}

function parsePaymentAsset(input) {
  const normalized = String(input ?? '').trim().toUpperCase();
  if (normalized === 'TON') return RECEIVE_ASSETS.TON;
  if (normalized === 'ATH') return RECEIVE_ASSETS.ATH;
  throw new Error('Payment asset must be TON or ATH');
}

function paymentMessageText(payment) {
  const amount = formatAtomicAmount(payment.amount);
  return `${paymentAssetLabel(payment.asset)} check ${amount}`;
}

function normalizePaymentForMessage(payment) {
  return {
    asset: String(payment.asset),
    amount: String(payment.amount),
    intentId: String(payment.intentId),
    intentIdHex: payment.intentIdHex ?? bytesToHex(bigIntToFixedBytes(payment.intentId, 32, 'intent id')),
    secret32Hex: payment.secret32Hex ?? bytesToHex(payment.secret32Bytes ?? bigIntToFixedBytes(payment.secret32, 32, 'secret32')),
  };
}

function paymentFromCompactPayload(payload) {
  if (payload?.type !== 'payment') return null;
  const intentId = bytesToBigIntValue(payload.intentId);
  return normalizePaymentForMessage({
    asset: BigInt(payload.asset),
    amount: payload.amount,
    intentId,
    intentIdHex: bytesToHex(payload.intentId),
    secret32Hex: bytesToHex(payload.secret32),
  });
}

function paymentIntentId(payment) {
  return BigInt(payment.intentId ?? `0x${payment.intentIdHex}`);
}

function paymentSecret32(payment) {
  return BigInt(`0x${payment.secret32Hex}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadConnectedVaultUser() {
  const provider = await resolveVaultChainProvider();
  if (!provider?.getUser) throw new Error('Vault chain provider is not configured');
  return provider.getUser(requirePlathoWalletAddress(), {
    vaultAddress: requireVaultAddress(),
  });
}

async function loadConnectedVaultGlobal() {
  const provider = await resolveVaultChainProvider();
  if (!provider?.getGlobal) throw new Error('Vault chain provider is not configured');
  return provider.getGlobal({
    vaultAddress: requireVaultAddress(),
  });
}

function optionalBalanceText(value, formatter) {
  return value === null || value === undefined ? '-' : formatter(value);
}

function extractTonWalletBalance(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value >= 0n ? value : null;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^[0-9]+$/.test(value.trim())) return BigInt(value.trim());
  if (typeof value === 'object') {
    return extractTonWalletBalance(
      value.balance
      ?? value.ton_balance
      ?? value.tonBalance
      ?? value.account?.balance
      ?? value.result?.balance
      ?? value.result?.account?.balance,
    );
  }
  return null;
}

async function loadConnectedTonWalletBalance() {
  const address = requirePlathoWalletAddress();
  const candidates = [
    globalThis.plathoWalletBalanceProvider,
    globalThis.plathoTonWalletProvider,
    globalThis.plathoTonRpcTransport,
  ].filter(Boolean);
  for (const provider of candidates) {
    for (const method of ['getTonBalance', 'getWalletBalance', 'getAccountBalance', 'getBalance']) {
      if (typeof provider?.[method] !== 'function') continue;
      try {
        const balance = extractTonWalletBalance(await provider[method](address));
        if (balance !== null) return balance;
      } catch {
        // Try the next provider shape.
      }
    }
    if (typeof provider?.getAccount === 'function') {
      try {
        const balance = extractTonWalletBalance(await provider.getAccount(address));
        if (balance !== null) return balance;
      } catch {
        // Try the next provider.
      }
    }
  }
  return null;
}

async function loadConnectedAthWalletBalance() {
  const athWalletAddress = await loadConnectedAthWalletAddress();
  const provider = createAthWalletTonRpcProvider({ athWalletAddress });
  const data = await provider.getWalletData({ address: athWalletAddress });
  return nonNegativeBigInt(data.balance);
}

async function loadConnectedWalletBalances() {
  const [tonResult, athResult] = await Promise.allSettled([
    loadConnectedTonWalletBalance(),
    loadConnectedAthWalletBalance(),
  ]);
  return {
    ton_balance: tonResult.status === 'fulfilled' ? tonResult.value : null,
    ath_balance: athResult.status === 'fulfilled' ? athResult.value : null,
  };
}

function renderVaultPocketCards(walletBalances, vaultUser) {
  vaultPocketState = {
    wallet: {
      ton_balance: walletBalances?.ton_balance ?? null,
      ath_balance: walletBalances?.ath_balance ?? null,
    },
    vault: {
      ton_balance: vaultUser?.exists === true ? nonNegativeBigInt(vaultUser.ton_balance) : null,
      ath_balance: vaultUser?.exists === true ? nonNegativeBigInt(vaultUser.ath_balance) : null,
    },
  };
  renderVaultCards([]);
  refreshVaultMoveWidget();
}

function vaultMoveDirection(asset) {
  return vaultMoveDirections[asset] === 'from-vault' ? 'from-vault' : 'to-vault';
}

function vaultMoveSourcePocket(asset) {
  return vaultMoveDirection(asset) === 'to-vault' ? 'wallet' : 'vault';
}

function vaultMoveTargetPocket(asset) {
  return vaultMoveDirection(asset) === 'to-vault' ? 'vault' : 'wallet';
}

function vaultMoveBalance(pocket, asset) {
  return asset === 'ATH'
    ? vaultPocketState[pocket]?.ath_balance
    : vaultPocketState[pocket]?.ton_balance;
}

function vaultMoveFormattedBalance(pocket, asset) {
  const balance = vaultMoveBalance(pocket, asset);
  return asset === 'ATH'
    ? optionalBalanceText(balance, formatAthAtomic)
    : optionalBalanceText(balance, formatTonNanotons);
}

function vaultMoveMaxAmount(asset) {
  const source = vaultMoveSourcePocket(asset);
  const balance = vaultMoveBalance(source, asset);
  if (balance === null || balance === undefined) return null;
  if (asset === 'TON' && source === 'wallet') {
    return balance > VAULT_MOVE_WALLET_TON_GAS_KEEP_NANOTONS
      ? balance - VAULT_MOVE_WALLET_TON_GAS_KEEP_NANOTONS
      : 0n;
  }
  return balance;
}

function refreshVaultMoveWidget() {
  for (const card of vaultMoveCards) {
    const direction = vaultMoveDirection(card.asset);
    const source = vaultMoveSourcePocket(card.asset);
    const target = vaultMoveTargetPocket(card.asset);
    const sourceLabel = source === 'wallet' ? 'Wallet' : 'Vault';
    const targetLabel = target === 'wallet' ? 'Wallet' : 'Vault';
    setText(card.walletBalance, vaultMoveFormattedBalance('wallet', card.asset));
    setText(card.vaultBalance, vaultMoveFormattedBalance('vault', card.asset));
    setText(card.fromLabel, sourceLabel);
    setText(card.toLabel, targetLabel);
    if (card.submitButton) {
      card.submitButton.textContent = direction === 'to-vault'
        ? `Move ${card.asset} to Vault`
        : `Move ${card.asset} to Wallet`;
      card.submitButton.disabled = !plathoWallet;
    }
    if (card.form) {
      card.form.dataset.direction = direction;
      card.form.dataset.source = source;
      card.form.dataset.target = target;
    }
    if (card.input) card.input.disabled = !plathoWallet;
    if (card.maxButton) card.maxButton.disabled = !plathoWallet;
    if (card.directionButton) card.directionButton.disabled = !plathoWallet;
  }
}

async function refreshVaultDashboard() {
  if (!plathoWallet?.address) {
    vaultPocketState = {
      wallet: { ton_balance: null, ath_balance: null },
      vault: { ton_balance: null, ath_balance: null },
    };
    vaultProtocolState = {
      airdrop_remaining_ath: VAULT_ACTIVITY_AIRDROP_TOTAL_ATH_ATOMIC,
      airdrop_total_allocation_ath: VAULT_ACTIVITY_AIRDROP_TOTAL_ATH_ATOMIC,
    };
    renderAthProfileStats();
    renderVaultCards(appConfig.ui?.vaultCards ?? []);
    refreshVaultMoveWidget();
    refreshComposerCostStatus();
    setVaultStatus('wallet required');
    return null;
  }
  let user = null;
  let global = null;
  let userError = null;
  const [walletBalancesResult, userResult, globalResult] = await Promise.allSettled([
    loadConnectedWalletBalances(),
    loadConnectedVaultUser(),
    loadConnectedVaultGlobal(),
  ]);
  const walletBalances = walletBalancesResult.status === 'fulfilled'
    ? walletBalancesResult.value
    : { ton_balance: null, ath_balance: null };
  if (userResult.status === 'fulfilled') {
    user = userResult.value;
  } else {
    userError = userResult.reason;
  }
  if (globalResult.status === 'fulfilled') {
    global = globalResult.value;
  }
  vaultProtocolState = {
    airdrop_remaining_ath: global?.airdrop_remaining_ath ?? null,
    airdrop_total_allocation_ath: global?.airdrop_total_allocation_ath ?? VAULT_ACTIVITY_AIRDROP_TOTAL_ATH_ATOMIC,
  };
  renderAthProfileStats();
  renderVaultPocketCards(walletBalances, user);
  refreshComposerCostStatus();
  if (user) {
    setVaultStatus(user.exists === true ? 'synced' : 'activation required');
    globalThis.plathoVaultBinding = {
      ...(globalThis.plathoVaultBinding ?? {}),
      user,
      walletAddress: plathoWallet.address,
    };
    refreshComposerPublishPolicy();
    return user;
  }
  setVaultStatus('sync blocked');
  if (userError) console.error(userError);
  return null;
}

async function resolveAthMasterProvider() {
  const provider = globalThis.plathoAthMasterProvider
    ?? createAthMasterTonRpcProvider({ athMasterAddress: requireAthMasterAddress() });
  if (!provider?.getWalletAddress) throw new Error('ATHMaster provider is not configured');
  return provider;
}

async function refreshAthProtocolStats() {
  renderAthProfileStats();
  try {
    const provider = await resolveAthMasterProvider();
    if (!provider?.getJettonData) return athProtocolState;
    const data = await provider.getJettonData({ address: requireAthMasterAddress() });
    athProtocolState = {
      total_supply: nonNegativeBigInt(data?.total_supply, ATH_TOTAL_SUPPLY_ATOMIC),
    };
    renderAthProfileStats();
    return athProtocolState;
  } catch {
    return athProtocolState;
  }
}

async function resolveUsernameRegistryProvider() {
  const provider = globalThis.plathoUsernameRegistryProvider
    ?? createUsernameRegistryTonRpcProvider({ usernameRegistryAddress: requireUsernameRegistryAddress() });
  if (!provider?.getUsernamePrice || !provider?.getRefundDue) {
    throw new Error('UsernameRegistry provider is not configured');
  }
  return provider;
}

async function resolveTonDnsProvider() {
  const providerConfig = appConfig.tonDns?.provider ?? {};
  if (providerConfig.globalName && globalThis[providerConfig.globalName]) {
    return globalThis[providerConfig.globalName];
  }
  if (providerConfig.moduleUrl) {
    if (!tonDnsProviderLoadPromise) {
      const moduleUrl = new URL(providerConfig.moduleUrl, window.location.href).href;
      tonDnsProviderLoadPromise = import(moduleUrl).then((module) => {
        const exportName = providerConfig.exportName ?? 'default';
        return module[exportName] ?? module.default ?? module.provider;
      });
    }
    return tonDnsProviderLoadPromise;
  }
  return createTonDnsProvider({
    rootAddress: appConfig.tonDns?.rootAddress ?? null,
  });
}

async function loadConnectedAthWalletAddress() {
  const owner = requirePlathoWalletAddress();
  requireBasechainAddress(owner, 'Connected wallet');
  requireBasechainAddress(requireAthMasterAddress(), 'ATHMaster');
  const provider = await resolveAthMasterProvider();
  const walletAddress = await provider.getWalletAddress(owner, {
    address: requireAthMasterAddress(),
  });
  return requireBasechainAddress(walletAddress, 'Connected ATH wallet');
}

async function resolveRecipientWalletForThread(thread) {
  const variants = threadIdentityVariants(thread);
  const walletIdentity = variants.find((identity) => identity.type === 'wallet_address');
  if (walletIdentity) return requireBasechainAddress(walletIdentity.value, 'Payment recipient');

  const plathoIdentity = variants.find((identity) => identity.type === 'platho_nft');
  if (plathoIdentity) {
    const provider = await resolveUsernameRegistryProvider();
    const record = await provider.getNameRecordByUsername(plathoIdentity.value, {
      address: requireUsernameRegistryAddress(),
    });
    if (!record.exists) throw new Error(`${plathoIdentity.value} is not registered`);
    return requireBasechainAddress(record.owner_wallet, 'Payment recipient');
  }

  const tonDnsIdentity = variants.find((identity) => identity.type === 'ton_dns');
  if (tonDnsIdentity) {
    const provider = await resolveTonDnsProvider();
    if (!provider?.resolveWallet) throw new Error('TON DNS provider is not configured');
    const walletAddress = await provider.resolveWallet(tonDnsIdentity.value, {
      rootAddress: appConfig.tonDns?.rootAddress ?? null,
    });
    return requireBasechainAddress(walletAddress, 'Payment recipient');
  }

  throw new Error('Recipient wallet route is not available');
}

async function resolveRecipientPeerEntry(thread) {
  const walletAddress = await resolveRecipientWalletForThread(thread);
  const provider = await resolveVaultChainProvider();
  if (!provider?.getUser || !provider?.getKeyRecord) {
    throw new Error('Vault provider cannot resolve recipient key record');
  }
  const user = await provider.getUser(walletAddress, { vaultAddress: requireVaultAddress() });
  const currentKeyId = BigInt(user.current_key_id ?? 0n);
  if (user.exists !== true || currentKeyId === 0n) {
    throw new Error('Recipient is not activated in Platho');
  }
  const keyRecord = await provider.getKeyRecord(currentKeyId, {
    ownerWallet: walletAddress,
    vaultAddress: requireVaultAddress(),
  });
  const publicBundle = await publicKeyBundleFromVaultKeyRecord(keyRecord, { ownerWallet: walletAddress });
  return {
    walletAddress,
    user,
    keyRecord,
    currentKeyId,
    publicBundle,
  };
}

async function submitVaultMessage(type, params, options = {}) {
  const message = createVaultWalletMessage(type, params, {
    vaultAddress: requireVaultAddress(),
    ...options,
  });
  const transaction = createWalletTransaction(message);
  const result = await sendPlathoWalletTransaction(requirePlathoWallet(), transaction);
  globalThis.plathoLastVaultTransaction = { type, params, message, transaction, result };
  return result;
}

async function submitAthWalletMessage(type, params, options = {}) {
  requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  const athWalletAddress = options.athWalletAddress ?? await loadConnectedAthWalletAddress();
  const message = createAthWalletMessage(type, params, {
    athWalletAddress,
    ...options,
  });
  const transaction = createWalletTransaction(message);
  const result = await sendPlathoWalletTransaction(requirePlathoWallet(), transaction);
  globalThis.plathoLastAthWalletTransaction = { type, params, message, transaction, result };
  return result;
}

async function submitUsernameRegistryMessage(type, params, options = {}) {
  requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  const usernameRegistryAddress = requireBasechainAddress(
    options.usernameRegistryAddress ?? requireUsernameRegistryAddress(),
    'UsernameRegistry',
  );
  const message = createUsernameRegistryWalletMessage(type, params, {
    usernameRegistryAddress,
    ...options,
  });
  const transaction = createWalletTransaction(message);
  const result = await sendPlathoWalletTransaction(requirePlathoWallet(), transaction);
  globalThis.plathoLastUsernameRegistryTransaction = { type, params, message, transaction, result };
  return result;
}

async function submitVaultDepositTon() {
  const amount = await requestTonAmountNanotons('Move TON to Vault', 'Moves TON from your connected Platho wallet into the Vault pocket.');
  if (amount === null) return null;
  return submitVaultDepositTonAmount(amount);
}

async function submitVaultDepositTonAmount(amount) {
  const user = await loadConnectedVaultUser();
  setVaultStatus('moving TON to Vault');
  const result = await submitVaultMessage('DepositTon', { amount }, {
    userExists: user.exists === true,
  });
  setVaultStatus('move submitted');
  return result;
}

async function submitVaultWithdrawTon() {
  const amount = await requestTonAmountNanotons('Move TON from Vault', 'Moves TON from the Vault pocket back to your connected Platho wallet.');
  if (amount === null) return null;
  return submitVaultWithdrawTonAmount(amount);
}

async function submitVaultWithdrawTonAmount(amount) {
  setVaultStatus('moving TON from Vault');
  const result = await submitVaultMessage('WithdrawTon', {
    amount,
    recipient: requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet'),
  });
  setVaultStatus('move submitted');
  return result;
}

async function submitVaultDepositAth() {
  const amount = await requestAthAmountAtomic('Move ATH to Vault', 'Moves ATH from your connected Platho wallet into the Vault pocket.');
  if (amount === null) return null;
  return submitVaultDepositAthAmount(amount);
}

async function submitVaultDepositAthAmount(amount) {
  const owner = requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  const vault = requireBasechainAddress(requireVaultAddress(), 'Vault');
  setVaultStatus('moving ATH to Vault');
  const result = await submitAthWalletMessage('ATHTransferRequestWithNotify', {
    query_id: nextQueryId(),
    amount,
    recipient: vault,
    response_destination: owner,
    notify_destination: vault,
    notify_value: 30_000_000n,
  });
  setVaultStatus('move submitted');
  return result;
}

async function submitVaultWithdrawAth() {
  const amount = await requestAthAmountAtomic('Move ATH from Vault', 'Moves ATH from the Vault pocket back to your connected Platho wallet.');
  if (amount === null) return null;
  return submitVaultWithdrawAthAmount(amount);
}

async function submitVaultWithdrawAthAmount(amount) {
  setVaultStatus('moving ATH from Vault');
  const result = await submitVaultMessage('WithdrawAth', {
    query_id: nextQueryId(),
    amount,
    recipient: requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet'),
  });
  setVaultStatus('move submitted');
  return result;
}

async function submitUsernameMint() {
  const username = await requestUsernameMintName();
  if (!username) return null;
  const owner = requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  const registry = requireBasechainAddress(requireUsernameRegistryAddress(), 'UsernameRegistry');
  const provider = await resolveUsernameRegistryProvider();
  const price = await provider.getUsernamePrice(username.length, {
    address: registry,
  });
  setText(identitySubtitle, 'username signing');
  const result = await submitAthWalletMessage('ATHTransferRequestMintUsername', {
    query_id: nextQueryId(),
    amount: price,
    recipient: registry,
    response_destination: owner,
    notify_value: 30_000_000n,
    username,
  });
  setText(identitySubtitle, `${username}.ath mint submitted`);
  return result;
}

async function submitUsernameRefundFlush() {
  const owner = requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  const provider = await resolveUsernameRegistryProvider();
  const refundDue = await provider.getRefundDue(owner, {
    address: requireUsernameRegistryAddress(),
  });
  if (BigInt(refundDue ?? 0n) <= 0n) {
    setText(identitySubtitle, 'no username refund');
    return null;
  }
  setText(identitySubtitle, 'refund signing');
  const result = await submitUsernameRegistryMessage('FlushAthRefundDue', {
    query_id: nextQueryId(),
    owner_wallet: owner,
  });
  setText(identitySubtitle, 'refund submitted');
  return result;
}

async function submitAthWalletBurn() {
  const amount = await requestAthAmountAtomic('Burn ATH', 'Burns ATH from your external ATH wallet.');
  if (amount === null) return null;
  const owner = requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  setText(identitySubtitle, 'ATH burn signing');
  const result = await submitAthWalletMessage('ATHBurn', {
    query_id: nextQueryId(),
    amount,
    response_destination: owner,
  });
  setText(identitySubtitle, 'ATH burn submitted');
  return result;
}

async function submitProfileAvatarUpdate(file, modeId = DEFAULT_IMAGE_COMPRESSION_MODE_ID) {
  const owner = requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  const registry = requireBasechainAddress(requireProfileRegistryAddress(), 'ProfileRegistry');
  if (!file) return null;
  setText(identitySubtitle, 'avatar version checking');
  const currentPointer = await readCurrentProfileAvatarPointerFromChain(owner, { required: true });
  setText(identitySubtitle, 'avatar compressing');
  const avatar = await compressImageFile(file, modeId);
  const parts = imagePartsForSend(avatar, 'profile avatar');
  if (parts.length <= 0) throw new Error('Avatar image is empty');
  if (parts.length > 16) throw new Error('Avatar must fit 16 public capsules');

  const streamId = randomBytes(16);
  const avatarHash = await sha256Hex(avatar.bytes);
  const nextVersion = (currentPointer?.profileVersion ?? 0) + 1;
  const payloads = [];
  for (let index = 0; index < parts.length; index += 1) {
    payloads.push(await createPublicPostPayload({
      type: 'avatar',
      bytes: parts[index],
      mediaFormat: PUBLIC_BODY_MEDIA_FORMATS.WEBP,
      streamId,
      partIndex: index,
      partCount: parts.length,
      profileVersion: nextVersion,
      avatarHash,
    }, { maxBytes: SINGLE_CAPSULE_USEFUL_BYTES }));
  }

  setText(identitySubtitle, 'avatar publishing');
  const publishResult = await publishPublicPayloadParts(payloads, `profile-avatar-${Date.now()}`);
  if (publishResult?.status !== 'vault-publish-sent') {
    setText(identitySubtitle, 'avatar publish blocked');
    return publishResult;
  }

  writeProfileAvatarMediaCache(avatarHash, bytesToImageDataUrl(avatar.bytes, 'image/webp'));
  setText(identitySubtitle, 'avatar confirming');
  const confirmed = await waitForPublishedAvatarEntries(owner, {
    profileVersion: nextVersion,
    avatarHash,
    avatarStreamId: `0x${bytesToHex(streamId)}`,
    avatarPartCount: parts.length,
  });

  setText(identitySubtitle, 'avatar ATH signing');
  const result = await submitAthWalletMessage('ATHTransferRequestProfileAvatar', {
    query_id: nextQueryId(),
    amount: PROFILE_AVATAR_PRICE_ATH,
    recipient: registry,
    response_destination: owner,
    notify_value: PROFILE_AVATAR_NOTIFY_VALUE_NANOTONS,
    avatar_hash: uint256HexToBigInt(avatarHash, 'avatar_hash'),
    avatar_entry_id: confirmed.firstEntryId,
    avatar_stream_id: bytesToBigIntValue(streamId),
    avatar_part_count: BigInt(parts.length),
    media_format: PUBLIC_BODY_MEDIA_FORMATS.WEBP,
  });
  let registryPointer = null;
  try {
    setText(identitySubtitle, 'avatar registry confirming');
    registryPointer = await waitForProfileAvatarRegistryUpdate(owner, avatarHash);
    writeStoredProfileAvatarPointer(registryPointer, owner);
    setAvatarNode(profileAvatar, 'P', confirmed.imageUrl);
    setText(identitySubtitle, `avatar active (${formatAthAtomic(PROFILE_AVATAR_PRICE_ATH)} ATH)`);
  } catch (error) {
    console.error(error);
    setText(identitySubtitle, 'avatar submitted; sync pending');
  }
  globalThis.plathoLastProfileAvatarUpdate = { avatarHash, streamId: `0x${bytesToHex(streamId)}`, parts: parts.length, firstEntryId: confirmed.firstEntryId.toString(), payloads, publishResult, result, registryPointer };
  return result;
}

async function submitCreatePaymentCheck() {
  const thread = activeThread();
  if (!thread || thread.readOnly) throw new Error('Payment checks are only available in private chats');
  if (!localIdentity) throw new Error('Local encryption identity is not ready');
  const recipientEntry = await resolveRecipientPeerEntry(thread);
  const recipientWallet = recipientEntry.walletAddress;

  const paymentDetails = await requestPaymentCheckDetails();
  if (!paymentDetails) return null;
  const { asset, amount } = paymentDetails;

  const user = await loadConnectedVaultUser();
  if (user.exists !== true) throw new Error('Vault account is not initialized');
  const available = asset === RECEIVE_ASSETS.TON
    ? BigInt(user.ton_balance ?? 0n)
    : BigInt(user.ath_balance ?? 0n);
  if (available < amount) throw new Error(`Not enough ${paymentAssetLabel(asset)} in Vault`);

  const provider = await resolveVaultChainProvider();
  if (!provider?.getReceiveIntentId || !provider?.getReceiveIntentCommitment) {
    throw new Error('Vault provider cannot create payment checks');
  }

  const senderWallet = requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  const clientNonce = nextQueryId();
  const secret32Bytes = randomBytes(32);
  const secret32 = bytesToBigIntValue(secret32Bytes);
  const intentId = await provider.getReceiveIntentId(
    senderWallet,
    recipientWallet,
    asset,
    amount,
    clientNonce,
    { vaultAddress: requireVaultAddress() },
  );
  const commitment = await provider.getReceiveIntentCommitment(
    intentId,
    recipientWallet,
    secret32,
    { vaultAddress: requireVaultAddress() },
  );
  setText(identitySubtitle, 'check signing');
  const createResult = await submitVaultMessage('CreateReceiveIntent', {
    asset,
    amount,
    recipient_wallet: recipientWallet,
    commitment,
    client_nonce: clientNonce,
  });

  const payment = normalizePaymentForMessage({
    asset,
    amount,
    intentId,
    secret32Bytes,
  });
  const payloadBytes = encodeCompactPayload({
    type: 'payment',
    asset: Number(asset),
    amount,
    intentId: bigIntToFixedBytes(intentId, 32, 'intent id'),
    secret32: secret32Bytes,
  });
  const capsule = await createEncryptedPrivateCapsuleFromPublicBundle('', recipientEntry.publicBundle, localIdentity, {
    payloadBytes,
    threadId: activeThreadId,
    ...currentProfilePointerFields(),
  });

  const message = {
    type: 'out',
    text: paymentMessageText(payment),
    meta: 'check created',
    payment,
    capsule,
    vaultCreateIntent: createResult,
  };

  try {
    const publishResult = await publishCapsuleThroughVault(capsule);
    message.vaultPublish = publishResult;
    message.meta = publishResult.status === 'vault-publish-sent'
      ? 'check published'
      : 'publish ready';
  } catch (error) {
    message.meta = 'check publish unavailable';
    refreshMessagingControls();
    console.error(error);
  }

  thread.messages.push(message);
  thread.preview = message.text;
  thread.time = 'now';
  thread.state = 'sealed';
  await persistMessageToEncryptedHistory(thread, message);
  renderThreads();
  renderConversation();
  return { createResult, payment, capsule };
}

async function submitVaultClaimPaymentCheck(payment) {
  const user = await loadConnectedVaultUser().catch(() => ({ exists: false }));
  setText(identitySubtitle, 'claim signing');
  const result = await submitVaultMessage('ClaimReceiveIntent', {
    intent_id: paymentIntentId(payment),
    secret32: paymentSecret32(payment),
  }, {
    recipientUserExists: user.exists === true,
  });
  setText(identitySubtitle, 'С‡РµРє Р°РєС‚РёРІРёСЂРѕРІР°РЅ РІР°РјРё');
  return result;
}

async function submitVaultCancelPaymentCheck(payment) {
  setText(identitySubtitle, 'cancel signing');
  const result = await submitVaultMessage('CancelReceiveIntent', {
    intent_id: paymentIntentId(payment),
  });
  setText(identitySubtitle, 'check cancelled');
  return result;
}

async function submitVaultRegisterMessagingKeys() {
  if (!localVaultDraft?.message) throw new Error('Local messaging key draft is not ready');
  const user = await loadConnectedVaultUser();
  if (user.current_key_id && BigInt(user.current_key_id) !== 0n) {
    vaultDraftStatus.textContent = 'already registered';
    return null;
  }
  vaultDraftStatus.textContent = 'signing';
  const result = await submitVaultMessage('RegisterMessagingKeys', localVaultDraft.message, {
    userExists: user.exists === true,
  });
  vaultDraftStatus.textContent = 'register sent';
  return result;
}

async function submitVaultReplaceMessagingKeys() {
  if (!localVaultDraft?.message) throw new Error('Local messaging key draft is not ready');
  const user = await loadConnectedVaultUser();
  const currentKeyId = BigInt(user.current_key_id ?? 0n);
  if (user.exists !== true || currentKeyId === 0n) {
    setText(vaultRotateStatus, 'activate first');
    return null;
  }
  setText(vaultRotateStatus, 'signing');
  const result = await submitVaultMessage('ReplaceMessagingKeys', localVaultDraft.message, {
    userExists: true,
  });
  setText(vaultRotateStatus, 'rotate sent');
  return result;
}

async function publishCapsuleThroughVault(capsule) {
  const result = await publishCapsulesThroughVault([capsule]);
  if (result.status !== 'vault-publish-sent') return result;
  const first = result.results?.[0] ?? {};
  return {
    status: result.status,
    external: first.external,
    result: first.result,
    maxCharge: result.maxCharge,
  };
}

async function sendVaultExternalBoc(built) {
  const transport = globalThis.plathoWalletRpcTransport ?? globalThis.plathoTonRpcTransport;
  if (!transport?.sendBoc) throw new Error('TON RPC sendBoc transport is not configured');
  const result = await transport.sendBoc({ boc: built.boc, walletAddress: requireVaultAddress() });
  return { ...built, result };
}

async function readVaultPublishNonce(provider, owner) {
  if (!provider?.getUser) return null;
  const user = await provider.getUser(owner, { vaultAddress: requireVaultAddress() });
  return BigInt(user.publish_nonce ?? user.publishNonce ?? 0n);
}

async function waitForVaultPublishNonce(provider, owner, expectedNonce) {
  const deadline = Date.now() + VAULT_PUBLISH_NONCE_CONFIRM_TIMEOUT_MS;
  let lastNonce = await readVaultPublishNonce(provider, owner);
  while (lastNonce !== null && lastNonce < expectedNonce && Date.now() < deadline) {
    await delay(VAULT_PUBLISH_NONCE_POLL_MS);
    lastNonce = await readVaultPublishNonce(provider, owner);
  }
  if (lastNonce !== null && lastNonce < expectedNonce) {
    throw new Error('Vault publish was not confirmed before sending the next capsule');
  }
  return lastNonce;
}

async function publishCapsulesThroughVault(capsules) {
  const normalizedCapsules = (capsules ?? []).filter(Boolean);
  if (normalizedCapsules.length === 0) throw new Error('Capsule publish payload is missing');
  if (!normalizedCapsules.every((capsule) => capsule?.publish)) {
    throw new Error('Capsule publish payload is missing');
  }
  const provider = await resolveVaultChainProvider();
  if (!provider?.getCanonicalPublishCharge) {
    throw new Error('Vault chain provider cannot price publish');
  }
  const owner = requirePlathoWalletAddress();
  const user = await loadConnectedVaultUser();
  if (user.exists !== true || BigInt(user.current_key_id ?? 0n) === 0n) {
    throw new Error('Activate wallet before publishing');
  }
  if (!localIdentity?.signingSecretKey) {
    throw new Error('Local Platho signing key is not ready');
  }
  const surcharge = currentNetworkFeeSurchargeNanotons();
  let publishNonce = BigInt(user.publish_nonce ?? user.publishNonce ?? 0n);
  const results = [];
  let totalMaxCharge = 0n;
  for (let index = 0; index < normalizedCapsules.length; index += 1) {
    const capsule = normalizedCapsules[index];
    const publish = capsule.publish;
    const canonicalMaxCharge = await provider.getCanonicalPublishCharge(
      owner,
      BigInt(publish.publish_kind),
      BigInt(publish.size_class),
      BigInt(publish.crypto_suite),
      { vaultAddress: requireVaultAddress() },
    );
    const maxCharge = BigInt(canonicalMaxCharge) + surcharge;
    totalMaxCharge += maxCharge;
    const messageType = BigInt(publish.publish_kind) === VAULT_PUBLISH_KIND.PUBLIC
      ? 'PublishPublicFromVaultBalance'
      : 'PublishPrivateFromVaultBalance';
    const external = await buildVaultBalancePublishExternalBoc(messageType, {
      owner_wallet: owner,
      client_nonce: publishNonce,
      max_charge: maxCharge,
      publish,
      signingSecretKey: localIdentity.signingSecretKey,
      deploymentManifestHash: requireVaultDeploymentManifestHash(),
    }, {
      vaultAddress: requireVaultAddress(),
    });
    results.push({ capsuleId: capsule.id, external, maxCharge, clientNonce: publishNonce });
    publishNonce += 1n;
  }
  const balance = BigInt(user.ton_balance ?? user.tonBalance ?? 0n);
  if (balance < totalMaxCharge) {
    throw new Error('Vault TON balance is too low for this publish');
  }
  let lastResult = null;
  for (let index = 0; index < results.length; index += 1) {
    const item = results[index];
    lastResult = await sendVaultExternalBoc(item.external);
    item.result = lastResult;
    await waitForVaultPublishNonce(provider, owner, item.clientNonce + 1n);
  }
  globalThis.plathoLastVaultPublish = {
    capsules: normalizedCapsules.map((capsule) => capsule.id),
    results,
    maxCharge: totalMaxCharge,
    result: lastResult,
  };
  return { status: 'vault-publish-sent', results, maxCharge: totalMaxCharge, result: lastResult };
}

function rememberLocalPublicPost(text, bodyHash, commentsAllowed = true, attachment = null) {
  const channelId = ensurePublicChannelForAuthorWallet(plathoWallet?.address, {
    activate: publicDisplayMode === 'channels',
  });
  const profilePointer = currentProfilePointerFields();
  const cached = publicChannelFeedCache?.[channelId]?.feed ?? publicChannelFeedCache?.[channelId] ?? null;
  const feed = cached?.version === 1 && cached?.channelId === channelId
    ? { ...cached, posts: [...(cached.posts ?? [])] }
    : { version: 1, channelId, updatedAt: null, posts: [] };
  feed.posts.push({
    id: `local-${Date.now()}`,
    text,
    imageUrl: attachment?.dataUrl,
    createdAt: new Date().toISOString(),
    author: 'you',
    authorWallet: plathoWallet?.address ?? null,
    profileVersion: profilePointer.profileVersion,
    avatarHash: profilePointer.avatarHash,
    avatarImageUrl: readProfileAvatarMediaCache(profilePointer.avatarHash),
    bodyHash,
    commentsAllowed: commentsAllowed !== false,
  });
  feed.updatedAt = new Date().toISOString();
  publicChannelFeedCache = {
    ...publicChannelFeedCache,
    [channelId]: { feed, syncedAt: feed.updatedAt },
  };
  writePublicChannelFeedCache(localStorageOrNull(), publicChannelFeedCache);
  rebuildThreadsFromPublicSubscriptions({ preserveActive: true });
  renderPublicSurface({ anchorUnread: false });
  renderThreads();
  renderConversation();
}

function rememberLocalPublicComment(parent, text, bodyHash, attachment = null) {
  const channelId = parent.channelId ?? publicChannelSubscriptions?.activeChannelId ?? publicChannelRegistry[0]?.id ?? 'platho.app';
  const profilePointer = currentProfilePointerFields();
  const cached = publicChannelFeedCache?.[channelId]?.feed ?? publicChannelFeedCache?.[channelId] ?? null;
  const feed = cached?.version === 1 && cached?.channelId === channelId
    ? { ...cached, posts: [...(cached.posts ?? [])] }
    : { version: 1, channelId, updatedAt: null, posts: [] };
  const index = feed.posts.findIndex((post) => (
    String(post.entryId ?? post.id) === String(parent.entryId ?? parent.id)
    && (!parent.bodyHash || !post.bodyHash || String(post.bodyHash).toLowerCase() === String(parent.bodyHash).toLowerCase())
  ));
  if (index >= 0) {
    const post = { ...feed.posts[index], comments: [...(feed.posts[index].comments ?? [])] };
    post.comments.push({
      id: `local-comment-${Date.now()}`,
      entryId: null,
      parentEntryId: String(parent.entryId),
      parentHash: parent.bodyHash,
      text,
      imageUrl: attachment?.dataUrl,
      createdAt: new Date().toISOString(),
      author: 'you',
      authorWallet: plathoWallet?.address ?? null,
      profileVersion: profilePointer.profileVersion,
      avatarHash: profilePointer.avatarHash,
      avatarImageUrl: readProfileAvatarMediaCache(profilePointer.avatarHash),
      bodyHash,
    });
    feed.posts[index] = post;
  }
  feed.updatedAt = new Date().toISOString();
  publicChannelFeedCache = {
    ...publicChannelFeedCache,
    [channelId]: { feed, syncedAt: feed.updatedAt },
  };
  writePublicChannelFeedCache(localStorageOrNull(), publicChannelFeedCache);
  rebuildThreadsFromPublicSubscriptions({ preserveActive: true });
  renderPublicSurface({ anchorUnread: false });
}

function publicTextPartsForSend(text) {
  return splitUtf8ToParts(text, SINGLE_CAPSULE_USEFUL_BYTES);
}

function privateTextPartsForSend(text) {
  return splitUtf8ToParts(text, SINGLE_CAPSULE_USEFUL_BYTES);
}

function imagePartsForSend(attachment, label = 'image') {
  if (!attachment?.bytes?.length) return [];
  return splitBytesToParts(attachment.bytes, SINGLE_CAPSULE_USEFUL_BYTES);
}

async function createPrivateComposerCapsules(text, attachment, recipientEntry, threadId) {
  const textParts = String(text ?? '').trim().length > 0 ? privateTextPartsForSend(text) : [];
  const imageParts = imagePartsForSend(attachment, 'private images');
  const totalParts = textParts.length + imageParts.length;
  if (totalParts <= 0) return [];
  const streamId = randomBytes(16);
  const capsules = [];
  for (let index = 0; index < textParts.length; index += 1) {
    const payloadBytes = encodeCompactPayload({
      type: 'text',
      text: textParts[index],
      streamId,
      partIndex: index,
      partCount: totalParts,
    });
    capsules.push(await createEncryptedPrivateCapsuleFromPublicBundle('', recipientEntry.publicBundle, localIdentity, {
      payloadBytes,
      threadId,
      ...currentProfilePointerFields(),
    }));
  }
  for (let index = 0; index < imageParts.length; index += 1) {
    const payloadBytes = encodeCompactPayload({
      type: 'image',
      bytes: imageParts[index],
      format: PLATHO_COMPACT_IMAGE_FORMATS.WEBP,
      streamId,
      partIndex: textParts.length + index,
      partCount: totalParts,
    });
    capsules.push(await createEncryptedPrivateCapsuleFromPublicBundle('', recipientEntry.publicBundle, localIdentity, {
      payloadBytes,
      threadId,
      ...currentProfilePointerFields(),
    }));
  }
  return capsules;
}

function publicPublishDraftFromPayload(payload) {
  return {
    publish_kind: VAULT_PUBLISH_KIND.PUBLIC,
    size_class: VAULT_SIZE_CLASS.STANDARD,
    crypto_suite: VAULT_CRYPTO_SUITE.PUBLIC_NONE,
    header_0_hash: payload.headerHash,
    body_hash: payload.bodyHash,
    header_0_cell: payload.header_cell,
    body_cell: payload.body_cell,
  };
}

async function publishPublicPayloadParts(payloads, idPrefix) {
  return publishCapsulesThroughVault(payloads.map((payload, index) => ({
    id: `${idPrefix}-${index}`,
    publish: publicPublishDraftFromPayload(payload),
  })));
}

async function createPublicPayloadParts({ type, text, attachment, commentsAllowed = true, parent = null }) {
  const textParts = String(text ?? '').trim().length > 0 ? publicTextPartsForSend(text) : [];
  const imageParts = imagePartsForSend(attachment, 'public images');
  const totalParts = textParts.length + imageParts.length;
  if (totalParts <= 0) return [];
  const streamId = randomBytes(16);
  const profilePointer = currentProfilePointerFields();
  const payloads = [];
  const commentBase = type === 'comment'
    ? {
        parentEntryId: BigInt(parent.entryId),
        parentHash: parent.bodyHash,
      }
    : {};
  for (let index = 0; index < textParts.length; index += 1) {
    payloads.push(await createPublicPostPayload({
      type,
      text: textParts[index],
      commentsAllowed,
      streamId,
      partIndex: index,
      partCount: totalParts,
      ...profilePointer,
      ...commentBase,
    }, { maxBytes: SINGLE_CAPSULE_USEFUL_BYTES }));
  }
  for (let index = 0; index < imageParts.length; index += 1) {
    payloads.push(await createPublicPostPayload({
      type: type === 'comment' ? 'image_comment' : 'image',
      bytes: imageParts[index],
      mediaFormat: PUBLIC_BODY_MEDIA_FORMATS.WEBP,
      commentsAllowed,
      streamId,
      partIndex: textParts.length + index,
      partCount: totalParts,
      ...profilePointer,
      ...commentBase,
    }, { maxBytes: SINGLE_CAPSULE_USEFUL_BYTES }));
  }
  return payloads;
}

async function submitPublicPostThroughVault(draft = null) {
  const resolvedDraft = draft ?? {
    text: publicMessageInput?.value?.trim() ?? '',
    attachment: publicImageAttachment,
    commentsAllowed: publicComposerCommentsCheckbox?.checked !== false,
  };
  if (!resolvedDraft.text && !resolvedDraft.attachment) return null;
  setPublicStatus('public publish signing');
  const payloads = await createPublicPayloadParts({
    type: 'post',
    text: resolvedDraft.text,
    attachment: resolvedDraft.attachment,
    commentsAllowed: resolvedDraft.commentsAllowed,
  });
  const result = await publishPublicPayloadParts(payloads, `public-${Date.now()}`);
  if (result?.status === 'vault-publish-sent') {
    rememberLocalPublicPost(resolvedDraft.text, payloads[0]?.bodyHash, resolvedDraft.commentsAllowed, resolvedDraft.attachment);
    setPublicStatus('public publish submitted');
  } else {
    setPublicStatus('publish ready');
  }
  globalThis.plathoLastPublicPublish = { text: resolvedDraft.text, commentsAllowed: resolvedDraft.commentsAllowed, payloads, result };
  return result;
}

async function submitPublicCommentThroughVault(parent, bodyText = null) {
  if (parent?.entryId === undefined || parent?.entryId === null) throw new Error('Public comment parent is not synced from chain');
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(parent.bodyHash ?? ''))) throw new Error('Public comment parent hash is missing');
  if (parent.commentsAllowed === false) throw new Error('Comments are closed for this post');
  const text = bodyText?.trim() ?? publicMessageInput?.value?.trim() ?? '';
  const attachment = publicImageAttachment;
  if (!text && !attachment) return null;
  setPublicStatus('comment signing');
  const payloads = await createPublicPayloadParts({
    type: 'comment',
    text,
    attachment,
    parent,
  });
  const result = await publishPublicPayloadParts(payloads, `public-comment-${Date.now()}`);
  if (result?.status === 'vault-publish-sent') {
    rememberLocalPublicComment(parent, text, payloads[0]?.bodyHash, attachment);
    setPublicStatus('comment submitted');
  } else {
    setPublicStatus('publish ready');
  }
  globalThis.plathoLastPublicComment = { parent, text, payloads, result };
  return result;
}

globalThis.plathoVaultTransactions = {
  createVaultWalletMessage,
  createAthWalletMessage,
  createPublicPostPayload,
  createUsernameRegistryWalletMessage,
  createWalletTransaction,
  submitVaultMessage,
  submitAthWalletMessage,
  submitUsernameRegistryMessage,
  submitVaultDepositTon,
  submitVaultWithdrawTon,
  submitVaultDepositAth,
  submitVaultWithdrawAth,
  submitUsernameMint,
  submitUsernameRefundFlush,
  submitAthWalletBurn,
  submitProfileAvatarUpdate,
  submitCreatePaymentCheck,
  submitVaultClaimPaymentCheck,
  submitVaultCancelPaymentCheck,
  submitVaultRegisterMessagingKeys,
  submitVaultReplaceMessagingKeys,
  refreshVaultDashboard,
  publishCapsuleThroughVault,
  submitPublicPostThroughVault,
  submitPublicCommentThroughVault,
  syncPrivateCapsulesFromChain,
};

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

async function refreshVaultActivationStatus(options = {}) {
  if (!plathoWallet?.address || !localVaultDraft?.message) {
    setText(vaultRecordStatus, plathoWallet ? 'keys pending' : 'wallet required');
    refreshComposerPublishPolicy();
    return null;
  }
  try {
    const provider = await resolveVaultChainProvider(options.provider);
    if (!provider?.getUser || !provider?.getKeyRecord) throw new VaultChainProviderUnavailableError('Vault provider unavailable');
    const [user, global] = await Promise.all([
      provider.getUser(plathoWallet.address, { vaultAddress: appConfig.vault?.address ?? null }),
      provider.getGlobal
        ? provider.getGlobal({ vaultAddress: appConfig.vault?.address ?? null }).catch(() => null)
        : Promise.resolve(null),
    ]);
    vaultProtocolState = {
      airdrop_remaining_ath: global?.airdrop_remaining_ath ?? vaultProtocolState.airdrop_remaining_ath ?? null,
      airdrop_total_allocation_ath: global?.airdrop_total_allocation_ath ?? vaultProtocolState.airdrop_total_allocation_ath ?? VAULT_ACTIVITY_AIRDROP_TOTAL_ATH_ATOMIC,
    };
    renderAthProfileStats();
    if (!user?.current_key_id || BigInt(user.current_key_id) === 0n) {
      delete globalThis.plathoVaultBinding;
      setText(vaultRecordStatus, 'activation required');
      refreshComposerPublishPolicy();
      return null;
    }
    const record = await provider.getKeyRecord(user.current_key_id, { vaultAddress: appConfig.vault?.address ?? null });
    const binding = await verifyVaultKeyRecordBinding(localSignedPublicBundle, record, {
      ownerWallet: plathoWallet.address,
      currentKeyId: user.current_key_id,
      recordKeyId: user.current_key_id,
    });
    const active = binding.active === true;
    globalThis.plathoVaultBinding = active ? { walletAddress: plathoWallet.address, user, keyRecord: record } : null;
    setText(vaultRecordStatus, active ? 'activated' : 'record mismatch');
    refreshComposerPublishPolicy();
    return globalThis.plathoVaultBinding;
  } catch (error) {
    delete globalThis.plathoVaultBinding;
    setText(vaultRecordStatus, error instanceof VaultChainProviderUnavailableError
      ? appConfig.vault?.provider?.unavailableStatus ?? 'provider unavailable'
      : 'record blocked');
    refreshComposerPublishPolicy();
    console.error(error);
    return null;
  }
}

async function bootCrypto() {
  try {
    const preferredSuite = readPreferredCryptoSuite();
    updateKeySuiteUi(preferredSuite);
    plathoWallet = await loadPlathoWallet();
    refreshAthProtocolStats().catch(() => {});
    if (!plathoWallet) {
      localIdentity = null;
      localRecipientKeyPair = null;
      localSignedPublicBundle = null;
      localVaultDraft = null;
      refreshMessagingControls();
      setText(identityName, 'No wallet');
      setText(identitySubtitle, 'Create or import a wallet');
      setText(encryptionStatus, 'wallet required');
      setText(keyAuthStatus, 'wallet required');
      vaultDraftStatus.textContent = 'wallet required';
      setText(vaultRecordStatus, 'wallet required');
      setText(walletAddressStatus, 'not created');
      localProfileAvatarPointer = null;
      updateKeySuiteUi(preferredSuite);
      refreshComposerPublishPolicy();
      return null;
    }
    setText(walletAddressStatus, shortAddress(plathoWallet.address));
    setText(identityName, shortAddress(plathoWallet.address));
    setText(identitySubtitle, 'Wallet ready');
    localProfileAvatarPointer = readStoredProfileAvatarPointer(plathoWallet.address);
    localIdentity = await loadMessagingIdentityFromWallet(preferredSuite);
    localRecipientKeyPair = localIdentity?.encryptionKeyPair ?? null;
    localSignedPublicBundle = await exportSignedPublicKeyBundle(localIdentity, {
      purpose: appConfig.crypto?.signedBundlePurpose ?? 'pwa-runtime',
      ownerWallet: plathoWallet.address,
      vaultAddress: appConfig.vault?.address ?? null,
    });
    const verifiedBundle = await verifySignedPublicKeyBundle(localSignedPublicBundle);
    localVaultDraft = await createVaultMessagingKeyDraft(verifiedBundle.bundle, verifiedBundle.signingPublicKey);
    refreshMessagingControls();
    globalThis.plathoRefreshVaultActivation = async (provider) => refreshVaultActivationStatus({ provider });
    const result = await runPlathoCryptoSelfTest();
    setText(encryptionStatus, result.hybrid.aadTamperRejected ? 'hybrid passed' : 'review');
    updateKeySuiteUi(preferredSuite);
    setText(keyAuthStatus, verifiedBundle.signingPublicKey.length === 32 ? 'signed bundle' : 'review');
    vaultDraftStatus.textContent = `${localVaultDraft.json.crypto_suite_mask} / ${localVaultDraft.json.pq_kem_pubkey_len}b`;
    setText(capsulePolicyStatus, result.capsule.replayRejected ? 'replay guarded' : 'review');
    await syncPrivateCapsulesFromChain().catch((error) => {
      refreshMessagingControls();
      console.error(error);
    });
    await refreshVaultActivationStatus();
    await refreshVaultDashboard();
    await refreshAthProtocolStats();
  } catch (error) {
    setText(encryptionStatus, 'unavailable');
    keySuiteStatus.textContent = 'blocked';
    setText(keyAuthStatus, 'blocked');
    vaultDraftStatus.textContent = 'blocked';
    setText(capsulePolicyStatus, 'blocked');
    refreshMessagingControls();
    setText(walletAddressStatus, 'blocked');
    setText(vaultRecordStatus, 'blocked');
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

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  refreshInstallButtons();
  openInstallDialogIfUseful();
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  markInstallPromptDismissed();
  closeInstallDialog({ dismissed: false });
  refreshInstallButtons();
});
window.matchMedia?.('(display-mode: standalone)')?.addEventListener?.('change', refreshInstallButtons);
refreshInstallButtons();

customPublicChannels = readCustomPublicChannels();
rebuildPublicChannelRegistry();
publicChannelSubscriptions = readPublicChannelSubscriptions(localStorageOrNull(), publicChannelRegistry);
writePublicChannelSubscriptions(localStorageOrNull(), publicChannelSubscriptions);
publicChannelFeedCache = readPublicChannelFeedCache(localStorageOrNull());
publicReadCursors = readPublicReadCursors();
rebuildThreadsFromPublicSubscriptions({ preserveActive: false });
renderConfiguredShell();
renderDocsNav();
renderAthProfileStats();
updatePublicSyncWindowUi();
updatePublicCommentsDefaultUi();
setPublicCommentTarget(null);
rebuildThreadsFromPublicSubscriptions({ preserveActive: false });
if (activeThreadId) {
  appShell.dataset.chatOpen = 'true';
} else if (publicChannelThreads.length > 0) {
  appShell.dataset.chatOpen = 'false';
  setView('public');
} else {
  appShell.dataset.chatOpen = 'false';
}
renderThreads();
renderConversation();
refreshMessagingControls();
syncPublicChannels();
bootReplayStore();
bootEncryptedMessageHistory();
bootCrypto();
