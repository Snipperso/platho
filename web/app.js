import {
  CRYPTO_SUITES,
  createEncryptedPrivateCapsuleFromPublicBundle,
  createVaultMessagingKeyDraft,
  encodeCompactPayload,
  exportSignedPublicKeyBundle,
  openPrivateCapsuleChainEntry,
  PLATHO_COMPACT_SENDER_WALLET_METADATA_BYTES,
  PLATHO_COMPACT_IMAGE_FORMATS,
  parseTonAddress,
  publicKeyBundleFromVaultKeyRecord,
  randomBytes,
  runPlathoCryptoSelfTest,
  verifyVaultKeyRecordBinding,
  verifySignedPublicKeyBundle,
} from './crypto/platho-crypto.mjs?v=5';
import {
  PLATHO_WALLET_NETWORK_GLOBAL_IDS,
  createPlathoWallet,
  deriveMessagingIdentityFromWallet,
  exportPlathoWalletRecoveryPhrase,
  formatTonUserFriendlyAddress,
  importPlathoWallet,
  sendPlathoWalletTransaction,
} from './platho-wallet.mjs?v=8';
import { createIndexedDbReplayStore, createMemoryReplayStore } from './replay-store.mjs?v=1';
import {
  createIndexedDbEncryptedMessageHistoryStore,
  createMemoryEncryptedMessageHistoryStore,
} from './encrypted-message-store.mjs?v=3';
import {
  VaultChainProviderUnavailableError,
} from './vault-chain-provider.mjs?v=2';
import { PLATHO_APP_CONFIG } from './platho-config.mjs?v=45';
import { createTonRpcTransport } from './vault-ton-rpc-provider.mjs?v=17';
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
} from './public-channel-subscriptions.mjs?v=6';
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
} from './recipient-identities.mjs?v=4';
import {
  MAX_CAPSULE_USEFUL_BYTES,
  SINGLE_CAPSULE_USEFUL_BYTES,
  splitBytesToCapsuleParts,
  messagePartCount,
  splitBytesToParts,
  splitUtf8ToCapsuleParts,
  splitUtf8ToParts,
} from './capsule-part-policy.mjs?v=3';
import {
  INCLUDED_NETWORK_FEE_NANOTONS,
  MESSAGE_PRICE_SUITES,
  maxNetworkFeeSurchargeNanotons,
  networkFeeSurchargeExceedsMax,
  requiresHighNetworkFeeSurchargeConfirmation,
  requiresManualNetworkFeeSurchargeOverride,
  networkFeeSurchargeNanotons,
  rawNetworkFeeSurchargeNanotons,
  resolveNetworkFeeEstimateNanotons,
} from './message-pricing-policy.mjs?v=10';
import {
  createAthWalletMessage,
  createPublicPostPayload,
  createWalletTransaction,
  buildVaultBalancePublishExternalBoc,
  buildVaultProfileAvatarExternalBoc,
  buildVaultUsernameMintExternalBoc,
  createVaultWalletMessage,
  createUsernameRegistryWalletMessage,
  estimateVaultAttachedValueNanotons,
  PROFILE_AVATAR_PRICE_ATH,
  PROFILE_AVATAR_VAULT_TON_CHARGE_NANOTONS,
  PUBLIC_BODY_MEDIA_FORMATS,
  PUBLIC_COMMENT_TEXT_MAX_BYTES,
  PUBLIC_POST_TEXT_MAX_BYTES,
  readPublicPostPayload,
  RECEIVE_ASSETS,
  USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS,
  VAULT_CRYPTO_SUITE,
  VAULT_PUBLISH_KIND,
  VAULT_SIZE_CLASS,
} from './pwa-contract-transactions.mjs?v=15';
import { createAthMasterTonRpcProvider, createAthWalletTonRpcProvider } from './ath-ton-rpc-provider.mjs?v=9';
import {
  createCapsuleHubTonRpcProvider,
  isCapsuleHubBodyHistoryUnavailable,
} from './capsulehub-ton-rpc-provider.mjs?v=16';
import { createProfileRegistryTonRpcProvider } from './profile-registry-ton-rpc-provider.mjs?v=12';
import { createTonDnsProvider } from './ton-dns-provider.mjs?v=8';
import {
  createUsernameNftItemTonRpcProvider,
  createUsernameRegistryTonRpcProvider,
  resolveAuthoritativeUsernameItemOwnership,
} from './username-ton-rpc-provider.mjs?v=14';
import {
  encodeCanvasToWebp,
  isWebpBytes,
} from './webp-encoder.mjs?v=1';
import { createQrSvgDataUrl } from './qr-code.mjs?v=1';

const appConfig = PLATHO_APP_CONFIG;

function installConfiguredTonRuntime(config = appConfig) {
  const rpc = config?.network?.tonRpc ?? {};
  const primaryRpcProvider = Array.isArray(rpc.providers)
    ? rpc.providers.find((provider) => provider?.id === rpc.primaryProviderId) ?? rpc.providers.find((provider) => provider?.runGetMethodEndpoint || provider?.endpoint)
    : rpc;
  const runGetMethodEndpoint = primaryRpcProvider?.runGetMethodEndpoint ?? primaryRpcProvider?.endpoint ?? rpc.runGetMethodEndpoint ?? rpc.endpoint ?? null;
  const sendBocEndpoint = primaryRpcProvider?.sendBocEndpoint ?? rpc.sendBocEndpoint ?? null;
  const apiKey = rpc.apiKey ?? null;

  if (runGetMethodEndpoint && !globalThis.plathoTonRpcEndpoint) {
    globalThis.plathoTonRpcEndpoint = runGetMethodEndpoint;
  }
  if (sendBocEndpoint && !globalThis.plathoTonSendBocEndpoint) {
    globalThis.plathoTonSendBocEndpoint = sendBocEndpoint;
  }
  if (apiKey && !globalThis.plathoTonRpcApiKey) {
    globalThis.plathoTonRpcApiKey = apiKey;
  }
  if (!globalThis.plathoTonRpcTransport && typeof globalThis.fetch === 'function') {
    const transport = createTonRpcTransport(rpc);
    if (transport) globalThis.plathoTonRpcTransport = transport;
  }

  if (config?.vault?.address && !globalThis.plathoVaultAddress) {
    globalThis.plathoVaultAddress = config.vault.address;
  }
  if (config?.capsuleHub?.address && !globalThis.plathoCapsuleHubAddress) {
    globalThis.plathoCapsuleHubAddress = config.capsuleHub.address;
  }
  if (config?.ath?.masterAddress && !globalThis.plathoAthMasterAddress) {
    globalThis.plathoAthMasterAddress = config.ath.masterAddress;
  }
  if (config?.usernameRegistry?.address && !globalThis.plathoUsernameRegistryAddress) {
    globalThis.plathoUsernameRegistryAddress = config.usernameRegistry.address;
  }
  if (config?.profileRegistry?.address && !globalThis.plathoProfileRegistryAddress) {
    globalThis.plathoProfileRegistryAddress = config.profileRegistry.address;
  }
}

installConfiguredTonRuntime(appConfig);

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
const installSteps = document.querySelector('#installSteps');
const installTitle = document.querySelector('#installTitle');
const installLead = document.querySelector('#installLead');
const installBody = document.querySelector('#installBody');
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
const imageLightboxDialog = document.querySelector('#imageLightboxDialog');
const imageLightboxImage = document.querySelector('#imageLightboxImage');
const imageLightboxMeta = document.querySelector('#imageLightboxMeta');
const imageLightboxCloseButton = document.querySelector('#imageLightboxCloseButton');
const imageLightboxDownloadButton = document.querySelector('#imageLightboxDownloadButton');
const composer = document.querySelector('#composer');
const messageInput = document.querySelector('#messageInput');
const sendButton = document.querySelector('.send-button');
const privateComposerCostStatus = document.querySelector('#privateComposerCostStatus');
const privateComposerAddButton = document.querySelector('#privateComposerAddButton');
const privateComposerAddMenu = document.querySelector('#privateComposerAddMenu');
const privateAnonymousButton = document.querySelector('#privateAnonymousButton');
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
const keyAuthStatus = document.querySelector('#keyAuthStatus');
const vaultDraftStatus = document.querySelector('#vaultDraftStatus');
const capsulePolicyStatus = document.querySelector('#capsulePolicyStatus');
const walletAddressStatus = document.querySelector('#walletAddressStatus');
const copyWalletAddressButton = document.querySelector('#copyWalletAddressButton');
const walletDisplayModeSelect = document.querySelector('#walletDisplayModeSelect');
const walletDisplayModeStatus = document.querySelector('#walletDisplayModeStatus');
const privateSenderModeSelect = document.querySelector('#privateSenderModeSelect');
const createWalletButton = document.querySelector('#createWalletButton');
const createWalletStatus = document.querySelector('#createWalletStatus');
const importWalletButton = document.querySelector('#importWalletButton');
const importWalletStatus = document.querySelector('#importWalletStatus');
const unlockWalletButton = document.querySelector('#unlockWalletButton');
const unlockWalletStatus = document.querySelector('#unlockWalletStatus');
const changeWalletPasswordButton = document.querySelector('#changeWalletPasswordButton');
const changeWalletPasswordStatus = document.querySelector('#changeWalletPasswordStatus');
const receiveWalletTonButton = document.querySelector('#receiveWalletTonButton');
const receiveWalletTonStatus = document.querySelector('#receiveWalletTonStatus');
const sendWalletTonButton = document.querySelector('#sendWalletTonButton');
const sendWalletTonStatus = document.querySelector('#sendWalletTonStatus');
const walletTonBalanceButton = document.querySelector('#walletTonBalanceButton');
const walletTonBalanceStatus = document.querySelector('#walletTonBalanceStatus');
const exportWalletKeyButton = document.querySelector('#exportWalletKeyButton');
const exportWalletKeyStatus = document.querySelector('#exportWalletKeyStatus');
const importWalletKeyButton = document.querySelector('#importWalletKeyButton');
const importWalletKeyStatus = document.querySelector('#importWalletKeyStatus');
const walletKeyBackupInput = document.querySelector('#walletKeyBackupInput');
const exportWalletSeedButton = document.querySelector('#exportWalletSeedButton');
const clearLocalDataButton = document.querySelector('#clearLocalDataButton');
const clearLocalDataStatus = document.querySelector('#clearLocalDataStatus');
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
const linkUsernameButton = document.querySelector('#linkUsernameButton');
const linkedUsernameStatus = document.querySelector('#linkedUsernameStatus');
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
const navVaultTonBalances = [...document.querySelectorAll('[data-nav-vault-ton]')];
const navVaultAthBalances = [...document.querySelectorAll('[data-nav-vault-ath]')];
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
const knownVaultKeyOwnerBySignPubkey = new Map();
const knownVaultKeyRecordByWallet = new Map();
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
let pendingProfileAvatarModeId = 'good';
let localProfileAvatarPointer = null;
let profileAvatarLoadPromises = new Map();
let vaultMoveDirections = { TON: 'to-vault', ATH: 'to-vault' };
let deferredInstallPrompt = null;
let installedRelatedPwaDetected = false;
let walletIdentityFlashTimer = null;
let profileAvatarPickerSuppressedUntil = 0;
let imageLightboxPreviousFocus = null;
let walletUnlockPromise = null;
let walletAutoLockTimer = null;
let walletUnlockPromptPending = false;
let walletUnlockPromptTimer = null;
let lastWalletUnlockAt = 0;
let vaultAutoRefreshTimer = null;
let vaultRefreshPromise = null;
let privateChainSyncPromise = null;
let messageAutoSyncTimer = null;
let messageAutoSyncAt = 0;
let messageAutoSyncCountdownTimer = null;
let messageAutoSyncPhase = 'idle';
let messageAutoSyncLastResult = null;
let messageAutoSyncLastErrorLabel = null;
let messageAutoSyncLoadingFrame = 0;
let tonRpcLimitedUntil = 0;
let tonRpcLimitedTimer = null;
let pendingServiceWorkerAppShellReload = false;
let privateSendRetrySeq = 0;
const privateSendRetryJobs = new Map();
let privatePublishConfirmSeq = 0;
const privatePublishConfirmJobs = new Map();
const tonWalletBalanceCache = new Map();
const tonWalletBalanceInFlight = new Map();
const VAULT_RECEIVE_CRYPTO_SUITE = CRYPTO_SUITES.HYBRID_V1;
const PLATHO_WALLET_STORAGE_KEY = 'platho.wallet.encrypted.v1';
const PLATHO_WALLET_STORAGE_KIND = 'platho.wallet.encrypted.mnemonic.v1';
const PLATHO_WALLET_LEGACY_STORAGE_KEY = 'platho.wallet.recovery.v1';
const PLATHO_WALLET_LEGACY_STORAGE_KIND = 'platho.wallet.mnemonic.v1';
const PLATHO_WALLET_ENCRYPTED_PAYLOAD_KIND = 'platho.wallet.mnemonic.payload.v1';
const PLATHO_WALLET_KEY_BACKUP_KIND = 'platho.wallet.key.backup.v1';
const PLATHO_STORAGE_PERSISTENCE_KEY = 'platho.storage.persistence.v1';
const PLATHO_WALLET_PASSWORD_MANAGER_USERNAME = 'platho-local-wallet';
const PLATHO_WALLET_KDF_NAME = 'PBKDF2-SHA256';
const PLATHO_WALLET_CIPHER_NAME = 'AES-GCM-256';
const PLATHO_WALLET_KDF_ITERATIONS = 350_000;
const PLATHO_WALLET_PASSWORD_MIN_LENGTH = 10;
const PLATHO_WALLET_PASSWORD_RECOMMENDED_LENGTH = 20;
const WALLET_AUTO_LOCK_MS = 10 * 60 * 1000;
const VAULT_AUTO_REFRESH_MS = 60 * 1000;
const VAULT_NAV_BACKGROUND_REFRESH_MS = 180 * 1000;
const VAULT_POST_TRANSACTION_REFRESH_DELAYS_MS = [5_000, 15_000, 45_000];
const MESSAGE_AUTO_SYNC_MS = 60 * 1000;
const TON_WALLET_BALANCE_CACHE_MS = 20 * 1000;
const TON_RPC_CONNECTING_STATUS = 'Connecting...';
const TON_RPC_LIMIT_FALLBACK_BACKOFF_MS = 60 * 1000;
const TON_RPC_LIMIT_MIN_BACKOFF_MS = 5 * 1000;
const MESSAGE_SYNC_COUNTDOWN_TICK_MS = 1_000;
const PRIVATE_SEND_RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];
const PRIVATE_SEND_RETRY_MAX_ATTEMPTS = 8;
const PRIVATE_PUBLISH_CONFIRM_RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];
const PRIVATE_CHAIN_SCAN_STORAGE_PREFIX = 'platho.private.chain.scan.v1';
const PRIVATE_CHAIN_HISTORY_UNAVAILABLE_STORAGE_PREFIX = 'platho.private.chain.history.unavailable.v1';
const PRIVATE_CHAIN_HISTORY_UNAVAILABLE_LIMIT = 200;
const PUBLIC_CHAIN_HISTORY_UNAVAILABLE_STORAGE_PREFIX = 'platho.public.chain.history.unavailable.v1';
const PUBLIC_CHAIN_HISTORY_UNAVAILABLE_LIMIT = 400;
const PRIVATE_CHAIN_RESCAN_OVERLAP = 25;
const PUBLIC_CHAIN_READ_LIMIT = 128;
const PRIVATE_CHAIN_READ_LIMIT = 50;
const PUBLIC_SYNC_WINDOW_STORAGE_KEY = 'platho.publicSyncWindow.v1';
const PUBLIC_COMMENTS_DEFAULT_STORAGE_KEY = 'platho.publicCommentsDefault.v2';
const PUBLIC_CUSTOM_CHANNELS_STORAGE_KEY = 'platho.publicCustomChannels.v1';
const PUBLIC_READ_CURSORS_STORAGE_KEY = 'platho.publicReadCursors.v1';
const INSTALL_PROMPT_DISMISSED_STORAGE_KEY = 'platho.installPrompt.dismissed.v1';
const WALLET_DISPLAY_IDENTITY_STORAGE_PREFIX = 'platho.wallet.displayIdentity.v1';
const LINKED_PLATHO_USERNAME_STORAGE_PREFIX = 'platho.wallet.linkedPlathoUsername.v1';
const PRIVATE_SENDER_MODE_STORAGE_PREFIX = 'platho.privateSenderMode.v1';
const PROFILE_AVATAR_POINTER_STORAGE_PREFIX = 'platho.profile.avatar.v1';
const PROFILE_AVATAR_MEDIA_CACHE_PREFIX = 'platho.profile.avatar.media.v1';
const PROFILE_AVATAR_ENTRY_SCAN_PADDING = 96;
const PROFILE_AVATAR_FALLBACK_SCAN_LIMIT = 400;
const PROFILE_AVATAR_PUBLISH_CONFIRM_ATTEMPTS = 20;
const PROFILE_AVATAR_PUBLISH_CONFIRM_DELAY_MS = 1500;
const USERNAME_MINT_CONFIRM_ATTEMPTS = 20;
const USERNAME_MINT_CONFIRM_DELAY_MS = 1500;
const ATH_FULL_DISCOUNT_AMOUNT_ATOMIC = 10_000_000_000_000n;
const ATH_TOTAL_SUPPLY_ATOMIC = 100_000_000_000_000_000n;
const VAULT_ACTIVITY_AIRDROP_TOTAL_ATH_ATOMIC = 15_000_000_000_000_000n;
const VAULT_ACTIVITY_AIRDROP_DISCOUNT_UNLOCK_REMAINING_ATH_ATOMIC = 0n;
const VAULT_PUBLISH_PUBLIC_LOCAL_EXEC_RESERVE_NANOTONS = 8_700_000n;
const VAULT_PUBLISH_PRIVATE_HYBRID_LOCAL_EXEC_RESERVE_NANOTONS = Object.freeze({
  1: 12_000_000n,
  2: 13_800_000n,
  4: 17_300_000n,
  8: 24_400_000n,
  16: 38_900_000n,
  32: 67_600_000n,
});
const VAULT_PUBLISH_NONCE_CONFIRM_TIMEOUT_MS = 90_000;
const VAULT_PUBLISH_NONCE_POLL_MS = 1_500;
const PLATO_PRIVATE_LONG_TERM_FEE_NANOTONS = 10_000_000n;
const PLATO_PUBLIC_POST_FEE_NANOTONS = 10_000_000n;
const PLATO_MIN_PROTOCOL_FEE_NANOTONS = 0n;
const CAPSULEHUB_ACK_FORWARD_RESERVE_NANOTONS = 30_000_000n;
const VAULT_PENDING_PUBLISH_REFUND_EXEC_RESERVE_NANOTONS = 4_200_000n;
const CAPSULEHUB_PRIVATE_HYBRID_EXEC_RESERVE_NANOTONS = Object.freeze({
  1: 4_200_000n,
  2: 4_300_000n,
  4: 4_500_000n,
  8: 5_000_000n,
  16: 5_800_000n,
  32: 7_600_000n,
});
const CAPSULEHUB_PRIVATE_STORAGE_CHARGE_NANOTONS = 1_000_000n + 3_300_000n + CAPSULEHUB_ACK_FORWARD_RESERVE_NANOTONS;
const CAPSULEHUB_PUBLIC_FIXED_CHARGE_NANOTONS = 2_400_000n + 1_000_000n + 7_400_000n + CAPSULEHUB_ACK_FORWARD_RESERVE_NANOTONS;
const VAULT_MOVE_WALLET_TON_GAS_KEEP_NANOTONS = 50_000_000n;
const DEFAULT_IMAGE_COMPRESSION_MODE_ID = 'good';
const IMAGE_COMPRESSION_MODES = Object.freeze({
  low: Object.freeze({ id: 'low', label: 'Low', maxBytes: 8 * 1024 }),
  medium: Object.freeze({ id: 'medium', label: 'Medium', maxBytes: 16 * 1024 }),
  good: Object.freeze({ id: 'good', label: 'Good', maxBytes: 32 * 1024 }),
  maximum: Object.freeze({ id: 'maximum', label: 'Maximum', maxBytes: 64 * 1024 }),
});
const WALLET_DISPLAY_MODES = Object.freeze({
  ADDRESS: 'address',
  PLATHO_NFT: 'platho_nft',
});
const PRIVATE_SENDER_MODES = Object.freeze({
  SHARE: 'share',
  ANONYMOUS: 'anonymous',
});
const WALLET_DISPLAY_MODE_LABELS = Object.freeze({
  [WALLET_DISPLAY_MODES.ADDRESS]: 'Address',
  [WALLET_DISPLAY_MODES.PLATHO_NFT]: 'Platho name',
});
let vaultPocketState = {
  wallet: { ton_balance: null, ath_balance: null },
  vault: { ton_balance: null, ath_balance: null },
};
let vaultProtocolState = {
  airdrop_remaining_ath: VAULT_ACTIVITY_AIRDROP_TOTAL_ATH_ATOMIC,
  airdrop_total_allocation_ath: VAULT_ACTIVITY_AIRDROP_TOTAL_ATH_ATOMIC,
  profile_registry_bound: false,
  profile_registry_address: null,
  username_registry_bound: false,
  username_registry_address: null,
};
let athProtocolState = {
  total_supply: null,
};

function localStorageOrNull() {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

function rememberLocalStoragePersistenceStatus(status) {
  try {
    localStorageOrNull()?.setItem(PLATHO_STORAGE_PERSISTENCE_KEY, String(status));
  } catch {
    // Storage persistence status is advisory; wallet writes are checked separately.
  }
}

async function requestPersistentLocalStorage() {
  const storageManager = navigator.storage;
  if (!storageManager?.persist) {
    rememberLocalStoragePersistenceStatus('unsupported');
    return 'unsupported';
  }
  try {
    const alreadyPersisted = typeof storageManager.persisted === 'function'
      ? await storageManager.persisted()
      : false;
    if (alreadyPersisted) {
      rememberLocalStoragePersistenceStatus('granted');
      return 'granted';
    }
    const granted = await storageManager.persist();
    rememberLocalStoragePersistenceStatus(granted ? 'granted' : 'denied');
    return granted ? 'granted' : 'denied';
  } catch (error) {
    console.error(error);
    rememberLocalStoragePersistenceStatus('error');
    return 'error';
  }
}

function isStandaloneApp() {
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true;
}

function isIosDevice() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1);
}

function installActionState() {
  if (isStandaloneApp()) return 'installed';
  if (installedRelatedPwaDetected) return 'open-in-app';
  if (deferredInstallPrompt) return 'prompt';
  return isIosDevice() ? 'ios-instructions' : 'instructions';
}

function setInstallSteps(steps = []) {
  if (!installSteps) return;
  installSteps.replaceChildren();
  if (!steps.length) {
    installSteps.hidden = true;
    return;
  }
  steps.forEach((text) => {
    const item = document.createElement('li');
    item.textContent = text;
    installSteps.append(item);
  });
  installSteps.hidden = false;
}

function refreshInstallButtons() {
  const state = installActionState();
  const canInstall = state !== 'installed';
  installButtons.forEach((button) => {
    button.toggleAttribute('hidden', !canInstall);
    const label = state === 'prompt'
      ? 'Install Platho'
      : state === 'open-in-app'
      ? 'Open Platho app'
      : state === 'ios-instructions'
      ? 'How to install on iPhone'
      : 'Open or install Platho';
    button.setAttribute('aria-label', label);
    button.title = label;
    const icon = button.querySelector('.icon');
    icon?.classList.toggle('icon-install', state === 'prompt');
    icon?.classList.toggle('icon-open-app', state !== 'prompt');
  });
  if (installTitle) {
    installTitle.textContent = state === 'prompt'
      ? 'Install Platho'
      : state === 'open-in-app'
      ? 'Open Platho app'
      : state === 'ios-instructions'
      ? 'Install on iPhone'
      : 'Open or install Platho';
  }
  if (installConfirmButton) {
    installConfirmButton.textContent = state === 'prompt' ? 'Install' : 'Got it';
  }
  if (installDismissButton) {
    installDismissButton.textContent = 'Not now';
    installDismissButton.hidden = state !== 'prompt';
  }
  if (installLead) {
    installLead.textContent = state === 'open-in-app'
      ? 'Platho is already installed on this device.'
      : state === 'ios-instructions'
      ? 'Use Home Screen mode for fewer Safari-tab problems.'
      : state === 'instructions'
      ? 'Use the browser app button when Platho is already installed.'
      : 'Use it as an app, outside stores and platform gates.';
  }
  if (installBody) {
    installBody.textContent = state === 'open-in-app'
      ? 'Your browser already recognizes Platho as an installed app. Use the open-app button in the address bar, launcher, dock, or app list to switch into the installed app window.'
      : state === 'ios-instructions'
      ? 'Safari does not let Platho open the install sheet directly. Tap Share, choose Add to Home Screen, then launch Platho from the Home Screen. It runs in a cleaner app window and is less fragile than a normal Safari tab, but keep your encrypted wallet key backup anyway.'
      : state === 'instructions'
      ? 'If Platho is already installed, use the open-app button in the address bar, launcher, dock, or app list. If it is not installed yet, use the browser menu install action. Browsers do not always expose installed-app status to web pages.'
      : 'Platho is a static PWA. After installation, the app shell, docs, and bounded local encrypted history are cached on this device. The cache improves recovery, but it is not a universal backup. Network access is still required for contract reads, verified public feed updates, message-history retrieval, and sending transactions. Platho does not use a server account that can read your messages or hold your keys.';
  }
  setInstallSteps(state === 'ios-instructions'
    ? [
      'Open platho.app in Safari.',
      'Tap Share. If you only see the three-dot menu, tap it first and choose Share.',
      'Choose Add to Home Screen.',
      'Tap Add, then open Platho from the Home Screen.',
    ]
    : []);
  if (installHelp) {
    installHelp.textContent = state === 'installed'
      ? 'Platho is already installed on this device. Open it from your home screen, launcher, dock, or app list.'
      : state === 'open-in-app'
      ? 'Browsers do not expose a reliable web API that lets Platho launch the installed app directly from this page.'
      : state === 'ios-instructions'
      ? 'Home Screen mode is the recommended iPhone mode. If Add to Home Screen is missing, make sure this page is open in Safari, not inside another app browser.'
      : state === 'prompt'
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

function syncViewportCssVars() {
  const viewport = window.visualViewport;
  const height = Math.max(320, Math.round(viewport?.height ?? window.innerHeight ?? document.documentElement.clientHeight ?? 0));
  document.documentElement.style.setProperty('--app-viewport-height', `${height}px`);
}

async function promptInstallApp() {
  const state = installActionState();
  if (state === 'installed') {
    closeInstallDialog({ dismissed: false });
    refreshInstallButtons();
    return;
  }
  if (state === 'instructions' || state === 'open-in-app' || state === 'ios-instructions') {
    if (installDialog?.hidden === false) {
      closeInstallDialog({ dismissed: false });
    } else if (installDialog) {
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

async function refreshInstalledRelatedPwaState() {
  if (isStandaloneApp() || typeof navigator.getInstalledRelatedApps !== 'function') return;
  try {
    const installedApps = await navigator.getInstalledRelatedApps();
    installedRelatedPwaDetected = installedApps.some((app) => app?.platform === 'webapp');
    refreshInstallButtons();
  } catch {
    installedRelatedPwaDetected = false;
  }
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

function walletAddressForCopy(wallet = plathoWallet) {
  return wallet?.friendlyAddress ?? wallet?.address ?? '';
}

function currentWalletReceiveAddress() {
  return walletAddressForCopy(plathoWallet) || storedWalletAddressForCopy();
}

function walletTonTransferUri(address) {
  return `ton://transfer/${encodeURIComponent(address)}`;
}

function createWalletReceiveQrNode(address) {
  const wrapper = document.createElement('div');
  wrapper.className = 'wallet-receive-card';
  const image = document.createElement('img');
  image.className = 'wallet-receive-qr';
  image.alt = 'TON wallet QR';
  image.src = createQrSvgDataUrl(walletTonTransferUri(address), { title: 'TON wallet receive address' });
  const addressBox = document.createElement('div');
  addressBox.className = 'wallet-receive-address';
  addressBox.textContent = address;
  wrapper.append(image, addressBox);
  return wrapper;
}

function storedPlathoWalletRecord() {
  return readEncryptedPlathoWalletRecord() ?? readLegacyPlaintextPlathoWalletRecord();
}

function storedWalletAddressForCopy(record = storedPlathoWalletRecord()) {
  if (!record?.address) return '';
  try {
    return formatTonUserFriendlyAddress(record.address, {
      testOnly: Number(record.networkGlobalId) === PLATHO_WALLET_NETWORK_GLOBAL_IDS.TESTNET,
    });
  } catch {
    return String(record.address);
  }
}

function walletDisplayIdentityStorageKey(owner = plathoWallet?.address) {
  return owner ? `${WALLET_DISPLAY_IDENTITY_STORAGE_PREFIX}:${owner}` : null;
}

function linkedPlathoUsernameStorageKey(owner = plathoWallet?.address) {
  return owner ? `${LINKED_PLATHO_USERNAME_STORAGE_PREFIX}:${owner}` : null;
}

function privateSenderModeStorageKey(owner = plathoWallet?.address) {
  return owner ? `${PRIVATE_SENDER_MODE_STORAGE_PREFIX}:${owner}` : null;
}

function normalizeWalletDisplayMode(value) {
  return Object.values(WALLET_DISPLAY_MODES).includes(value) ? value : WALLET_DISPLAY_MODES.ADDRESS;
}

function normalizePrivateSenderMode(value) {
  return Object.values(PRIVATE_SENDER_MODES).includes(value) ? value : PRIVATE_SENDER_MODES.SHARE;
}

function privateSenderModeLabel(value) {
  return normalizePrivateSenderMode(value) === PRIVATE_SENDER_MODES.ANONYMOUS ? 'anonymous' : 'share address';
}

function normalizeWalletDisplayIdentity(input) {
  const mode = normalizeWalletDisplayMode(input?.mode);
  if (mode === WALLET_DISPLAY_MODES.ADDRESS) {
    return { mode: WALLET_DISPLAY_MODES.ADDRESS, label: '' };
  }
  if (mode === WALLET_DISPLAY_MODES.PLATHO_NFT) {
    try {
      return {
        mode,
        label: `${normalizeUsernameInput(input?.label ?? input?.value ?? '')}.ath`,
        verified_at: Number.isSafeInteger(Number(input?.verified_at)) ? Number(input.verified_at) : 0,
      };
    } catch {
      return { mode: WALLET_DISPLAY_MODES.ADDRESS, label: '' };
    }
  }
  return { mode: WALLET_DISPLAY_MODES.ADDRESS, label: '' };
}

function sameWalletAddress(left, right) {
  try {
    return parseTonAddress(left).raw === parseTonAddress(right).raw;
  } catch {
    return false;
  }
}

function rawWalletAddress(address) {
  try {
    return parseTonAddress(address).raw;
  } catch {
    return null;
  }
}

function displayWalletAddress(address) {
  try {
    return formatTonUserFriendlyAddress(address, { bounceable: false, testOnly: false });
  } catch {
    return String(address ?? '');
  }
}

function displayIdentityLabel(identity) {
  if (!identity) return '';
  if (identity.type === RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS) {
    return shortAddress(identity.value ?? identity.label);
  }
  return identity.label ?? identity.value ?? '';
}

async function verifyWalletDisplayIdentity(mode, label, wallet = plathoWallet) {
  const normalizedMode = normalizeWalletDisplayMode(mode);
  if (normalizedMode === WALLET_DISPLAY_MODES.ADDRESS) {
    return { mode: WALLET_DISPLAY_MODES.ADDRESS, label: '' };
  }
  const owner = requireBasechainAddress(wallet?.address, 'Connected wallet');
  if (normalizedMode === WALLET_DISPLAY_MODES.PLATHO_NFT) {
    const identity = await resolvePlathoUsernameOwner(label);
    if (!sameWalletAddress(identity.ownerWallet, owner)) throw new Error(`${identity.label} belongs to another wallet`);
    return { mode: normalizedMode, label: identity.label, verified_at: Date.now() };
  }
  return { mode: WALLET_DISPLAY_MODES.ADDRESS, label: '' };
}

function readWalletDisplayIdentity(owner = plathoWallet?.address) {
  const key = walletDisplayIdentityStorageKey(owner);
  if (!key) return { mode: WALLET_DISPLAY_MODES.ADDRESS, label: '' };
  try {
    return normalizeWalletDisplayIdentity(JSON.parse(localStorageOrNull()?.getItem(key) ?? 'null'));
  } catch {
    return { mode: WALLET_DISPLAY_MODES.ADDRESS, label: '' };
  }
}

function readPrivateSenderMode(owner = plathoWallet?.address) {
  const key = privateSenderModeStorageKey(owner);
  if (!key) return PRIVATE_SENDER_MODES.SHARE;
  try {
    return normalizePrivateSenderMode(localStorageOrNull()?.getItem(key));
  } catch {
    return PRIVATE_SENDER_MODES.SHARE;
  }
}

function writePrivateSenderMode(value, owner = plathoWallet?.address) {
  const key = privateSenderModeStorageKey(owner);
  if (!key) return PRIVATE_SENDER_MODES.SHARE;
  const normalized = normalizePrivateSenderMode(value);
  try {
    if (normalized === PRIVATE_SENDER_MODES.SHARE) {
      localStorageOrNull()?.removeItem(key);
    } else {
      localStorageOrNull()?.setItem(key, normalized);
    }
  } catch {
    // Privacy preference is local-only; failed persistence should not block send.
  }
  return normalized;
}

function currentPrivateSenderMode() {
  return readPrivateSenderMode(plathoWallet?.address);
}

function currentPrivateSenderOptions() {
  return {
    includeSenderWalletMetadata: currentPrivateSenderMode() !== PRIVATE_SENDER_MODES.ANONYMOUS,
  };
}

function canTogglePrivateSenderMode() {
  return Boolean(plathoWallet)
    && pendingServiceWorkerAppShellReload !== true
    && composer?.dataset.readOnly !== 'true';
}

function updatePrivateSenderModeUi() {
  const mode = currentPrivateSenderMode();
  const anonymous = mode === PRIVATE_SENDER_MODES.ANONYMOUS;
  if (privateSenderModeSelect) {
    privateSenderModeSelect.value = mode;
    privateSenderModeSelect.disabled = !plathoWallet;
  }
  if (privateAnonymousButton) {
    const icon = privateAnonymousButton.querySelector('.icon');
    privateAnonymousButton.disabled = !canTogglePrivateSenderMode();
    privateAnonymousButton.setAttribute('aria-pressed', anonymous ? 'true' : 'false');
    privateAnonymousButton.setAttribute('aria-label', anonymous ? 'Share wallet address' : 'Send anonymously');
    privateAnonymousButton.title = anonymous
      ? 'Recipient will not see your wallet address'
      : 'Recipient will see your wallet address';
    if (icon) {
      icon.classList.toggle('icon-eye', !anonymous);
      icon.classList.toggle('icon-eye-off', anonymous);
    }
  }
}

function normalizeLinkedPlathoUsername(input) {
  try {
    return {
      mode: WALLET_DISPLAY_MODES.PLATHO_NFT,
      label: `${normalizeUsernameInput(input?.label ?? input?.value ?? input ?? '')}.ath`,
      verified_at: Number.isSafeInteger(Number(input?.verified_at)) ? Number(input.verified_at) : 0,
    };
  } catch {
    return null;
  }
}

function readLinkedPlathoUsername(owner = plathoWallet?.address) {
  const key = linkedPlathoUsernameStorageKey(owner);
  if (key) {
    try {
      const linked = normalizeLinkedPlathoUsername(JSON.parse(localStorageOrNull()?.getItem(key) ?? 'null'));
      if (linked) return linked;
    } catch {
      // A malformed local display alias should not break wallet rendering.
    }
  }
  const legacy = readWalletDisplayIdentity(owner);
  return legacy.mode === WALLET_DISPLAY_MODES.PLATHO_NFT ? normalizeLinkedPlathoUsername(legacy) : null;
}

function writeLinkedPlathoUsername(identity, owner = plathoWallet?.address) {
  const key = linkedPlathoUsernameStorageKey(owner);
  const normalized = normalizeLinkedPlathoUsername(identity);
  if (!key || !normalized) return;
  try {
    localStorageOrNull()?.setItem(key, JSON.stringify(normalized));
  } catch {
    // Local display attachment is cosmetic and can be re-linked.
  }
}

function writeWalletDisplayIdentity(identity, owner = plathoWallet?.address) {
  const key = walletDisplayIdentityStorageKey(owner);
  if (!key) return;
  const normalized = normalizeWalletDisplayIdentity(identity);
  try {
    if (normalized.mode === WALLET_DISPLAY_MODES.ADDRESS) {
      localStorageOrNull()?.removeItem(key);
    } else {
      localStorageOrNull()?.setItem(key, JSON.stringify(normalized));
    }
  } catch {
    // Display preference is cosmetic; the wallet itself still works.
  }
}

function walletDisplayName(wallet = plathoWallet) {
  const identity = readWalletDisplayIdentity(wallet?.address);
  if (identity.mode === WALLET_DISPLAY_MODES.PLATHO_NFT) {
    return readLinkedPlathoUsername(wallet?.address)?.label ?? shortAddress(walletAddressForCopy(wallet));
  }
  return shortAddress(walletAddressForCopy(wallet));
}

function walletDisplaySubtitle(wallet = plathoWallet) {
  const identity = readWalletDisplayIdentity(wallet?.address);
  if (identity.mode === WALLET_DISPLAY_MODES.PLATHO_NFT && readLinkedPlathoUsername(wallet?.address)) return 'Platho name';
  return 'Wallet ready';
}

function renderWalletIdentity(status = null) {
  if (!plathoWallet) {
    const storedRecord = storedPlathoWalletRecord();
    const hasStored = Boolean(storedRecord);
    const storedAddress = storedWalletAddressForCopy(storedRecord);
    const storedLabel = storedAddress ? shortAddress(storedAddress) : storedWalletShortLabel();
    setText(identityName, hasStored ? storedLabel : 'No wallet');
    setText(identitySubtitle, status ?? (hasStored ? 'Unlock local wallet' : 'Create or import a wallet'));
    setText(walletAddressStatus, hasStored ? storedLabel : 'not created');
    setText(walletDisplayModeStatus, 'address');
    setText(linkedUsernameStatus, 'verify');
    if (walletDisplayModeSelect) walletDisplayModeSelect.value = WALLET_DISPLAY_MODES.ADDRESS;
    if (copyWalletAddressButton) copyWalletAddressButton.disabled = !storedAddress;
    return;
  }
  const identity = readWalletDisplayIdentity(plathoWallet.address);
  const linkedUsername = readLinkedPlathoUsername(plathoWallet.address);
  setText(identityName, walletDisplayName(plathoWallet));
  setText(identitySubtitle, status ?? walletDisplaySubtitle(plathoWallet));
  setText(walletAddressStatus, shortAddress(walletAddressForCopy(plathoWallet)));
  setText(walletDisplayModeStatus, identity.mode === WALLET_DISPLAY_MODES.PLATHO_NFT
    ? linkedUsername?.label ?? 'optional'
    : 'address');
  setText(linkedUsernameStatus, linkedUsername?.label ?? 'optional');
  if (walletDisplayModeSelect) walletDisplayModeSelect.value = identity.mode;
  if (copyWalletAddressButton) copyWalletAddressButton.disabled = false;
}

function flashWalletIdentityStatus(status, durationMs = 1400) {
  if (walletIdentityFlashTimer) {
    clearTimeout(walletIdentityFlashTimer);
    walletIdentityFlashTimer = null;
  }
  renderWalletIdentity(status);
  walletIdentityFlashTimer = setTimeout(() => {
    walletIdentityFlashTimer = null;
    if (identitySubtitle?.textContent === status) renderWalletIdentity();
  }, durationMs);
}

function clearWalletAutoLockTimer() {
  if (walletAutoLockTimer) {
    clearTimeout(walletAutoLockTimer);
    walletAutoLockTimer = null;
  }
}

function clearWalletUnlockPromptTimer() {
  if (walletUnlockPromptTimer) {
    clearTimeout(walletUnlockPromptTimer);
    walletUnlockPromptTimer = null;
  }
}

function scheduleWalletAutoLock() {
  clearWalletAutoLockTimer();
  if (!plathoWallet) return;
  walletAutoLockTimer = setTimeout(() => {
    lockPlathoWallet('Wallet locked');
  }, WALLET_AUTO_LOCK_MS);
}

function noteWalletActivity() {
  if (plathoWallet) scheduleWalletAutoLock();
}

function markWalletUnlocked() {
  lastWalletUnlockAt = Date.now();
  walletUnlockPromptPending = false;
  clearWalletUnlockPromptTimer();
}

function shouldIgnoreTransientWalletLock() {
  return Boolean(activeActionDialog) || (Date.now() - lastWalletUnlockAt) < 8000;
}

function shouldDeferServiceWorkerReload() {
  return Boolean(plathoWallet) || Boolean(walletUnlockPromise) || shouldIgnoreTransientWalletLock();
}

function serviceWorkerUpdateReloadError() {
  return new Error('App update ready. Reload before sending.');
}

function requireNoPendingServiceWorkerAppShellReload() {
  if (!pendingServiceWorkerAppShellReload) return;
  flashWalletIdentityStatus('Update ready - reload before sending');
  throw serviceWorkerUpdateReloadError();
}

function reloadForPendingServiceWorkerAppShellUpdate() {
  if (!pendingServiceWorkerAppShellReload) return false;
  window.location.reload();
  return true;
}

function handleServiceWorkerControllerChange() {
  if (shouldDeferServiceWorkerReload()) {
    pendingServiceWorkerAppShellReload = true;
    flashWalletIdentityStatus('Update ready - reload before sending');
    return;
  }
  window.location.reload();
}

function lockPlathoWallet(status = 'Wallet locked', options = {}) {
  if (!plathoWallet) {
    reloadForPendingServiceWorkerAppShellUpdate();
    return;
  }
  if (options.transient === true && shouldIgnoreTransientWalletLock()) {
    scheduleWalletAutoLock();
    return;
  }
  clearWalletAutoLockTimer();
  clearVaultAutoRefreshTimer();
  plathoWallet = null;
  localIdentity = null;
  localRecipientKeyPair = null;
  localSignedPublicBundle = null;
  localVaultDraft = null;
  localProfileAvatarPointer = null;
  delete globalThis.plathoVaultBinding;
  resetVaultPocketState();
  renderWalletIdentity();
  flashWalletIdentityStatus(status);
  setText(encryptionStatus, 'unlock required');
  setText(keyAuthStatus, 'locked');
  setText(vaultDraftStatus, 'locked');
  setText(vaultRecordStatus, 'locked');
  setText(messageSyncStatus, 'locked');
  setText(vaultRotateStatus, 'locked');
  refreshMessagingControls();
  refreshComposerPublishPolicy();
  armWalletUnlockPrompt();
  reloadForPendingServiceWorkerAppShellUpdate();
}

function lockPlathoWalletForBackground() {
  lockPlathoWallet('Wallet locked', { transient: true });
}

function shouldOpenWalletUnlockPrompt() {
  return Boolean(walletUnlockPromptPending)
    && !document.hidden
    && !plathoWallet
    && !walletUnlockPromise
    && !activeActionDialog
    && hasStoredPlathoWalletRecord();
}

function scheduleWalletUnlockPrompt(delayMs = 180) {
  clearWalletUnlockPromptTimer();
  if (!shouldOpenWalletUnlockPrompt()) return;
  walletUnlockPromptTimer = setTimeout(async () => {
    walletUnlockPromptTimer = null;
    if (!shouldOpenWalletUnlockPrompt()) return;
    walletUnlockPromptPending = false;
    try {
      const wallet = await loadPlathoWallet();
      if (!wallet) {
        renderWalletIdentity();
        refreshMessagingControls();
        return;
      }
      await bootCrypto();
      flashWalletIdentityStatus('Wallet unlocked');
    } catch (error) {
      console.error(error);
      renderWalletIdentity();
      refreshMessagingControls();
    }
  }, delayMs);
}

function armWalletUnlockPrompt() {
  if (plathoWallet || !hasStoredPlathoWalletRecord()) return;
  walletUnlockPromptPending = true;
  scheduleWalletUnlockPrompt();
}

function suppressProfileAvatarPicker(durationMs = 1000) {
  profileAvatarPickerSuppressedUntil = Math.max(profileAvatarPickerSuppressedUntil, Date.now() + durationMs);
}

function isProfileAvatarPickerSuppressed() {
  return Date.now() < profileAvatarPickerSuppressedUntil;
}

async function copyTextToClipboard(text) {
  const value = String(text ?? '');
  if (!value) throw new Error('Nothing to copy');
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  area.style.top = '0';
  document.body.append(area);
  area.select();
  try {
    if (!document.execCommand('copy')) throw new Error('Clipboard copy blocked');
  } finally {
    area.remove();
  }
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
  node.textContent = displayIdentityLabel(identity) || thread?.name || '';
  node.className = `${baseClass}${identity ? ` identity-label-${identityTone(identity)}` : ''}`;
}

function identityVariantRow(identity, selected, onSelect) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = `identity-variant identity-label-${identityTone(identity)}`;
  row.setAttribute('role', 'menuitemradio');
  row.setAttribute('aria-checked', selected ? 'true' : 'false');
  const label = document.createElement('strong');
  label.textContent = displayIdentityLabel(identity);
  const type = document.createElement('span');
  type.textContent = selected ? `${identityTypeLabel(identity)} - selected` : identityTypeLabel(identity);
  row.append(label, type);
  row.addEventListener('click', () => onSelect(identity));
  return row;
}

function identityDisplayKey(identity) {
  if (!identity) return null;
  if (identity.type === RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS) {
    const raw = rawWalletAddress(identity.value);
    if (raw) return `${identity.type}:${raw}`;
  }
  return identityKey(identity);
}

function uniqueDisplayIdentityVariants(thread) {
  const out = [];
  const seen = new Set();
  for (const identity of threadIdentityVariants(thread)) {
    const key = identityDisplayKey(identity);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(identity);
  }
  return out;
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
  const variants = uniqueDisplayIdentityVariants(thread);
  if (variants.length === 0 || !anchor) return;
  const selectedKey = identityDisplayKey(primaryThreadIdentity(thread));
  const popover = ensureIdentityPopover();
  popover.setAttribute('role', 'menu');
  popover.replaceChildren();
  const title = document.createElement('div');
  title.className = 'identity-popover-title';
  title.textContent = 'Display as';
  popover.append(title);
  for (const variant of variants) {
    popover.append(identityVariantRow(variant, identityDisplayKey(variant) === selectedKey, (selected) => {
      thread.displayIdentity = selected;
      thread.name = displayIdentityLabel(selected) || selected.label || selected.value;
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
  label.textContent = displayIdentityLabel(identity);
  activeTitle.replaceChildren(label);
  if (identityMenuButton) {
    identityMenuButton.hidden = uniqueDisplayIdentityVariants(thread).length <= 1;
    identityMenuButton.setAttribute('aria-label', `Choose display name for ${displayIdentityLabel(identity)}`);
    identityMenuButton.setAttribute('title', 'Choose display name');
  }
}

const MESSAGE_SYNC_LOADING_FRAMES = Object.freeze(['Syncing', 'Syncing.', 'Syncing..', 'Syncing...']);

function messageAutoSyncNextText() {
  if (messageAutoSyncAt <= 0) return null;
  const seconds = Math.max(1, Math.ceil((messageAutoSyncAt - Date.now()) / 1000));
  return `next sync in ${seconds}s`;
}

function messageAutoSyncCountdownText() {
  if (!isChatsViewActive() || !plathoWallet || !localRecipientKeyPair) return null;
  if (messageAutoSyncPhase === 'syncing') {
    return MESSAGE_SYNC_LOADING_FRAMES[messageAutoSyncLoadingFrame % MESSAGE_SYNC_LOADING_FRAMES.length];
  }
  const next = messageAutoSyncNextText();
  if (messageAutoSyncPhase === 'synced') return next ? `✓ Synced - ${next}` : '✓ Synced';
  if (messageAutoSyncPhase === 'delayed') {
    const label = messageAutoSyncLastErrorLabel ?? 'Sync delayed';
    return next ? `${label} - ${next}` : label;
  }
  return next ? `Next sync in ${next.replace('next sync in ', '')}` : null;
}

function conversationSubtitleText(thread) {
  return messageAutoSyncCountdownText() ?? thread?.subtitle ?? '';
}

function refreshConversationSubtitle() {
  const thread = activeThread();
  if (!thread || !activeSubtitle) return;
  activeSubtitle.textContent = conversationSubtitleText(thread);
}

function clearMessageAutoSyncCountdownTimer() {
  if (!messageAutoSyncCountdownTimer) return;
  window.clearTimeout(messageAutoSyncCountdownTimer);
  messageAutoSyncCountdownTimer = null;
}

function scheduleMessageAutoSyncCountdownUi() {
  clearMessageAutoSyncCountdownTimer();
  refreshConversationSubtitle();
  if (!isChatsViewActive() || document.hidden) return;
  if (messageAutoSyncPhase === 'syncing') {
    messageAutoSyncCountdownTimer = window.setTimeout(() => {
      messageAutoSyncLoadingFrame = (messageAutoSyncLoadingFrame + 1) % MESSAGE_SYNC_LOADING_FRAMES.length;
      scheduleMessageAutoSyncCountdownUi();
    }, 420);
    return;
  }
  if (messageAutoSyncAt <= 0) return;
  const remainingMs = messageAutoSyncAt - Date.now();
  if (remainingMs <= 0) return;
  messageAutoSyncCountdownTimer = window.setTimeout(
    scheduleMessageAutoSyncCountdownUi,
    Math.min(MESSAGE_SYNC_COUNTDOWN_TICK_MS, remainingMs),
  );
}

function beginMessageSyncUi() {
  messageAutoSyncPhase = 'syncing';
  messageAutoSyncAt = 0;
  messageAutoSyncLastErrorLabel = null;
  messageAutoSyncLoadingFrame = 0;
  setText(messageSyncStatus, 'syncing');
  scheduleMessageAutoSyncCountdownUi();
}

function completeMessageSyncUi(result) {
  messageAutoSyncPhase = 'synced';
  messageAutoSyncLastResult = result ?? null;
  messageAutoSyncLastErrorLabel = null;
  refreshConversationSubtitle();
}

function failMessageSyncUi(label) {
  messageAutoSyncPhase = 'delayed';
  messageAutoSyncLastErrorLabel = label || 'Sync delayed';
  refreshConversationSubtitle();
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
    values[field.name] = field.type === 'checkbox' ? field.checked : field.value;
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
  if (field.type === 'custom') {
    const wrapper = document.createElement('div');
    wrapper.className = field.className ?? 'action-custom-field';
    const rendered = typeof field.render === 'function' ? field.render() : field.node;
    if (rendered instanceof Node) wrapper.append(rendered);
    return wrapper;
  }
  if (field.type === 'credential-username') {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = field.id;
    input.name = field.name ?? 'username';
    input.value = field.value ?? '';
    input.autocomplete = field.autocomplete ?? 'username';
    input.className = 'password-manager-username';
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    input.style.position = 'fixed';
    input.style.left = '-10000px';
    input.style.top = '0';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '0.01';
    input.style.pointerEvents = 'none';
    input.required = false;
    return input;
  }
  if (field.type === 'hidden') {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.id = field.id;
    input.name = field.name ?? field.id;
    input.value = field.value ?? '';
    if (field.autocomplete) input.autocomplete = field.autocomplete;
    return input;
  }
  const wrapper = document.createElement('div');
  wrapper.className = field.type === 'checkbox' ? 'action-field action-checkbox-field' : 'action-field';
  const label = document.createElement('label');
  label.htmlFor = field.id;
  label.textContent = field.label;
  if (field.type === 'checkbox') {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = field.id;
    input.name = field.name ?? field.id;
    input.checked = field.checked === true;
    input.required = field.required !== false;
    const text = document.createElement('span');
    text.textContent = field.label;
    label.textContent = '';
    label.append(input, text);
    wrapper.append(label);
    return wrapper;
  }
  if (field.type === 'image-preview') {
    const card = document.createElement('div');
    card.className = 'image-preview-card';
    const image = document.createElement('img');
    image.id = field.id;
    image.alt = field.alt ?? 'Final image preview';
    image.loading = 'eager';
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.title = 'Open full-size preview';
    const meta = document.createElement('div');
    meta.id = field.metaId ?? `${field.id}Meta`;
    meta.className = 'image-preview-meta';
    meta.textContent = field.meta ?? 'Preparing preview';
    card.append(image, meta);
    wrapper.append(label, card);
    return wrapper;
  }
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
  input.name = field.name ?? field.id;
  if (field.placeholder) input.placeholder = field.placeholder;
  if (field.inputMode) input.inputMode = field.inputMode;
  if (field.autocomplete) input.autocomplete = field.autocomplete;
  if (field.autocapitalize) input.autocapitalize = field.autocapitalize;
  if (field.spellcheck !== undefined) input.spellcheck = Boolean(field.spellcheck);
  if (field.minLength) input.minLength = field.minLength;
  if (field.maxLength) input.maxLength = field.maxLength;
  if (field.readOnly) input.readOnly = true;
  if (field.required !== false) input.required = true;
  input.value = field.value ?? '';
  wrapper.append(label, input);
  return wrapper;
}

function closeOnBackdropClick(backdrop, close) {
  if (!backdrop) return;
  let pointerStartedOnBackdrop = false;
  backdrop.addEventListener('pointerdown', (event) => {
    pointerStartedOnBackdrop = event.target === backdrop;
  });
  backdrop.addEventListener('click', (event) => {
    if (event.target !== backdrop || !pointerStartedOnBackdrop) return;
    pointerStartedOnBackdrop = false;
    if (backdrop === actionDialog && activeActionDialog?.dismissOnBackdrop === false) return;
    close(event);
  });
}

function openImageLightbox(src, meta = '') {
  if (!imageLightboxDialog || !imageLightboxImage) return;
  if (!src) return;
  imageLightboxPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  imageLightboxImage.src = src;
  if (imageLightboxMeta) imageLightboxMeta.textContent = meta || 'Final compressed image';
  if (imageLightboxDownloadButton) imageLightboxDownloadButton.disabled = false;
  imageLightboxDialog.hidden = false;
  imageLightboxCloseButton?.focus();
}

function closeImageLightbox() {
  if (!imageLightboxDialog || imageLightboxDialog.hidden) return;
  imageLightboxDialog.hidden = true;
  imageLightboxImage?.removeAttribute('src');
  if (imageLightboxDownloadButton) imageLightboxDownloadButton.disabled = true;
  const focusTarget = imageLightboxPreviousFocus;
  imageLightboxPreviousFocus = null;
  focusTarget?.focus?.();
}

function imageDownloadExtension(src) {
  const match = String(src ?? '').match(/^data:image\/([a-z0-9.+-]+)[;,]/i);
  const type = (match?.[1] ?? 'webp').toLowerCase();
  if (type === 'jpeg') return 'jpg';
  if (/^[a-z0-9]+$/.test(type)) return type;
  return 'webp';
}

function imageLightboxDownloadFilename(src) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  return `platho-image-${stamp}.${imageDownloadExtension(src)}`;
}

function downloadImageLightboxImage() {
  const src = imageLightboxImage?.currentSrc || imageLightboxImage?.src;
  if (!src) return;
  const link = document.createElement('a');
  link.href = src;
  link.download = imageLightboxDownloadFilename(src);
  link.rel = 'noreferrer';
  document.body.append(link);
  link.click();
  link.remove();
}

function closeActionDialog(result = null) {
  if (!activeActionDialog) return;
  const { resolve } = activeActionDialog;
  activeActionDialog = null;
  closeImageLightbox();
  if (actionDialog) actionDialog.hidden = true;
  actionFields?.replaceChildren();
  if (actionCancelButton) {
    actionCancelButton.hidden = false;
    actionCancelButton.disabled = false;
  }
  if (actionSubmitButton) actionSubmitButton.disabled = false;
  resolve(result);
  scheduleWalletUnlockPrompt();
}

async function openActionDialog(config = {}) {
  if (!actionDialog || !actionForm || !actionFields || !actionTitle || !actionHint || !actionSubmitButton) {
    throw new Error('Action dialog is unavailable');
  }
  if (activeActionDialog) closeActionDialog(null);
  return new Promise((resolve) => {
    const dismissible = config.dismissOnBackdrop !== false;
    activeActionDialog = {
      resolve,
      summary: config.summary,
      dismissOnBackdrop: dismissible,
    };
    actionTitle.textContent = config.title ?? 'Action';
    actionHint.textContent = config.hint ?? 'Review details before signing.';
    actionHint.dataset.tone = config.tone ?? 'muted';
    actionForm.autocomplete = config.formAutocomplete ?? 'off';
    actionForm.method = config.formMethod ?? 'post';
    actionForm.action = config.formAction ?? window.location.href;
    if (actionCancelButton) {
      actionCancelButton.hidden = !dismissible;
      actionCancelButton.disabled = !dismissible;
    }
    actionSubmitButton.textContent = config.submitLabel ?? 'Continue';
    actionSubmitButton.disabled = false;
    actionFields.replaceChildren(...(config.fields ?? []).map(createActionField));
    renderActionSummary(config.summary, collectActionDialogValues());
    actionDialog.hidden = false;
    requestAnimationFrame(() => actionFields.querySelector('textarea, input:not([readonly]):not([type="hidden"]):not(.password-manager-username), select')?.focus());
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

function publicChannelMatchesAuthorWallet(channel, authorWallet) {
  const channelWallet = channel?.authorWallet ?? channel?.author_wallet;
  if (!channelWallet || !authorWallet) return false;
  return sameWalletAddress(channelWallet, authorWallet)
    || String(channelWallet) === String(authorWallet);
}

function rebuildPublicChannelRegistry() {
  const baseChannels = normalizePublicChannelRegistry(basePublicChannelRegistry);
  const customChannels = normalizePublicChannelRegistry(customPublicChannels)
    .filter((channel) => !baseChannels.some((base) => publicChannelMatchesAuthorWallet(base, channel.authorWallet)));
  publicChannelRegistry = normalizePublicChannelRegistry([...baseChannels, ...customChannels]);
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
    const resolved = await resolvePlathoUsernameOwner(identity.value);
    return {
      identity,
      authorWallet: requireBasechainAddress(resolved.ownerWallet, 'Public channel author'),
    };
  }

  if (identity.type === RECIPIENT_IDENTITY_TYPES.TON_DNS) {
    const provider = await resolveTonDnsProvider();
    if (!provider?.resolveWallet) throw new Error('TON DNS provider is not configured');
    const walletAddress = await provider.resolveWallet(identity.value, {
      rootAddress: appConfig.tonDns?.rootAddress ?? null,
      ...criticalChainReadOptions(),
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

function setPublicChannelSubscribed(channelId, subscribed) {
  const id = String(channelId ?? '').trim();
  if (!id) return false;
  const subscribedById = new Map((publicChannelSubscriptions?.channels ?? []).map((item) => [item.id, item]));
  subscribedById.set(id, { id, subscribed: subscribed === true });
  const channels = publicChannelRegistry.map((item) => ({
    id: item.id,
    subscribed: subscribedById.get(item.id)?.subscribed === true,
  }));
  const nextActive = subscribed === false && publicChannelSubscriptions?.activeChannelId === id
    ? channels.find((item) => item.subscribed)?.id ?? null
    : publicChannelSubscriptions?.activeChannelId ?? channels.find((item) => item.subscribed)?.id ?? null;
  publicChannelSubscriptions = {
    version: publicChannelSubscriptions?.version ?? 1,
    activeChannelId: nextActive,
    channels,
  };
  writePublicChannelSubscriptions(localStorageOrNull(), publicChannelSubscriptions);
  rebuildThreadsFromPublicSubscriptions({ preserveActive: false });
  renderPublicSurface({ anchorUnread: false });
  setPublicStatus(subscribed ? 'channel followed' : 'channel hidden');
  return true;
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

function isPendingPublicFeedItem(item) {
  return Boolean(item?.publishStatus && (item.entryId === undefined || item.entryId === null || item.entryId === ''));
}

function samePublicBodyHash(left, right) {
  const a = String(left?.bodyHash ?? '').toLowerCase();
  const b = String(right?.bodyHash ?? '').toLowerCase();
  return Boolean(a && b && a === b);
}

function mergeLocalPendingPublicFeed(channelId, chainPosts = []) {
  const cached = publicChannelFeedCache?.[channelId]?.feed ?? publicChannelFeedCache?.[channelId] ?? null;
  const localPosts = Array.isArray(cached?.posts) ? cached.posts : [];
  const merged = chainPosts.map((post) => {
    const matchingLocal = localPosts.filter((local) => (
      samePublicBodyHash(local, post)
      || (local.entryId && post.entryId && String(local.entryId) === String(post.entryId))
    ));
    const chainComments = post.comments ?? [];
    const pendingComments = matchingLocal
      .flatMap((local) => local.comments ?? [])
      .filter((comment) => isPendingPublicFeedItem(comment))
      .filter((comment) => !chainComments.some((chainComment) => samePublicBodyHash(comment, chainComment)));
    return pendingComments.length > 0
      ? { ...post, comments: [...chainComments, ...pendingComments] }
      : post;
  });
  const pendingPosts = localPosts
    .filter((post) => isPendingPublicFeedItem(post))
    .filter((post) => !chainPosts.some((chainPost) => samePublicBodyHash(post, chainPost)));
  return [...merged, ...pendingPosts]
    .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
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
  const actions = document.createElement('div');
  actions.className = 'public-channel-detail-actions';
  const unfollowButton = document.createElement('button');
  unfollowButton.type = 'button';
  unfollowButton.className = 'mini-action-button';
  unfollowButton.textContent = 'Unfollow';
  unfollowButton.title = `Hide ${channel.name} from Public feed and Channels`;
  unfollowButton.addEventListener('click', () => {
    setPublicChannelSubscribed(channel.id, false);
  });
  actions.append(unfollowButton);
  header.append(avatar, titleWrap, actions);

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
    hint: 'Public comments are immutable while retained, but Platho v1 is not a permanent archive.',
    tone: 'error',
    submitLabel: 'Publish with comments',
    fields: [],
    summary: [
      'Anyone can write an immutable public comment under this post.',
      'The protocol cannot edit or moderate accepted comments before prune; abusive content may remain visible while retained or available through history providers.',
      'Compact entries can be pruned after the retention window, and old bodies may depend on RPC history or local cache.',
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

function tryReadPublicEntryPayload(entry, options = {}) {
  try {
    return readPublicPostPayload({
      header_boc: entry.header_boc,
      body_boc: entry.body_boc,
    }, options);
  } catch (error) {
    console.warn('Skipping malformed public CapsuleHub entry', entry?.entry_id?.toString?.() ?? 'unknown', error);
    return null;
  }
}

async function resolvePublicEntryPayload(provider, entry, address, options = {}) {
  const hydrated = entry?.body_boc || !provider?.resolvePublicEntryBody
    ? entry
    : await provider.resolvePublicEntryBody(entry, {
      capsuleHubAddress: address,
      vaultAddress: appConfig.vault?.address ?? null,
      messageCacheTtlMs: 0,
      priority: 'critical',
    });
  const payload = tryReadPublicEntryPayload(hydrated, options);
  if (!payload) return null;
  const authorWallet = hydrated?.author_wallet ?? hydrated?.authorWallet;
  if (authorWallet) payload.authorWallet = String(authorWallet);
  if (hydrated?.body_hash !== undefined && hydrated?.body_hash !== null) payload.bodyHash = uint256Hex(hydrated.body_hash);
  if (hydrated?.entry_uid !== undefined && hydrated?.entry_uid !== null) payload.entryUid = BigInt(hydrated.entry_uid).toString(16);
  const entryCreatedAt = hydrated?.created_at ?? hydrated?.createdAt;
  if (entryCreatedAt !== undefined && entryCreatedAt !== null) {
    try {
      const sec = Number(BigInt(entryCreatedAt));
      if (Number.isFinite(sec) && sec > 0) {
        payload.createdAtSec = sec;
        payload.created_at_sec = sec;
      }
    } catch {
      // Keep the parsed header timestamp when chain metadata is malformed.
    }
  }
  return payload;
}

async function resolvePrivateEntryBody(provider, entry, address) {
  if (entry?.body_boc || !provider?.resolvePrivateEntryBody) return entry;
  return provider.resolvePrivateEntryBody(entry, {
    capsuleHubAddress: address,
    vaultAddress: appConfig.vault?.address ?? null,
    messageCacheTtlMs: 0,
    priority: 'critical',
  });
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
  if (pointer.profileVersion && Number(payload.profileVersion ?? payload.profile_version ?? 0) !== Number(pointer.profileVersion)) return false;
  if (pointer.avatarPartCount && Number(payload.partCount ?? payload.part_count ?? 0) !== Number(pointer.avatarPartCount)) return false;
  if (ownerWallet && payload.authorWallet && !sameWalletAddress(payload.authorWallet, ownerWallet)) return false;
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
  const readOptions = criticalCapsuleHubReadOptions(address);
  const parts = [];
  const start = publicEntryIdBigInt(pointer.avatarEntryId ?? pointer.avatar_entry_id);
  if (start !== null && start >= 0n) {
    const maxExtra = BigInt(Math.max(PROFILE_AVATAR_ENTRY_SCAN_PADDING, Number(pointer.avatarPartCount ?? 0) + PROFILE_AVATAR_ENTRY_SCAN_PADDING));
    for (let entryId = start; entryId <= start + maxExtra; entryId += 1n) {
      try {
        const entry = await provider.getPublicEntry(entryId, readOptions);
        if (entry.exists !== true) continue;
        const payload = await resolvePublicEntryPayload(provider, entry, address, { maxBytes: SINGLE_CAPSULE_USEFUL_BYTES });
        if (!payload) continue;
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

  const state = await provider.getState(readOptions);
  const latest = BigInt(state.public_latest_id ?? 0n);
  const limit = BigInt(options.scanLimit ?? appConfig.capsuleHub?.publicAvatarReadLimit ?? PROFILE_AVATAR_FALLBACK_SCAN_LIMIT);
  const floor = latest > limit ? latest - limit : 0n;
  for (let entryId = latest - 1n; entryId >= floor; entryId -= 1n) {
    const entry = await provider.getPublicEntry(entryId, readOptions);
    if (entry.exists !== true) {
      if (entryId === 0n) break;
      continue;
    }
    const payload = await resolvePublicEntryPayload(provider, entry, address, { maxBytes: SINGLE_CAPSULE_USEFUL_BYTES });
    if (!payload) {
      if (entryId === 0n) break;
      continue;
    }
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
  const readOptions = criticalCapsuleHubReadOptions(address);
  const expectedParts = Number(pointer.avatarPartCount ?? 0);
  if (!Number.isSafeInteger(expectedParts) || expectedParts <= 0) throw new Error('Avatar part count is invalid');
  const state = await provider.getState(readOptions);
  const latest = BigInt(state.public_latest_id ?? 0n);
  const parts = [];
  const limit = BigInt(Math.max(PROFILE_AVATAR_FALLBACK_SCAN_LIMIT, expectedParts + PROFILE_AVATAR_ENTRY_SCAN_PADDING));
  const floor = latest > limit ? latest - limit : 0n;
  for (let entryId = latest - 1n; entryId >= floor; entryId -= 1n) {
    const entry = await provider.getPublicEntry(entryId, readOptions);
    if (entry.exists === true) {
      const payload = await resolvePublicEntryPayload(provider, entry, address, { maxBytes: SINGLE_CAPSULE_USEFUL_BYTES });
      if (!payload) {
        if (entryId === 0n) break;
        continue;
      }
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
  const streamId = parts[0]?.stream_id ?? parts[0]?.streamId ?? null;
  return { imageUrl, firstEntryId, parts, streamId };
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
    const readOptions = { profileRegistryAddress: resolved.address, ...criticalChainReadOptions() };
    const record = requestedPointer
      ? await resolved.provider.getAvatarVersion(ownerWallet, requestedPointer.profileVersion, readOptions)
      : await resolved.provider.getAvatar(ownerWallet, readOptions);
    const recordPointer = profileAvatarPointerFromRecord(record);
    if (!recordPointer) return null;
    if (requestedPointer && recordPointer.avatarHash.toLowerCase() !== requestedPointer.avatarHash.toLowerCase()) return null;
    return readAvatarPartsFromCapsuleHub(ownerWallet, recordPointer);
  })().catch((error) => {
    if (!noteTonRpcRateLimit(error)) console.error(error);
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
    if (!item || !sameWalletAddress(item.authorWallet ?? item.author_wallet ?? '', ownerWallet)) return item;
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
  const wallet = rawWalletAddress(authorWallet) ?? String(authorWallet ?? '').trim();
  return publicChannelRegistry.find((channel) => publicChannelMatchesAuthorWallet(channel, wallet))?.id
    ?? ensurePublicChannelForAuthorWallet(wallet);
}

function publicAuthorLabel(authorWallet) {
  const wallet = rawWalletAddress(authorWallet) ?? String(authorWallet ?? '').trim();
  return publicChannelRegistry.find((channel) => publicChannelMatchesAuthorWallet(channel, wallet))?.name
    ?? shortAddress(wallet);
}

function ensurePublicChannelForAuthorWallet(authorWallet, options = {}) {
  const wallet = rawWalletAddress(authorWallet) ?? String(authorWallet ?? '').trim();
  if (!wallet) return publicChannelRegistry[0]?.id ?? 'platho.app';
  const existing = publicChannelRegistry.find((channel) => (
    publicChannelMatchesAuthorWallet(channel, wallet)
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
  const isOwnChannel = plathoWallet?.address && sameWalletAddress(wallet, plathoWallet.address);
  const name = isOwnChannel ? 'you' : shortAddress(wallet);
  const channel = {
    id,
    name,
    avatar: publicChannelAvatar(name),
    subtitle: `${isOwnChannel ? 'your' : 'wallet'} public channel - ${shortAddress(wallet)}`,
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
  const readOptions = criticalCapsuleHubReadOptions(address);
  const state = await provider.getState(readOptions);
  const latestId = BigInt(state.public_latest_id ?? 0n);
  const latest = Number(latestId);
  const configuredLimit = Number(appConfig.capsuleHub?.publicReadLimit ?? PUBLIC_CHAIN_READ_LIMIT);
  const readLimit = Number.isFinite(configuredLimit)
    ? Math.max(1, Math.floor(configuredLimit))
    : PUBLIC_CHAIN_READ_LIMIT;
  const syncWindow = readPublicSyncWindow();
  const minEntryId = syncWindow === 'all' ? 0 : Math.max(0, latest - readLimit);
  const retryEntryIds = publicBodyHistoryRetryEntryIds(address, latestId, BigInt(minEntryId));
  const retryEntryIdSet = new Set(retryEntryIds.map((id) => id.toString()));
  const entryIdsToScan = [];
  for (let entryId = latest - 1; entryId >= minEntryId; entryId -= 1) {
    entryIdsToScan.push(BigInt(entryId));
  }
  entryIdsToScan.push(...retryEntryIds);
  const cutoffMs = publicSyncCutoffMs();
  const postParts = [];
  const commentParts = [];
  const avatarParts = [];
  const unavailableEntries = [];
  let scanned = 0;
  for (const entryIdValue of entryIdsToScan) {
    const retryOnly = retryEntryIdSet.has(entryIdValue.toString());
    scanned += 1;
    const entry = await provider.getPublicEntry(entryIdValue, readOptions);
    if (entry.exists !== true) {
      if (retryOnly) clearPublicBodyHistoryUnavailable(address, entryIdValue);
      continue;
    }
    let payload = null;
    try {
      payload = await resolvePublicEntryPayload(provider, entry, address, { maxBytes: SINGLE_CAPSULE_USEFUL_BYTES });
    } catch (error) {
      if (isBodyHistoryUnavailableError(error)) {
        rememberPublicBodyHistoryUnavailable(address, entry, entryIdValue);
        unavailableEntries.push({
          entryId: String(entry.entry_id ?? entryIdValue),
          bodyHash: entryBodyHashHex(entry),
        });
        continue;
      }
      if (retryOnly) clearPublicBodyHistoryUnavailable(address, entryIdValue);
      console.warn('Skipping unreadable public CapsuleHub entry', entry.entry_id?.toString?.() ?? entryIdValue.toString(), error);
      continue;
    }
    if (!payload) {
      if (retryOnly) clearPublicBodyHistoryUnavailable(address, entryIdValue);
      continue;
    }
    clearPublicBodyHistoryUnavailable(address, entryIdValue);
    const createdAtSec = Number(payload.createdAtSec ?? payload.created_at_sec ?? 0);
    const createdAt = createdAtSec > 0
      ? new Date(createdAtSec * 1000).toISOString()
      : new Date().toISOString();
    const createdMs = new Date(createdAt).getTime();
    if (!retryOnly && cutoffMs !== null && createdAtSec > 0 && !Number.isNaN(createdMs) && createdMs < cutoffMs) continue;
    const authorWallet = rawWalletAddress(payload.authorWallet ?? entry.author_wallet) ?? String(payload.authorWallet ?? entry.author_wallet ?? '');
    const base = {
      id: `chain-${entry.entry_id.toString()}`,
      entryId: entry.entry_id.toString(),
      channelId: publicChannelIdForAuthorWallet(authorWallet),
      type: payload.type,
      text: payload.text ?? '',
      imageBytes: payload.imageBytes ?? payload.image_bytes,
      createdAt,
      author: publicAuthorLabel(authorWallet),
      authorWallet,
      bodyHash: payload.bodyHash ?? uint256Hex(entry.body_hash),
      entryUid: payload.entryUid ?? entry.entry_uid.toString(16),
      streamId: payload.stream_id,
      partIndex: payload.partIndex ?? 0,
      partCount: payload.partCount ?? 1,
      profileVersion: payload.profileVersion ?? payload.profile_version ?? 0,
      avatarHash: payload.avatarHash ?? payload.avatar_hash ?? zeroAvatarHashHex(),
      chainVerified: true,
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
    const postsWithLocalPending = mergeLocalPendingPublicFeed(channelId, channelPosts);
    nextFeedCache[channelId] = {
      feed: {
        version: 1,
        channelId,
        updatedAt,
        posts: postsWithLocalPending,
      },
      syncedAt: updatedAt,
    };
  }
  publicChannelFeedCache = nextFeedCache;
  globalThis.plathoLastPublicSync = {
    capsuleHub: address,
    latest: String(latest),
    minEntryId: String(minEntryId),
    scanned,
    readLimit,
    allTime: syncWindow === 'all',
    retryEntryCount: retryEntryIds.length,
    historyUnavailableCount: unavailableEntries.length,
    unavailableEntries,
  };
  return true;
}

function publicFeedPostHasChainAnchor(post) {
  return Boolean(
    post?.chainVerified === true
    && post?.entryId
    && post?.bodyHash
    && post?.entryUid
    && /^0x[0-9a-fA-F]{64}$/.test(String(post.bodyHash)),
  );
}

function chainBackedPublicFeedOnly(feed) {
  return {
    ...feed,
    posts: (feed?.posts ?? [])
      .filter(publicFeedPostHasChainAnchor)
      .map((post) => ({
        ...post,
        comments: (post.comments ?? []).filter(publicFeedPostHasChainAnchor),
      })),
  };
}

async function syncPublicChannels() {
  let chainSyncError = null;
  try {
    const syncedFromChain = await syncPublicChannelFromChain();
    if (syncedFromChain) {
      writePublicChannelFeedCache(localStorageOrNull(), publicChannelFeedCache);
      rebuildThreadsFromPublicSubscriptions();
      renderThreads();
      renderConversation();
      hydratePublicAvatars().catch((error) => console.error(error));
      const unavailableCount = Number(globalThis.plathoLastPublicSync?.historyUnavailableCount ?? 0);
      if (unavailableCount > 0) setPublicStatus(`chain sync: ${unavailableCount} history gap${unavailableCount === 1 ? '' : 's'}`);
      return;
    }
  } catch (error) {
    chainSyncError = error;
    if (noteTonRpcRateLimit(error)) {
      setPublicStatus('sync delayed');
    } else {
      console.error(error);
    }
  }

  if (appConfig.capsuleHub?.allowUnverifiedStaticPublicFeeds !== true) {
    setPublicStatus(chainSyncError ? 'chain sync unavailable' : 'chain provider unavailable');
    return;
  }

  const channels = subscribedPublicChannels(publicChannelSubscriptions, publicChannelRegistry);
  let changed = false;
  for (const channel of channels) {
    if (!channel.sourceUrl) continue;
    try {
      const response = await fetch(channel.sourceUrl, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Public channel feed unavailable: ${channel.id}`);
      const feed = chainBackedPublicFeedOnly(normalizePublicChannelFeed(await response.json(), channel.id));
      if ((feed.posts ?? []).length === 0) {
        throw new Error(`Public channel feed has no verified CapsuleHub anchors: ${channel.id}`);
      }
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

function privateChainHistoryUnavailableStorageKey(address = configuredCapsuleHubAddress()) {
  const hub = address ?? 'no-capsulehub';
  const keyId = localRecipientKeyPair?.keyId ?? 'no-key';
  return `${PRIVATE_CHAIN_HISTORY_UNAVAILABLE_STORAGE_PREFIX}:${hub}:${keyId}`;
}

function normalizePrivateBodyHistoryUnavailableRecord(record) {
  const entryId = record?.entryId ?? record?.entry_id ?? record;
  if (!/^[0-9]+$/.test(String(entryId ?? ''))) return null;
  return {
    entryId: String(entryId),
    bodyHash: /^0x[0-9a-fA-F]{64}$/.test(String(record?.bodyHash ?? '')) ? String(record.bodyHash).toLowerCase() : null,
    createdAt: record?.createdAt ? String(record.createdAt) : null,
    lastSeenAt: record?.lastSeenAt ? String(record.lastSeenAt) : new Date().toISOString(),
  };
}

function readPrivateBodyHistoryUnavailable(address) {
  try {
    const raw = localStorageOrNull()?.getItem(privateChainHistoryUnavailableStorageKey(address));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizePrivateBodyHistoryUnavailableRecord)
      .filter(Boolean)
      .slice(-PRIVATE_CHAIN_HISTORY_UNAVAILABLE_LIMIT);
  } catch {
    return [];
  }
}

function writePrivateBodyHistoryUnavailable(address, records) {
  try {
    const normalized = (records ?? [])
      .map(normalizePrivateBodyHistoryUnavailableRecord)
      .filter(Boolean)
      .slice(-PRIVATE_CHAIN_HISTORY_UNAVAILABLE_LIMIT);
    const storage = localStorageOrNull();
    if (!storage) return;
    if (normalized.length === 0) storage.removeItem(privateChainHistoryUnavailableStorageKey(address));
    else storage.setItem(privateChainHistoryUnavailableStorageKey(address), JSON.stringify(normalized));
  } catch {
    // Non-persistent mode retries unavailable entries only within the current session.
  }
}

function entryBodyHashHex(entry) {
  try {
    if (entry?.body_hash === undefined || entry?.body_hash === null) return null;
    return uint256Hex(entry.body_hash).toLowerCase();
  } catch {
    return null;
  }
}

function publicChainHistoryUnavailableStorageKey(address = configuredCapsuleHubAddress()) {
  const hub = address ?? 'no-capsulehub';
  return `${PUBLIC_CHAIN_HISTORY_UNAVAILABLE_STORAGE_PREFIX}:${hub}`;
}

function normalizePublicBodyHistoryUnavailableRecord(record) {
  const entryId = record?.entryId ?? record?.entry_id ?? record;
  if (!/^[0-9]+$/.test(String(entryId ?? ''))) return null;
  return {
    entryId: String(entryId),
    bodyHash: /^0x[0-9a-fA-F]{64}$/.test(String(record?.bodyHash ?? '')) ? String(record.bodyHash).toLowerCase() : null,
    createdAt: record?.createdAt ? String(record.createdAt) : null,
    lastSeenAt: record?.lastSeenAt ? String(record.lastSeenAt) : new Date().toISOString(),
  };
}

function readPublicBodyHistoryUnavailable(address) {
  try {
    const raw = localStorageOrNull()?.getItem(publicChainHistoryUnavailableStorageKey(address));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizePublicBodyHistoryUnavailableRecord)
      .filter(Boolean)
      .slice(-PUBLIC_CHAIN_HISTORY_UNAVAILABLE_LIMIT);
  } catch {
    return [];
  }
}

function writePublicBodyHistoryUnavailable(address, records) {
  try {
    const normalized = (records ?? [])
      .map(normalizePublicBodyHistoryUnavailableRecord)
      .filter(Boolean)
      .slice(-PUBLIC_CHAIN_HISTORY_UNAVAILABLE_LIMIT);
    const storage = localStorageOrNull();
    if (!storage) return;
    if (normalized.length === 0) storage.removeItem(publicChainHistoryUnavailableStorageKey(address));
    else storage.setItem(publicChainHistoryUnavailableStorageKey(address), JSON.stringify(normalized));
  } catch {
    // Non-persistent mode retries unavailable public entries only within the current session.
  }
}

function rememberPublicBodyHistoryUnavailable(address, entry, entryId) {
  const id = String(entryId ?? entry?.entry_id ?? entry?.entryId ?? '');
  if (!/^[0-9]+$/.test(id)) return [];
  const existing = readPublicBodyHistoryUnavailable(address)
    .filter((record) => record.entryId !== id);
  existing.push({
    entryId: id,
    bodyHash: entryBodyHashHex(entry),
    createdAt: entry?.created_at !== undefined && entry?.created_at !== null ? String(entry.created_at) : null,
    lastSeenAt: new Date().toISOString(),
  });
  writePublicBodyHistoryUnavailable(address, existing);
  return existing;
}

function clearPublicBodyHistoryUnavailable(address, entryId) {
  const id = String(entryId ?? '');
  if (!/^[0-9]+$/.test(id)) return;
  const remaining = readPublicBodyHistoryUnavailable(address)
    .filter((record) => record.entryId !== id);
  writePublicBodyHistoryUnavailable(address, remaining);
}

function publicBodyHistoryRetryEntryIds(address, latest, minEntryId) {
  const ids = [];
  const latestId = BigInt(latest);
  const windowStart = BigInt(minEntryId);
  for (const record of readPublicBodyHistoryUnavailable(address)) {
    try {
      const id = BigInt(record.entryId);
      if (id < 0n || id >= latestId) continue;
      if (id >= windowStart && id < latestId) continue;
      ids.push(id);
    } catch {
      // Ignore corrupt local retry records.
    }
  }
  return ids;
}

function rememberPrivateBodyHistoryUnavailable(address, entry, entryId) {
  const id = String(entryId ?? privateEntryIdText(entry) ?? '');
  if (!/^[0-9]+$/.test(id)) return [];
  const existing = readPrivateBodyHistoryUnavailable(address)
    .filter((record) => record.entryId !== id);
  existing.push({
    entryId: id,
    bodyHash: entryBodyHashHex(entry),
    createdAt: entry?.created_at !== undefined && entry?.created_at !== null ? String(entry.created_at) : null,
    lastSeenAt: new Date().toISOString(),
  });
  writePrivateBodyHistoryUnavailable(address, existing);
  return existing;
}

function clearPrivateBodyHistoryUnavailable(address, entryId) {
  const id = String(entryId ?? '');
  if (!/^[0-9]+$/.test(id)) return;
  const remaining = readPrivateBodyHistoryUnavailable(address)
    .filter((record) => record.entryId !== id);
  writePrivateBodyHistoryUnavailable(address, remaining);
}

function privateBodyHistoryRetryEntryIds(address, latest, start, scanEnd) {
  const ids = [];
  for (const record of readPrivateBodyHistoryUnavailable(address)) {
    try {
      const id = BigInt(record.entryId);
      if (id < 0n || id >= latest) continue;
      if (id >= start && id < scanEnd) continue;
      ids.push(id);
    } catch {
      // Ignore corrupt local retry records.
    }
  }
  return ids;
}

function base64UrlToBytes(value) {
  const text = String(value ?? '');
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('Invalid base64url value');
  const padded = `${text}${'='.repeat((4 - (text.length % 4)) % 4)}`;
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function senderSigningPublicKeyValue(opened) {
  try {
    const bytes = base64UrlToBytes(opened?.capsule?.header0?.senderSigningPublicKey);
    if (bytes.length !== 32) return null;
    return bytesToBigIntValue(bytes).toString();
  } catch {
    return null;
  }
}

function rememberKnownVaultKeyOwner(walletAddress, keyRecord) {
  const raw = rawWalletAddress(walletAddress);
  if (!raw || !keyRecord?.sign_pubkey) return null;
  const signPubkey = BigInt(keyRecord.sign_pubkey).toString();
  knownVaultKeyOwnerBySignPubkey.set(signPubkey, raw);
  knownVaultKeyRecordByWallet.set(raw, keyRecord);
  return raw;
}

function privateEntryPublisherWallet(entry) {
  const wallet = entry?.author_wallet ?? null;
  if (!wallet) return null;
  const vault = appConfig.vault?.address ?? null;
  if (vault && sameWalletAddress(wallet, vault)) return null;
  return wallet;
}

function privateWalletIdentityVariants(walletAddress) {
  const raw = rawWalletAddress(walletAddress);
  if (!raw) return [];
  const friendly = displayWalletAddress(raw);
  return normalizeIdentityVariants([
    { type: RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS, value: friendly, label: friendly, entered: friendly },
    { type: RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS, value: raw, label: friendly, entered: raw },
  ]);
}

function knownPrivateWalletCandidates() {
  const wallets = new Map();
  for (const thread of threads) {
    for (const identity of threadIdentityVariants(thread)) {
      if (identity.type !== RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS) continue;
      const raw = rawWalletAddress(identity.value);
      if (!raw) continue;
      if (appConfig.vault?.address && sameWalletAddress(raw, appConfig.vault.address)) continue;
      wallets.set(raw, raw);
    }
  }
  return [...wallets.values()];
}

async function resolveCurrentKnownVaultKeyRecord(walletAddress, provider, options = {}) {
  const raw = rawWalletAddress(walletAddress);
  if (!raw) return null;
  const cached = knownVaultKeyRecordByWallet.get(raw);
  if (cached && options.allowCached !== false) return cached;
  const readOptions = { vaultAddress: requireVaultAddress(), ...criticalChainReadOptions() };
  const user = await provider.getUser(raw, readOptions);
  const currentKeyId = BigInt(user.current_key_id ?? 0n);
  if (user.exists !== true || currentKeyId === 0n) return null;
  const keyRecord = await provider.getKeyRecord(currentKeyId, {
    ownerWallet: raw,
    ...readOptions,
  });
  rememberKnownVaultKeyOwner(raw, keyRecord);
  return keyRecord;
}

async function resolveVaultKeyRecordForSenderWallet(walletAddress, vaultKeyId, provider) {
  const raw = rawWalletAddress(walletAddress);
  if (!raw) return null;
  const readOptions = { vaultAddress: requireVaultAddress(), ...criticalChainReadOptions() };
  if (vaultKeyId !== null && vaultKeyId !== undefined && BigInt(vaultKeyId) > 0n) {
    const keyRecord = await provider.getKeyRecord(BigInt(vaultKeyId), {
      ownerWallet: raw,
      ...readOptions,
    });
    if (!sameWalletAddress(keyRecord?.owner_wallet, raw)) {
      throw new Error('Private sender key record owner mismatch');
    }
    rememberKnownVaultKeyOwner(raw, keyRecord);
    return keyRecord;
  }
  return resolveCurrentKnownVaultKeyRecord(raw, provider, { allowCached: false });
}

async function resolveClaimedPrivateSenderWallet(opened, provider, signPubkey) {
  const claimedWallet = rawWalletAddress(opened?.payload?.senderWallet ?? opened?.payload?.sender_wallet);
  if (!claimedWallet) return null;
  const senderVaultKeyId = opened?.payload?.senderVaultKeyId ?? opened?.payload?.sender_vault_key_id ?? null;
  try {
    const keyRecord = await resolveVaultKeyRecordForSenderWallet(claimedWallet, senderVaultKeyId, provider);
    if (keyRecord?.sign_pubkey && BigInt(keyRecord.sign_pubkey).toString() === signPubkey) {
      return rememberKnownVaultKeyOwner(claimedWallet, keyRecord);
    }
    console.warn('Private sender wallet claim did not match Vault signing key', claimedWallet);
  } catch (error) {
    if (noteTonRpcRateLimit(error)) return null;
    console.warn('Unable to verify private sender wallet claim', claimedWallet, error);
  }
  return null;
}

async function resolveKnownPrivateSenderWallet(opened, options = {}) {
  const signPubkey = senderSigningPublicKeyValue(opened);
  if (!signPubkey) return null;
  const remembered = knownVaultKeyOwnerBySignPubkey.get(signPubkey);
  const candidates = [...new Set([
    remembered,
    ...knownPrivateWalletCandidates(),
  ].filter(Boolean))];
  let resolved = null;
  try {
    resolved = await resolveVaultChainProvider();
  } catch {
    return null;
  }
  if (!resolved?.getUser || !resolved?.getKeyRecord) return null;
  if (options.allowClaimedSenderWallet !== false) {
    const claimed = await resolveClaimedPrivateSenderWallet(opened, resolved, signPubkey);
    if (claimed) return claimed;
  }
  for (const wallet of candidates) {
    try {
      const keyRecord = await resolveCurrentKnownVaultKeyRecord(wallet, resolved, { allowCached: false });
      if (keyRecord?.sign_pubkey && BigInt(keyRecord.sign_pubkey).toString() === signPubkey) {
        return rememberKnownVaultKeyOwner(wallet, keyRecord);
      }
    } catch (error) {
      if (noteTonRpcRateLimit(error)) return null;
      console.warn('Unable to match private sender wallet', wallet, error);
    }
  }
  return null;
}

async function resolvePrivateCapsuleSenderWallet(opened, entry) {
  return await resolveKnownPrivateSenderWallet(opened) ?? privateEntryPublisherWallet(entry);
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

function refreshThreadIdentityFromVariants(thread, variants) {
  if (!thread || variants.length === 0) return thread;
  const preferred = preferredInboundIdentity(variants);
  thread.identityVariants = normalizeIdentityVariants([
    preferred,
    ...(thread.identityVariants ?? []),
    ...variants,
  ]);
  if (!thread.localLabel && preferred) {
    const label = displayIdentityLabel(preferred);
    thread.identity = preferred;
    thread.name = label;
    thread.subtitle = identityTypeLabel(preferred);
    thread.avatar = String(label || 'P').slice(0, 1).toUpperCase() || thread.avatar || 'P';
  }
  return thread;
}

async function threadForChainCapsule(opened, entry) {
  const senderKeyId = opened?.capsule?.header0?.senderKeyId;
  const senderWallet = await resolvePrivateCapsuleSenderWallet(opened, entry);
  const variants = privateWalletIdentityVariants(senderWallet);
  const identityThread = findThreadByIdentityVariants(threads, variants);
  if (identityThread) return refreshThreadIdentityFromVariants(identityThread, variants);
  const created = createInboundPeerThread({
    senderKeyId,
    keyId: senderKeyId,
    label: senderWallet ? displayWalletAddress(senderWallet) : null,
    ownerWallet: senderWallet ?? null,
    identity: preferredInboundIdentity(variants),
    identityVariants: variants,
  });
  const existingById = threads.find((thread) => thread.id === created.id);
  if (existingById) return refreshThreadIdentityFromVariants(existingById, variants);
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
  const onChain = await readCurrentProfileAvatarPointerResultFromChain(owner, { required: false });
  const pointer = onChain.ok ? onChain.pointer : readStoredProfileAvatarPointer(owner);
  if (!pointer) {
    setAvatarNode(profileAvatar, 'P', null);
    return null;
  }
  const imageUrl = await loadProfileAvatarImage(owner, pointer);
  setAvatarNode(profileAvatar, 'P', imageUrl);
  return imageUrl;
}

async function readCurrentProfileAvatarPointerResultFromChain(ownerWallet, options = {}) {
  try {
    const resolved = await resolveProfileRegistryProvider();
    if (!resolved) {
      const error = new Error('ProfileRegistry provider is required to read current avatar version');
      if (options.required === false) return { ok: false, pointer: null, error };
      throw error;
    }
    const record = await resolved.provider.getAvatar(ownerWallet, {
      profileRegistryAddress: resolved.address,
      ...criticalChainReadOptions(),
    });
    const pointer = profileAvatarPointerFromRecord(record);
    if (pointer) writeStoredProfileAvatarPointer(pointer, ownerWallet);
    else writeStoredProfileAvatarPointer(null, ownerWallet);
    return { ok: true, pointer, record };
  } catch (error) {
    if (options.required === false) {
      if (!noteTonRpcRateLimit(error)) console.error(error);
      return { ok: false, pointer: null, error };
    }
    throw error;
  }
}

async function readCurrentProfileAvatarPointerFromChain(ownerWallet, options = {}) {
  const result = await readCurrentProfileAvatarPointerResultFromChain(ownerWallet, options);
  return result.pointer;
}

function privateEntryIdValue(entry) {
  const value = entry?.entry_id ?? entry?.entryId;
  if (value === null || value === undefined) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function privateEntryIdText(entry) {
  const value = privateEntryIdValue(entry);
  return value === null ? null : value.toString();
}

function privateEntryCreatedAtMs(entry) {
  const value = entry?.created_at ?? entry?.createdAt;
  if (value === null || value === undefined) return null;
  try {
    const ms = Number(BigInt(value) * 1000n);
    return Number.isFinite(ms) && ms > 0 ? ms : null;
  } catch {
    return null;
  }
}

function messageCreatedAtMs(message) {
  const direct = Number(message?.createdAtMs);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const local = Number(message?.localCreatedAtMs ?? message?.localHistoryCreatedAt);
  if (Number.isFinite(local) && local > 0) return local;
  const parsed = Date.parse(message?.createdAt ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function privateChainMessageOrderFields(entry) {
  const chainEntryId = privateEntryIdText(entry);
  const createdAtMs = privateEntryCreatedAtMs(entry);
  const fields = {};
  if (chainEntryId !== null) fields.chainEntryId = chainEntryId;
  if (createdAtMs !== null) {
    fields.createdAtMs = createdAtMs;
    fields.createdAt = new Date(createdAtMs).toISOString();
  }
  return fields;
}

function localMessageOrderFields(createdAtMs = Date.now()) {
  return {
    createdAtMs,
    createdAt: new Date(createdAtMs).toISOString(),
    localCreatedAtMs: createdAtMs,
  };
}

function ensureMessageOrderFields(message, fallbackMs = Date.now()) {
  if (!message) return;
  if (messageCreatedAtMs(message) !== null) return;
  Object.assign(message, localMessageOrderFields(fallbackMs));
}

function compareMessageOrder(a, b) {
  const timeA = messageCreatedAtMs(a.message);
  const timeB = messageCreatedAtMs(b.message);
  if (timeA !== null && timeB !== null && timeA !== timeB) return timeA - timeB;
  const entryA = privateEntryIdValue({ entry_id: a.message?.chainEntryId });
  const entryB = privateEntryIdValue({ entry_id: b.message?.chainEntryId });
  if (entryA !== null && entryB !== null && entryA !== entryB) return entryA < entryB ? -1 : 1;
  return a.index - b.index;
}

function sortThreadMessages(thread) {
  if (!Array.isArray(thread?.messages) || thread.messages.length < 2) return;
  thread.messages = thread.messages
    .map((message, index) => ({ message, index }))
    .sort(compareMessageOrder)
    .map((item) => item.message);
}

function insertThreadMessage(thread, message) {
  if (!thread) return;
  if (!Array.isArray(thread.messages)) thread.messages = [];
  thread.messages.push(message);
  sortThreadMessages(thread);
}

function messageFromOpenedCapsule(opened, meta, entry) {
  const payment = paymentFromCompactPayload(opened.payload);
  const isImage = opened.payload?.type === 'image';
  const text = payment ? paymentMessageText(payment) : (isImage ? '' : opened.plaintext);
  const message = {
    type: 'in',
    text,
    meta,
    ...privateChainMessageOrderFields(entry),
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

function privateChainMessageMeta(entry, parts = 1) {
  return parts > 1 ? `received (${parts} parts)` : 'received';
}

function privatePartKey(opened, entry) {
  const streamId = opened?.payload?.stream_id ?? 'single';
  const sender = rawWalletAddress(opened?.payload?.senderWallet ?? opened?.payload?.sender_wallet)
    ?? privateEntryPublisherWallet(entry)
    ?? opened?.capsule?.header0?.senderKeyId
    ?? 'unknown';
  return `${sender}:${streamId}`;
}

function messageFromOpenedPrivateParts(parts, meta) {
  const ordered = [...parts].sort((a, b) => (
    Number(a.opened?.payload?.partIndex ?? 0) - Number(b.opened?.payload?.partIndex ?? 0)
  ));
  const orderedByChain = [...parts].sort((a, b) => {
    const entryA = privateEntryIdValue(a.entry ?? { entry_id: a.entryId });
    const entryB = privateEntryIdValue(b.entry ?? { entry_id: b.entryId });
    if (entryA === null || entryB === null || entryA === entryB) return 0;
    return entryA < entryB ? -1 : 1;
  });
  const first = ordered[0]?.opened;
  const firstEntry = orderedByChain[0]?.entry;
  const lastEntry = orderedByChain[orderedByChain.length - 1]?.entry;
  const chainLastEntryId = privateEntryIdText(lastEntry);
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
    ...privateChainMessageOrderFields(firstEntry),
    capsule: first?.capsule,
    capsules: ordered.map((part) => part.opened?.capsule).filter(Boolean),
    profileVersion: first?.capsule?.header0?.profileVersion ?? 0,
    avatarHash: first?.capsule?.header0?.avatarHash ?? zeroAvatarHashHex(),
  };
  if (chainLastEntryId && chainLastEntryId !== message.chainEntryId) {
    message.chainLastEntryId = chainLastEntryId;
  }
  if (imageBytes) {
    message.attachment = {
      type: 'image',
      url: bytesToImageDataUrl(imageBytes, 'image/webp'),
      bytes: imageBytes.length,
    };
  }
  return message;
}

function refreshThreadAfterMessageChange(thread) {
  if (!thread) return;
  sortThreadMessages(thread);
  const last = thread.messages?.[thread.messages.length - 1] ?? null;
  const status = messageStatusKey(last);
  thread.preview = last ? (last.text || (last.attachment ? 'Image' : '')) : 'No messages yet';
  thread.time = last ? (status === 'sending' ? 'sending' : 'now') : 'new';
  thread.state = status === 'failed'
    ? 'blocked'
    : status === 'sending'
      ? 'sending'
      : last?.capsule
        ? 'sealed'
        : (last ? 'local' : 'route');
}

function threadUnreadCount(thread) {
  const count = Number(thread?.unreadCount ?? 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function isThreadConversationVisible(thread) {
  return Boolean(
    thread
      && thread.id === activeThreadId
      && isChatsViewActive()
      && appShell?.dataset?.chatOpen === 'true'
      && !document.hidden,
  );
}

function markThreadRead(thread) {
  if (!thread || threadUnreadCount(thread) === 0) return false;
  thread.unreadCount = 0;
  return true;
}

function markIncomingThreadMessage(thread) {
  if (!thread || isThreadConversationVisible(thread)) return;
  thread.unreadCount = threadUnreadCount(thread) + 1;
}

function messageMetaText(message) {
  const text = String(message?.meta ?? '').trim();
  if (!text) return '';
  if (/chain #\d+/i.test(text)) return text.includes('parts') ? 'received parts' : 'received';
  if (/local capsule/i.test(text)) return 'sending';
  return text;
}

function messageStatusKey(message) {
  const text = messageMetaText(message).toLowerCase();
  if (text.includes('sending') || text.includes('submitted') || text.includes('confirming') || text.includes('retrying')) return 'sending';
  if (text.includes('failed') || text.includes('blocked') || text.includes('partial')) return 'failed';
  if (text.includes('published') || text.includes('sent')) return 'sent';
  if (text.includes('received')) return 'received';
  return 'info';
}

function relocateExistingCapsuleMessage(existing, targetThread) {
  if (!existing?.thread || !existing?.message || !targetThread || existing.thread === targetThread) return false;
  existing.thread.messages = (existing.thread.messages ?? []).filter((message) => message !== existing.message);
  if (!(targetThread.messages ?? []).includes(existing.message)) {
    insertThreadMessage(targetThread, existing.message);
  }
  refreshThreadAfterMessageChange(existing.thread);
  refreshThreadAfterMessageChange(targetThread);
  return true;
}

async function appendOpenedCapsuleMessage(opened, targetThread, meta, entry) {
  const existing = findMessageByCapsuleId(opened.capsule?.id);
  if (existing) return relocateExistingCapsuleMessage(existing, targetThread);
  const message = messageFromOpenedCapsule(opened, meta, entry);
  insertThreadMessage(targetThread, message);
  refreshThreadAfterMessageChange(targetThread);
  markIncomingThreadMessage(targetThread);
  await persistMessageToEncryptedHistory(targetThread, message);
  hydrateThreadAvatarFromPointer(
    targetThread,
    ownerWalletFromThread(targetThread),
    avatarPointerFromPrivateHeader(opened.capsule?.header0),
  ).catch((error) => console.error(error));
  return true;
}

async function appendOpenedPrivatePartsMessage(parts, targetThread, meta) {
  const existing = parts.map((part) => findMessageByCapsuleId(part.opened?.capsule?.id)).find(Boolean);
  if (existing) return relocateExistingCapsuleMessage(existing, targetThread);
  const message = messageFromOpenedPrivateParts(parts, meta);
  insertThreadMessage(targetThread, message);
  refreshThreadAfterMessageChange(targetThread);
  markIncomingThreadMessage(targetThread);
  await persistMessageToEncryptedHistory(targetThread, message);
  const firstOpened = parts[0]?.opened;
  hydrateThreadAvatarFromPointer(
    targetThread,
    ownerWalletFromThread(targetThread),
    avatarPointerFromPrivateHeader(firstOpened?.capsule?.header0),
  ).catch((error) => console.error(error));
  return true;
}

function isBodyHistoryUnavailableError(error) {
  return isCapsuleHubBodyHistoryUnavailable(error)
    || String(error?.code ?? '') === 'BODY_HISTORY_UNAVAILABLE'
    || /body was not found in message history|cannot read CapsuleHub message history/i.test(String(error?.message ?? error ?? ''));
}

function privateSyncResult(fields = {}) {
  return {
    ok: fields.ok !== false,
    imported: Number(fields.imported ?? 0),
    skipped: Number(fields.skipped ?? 0),
    scanComplete: fields.scanComplete === true,
    reason: fields.reason ?? null,
    blockedEntryId: fields.blockedEntryId ?? null,
    catchUpRemaining: fields.catchUpRemaining ?? 0,
    historyUnavailableCount: Number(fields.historyUnavailableCount ?? 0),
    historyUnavailableEntries: Array.isArray(fields.historyUnavailableEntries) ? fields.historyUnavailableEntries : [],
    rateLimited: fields.rateLimited === true,
    unchanged: fields.unchanged === true,
  };
}

function privateSyncImported(result) {
  if (typeof result === 'boolean') return result;
  return Number(result?.imported ?? 0) > 0;
}

function privateSyncStatusText(result) {
  if (typeof result === 'boolean') return result ? 'new messages' : 'up to date';
  if (!result) return 'up to date';
  if (result.rateLimited) return 'sync delayed';
  if (Number(result.historyUnavailableCount ?? 0) > 0) {
    return result.imported > 0 ? 'new messages, history gaps' : `history gaps ${result.historyUnavailableCount}`;
  }
  if (result.reason === 'body_history_unavailable') {
    return result.blockedEntryId ? `history unavailable #${result.blockedEntryId}` : 'history unavailable';
  }
  if (result.reason === 'catch_up_pending') {
    return result.imported > 0 ? 'new messages, catch-up pending' : `catch-up ${result.catchUpRemaining ?? 0} left`;
  }
  if (result.reason === 'partial_private_stream') return 'partial stream pending';
  if (result.ok === false || result.scanComplete === false) return 'sync incomplete';
  return result.imported > 0 ? 'new messages' : 'up to date';
}

async function syncPrivateCapsulesFromChain(options = {}) {
  if (!localRecipientKeyPair) return privateSyncResult({ ok: false, reason: 'not_ready', scanComplete: false });
  const resolved = await resolveCapsuleHubProvider();
  if (!resolved) return privateSyncResult({ ok: false, reason: 'provider_unavailable', scanComplete: false });
  const { provider, address } = resolved;
  const readOptions = criticalCapsuleHubReadOptions(address);
  const state = await provider.getState(readOptions);
  const latest = BigInt(state.private_latest_id ?? 0n);
  const storedCursor = readPrivateChainScanCursor(address);
  const pendingHistoryUnavailable = readPrivateBodyHistoryUnavailable(address);
  if (storedCursor !== null && options.forceRecentRescan !== true && latest <= storedCursor && pendingHistoryUnavailable.length === 0) {
    globalThis.plathoLastPrivateSync = {
      capsuleHub: address,
      keyId: localRecipientKeyPair?.keyId ?? null,
      start: latest.toString(),
      latest: latest.toString(),
      imported: 0,
      skipped: 0,
      scanComplete: true,
      rateLimited: false,
      forced: false,
      unchanged: true,
    };
    refreshMessagingControls();
    return privateSyncResult({ scanComplete: true, unchanged: true });
  }
  if (latest <= 0n) {
    writePrivateChainScanCursor(address, latest);
    return privateSyncResult({ scanComplete: true });
  }
  const limit = Math.max(1, Number(appConfig.capsuleHub?.privateReadLimit ?? PRIVATE_CHAIN_READ_LIMIT));
  const configuredOverlap = Number(options.rescanOverlap ?? appConfig.capsuleHub?.privateRescanOverlap ?? PRIVATE_CHAIN_RESCAN_OVERLAP);
  const overlap = Number.isFinite(configuredOverlap) ? Math.max(0, Math.floor(configuredOverlap)) : PRIVATE_CHAIN_RESCAN_OVERLAP;
  let start = storedCursor === null ? 0n : storedCursor;
  if (options.forceRecentRescan === true && storedCursor !== null) start = storedCursor - BigInt(overlap);
  if (start < 0n) start = 0n;
  if (start > latest) start = latest;
  const scanEnd = start + BigInt(limit) < latest ? start + BigInt(limit) : latest;
  const linearEntryIds = [];
  for (let entryId = start; entryId < scanEnd; entryId += 1n) linearEntryIds.push(entryId);
  const retryEntryIds = privateBodyHistoryRetryEntryIds(address, latest, start, scanEnd);
  const entryIdsToScan = [...new Set([...retryEntryIds, ...linearEntryIds].map((entryId) => entryId.toString()))]
    .map((entryId) => BigInt(entryId))
    .sort((a, b) => (a < b ? -1 : (a > b ? 1 : 0)));

  let imported = 0;
  let skipped = 0;
  let scanComplete = true;
  let rateLimitError = null;
  let bodyHistoryError = null;
  let blockedEntryId = null;
  const historyUnavailableEntries = [];
  let partialPrivateStream = false;
  const privatePartGroups = new Map();
  for (const entryId of entryIdsToScan) {
    let entry = null;
    try {
      entry = await provider.getPrivateEntry(entryId, readOptions);
      if (entry.exists !== true) {
        clearPrivateBodyHistoryUnavailable(address, entryId);
        continue;
      }
      entry = await resolvePrivateEntryBody(provider, entry, address);
      clearPrivateBodyHistoryUnavailable(address, entryId);
      const opened = await openPrivateCapsuleChainEntry(entry, localRecipientKeyPair, {
        now: Date.now(),
      });
      const targetThread = await threadForChainCapsule(opened, entry);
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
          privateChainMessageMeta(entry),
          entry,
        );
        if (added) imported += 1;
      }
    } catch (error) {
      const message = String(error?.message ?? error);
      if (noteTonRpcRateLimit(error)) {
        rateLimitError = error;
        scanComplete = false;
        break;
      } else if (isBodyHistoryUnavailableError(error)) {
        bodyHistoryError = error;
        blockedEntryId = entryId;
        historyUnavailableEntries.push({
          entryId: entryId.toString(),
          bodyHash: entryBodyHashHex(entry),
        });
        rememberPrivateBodyHistoryUnavailable(address, entry, entryId);
        skipped += 1;
        continue;
      } else if (/recipient|decrypt|key mismatch|expired|operation-specific/i.test(message)) {
        clearPrivateBodyHistoryUnavailable(address, entryId);
        skipped += 1;
      } else {
        console.error(error);
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
      partialPrivateStream = true;
      continue;
    }
    const ordered = [...uniqueParts.values()].sort((a, b) => {
      const entryA = privateEntryIdValue({ entry_id: a.entryId });
      const entryB = privateEntryIdValue({ entry_id: b.entryId });
      if (entryA === null || entryB === null || entryA === entryB) return 0;
      return entryA < entryB ? -1 : 1;
    });
    const firstEntry = ordered[0]?.entry;
    const firstOpened = ordered[0]?.opened;
    const added = await appendOpenedPrivatePartsMessage(
      ordered,
      group.targetThread,
      privateChainMessageMeta(firstEntry, ordered.length),
    );
    if (added) imported += 1;
  }
  const catchUpRemaining = scanEnd < latest ? Number(latest - scanEnd) : 0;
  if (scanComplete) {
    const previousCursor = storedCursor ?? 0n;
    const nextCursor = scanEnd > previousCursor ? scanEnd : previousCursor;
    writePrivateChainScanCursor(address, nextCursor);
  }
  const reason = bodyHistoryError
    ? 'body_history_unavailable'
    : (partialPrivateStream
      ? 'partial_private_stream'
      : (scanComplete && scanEnd < latest ? 'catch_up_pending' : null));
  globalThis.plathoLastPrivateSync = {
    capsuleHub: address,
    keyId: localRecipientKeyPair?.keyId ?? null,
    start: start.toString(),
    scanEnd: scanEnd.toString(),
    latest: latest.toString(),
    imported,
    skipped,
    scanComplete: scanComplete && scanEnd >= latest,
    pageComplete: scanComplete,
    rateLimited: rateLimitError !== null,
    bodyHistoryUnavailable: bodyHistoryError !== null,
    blockedEntryId: blockedEntryId?.toString?.() ?? null,
    historyUnavailableCount: historyUnavailableEntries.length,
    historyUnavailableEntries,
    catchUpRemaining,
    reason,
    forced: options.forceRecentRescan === true,
  };
  const result = privateSyncResult({
    imported,
    skipped,
    scanComplete: scanComplete && scanEnd >= latest,
    reason,
    blockedEntryId: blockedEntryId?.toString?.() ?? null,
    historyUnavailableCount: historyUnavailableEntries.length,
    historyUnavailableEntries,
    catchUpRemaining,
    rateLimited: rateLimitError !== null,
    ok: scanComplete,
  });
  if (imported > 0) {
    refreshMessagingControls();
    renderThreads();
    renderConversation();
    return result;
  }
  if (!scanComplete) {
    refreshMessagingControls();
    if (rateLimitError) throw rateLimitError;
    return result;
  }
  refreshMessagingControls();
  return result;
}

async function syncPrivateCapsulesFromChainOnce(options = {}) {
  if (privateChainSyncPromise) return privateChainSyncPromise;
  privateChainSyncPromise = syncPrivateCapsulesFromChain(options);
  try {
    return await privateChainSyncPromise;
  } finally {
    privateChainSyncPromise = null;
  }
}

function isChatsViewActive() {
  return appShell?.dataset?.view === 'chats';
}

function isPublicViewActive() {
  return appShell?.dataset?.view === 'public';
}

function clearMessageAutoSyncTimer() {
  if (messageAutoSyncTimer) {
    window.clearTimeout(messageAutoSyncTimer);
    messageAutoSyncTimer = null;
  }
  messageAutoSyncAt = 0;
  messageAutoSyncPhase = 'idle';
  clearMessageAutoSyncCountdownTimer();
  refreshConversationSubtitle();
}

function scheduleMessageAutoSync(delayMs = MESSAGE_AUTO_SYNC_MS) {
  clearMessageAutoSyncTimer();
  if (!isChatsViewActive() || !plathoWallet || !localRecipientKeyPair || document.hidden) return;
  const effectiveDelayMs = Math.max(1_000, Number(delayMs) || MESSAGE_AUTO_SYNC_MS);
  messageAutoSyncPhase = messageAutoSyncLastErrorLabel ? 'delayed' : (messageAutoSyncLastResult ? 'synced' : 'scheduled');
  messageAutoSyncAt = Date.now() + effectiveDelayMs;
  scheduleMessageAutoSyncCountdownUi();
  messageAutoSyncTimer = window.setTimeout(async () => {
    messageAutoSyncTimer = null;
    messageAutoSyncAt = 0;
    beginMessageSyncUi();
    try {
      const result = await syncPrivateCapsulesFromChainOnce();
      completeMessageSyncUi(result);
      if (privateSyncImported(result)) {
        setText(messageSyncStatus, 'new messages');
      } else if (messageSyncStatus?.textContent === 'syncing') {
        setText(messageSyncStatus, privateSyncStatusText(result));
      }
    } catch (error) {
      const rateLimited = noteTonRpcRateLimit(error);
      const label = rateLimited ? 'Sync delayed' : 'Sync failed';
      failMessageSyncUi(label);
      setText(messageSyncStatus, rateLimited ? 'sync delayed' : 'sync failed');
      if (!rateLimited) console.error(error);
    } finally {
      scheduleMessageAutoSync();
    }
  }, effectiveDelayMs);
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
  const limit = encryptedMessageStore.maxRecords ? `last ${encryptedMessageStore.maxRecords}` : 'local';
  return encryptedMessageStore.persistent === false ? `encrypted memory (${limit})` : `encrypted db (${limit})`;
}

function serializeMessageForHistory(message) {
  return {
    type: message.type,
    text: message.text,
    meta: message.meta,
    createdAt: message.createdAt ?? null,
    createdAtMs: messageCreatedAtMs(message),
    chainEntryId: message.chainEntryId ?? null,
    chainLastEntryId: message.chainLastEntryId ?? null,
    localCreatedAtMs: message.localCreatedAtMs ?? null,
    localHistoryCreatedAt: message.localHistoryCreatedAt ?? null,
    payment: message.payment ?? null,
    capsule: message.capsule ?? null,
    capsules: message.capsules ?? null,
    publishState: message.publishState ?? null,
    attachment: message.attachment ?? null,
    profileVersion: message.profileVersion ?? 0,
    avatarHash: message.avatarHash ?? zeroAvatarHashHex(),
  };
}

function safeJsonClone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function serializeThreadForHistory(thread) {
  if (!thread?.id) return null;
  return safeJsonClone({
    id: thread.id,
    name: thread.name ?? null,
    subtitle: thread.subtitle ?? null,
    avatar: thread.avatar ?? null,
    state: thread.state ?? null,
    preview: thread.preview ?? null,
    identity: thread.identity ?? null,
    displayIdentity: thread.displayIdentity ?? null,
    identityVariants: threadIdentityVariants(thread),
    localLabel: thread.localLabel ?? null,
    avatarImageUrl: thread.avatarImageUrl ?? null,
  });
}

function peerLabelFromThreadId(threadId, message = null) {
  const idText = String(threadId ?? '');
  if (idText.startsWith('peer:')) {
    try {
      const decoded = decodeURIComponent(idText.slice(5));
      return `Anonymous ${shortPeerId(decoded)}`;
    } catch {
      return 'Anonymous';
    }
  }
  const senderKeyId = message?.capsule?.header0?.senderKeyId;
  if (senderKeyId) return `Anonymous ${shortKeyId(senderKeyId)}`;
  return 'Anonymous';
}

function applyHistoryThreadSnapshot(thread, snapshot) {
  if (!thread || !snapshot || typeof snapshot !== 'object') return thread;
  const variants = normalizeIdentityVariants([
    snapshot.identity,
    snapshot.displayIdentity,
    ...(snapshot.identityVariants ?? []),
  ]);
  if (variants.length > 0) {
    thread.identityVariants = normalizeIdentityVariants([
      ...(thread.identityVariants ?? []),
      ...variants,
    ]);
    thread.identity = thread.identity ?? preferredInboundIdentity(thread.identityVariants);
  }
  if (!thread.localLabel && snapshot.name && snapshot.name !== 'Imported') thread.name = snapshot.name;
  if (snapshot.subtitle && snapshot.subtitle !== 'local encrypted history') thread.subtitle = snapshot.subtitle;
  if (snapshot.avatar) thread.avatar = snapshot.avatar;
  if (snapshot.avatarImageUrl) thread.avatarImageUrl = snapshot.avatarImageUrl;
  if (snapshot.displayIdentity) thread.displayIdentity = snapshot.displayIdentity;
  if (snapshot.localLabel) thread.localLabel = snapshot.localLabel;
  return thread;
}

function ensureHistoryThread(threadId, snapshot = null, message = null) {
  let thread = threads.find((item) => item.id === threadId);
  if (thread) return applyHistoryThreadSnapshot(thread, snapshot);
  const restoredName = snapshot?.name && snapshot.name !== 'Imported'
    ? snapshot.name
    : peerLabelFromThreadId(threadId, message);
  thread = {
    id: threadId,
    name: restoredName,
    subtitle: snapshot?.subtitle && snapshot.subtitle !== 'local encrypted history' ? snapshot.subtitle : 'Encrypted history',
    avatar: snapshot?.avatar ?? 'P',
    preview: 'encrypted local history',
    state: 'sealed',
    time: 'local',
    messages: [],
  };
  applyHistoryThreadSnapshot(thread, snapshot);
  threads.push(thread);
  return thread;
}

async function persistMessageToEncryptedHistory(thread, message) {
  if (!encryptedMessageStore || message.localHistoryId) return null;
  return writeMessageToEncryptedHistory(thread, message);
}

async function writeMessageToEncryptedHistory(thread, message) {
  if (!encryptedMessageStore || !thread || !message) return null;
  ensureMessageOrderFields(message);
  try {
    const createdAt = messageCreatedAtMs(message) ?? Date.now();
    const stored = await encryptedMessageStore.putMessage({
      id: message.localHistoryId ?? undefined,
      threadId: thread.id,
      thread: serializeThreadForHistory(thread),
      message: serializeMessageForHistory(message),
      createdAt: message.localHistoryCreatedAt ?? createdAt,
    });
    message.localHistoryId = stored.id;
    message.localHistoryCreatedAt = stored.createdAt;
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
      const thread = ensureHistoryThread(item.threadId, item.thread, item.message);
      if (thread.messages.some((message) => message.localHistoryId === item.id)) continue;
      const message = {
        ...item.message,
        localHistoryId: item.id,
        localHistoryCreatedAt: item.createdAt,
      };
      ensureMessageOrderFields(message, item.createdAt);
      insertThreadMessage(thread, message);
      refreshThreadAfterMessageChange(thread);
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

function shortPeerId(value) {
  return String(value ?? '').replace(/[^a-z0-9_-]/gi, '').slice(0, 8) || 'unknown';
}

function normalizeCryptoSuite(value) {
  return CRYPTO_SUITES.HYBRID_V1;
}

function currentOutgoingPrivateSuite() {
  return CRYPTO_SUITES.HYBRID_V1;
}

function walletStorageCrypto() {
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.subtle || typeof webCrypto.getRandomValues !== 'function') {
    throw new Error('Secure wallet storage requires WebCrypto');
  }
  return webCrypto;
}

function randomStorageBytes(length) {
  const bytes = new Uint8Array(length);
  walletStorageCrypto().getRandomValues(bytes);
  return bytes;
}

function walletBytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function walletBase64ToBytes(text) {
  const binary = atob(String(text ?? ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function normalizeWalletPasswordInput(value) {
  return String(value ?? '').trim();
}

async function deriveWalletStorageKey(password, saltBytes, iterations = PLATHO_WALLET_KDF_ITERATIONS) {
  const subtle = walletStorageCrypto().subtle;
  const material = await subtle.importKey(
    'raw',
    new TextEncoder().encode(String(password ?? '')),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBytes,
      iterations,
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function readEncryptedPlathoWalletRecord() {
  try {
    const raw = localStorageOrNull()?.getItem(PLATHO_WALLET_STORAGE_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    return record?.kind === PLATHO_WALLET_STORAGE_KIND ? record : null;
  } catch {
    return null;
  }
}

async function updateMessageInEncryptedHistory(thread, message) {
  if (!encryptedMessageStore) return null;
  return writeMessageToEncryptedHistory(thread, message);
}

function readLegacyPlaintextPlathoWalletRecord() {
  try {
    const raw = localStorageOrNull()?.getItem(PLATHO_WALLET_LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    return record?.kind === PLATHO_WALLET_LEGACY_STORAGE_KIND && typeof record.recoveryPhrase === 'string'
      ? record
      : null;
  } catch {
    return null;
  }
}

function hasStoredPlathoWalletRecord() {
  return Boolean(readEncryptedPlathoWalletRecord() || readLegacyPlaintextPlathoWalletRecord());
}

function storedWalletShortLabel() {
  const record = storedPlathoWalletRecord();
  const address = storedWalletAddressForCopy(record);
  return address ? shortAddress(address) : 'encrypted';
}

function storedWalletLockStatus() {
  if (plathoWallet) return 'unlocked';
  if (readEncryptedPlathoWalletRecord()) return 'encrypted';
  if (readLegacyPlaintextPlathoWalletRecord()) return 'secure now';
  return 'not stored';
}

function walletPasswordManagerUsername(address = '', networkGlobalId = plathoWalletNetworkOptions().networkGlobalId) {
  const value = String(address ?? '').trim();
  if (!value) return PLATHO_WALLET_PASSWORD_MANAGER_USERNAME;
  try {
    return formatTonUserFriendlyAddress(value, {
      bounceable: false,
      testOnly: Number(networkGlobalId) === PLATHO_WALLET_NETWORK_GLOBAL_IDS.TESTNET,
    });
  } catch {
    return value;
  }
}

async function encryptPlathoWalletRecord(wallet, password) {
  const normalizedPassword = normalizeWalletPasswordInput(password);
  if (!normalizedPassword) throw new Error('Local wallet password is required');
  const salt = randomStorageBytes(16);
  const iv = randomStorageBytes(12);
  const key = await deriveWalletStorageKey(normalizedPassword, salt);
  const payload = {
    kind: PLATHO_WALLET_ENCRYPTED_PAYLOAD_KIND,
    version: 1,
    recoveryPhrase: exportPlathoWalletRecoveryPhrase(wallet),
    address: wallet.address,
    walletKind: wallet.kind,
    networkGlobalId: wallet.networkGlobalId,
  };
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(await walletStorageCrypto().subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
  return {
    kind: PLATHO_WALLET_STORAGE_KIND,
    version: 1,
    kdf: PLATHO_WALLET_KDF_NAME,
    iterations: PLATHO_WALLET_KDF_ITERATIONS,
    salt: walletBytesToBase64(salt),
    cipher: PLATHO_WALLET_CIPHER_NAME,
    iv: walletBytesToBase64(iv),
    ciphertext: walletBytesToBase64(ciphertext),
    address: wallet.address,
    walletKind: wallet.kind,
    networkGlobalId: wallet.networkGlobalId,
    createdAt: Date.now(),
  };
}

async function decryptPlathoWalletRecord(record, password) {
  if (!record || record.kind !== PLATHO_WALLET_STORAGE_KIND) throw new Error('Encrypted wallet record is missing');
  const salt = walletBase64ToBytes(record.salt);
  const iv = walletBase64ToBytes(record.iv);
  const ciphertext = walletBase64ToBytes(record.ciphertext);
  const rawPassword = String(password ?? '');
  const normalizedPassword = normalizeWalletPasswordInput(rawPassword);
  let plaintextBytes;
  try {
    const key = await deriveWalletStorageKey(rawPassword, salt, Number(record.iterations ?? PLATHO_WALLET_KDF_ITERATIONS));
    plaintextBytes = await walletStorageCrypto().subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  } catch (error) {
    if (!normalizedPassword || normalizedPassword === rawPassword) throw error;
    const key = await deriveWalletStorageKey(normalizedPassword, salt, Number(record.iterations ?? PLATHO_WALLET_KDF_ITERATIONS));
    plaintextBytes = await walletStorageCrypto().subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  }
  const payload = JSON.parse(new TextDecoder().decode(plaintextBytes));
  if (payload?.kind !== PLATHO_WALLET_ENCRYPTED_PAYLOAD_KIND || typeof payload.recoveryPhrase !== 'string') {
    throw new Error('Encrypted wallet payload is invalid');
  }
  const storedNetworkGlobalId = Number.isInteger(Number(payload.networkGlobalId))
    ? Number(payload.networkGlobalId)
    : Number.isInteger(Number(record.networkGlobalId))
    ? Number(record.networkGlobalId)
    : plathoWalletNetworkOptions().networkGlobalId;
  const wallet = await importPlathoWallet(payload.recoveryPhrase, { networkGlobalId: storedNetworkGlobalId });
  if (record.address && !sameWalletAddress(wallet.address, record.address)) {
    const error = new Error('Encrypted wallet password is correct, but address metadata does not match');
    error.code = 'PLATHO_WALLET_ADDRESS_METADATA_MISMATCH';
    throw error;
  }
  return wallet;
}

async function requestWalletPasswordInput({
  title,
  hint,
  submitLabel,
  confirm = false,
  create = false,
  passwordManagerUsername = PLATHO_WALLET_PASSWORD_MANAGER_USERNAME,
  passwordManagerNetworkGlobalId = plathoWalletNetworkOptions().networkGlobalId,
  summary = [],
  tone = 'muted',
}) {
  const fields = [{
    id: 'walletPasswordManagerUsername',
    name: 'username',
    type: 'credential-username',
    autocomplete: 'username',
    value: walletPasswordManagerUsername(passwordManagerUsername, passwordManagerNetworkGlobalId),
    required: false,
  }, {
    id: 'walletPassword',
    label: 'Local password',
    type: 'password',
    autocomplete: create ? 'new-password' : 'current-password',
    placeholder: 'Local wallet password',
    autocapitalize: 'none',
    spellcheck: false,
    minLength: create ? PLATHO_WALLET_PASSWORD_MIN_LENGTH : undefined,
  }];
  if (confirm) {
    fields.push({
      id: 'walletPasswordConfirm',
      label: 'Repeat password',
      type: 'password',
      autocomplete: 'new-password',
      placeholder: 'Repeat local wallet password',
      autocapitalize: 'none',
      spellcheck: false,
      minLength: PLATHO_WALLET_PASSWORD_MIN_LENGTH,
    });
  }
  const result = await openActionDialog({
    title,
    hint,
    tone,
    submitLabel,
    dismissOnBackdrop: false,
    formAutocomplete: 'on',
    fields,
    summary,
  });
  if (!result) return null;
  return {
    password: String(result.walletPassword ?? ''),
    confirmPassword: String(result.walletPasswordConfirm ?? ''),
  };
}

async function requestNewWalletStoragePassword(title = 'Encrypt local wallet', {
  passwordManagerUsername = PLATHO_WALLET_PASSWORD_MANAGER_USERNAME,
  passwordManagerNetworkGlobalId = plathoWalletNetworkOptions().networkGlobalId,
} = {}) {
  let hint = `Set a local password. Minimum ${PLATHO_WALLET_PASSWORD_MIN_LENGTH} characters; ${PLATHO_WALLET_PASSWORD_RECOMMENDED_LENGTH}+ is recommended.`;
  let tone = 'muted';
  while (true) {
    const result = await requestWalletPasswordInput({
      title,
      hint,
      tone,
      submitLabel: 'Encrypt wallet',
      confirm: true,
      create: true,
      passwordManagerUsername,
      passwordManagerNetworkGlobalId,
      summary: [
        'The password is not sent to Platho and cannot be recovered.',
        `Use your browser password manager. Minimum ${PLATHO_WALLET_PASSWORD_MIN_LENGTH} characters, recommended ${PLATHO_WALLET_PASSWORD_RECOMMENDED_LENGTH}+.`,
        'The recovery phrase is stored only as encrypted WebCrypto data.',
      ],
    });
    if (!result) return null;
    const password = normalizeWalletPasswordInput(result.password);
    const confirmPassword = normalizeWalletPasswordInput(result.confirmPassword);
    if (password.length < PLATHO_WALLET_PASSWORD_MIN_LENGTH) {
      hint = `Password must be at least ${PLATHO_WALLET_PASSWORD_MIN_LENGTH} characters.`;
      tone = 'error';
      continue;
    }
    if (password !== confirmPassword) {
      hint = 'Passwords do not match.';
      tone = 'error';
      continue;
    }
    return password;
  }
}

async function requestAndDecryptEncryptedWallet(record, {
  title = 'Unlock wallet',
  hint = 'Enter the local password for this encrypted wallet.',
  submitLabel = 'Unlock wallet',
} = {}) {
  let feedback = hint;
  let tone = 'muted';
  while (true) {
    const result = await requestWalletPasswordInput({
      title,
      hint: feedback,
      tone,
      submitLabel,
      passwordManagerUsername: record?.address,
      passwordManagerNetworkGlobalId: record?.networkGlobalId,
      summary: [
        { label: 'Stored wallet', value: record?.address ? shortAddress(record.address) : 'encrypted' },
        { label: 'Storage', value: `${record?.cipher ?? PLATHO_WALLET_CIPHER_NAME} + ${record?.kdf ?? PLATHO_WALLET_KDF_NAME}` },
      ],
    });
    if (!result) return null;
    try {
      return await decryptPlathoWalletRecord(record, result.password);
    } catch (error) {
      console.error(error);
      feedback = error?.code === 'PLATHO_WALLET_ADDRESS_METADATA_MISMATCH'
        ? 'Password accepted, but stored wallet metadata is inconsistent. Export/import recovery phrase if you still have it.'
        : 'Wrong password or damaged encrypted wallet data.';
      tone = 'error';
    }
  }
}

async function readStoredPlathoWallet() {
  try {
    const encryptedRecord = readEncryptedPlathoWalletRecord();
    if (encryptedRecord) {
      return requestAndDecryptEncryptedWallet(encryptedRecord);
    }
    const legacyRecord = readLegacyPlaintextPlathoWalletRecord();
    if (!legacyRecord) return null;
    const wallet = await importPlathoWallet(legacyRecord.recoveryPhrase, plathoWalletNetworkOptions());
    const password = await requestNewWalletStoragePassword('Secure existing wallet', {
      passwordManagerUsername: wallet.address,
      passwordManagerNetworkGlobalId: wallet.networkGlobalId,
    });
    if (!password) return null;
    await writeStoredPlathoWallet(wallet, password);
    return wallet;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function promptStoredWalletUnlockOnStartup() {
  if (plathoWallet || walletUnlockPromise || !hasStoredPlathoWalletRecord()) return;
  armWalletUnlockPrompt();
}

async function writeStoredPlathoWallet(wallet, password) {
  if (!password) throw new Error('Local wallet password is required');
  const record = await encryptPlathoWalletRecord(wallet, password);
  const verificationWallet = await decryptPlathoWalletRecord(record, password);
  if (!sameWalletAddress(verificationWallet.address, wallet.address)) {
    throw new Error('Encrypted wallet self-check failed');
  }
  try {
    const storage = localStorageOrNull();
    storage?.setItem(PLATHO_WALLET_STORAGE_KEY, JSON.stringify(record));
    storage?.removeItem(PLATHO_WALLET_LEGACY_STORAGE_KEY);
    await requestPersistentLocalStorage();
  } catch {
    // Without persistent storage the current tab still has a working wallet.
  }
}

async function writeEncryptedPlathoWalletRecord(record) {
  if (!record || record.kind !== PLATHO_WALLET_STORAGE_KIND) {
    throw new Error('Encrypted wallet record is invalid');
  }
  const storage = localStorageOrNull();
  if (!storage) throw new Error('Local storage is unavailable');
  storage.setItem(PLATHO_WALLET_STORAGE_KEY, JSON.stringify(record));
  storage.removeItem(PLATHO_WALLET_LEGACY_STORAGE_KEY);
  await requestPersistentLocalStorage();
}

async function changeStoredPlathoWalletPassword() {
  const record = readEncryptedPlathoWalletRecord();
  if (!record) throw new Error('No encrypted wallet is stored on this device');
  const wallet = await requestAndDecryptEncryptedWallet(record, {
    title: 'Change wallet password',
    hint: 'Enter the current local wallet password before setting a new one.',
    submitLabel: 'Continue',
  });
  if (!wallet) return false;
  const newPassword = await requestNewWalletStoragePassword('Set new wallet password', {
    passwordManagerUsername: wallet.address,
    passwordManagerNetworkGlobalId: wallet.networkGlobalId,
  });
  if (!newPassword) return false;
  await writeStoredPlathoWallet(wallet, newPassword);
  plathoWallet = wallet;
  localProfileAvatarPointer = readStoredProfileAvatarPointer(wallet.address);
  markWalletUnlocked();
  scheduleWalletAutoLock();
  return true;
}

async function loadPlathoWallet() {
  if (plathoWallet) return plathoWallet;
  if (walletUnlockPromise) return walletUnlockPromise;
  walletUnlockPromptPending = false;
  clearWalletUnlockPromptTimer();
  walletUnlockPromise = (async () => {
    const wallet = await readStoredPlathoWallet();
    plathoWallet = wallet;
    localProfileAvatarPointer = readStoredProfileAvatarPointer(wallet?.address);
    if (wallet) {
      markWalletUnlocked();
      scheduleWalletAutoLock();
      refreshOwnProfileAvatar().catch((error) => console.error(error));
    }
    return wallet;
  })();
  try {
    return await walletUnlockPromise;
  } finally {
    walletUnlockPromise = null;
  }
}

async function setPlathoWallet(wallet, { password } = {}) {
  plathoWallet = wallet;
  markWalletUnlocked();
  localProfileAvatarPointer = readStoredProfileAvatarPointer(wallet.address);
  await writeStoredPlathoWallet(wallet, password);
  scheduleWalletAutoLock();
  await bootCrypto();
  queueVaultRefreshAfterWalletChange();
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

function currentVaultUserSource() {
  return globalThis.plathoVaultBinding?.user
    ?? null;
}

function rememberConnectedVaultUser(user) {
  if (!user || typeof user !== 'object') return user;
  globalThis.plathoVaultBinding = {
    ...(globalThis.plathoVaultBinding ?? {}),
    walletAddress: plathoWallet?.address ?? globalThis.plathoVaultBinding?.walletAddress ?? null,
    user,
  };
  refreshNavVaultBalance();
  return user;
}

function hasActiveVaultMessagingKeys() {
  const user = currentVaultUserSource();
  if (user?.exists !== true) return false;
  try {
    return BigInt(user.current_key_id ?? 0n) > 0n;
  } catch {
    return false;
  }
}

function hasActivePlathoAccount() {
  return hasActiveVaultMessagingKeys();
}

function hasCurrentWalletVaultBinding() {
  const binding = globalThis.plathoVaultBinding;
  if (!binding || !plathoWallet?.address) return false;
  if (binding.walletAddress && !sameWalletAddress(binding.walletAddress, plathoWallet.address)) return false;
  return hasActiveVaultMessagingKeys();
}

function currentVaultMessagingKeyId() {
  try {
    const keyId = BigInt(currentVaultUserSource()?.current_key_id ?? 0n);
    return keyId > 0n ? keyId : null;
  } catch {
    return null;
  }
}

function plathoAccountActivationFeeNanotons(user = currentVaultUserSource()) {
  return estimateVaultAttachedValueNanotons('RegisterMessagingKeys', localVaultDraft?.message ?? { crypto_suite_mask: VAULT_CRYPTO_SUITE.HYBRID }, {
    userExists: user?.exists === true,
  });
}

function plathoAccountActivationFeeLabel(user = currentVaultUserSource()) {
  return `${formatTonNanotons(plathoAccountActivationFeeNanotons(user))} TON`;
}

function walletTonBalanceLabel() {
  const balance = vaultPocketState.wallet?.ton_balance;
  return balance === null || balance === undefined ? '-' : `${formatTonNanotons(balance)} TON`;
}

function refreshWalletTonProfileStatus() {
  setText(walletTonBalanceStatus, walletTonBalanceLabel());
}

function refreshMessageActionStatuses(options = {}) {
  if (!plathoWallet) {
    if (!options.keepSyncStatus) setText(messageSyncStatus, 'wallet required');
    setText(vaultRotateStatus, 'wallet required');
    return;
  }
  if (!options.keepSyncStatus) {
    const current = messageSyncStatus?.textContent?.trim() ?? '';
    if (!current || current === 'wallet required' || current === 'chain') {
      setText(messageSyncStatus, 'tap to sync');
    }
  }
  setText(vaultRotateStatus, hasActivePlathoAccount() ? 'ready' : 'activate account first');
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

function vaultTonBalanceNanotons(user = currentVaultUserSource()) {
  if (!user || typeof user !== 'object') return 0n;
  return nonNegativeBigInt(user.ton_balance ?? user.tonBalance ?? user.ton);
}

function currentMessagingPricingOptions() {
  return appConfig.messaging?.pricing ?? {};
}

function currentNetworkFeeSurchargeNanotons() {
  return networkFeeSurchargeNanotons(currentNetworkFeeEstimateNanotons(), currentMessagingPricingOptions());
}

function currentRawNetworkFeeSurchargeNanotons() {
  return rawNetworkFeeSurchargeNanotons(currentNetworkFeeEstimateNanotons(), currentMessagingPricingOptions());
}

function assertNetworkFeeSurchargeWithinCap() {
  const pricingOptions = currentMessagingPricingOptions();
  const estimate = currentNetworkFeeEstimateNanotons();
  if (!networkFeeSurchargeExceedsMax(estimate, pricingOptions)) return;
  const rawSurcharge = currentRawNetworkFeeSurchargeNanotons();
  const maxSurcharge = maxNetworkFeeSurchargeNanotons(pricingOptions);
  throw new Error(`Network surcharge ${formatTonNanotons(rawSurcharge)} TON exceeds the production cap ${formatTonNanotons(maxSurcharge)} TON. Try another RPC/network estimate before sending.`);
}

function shortUiErrorText(error, fallback = 'Blocked') {
  const text = String(error?.message ?? error ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function privateSendPreflightStatusText(error) {
  const message = shortUiErrorText(error, 'Send blocked');
  if (/not enough vault ton/i.test(message)) return message;
  if (/activate platho account before publishing/i.test(message)) return 'Activate Platho account before sending';
  if (/network surcharge .* exceeds the production cap/i.test(message)) return message;
  if (/RPC_VERIFICATION_UNAVAILABLE|verification unavailable/i.test(message)) return 'RPC verification unavailable';
  if (/Vault chain provider|TON RPC|sendBoc transport|provider is not configured/i.test(message)) return message;
  return message;
}

function privateSendBlockedStatusText(error) {
  return `not sent: ${privateSendPreflightStatusText(error)}`;
}

function isTonRpcTransientError(error) {
  const message = String(error?.message ?? error ?? '');
  return isTonRpcRateLimitError(error)
    || error?.code === 'TIMEOUT'
    || error?.code === 'NETWORK_ERROR'
    || error?.code === 'RPC_VERIFICATION_UNAVAILABLE'
    || /timeout|network|failed to fetch|fetch failed|backoff|temporar(?:y|ily)|verification unavailable|provider unavailable|rpc busy|request aborted/i.test(message);
}

function isFatalPrivateSendError(error) {
  const message = String(error?.message ?? error ?? '');
  return isPublishPriceChangeCancelled(error)
    || isVaultPublishPartialError(error)
    || /not enough vault ton|vault ton balance is too low|activate platho account|recipient .*not activated|is not registered|ownership is not authoritative|network surcharge .*exceeds the production cap|local platho signing key is not ready|wallet required|provider is not configured|cannot price publish|deployment manifest/i.test(message);
}

function isRecoverablePrivateSendError(error) {
  return isTonRpcTransientError(error) && !isFatalPrivateSendError(error);
}

function isAmbiguousTonRpcBroadcastError(error) {
  const message = String(error?.message ?? error ?? '');
  if (/rejected|bad request|invalid boc|invalid message|exit code|not enough vault ton|nonce/i.test(message)) return false;
  if (isTonRpcRateLimitError(error)) return false;
  return error?.code === 'TIMEOUT'
    || error?.code === 'NETWORK_ERROR'
    || /timeout|network|failed to fetch|fetch failed|backoff|request aborted/i.test(message);
}

function privateSendRetryDelayMs(error = null, attempt = 0) {
  if (isTonRpcRateLimitError(error)) return tonRpcLimitBackoffMs(error);
  const index = Math.min(Math.max(0, Number(attempt) || 0), PRIVATE_SEND_RETRY_DELAYS_MS.length - 1);
  return PRIVATE_SEND_RETRY_DELAYS_MS[index];
}

function privateSendRetryMeta(error = null) {
  return isTonRpcRateLimitError(error) ? 'retrying after RPC busy' : 'retrying send';
}

function privateSendRetryExhaustedStatusText(error = null) {
  if (isTonRpcRateLimitError(error)) return 'not sent: RPC stayed busy';
  return 'not sent: retry limit reached';
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
  if (!messageDiscountUnlocked()) {
    return 'ATH protocol-fee discount locked until activity airdrop is fully distributed';
  }
  const bps = athDiscountBps();
  if (bps >= 10_000n) {
    return 'ATH protocol-fee discount 100% - Platho fee 0 TON';
  }
  return `ATH protocol-fee discount ${formatDiscountPercent(bps)} - max reduction 0.010 TON`;
}

function discountedProtocolFeeNanotons(fullFee) {
  const fee = nonNegativeBigInt(fullFee);
  if (!messageDiscountUnlocked()) return fee;
  const minFee = fee < PLATO_MIN_PROTOCOL_FEE_NANOTONS ? fee : PLATO_MIN_PROTOCOL_FEE_NANOTONS;
  const athBalance = currentAthBalanceAtomic();
  if (athBalance >= ATH_FULL_DISCOUNT_AMOUNT_ATOMIC) return minFee;
  const remaining = ATH_FULL_DISCOUNT_AMOUNT_ATOMIC - athBalance;
  const discounted = ((fee * remaining) + ATH_FULL_DISCOUNT_AMOUNT_ATOMIC - 1n) / ATH_FULL_DISCOUNT_AMOUNT_ATOMIC;
  return discounted < minFee ? minFee : discounted;
}

function normalizePrivateSizeClass(sizeClass = 1) {
  const normalized = Number(sizeClass);
  return [1, 2, 4, 8, 16, 32].includes(normalized) ? normalized : 1;
}

function privateLocalExecReserveNanotons(suite, sizeClass = 1) {
  const normalizedSizeClass = normalizePrivateSizeClass(sizeClass);
  const table = VAULT_PUBLISH_PRIVATE_HYBRID_LOCAL_EXEC_RESERVE_NANOTONS;
  return table[normalizedSizeClass] ?? table[1];
}

function privateCapsulehubChargeNanotons(sizeClass = 1) {
  const normalizedSizeClass = normalizePrivateSizeClass(sizeClass);
  const execReserve = CAPSULEHUB_PRIVATE_HYBRID_EXEC_RESERVE_NANOTONS[normalizedSizeClass]
    ?? CAPSULEHUB_PRIVATE_HYBRID_EXEC_RESERVE_NANOTONS[1];
  return execReserve + CAPSULEHUB_PRIVATE_STORAGE_CHARGE_NANOTONS;
}

function privateComposerPublishProfile(suite = currentOutgoingPrivateSuite(), sizeClass = 1) {
  const normalizedSuite = normalizeCryptoSuite(suite);
  const normalizedSizeClass = normalizePrivateSizeClass(sizeClass);
  return {
    publishKind: VAULT_PUBLISH_KIND.PRIVATE,
    sizeClass: BigInt(normalizedSizeClass),
    cryptoSuite: VAULT_CRYPTO_SUITE.HYBRID,
    priceSuite: MESSAGE_PRICE_SUITES.HYBRID_V1,
    fixedCharge: privateLocalExecReserveNanotons(normalizedSuite, normalizedSizeClass) + privateCapsulehubChargeNanotons(normalizedSizeClass),
    protocolFee: PLATO_PRIVATE_LONG_TERM_FEE_NANOTONS,
  };
}

function publicComposerPublishProfile() {
  return {
    publishKind: VAULT_PUBLISH_KIND.PUBLIC,
    sizeClass: VAULT_SIZE_CLASS.STANDARD,
    cryptoSuite: VAULT_CRYPTO_SUITE.PUBLIC_NONE,
    priceSuite: MESSAGE_PRICE_SUITES.PUBLIC_V1,
    fixedCharge: VAULT_PUBLISH_PUBLIC_LOCAL_EXEC_RESERVE_NANOTONS + CAPSULEHUB_PUBLIC_FIXED_CHARGE_NANOTONS,
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

function privateImageAttachmentPartCount(attachment, options = currentPrivateSenderOptions()) {
  if (!attachment?.bytes?.length) return 0;
  return privateImageCapsulePartsForSend(attachment, options).length;
}

function privateSenderWalletPayloadOverhead(options = {}) {
  return options.includeSenderWalletMetadata === false ? 0 : PLATHO_COMPACT_SENDER_WALLET_METADATA_BYTES;
}

function privateTextCapsulePartsForSend(text, options = {}) {
  return splitUtf8ToCapsuleParts(text, MAX_CAPSULE_USEFUL_BYTES, {
    perPartOverheadBytes: privateSenderWalletPayloadOverhead(options),
  });
}

function privateImageCapsulePartsForSend(attachment, options = {}) {
  if (!attachment?.bytes?.length) return [];
  return splitBytesToCapsuleParts(attachment.bytes, MAX_CAPSULE_USEFUL_BYTES, {
    perPartOverheadBytes: privateSenderWalletPayloadOverhead(options),
  });
}

function privateComposerRetrievalPartLimit() {
  const configuredLimit = Number(appConfig.capsuleHub?.privateReadLimit ?? PRIVATE_CHAIN_READ_LIMIT);
  return Number.isFinite(configuredLimit)
    ? Math.max(1, Math.floor(configuredLimit))
    : PRIVATE_CHAIN_READ_LIMIT;
}

function privateComposerPartLimitMessage(partCount) {
  const parts = Number(partCount ?? 0);
  const limit = privateComposerRetrievalPartLimit();
  if (!Number.isFinite(parts) || parts <= limit) return null;
  return `Private message has ${parts} capsules; split it into messages of ${limit} capsules or fewer`;
}

function assertPrivateComposerPartLimit(partCount) {
  const message = privateComposerPartLimitMessage(partCount);
  if (message) throw new Error(message);
}

function privateComposerSendPlan(text, attachment, options = currentPrivateSenderOptions()) {
  const plan = [];
  if (String(text ?? '').trim().length > 0) {
    for (const part of privateTextCapsulePartsForSend(text, options)) {
      plan.push({ type: 'text', text: part.text, sizeClass: part.sizeClass, usefulBytes: part.usefulBytes });
    }
  }
  for (const part of privateImageCapsulePartsForSend(attachment, options)) {
    plan.push({ type: 'image', bytes: part.bytes, sizeClass: part.sizeClass, usefulBytes: part.usefulBytes });
  }
  return plan;
}

function privateComposerPublishProfilesForPlan(suite, plan) {
  const parts = Array.isArray(plan) && plan.length > 0 ? plan : [{ sizeClass: 1 }];
  return parts.map((part) => privateComposerPublishProfile(suite, part.sizeClass));
}

function imageAttachmentSizeLabel(attachment) {
  if (!attachment?.bytes?.length) return '0 KiB';
  const kib = attachment.bytes.length / 1024;
  return kib < 10 ? `${kib.toFixed(1)} KiB` : `${Math.ceil(kib)} KiB`;
}

function imageByteCountLabel(value) {
  const bytes = typeof value === 'number'
    ? value
    : (value?.length ?? value?.byteLength ?? 0);
  const length = Number(bytes);
  if (!Number.isFinite(length) || length <= 0) return '';
  const kib = length / 1024;
  return kib < 10 ? `${kib.toFixed(1)} KiB` : `${Math.ceil(kib)} KiB`;
}

function messageImageLightboxMeta(attachment, image = null) {
  const width = Number(attachment?.width ?? image?.naturalWidth ?? 0);
  const height = Number(attachment?.height ?? image?.naturalHeight ?? 0);
  const dimensions = width > 0 && height > 0 ? `${width}x${height}` : '';
  const size = imageByteCountLabel(attachment?.bytes);
  const mode = attachment?.modeLabel
    ?? (attachment?.mode ? imageCompressionMode(attachment.mode).label : '');
  return [dimensions, size, mode].filter(Boolean).join(' - ') || 'Chat image';
}

function imageAttachmentSummaryRows(attachment, options = {}) {
  const mode = attachment?.mode ?? imageCompressionMode(options.modeId);
  const partCounter = typeof options.partCounter === 'function' ? options.partCounter : imageAttachmentPartCount;
  const parts = partCounter(attachment);
  const rows = [
    { label: 'Quality', value: mode.label },
  ];
  if (attachment) {
    rows.push(
      { label: 'Final image', value: `${attachment.width}x${attachment.height} WebP` },
      { label: 'On-chain size', value: `${imageAttachmentSizeLabel(attachment)} / ${parts} capsule${parts === 1 ? '' : 's'}` },
    );
  } else {
    rows.push({ label: 'Preview', value: 'compressing selected quality' });
  }
  const extraRows = typeof options.extraRows === 'function'
    ? options.extraRows(attachment)
    : (options.extraRows ?? []);
  for (const row of extraRows) rows.push(row);
  return rows;
}

function setImagePreviewNodes(previewId, attachment, status = '') {
  const preview = document.getElementById(previewId);
  const meta = document.getElementById(`${previewId}Meta`);
  if (preview instanceof HTMLImageElement && attachment?.dataUrl) {
    preview.src = attachment.dataUrl;
    preview.dataset.fullImageSrc = attachment.dataUrl;
    preview.dataset.fullImageMeta = `${attachment.width}x${attachment.height} - ${imageAttachmentSizeLabel(attachment)} - ${attachment.mode.label}`;
  } else if (preview instanceof HTMLImageElement) {
    delete preview.dataset.fullImageSrc;
    delete preview.dataset.fullImageMeta;
  }
  if (meta) {
    meta.textContent = attachment
      ? `${attachment.width}x${attachment.height} - ${imageAttachmentSizeLabel(attachment)} - ${attachment.mode.label}`
      : status;
  }
}

async function requestCompressedImageFile(file, options = {}) {
  if (!file) return null;
  const initialMode = imageCompressionMode(options.modeId ?? DEFAULT_IMAGE_COMPRESSION_MODE_ID);
  const previewId = `imagePreview${Date.now()}${Math.floor(Math.random() * 10000)}`;
  let selectedAttachment = null;
  let selectedModeId = initialMode.id;
  let errorText = '';
  let sequence = 0;

  const dialogPromise = openActionDialog({
    title: options.title ?? 'Attach image',
    hint: options.hint ?? 'Choose the final quality after previewing the image. The compressed result is carried in the accepted TON transaction body and verified by CapsuleHub hashes.',
    tone: options.tone ?? 'muted',
    submitLabel: options.submitLabel ?? 'Use image',
    fields: [
      {
        id: previewId,
        label: 'Preview final image',
        type: 'image-preview',
        meta: 'Compressing preview',
      },
      {
        id: 'imageQuality',
        label: 'Quality',
        type: 'select',
        options: avatarCompressionOptions(),
        value: initialMode.id,
      },
    ],
    summary: (values) => {
      const mode = imageCompressionMode(values.imageQuality ?? selectedModeId);
      if (errorText) {
        return [
          { label: 'Quality', value: mode.label },
          { label: 'Status', value: errorText },
        ];
      }
      if (!selectedAttachment || selectedAttachment.mode.id !== mode.id) {
        return imageAttachmentSummaryRows(null, {
          modeId: mode.id,
          partCounter: options.partCounter,
          extraRows: options.extraRows,
        });
      }
      return imageAttachmentSummaryRows(selectedAttachment, {
        partCounter: options.partCounter,
        extraRows: options.extraRows,
      });
    },
  });

  const qualitySelect = actionFields?.querySelector('[name="imageQuality"]');
  const compressSelected = async () => {
    const run = ++sequence;
    const mode = imageCompressionMode(qualitySelect?.value ?? selectedModeId);
    selectedModeId = mode.id;
    selectedAttachment = null;
    errorText = '';
    if (actionSubmitButton) actionSubmitButton.disabled = true;
    setImagePreviewNodes(previewId, null, `Compressing ${mode.label.toLowerCase()} preview`);
    renderActionSummary(activeActionDialog?.summary, collectActionDialogValues());
    try {
      const attachment = await compressImageFile(file, mode.id);
      if (run !== sequence) return;
      selectedAttachment = attachment;
      setImagePreviewNodes(previewId, attachment);
    } catch (error) {
      if (run !== sequence) return;
      errorText = error?.message ?? 'Image compression blocked';
      setImagePreviewNodes(previewId, null, errorText);
      console.error(error);
    } finally {
      if (run === sequence) {
        renderActionSummary(activeActionDialog?.summary, collectActionDialogValues());
        if (actionSubmitButton) actionSubmitButton.disabled = !selectedAttachment;
      }
    }
  };

  qualitySelect?.addEventListener('change', () => {
    compressSelected().catch((error) => {
      errorText = error?.message ?? 'Image compression blocked';
      renderActionSummary(activeActionDialog?.summary, collectActionDialogValues());
    });
  });
  compressSelected().catch((error) => {
    errorText = error?.message ?? 'Image compression blocked';
    renderActionSummary(activeActionDialog?.summary, collectActionDialogValues());
  });

  const result = await dialogPromise;
  if (!result) return null;
  const finalMode = imageCompressionMode(result.imageQuality ?? selectedModeId);
  if (!selectedAttachment || selectedAttachment.mode.id !== finalMode.id) {
    selectedAttachment = await compressImageFile(file, finalMode.id);
  }
  return selectedAttachment;
}

function composerTotalPartCount(text, attachment, maxTextBytes = SINGLE_CAPSULE_USEFUL_BYTES) {
  const hasText = String(text ?? '').trim().length > 0;
  const textParts = hasText ? composerPartCount(text, maxTextBytes) : 0;
  return Math.max(1, textParts + imageAttachmentPartCount(attachment));
}

function composerEstimatedMaxChargeNanotons(profile, parts = 1) {
  if (Array.isArray(profile)) {
    return profile.reduce((sum, item) => sum + composerEstimatedMaxChargeNanotons(item, 1), 0n);
  }
  const perPart = nonNegativeBigInt(profile?.fixedCharge)
    + discountedProtocolFeeNanotons(profile?.protocolFee)
    + currentNetworkFeeSurchargeNanotons();
  return perPart * BigInt(Math.max(1, Number(parts) || 1));
}

function composerSuccessfulPublishRefundNanotons(parts = 1) {
  const perPart = CAPSULEHUB_ACK_FORWARD_RESERVE_NANOTONS > VAULT_PENDING_PUBLISH_REFUND_EXEC_RESERVE_NANOTONS
    ? CAPSULEHUB_ACK_FORWARD_RESERVE_NANOTONS - VAULT_PENDING_PUBLISH_REFUND_EXEC_RESERVE_NANOTONS
    : 0n;
  return perPart * BigInt(Math.max(1, Number(parts) || 1));
}

function composerNetCostFromHoldNanotons(hold, parts = 1) {
  const value = nonNegativeBigInt(hold);
  const refund = composerSuccessfulPublishRefundNanotons(parts);
  return value > refund ? value - refund : 0n;
}

function composerEstimatedNetCostNanotons(profile, parts = 1) {
  const hold = composerEstimatedMaxChargeNanotons(profile, parts);
  return composerNetCostFromHoldNanotons(hold, Array.isArray(profile) ? profile.length : parts);
}

function composerKnownVaultTonShortfall(profile, parts = 1) {
  const user = currentVaultUserSource();
  if (user?.exists !== true) return false;
  return vaultTonBalanceNanotons(user) < composerEstimatedMaxChargeNanotons(profile, parts);
}

function privateComposerKnownVaultTonShortfall() {
  const plan = privateComposerSendPlan(messageInput?.value ?? '', privateImageAttachment);
  if (privateComposerPartLimitMessage(plan.length)) return true;
  return composerKnownVaultTonShortfall(privateComposerPublishProfilesForPlan(currentOutgoingPrivateSuite(), plan), 1);
}

function publicComposerKnownVaultTonShortfall() {
  const publicLimit = publicCommentTarget ? PUBLIC_COMMENT_TEXT_MAX_BYTES : PUBLIC_POST_TEXT_MAX_BYTES;
  const parts = composerTotalPartCount(publicMessageInput?.value ?? '', publicImageAttachment, publicLimit);
  return composerKnownVaultTonShortfall(publicComposerPublishProfile(), parts);
}

function composerPublishProfileForDraft(publish) {
  if (BigInt(publish?.publish_kind ?? 0n) === VAULT_PUBLISH_KIND.PUBLIC) return publicComposerPublishProfile();
  return privateComposerPublishProfile(currentOutgoingPrivateSuite(), Number(publish?.size_class ?? 1));
}

function composerPublishProfilesForCapsules(capsules) {
  return (capsules ?? [])
    .filter((capsule) => capsule?.publish)
    .map((capsule) => composerPublishProfileForDraft(capsule.publish));
}

const PUBLISH_PRICE_CHANGE_CANCELLED_CODE = 'PLATHO_PUBLISH_PRICE_CHANGE_CANCELLED';

function publishPriceChangeCancelledError() {
  const error = new Error('Publish cancelled');
  error.code = PUBLISH_PRICE_CHANGE_CANCELLED_CODE;
  return error;
}

function isPublishPriceChangeCancelled(error) {
  return error?.code === PUBLISH_PRICE_CHANGE_CANCELLED_CODE;
}

async function confirmPublishPriceIncrease({ previousHold, finalHold, previousNetCost, finalNetCost, parts }) {
  const oldHold = nonNegativeBigInt(previousHold);
  const newHold = nonNegativeBigInt(finalHold);
  const oldCost = nonNegativeBigInt(previousNetCost);
  const newCost = nonNegativeBigInt(finalNetCost);
  if (newHold <= oldHold && newCost <= oldCost) return true;
  const result = await openActionDialog({
    title: 'Price changed',
    hint: 'The chain returned a higher fresh price before signing. Nothing is sent unless you confirm the new price.',
    tone: 'error',
    submitLabel: 'Send with new price',
    dismissOnBackdrop: false,
    summary: [
      { label: 'Capsules', value: String(Math.max(1, Number(parts) || 1)) },
      { label: 'Previous cost', value: `${formatTonNanotons(oldCost)} TON` },
      { label: 'New cost', value: `${formatTonNanotons(newCost)} TON` },
      { label: 'Previous hold', value: `${formatTonNanotons(oldHold)} TON` },
      { label: 'New hold', value: `${formatTonNanotons(newHold)} TON` },
    ],
  });
  return result !== null;
}

async function confirmHighNetworkFeeSurcharge({ surcharge, finalHold, finalNetCost, parts }) {
  const perCapsuleSurcharge = nonNegativeBigInt(surcharge);
  const pricingOptions = currentMessagingPricingOptions();
  if (!requiresHighNetworkFeeSurchargeConfirmation(perCapsuleSurcharge, pricingOptions)) return true;
  const capsuleCount = Math.max(1, Number(parts) || 1);
  const totalSurcharge = perCapsuleSurcharge * BigInt(capsuleCount);
  const netCost = nonNegativeBigInt(finalNetCost);
  const baseNetCost = netCost > totalSurcharge ? netCost - totalSurcharge : 0n;
  const manualOverride = requiresManualNetworkFeeSurchargeOverride(perCapsuleSurcharge, pricingOptions);
  const result = await openActionDialog({
    title: manualOverride ? 'Manual network fee override' : 'High network surcharge',
    hint: 'The network fee estimate is unusually high. The surcharge is retained by CapsuleHub reserve, is not accrued_plato_fee_ton at publish time, and is not an ACK refund. Surplus reserve may later be swept by protocol reserve rules.',
    tone: manualOverride ? 'error' : 'warning',
    submitLabel: manualOverride ? 'Manual override: send' : 'Confirm surcharge',
    dismissOnBackdrop: false,
    summary: [
      { label: 'Capsules', value: String(capsuleCount) },
      { label: 'Base cost', value: `${formatTonNanotons(baseNetCost)} TON` },
      { label: 'Network surcharge', value: `${formatTonNanotons(totalSurcharge)} TON` },
      { label: 'Expected cost', value: `${formatTonNanotons(netCost)} TON` },
      { label: 'Hold', value: `${formatTonNanotons(finalHold)} TON` },
    ],
  });
  return result !== null;
}

function refreshPrivateSendButtonState() {
  if (!sendButton) return;
  const thread = activeThread();
  const privateReadOnly = !thread || thread.readOnly === true;
  sendButton.disabled = privateReadOnly || !plathoWallet || !hasActivePlathoAccount() || pendingServiceWorkerAppShellReload || tonRpcLimited() || privateComposerKnownVaultTonShortfall();
}

function refreshPublicSendButtonState() {
  const publicSendButton = publicComposer?.querySelector?.('.send-button');
  if (publicSendButton) publicSendButton.disabled = !plathoWallet || !hasActivePlathoAccount() || pendingServiceWorkerAppShellReload || tonRpcLimited() || publicComposerKnownVaultTonShortfall();
}

async function assertVaultHasPrivatePublishHold(suite, plan) {
  const user = rememberConnectedVaultUser(await loadConnectedVaultUser());
  if (user.exists !== true || BigInt(user.current_key_id ?? 0n) === 0n) {
    throw new Error('Activate Platho account before publishing');
  }
  const hold = composerEstimatedMaxChargeNanotons(privateComposerPublishProfilesForPlan(suite, plan), 1);
  const balance = vaultTonBalanceNanotons(user);
  if (balance < hold) {
    throw new Error(`Not enough Vault TON: need ${formatTonNanotons(hold)} TON hold, have ${formatTonNanotons(balance)} TON`);
  }
  return { user, hold, balance };
}

function estimatedUsernameMintTonFeeNanotons() {
  return USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS;
}

function estimatedProfileAvatarTonFeeNanotons(attachment) {
  const parts = Math.max(1, imageAttachmentPartCount(attachment));
  return composerEstimatedMaxChargeNanotons(publicComposerPublishProfile(), parts)
    + PROFILE_AVATAR_VAULT_TON_CHARGE_NANOTONS;
}

function profileAvatarTonFeeLabel(attachment) {
  if (!attachment) return 'estimated after compression';
  const parts = Math.max(1, imageAttachmentPartCount(attachment));
  const capsuleLabel = `${parts} public capsule${parts === 1 ? '' : 's'}`;
  return `up to ${formatTonNanotons(estimatedProfileAvatarTonFeeNanotons(attachment))} TON (${capsuleLabel} + registry)`;
}

function composerCostStatusText(profile, text, maxTextBytes, attachment = null, options = {}) {
  const parts = options.parts ?? composerTotalPartCount(text, attachment, maxTextBytes);
  const pricedProfile = options.pricedProfile ?? profile;
  if (!plathoWallet) {
    return {
      text: 'Wallet required',
      state: 'short',
      parts,
    };
  }
  if (tonRpcLimited()) {
    return {
      text: TON_RPC_CONNECTING_STATUS,
      state: 'short',
      parts,
    };
  }
  const price = composerEstimatedNetCostNanotons(pricedProfile, parts);
  const hold = composerEstimatedMaxChargeNanotons(pricedProfile, parts);
  const surchargeParts = Array.isArray(pricedProfile)
    ? pricedProfile.length
    : Math.max(1, Number(parts) || 1);
  const surcharge = currentNetworkFeeSurchargeNanotons() * BigInt(surchargeParts);
  const surchargeText = surcharge > 0n ? ` - Network +${formatTonNanotons(surcharge)} TON` : '';
  const user = currentVaultUserSource();
  if (user?.exists === true && vaultTonBalanceNanotons(user) < hold) {
    return {
      text: `Need ${formatTonNanotons(hold)} TON hold - Vault ${formatTonNanotons(vaultTonBalanceNanotons(user))} TON`,
      state: 'short',
      parts,
    };
  }
  return {
    text: `Cost ${formatTonNanotons(price)} TON - Hold ${formatTonNanotons(hold)} TON${surchargeText} - ${formatAthDiscountLabel()}`,
    state: 'ready',
    parts,
  };
}

function refreshComposerCostStatus() {
  if (privateComposerCostStatus) {
    const privatePlan = privateComposerSendPlan(messageInput?.value ?? '', privateImageAttachment);
    const limitMessage = privateComposerPartLimitMessage(privatePlan.length);
    const status = limitMessage
      ? { text: limitMessage, state: 'short' }
      : composerCostStatusText(
        privateComposerPublishProfile(),
        messageInput?.value ?? '',
        SINGLE_CAPSULE_USEFUL_BYTES,
        privateImageAttachment,
        {
          parts: Math.max(1, privatePlan.length),
          pricedProfile: privateComposerPublishProfilesForPlan(currentOutgoingPrivateSuite(), privatePlan),
        },
      );
    privateComposerCostStatus.textContent = status.text;
    privateComposerCostStatus.dataset.state = status.state;
  }
  refreshPrivateSendButtonState();
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
  refreshPublicSendButtonState();
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
  const text = String(value ?? 'disabled').toLowerCase();
  return ['enabled', 'disabled'].includes(text) ? text : 'disabled';
}

function readPublicCommentsDefault() {
  try {
    return normalizePublicCommentsDefault(localStorageOrNull()?.getItem(PUBLIC_COMMENTS_DEFAULT_STORAGE_KEY));
  } catch {
    return 'disabled';
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
  return normalizePublicCommentsDefault(value) === 'disabled' ? 'closed' : 'allowed';
}

function updatePublicCommentsDefaultUi() {
  const value = readPublicCommentsDefault();
  if (publicCommentsDefaultSelect) publicCommentsDefaultSelect.value = value;
  if (!publicCommentTarget && publicComposerCommentsCheckbox) publicComposerCommentsCheckbox.checked = value !== 'disabled';
}

function publicSyncWindowLabel(value = readPublicSyncWindow()) {
  const normalized = normalizePublicSyncWindow(value);
  return normalized === 'all' ? 'retained history' : `${normalized} days`;
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
  try {
    if (status) {
      status.textContent = 'Preparing image preview';
      status.dataset.state = 'short';
    }
    if (button) button.disabled = true;
    const attachment = await requestCompressedImageFile(file, {
      modeId,
      title: kind === 'public' ? 'Attach public image' : 'Attach private image',
      hint: kind === 'public'
        ? 'Preview the compressed public image before publishing. The final WebP bytes are public in the accepted TON transaction body and verified by CapsuleHub hashes.'
        : 'Preview the compressed image before attaching it. The final WebP bytes are encrypted before publish and verified by CapsuleHub hashes.',
      submitLabel: 'Attach image',
      partCounter: kind === 'private' ? privateImageAttachmentPartCount : imageAttachmentPartCount,
      extraRows: [
        { label: 'TON fee', value: 'depends on capsule count' },
      ],
    });
    if (!attachment) {
      refreshComposerCostStatus();
      return;
    }
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
  return 'Private message';
}

function publicComposerPlaceholder() {
  if (!plathoWallet) return 'Wallet required';
  return publicCommentTarget ? 'Public comment' : 'Public message';
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
  if (privateComposerAddButton) {
    privateComposerAddButton.disabled = !canPublish;
    privateComposerAddButton.title = canPublish ? 'Add image or payment check' : 'Create or import a wallet to add attachments';
  }
  if (privateImageModeSelect) {
    privateImageModeSelect.disabled = !canPublish;
  }
  if (publicImageModeSelect) {
    publicImageModeSelect.disabled = !canPublish;
  }
  updatePrivateSenderModeUi();
  updateImageAttachmentUi('private');
  updateImageAttachmentUi('public');
  refreshComposerCostStatus();
}

function privateComposerAddMenuVisible() {
  return Boolean(privateComposerAddMenu && !privateComposerAddMenu.hidden);
}

function hidePrivateComposerAddMenu() {
  if (privateComposerAddMenu) privateComposerAddMenu.hidden = true;
  privateComposerAddButton?.setAttribute('aria-expanded', 'false');
}

function showPrivateComposerAddMenu() {
  if (!privateComposerAddMenu || !privateComposerAddButton || privateComposerAddButton.disabled) return;
  privateComposerAddMenu.hidden = false;
  privateComposerAddButton.setAttribute('aria-expanded', 'true');
}

function togglePrivateComposerAddMenu() {
  if (privateComposerAddMenuVisible()) hidePrivateComposerAddMenu();
  else showPrivateComposerAddMenu();
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

function safeWalletKeyFilename(record) {
  const address = storedWalletAddressForCopy(record) || record?.address || 'wallet';
  const safeAddress = String(address).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 24) || 'wallet';
  return `platho-wallet-key-${safeAddress}.json`;
}

function walletKeyBackupFromRecord(record) {
  if (!record || record.kind !== PLATHO_WALLET_STORAGE_KIND) {
    throw new Error('Encrypted wallet key is missing');
  }
  return {
    kind: PLATHO_WALLET_KEY_BACKUP_KIND,
    version: 1,
    exportedAt: new Date().toISOString(),
    walletAddress: storedWalletAddressForCopy(record),
    encryptedWallet: record,
  };
}

function downloadEncryptedWalletKeyBackup(record = readEncryptedPlathoWalletRecord()) {
  if (!record) throw new Error('No encrypted wallet key is stored on this device');
  downloadJsonFile(safeWalletKeyFilename(record), walletKeyBackupFromRecord(record));
}

async function offerEncryptedWalletKeyBackup(reason = 'Save this encrypted wallet key file before adding funds.') {
  const record = readEncryptedPlathoWalletRecord();
  if (!record) return false;
  const result = await openActionDialog({
    title: 'Save wallet key backup',
    hint: reason,
    submitLabel: 'Save encrypted key',
    dismissOnBackdrop: false,
    fields: [],
    summary: [
      { label: 'File', value: 'encrypted Platho wallet key' },
      { label: 'Password', value: 'same local wallet password' },
      { label: 'Use', value: 'restore this wallet on this or another device' },
      { label: 'Why', value: 'browser storage can be cleared, especially on iPhone Safari' },
    ],
  });
  if (!result) return false;
  downloadEncryptedWalletKeyBackup(record);
  return true;
}

function encryptedWalletRecordFromBackup(value) {
  const record = value?.kind === PLATHO_WALLET_KEY_BACKUP_KIND
    ? value.encryptedWallet
    : value;
  if (!record || record.kind !== PLATHO_WALLET_STORAGE_KIND) {
    throw new Error('This is not a Platho encrypted wallet key file');
  }
  if (typeof record.salt !== 'string' || typeof record.iv !== 'string' || typeof record.ciphertext !== 'string') {
    throw new Error('Encrypted wallet key file is incomplete');
  }
  return record;
}

async function readJsonFile(file) {
  if (!file) return null;
  const text = await file.text();
  return JSON.parse(text);
}

const PLATHO_LOCAL_INDEXED_DB_NAMES = Object.freeze([
  'platho-local-message-history-v1',
  'platho-local-security-v1',
]);

function deleteIndexedDbDatabase(name) {
  return new Promise((resolve) => {
    if (!globalThis.indexedDB) {
      resolve(false);
      return;
    }
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(true);
    request.onerror = () => resolve(false);
    request.onblocked = () => resolve(false);
  });
}

function clearDocumentCookies() {
  for (const item of document.cookie.split(';')) {
    const name = item.split('=')[0]?.trim();
    if (!name) continue;
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
  }
}

async function clearPlathoLocalData() {
  localStorageOrNull()?.clear();
  globalThis.sessionStorage?.clear?.();
  clearDocumentCookies();
  await Promise.all(PLATHO_LOCAL_INDEXED_DB_NAMES.map((name) => deleteIndexedDbDatabase(name)));
  if (globalThis.caches?.keys) {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('platho-')).map((key) => caches.delete(key)));
  }
  if (navigator.serviceWorker?.getRegistrations) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
}

function refreshMessagingControls() {
  const accountActive = hasActivePlathoAccount();
  const appShellReloadPending = pendingServiceWorkerAppShellReload === true;
  const signedActionsReady = accountActive && !appShellReloadPending;
  const thread = activeThread();
  const canComposePrivate = Boolean(thread) && thread.readOnly !== true && Boolean(plathoWallet) && signedActionsReady;
  const hasStoredWallet = hasStoredPlathoWalletRecord();
  const hasKnownWallet = Boolean(plathoWallet || hasStoredWallet);
  if (createWalletButton) createWalletButton.disabled = false;
  setText(createWalletStatus, hasKnownWallet ? 'replace' : 'recommended');
  if (importWalletButton) importWalletButton.disabled = false;
  setText(importWalletStatus, hasKnownWallet ? 'replace' : '24 words');
  if (unlockWalletButton) unlockWalletButton.disabled = Boolean(plathoWallet) || !hasStoredWallet;
  setText(unlockWalletStatus, storedWalletLockStatus());
  if (changeWalletPasswordButton) changeWalletPasswordButton.disabled = !hasStoredWallet;
  setText(changeWalletPasswordStatus, hasStoredWallet ? 'change' : 'not stored');
  if (receiveWalletTonButton) receiveWalletTonButton.disabled = !currentWalletReceiveAddress();
  setText(receiveWalletTonStatus, currentWalletReceiveAddress() ? 'QR' : 'no wallet');
  if (sendWalletTonButton) sendWalletTonButton.disabled = !plathoWallet;
  setText(sendWalletTonStatus, plathoWallet ? 'wallet' : 'unlock');
  if (walletTonBalanceButton) walletTonBalanceButton.disabled = !plathoWallet;
  refreshWalletTonProfileStatus();
  if (exportWalletKeyButton) exportWalletKeyButton.disabled = !readEncryptedPlathoWalletRecord();
  setText(exportWalletKeyStatus, readEncryptedPlathoWalletRecord() ? 'encrypted file' : 'not stored');
  if (importWalletKeyButton) importWalletKeyButton.disabled = false;
  setText(importWalletKeyStatus, hasKnownWallet ? 'replace' : 'file');
  if (exportWalletSeedButton) exportWalletSeedButton.disabled = !plathoWallet;
  if (copyWalletAddressButton) copyWalletAddressButton.disabled = !(plathoWallet || storedWalletAddressForCopy());
  if (walletDisplayModeSelect) walletDisplayModeSelect.disabled = !plathoWallet;
  if (registerVaultKeysButton) registerVaultKeysButton.disabled = !plathoWallet || accountActive || appShellReloadPending;
  setText(vaultDraftStatus, !plathoWallet
    ? 'wallet required'
    : appShellReloadPending
      ? 'reload app'
      : accountActive
      ? 'active'
      : `${plathoAccountActivationFeeLabel()} TON`);
  if (replaceVaultKeysButton) replaceVaultKeysButton.disabled = !plathoWallet || !signedActionsReady;
  if (syncMessagesButton) syncMessagesButton.disabled = !plathoWallet || !signedActionsReady;
  if (mintUsernameButton) mintUsernameButton.disabled = !plathoWallet || !signedActionsReady;
  if (linkUsernameButton) linkUsernameButton.disabled = !plathoWallet || !signedActionsReady;
  if (flushUsernameRefundButton) flushUsernameRefundButton.disabled = !plathoWallet || !signedActionsReady;
  if (setAvatarButton) setAvatarButton.disabled = !plathoWallet || !signedActionsReady;
  if (paymentCheckButton) paymentCheckButton.disabled = !canComposePrivate;
  if (privateImageButton) privateImageButton.disabled = !canComposePrivate;
  if (privateComposerAddButton) privateComposerAddButton.disabled = !canComposePrivate;
  if (privateAnonymousButton) privateAnonymousButton.disabled = !canComposePrivate;
  if (privateSenderModeSelect) privateSenderModeSelect.disabled = !plathoWallet;
  if (messageInput) {
    messageInput.disabled = !canComposePrivate;
  }
  if (sendButton) {
    refreshPrivateSendButtonState();
  }
  if (publicMessageInput) publicMessageInput.disabled = !plathoWallet || !signedActionsReady;
  if (publicComposerCommentsCheckbox) publicComposerCommentsCheckbox.disabled = !plathoWallet || !signedActionsReady;
  refreshPublicSendButtonState();
  if (burnAthButton) burnAthButton.disabled = !plathoWallet || !signedActionsReady;
  for (const button of actionGrid?.querySelectorAll('button[data-action]') ?? []) {
    button.disabled = !plathoWallet || !signedActionsReady;
  }
  railItems.forEach((item) => {
    const gated = item.dataset.tab !== 'profile';
    item.disabled = gated && !accountActive;
    item.title = item.disabled ? 'Activate Platho account first' : (item.getAttribute('aria-label') ?? '');
  });
  if (!accountActive && appShell?.dataset?.view !== 'profile') {
    requestAnimationFrame(() => {
      if (!hasActivePlathoAccount() && appShell?.dataset?.view !== 'profile') setView('profile');
    });
  }
  refreshVaultMoveWidget();
  updatePrivateSenderModeUi();
  refreshComposerCostStatus();
  refreshConversationSubtitle();
  refreshMessageActionStatuses({ keepSyncStatus: true });
}

function setView(view) {
  if (view !== 'profile' && !hasActivePlathoAccount()) {
    view = 'profile';
    flashWalletIdentityStatus(pendingServiceWorkerAppShellReload
      ? 'Reload app to finish update'
      : (plathoWallet ? 'Activate Platho account first' : 'Create or unlock wallet first'));
  }
  appShell.dataset.view = view;
  if (view !== 'chats') {
    appShell.dataset.chatOpen = 'false';
    clearMessageAutoSyncTimer();
  }
  railItems.forEach((item) => item.classList.toggle('is-active', item.dataset.tab === view));
  panels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panel === view));
  if (view === 'chats' && plathoWallet && localRecipientKeyPair) {
    beginMessageSyncUi();
    syncPrivateCapsulesFromChainOnce().then((result) => {
      completeMessageSyncUi(result);
      setText(messageSyncStatus, privateSyncStatusText(result));
      scheduleMessageAutoSync();
    }).catch((error) => {
      const rateLimited = noteTonRpcRateLimit(error);
      failMessageSyncUi(rateLimited ? 'Sync delayed' : 'Sync failed');
      setText(messageSyncStatus, rateLimited ? 'sync delayed' : 'sync failed');
      if (!rateLimited) console.error(error);
      scheduleMessageAutoSync();
    });
  }
  if (view === 'public') {
    renderPublicSurface({ anchorUnread: true });
    syncPublicChannels().catch((error) => {
      if (noteTonRpcRateLimit(error)) setPublicStatus('sync delayed');
      else console.error(error);
    });
  }
  if (view === 'vault') {
    refreshVaultNow({ includeActivation: true, includeStats: true }).catch((error) => {
      const rateLimited = noteTonRpcRateLimit(error);
      setVaultStatus(rateLimited ? 'RPC busy, retrying' : 'sync blocked');
      if (!isExpectedVaultProviderUnavailable(error)) console.error(error);
    });
  } else {
    scheduleVaultAutoRefresh(2_000);
  }
  if (view === 'profile' && plathoWallet?.address) {
    refreshWalletTonBalanceForProfile().catch((error) => {
      if (!noteTonRpcRateLimit(error)) console.error(error);
    });
    refreshAthProtocolStats().catch(() => {});
    refreshOwnProfileAvatar().catch((error) => console.error(error));
  }
}

function renderThreads() {
  const q = search.value.trim().toLowerCase();
  threadList.innerHTML = '';
  threads
    .filter((thread) => `${thread.name} ${thread.preview} ${thread.state} ${threadIdentitySearchText(thread)}`.toLowerCase().includes(q))
    .forEach((thread) => {
      const unread = threadUnreadCount(thread);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `thread-item${thread.id === activeThreadId ? ' is-selected' : ''}${unread > 0 ? ' has-unread' : ''}`;
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
      const side = document.createElement('div');
      side.className = 'thread-side';
      side.append(time);
      if (unread > 0) {
        const badge = document.createElement('div');
        badge.className = 'thread-unread-badge';
        badge.textContent = unread > 99 ? '99+ unread' : `${unread} unread`;
        side.append(badge);
      }
      top.append(name);
      main.append(top, preview, state);
      item.append(avatar, main, side);
      item.addEventListener('click', () => {
        activeThreadId = thread.id;
        appShell.dataset.chatOpen = 'true';
        markThreadRead(thread);
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
    if (privateComposerAddButton) privateComposerAddButton.disabled = true;
    if (privateAnonymousButton) privateAnonymousButton.disabled = true;
    if (privateImageModeSelect) privateImageModeSelect.disabled = true;
    return;
  }
  setAvatarNode(activeAvatar, thread.avatar, thread.avatarImageUrl);
  if (isThreadConversationVisible(thread) && markThreadRead(thread)) {
    renderThreads();
  }
  renderConversationIdentity(thread);
  activeSubtitle.textContent = conversationSubtitleText(thread);
  messageStrip.innerHTML = '';
  const isReadOnly = thread.readOnly === true;
  const canComposePrivate = !isReadOnly
    && Boolean(plathoWallet)
    && hasActivePlathoAccount()
    && pendingServiceWorkerAppShellReload !== true;

  if (composer) composer.dataset.readOnly = isReadOnly ? 'true' : 'false';
  refreshComposerPublishPolicy();
  if (messageInput) {
    messageInput.disabled = !canComposePrivate;
    messageInput.placeholder = privateComposerPlaceholder({ readOnly: isReadOnly });
  }
  if (sendButton) sendButton.disabled = !canComposePrivate;
  if (paymentCheckButton) paymentCheckButton.disabled = !canComposePrivate;
  if (privateImageButton) privateImageButton.disabled = !canComposePrivate;
  if (privateComposerAddButton) privateComposerAddButton.disabled = !canComposePrivate;
  if (privateAnonymousButton) privateAnonymousButton.disabled = !canComposePrivate;
  if (privateImageModeSelect) privateImageModeSelect.disabled = isReadOnly || !plathoWallet;

  refreshPrivateSendButtonState();
  updatePrivateSenderModeUi();
  sortThreadMessages(thread);
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
      image.alt = 'Open image';
      image.loading = 'lazy';
      image.tabIndex = 0;
      image.role = 'button';
      image.title = 'Open full-size image';
      image.dataset.fullImageSrc = message.attachment.url;
      image.dataset.fullImageMeta = messageImageLightboxMeta(message.attachment);
      image.addEventListener('load', () => {
        image.dataset.fullImageMeta = messageImageLightboxMeta(message.attachment, image);
      }, { once: true });
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
            message.meta = 'check claimed';
          } catch (error) {
            message.meta = 'check already claimed or cancelled';
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
    const metaText = messageMetaText(message);
    if (metaText) {
      row.dataset.status = messageStatusKey(message);
      const meta = document.createElement('div');
      meta.className = 'message-meta';
      meta.textContent = metaText;
      row.append(bubble, meta);
    } else {
      row.append(bubble);
    }
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
closeOnBackdropClick(installDialog, () => closeInstallDialog({ dismissed: true }));
closeOnBackdropClick(docsDialog, closeDocsDialog);
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
closeOnBackdropClick(newChatDialog, closeNewChatDialog);
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
actionCancelButton?.addEventListener('click', () => {
  if (activeActionDialog?.dismissOnBackdrop === false) return;
  closeActionDialog(null);
});
closeOnBackdropClick(actionDialog, () => closeActionDialog(null));
imageLightboxCloseButton?.addEventListener('click', closeImageLightbox);
imageLightboxDownloadButton?.addEventListener('click', downloadImageLightboxImage);
closeOnBackdropClick(imageLightboxDialog, closeImageLightbox);
actionFields?.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const image = target?.closest?.('.image-preview-card img');
  if (!(image instanceof HTMLImageElement)) return;
  openImageLightbox(image.dataset.fullImageSrc, image.dataset.fullImageMeta);
});
actionFields?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const target = event.target instanceof Element ? event.target : null;
  if (!(target instanceof HTMLImageElement) || !target.closest('.image-preview-card')) return;
  event.preventDefault();
  openImageLightbox(target.dataset.fullImageSrc, target.dataset.fullImageMeta);
});
messageStrip?.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const image = target?.closest?.('.message-image');
  if (!(image instanceof HTMLImageElement)) return;
  openImageLightbox(image.dataset.fullImageSrc ?? image.currentSrc ?? image.src, image.dataset.fullImageMeta);
});
messageStrip?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const target = event.target instanceof Element ? event.target : null;
  if (!(target instanceof HTMLImageElement) || !target.classList.contains('message-image')) return;
  event.preventDefault();
  openImageLightbox(target.dataset.fullImageSrc ?? target.currentSrc ?? target.src, target.dataset.fullImageMeta);
});
actionFields?.addEventListener('input', updateActiveActionSummary);
actionFields?.addEventListener('change', updateActiveActionSummary);
actionForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const values = collectActionDialogValues();
  if (actionSubmitButton) actionSubmitButton.disabled = true;
  window.setTimeout(() => closeActionDialog(values), 0);
});
document.addEventListener('click', (event) => {
  if (!identityPopover || identityPopover.hidden) return;
  if (identityPopover.contains(event.target)) return;
  hideIdentityPopover();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (imageLightboxDialog && !imageLightboxDialog.hidden) {
    closeImageLightbox();
    return;
  }
  hideIdentityPopover();
  closeNewChatDialog();
  if (activeActionDialog?.dismissOnBackdrop !== false) closeActionDialog(null);
  closeDocsDialog();
  closeInstallDialog({ dismissed: false });
});

actionGrid?.addEventListener('click', async (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const button = target?.closest('button[data-action]');
  if (!button) return;
  try {
    button.disabled = true;
    let result = null;
    if (button.dataset.action === 'vault-deposit-ton') {
      result = await submitVaultDepositTon();
    } else if (button.dataset.action === 'vault-withdraw-ton') {
      result = await submitVaultWithdrawTon();
    } else if (button.dataset.action === 'vault-deposit-ath') {
      result = await submitVaultDepositAth();
    } else if (button.dataset.action === 'vault-withdraw-ath') {
      result = await submitVaultWithdrawAth();
    }
    if (result) queueVaultPostTransactionRefresh();
  } catch (error) {
    const rateLimited = noteTonRpcRateLimit(error);
    setVaultStatus(rateLimited ? 'RPC busy, retrying' : 'transaction blocked');
    if (!rateLimited) console.error(error);
  } finally {
    button.disabled = false;
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
      queueVaultPostTransactionRefresh();
    } catch (error) {
      const rateLimited = noteTonRpcRateLimit(error);
      setVaultStatus(rateLimited ? 'RPC busy, retrying' : 'move blocked');
      if (!rateLimited) console.error(error);
    } finally {
      refreshVaultMoveWidget();
    }
  });
}

publicSyncWindowSelect?.addEventListener('change', async () => {
  const value = writePublicSyncWindow(publicSyncWindowSelect.value);
  updatePublicSyncWindowUi();
  setPublicStatus(value === 'all' ? 'syncing retained history' : `syncing ${publicSyncWindowLabel(value)}`);
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

privateSenderModeSelect?.addEventListener('change', () => {
  const value = writePrivateSenderMode(privateSenderModeSelect.value);
  updatePrivateSenderModeUi();
  refreshComposerCostStatus();
  flashWalletIdentityStatus(`Private sender: ${privateSenderModeLabel(value)}`);
});

mintUsernameButton?.addEventListener('click', async () => {
  try {
    mintUsernameButton.disabled = true;
    await submitUsernameMint();
  } catch (error) {
    flashWalletIdentityStatus('username blocked');
    console.error(error);
  } finally {
    mintUsernameButton.disabled = false;
  }
});

linkUsernameButton?.addEventListener('click', async () => {
  const previous = readWalletDisplayIdentity(plathoWallet?.address);
  const previousLinked = readLinkedPlathoUsername(plathoWallet?.address);
  try {
    linkUsernameButton.disabled = true;
    const identity = await requestWalletDisplayIdentity(WALLET_DISPLAY_MODES.PLATHO_NFT);
    if (!identity) return;
    writeLinkedPlathoUsername(identity, plathoWallet.address);
    writeWalletDisplayIdentity(identity, plathoWallet.address);
    flashWalletIdentityStatus(`Linked ${identity.label}`);
  } catch (error) {
    flashWalletIdentityStatus('name link blocked');
    if (walletDisplayModeSelect) walletDisplayModeSelect.value = previous.mode;
    setText(linkedUsernameStatus, previousLinked?.label ?? 'optional');
    console.error(error);
  } finally {
    linkUsernameButton.disabled = !plathoWallet;
  }
});

flushUsernameRefundButton?.addEventListener('click', async () => {
  try {
    flushUsernameRefundButton.disabled = true;
    await submitUsernameRefundFlush();
  } catch (error) {
    flashWalletIdentityStatus('refund blocked');
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
    flashWalletIdentityStatus('ATH burn blocked');
    console.error(error);
  } finally {
    burnAthButton.disabled = false;
  }
});

replaceVaultKeysButton?.addEventListener('click', async () => {
  try {
    replaceVaultKeysButton.disabled = true;
    setText(vaultRotateStatus, 'checking');
    await submitVaultReplaceMessagingKeys();
  } catch (error) {
    setText(vaultRotateStatus, 'not ready');
    console.error(error);
  } finally {
    replaceVaultKeysButton.disabled = !plathoWallet || !hasActiveVaultMessagingKeys();
  }
});

syncMessagesButton?.addEventListener('click', async () => {
  try {
    syncMessagesButton.disabled = true;
    clearMessageAutoSyncTimer();
    beginMessageSyncUi();
    const result = await syncPrivateCapsulesFromChainOnce({ forceRecentRescan: true });
    completeMessageSyncUi(result);
    setText(messageSyncStatus, privateSyncStatusText(result));
  } catch (error) {
    const rateLimited = noteTonRpcRateLimit(error);
    failMessageSyncUi(rateLimited ? 'Sync delayed' : 'Sync failed');
    setText(messageSyncStatus, rateLimited ? 'sync delayed' : 'sync failed');
    if (!rateLimited) console.error(error);
  } finally {
    syncMessagesButton.disabled = false;
    scheduleMessageAutoSync();
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
    hidePrivateComposerAddMenu();
    if (!plathoWallet || !hasActivePlathoAccount()) {
      refreshComposerPublishPolicy();
      return;
    }
    paymentCheckButton.disabled = true;
    await submitCreatePaymentCheck();
  } catch (error) {
    refreshMessagingControls();
    console.error(error);
  } finally {
    paymentCheckButton.disabled = !plathoWallet || !hasActivePlathoAccount();
  }
});

privateComposerAddButton?.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (!plathoWallet || !hasActivePlathoAccount()) {
    refreshComposerPublishPolicy();
    return;
  }
  togglePrivateComposerAddMenu();
});

privateComposerAddMenu?.addEventListener('click', (event) => {
  event.stopPropagation();
});

privateAnonymousButton?.addEventListener('click', () => {
  if (!canTogglePrivateSenderMode()) {
    updatePrivateSenderModeUi();
    return;
  }
  const next = currentPrivateSenderMode() === PRIVATE_SENDER_MODES.ANONYMOUS
    ? PRIVATE_SENDER_MODES.SHARE
    : PRIVATE_SENDER_MODES.ANONYMOUS;
  const value = writePrivateSenderMode(next);
  updatePrivateSenderModeUi();
  refreshComposerCostStatus();
  flashWalletIdentityStatus(`Private sender: ${privateSenderModeLabel(value)}`);
});

registerVaultKeysButton?.addEventListener('click', async () => {
  try {
    registerVaultKeysButton.disabled = true;
    await submitVaultRegisterMessagingKeys();
  } catch (error) {
    vaultDraftStatus.textContent = 'activation blocked';
    console.error(error);
  } finally {
    refreshMessagingControls();
  }
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
document.addEventListener('click', (event) => {
  if (!privateComposerAddMenuVisible()) return;
  if (privateComposerAddMenu?.contains(event.target) || privateComposerAddButton?.contains(event.target)) return;
  hidePrivateComposerAddMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') hidePrivateComposerAddMenu();
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
  hidePrivateComposerAddMenu();
  if (!plathoWallet || !hasActivePlathoAccount()) {
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

setAvatarButton?.addEventListener('click', async (event) => {
  if (isProfileAvatarPickerSuppressed()) {
    event?.preventDefault();
    return;
  }
  if (!plathoWallet) {
    flashWalletIdentityStatus('create wallet first');
    return;
  }
  profileAvatarInput?.click();
});

profileAvatarInput?.addEventListener('change', async () => {
  const file = profileAvatarInput.files?.[0];
  if (!file) return;
  try {
    setAvatarButton?.toggleAttribute('disabled', true);
    const avatar = await requestProfileAvatarUploadDetails(file);
    if (!avatar) return;
    pendingProfileAvatarModeId = avatar.mode.id;
    await submitProfileAvatarUpdate(avatar);
  } catch (error) {
    const message = String(error?.message ?? 'avatar blocked');
    setText(identitySubtitle, message);
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
  if (tonRpcLimited()) {
    refreshComposerCostStatus();
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
    const rateLimited = noteTonRpcRateLimit(error);
    const cancelled = isPublishPriceChangeCancelled(error);
    setPublicStatus(cancelled ? 'publish cancelled' : (rateLimited ? 'sync delayed' : (publicCommentTarget ? 'comment blocked' : 'publish blocked')));
    if (!rateLimited && !cancelled) console.error(error);
  } finally {
    refreshPublicSendButtonState();
  }
});

composer?.addEventListener('submit', async (event) => {
  event.preventDefault();
  refreshComposerPublishPolicy();
  enforceComposerByteLimit();
  const text = messageInput.value.trim();
  const attachment = privateImageAttachment;
  if (!text && !attachment) return;
  const thread = threads.find((item) => item.id === activeThreadId) ?? threads[0];
  if (!thread) return;
  if (thread.readOnly) {
    messageInput.value = '';
    renderConversation();
    return;
  }
  if (!plathoWallet?.address || !appConfig.vault?.address) {
    refreshMessagingControls();
    return;
  }
  if (tonRpcLimited()) {
    refreshComposerCostStatus();
    return;
  }
  if (!localIdentity || !localRecipientKeyPair || !localSignedPublicBundle) {
    if (privateComposerCostStatus) {
      privateComposerCostStatus.textContent = 'Activate Platho account before sending';
      privateComposerCostStatus.dataset.state = 'short';
    }
    refreshMessagingControls();
    return;
  }

  const selectedSuite = currentOutgoingPrivateSuite();
  const senderOptions = currentPrivateSenderOptions();
  const sendPlan = privateComposerSendPlan(text, attachment, senderOptions);
  const limitMessage = privateComposerPartLimitMessage(sendPlan.length);
  if (limitMessage) {
    if (privateComposerCostStatus) {
      privateComposerCostStatus.textContent = limitMessage;
      privateComposerCostStatus.dataset.state = 'short';
    }
    refreshPrivateSendButtonState();
    return;
  }
  if (privateComposerCostStatus) {
    privateComposerCostStatus.textContent = 'Checking Vault balance';
    privateComposerCostStatus.dataset.state = 'ready';
  }
  if (sendButton) sendButton.disabled = true;
  try {
    await assertVaultHasPrivatePublishHold(selectedSuite, sendPlan);
  } catch (error) {
    const messageText = String(error?.message ?? error);
    const rateLimited = noteTonRpcRateLimit(error);
    if (privateComposerCostStatus) {
      privateComposerCostStatus.textContent = rateLimited
        ? TON_RPC_CONNECTING_STATUS
        : privateSendPreflightStatusText(error);
      privateComposerCostStatus.dataset.state = 'short';
    }
    refreshPrivateSendButtonState();
    if (!rateLimited) console.error(error);
    return;
  }

  const message = {
    type: 'out',
    text,
    meta: 'sending',
    ...localMessageOrderFields(),
  };
  if (attachment) {
    message.attachment = {
      type: 'image',
      url: attachment.dataUrl,
      bytes: attachment.bytes.length,
      width: attachment.width,
      height: attachment.height,
      mode: attachment.mode.id,
      modeLabel: attachment.mode.label,
    };
  }
  insertThreadMessage(thread, message);
  refreshThreadAfterMessageChange(thread);
  messageInput.value = '';
  privateImageAttachment = null;
  updateImageAttachmentUi('private');
  autoResizeComposerTextarea(messageInput);
  refreshComposerCostStatus();
  if (sendButton) sendButton.disabled = true;
  renderThreads();
  renderConversation();

  const sendContext = {
    thread,
    message,
    text,
    attachment,
    selectedSuite,
    senderOptions,
    retryAttempt: 0,
    confirmAttempt: 0,
  };
  try {
    await attemptPrivateComposerMessagePublish(sendContext);
  } catch (error) {
    await settlePrivateComposerSendError(sendContext, error);
  }
  refreshThreadAfterMessageChange(thread);
  renderThreads();
  renderConversation();
});

createWalletButton?.addEventListener('click', async () => {
  try {
    if (!(await confirmWalletReplacement('Create new wallet'))) return;
    const walletDraft = await createPlathoWallet(plathoWalletNetworkOptions());
    const password = await requestNewWalletStoragePassword('Encrypt new wallet', {
      passwordManagerUsername: walletDraft.address,
      passwordManagerNetworkGlobalId: walletDraft.networkGlobalId,
    });
    if (!password) return;
    createWalletButton.disabled = true;
    await setPlathoWallet(walletDraft, { password });
    flashWalletIdentityStatus('Wallet ready');
  } catch (error) {
    setText(walletAddressStatus, 'blocked');
    console.error(error);
  } finally {
    refreshMessagingControls();
  }
});

importWalletButton?.addEventListener('click', async () => {
  if (!(await confirmWalletReplacement('Import and replace'))) return;
  const recoveryPhrase = await requestWalletSeedImport();
  if (!recoveryPhrase) return;
  try {
    const walletDraft = await importPlathoWallet(recoveryPhrase, plathoWalletNetworkOptions());
    const password = await requestNewWalletStoragePassword('Encrypt imported wallet', {
      passwordManagerUsername: walletDraft.address,
      passwordManagerNetworkGlobalId: walletDraft.networkGlobalId,
    });
    if (!password) return;
    importWalletButton.disabled = true;
    await setPlathoWallet(walletDraft, { password });
    flashWalletIdentityStatus('Wallet ready');
  } catch (error) {
    setText(walletAddressStatus, 'import blocked');
    console.error(error);
  } finally {
    refreshMessagingControls();
  }
});

unlockWalletButton?.addEventListener('click', async () => {
  try {
    unlockWalletButton.disabled = true;
    const wallet = await loadPlathoWallet();
    if (!wallet) {
      flashWalletIdentityStatus('Wallet locked');
      return;
    }
    await bootCrypto();
    flashWalletIdentityStatus('Wallet unlocked');
  } catch (error) {
    setText(unlockWalletStatus, 'blocked');
    console.error(error);
  } finally {
    refreshMessagingControls();
  }
});

changeWalletPasswordButton?.addEventListener('click', async () => {
  try {
    changeWalletPasswordButton.disabled = true;
    const changed = await changeStoredPlathoWalletPassword();
    if (!changed) {
      flashWalletIdentityStatus('Password unchanged');
      return;
    }
    await bootCrypto();
    flashWalletIdentityStatus('Password changed');
  } catch (error) {
    setText(changeWalletPasswordStatus, 'blocked');
    console.error(error);
  } finally {
    refreshMessagingControls();
  }
});

receiveWalletTonButton?.addEventListener('click', async () => {
  try {
    receiveWalletTonButton.disabled = true;
    await showReceiveWalletTonDialog();
  } catch (error) {
    setText(receiveWalletTonStatus, 'blocked');
    console.error(error);
  } finally {
    refreshMessagingControls();
  }
});

sendWalletTonButton?.addEventListener('click', async () => {
  try {
    sendWalletTonButton.disabled = true;
    await submitWalletTonTransfer();
  } catch (error) {
    setText(sendWalletTonStatus, 'blocked');
    console.error(error);
  } finally {
    refreshMessagingControls();
  }
});

walletTonBalanceButton?.addEventListener('click', async () => {
  try {
    walletTonBalanceButton.disabled = true;
    await refreshWalletTonBalanceForProfile();
  } catch (error) {
    setText(walletTonBalanceStatus, 'blocked');
    console.error(error);
  } finally {
    refreshMessagingControls();
  }
});

exportWalletKeyButton?.addEventListener('click', async () => {
  try {
    exportWalletKeyButton.disabled = true;
    if (await exportEncryptedWalletKeyFile()) {
      flashWalletIdentityStatus('Wallet key exported');
    }
  } catch (error) {
    setText(exportWalletKeyStatus, 'blocked');
    console.error(error);
  } finally {
    refreshMessagingControls();
  }
});

importWalletKeyButton?.addEventListener('click', () => {
  walletKeyBackupInput?.click();
});

walletKeyBackupInput?.addEventListener('change', async () => {
  const file = walletKeyBackupInput.files?.[0] ?? null;
  walletKeyBackupInput.value = '';
  if (!file) return;
  try {
    if (importWalletKeyButton) importWalletKeyButton.disabled = true;
    if (await importEncryptedWalletKeyFile(file)) {
      flashWalletIdentityStatus('Wallet key imported');
    }
  } catch (error) {
    setText(importWalletKeyStatus, 'blocked');
    console.error(error);
  } finally {
    refreshMessagingControls();
  }
});

exportWalletSeedButton?.addEventListener('click', async () => {
  try {
    const wallet = requirePlathoWallet();
    if (!(await confirmWalletPasswordForExport(wallet))) return;
    await showWalletSeed('Recovery phrase', exportPlathoWalletRecoveryPhrase(wallet));
  } catch (error) {
    setText(walletAddressStatus, 'export blocked');
    console.error(error);
  }
});

clearLocalDataButton?.addEventListener('click', async () => {
  try {
    if (!(await confirmClearLocalData())) {
      setText(clearLocalDataStatus, 'not cleared');
      return;
    }
    clearLocalDataButton.disabled = true;
    setText(clearLocalDataStatus, 'clearing');
    await clearPlathoLocalData();
    setText(clearLocalDataStatus, 'cleared');
    window.setTimeout(() => window.location.reload(), 200);
  } catch (error) {
    clearLocalDataButton.disabled = false;
    setText(clearLocalDataStatus, 'blocked');
    console.error(error);
  }
});

copyWalletAddressButton?.addEventListener('click', async () => {
  try {
    const address = walletAddressForCopy(plathoWallet) || storedWalletAddressForCopy();
    if (!address) throw new Error('No wallet address to copy');
    await copyTextToClipboard(address);
    flashWalletIdentityStatus('Wallet address copied');
  } catch (error) {
    flashWalletIdentityStatus('copy blocked');
    console.error(error);
  }
});

walletDisplayModeSelect?.addEventListener('pointerdown', () => {
  suppressProfileAvatarPicker();
});

walletDisplayModeSelect?.addEventListener('change', async () => {
  suppressProfileAvatarPicker();
  const previous = readWalletDisplayIdentity(plathoWallet?.address);
  try {
    requirePlathoWallet();
    const mode = normalizeWalletDisplayMode(walletDisplayModeSelect.value);
    let identity = null;
    if (mode === WALLET_DISPLAY_MODES.ADDRESS) {
      identity = { mode: WALLET_DISPLAY_MODES.ADDRESS, label: '' };
    } else if (mode === WALLET_DISPLAY_MODES.PLATHO_NFT) {
      const linked = readLinkedPlathoUsername(plathoWallet.address);
      if (!linked) {
        if (walletDisplayModeSelect) walletDisplayModeSelect.value = previous.mode;
        await openActionDialog({
          title: 'No .ath name linked',
          hint: 'You can link a verified .ath name in Usernames and Avatars, or keep displaying the wallet address.',
          tone: 'muted',
          submitLabel: 'Got it',
          fields: [],
          summary: [
            { label: 'Current display', value: 'Wallet address' },
            { label: 'Optional setup', value: 'Link .ath name in Usernames and Avatars' },
          ],
        });
        flashWalletIdentityStatus('No .ath name linked');
        return;
      }
      identity = linked;
    } else {
      identity = await requestWalletDisplayIdentity(mode);
    }
    if (!identity) {
      if (walletDisplayModeSelect) walletDisplayModeSelect.value = previous.mode;
      return;
    }
    writeWalletDisplayIdentity(identity, plathoWallet.address);
    flashWalletIdentityStatus(identity.mode === WALLET_DISPLAY_MODES.ADDRESS ? 'Showing wallet address' : `Showing ${identity.label}`);
  } catch (error) {
    if (walletDisplayModeSelect) walletDisplayModeSelect.value = previous.mode;
    setText(walletDisplayModeStatus, previous.mode === WALLET_DISPLAY_MODES.ADDRESS ? 'address' : previous.label);
    flashWalletIdentityStatus('display blocked');
    console.error(error);
  }
});

function shortAddress(address) {
  const text = displayWalletAddress(address);
  if (text.length <= 16) return text || 'connected';
  return `${text.slice(0, 6)}...${text.slice(-6)}`;
}

function walletDisplayAddress(wallet) {
  return wallet?.friendlyAddress ?? wallet?.address ?? wallet;
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

function uint256ConfigValue(value, label) {
  const text = String(value ?? '').trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(text)) return BigInt(text);
  if (/^[0-9a-fA-F]{64}$/.test(text)) return BigInt(`0x${text}`);
  if (/^[0-9]+$/.test(text)) return BigInt(text);
  throw new Error(`${label} must be a uint256 hex or decimal value`);
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

function assertVaultGlobalMatchesConfig(global) {
  if (!global) throw new Error('Vault global state is missing');
  if (global.sealed !== true) {
    throw new Error('Vault is not sealed on this network');
  }
  if (global.capsule_hub_bound !== true) {
    throw new Error('Vault CapsuleHub route is not bound on this network');
  }
  const expectedManifest = uint256ConfigValue(requireVaultDeploymentManifestHash(), 'Vault deployment manifest hash');
  if (BigInt(global.deployment_manifest_hash ?? 0n) !== expectedManifest) {
    throw new Error('Vault deployment manifest hash does not match this app config');
  }
  const expectedCapsuleHub = appConfig.capsuleHub?.address
    ? requireBasechainAddress(appConfig.capsuleHub.address, 'CapsuleHub')
    : null;
  const boundCapsuleHub = global.capsule_hub_address
    ? requireBasechainAddress(global.capsule_hub_address, 'Vault CapsuleHub')
    : null;
  if (expectedCapsuleHub && boundCapsuleHub !== expectedCapsuleHub) {
    throw new Error('Vault CapsuleHub binding does not match this app config');
  }
  const expectedAthMaster = appConfig.ath?.masterAddress
    ? requireBasechainAddress(appConfig.ath.masterAddress, 'ATHMaster')
    : null;
  const boundAthMaster = global.ath_master_address
    ? requireBasechainAddress(global.ath_master_address, 'Vault ATHMaster')
    : null;
  if (expectedAthMaster && boundAthMaster !== expectedAthMaster) {
    throw new Error('Vault ATHMaster binding does not match this app config');
  }
  return global;
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
  if (!/^[a-z0-9_-]{4,16}$/.test(username)) {
    throw new Error('Username must be 4-16 lowercase letters, digits, underscores, or hyphens, with optional .ath suffix');
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

async function showReceiveWalletTonDialog() {
  const address = currentWalletReceiveAddress();
  if (!address) throw new Error('Create or import a wallet first');
  const result = await openActionDialog({
    title: 'Receive TON',
    hint: 'Show this QR or copy the address. Funds arrive in the local Platho wallet, not in Vault.',
    submitLabel: 'Copy address',
    fields: [{
      type: 'custom',
      render: () => createWalletReceiveQrNode(address),
    }],
    summary: [
      { label: 'Network', value: appConfig.network?.label ?? appConfig.network?.chain ?? 'TON' },
      { label: 'Destination', value: 'local Platho wallet' },
    ],
  });
  if (!result) return false;
  await copyTextToClipboard(address);
  flashWalletIdentityStatus('Wallet address copied');
  return true;
}

async function requestWalletTonTransferDetails() {
  const wallet = requirePlathoWallet();
  const fromAddress = walletAddressForCopy(wallet);
  const result = await openActionDialog({
    title: 'Send TON',
    hint: 'Sends TON directly from the local Platho wallet, not Vault. Vault funds stay separate.',
    submitLabel: 'Send TON',
    fields: [
      {
        id: 'recipient',
        label: 'Recipient address',
        type: 'text',
        placeholder: 'UQ...',
        autocomplete: 'off',
        spellcheck: false,
      },
      {
        id: 'amount',
        label: 'Amount',
        type: 'text',
        placeholder: '0.1',
        inputMode: 'decimal',
        autocomplete: 'off',
      },
    ],
    summary: (values) => {
      const lines = [
        { label: 'From', value: shortAddress(fromAddress) },
        { label: 'Source', value: 'local wallet, not Vault' },
      ];
      const recipientText = values.recipient?.trim();
      if (recipientText) {
        try {
          const recipient = requireBasechainAddress(recipientText, 'Recipient');
          lines.push({
            label: 'Recipient',
            value: shortAddress(formatTonUserFriendlyAddress(recipient, {
              testOnly: Number(wallet.networkGlobalId) === PLATHO_WALLET_NETWORK_GLOBAL_IDS.TESTNET,
            })),
          });
        } catch (error) {
          lines.push({ label: 'Recipient', value: error.message });
        }
      }
      if (values.amount?.trim()) {
        try {
          lines.push({ label: 'Amount', value: `${formatTonNanotons(parseTonAmountNanotons(values.amount))} TON` });
        } catch (error) {
          lines.push({ label: 'Amount', value: error.message });
        }
      }
      return lines;
    },
  });
  if (!result) return null;
  const recipient = requireBasechainAddress(result.recipient, 'Recipient');
  const amount = parseTonAmountNanotons(result.amount);
  return { recipient, amount };
}

async function submitWalletTonTransfer() {
  const details = await requestWalletTonTransferDetails();
  if (!details) return null;
  setVaultStatus('sending TON from wallet');
  const message = {
    address: details.recipient,
    amount: details.amount.toString(),
    bounce: false,
  };
  const transaction = createWalletTransaction(message);
  const result = await sendPlathoWalletTransaction(requirePlathoWallet(), transaction);
  globalThis.plathoLastWalletTonTransfer = { details, message, transaction, result };
  flashWalletIdentityStatus('TON transfer submitted');
  setVaultStatus('wallet TON transfer submitted');
  queueVaultPostTransactionRefresh();
  return result;
}

async function requestWalletSeedImport() {
  const result = await openActionDialog({
    title: 'Import wallet',
    hint: 'Paste the 24-word TON recovery phrase for the wallet that owns your messages.',
    submitLabel: 'Import wallet',
    fields: [{
      id: 'recoveryPhrase',
      label: 'Recovery phrase',
      type: 'textarea',
      placeholder: 'Paste 24 words',
      autocomplete: 'off',
    }],
    summary: ['This wallet key unlocks on-chain messages and signs protocol transactions.'],
  });
  const recoveryPhrase = result?.recoveryPhrase?.trim();
  return recoveryPhrase ? recoveryPhrase : null;
}

function showWalletSeed(title, recoveryPhrase, hint = 'Keep this recovery phrase private. It controls this wallet and its messages.') {
  return openActionDialog({
    title,
    hint,
    submitLabel: 'Done',
    fields: [{
      id: 'recoveryPhrase',
      label: 'Recovery phrase',
      type: 'textarea',
      value: recoveryPhrase,
      readOnly: true,
      required: false,
    }],
    summary: ['Store these 24 words now. The PWA cannot recover the wallet later without them.'],
  });
}

async function confirmWalletReplacement(actionLabel = 'replace this wallet') {
  if (!plathoWallet && !hasStoredPlathoWalletRecord()) return true;
  const result = await openActionDialog({
    title: 'Replace local wallet?',
    hint: 'This will replace the wallet stored in this browser. Export the current recovery phrase first if you need this wallet later.',
    tone: 'muted',
    submitLabel: actionLabel,
    fields: [],
    summary: [
      { label: 'Current wallet', value: plathoWallet ? shortAddress(walletAddressForCopy(plathoWallet)) : storedWalletShortLabel() },
      { label: 'Stored on', value: 'this device only' },
      { label: 'Effect', value: 'local wallet will be replaced' },
    ],
  });
  return Boolean(result);
}

async function confirmClearLocalData() {
  const result = await openActionDialog({
    title: 'Clear local data?',
    hint: 'This only clears data stored in this browser. It does not delete anything from chain, but it removes the local wallet record, chats, encrypted history, caches, and settings on this device.',
    tone: 'error',
    submitLabel: 'Clear local data',
    dismissOnBackdrop: false,
    fields: [{
      id: 'clearLocalDataConfirmText',
      name: 'confirmText',
      label: 'Type CLEAR',
      type: 'text',
      placeholder: 'CLEAR',
      autocomplete: 'off',
      autocapitalize: 'characters',
      spellcheck: false,
    }],
    summary: [
      { label: 'Scope', value: 'this device/browser only' },
      { label: 'Deletes', value: 'wallet record, chats, encrypted history, caches, local settings' },
      { label: 'Keeps', value: 'on-chain Vault, ATH, usernames, profile, public chain entries' },
    ],
  });
  return String(result?.confirmText ?? '').trim() === 'CLEAR';
}

async function confirmWalletPasswordForExport(wallet) {
  const record = readEncryptedPlathoWalletRecord();
  if (!record) return true;
  const unlocked = await requestAndDecryptEncryptedWallet(record, {
    title: 'Show recovery phrase',
    hint: 'Enter the local password before showing the recovery phrase.',
    submitLabel: 'Show recovery phrase',
  });
  if (!unlocked) return false;
  if (!sameWalletAddress(unlocked.address, wallet.address)) {
    throw new Error('Unlocked wallet does not match current wallet');
  }
  return true;
}

async function exportEncryptedWalletKeyFile() {
  const record = readEncryptedPlathoWalletRecord();
  if (!record) throw new Error('No encrypted wallet key is stored on this device');
  const unlocked = await requestAndDecryptEncryptedWallet(record, {
    title: 'Export wallet key',
    hint: 'Enter the local password before exporting the encrypted wallet key file.',
    submitLabel: 'Export wallet key',
  });
  if (!unlocked) return false;
  downloadEncryptedWalletKeyBackup(record);
  return true;
}

async function importEncryptedWalletKeyFile(file) {
  const parsed = await readJsonFile(file);
  const record = encryptedWalletRecordFromBackup(parsed);
  const wallet = await requestAndDecryptEncryptedWallet(record, {
    title: 'Import wallet key',
    hint: 'Enter the password for this encrypted wallet key file.',
    submitLabel: 'Import wallet key',
  });
  if (!wallet) return false;
  if (!(await confirmWalletReplacement('Import wallet key'))) return false;
  await writeEncryptedPlathoWalletRecord(record);
  plathoWallet = wallet;
  localProfileAvatarPointer = readStoredProfileAvatarPointer(wallet.address);
  markWalletUnlocked();
  scheduleWalletAutoLock();
  await bootCrypto();
  queueVaultRefreshAfterWalletChange();
  refreshMessagingControls();
  renderWalletIdentity('Wallet key imported');
  return true;
}

async function requestWalletDisplayIdentity(mode) {
  const normalizedMode = normalizeWalletDisplayMode(mode);
  if (normalizedMode === WALLET_DISPLAY_MODES.ADDRESS) return { mode: WALLET_DISPLAY_MODES.ADDRESS, label: '' };
  const suffix = '.ath';
  let feedback = `Enter a ${suffix} name for this wallet. The copy button still copies the wallet address.`;
  let tone = 'muted';
  const current = normalizedMode === WALLET_DISPLAY_MODES.PLATHO_NFT
    ? readLinkedPlathoUsername(plathoWallet?.address)
    : readWalletDisplayIdentity(plathoWallet?.address);
  let value = current?.mode === normalizedMode ? current.label : '';
  while (true) {
    const result = await openActionDialog({
      title: 'Link Platho name',
      hint: feedback,
      tone,
      submitLabel: 'Link name',
      fields: [{
        id: 'displayName',
        label: WALLET_DISPLAY_MODE_LABELS[normalizedMode],
        placeholder: 'name.ath',
        autocomplete: 'off',
        value,
      }],
      summary: () => [
        { label: 'Check', value: 'permanent name, currently owned by this wallet' },
      ],
    });
    if (!result) return null;
    value = result.displayName?.trim() ?? '';
    try {
      return await verifyWalletDisplayIdentity(normalizedMode, value, plathoWallet);
    } catch (error) {
      feedback = error?.message || `Use a verified ${suffix} name for this wallet.`;
      tone = 'error';
    }
  }
}

async function requestUsernameMintName() {
  let feedback = 'Choose the exact .ath name to mint. The ATH price does not include TON network fees.';
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
          { label: 'ATH price', value: '100-10k ATH by length; 50% goes to burn' },
          { label: 'TON hold', value: `up to ${formatTonNanotons(estimatedUsernameMintTonFeeNanotons())} TON from Vault` },
          { label: 'Route', value: 'Vault' },
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

function avatarCompressionOptions() {
  return Object.values(IMAGE_COMPRESSION_MODES).map((mode) => ({
    value: mode.id,
    label: `${mode.label} · up to ${Math.round(mode.maxBytes / 1024)} KiB`,
  }));
}

async function requestProfileAvatarUploadDetails(file) {
  return requestCompressedImageFile(file, {
    modeId: pendingProfileAvatarModeId,
    title: 'Set profile avatar',
    hint: 'Preview the exact public WebP avatar before it is written into public avatar capsules and registered in ProfileRegistry.',
    submitLabel: 'Use avatar',
    extraRows: (attachment) => [
      { label: 'ATH price', value: `${formatAthAtomic(PROFILE_AVATAR_PRICE_ATH)} ATH; 50% goes to burn` },
      { label: 'TON fee', value: profileAvatarTonFeeLabel(attachment) },
      { label: 'Visibility', value: 'avatar media is public' },
    ],
  });
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
  const cryptoImpl = globalThis.crypto;
  if (!cryptoImpl || typeof cryptoImpl.getRandomValues !== 'function') {
    throw new Error('crypto.getRandomValues is unavailable for query id generation');
  }
  const entropy = new Uint32Array(1);
  cryptoImpl.getRandomValues(entropy);
  return (BigInt(Math.floor(Date.now() / 1000)) << 32n) | BigInt(entropy[0]);
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

let nativeCanvasWebpEncodeSupported = null;

function canvasToNativeWebpBytes(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Image compression failed'));
        return;
      }
      try {
        resolve(await blobToBytes(blob));
      } catch (error) {
        reject(error);
      }
    }, 'image/webp', quality);
  });
}

async function canvasToWebpBytes(canvas, quality) {
  if (nativeCanvasWebpEncodeSupported !== false) {
    try {
      const bytes = await canvasToNativeWebpBytes(canvas, quality);
      if (isWebpBytes(bytes)) {
        nativeCanvasWebpEncodeSupported = true;
        return bytes;
      }
    } catch {
      // Fall through to the bundled encoder.
    }
    nativeCanvasWebpEncodeSupported = false;
  }
  return encodeCanvasToWebp(canvas, quality);
}

async function compressImageFile(file, modeId) {
  if (!file || !/^image\//i.test(file.type ?? '')) throw new Error('Choose an image file');
  const mode = imageCompressionMode(modeId);
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas is unavailable');
  try {
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
        if (!isWebpBytes(bytes)) throw new Error('Image encoder did not produce WebP bytes');
        if (!best || bytes.length < best.bytes.length) {
          best = { bytes, width: canvas.width, height: canvas.height, quality };
        }
        if (bytes.length <= mode.maxBytes) {
          return {
            ...best,
            mode,
            name: file.name || 'image.webp',
            sourceFile: file,
            mime: 'image/webp',
            mediaFormat: PLATHO_COMPACT_IMAGE_FORMATS.WEBP,
            dataUrl: bytesToImageDataUrl(bytes, 'image/webp'),
          };
        }
      }
    }
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
      mediaFormat: PLATHO_COMPACT_IMAGE_FORMATS.WEBP,
      dataUrl: bytesToImageDataUrl(best.bytes, 'image/webp'),
    };
  } finally {
    bitmap.close?.();
  }
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

function isTonRpcRateLimitError(error) {
  const message = String(error?.message ?? error ?? '');
  return error?.status === 429
    || error?.code === 'RATE_LIMITED'
    || /HTTP 429|Too Many Requests/i.test(message);
}

function tonRpcLimitBackoffMs(error = null) {
  const retryAfterMs = Number(error?.retryAfterMs);
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return Math.max(TON_RPC_LIMIT_MIN_BACKOFF_MS, Math.floor(retryAfterMs));
  }
  const configured = Number(appConfig.network?.tonRpc?.rateLimitBackoffMs);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.max(TON_RPC_LIMIT_MIN_BACKOFF_MS, Math.floor(configured));
  }
  return TON_RPC_LIMIT_FALLBACK_BACKOFF_MS;
}

function tonRpcLimited() {
  return tonRpcLimitedUntil > Date.now();
}

function scheduleTonRpcLimitedClear() {
  if (tonRpcLimitedTimer) {
    clearTimeout(tonRpcLimitedTimer);
    tonRpcLimitedTimer = null;
  }
  if (!tonRpcLimited()) return;
  const waitMs = Math.max(250, tonRpcLimitedUntil - Date.now());
  tonRpcLimitedTimer = setTimeout(() => {
    tonRpcLimitedTimer = null;
    if (tonRpcLimited()) {
      scheduleTonRpcLimitedClear();
      return;
    }
    tonRpcLimitedUntil = 0;
    globalThis.plathoTonRpcLimitedUntil = 0;
    refreshComposerCostStatus();
  }, waitMs);
}

function markTonRpcLimited(error = null) {
  tonRpcLimitedUntil = Math.max(tonRpcLimitedUntil, Date.now() + tonRpcLimitBackoffMs(error));
  globalThis.plathoTonRpcLimitedUntil = tonRpcLimitedUntil;
  scheduleTonRpcLimitedClear();
  refreshComposerCostStatus();
}

function noteTonRpcRateLimit(error) {
  if (!isTonRpcRateLimitError(error)) return false;
  markTonRpcLimited(error);
  return true;
}

function isExpectedVaultProviderUnavailable(error) {
  const message = String(error?.message ?? error ?? '');
  return error instanceof VaultChainProviderUnavailableError
    || error?.name === 'VaultChainProviderUnavailableError'
    || isTonRpcRateLimitError(error)
    || /Vault chain provider is not configured|Vault provider unavailable/i.test(message);
}

function vaultProviderStatusForError(error) {
  if (noteTonRpcRateLimit(error)) return 'RPC busy, retrying';
  return appConfig.vault?.provider?.unavailableStatus ?? 'provider required';
}

async function loadConnectedVaultUser(options = {}) {
  const provider = options.provider ?? await resolveVaultChainProvider();
  if (!provider?.getUser) throw new VaultChainProviderUnavailableError('Vault chain provider is not configured');
  return provider.getUser(requirePlathoWalletAddress(), {
    vaultAddress: requireVaultAddress(),
    verify: options.verify === true,
    priority: options.priority,
    cacheTtlMs: options.cacheTtlMs,
  });
}

async function loadConnectedVaultGlobal(options = {}) {
  const provider = options.provider ?? await resolveVaultChainProvider();
  if (!provider?.getGlobal) throw new VaultChainProviderUnavailableError('Vault chain provider is not configured');
  const global = await provider.getGlobal({
    vaultAddress: requireVaultAddress(),
    verify: options.verify === true,
    priority: options.priority,
    cacheTtlMs: options.cacheTtlMs,
  });
  return assertVaultGlobalMatchesConfig(global);
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

function walletBalanceInfoEndpoint() {
  const explicit = globalThis.plathoWalletBalanceEndpoint
    ?? globalThis.PLATHO_WALLET_BALANCE_ENDPOINT
    ?? appConfig.network?.walletBalanceEndpoint;
  return explicit ? String(explicit) : null;
}

async function fetchTonWalletBalance(address) {
  const endpoint = walletBalanceInfoEndpoint();
  if (!endpoint || typeof fetch !== 'function') return null;
  const cacheKey = `${endpoint}|${address}`;
  const cached = tonWalletBalanceCache.get(cacheKey);
  if (cached && Date.now() - cached.updatedAt <= TON_WALLET_BALANCE_CACHE_MS) return cached.balance;
  const existing = tonWalletBalanceInFlight.get(cacheKey);
  if (existing) return existing;
  const promise = (async () => {
    const url = new URL(endpoint, window.location.href);
    url.searchParams.set('address', address);
    const apiKey = globalThis.plathoTonRpcApiKey ?? globalThis.PLATHO_TON_RPC_API_KEY ?? appConfig.network?.tonRpc?.apiKey ?? null;
    const response = await fetch(url.href, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      const error = new Error(`TON wallet balance HTTP ${response.status}`);
      error.status = response.status;
      error.code = response.status === 429 ? 'RATE_LIMITED' : 'HTTP_ERROR';
      if (response.status === 429 && cached) return cached.balance;
      throw error;
    }
    const balance = extractTonWalletBalance(await response.json());
    if (balance !== null) tonWalletBalanceCache.set(cacheKey, { balance, updatedAt: Date.now() });
    return balance;
  })();
  tonWalletBalanceInFlight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    tonWalletBalanceInFlight.delete(cacheKey);
  }
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
  try {
    return await fetchTonWalletBalance(address);
  } catch (error) {
    if (!noteTonRpcRateLimit(error)) console.error(error);
    return null;
  }
}

async function loadConnectedAthWalletBalance() {
  const athWalletAddress = await loadConnectedAthWalletAddress();
  const provider = createAthWalletTonRpcProvider({ athWalletAddress });
  try {
    const data = await provider.getWalletData({ address: athWalletAddress });
    return nonNegativeBigInt(data.balance);
  } catch (error) {
    if (isAthWalletNotDeployedError(error)) return 0n;
    throw error;
  }
}

function isAthWalletNotDeployedError(error) {
  const message = String(error?.message ?? error ?? '');
  return /get-method exit code -13|cskip_no_state|no state|nonexist|Missing ATH wallet owner|Missing ATH master address/i.test(message);
}

function requireVaultProfileAvatarRoute(global) {
  if (global?.profile_registry_bound !== true) {
    throw new Error('Vault avatar payments are not enabled on this deployment yet');
  }
  const configuredRegistry = requireBasechainAddress(requireProfileRegistryAddress(), 'ProfileRegistry');
  const boundRegistry = global.profile_registry_address
    ? requireBasechainAddress(global.profile_registry_address, 'Vault ProfileRegistry')
    : null;
  if (boundRegistry !== configuredRegistry) {
    throw new Error('Vault avatar ProfileRegistry binding does not match this app config');
  }
  return configuredRegistry;
}

function requireVaultUsernameMintRoute(global) {
  if (global?.username_registry_bound !== true) {
    throw new Error('Vault username payments are not enabled on this deployment yet');
  }
  const configuredRegistry = requireBasechainAddress(requireUsernameRegistryAddress(), 'UsernameRegistry');
  const boundRegistry = global.username_registry_address
    ? requireBasechainAddress(global.username_registry_address, 'Vault UsernameRegistry')
    : null;
  if (boundRegistry !== configuredRegistry) {
    throw new Error('Vault username Registry binding does not match this app config');
  }
  return configuredRegistry;
}

function criticalChainReadOptions() {
  return { verify: true, priority: 'critical', cacheTtlMs: 0 };
}

function criticalCapsuleHubReadOptions(address) {
  return { capsuleHubAddress: address, ...criticalChainReadOptions() };
}

function requireManifestHashMatch(value, label) {
  const expectedManifest = uint256ConfigValue(requireVaultDeploymentManifestHash(), 'Vault deployment manifest hash');
  if (BigInt(value ?? 0n) !== expectedManifest) {
    throw new Error(`${label} deployment manifest hash does not match this app config`);
  }
}

async function requireProfileRegistryVaultRoute(global) {
  const registry = requireVaultProfileAvatarRoute(global);
  const resolved = await resolveProfileRegistryProvider();
  if (!resolved?.provider?.getGlobal || !resolved.provider.getAthWalletAddress) {
    throw new Error('ProfileRegistry provider cannot verify Vault binding');
  }
  const resolvedRegistry = requireBasechainAddress(resolved.address, 'ProfileRegistry');
  if (resolvedRegistry !== registry) {
    throw new Error('ProfileRegistry provider address does not match Vault binding');
  }
  const options = criticalChainReadOptions();
  const [registryGlobal, derivedOfficialWallet] = await Promise.all([
    resolved.provider.getGlobal({ profileRegistryAddress: registry, ...options }),
    resolved.provider.getAthWalletAddress(registry, { profileRegistryAddress: registry, ...options }),
  ]);
  if (registryGlobal.sealed !== true) throw new Error('ProfileRegistry is not sealed on this network');
  if (registryGlobal.official_ath_wallet_bound !== true) throw new Error('ProfileRegistry official ATH wallet is not bound');
  if (registryGlobal.vault_bound !== true) throw new Error('ProfileRegistry is not bound back to Vault');
  const boundVault = requireBasechainAddress(registryGlobal.vault_address, 'ProfileRegistry Vault');
  if (boundVault !== requireBasechainAddress(requireVaultAddress(), 'Vault')) {
    throw new Error('ProfileRegistry Vault binding does not match this app config');
  }
  requireManifestHashMatch(registryGlobal.deployment_manifest_hash, 'ProfileRegistry');
  const officialWallet = requireBasechainAddress(registryGlobal.official_ath_wallet_address, 'ProfileRegistry official ATH wallet');
  const derivedWallet = requireBasechainAddress(derivedOfficialWallet, 'ProfileRegistry derived ATH wallet');
  if (officialWallet !== derivedWallet) {
    throw new Error('ProfileRegistry official ATH wallet is not the derived registry wallet');
  }
  const expectedAthMaster = appConfig.ath?.masterAddress
    ? requireBasechainAddress(appConfig.ath.masterAddress, 'ATHMaster')
    : null;
  const registryAthMaster = registryGlobal.ath_master_address
    ? requireBasechainAddress(registryGlobal.ath_master_address, 'ProfileRegistry ATHMaster')
    : null;
  if (expectedAthMaster && registryAthMaster !== expectedAthMaster) {
    throw new Error('ProfileRegistry ATHMaster binding does not match this app config');
  }
  return registry;
}

async function requireUsernameRegistryVaultRoute(global) {
  const registry = requireVaultUsernameMintRoute(global);
  const provider = await resolveUsernameRegistryProvider();
  if (!provider?.getGlobal || !provider.getAthWalletAddress) {
    throw new Error('UsernameRegistry provider cannot verify Vault binding');
  }
  const options = criticalChainReadOptions();
  const [registryGlobal, derivedOfficialWallet] = await Promise.all([
    provider.getGlobal({ address: registry, ...options }),
    provider.getAthWalletAddress(registry, { address: registry, ...options }),
  ]);
  if (registryGlobal.sealed !== true) throw new Error('UsernameRegistry is not sealed on this network');
  if (registryGlobal.official_ath_wallet_bound !== true) throw new Error('UsernameRegistry official ATH wallet is not bound');
  if (registryGlobal.vault_bound !== true) throw new Error('UsernameRegistry is not bound back to Vault');
  const boundVault = requireBasechainAddress(registryGlobal.vault_address, 'UsernameRegistry Vault');
  if (boundVault !== requireBasechainAddress(requireVaultAddress(), 'Vault')) {
    throw new Error('UsernameRegistry Vault binding does not match this app config');
  }
  requireManifestHashMatch(registryGlobal.deployment_manifest_hash, 'UsernameRegistry');
  const officialWallet = requireBasechainAddress(registryGlobal.official_ath_wallet_address, 'UsernameRegistry official ATH wallet');
  const derivedWallet = requireBasechainAddress(derivedOfficialWallet, 'UsernameRegistry derived ATH wallet');
  if (officialWallet !== derivedWallet) {
    throw new Error('UsernameRegistry official ATH wallet is not the derived registry wallet');
  }
  return registry;
}

async function estimateVaultPublicPublishHoldNanotons(provider, owner, partCount) {
  if (!provider?.getCanonicalPublishCharge) {
    throw new Error('Vault chain provider cannot price avatar publish');
  }
  const canonical = await provider.getCanonicalPublishCharge(
    owner,
    VAULT_PUBLISH_KIND.PUBLIC,
    VAULT_SIZE_CLASS.STANDARD,
    VAULT_CRYPTO_SUITE.PUBLIC_NONE,
    { vaultAddress: requireVaultAddress(), verify: true, priority: 'critical', cacheTtlMs: 0 },
  );
  return (BigInt(canonical) + currentNetworkFeeSurchargeNanotons()) * BigInt(Math.max(1, Number(partCount)));
}

async function assertVaultProfileAvatarCanStart(owner, partCount) {
  const provider = await resolveVaultChainProvider();
  const options = { provider, ...criticalChainReadOptions() };
  const [user, global] = await Promise.all([
    loadConnectedVaultUser(options),
    loadConnectedVaultGlobal(options),
  ]);
  await requireProfileRegistryVaultRoute(global);
  if (user.exists !== true || BigInt(user.current_key_id ?? 0n) === 0n) {
    throw new Error('Activate Platho account before setting an avatar');
  }
  if (!localIdentity?.signingSecretKey) {
    throw new Error('Local Platho signing key is not ready');
  }
  const publishHold = await estimateVaultPublicPublishHoldNanotons(provider, owner, partCount);
  const totalTonHold = publishHold + PROFILE_AVATAR_VAULT_TON_CHARGE_NANOTONS;
  const vaultTon = vaultTonBalanceNanotons(user);
  const vaultAth = nonNegativeBigInt(user.ath_balance ?? user.athBalance ?? 0n);
  if (vaultTon < totalTonHold) {
    throw new Error(`Not enough Vault TON: need ${formatTonNanotons(totalTonHold)} TON hold, have ${formatTonNanotons(vaultTon)} TON`);
  }
  if (vaultAth < PROFILE_AVATAR_PRICE_ATH) {
    throw new Error(`Not enough Vault ATH: need ${formatAthAtomic(PROFILE_AVATAR_PRICE_ATH)} ATH, have ${formatAthAtomic(vaultAth)} ATH`);
  }
  rememberConnectedVaultUser(user);
  return { user, global, publishHold, totalTonHold, vaultTon, vaultAth };
}

async function assertVaultUsernameMintCanStart(owner, username, priceAtomic) {
  const provider = await resolveVaultChainProvider();
  const options = { provider, ...criticalChainReadOptions() };
  const [user, global] = await Promise.all([
    loadConnectedVaultUser(options),
    loadConnectedVaultGlobal(options),
  ]);
  await requireUsernameRegistryVaultRoute(global);
  if (user.exists !== true || BigInt(user.current_key_id ?? 0n) === 0n) {
    throw new Error('Activate Platho account before minting a username');
  }
  if (!localIdentity?.signingSecretKey) {
    throw new Error('Local Platho signing key is not ready');
  }
  const vaultTon = vaultTonBalanceNanotons(user);
  const vaultAth = nonNegativeBigInt(user.ath_balance ?? user.athBalance ?? 0n);
  if (vaultTon < USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS) {
    throw new Error(`Not enough Vault TON: need ${formatTonNanotons(USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS)} TON hold, have ${formatTonNanotons(vaultTon)} TON`);
  }
  if (vaultAth < priceAtomic) {
    throw new Error(`Not enough Vault ATH: need ${formatAthAtomic(priceAtomic)} ATH, have ${formatAthAtomic(vaultAth)} ATH`);
  }
  rememberConnectedVaultUser(user);
  return { user, global, username, priceAtomic, vaultTon, vaultAth };
}

async function submitVaultProfileAvatarRegistration({ owner, avatarHash, avatarEntryId, avatarStreamId, avatarPartCount, mediaFormat }) {
  requireNoPendingServiceWorkerAppShellReload();
  const provider = await resolveVaultChainProvider();
  const options = { provider, ...criticalChainReadOptions() };
  const [global, rawUser] = await Promise.all([
    loadConnectedVaultGlobal(options),
    loadConnectedVaultUser(options),
  ]);
  const registry = await requireProfileRegistryVaultRoute(global);
  const user = rememberConnectedVaultUser(rawUser);
  if (user.exists !== true || BigInt(user.current_key_id ?? 0n) === 0n) {
    throw new Error('Activate Platho account before setting an avatar');
  }
  if (!localIdentity?.signingSecretKey) {
    throw new Error('Local Platho signing key is not ready');
  }
  const vaultTon = vaultTonBalanceNanotons(user);
  const vaultAth = nonNegativeBigInt(user.ath_balance ?? user.athBalance ?? 0n);
  if (vaultTon < PROFILE_AVATAR_VAULT_TON_CHARGE_NANOTONS) {
    throw new Error(`Not enough Vault TON: need ${formatTonNanotons(PROFILE_AVATAR_VAULT_TON_CHARGE_NANOTONS)} TON hold, have ${formatTonNanotons(vaultTon)} TON`);
  }
  if (vaultAth < PROFILE_AVATAR_PRICE_ATH) {
    throw new Error(`Not enough Vault ATH: need ${formatAthAtomic(PROFILE_AVATAR_PRICE_ATH)} ATH, have ${formatAthAtomic(vaultAth)} ATH`);
  }
  const clientNonce = BigInt(user.publish_nonce ?? user.publishNonce ?? 0n);
  const external = await buildVaultProfileAvatarExternalBoc({
    owner_wallet: owner,
    client_nonce: clientNonce,
    max_ton_charge: PROFILE_AVATAR_VAULT_TON_CHARGE_NANOTONS,
    profile_registry_address: registry,
    avatar_hash: uint256HexToBigInt(avatarHash, 'avatar_hash'),
    avatar_entry_id: avatarEntryId,
    avatar_stream_id: avatarStreamId,
    avatar_part_count: avatarPartCount,
    media_format: mediaFormat,
    signingSecretKey: localIdentity.signingSecretKey,
    deploymentManifestHash: requireVaultDeploymentManifestHash(),
  }, {
    vaultAddress: requireVaultAddress(),
  });
  const result = await sendVaultExternalBoc(external);
  await waitForVaultPublishNonce(provider, owner, clientNonce + 1n);
  globalThis.plathoLastVaultProfileAvatarRegistration = {
    external,
    result,
    clientNonce,
    owner,
    registry,
    avatarHash,
  };
  return { external, result, clientNonce };
}

async function submitVaultUsernameMint({ owner, username, priceAtomic }) {
  requireNoPendingServiceWorkerAppShellReload();
  const provider = await resolveVaultChainProvider();
  const options = { provider, ...criticalChainReadOptions() };
  const [global, rawUser] = await Promise.all([
    loadConnectedVaultGlobal(options),
    loadConnectedVaultUser(options),
  ]);
  const registry = await requireUsernameRegistryVaultRoute(global);
  const user = rememberConnectedVaultUser(rawUser);
  if (user.exists !== true || BigInt(user.current_key_id ?? 0n) === 0n) {
    throw new Error('Activate Platho account before minting a username');
  }
  if (!localIdentity?.signingSecretKey) {
    throw new Error('Local Platho signing key is not ready');
  }
  const vaultTon = vaultTonBalanceNanotons(user);
  const vaultAth = nonNegativeBigInt(user.ath_balance ?? user.athBalance ?? 0n);
  if (vaultTon < USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS) {
    throw new Error(`Not enough Vault TON: need ${formatTonNanotons(USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS)} TON hold, have ${formatTonNanotons(vaultTon)} TON`);
  }
  if (vaultAth < priceAtomic) {
    throw new Error(`Not enough Vault ATH: need ${formatAthAtomic(priceAtomic)} ATH, have ${formatAthAtomic(vaultAth)} ATH`);
  }
  const clientNonce = BigInt(user.publish_nonce ?? user.publishNonce ?? 0n);
  const external = await buildVaultUsernameMintExternalBoc({
    owner_wallet: owner,
    client_nonce: clientNonce,
    max_ton_charge: USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS,
    username_registry_address: registry,
    username,
    signingSecretKey: localIdentity.signingSecretKey,
    deploymentManifestHash: requireVaultDeploymentManifestHash(),
  }, {
    vaultAddress: requireVaultAddress(),
  });
  const result = await sendVaultExternalBoc(external);
  await waitForVaultPublishNonce(provider, owner, clientNonce + 1n);
  globalThis.plathoLastVaultUsernameMint = {
    external,
    result,
    clientNonce,
    owner,
    registry,
    username,
    priceAtomic,
  };
  return { external, result, clientNonce };
}

async function loadConnectedWalletBalances() {
  const [tonResult, athResult] = await Promise.allSettled([
    loadConnectedTonWalletBalance(),
    loadConnectedAthWalletBalance(),
  ]);
  if (tonResult.status === 'rejected') noteTonRpcRateLimit(tonResult.reason);
  if (athResult.status === 'rejected') noteTonRpcRateLimit(athResult.reason);
  return {
    ton_balance: tonResult.status === 'fulfilled' ? tonResult.value : null,
    ath_balance: athResult.status === 'fulfilled' ? athResult.value : null,
  };
}

async function refreshWalletTonBalanceForProfile() {
  if (!plathoWallet?.address) {
    vaultPocketState = {
      wallet: { ton_balance: null, ath_balance: vaultPocketState.wallet?.ath_balance ?? null },
      vault: vaultPocketState.vault ?? { ton_balance: null, ath_balance: null },
    };
    refreshWalletTonProfileStatus();
    return null;
  }
  setText(walletTonBalanceStatus, 'checking');
  const balance = await loadConnectedTonWalletBalance();
  vaultPocketState = {
    wallet: {
      ton_balance: balance,
      ath_balance: vaultPocketState.wallet?.ath_balance ?? null,
    },
    vault: vaultPocketState.vault ?? { ton_balance: null, ath_balance: null },
  };
  refreshWalletTonProfileStatus();
  return balance;
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
  refreshWalletTonProfileStatus();
  refreshVaultMoveWidget();
}

function resetVaultPocketState() {
  vaultPocketState = {
    wallet: { ton_balance: null, ath_balance: null },
    vault: { ton_balance: null, ath_balance: null },
  };
  refreshWalletTonProfileStatus();
  refreshVaultMoveWidget();
}

function applyVaultUserPocketState(user) {
  vaultPocketState = {
    wallet: vaultPocketState.wallet ?? { ton_balance: null, ath_balance: null },
    vault: {
      ton_balance: user?.exists === true ? nonNegativeBigInt(user.ton_balance) : null,
      ath_balance: user?.exists === true ? nonNegativeBigInt(user.ath_balance) : null,
    },
  };
  if (user) {
    globalThis.plathoVaultBinding = {
      ...(globalThis.plathoVaultBinding ?? {}),
      user,
      walletAddress: plathoWallet?.address ?? globalThis.plathoVaultBinding?.walletAddress ?? null,
    };
  }
  refreshWalletTonProfileStatus();
  refreshVaultMoveWidget();
  refreshComposerCostStatus();
  refreshComposerPublishPolicy();
  refreshMessageActionStatuses({ keepSyncStatus: true });
}

async function refreshVaultNavBalanceInBackground() {
  if (!plathoWallet?.address) {
    delete globalThis.plathoVaultBinding;
    resetVaultPocketState();
    return null;
  }
  const user = await loadConnectedVaultUser();
  applyVaultUserPocketState(user);
  return user;
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
  const balance = vaultMoveBalance(pocket, asset) ?? 0n;
  return asset === 'ATH'
    ? formatAthAtomic(balance)
    : formatTonNanotons(balance);
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

function refreshNavVaultBalance() {
  const tonBalance = `${vaultMoveFormattedBalance('vault', 'TON')} TON`;
  const athBalance = `${vaultMoveFormattedBalance('vault', 'ATH')} ATH`;
  for (const node of navVaultTonBalances) setText(node, tonBalance);
  for (const node of navVaultAthBalances) setText(node, athBalance);
}

function refreshVaultMoveWidget() {
  refreshNavVaultBalance();
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
    vaultProtocolState = {
      airdrop_remaining_ath: VAULT_ACTIVITY_AIRDROP_TOTAL_ATH_ATOMIC,
      airdrop_total_allocation_ath: VAULT_ACTIVITY_AIRDROP_TOTAL_ATH_ATOMIC,
      profile_registry_bound: false,
      profile_registry_address: null,
      username_registry_bound: false,
      username_registry_address: null,
    };
    renderAthProfileStats();
    renderVaultCards(appConfig.ui?.vaultCards ?? []);
    resetVaultPocketState();
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
  } else {
    noteTonRpcRateLimit(globalResult.reason);
  }
  vaultProtocolState = {
    airdrop_remaining_ath: global?.airdrop_remaining_ath ?? null,
    airdrop_total_allocation_ath: global?.airdrop_total_allocation_ath ?? VAULT_ACTIVITY_AIRDROP_TOTAL_ATH_ATOMIC,
    profile_registry_bound: global?.profile_registry_bound === true,
    profile_registry_address: global?.profile_registry_address ?? null,
    username_registry_bound: global?.username_registry_bound === true,
    username_registry_address: global?.username_registry_address ?? null,
  };
  renderAthProfileStats();
  renderVaultPocketCards(walletBalances, user);
  refreshComposerCostStatus();
  if (user) {
    setVaultStatus(user.exists === true ? 'synced' : 'Vault setup required');
    globalThis.plathoVaultBinding = {
      ...(globalThis.plathoVaultBinding ?? {}),
      user,
      walletAddress: plathoWallet.address,
    };
    refreshComposerPublishPolicy();
    return user;
  }
  if (isExpectedVaultProviderUnavailable(userError)) {
    setVaultStatus(vaultProviderStatusForError(userError));
    return null;
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
      total_supply: data?.total_supply === null || data?.total_supply === undefined
        ? null
        : nonNegativeBigInt(data.total_supply),
    };
    renderAthProfileStats();
    return athProtocolState;
  } catch (error) {
    noteTonRpcRateLimit(error);
    return athProtocolState;
  }
}

function queueAthProtocolStatsRefresh() {
  refreshAthProtocolStats().catch(() => {});
  for (const delayMs of VAULT_POST_TRANSACTION_REFRESH_DELAYS_MS) {
    setTimeout(() => refreshAthProtocolStats().catch(() => {}), delayMs);
  }
}

function isVaultViewActive() {
  return appShell?.dataset?.view === 'vault';
}

function clearVaultAutoRefreshTimer() {
  if (!vaultAutoRefreshTimer) return;
  clearTimeout(vaultAutoRefreshTimer);
  vaultAutoRefreshTimer = null;
}

function scheduleVaultAutoRefresh(delayMs = VAULT_AUTO_REFRESH_MS) {
  clearVaultAutoRefreshTimer();
  if (document.hidden || !plathoWallet?.address) return;
  const effectiveDelayMs = delayMs === VAULT_AUTO_REFRESH_MS && !isVaultViewActive()
    ? VAULT_NAV_BACKGROUND_REFRESH_MS
    : delayMs;
  vaultAutoRefreshTimer = setTimeout(() => {
    vaultAutoRefreshTimer = null;
    if (isVaultViewActive()) {
      refreshVaultNow({ includeActivation: false }).catch((error) => {
        const rateLimited = noteTonRpcRateLimit(error);
        setVaultStatus(rateLimited ? 'RPC busy, retrying' : 'sync blocked');
        if (!isExpectedVaultProviderUnavailable(error)) console.error(error);
      });
      return;
    }
    refreshVaultNavBalanceInBackground()
      .catch((error) => {
        const rateLimited = noteTonRpcRateLimit(error);
        if (!rateLimited && !isExpectedVaultProviderUnavailable(error)) console.error(error);
      })
      .finally(() => scheduleVaultAutoRefresh());
  }, effectiveDelayMs);
}

async function refreshVaultNow({ includeActivation = false, includeStats = false } = {}) {
  if (vaultRefreshPromise) return vaultRefreshPromise;
  vaultRefreshPromise = (async () => {
    const results = [];
    const dashboardResult = await Promise.allSettled([refreshVaultDashboard()]);
    results.push(...dashboardResult);
    const dashboardUser = dashboardResult[0]?.status === 'fulfilled'
      ? dashboardResult[0].value
      : null;
    const jobs = [];
    if (includeActivation) {
      jobs.push(refreshVaultActivationStatus(
        dashboardUser ? { user: dashboardUser, skipGlobal: true } : {},
      ));
    }
    if (includeStats) jobs.push(refreshAthProtocolStats());
    if (jobs.length > 0) results.push(...await Promise.allSettled(jobs));
    const rejected = results.find((result) => result.status === 'rejected');
    if (rejected) throw rejected.reason;
  })();
  try {
    return await vaultRefreshPromise;
  } finally {
    vaultRefreshPromise = null;
    scheduleVaultAutoRefresh();
  }
}

function queueVaultPostTransactionRefresh() {
  refreshVaultNow({ includeActivation: true }).catch((error) => {
    if (noteTonRpcRateLimit(error)) setVaultStatus('RPC busy, retrying');
    if (!isExpectedVaultProviderUnavailable(error)) console.error(error);
  });
  for (const delayMs of VAULT_POST_TRANSACTION_REFRESH_DELAYS_MS) {
    setTimeout(() => {
      if (!plathoWallet?.address) return;
      refreshVaultNow({ includeActivation: false }).catch((error) => {
        if (noteTonRpcRateLimit(error)) setVaultStatus('RPC busy, retrying');
        if (!isExpectedVaultProviderUnavailable(error)) console.error(error);
      });
    }, delayMs);
  }
}

function queueVaultRefreshAfterWalletChange() {
  refreshVaultNow({ includeActivation: true, includeStats: true }).catch((error) => {
    if (noteTonRpcRateLimit(error)) setVaultStatus('RPC busy, retrying');
    if (!isExpectedVaultProviderUnavailable(error)) console.error(error);
  });
}

async function resolveUsernameRegistryProvider() {
  const provider = globalThis.plathoUsernameRegistryProvider
    ?? createUsernameRegistryTonRpcProvider({ usernameRegistryAddress: requireUsernameRegistryAddress() });
  if (!provider?.getUsernamePrice || !provider?.getRefundDue) {
    throw new Error('UsernameRegistry provider is not configured');
  }
  return provider;
}

async function resolveUsernameNftItemProvider() {
  const provider = globalThis.plathoUsernameNftItemProvider
    ?? createUsernameNftItemTonRpcProvider({});
  if (!provider?.getState) {
    throw new Error('UsernameNFTItem provider is not configured');
  }
  return provider;
}

async function resolvePlathoUsernameOwner(label) {
  const username = normalizeUsernameInput(label);
  const displayLabel = `${username}.ath`;
  const registryAddress = requireUsernameRegistryAddress();
  const registryProvider = await resolveUsernameRegistryProvider();
  if (!registryProvider?.getNameRecordByUsername || !registryProvider?.getNameRecord) {
    throw new Error('UsernameRegistry provider cannot resolve .ath names');
  }
  const record = await registryProvider.getNameRecordByUsername(displayLabel, {
    address: registryAddress,
    ...criticalChainReadOptions(),
  });
  if (record.exists !== true) throw new Error(`${displayLabel} is not registered`);

  const itemProvider = await resolveUsernameNftItemProvider();
  const proof = await resolveAuthoritativeUsernameItemOwnership({
    registryProvider,
    itemProvider,
    itemAddress: record.item_address,
    registryAddress,
    registryCallOptions: { address: registryAddress, ...criticalChainReadOptions() },
    itemCallOptions: { address: record.item_address, ...criticalChainReadOptions() },
  });
  if (proof.authoritative !== true || !proof.owner_wallet) {
    throw new Error(`${displayLabel} ownership is not authoritative`);
  }
  return {
    label: displayLabel,
    ownerWallet: requireBasechainAddress(proof.owner_wallet, `${displayLabel} owner`),
    record,
    proof,
  };
}

async function waitForPlathoUsernameOwnership(label, ownerWallet) {
  const expectedOwner = requireBasechainAddress(ownerWallet, 'Expected username owner');
  let lastError = null;
  for (let attempt = 0; attempt < USERNAME_MINT_CONFIRM_ATTEMPTS; attempt += 1) {
    try {
      const identity = await resolvePlathoUsernameOwner(label);
      if (sameWalletAddress(identity.ownerWallet, expectedOwner)) return identity;
      throw new Error(`${identity.label} belongs to another wallet`);
    } catch (error) {
      lastError = error;
      await delay(USERNAME_MINT_CONFIRM_DELAY_MS);
    }
  }
  throw lastError ?? new Error('Username mint is not visible on-chain yet');
}

async function autoLinkMintedUsername(username, ownerWallet) {
  const owner = requireBasechainAddress(ownerWallet, 'Connected wallet');
  setText(identitySubtitle, `${username}.ath confirming`);
  const identity = await waitForPlathoUsernameOwnership(username, owner);
  if (!plathoWallet?.address || !sameWalletAddress(plathoWallet.address, owner)) return null;
  const linked = {
    mode: WALLET_DISPLAY_MODES.PLATHO_NFT,
    label: identity.label,
    verified_at: Date.now(),
  };
  writeLinkedPlathoUsername(linked, owner);
  writeWalletDisplayIdentity(linked, owner);
  if (walletDisplayModeSelect) walletDisplayModeSelect.value = WALLET_DISPLAY_MODES.PLATHO_NFT;
  flashWalletIdentityStatus(`Linked ${identity.label}`);
  return linked;
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
    ...criticalChainReadOptions(),
  });
  return requireBasechainAddress(walletAddress, 'Connected ATH wallet');
}

async function resolveRecipientWalletForThread(thread) {
  const variants = threadIdentityVariants(thread);
  const walletIdentity = variants.find((identity) => identity.type === 'wallet_address');
  if (walletIdentity) return requireBasechainAddress(walletIdentity.value, 'Payment recipient');

  const plathoIdentity = variants.find((identity) => identity.type === 'platho_nft');
  if (plathoIdentity) {
    const resolved = await resolvePlathoUsernameOwner(plathoIdentity.value);
    return requireBasechainAddress(resolved.ownerWallet, 'Payment recipient');
  }

  const tonDnsIdentity = variants.find((identity) => identity.type === 'ton_dns');
  if (tonDnsIdentity) {
    const provider = await resolveTonDnsProvider();
    if (!provider?.resolveWallet) throw new Error('TON DNS provider is not configured');
    const walletAddress = await provider.resolveWallet(tonDnsIdentity.value, {
      rootAddress: appConfig.tonDns?.rootAddress ?? null,
      ...criticalChainReadOptions(),
    });
    return requireBasechainAddress(walletAddress, 'Payment recipient');
  }

  throw new Error('Recipient wallet route is not available');
}

async function resolveRecipientPeerEntry(thread, options = {}) {
  const walletAddress = await resolveRecipientWalletForThread(thread);
  const requestedSuite = options.suite === undefined || options.suite === null
    ? null
    : normalizeCryptoSuite(options.suite);
  const provider = await resolveVaultChainProvider();
  if (!provider?.getUser || !provider?.getKeyRecord) {
    throw new Error('Vault provider cannot resolve recipient key record');
  }
  const recipientReadOptions = { vaultAddress: requireVaultAddress(), ...criticalChainReadOptions() };
  const user = await provider.getUser(walletAddress, recipientReadOptions);
  const currentKeyId = BigInt(user.current_key_id ?? 0n);
  if (user.exists !== true || currentKeyId === 0n) {
    throw new Error('Recipient is not activated in Platho');
  }
  const keyRecord = await provider.getKeyRecord(currentKeyId, {
    ownerWallet: walletAddress,
    ...recipientReadOptions,
  });
  rememberKnownVaultKeyOwner(walletAddress, keyRecord);
  const publicBundle = await publicKeyBundleFromVaultKeyRecord(keyRecord, {
    ownerWallet: walletAddress,
    suite: requestedSuite,
  });
  return {
    walletAddress,
    user,
    keyRecord,
    currentKeyId,
    publicBundle,
  };
}

async function submitVaultMessage(type, params, options = {}) {
  requireNoPendingServiceWorkerAppShellReload();
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
  requireNoPendingServiceWorkerAppShellReload();
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
  requireNoPendingServiceWorkerAppShellReload();
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
    notify_value: 32_000_000n,
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
    ...criticalChainReadOptions(),
  });
  const priceAtomic = BigInt(price?.price_ath_atomic ?? 0n);
  if (price?.valid_length !== true || priceAtomic <= 0n) {
    throw new Error('UsernameRegistry rejected this username length');
  }
  await assertVaultUsernameMintCanStart(owner, username, priceAtomic);
  setText(identitySubtitle, 'username signing through Vault');
  const result = await submitVaultUsernameMint({
    owner,
    username,
    priceAtomic,
  });
  flashWalletIdentityStatus(`${username}.ath mint submitted`);
  autoLinkMintedUsername(username, owner).catch((error) => {
    flashWalletIdentityStatus('mint submitted; link after sync');
    console.error(error);
  });
  return result;
}

async function submitUsernameRefundFlush() {
  const owner = requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  const provider = await resolveUsernameRegistryProvider();
  const refundDue = await provider.getRefundDue(owner, {
    address: requireUsernameRegistryAddress(),
  });
  if (BigInt(refundDue ?? 0n) <= 0n) {
    flashWalletIdentityStatus('no username refund');
    return null;
  }
  setText(identitySubtitle, 'refund signing');
  const result = await submitUsernameRegistryMessage('FlushAthRefundDue', {
    query_id: nextQueryId(),
    owner_wallet: owner,
  });
  flashWalletIdentityStatus('refund submitted');
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
  queueAthProtocolStatsRefresh();
  flashWalletIdentityStatus('ATH burn submitted');
  return result;
}

async function submitProfileAvatarUpdate(avatar) {
  const owner = requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  if (!avatar?.bytes?.length) return null;
  setText(identitySubtitle, 'avatar version checking');
  const currentPointer = await readCurrentProfileAvatarPointerFromChain(owner, { required: true });
  const parts = imagePartsForSend(avatar, 'profile avatar');
  if (parts.length <= 0) throw new Error('Avatar image is empty');
  if (parts.length > 16) throw new Error('Avatar must fit 16 public capsules');

  let streamId = randomBytes(16);
  const createdAtSec = Math.floor(Date.now() / 1000);
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
      createdAtSec,
      profileVersion: nextVersion,
      avatarHash,
    }, { maxBytes: SINGLE_CAPSULE_USEFUL_BYTES }));
  }

  setText(identitySubtitle, 'avatar Vault balance checking');
  try {
    await assertVaultProfileAvatarCanStart(owner, parts.length);
  } catch (error) {
    const rateLimited = noteTonRpcRateLimit(error);
    setText(identitySubtitle, rateLimited ? TON_RPC_CONNECTING_STATUS : String(error?.message ?? 'avatar blocked'));
    throw error;
  }

  writeProfileAvatarMediaCache(avatarHash, bytesToImageDataUrl(avatar.bytes, 'image/webp'));
  const pendingPointer = {
    profileVersion: nextVersion,
    avatarHash,
    avatarStreamId: `0x${bytesToHex(streamId)}`,
    avatarPartCount: parts.length,
  };
  setText(identitySubtitle, 'avatar checking chain');
  let publishResult = null;
  let confirmed = await findPublishedAvatarEntries(owner, {
    ...pendingPointer,
    avatarStreamId: null,
  }).catch((error) => {
    if (!noteTonRpcRateLimit(error)) console.error(error);
    return null;
  });
  if (confirmed?.streamId) streamId = bigIntToFixedBytes(BigInt(confirmed.streamId), 16, 'avatar stream id');
  if (confirmed) {
    setText(identitySubtitle, 'avatar already published');
  } else {
    setText(identitySubtitle, 'avatar publishing');
    publishResult = await publishPublicPayloadParts(payloads, `profile-avatar-${Date.now()}`);
    if (publishResult?.status !== CAPSULEHUB_PUBLISH_STATUS_CONFIRMED && publishResult?.status !== VAULT_PUBLISH_STATUS_SUBMITTED) {
      flashWalletIdentityStatus('avatar publish blocked');
      return publishResult;
    }
    setText(identitySubtitle, 'avatar confirming');
    confirmed = await waitForPublishedAvatarEntries(owner, pendingPointer);
  }

  setText(identitySubtitle, 'avatar Vault signing');
  const result = await submitVaultProfileAvatarRegistration({
    owner,
    avatarHash,
    avatarEntryId: confirmed.firstEntryId,
    avatarStreamId: bytesToBigIntValue(streamId),
    avatarPartCount: BigInt(parts.length),
    mediaFormat: PUBLIC_BODY_MEDIA_FORMATS.WEBP,
  });
  let registryPointer = null;
  let registryError = null;
  try {
    setText(identitySubtitle, 'avatar registry confirming');
    registryPointer = await waitForProfileAvatarRegistryUpdate(owner, avatarHash);
    writeStoredProfileAvatarPointer(registryPointer, owner);
    setAvatarNode(profileAvatar, 'P', confirmed.imageUrl);
    flashWalletIdentityStatus(`avatar active (${formatAthAtomic(PROFILE_AVATAR_PRICE_ATH)} ATH)`);
  } catch (error) {
    registryError = error;
    console.error(error);
    await refreshOwnProfileAvatar().catch((refreshError) => console.error(refreshError));
    setText(identitySubtitle, 'avatar not active yet');
    flashWalletIdentityStatus('avatar registration not confirmed');
  }
  globalThis.plathoLastProfileAvatarUpdate = {
    avatarHash,
    streamId: `0x${bytesToHex(streamId)}`,
    parts: parts.length,
    firstEntryId: confirmed.firstEntryId.toString(),
    payloads,
    publishResult,
    result,
    registryPointer,
    registryPending: !registryPointer,
    registryError: registryError ? String(registryError?.message ?? registryError) : null,
  };
  return result;
}

async function submitCreatePaymentCheck() {
  const thread = activeThread();
  if (!thread || thread.readOnly) throw new Error('Payment checks are only available in private chats');
  if (!localIdentity) throw new Error('Local encryption identity is not ready');
  const recipientEntry = await resolveRecipientPeerEntry(thread, { suite: currentOutgoingPrivateSuite() });
  const recipientWallet = recipientEntry.walletAddress;

  const paymentDetails = await requestPaymentCheckDetails();
  if (!paymentDetails) return null;
  const { asset, amount } = paymentDetails;

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
  const payment = normalizePaymentForMessage({
    asset,
    amount,
    intentId,
    secret32Bytes,
  });
  const senderOptions = currentPrivateSenderOptions();
  const senderVaultKeyId = currentVaultMessagingKeyId();
  const senderMetadata = senderOptions.includeSenderWalletMetadata === false
    ? {}
    : {
      senderWallet,
      senderVaultKeyId: senderVaultKeyId ?? undefined,
    };
  const payloadBytes = encodeCompactPayload({
    type: 'payment',
    asset: Number(asset),
    amount,
    intentId: bigIntToFixedBytes(intentId, 32, 'intent id'),
    secret32: secret32Bytes,
    ...senderMetadata,
  });
  const capsule = await createEncryptedPrivateCapsuleFromPublicBundle('', recipientEntry.publicBundle, localIdentity, {
    payloadBytes,
    threadId: activeThreadId,
    ...currentProfilePointerFields(),
  });
  const publishState = createCapsulePublishState([capsule]);
  setText(identitySubtitle, 'check pricing');
  const preparedPublish = await prepareCapsulesThroughVault([capsule], { publishState });
  const preparedUser = preparedPublish.user ?? {};
  const tonBalance = BigInt(preparedUser.ton_balance ?? preparedUser.tonBalance ?? 0n);
  const athBalance = BigInt(preparedUser.ath_balance ?? preparedUser.athBalance ?? 0n);
  if (asset === RECEIVE_ASSETS.TON) {
    if (tonBalance < amount + preparedPublish.totalMaxCharge) {
      throw new Error('Not enough Vault TON for payment check and private publish hold');
    }
  } else {
    if (athBalance < amount) throw new Error(`Not enough ${paymentAssetLabel(asset)} in Vault`);
    if (tonBalance < preparedPublish.totalMaxCharge) {
      throw new Error('Not enough Vault TON for payment check private publish hold');
    }
  }

  const message = {
    type: 'out',
    text: paymentMessageText(payment),
    meta: 'check intent create pending',
    ...localMessageOrderFields(),
    payment,
    capsule,
    publishState,
  };
  if (!encryptedMessageStore || encryptedMessageStore.persistent === false) {
    throw new Error('Persistent encrypted local history is required before creating a payment check');
  }
  insertThreadMessage(thread, message);
  refreshThreadAfterMessageChange(thread);
  renderThreads();
  renderConversation();
  const storedRecovery = await persistMessageToEncryptedHistory(thread, message);
  if (!storedRecovery && !message.localHistoryId) {
    thread.messages = (thread.messages ?? []).filter((item) => item !== message);
    refreshThreadAfterMessageChange(thread);
    renderThreads();
    renderConversation();
    throw new Error('Payment check recovery record could not be saved');
  }

  let createResult = null;
  let intentCreateSubmitted = false;
  try {
    setText(identitySubtitle, 'check signing');
    createResult = await submitVaultMessage('CreateReceiveIntent', {
      asset,
      amount,
      recipient_wallet: recipientWallet,
      commitment,
      client_nonce: clientNonce,
    });
    intentCreateSubmitted = true;
    message.vaultCreateIntent = createResult;
    message.meta = 'check created, publishing';
    await updateMessageInEncryptedHistory(thread, message);
    const publishResult = await sendPreparedCapsulesThroughVault(preparedPublish, {
      publishState,
      onPartState: () => {
        message.meta = `check ${publishStateMeta(publishState)}`;
        updateMessageInEncryptedHistory(thread, message).catch((error) => console.error(error));
        renderConversation();
      },
    });
    message.vaultPublish = publishResult;
    message.publishState = publishResult.publishState ?? publishState;
    message.meta = publishResult.status === CAPSULEHUB_PUBLISH_STATUS_CONFIRMED
      ? 'check published'
      : 'check submitted, confirming';
  } catch (error) {
    const cancelled = isPublishPriceChangeCancelled(error);
    const partial = isVaultPublishPartialError(error);
    if (!intentCreateSubmitted) {
      message.meta = 'check intent create failed';
    } else if (partial) {
      message.vaultPublish = error.publishResult;
      message.publishState = error.publishResult?.publishState ?? message.publishState;
      message.meta = `check ${publishStateMeta(message.publishState)}`;
    } else {
      const cancelResult = await attemptCancelPaymentCheckAfterPublishFailure(payment).catch((cancelError) => {
        console.error(cancelError);
        return null;
      });
      message.vaultCancelIntent = cancelResult;
      message.meta = cancelResult
        ? (cancelled ? 'check cancelled before publish' : 'check publish failed, intent cancelled')
        : (cancelled ? 'check publish cancelled, cancel required' : 'check locked, cancel required');
    }
    refreshMessagingControls();
    if (!cancelled && !partial) console.error(error);
    await updateMessageInEncryptedHistory(thread, message);
  }

  refreshThreadAfterMessageChange(thread);
  await updateMessageInEncryptedHistory(thread, message);
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
  flashWalletIdentityStatus('check claimed');
  return result;
}

async function submitVaultCancelPaymentCheck(payment) {
  setText(identitySubtitle, 'cancel signing');
  const result = await submitVaultMessage('CancelReceiveIntent', {
    intent_id: paymentIntentId(payment),
  });
  flashWalletIdentityStatus('check cancelled');
  return result;
}

async function attemptCancelPaymentCheckAfterPublishFailure(payment) {
  if (!payment) return null;
  setText(identitySubtitle, 'check auto-cancelling');
  return submitVaultCancelPaymentCheck(payment);
}

async function submitVaultRegisterMessagingKeys() {
  if (!localVaultDraft?.message) throw new Error('Local messaging key draft is not ready');
  const user = await loadConnectedVaultUser();
  if (user.current_key_id && BigInt(user.current_key_id) !== 0n) {
    vaultDraftStatus.textContent = 'active';
    return null;
  }
  if (!(await confirmPlathoAccountActivation(user))) return null;
  downloadEncryptedWalletKeyBackup();
  vaultDraftStatus.textContent = 'signing';
  const result = await submitVaultMessage('RegisterMessagingKeys', localVaultDraft.message, {
    userExists: user.exists === true,
  });
  vaultDraftStatus.textContent = 'activation sent';
  queueVaultPostTransactionRefresh();
  return result;
}

async function confirmPlathoAccountActivation(user) {
  const fee = plathoAccountActivationFeeNanotons(user);
  const walletBalance = await refreshWalletTonBalanceForProfile().catch(() => null);
  let feedback = 'Export the encrypted wallet key, then send the account activation transaction.';
  let tone = 'muted';
  if (walletBalance !== null && walletBalance < fee) {
    feedback = `Wallet TON is below the ${formatTonNanotons(fee)} TON activation transaction value. Receive TON first.`;
    tone = 'error';
  }
  const result = await openActionDialog({
    title: 'Activate Platho account',
    hint: feedback,
    tone,
    submitLabel: 'Export key and activate',
    dismissOnBackdrop: false,
    fields: [
      {
        id: 'backupConfirmed',
        type: 'checkbox',
        label: 'I understand this will download my encrypted wallet key backup before activation.',
      },
      {
        id: 'activationConfirmed',
        type: 'checkbox',
        label: 'I understand activation sends an on-chain Vault transaction and publishes the public keys needed for Platho messaging.',
      },
    ],
    summary: [
      { label: 'Wallet TON', value: walletBalance === null ? 'unknown' : `${formatTonNanotons(walletBalance)} TON` },
      { label: 'Activation tx value', value: `${formatTonNanotons(fee)} TON` },
      { label: 'Backup', value: 'encrypted wallet key JSON, protected by the local password' },
      { label: 'After activation', value: 'private/public messaging, Vault, .ath name and avatar tabs unlock' },
    ],
  });
  return result?.backupConfirmed === true && result?.activationConfirmed === true;
}

async function submitVaultReplaceMessagingKeys() {
  if (!localVaultDraft?.message) throw new Error('Local messaging key draft is not ready');
  const user = await loadConnectedVaultUser();
  const currentKeyId = BigInt(user.current_key_id ?? 0n);
  if (user.exists !== true || currentKeyId === 0n) {
    setText(vaultRotateStatus, 'activate account first');
    return null;
  }
  setText(vaultRotateStatus, 'signing');
  const result = await submitVaultMessage('ReplaceMessagingKeys', localVaultDraft.message, {
    userExists: true,
  });
  setText(vaultRotateStatus, 'key update sent');
  return result;
}

const VAULT_PUBLISH_STATUS_SUBMITTED = 'vault-publish-submitted';
const VAULT_PUBLISH_STATUS_PARTIAL = 'vault-publish-partial';
const CAPSULEHUB_PUBLISH_STATUS_CONFIRMED = 'capsulehub-publish-confirmed';
const PUBLISH_PART_STATUS_BUILT = 'built';
const PUBLISH_PART_STATUS_SENDING = 'sending';
const PUBLISH_PART_STATUS_SENT = 'sent';
const PUBLISH_PART_STATUS_VAULT_SUBMITTED = 'vault_submitted';
const PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED = 'capsulehub_confirmed';
const PUBLISH_PART_STATUS_FAILED = 'failed';
const PUBLISH_PART_STATUS_UNKNOWN = 'unknown';
const VAULT_PUBLISH_PARTIAL_ERROR_CODE = 'PLATHO_VAULT_PUBLISH_PARTIAL';
const CAPSULEHUB_PUBLISH_CONFIRM_SCAN_LIMIT = 120;

function publishHashPlain(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase().replace(/^0x/, '');
    if (/^[0-9a-f]+$/.test(text)) return text.padStart(64, '0');
  }
  try {
    return BigInt(value).toString(16).padStart(64, '0');
  } catch {
    return null;
  }
}

function publishPartFromCapsule(capsule, index, total) {
  const publish = capsule.publish ?? {};
  const isPublic = BigInt(publish.publish_kind ?? 0n) === VAULT_PUBLISH_KIND.PUBLIC;
  return {
    capsuleId: capsule.id ?? null,
    index,
    partCount: total,
    status: PUBLISH_PART_STATUS_BUILT,
    publishKind: isPublic ? 'public' : 'private',
    sizeClass: Number(publish.size_class ?? 1),
    cryptoSuite: Number(publish.crypto_suite ?? 0),
    bodyHash: publishHashPlain(publish.body_hash),
    header0Hash: publishHashPlain(publish.header_0_hash ?? publish.header_hash),
    header1Hash: publishHashPlain(publish.header_1_hash),
    entryId: null,
    error: null,
  };
}

function createCapsulePublishState(capsules) {
  const normalized = (capsules ?? []).filter(Boolean);
  return {
    status: 'built',
    partCount: normalized.length,
    confirmedCount: 0,
    submittedCount: 0,
    updatedAt: new Date().toISOString(),
    parts: normalized.map((capsule, index) => publishPartFromCapsule(capsule, index, normalized.length)),
  };
}

function setPublishPartStatus(publishState, index, status, extra = {}) {
  const part = publishState?.parts?.[index];
  if (!part) return null;
  Object.assign(part, extra, { status });
  publishState.submittedCount = publishState.parts.filter((item) => (
    item.status === PUBLISH_PART_STATUS_VAULT_SUBMITTED
    || item.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED
  )).length;
  publishState.confirmedCount = publishState.parts.filter((item) => item.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED).length;
  if (publishState.confirmedCount === publishState.partCount) {
    publishState.status = CAPSULEHUB_PUBLISH_STATUS_CONFIRMED;
  } else if (publishState.submittedCount > 0 || publishState.parts.some((item) => item.status === PUBLISH_PART_STATUS_SENT || item.status === PUBLISH_PART_STATUS_UNKNOWN)) {
    publishState.status = VAULT_PUBLISH_STATUS_SUBMITTED;
  } else if (publishState.parts.some((item) => item.status === PUBLISH_PART_STATUS_FAILED)) {
    publishState.status = 'failed';
  }
  publishState.updatedAt = new Date().toISOString();
  return part;
}

function publishStatePendingCount(publishState) {
  return (publishState?.parts ?? []).filter((item) => (
    item.status === PUBLISH_PART_STATUS_SENT
    || item.status === PUBLISH_PART_STATUS_UNKNOWN
    || item.status === PUBLISH_PART_STATUS_VAULT_SUBMITTED
    || item.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED
  )).length;
}

function notifyPublishState(options, publishState, part) {
  try {
    options?.onPartState?.(part, publishState);
  } catch (error) {
    console.error(error);
  }
}

function publishStateMeta(publishState) {
  const total = Math.max(1, Number(publishState?.partCount) || 1);
  const confirmed = Math.max(0, Number(publishState?.confirmedCount) || 0);
  const submitted = Math.max(0, Number(publishState?.submittedCount) || 0);
  const pending = Math.max(submitted, publishStatePendingCount(publishState));
  if (confirmed >= total) return 'published';
  if (publishState?.status === VAULT_PUBLISH_STATUS_PARTIAL) {
    if (pending <= 0) return 'not sent';
    if (total === 1) return 'submitted, confirming';
    return `partial publish ${pending}/${total}`;
  }
  if (pending > 0 || publishState?.status === VAULT_PUBLISH_STATUS_SUBMITTED) return `submitted ${pending}/${total}, confirming`;
  if (publishState?.status === 'failed') return 'not sent';
  return total > 1 ? `sending ${total} parts` : 'sending';
}

function isVaultPublishPartialError(error) {
  return error?.code === VAULT_PUBLISH_PARTIAL_ERROR_CODE;
}

function vaultPublishPartialError(message, publishResult, cause) {
  const error = new Error(message);
  error.code = VAULT_PUBLISH_PARTIAL_ERROR_CODE;
  error.publishResult = publishResult;
  error.cause = cause;
  return error;
}

function publishEntryMatchesPart(entry, part) {
  if (!entry?.exists || !part) return false;
  if (publishHashPlain(entry.body_hash) !== part.bodyHash) return false;
  if (part.publishKind === 'public') {
    return publishHashPlain(entry.header_hash) === part.header0Hash;
  }
  return publishHashPlain(entry.header_0_hash) === part.header0Hash
    && publishHashPlain(entry.header_1_hash) === part.header1Hash;
}

async function confirmCapsuleHubPublishEntries(publishState) {
  const pendingParts = (publishState?.parts ?? []).filter((part) => (
    part.status === PUBLISH_PART_STATUS_VAULT_SUBMITTED
    || part.status === PUBLISH_PART_STATUS_SENT
    || part.status === PUBLISH_PART_STATUS_UNKNOWN
  ));
  if (pendingParts.length === 0) return publishState;
  const resolved = await resolveCapsuleHubProvider();
  if (!resolved) return publishState;
  const { provider, address } = resolved;
  const readOptions = criticalCapsuleHubReadOptions(address);
  const state = await provider.getState(readOptions);
  const groups = [
    {
      latest: BigInt(state.private_latest_id ?? 0n),
      parts: pendingParts.filter((part) => part.publishKind === 'private'),
      read: (entryId) => provider.getPrivateEntry(entryId, readOptions),
    },
    {
      latest: BigInt(state.public_latest_id ?? 0n),
      parts: pendingParts.filter((part) => part.publishKind === 'public'),
      read: (entryId) => provider.getPublicEntry(entryId, readOptions),
    },
  ];
  for (const group of groups) {
    if (group.parts.length === 0 || group.latest <= 0n) continue;
    const minEntryId = group.latest > BigInt(CAPSULEHUB_PUBLISH_CONFIRM_SCAN_LIMIT)
      ? group.latest - BigInt(CAPSULEHUB_PUBLISH_CONFIRM_SCAN_LIMIT)
      : 0n;
    for (let entryId = group.latest - 1n; entryId >= minEntryId; entryId -= 1n) {
      let entry = null;
      try {
        entry = await group.read(entryId);
      } catch (error) {
        if (noteTonRpcRateLimit(error)) throw error;
        continue;
      }
      for (const part of group.parts) {
        if (part.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED) continue;
        if (!publishEntryMatchesPart(entry, part)) continue;
        setPublishPartStatus(publishState, part.index, PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED, {
          entryId: String(entry.entry_id ?? entryId),
        });
      }
      if (group.parts.every((part) => part.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED)) break;
      if (entryId === 0n) break;
    }
  }
  return publishState;
}

async function publishCapsuleThroughVault(capsule, options = {}) {
  const result = await publishCapsulesThroughVault([capsule], options);
  if (result.status !== CAPSULEHUB_PUBLISH_STATUS_CONFIRMED && result.status !== VAULT_PUBLISH_STATUS_SUBMITTED) return result;
  const first = result.results?.[0] ?? {};
  return {
    status: result.status,
    external: first.external,
    result: first.result,
    maxCharge: result.maxCharge,
    publishState: result.publishState,
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
  const user = await provider.getUser(owner, {
    vaultAddress: requireVaultAddress(),
    verify: true,
    priority: 'critical',
    cacheTtlMs: 0,
  });
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

async function prepareCapsulesThroughVault(capsules, options = {}) {
  requireNoPendingServiceWorkerAppShellReload();
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
  await loadConnectedVaultGlobal({ provider, verify: true, priority: 'critical', cacheTtlMs: 0 });
  const user = await loadConnectedVaultUser({ provider, verify: true, priority: 'critical', cacheTtlMs: 0 });
  if (user.exists !== true || BigInt(user.current_key_id ?? 0n) === 0n) {
    throw new Error('Activate Platho account before publishing');
  }
  if (!localIdentity?.signingSecretKey) {
    throw new Error('Local Platho signing key is not ready');
  }
  assertNetworkFeeSurchargeWithinCap();
  const surcharge = currentNetworkFeeSurchargeNanotons();
  refreshComposerCostStatus();
  const quotedProfiles = composerPublishProfilesForCapsules(normalizedCapsules);
  const quotedHold = composerEstimatedMaxChargeNanotons(quotedProfiles, 1);
  const quotedNetCost = composerEstimatedNetCostNanotons(quotedProfiles, 1);
  const publishState = options.publishState ?? createCapsulePublishState(normalizedCapsules);
  let publishNonce = BigInt(user.publish_nonce ?? user.publishNonce ?? 0n);
  const chargePlans = [];
  let totalMaxCharge = 0n;
  const canonicalChargeCache = new Map();
  for (let index = 0; index < normalizedCapsules.length; index += 1) {
    const capsule = normalizedCapsules[index];
    const publish = capsule.publish;
    const chargeKey = `${publish.publish_kind}:${publish.size_class}:${publish.crypto_suite}`;
    let canonicalMaxCharge = canonicalChargeCache.get(chargeKey);
    if (canonicalMaxCharge === undefined) {
      canonicalMaxCharge = await provider.getCanonicalPublishCharge(
        owner,
        BigInt(publish.publish_kind),
        BigInt(publish.size_class),
        BigInt(publish.crypto_suite),
        { vaultAddress: requireVaultAddress(), verify: true, priority: 'critical', cacheTtlMs: 0 },
      );
      canonicalChargeCache.set(chargeKey, canonicalMaxCharge);
    }
    const maxCharge = BigInt(canonicalMaxCharge) + surcharge;
    totalMaxCharge += maxCharge;
    const messageType = BigInt(publish.publish_kind) === VAULT_PUBLISH_KIND.PUBLIC
      ? 'PublishPublicFromVaultBalance'
      : 'PublishPrivateFromVaultBalance';
    chargePlans.push({ capsuleId: capsule.id, messageType, publish, maxCharge, clientNonce: publishNonce, partIndex: index });
    publishNonce += 1n;
  }
  const balance = BigInt(user.ton_balance ?? user.tonBalance ?? 0n);
  if (balance < totalMaxCharge) {
    throw new Error('Vault TON balance is too low for this publish');
  }
  const finalNetCost = composerNetCostFromHoldNanotons(totalMaxCharge, normalizedCapsules.length);
  if (!(await confirmPublishPriceIncrease({
    previousHold: quotedHold,
    finalHold: totalMaxCharge,
    previousNetCost: quotedNetCost,
    finalNetCost,
    parts: normalizedCapsules.length,
  }))) {
    throw publishPriceChangeCancelledError();
  }
  if (!(await confirmHighNetworkFeeSurcharge({
    surcharge,
    finalHold: totalMaxCharge,
    finalNetCost,
    parts: normalizedCapsules.length,
  }))) {
    throw publishPriceChangeCancelledError();
  }
  const results = [];
  for (const item of chargePlans) {
    const external = await buildVaultBalancePublishExternalBoc(item.messageType, {
      owner_wallet: owner,
      client_nonce: item.clientNonce,
      max_charge: item.maxCharge,
      publish: item.publish,
      signingSecretKey: localIdentity.signingSecretKey,
      deploymentManifestHash: requireVaultDeploymentManifestHash(),
    }, {
      vaultAddress: requireVaultAddress(),
    });
    results.push({
      capsuleId: item.capsuleId,
      external,
      maxCharge: item.maxCharge,
      clientNonce: item.clientNonce,
      partIndex: item.partIndex,
    });
  }
  return {
    normalizedCapsules,
    provider,
    owner,
    user,
    publishState,
    results,
    totalMaxCharge,
    finalNetCost,
  };
}

async function sendPreparedCapsulesThroughVault(prepared, options = {}) {
  if (!prepared?.results?.length) throw new Error('Prepared capsule publish is missing');
  const {
    normalizedCapsules,
    provider,
    owner,
    publishState,
    results,
    totalMaxCharge,
  } = prepared;
  await options.onReadyToSend?.(publishState);
  let lastResult = null;
  for (let index = 0; index < results.length; index += 1) {
    const item = results[index];
    notifyPublishState(options, publishState, setPublishPartStatus(publishState, item.partIndex, PUBLISH_PART_STATUS_SENDING));
    try {
      lastResult = await sendVaultExternalBoc(item.external);
      item.result = lastResult;
      notifyPublishState(options, publishState, setPublishPartStatus(publishState, item.partIndex, PUBLISH_PART_STATUS_SENT));
      await waitForVaultPublishNonce(provider, owner, item.clientNonce + 1n);
      notifyPublishState(options, publishState, setPublishPartStatus(publishState, item.partIndex, PUBLISH_PART_STATUS_VAULT_SUBMITTED));
    } catch (error) {
      const sentBeforeFailure = Boolean(item.result);
      const ambiguousBroadcast = !sentBeforeFailure && isAmbiguousTonRpcBroadcastError(error);
      const part = setPublishPartStatus(
        publishState,
        item.partIndex,
        sentBeforeFailure || ambiguousBroadcast ? PUBLISH_PART_STATUS_UNKNOWN : PUBLISH_PART_STATUS_FAILED,
        { error: String(error?.message ?? error) },
      );
      if (publishState.submittedCount > 0 || sentBeforeFailure || ambiguousBroadcast) publishState.status = VAULT_PUBLISH_STATUS_PARTIAL;
      notifyPublishState(options, publishState, part);
      const partialResult = {
        status: publishState.status === VAULT_PUBLISH_STATUS_PARTIAL ? VAULT_PUBLISH_STATUS_PARTIAL : 'vault-publish-failed',
        results,
        maxCharge: totalMaxCharge,
        result: lastResult,
        publishState,
      };
      if (publishState.status === VAULT_PUBLISH_STATUS_PARTIAL) {
        throw vaultPublishPartialError('Vault publish partially submitted', partialResult, error);
      }
      throw error;
    }
  }
  try {
    await confirmCapsuleHubPublishEntries(publishState);
  } catch (error) {
    if (noteTonRpcRateLimit(error)) {
      publishState.status = VAULT_PUBLISH_STATUS_SUBMITTED;
    } else {
      console.error(error);
    }
  }
  for (const part of publishState.parts ?? []) notifyPublishState(options, publishState, part);
  globalThis.plathoLastVaultPublish = {
    capsules: normalizedCapsules.map((capsule) => capsule.id),
    status: publishState.status === CAPSULEHUB_PUBLISH_STATUS_CONFIRMED
      ? CAPSULEHUB_PUBLISH_STATUS_CONFIRMED
      : VAULT_PUBLISH_STATUS_SUBMITTED,
    results,
    maxCharge: totalMaxCharge,
    result: lastResult,
    publishState,
  };
  return {
    status: publishState.status === CAPSULEHUB_PUBLISH_STATUS_CONFIRMED
      ? CAPSULEHUB_PUBLISH_STATUS_CONFIRMED
      : VAULT_PUBLISH_STATUS_SUBMITTED,
    results,
    maxCharge: totalMaxCharge,
    result: lastResult,
    publishState,
  };
}

async function publishCapsulesThroughVault(capsules, options = {}) {
  const prepared = await prepareCapsulesThroughVault(capsules, options);
  return sendPreparedCapsulesThroughVault(prepared, options);
}

function privateMessageHasPublishAttempt(message) {
  return (message?.publishState?.parts ?? []).some((part) => (
    part.status === PUBLISH_PART_STATUS_SENT
    || part.status === PUBLISH_PART_STATUS_UNKNOWN
    || part.status === PUBLISH_PART_STATUS_VAULT_SUBMITTED
    || part.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED
  ));
}

function privateSendRetryKey(message) {
  if (!message.privateSendRetryKey) {
    privateSendRetrySeq += 1;
    message.privateSendRetryKey = `private-send-${Date.now()}-${privateSendRetrySeq}`;
  }
  return message.privateSendRetryKey;
}

function privatePublishConfirmRetryKey(message) {
  if (!message.privatePublishConfirmRetryKey) {
    privatePublishConfirmSeq += 1;
    message.privatePublishConfirmRetryKey = `private-confirm-${Date.now()}-${privatePublishConfirmSeq}`;
  }
  return message.privatePublishConfirmRetryKey;
}

function clearPrivateSendRetry(message) {
  const key = message?.privateSendRetryKey;
  if (!key) return;
  const job = privateSendRetryJobs.get(key);
  if (job?.timer) window.clearTimeout(job.timer);
  privateSendRetryJobs.delete(key);
}

function clearPrivatePublishConfirmRetry(message) {
  const key = message?.privatePublishConfirmRetryKey;
  if (!key) return;
  const job = privatePublishConfirmJobs.get(key);
  if (job?.timer) window.clearTimeout(job.timer);
  privatePublishConfirmJobs.delete(key);
}

function refreshPrivateSendRetryUi(thread, message, meta) {
  message.meta = meta;
  thread.state = messageStatusKey(message) === 'sending' ? 'sending' : thread.state;
  refreshThreadAfterMessageChange(thread);
  renderThreads();
  renderConversation();
  updateMessageInEncryptedHistory(thread, message).catch((error) => console.error(error));
}

function schedulePrivateSendRetry(context, error) {
  const { thread, message } = context;
  if (!thread?.messages?.includes(message)) return;
  const attempt = Number(context.retryAttempt ?? 0);
  if (attempt >= PRIVATE_SEND_RETRY_MAX_ATTEMPTS) {
    clearPrivateSendRetry(message);
    if (!message.localHistoryId && !privateMessageHasPublishAttempt(message)) {
      restorePrivateDraftAfterUnsentMessage(context).catch((restoreError) => console.error(restoreError));
      if (privateComposerCostStatus && thread.id === activeThreadId) {
        privateComposerCostStatus.textContent = privateSendRetryExhaustedStatusText(error);
        privateComposerCostStatus.dataset.state = 'short';
      }
      return;
    }
    message.meta = privateSendRetryExhaustedStatusText(error);
    thread.state = 'blocked';
    refreshThreadAfterMessageChange(thread);
    renderThreads();
    renderConversation();
    updateMessageInEncryptedHistory(thread, message).catch((historyError) => console.error(historyError));
    if (privateComposerCostStatus && thread.id === activeThreadId) {
      privateComposerCostStatus.textContent = privateSendRetryExhaustedStatusText(error);
      privateComposerCostStatus.dataset.state = 'short';
    }
    return;
  }
  const delayMs = privateSendRetryDelayMs(error, attempt);
  context.retryAttempt = attempt + 1;
  refreshPrivateSendRetryUi(thread, message, privateSendRetryMeta(error));
  if (privateComposerCostStatus && thread.id === activeThreadId) {
    privateComposerCostStatus.textContent = privateSendRetryMeta(error);
    privateComposerCostStatus.dataset.state = 'ready';
  }
  const key = privateSendRetryKey(message);
  const previous = privateSendRetryJobs.get(key);
  if (previous?.timer) window.clearTimeout(previous.timer);
  const timer = window.setTimeout(() => {
    privateSendRetryJobs.delete(key);
    runPrivateSendRetry(context).catch((retryError) => console.error(retryError));
  }, delayMs);
  privateSendRetryJobs.set(key, { timer, context });
}

function schedulePrivatePublishConfirmationRetry(context, error = null) {
  const { thread, message } = context;
  if (!thread?.messages?.includes(message) || !privateMessageHasPublishAttempt(message)) return;
  const attempt = Number(context.confirmAttempt ?? 0);
  const delayMs = isTonRpcRateLimitError(error)
    ? tonRpcLimitBackoffMs(error)
    : PRIVATE_PUBLISH_CONFIRM_RETRY_DELAYS_MS[Math.min(attempt, PRIVATE_PUBLISH_CONFIRM_RETRY_DELAYS_MS.length - 1)];
  context.confirmAttempt = attempt + 1;
  message.meta = publishStateMeta(message.publishState);
  thread.state = 'pending';
  refreshThreadAfterMessageChange(thread);
  renderThreads();
  renderConversation();
  updateMessageInEncryptedHistory(thread, message).catch((historyError) => console.error(historyError));
  const key = privatePublishConfirmRetryKey(message);
  const previous = privatePublishConfirmJobs.get(key);
  if (previous?.timer) window.clearTimeout(previous.timer);
  const timer = window.setTimeout(() => {
    privatePublishConfirmJobs.delete(key);
    runPrivatePublishConfirmationRetry(context).catch((confirmError) => console.error(confirmError));
  }, delayMs);
  privatePublishConfirmJobs.set(key, { timer, context });
}

async function runPrivatePublishConfirmationRetry(context) {
  const { thread, message } = context;
  if (!thread?.messages?.includes(message) || !privateMessageHasPublishAttempt(message)) return;
  try {
    await confirmCapsuleHubPublishEntries(message.publishState);
    message.meta = publishStateMeta(message.publishState);
    thread.state = message.publishState?.status === CAPSULEHUB_PUBLISH_STATUS_CONFIRMED ? 'sealed' : 'pending';
    await updateMessageInEncryptedHistory(thread, message);
    refreshThreadAfterMessageChange(thread);
    renderThreads();
    renderConversation();
    if (message.publishState?.status !== CAPSULEHUB_PUBLISH_STATUS_CONFIRMED) {
      schedulePrivatePublishConfirmationRetry(context);
    } else {
      clearPrivatePublishConfirmRetry(message);
    }
  } catch (error) {
    const rateLimited = noteTonRpcRateLimit(error);
    if (!rateLimited) console.error(error);
    schedulePrivatePublishConfirmationRetry(context, error);
  }
}

async function restorePrivateDraftAfterUnsentMessage(context) {
  const { thread, message, text, attachment } = context;
  thread.messages = (thread.messages ?? []).filter((item) => item !== message);
  if (messageInput && !messageInput.value.trim()) messageInput.value = text;
  privateImageAttachment = attachment;
  updateImageAttachmentUi('private');
  autoResizeComposerTextarea(messageInput);
  refreshThreadAfterMessageChange(thread);
  renderThreads();
  renderConversation();
}

async function attemptPrivateComposerMessagePublish(context) {
  const { thread, message, text, attachment, selectedSuite, senderOptions } = context;
  const recipientEntry = await resolveRecipientPeerEntry(thread, { suite: selectedSuite });
  const capsules = await createPrivateComposerCapsules(text, attachment, recipientEntry, thread.id, senderOptions);
  const capsule = capsules[0];
  const publishState = createCapsulePublishState(capsules);
  message.capsule = capsule;
  message.capsules = capsules;
  message.publishState = publishState;
  message.recipientWallet = recipientEntry.walletAddress;
  message.meta = publishStateMeta(publishState);
  refreshThreadAfterMessageChange(thread);
  renderConversation();
  const publishCallbacks = {
    publishState,
    onReadyToSend: async () => {
      await persistMessageToEncryptedHistory(thread, message);
    },
    onPartState: () => {
      message.meta = publishStateMeta(publishState);
      updateMessageInEncryptedHistory(thread, message).catch((error) => console.error(error));
      renderConversation();
    },
  };
  const publishResult = capsules.length > 1
    ? await publishCapsulesThroughVault(capsules, publishCallbacks)
    : await publishCapsuleThroughVault(capsule, publishCallbacks);
  clearPrivateSendRetry(message);
  message.vaultPublish = publishResult;
  message.publishState = publishResult.publishState ?? publishState;
  message.meta = publishStateMeta(message.publishState);
  thread.state = publishResult.status === CAPSULEHUB_PUBLISH_STATUS_CONFIRMED ? 'sealed' : 'pending';
  await updateMessageInEncryptedHistory(thread, message);
  if (publishResult.status !== CAPSULEHUB_PUBLISH_STATUS_CONFIRMED) {
    schedulePrivatePublishConfirmationRetry(context);
  } else {
    clearPrivatePublishConfirmRetry(message);
  }
  refreshMessagingControls();
  return publishResult;
}

async function settlePrivateComposerSendError(context, error) {
  const { thread, message } = context;
  const cancelled = isPublishPriceChangeCancelled(error);
  const partial = isVaultPublishPartialError(error);
  const rateLimited = noteTonRpcRateLimit(error);
  if (partial) {
    clearPrivateSendRetry(message);
    message.vaultPublish = error.publishResult;
    message.publishState = error.publishResult?.publishState ?? message.publishState;
    message.meta = publishStateMeta(message.publishState);
    thread.state = privateMessageHasPublishAttempt(message) ? 'pending' : 'blocked';
    await updateMessageInEncryptedHistory(thread, message);
    schedulePrivatePublishConfirmationRetry(context, error);
  } else if (cancelled) {
    clearPrivateSendRetry(message);
    clearPrivatePublishConfirmRetry(message);
    await restorePrivateDraftAfterUnsentMessage(context);
  } else if (isRecoverablePrivateSendError(error) && !privateMessageHasPublishAttempt(message)) {
    schedulePrivateSendRetry(context, error);
  } else if (!privateMessageHasPublishAttempt(message) && !message.localHistoryId) {
    clearPrivateSendRetry(message);
    clearPrivatePublishConfirmRetry(message);
    await restorePrivateDraftAfterUnsentMessage(context);
    if (privateComposerCostStatus) {
      privateComposerCostStatus.textContent = rateLimited ? TON_RPC_CONNECTING_STATUS : privateSendPreflightStatusText(error);
      privateComposerCostStatus.dataset.state = 'short';
    }
  } else {
    clearPrivateSendRetry(message);
    message.meta = privateSendBlockedStatusText(error);
    thread.state = 'blocked';
    await updateMessageInEncryptedHistory(thread, message);
  }
  if (privateComposerCostStatus) {
    privateComposerCostStatus.textContent = cancelled
      ? 'Send cancelled'
      : (partial || privateMessageHasPublishAttempt(message)
        ? publishStateMeta(message.publishState)
        : (rateLimited ? TON_RPC_CONNECTING_STATUS : privateSendPreflightStatusText(error)));
    privateComposerCostStatus.dataset.state = cancelled ? 'ready' : 'short';
  }
  refreshMessagingControls();
  if (!rateLimited && !cancelled && !partial && !isRecoverablePrivateSendError(error)) console.error(error);
}

async function runPrivateSendRetry(context) {
  const { thread, message } = context;
  if (!thread?.messages?.includes(message)) return;
  if (tonRpcLimited()) {
    schedulePrivateSendRetry(context, { message: TON_RPC_CONNECTING_STATUS, code: 'RATE_LIMITED' });
    return;
  }
  try {
    await attemptPrivateComposerMessagePublish(context);
  } catch (error) {
    await settlePrivateComposerSendError(context, error);
  } finally {
    refreshThreadAfterMessageChange(thread);
    renderThreads();
    renderConversation();
  }
}

function rememberLocalPublicPost(text, bodyHash, commentsAllowed = true, attachment = null, options = {}) {
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
    publishStatus: options.publishStatus ?? null,
    publishState: options.publishState ?? null,
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

function rememberLocalPublicComment(parent, text, bodyHash, attachment = null, options = {}) {
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
      publishStatus: options.publishStatus ?? null,
      publishState: options.publishState ?? null,
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

function imagePartsForSend(attachment, label = 'image') {
  if (!attachment?.bytes?.length) return [];
  return splitBytesToParts(attachment.bytes, SINGLE_CAPSULE_USEFUL_BYTES);
}

async function createPrivateComposerCapsules(text, attachment, recipientEntry, threadId, options = currentPrivateSenderOptions()) {
  const senderWallet = requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  const senderVaultKeyId = currentVaultMessagingKeyId();
  const senderMetadata = options.includeSenderWalletMetadata === false
    ? {}
    : {
      senderWallet,
      senderVaultKeyId: senderVaultKeyId ?? undefined,
    };
  const textParts = String(text ?? '').trim().length > 0 ? privateTextCapsulePartsForSend(text, options) : [];
  const imageParts = privateImageCapsulePartsForSend(attachment, options);
  const totalParts = textParts.length + imageParts.length;
  if (totalParts <= 0) return [];
  assertPrivateComposerPartLimit(totalParts);
  const streamId = randomBytes(16);
  const capsules = [];
  for (let index = 0; index < textParts.length; index += 1) {
    const part = textParts[index];
    const payloadBytes = encodeCompactPayload({
      type: 'text',
      text: part.text,
      sizeClass: part.sizeClass,
      streamId,
      partIndex: index,
      partCount: totalParts,
      ...senderMetadata,
    });
    capsules.push(await createEncryptedPrivateCapsuleFromPublicBundle('', recipientEntry.publicBundle, localIdentity, {
      payloadBytes,
      sizeClass: part.sizeClass,
      threadId,
      ...currentProfilePointerFields(),
    }));
  }
  for (let index = 0; index < imageParts.length; index += 1) {
    const part = imageParts[index];
    const payloadBytes = encodeCompactPayload({
      type: 'image',
      bytes: part.bytes,
      sizeClass: part.sizeClass,
      format: attachment.mediaFormat ?? PLATHO_COMPACT_IMAGE_FORMATS.WEBP,
      streamId,
      partIndex: textParts.length + index,
      partCount: totalParts,
      ...senderMetadata,
    });
    capsules.push(await createEncryptedPrivateCapsuleFromPublicBundle('', recipientEntry.publicBundle, localIdentity, {
      payloadBytes,
      sizeClass: part.sizeClass,
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
  const createdAtSec = Math.floor(Date.now() / 1000);
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
      createdAtSec,
      ...profilePointer,
      ...commentBase,
    }, { maxBytes: SINGLE_CAPSULE_USEFUL_BYTES }));
  }
  for (let index = 0; index < imageParts.length; index += 1) {
    payloads.push(await createPublicPostPayload({
      type: type === 'comment' ? 'image_comment' : 'image',
      bytes: imageParts[index],
      mediaFormat: attachment.mediaFormat ?? PUBLIC_BODY_MEDIA_FORMATS.WEBP,
      commentsAllowed,
      streamId,
      partIndex: textParts.length + index,
      partCount: totalParts,
      createdAtSec,
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
  let result;
  try {
    result = await publishPublicPayloadParts(payloads, `public-${Date.now()}`);
  } catch (error) {
    if (!isVaultPublishPartialError(error)) throw error;
    result = error.publishResult;
  }
  if (result?.status === CAPSULEHUB_PUBLISH_STATUS_CONFIRMED) {
    rememberLocalPublicPost(resolvedDraft.text, payloads[0]?.bodyHash, resolvedDraft.commentsAllowed, resolvedDraft.attachment);
    setPublicStatus('public published');
  } else if (result?.status === VAULT_PUBLISH_STATUS_PARTIAL) {
    rememberLocalPublicPost(resolvedDraft.text, payloads[0]?.bodyHash, resolvedDraft.commentsAllowed, resolvedDraft.attachment, {
      publishStatus: 'partial public publish',
      publishState: result.publishState ?? null,
    });
    setPublicStatus('partial public publish');
  } else if (result?.status === VAULT_PUBLISH_STATUS_SUBMITTED) {
    rememberLocalPublicPost(resolvedDraft.text, payloads[0]?.bodyHash, resolvedDraft.commentsAllowed, resolvedDraft.attachment, {
      publishStatus: 'public publish submitted',
      publishState: result.publishState ?? null,
    });
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
  let result;
  try {
    result = await publishPublicPayloadParts(payloads, `public-comment-${Date.now()}`);
  } catch (error) {
    if (!isVaultPublishPartialError(error)) throw error;
    result = error.publishResult;
  }
  if (result?.status === CAPSULEHUB_PUBLISH_STATUS_CONFIRMED) {
    rememberLocalPublicComment(parent, text, payloads[0]?.bodyHash, attachment);
    setPublicStatus('comment published');
  } else if (result?.status === VAULT_PUBLISH_STATUS_PARTIAL) {
    rememberLocalPublicComment(parent, text, payloads[0]?.bodyHash, attachment, {
      publishStatus: 'partial comment publish',
      publishState: result.publishState ?? null,
    });
    setPublicStatus('partial comment publish');
  } else if (result?.status === VAULT_PUBLISH_STATUS_SUBMITTED) {
    rememberLocalPublicComment(parent, text, payloads[0]?.bodyHash, attachment, {
      publishStatus: 'comment submitted',
      publishState: result.publishState ?? null,
    });
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
  submitVaultUsernameMint,
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
    refreshMessageActionStatuses();
    refreshComposerPublishPolicy();
    return null;
  }
  try {
    const provider = await resolveVaultChainProvider(options.provider);
    if (!provider?.getUser || !provider?.getKeyRecord) throw new VaultChainProviderUnavailableError('Vault provider unavailable');
    const user = options.user ?? await provider.getUser(plathoWallet.address, { vaultAddress: appConfig.vault?.address ?? null });
    const global = options.skipGlobal === true
      ? null
      : provider.getGlobal
        ? await loadConnectedVaultGlobal({ provider }).catch(() => null)
        : null;
    if (global) {
      vaultProtocolState = {
        airdrop_remaining_ath: global.airdrop_remaining_ath ?? vaultProtocolState.airdrop_remaining_ath ?? null,
        airdrop_total_allocation_ath: global.airdrop_total_allocation_ath ?? vaultProtocolState.airdrop_total_allocation_ath ?? VAULT_ACTIVITY_AIRDROP_TOTAL_ATH_ATOMIC,
        profile_registry_bound: global.profile_registry_bound === true,
        profile_registry_address: global.profile_registry_address ?? vaultProtocolState.profile_registry_address ?? null,
        username_registry_bound: global.username_registry_bound === true,
        username_registry_address: global.username_registry_address ?? vaultProtocolState.username_registry_address ?? null,
      };
      renderAthProfileStats();
    }
    if (!user?.current_key_id || BigInt(user.current_key_id) === 0n) {
      globalThis.plathoVaultBinding = {
        walletAddress: plathoWallet.address,
        user,
        keyRecord: null,
      };
      setText(vaultRecordStatus, 'account activation required');
      refreshMessageActionStatuses();
      refreshMessagingControls();
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
    refreshMessageActionStatuses();
    refreshMessagingControls();
    refreshComposerPublishPolicy();
    return globalThis.plathoVaultBinding;
  } catch (error) {
    const expectedUnavailable = isExpectedVaultProviderUnavailable(error);
    const keepCurrentBinding = expectedUnavailable && hasCurrentWalletVaultBinding();
    if (!keepCurrentBinding) delete globalThis.plathoVaultBinding;
    setText(vaultRecordStatus, keepCurrentBinding
      ? 'activated'
      : expectedUnavailable
        ? vaultProviderStatusForError(error)
        : 'record blocked');
    refreshMessagingControls();
    setText(vaultRotateStatus, keepCurrentBinding ? 'ready' : 'not available');
    refreshComposerPublishPolicy();
    if (!expectedUnavailable) console.error(error);
    return null;
  }
}

async function bootCrypto() {
  try {
    if (!plathoWallet) {
      const hasStoredWallet = hasStoredPlathoWalletRecord();
      const requiredStatus = hasStoredWallet ? 'unlock required' : 'wallet required';
      localIdentity = null;
      localRecipientKeyPair = null;
      localSignedPublicBundle = null;
      localVaultDraft = null;
      clearMessageAutoSyncTimer();
      refreshMessagingControls();
      renderWalletIdentity();
      setText(encryptionStatus, requiredStatus);
      setText(keyAuthStatus, requiredStatus);
      vaultDraftStatus.textContent = requiredStatus;
      setText(vaultRecordStatus, requiredStatus);
      setText(messageSyncStatus, requiredStatus);
      setText(vaultRotateStatus, requiredStatus);
      localProfileAvatarPointer = null;
      refreshComposerPublishPolicy();
      return null;
    }
    renderWalletIdentity();
    localProfileAvatarPointer = readStoredProfileAvatarPointer(plathoWallet.address);
    localIdentity = await loadMessagingIdentityFromWallet(VAULT_RECEIVE_CRYPTO_SUITE);
    localRecipientKeyPair = localIdentity?.encryptionKeyPair ?? null;
    localSignedPublicBundle = await exportSignedPublicKeyBundle(localIdentity, {
      purpose: appConfig.crypto?.signedBundlePurpose ?? 'pwa-runtime',
      ownerWallet: plathoWallet.address,
      vaultAddress: appConfig.vault?.address ?? null,
    });
    const verifiedBundle = await verifySignedPublicKeyBundle(localSignedPublicBundle);
    localVaultDraft = await createVaultMessagingKeyDraft(verifiedBundle.bundle, verifiedBundle.signingPublicKey);
    globalThis.plathoRefreshVaultActivation = async (provider) => refreshVaultActivationStatus({ provider });
    setText(vaultRecordStatus, 'checking');
    setText(vaultDraftStatus, 'checking');
    await refreshVaultActivationStatus({ skipGlobal: true });
    const result = await runPlathoCryptoSelfTest();
    setText(encryptionStatus, result.hybrid.aadTamperRejected ? 'hybrid passed' : 'review');
    setText(keyAuthStatus, verifiedBundle.signingPublicKey.length === 32 ? 'signed bundle' : 'review');
    refreshMessagingControls();
    setText(capsulePolicyStatus, result.capsule.replayRejected ? 'replay guarded' : 'review');
    if (appShell?.dataset?.view === 'chats') {
      beginMessageSyncUi();
      const syncResult = await syncPrivateCapsulesFromChainOnce().catch((error) => {
        refreshMessagingControls();
        if (noteTonRpcRateLimit(error)) {
          failMessageSyncUi('Sync delayed');
          setText(messageSyncStatus, 'sync delayed');
        } else {
          failMessageSyncUi('Sync failed');
          console.error(error);
        }
        return null;
      });
      if (syncResult) {
        completeMessageSyncUi(syncResult);
        setText(messageSyncStatus, privateSyncStatusText(syncResult));
      } else if (messageSyncStatus?.textContent !== 'sync delayed') {
        setText(messageSyncStatus, 'sync failed');
      }
      scheduleMessageAutoSync();
    } else {
      setText(messageSyncStatus, 'ready');
      clearMessageAutoSyncTimer();
    }
    if (isVaultViewActive()) {
      await refreshVaultNow({ includeActivation: true, includeStats: true }).catch((error) => {
        if (noteTonRpcRateLimit(error)) setVaultStatus('RPC busy, retrying');
        if (!isExpectedVaultProviderUnavailable(error)) console.error(error);
      });
    } else {
      scheduleVaultAutoRefresh(2_000);
    }
  } catch (error) {
    setText(encryptionStatus, 'unavailable');
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
  let serviceWorkerRefreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (serviceWorkerRefreshing) return;
    serviceWorkerRefreshing = true;
    handleServiceWorkerControllerChange();
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then((registration) => registration.update().catch(() => null))
    .catch(() => {});
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installedRelatedPwaDetected = false;
  refreshInstallButtons();
  openInstallDialogIfUseful();
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  installedRelatedPwaDetected = true;
  markInstallPromptDismissed();
  closeInstallDialog({ dismissed: false });
  refreshInstallButtons();
});
window.matchMedia?.('(display-mode: standalone)')?.addEventListener?.('change', refreshInstallButtons);
refreshInstallButtons();
refreshInstalledRelatedPwaState().catch(() => {});

for (const eventName of ['pointerdown', 'keydown', 'touchstart']) {
  window.addEventListener(eventName, noteWalletActivity, { passive: true });
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearMessageAutoSyncTimer();
    clearVaultAutoRefreshTimer();
    lockPlathoWalletForBackground();
  } else {
    scheduleWalletUnlockPrompt();
    if (isChatsViewActive()) scheduleMessageAutoSync(2_000);
    if (isVaultViewActive()) {
      refreshVaultNow({ includeActivation: true }).catch((error) => {
        if (noteTonRpcRateLimit(error)) setVaultStatus('RPC busy, retrying');
        if (!isExpectedVaultProviderUnavailable(error)) console.error(error);
      });
    } else {
      scheduleVaultAutoRefresh(2_000);
    }
  }
});
window.addEventListener('pagehide', () => {
  clearMessageAutoSyncTimer();
  clearVaultAutoRefreshTimer();
  lockPlathoWalletForBackground();
});
window.addEventListener('pageshow', () => {
  scheduleWalletUnlockPrompt();
  if (isChatsViewActive()) scheduleMessageAutoSync(2_000);
  if (isVaultViewActive()) {
    refreshVaultNow({ includeActivation: true }).catch((error) => {
      if (noteTonRpcRateLimit(error)) setVaultStatus('RPC busy, retrying');
      if (!isExpectedVaultProviderUnavailable(error)) console.error(error);
    });
  } else {
    scheduleVaultAutoRefresh(2_000);
  }
});
window.addEventListener('focus', () => {
  if (isChatsViewActive()) scheduleMessageAutoSync(2_000);
  if (isVaultViewActive()) {
    refreshVaultNow({ includeActivation: true }).catch((error) => {
      if (noteTonRpcRateLimit(error)) setVaultStatus('RPC busy, retrying');
      if (!isExpectedVaultProviderUnavailable(error)) console.error(error);
    });
  } else {
    scheduleVaultAutoRefresh(2_000);
  }
});
syncViewportCssVars();
window.addEventListener('resize', syncViewportCssVars, { passive: true });
window.visualViewport?.addEventListener?.('resize', syncViewportCssVars, { passive: true });
window.visualViewport?.addEventListener?.('scroll', syncViewportCssVars, { passive: true });

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
updatePrivateSenderModeUi();
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
bootReplayStore();
bootEncryptedMessageHistory();
bootCrypto()
  .then(() => setTimeout(() => {
    promptStoredWalletUnlockOnStartup().catch((error) => console.error(error));
  }, 250))
  .catch((error) => console.error(error));
