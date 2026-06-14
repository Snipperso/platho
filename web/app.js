import {
  CRYPTO_SUITES,
  createEncryptedPrivateCapsuleFromPublicBundle,
  createVaultMessagingKeyDraft,
  encodeCompactPayload,
  exportSignedPublicKeyBundle,
  openPrivateCapsuleChainEntry,
  privateCapsuleFromChainEntry,
  PLATHO_COMPACT_RECIPIENT_WALLET_METADATA_BYTES,
  PLATHO_COMPACT_SENDER_RECOVERY_BYTES,
  PLATHO_COMPACT_SENDER_WALLET_METADATA_BYTES,
  PLATHO_COMPACT_SENDER_USERNAME_METADATA_PREFIX_BYTES,
  PLATHO_COMPACT_IMAGE_FORMATS,
  parseTonAddress,
  publicKeyBundleFromVaultKeyRecord,
  randomBytes,
  runPlathoCryptoSelfTest,
  verifyVaultKeyRecordBinding,
  verifySignedPublicKeyBundle,
} from './crypto/platho-crypto.mjs?v=12';
import {
  PLATHO_WALLET_NETWORK_GLOBAL_IDS,
  createPlathoWallet,
  deriveVaultAuthKeyPairFromWallet,
  deriveMessagingIdentityFromWallet,
  exportPlathoWalletRecoveryPhrase,
  formatTonUserFriendlyAddress,
  importPlathoWallet,
  sendPlathoWalletTransaction,
} from './platho-wallet.mjs?v=13';
import { createIndexedDbReplayStore, createMemoryReplayStore } from './replay-store.mjs?v=1';
import {
  createIndexedDbEncryptedMessageHistoryStore,
  createMemoryEncryptedMessageHistoryStore,
} from './encrypted-message-store.mjs?v=4';
import {
  VaultChainProviderUnavailableError,
} from './vault-chain-provider.mjs?v=6';
import { PLATHO_APP_CONFIG } from './platho-config.mjs?v=72';
import {
  createTonRpcTransport,
  isTonRpcTransportDead,
  readBatchPublishReceipt,
  interpretBatchPublishReceipt,
  BATCH_PUBLISH_RECEIPT_STATUS,
} from './vault-ton-rpc-provider.mjs?v=38';
import {
  DEFAULT_PUBLIC_CHANNELS,
  PUBLIC_CHANNEL_FEED_CACHE_KEY,
  PUBLIC_CHANNEL_SUBSCRIPTIONS_KEY,
  normalizePublicChannelRegistry,
  normalizePublicChannelFeed,
  publicChannelSubscriptionsToThreads,
  publicChannelThreadsToFeedItems,
  readPublicChannelFeedCache,
  readPublicChannelSubscriptions,
  subscribedPublicChannels,
  writePublicChannelFeedCache,
  writePublicChannelSubscriptions,
} from './public-channel-subscriptions.mjs?v=7';
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
} from './recipient-identities.mjs?v=6';
import {
  MAX_CAPSULE_USEFUL_BYTES,
  SINGLE_CAPSULE_USEFUL_BYTES,
  splitBytesToCapsuleParts,
  messagePartCount,
  splitUtf8ToCapsuleParts,
} from './capsule-part-policy.mjs?v=3';
import {
  INCLUDED_NETWORK_FEE_NANOTONS,
  MESSAGE_PRICE_SUITES,
  BATCH_SHARED_BASE_HOLD_NANOTONS,
  capsulePerPartHoldNanotons,
  batchHoldNanotons,
  privateCapsuleBaseNetPriceNanotons,
  publicCapsuleBaseNetPriceNanotons,
  maxNetworkFeeSurchargeNanotons,
  networkFeeSurchargeExceedsMax,
  requiresHighNetworkFeeSurchargeConfirmation,
  requiresManualNetworkFeeSurchargeOverride,
  networkFeeSurchargeNanotons,
  rawNetworkFeeSurchargeNanotons,
  resolveNetworkFeeEstimateNanotons,
} from './message-pricing-policy.mjs?v=12';
import {
  createProfileRegistryMessage,
  createAthWalletMessage,
  createPublicPostPayload,
  createUsernameRegistryMessage,
  createWalletTransaction,
  buildVaultProfileAvatarExternalBoc,
  buildVaultReceiveIntentExternalBoc,
  buildVaultReplaceMessagingKeysExternalBoc,
  buildVaultWithdrawAthExternalBoc,
  buildVaultWithdrawTonExternalBoc,
  buildVaultUsernameMintExternalBoc,
  computeVaultMessagingKeyId,
  computeVaultReceiveIntentId,
  createVaultWalletMessage,
  estimateVaultAttachedValueNanotons,
  PROFILE_AVATAR_PRICE_ATH,
  PROFILE_AVATAR_VAULT_TON_CHARGE_NANOTONS,
  PUBLIC_BODY_MEDIA_FORMATS,
  PUBLIC_POST_BODY_MAX_BYTES,
  PUBLIC_COMMENT_TEXT_MAX_BYTES,
  PUBLIC_POST_TEXT_MAX_BYTES,
  readPublicPostPayload,
  RECEIVE_ASSETS,
  REGISTRY_BURN_FLUSH_MESSAGE_VALUE_NANOTONS,
  tonCell,
  USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS,
  VAULT_CRYPTO_SUITE,
  VAULT_PUBLISH_KIND,
  VAULT_RESERVES_NANOTONS,
  VAULT_SIZE_CLASS,
} from './pwa-contract-transactions.mjs?v=27';
import {
  groupPublishItemsIntoBatches,
  buildBatchExternalFromPublishItems,
} from './publish-batch-orchestration.mjs?v=2';
import { createAthMasterTonRpcProvider, createAthWalletTonRpcProvider } from './ath-ton-rpc-provider.mjs?v=23';
import {
  createCapsuleHubTonRpcProvider,
  isCapsuleHubBodyHistoryUnavailable,
} from './capsulehub-ton-rpc-provider.mjs?v=36';
import { createProfileRegistryTonRpcProvider } from './profile-registry-ton-rpc-provider.mjs?v=25';
import { createTonDnsProvider } from './ton-dns-provider.mjs?v=21';
import {
  computeUsernameNameHash,
  createUsernameNftItemTonRpcProvider,
  createUsernameRegistryTonRpcProvider,
  resolveAuthoritativeUsernameItemOwnership,
} from './username-ton-rpc-provider.mjs?v=28';
import {
  encodeCanvasToWebp,
  isWebpBytes,
} from './webp-encoder.mjs?v=1';
import { createQrSvgDataUrl } from './qr-code.mjs?v=1';

const appConfig = PLATHO_APP_CONFIG;
const PLATHO_APP_RUNTIME_VERSION = 'v426';

document.documentElement.dataset.plathoAppJs = 'started';
// 'ready' is the terminal healthy marker for the boot-guard watchdog; late
// benign errors must not downgrade it or healthy sessions would be flagged
// as broken boots.
window.addEventListener('error', (event) => {
  if (document.documentElement.dataset.plathoAppJs !== 'ready') {
    document.documentElement.dataset.plathoAppJs = 'error';
  }
  document.documentElement.dataset.plathoAppError = String(event.error?.message ?? event.message ?? 'runtime error').slice(0, 180);
});
window.addEventListener('unhandledrejection', (event) => {
  if (document.documentElement.dataset.plathoAppJs !== 'ready') {
    document.documentElement.dataset.plathoAppJs = 'error';
  }
  document.documentElement.dataset.plathoAppError = String(event.reason?.message ?? event.reason ?? 'unhandled rejection').slice(0, 180);
});

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

  if (config?.vault?.address) {
    globalThis.plathoVaultAddress = config.vault.address;
  }
  if (config?.vault?.deploymentManifestHash) {
    globalThis.plathoVaultDeploymentManifestHash = config.vault.deploymentManifestHash;
  }
  if (config?.capsuleHub?.address) {
    globalThis.plathoCapsuleHubAddress = config.capsuleHub.address;
  }
  if (config?.feeAccumulator?.address) {
    globalThis.plathoFeeAccumulatorAddress = config.feeAccumulator.address;
  }
  if (config?.ath?.masterAddress) {
    globalThis.plathoAthMasterAddress = config.ath.masterAddress;
  }
  if (config?.usernameRegistry?.address) {
    globalThis.plathoUsernameRegistryAddress = config.usernameRegistry.address;
  }
  if (config?.profileRegistry?.address) {
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
const privateDebugLog = document.querySelector('#privateDebugLog');
const copyPrivateDebugButton = document.querySelector('#copyPrivateDebugButton');
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
const setAvatarStatus = document.querySelector('#setAvatarStatus');
const profileAvatarInput = document.querySelector('#profileAvatarInput');
const mintUsernameButton = document.querySelector('#mintUsernameButton');
const mintUsernameStatus = document.querySelector('#mintUsernameStatus');
const linkUsernameButton = document.querySelector('#linkUsernameButton');
const linkedUsernameStatus = document.querySelector('#linkedUsernameStatus');
const burnAthButton = document.querySelector('#burnAthButton');
const flushAthButton = document.querySelector('#flushAthButton');
const flushAthStatus = document.querySelector('#flushAthStatus');
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
const appVersionLabel = document.querySelector('#appVersionLabel');

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
let localVaultAuthKeyPair = null;
let localRecipientKeyPair = null;
let localSignedPublicBundle = null;
let localVaultDraft = null;
const knownVaultKeyOwnerBySignPubkey = new Map();
const knownVaultKeyRecordByWallet = new Map();
const verifiedPlathoUsernameOwnerCache = new Map();
let plathoWallet = null;
let activeRuntimeWalletAddress = null;
let localReplayStore = createMemoryReplayStore();
let encryptedMessageStore = null;
let vaultProviderLoadPromise = null;
let tonDnsProviderLoadPromise = null;
let identityPopover = null;
let activeActionDialog = null;
let publicDisplayMode = 'feed';
let publicChannelSearchQuery = '';
let publicCommentTarget = null;
let privateImageAttachments = [];
let privatePaymentCheckDraft = null;
let publicImageAttachments = [];
let pendingProfileAvatarModeId = 'good';
let localProfileAvatarPointer = null;
let profileAvatarLoadPromises = new Map();
const profileAvatarPublishRecoveryJobs = new Map();
let profileAvatarPublishRecoverySeq = 0;
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
let navVaultBalanceRetryTimer = null;
let navVaultBalanceRefreshPromise = null;
let privateChainSyncPromise = null;
let messageAutoSyncTimer = null;
let messageAutoSyncAt = 0;
let messageAutoSyncCountdownTimer = null;
let messageAutoSyncPhase = 'idle';
let messageAutoSyncLastResult = null;
let messageAutoSyncLastErrorLabel = null;
let messageAutoSyncLoadingFrame = 0;
let messageAutoSyncStallStreak = 0;
const privateScanUnknownErrorCounts = new Map();
let privateOutboundWorkDepth = 0;
let vaultPublishSendLock = Promise.resolve();
let vaultPublishSendWaiters = 0;
// Resolves when the most recently broadcast vault external is reflected in
// the on-chain publish nonce. Pre-sign user/nonce reads await it so that
// back-to-back signed actions cannot race the strictly sequential contract
// nonce while the previous external is still propagating.
let pendingVaultPublishNonceBarrier = null;
// Monotonic per-owner floor over every nonce this client has observed on
// chain or consumed by broadcasting a signed external. A lagging RPC replica
// can serve an older nonce; signing below the floor can only produce a
// permanently rejected external racing one of our own in-flight messages.
const vaultPublishNonceFloorByOwner = new Map();
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
const PAYMENT_CHECK_PENDING_LEDGER_KIND = 'platho.paymentCheck.pendingIntent.v1';
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
const ATH_FLUSH_POST_TRANSACTION_REFRESH_DELAYS_MS = [5_000, 15_000, 45_000, 90_000, 180_000];
const VAULT_NAV_BALANCE_RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000];
const MESSAGE_AUTO_SYNC_MS = 60 * 1000;
// Survival mode: with the primary RPC gateway parked the keyless fallback has
// a ~1 rps budget, so background sync slows down to protect the send path.
const MESSAGE_AUTO_SYNC_DEGRADED_MS = 180 * 1000;
const TON_WALLET_BALANCE_CACHE_MS = 20 * 1000;
const TON_RPC_CONNECTING_STATUS = 'RPC busy - retrying';
const TON_RPC_LIMIT_FALLBACK_BACKOFF_MS = 60 * 1000;
const TON_RPC_LIMIT_MIN_BACKOFF_MS = 5 * 1000;
const MESSAGE_SYNC_COUNTDOWN_TICK_MS = 1_000;
const PRIVATE_SEND_RETRY_DELAYS_MS = [8_000, 20_000, 45_000, 60_000];
const PRIVATE_SEND_RETRY_MAX_ATTEMPTS = 8;
const PRIVATE_SEND_PARTIAL_RETRY_MAX_ATTEMPTS = 16;
const PRIVATE_SEND_PARTIAL_RETRY_DEADLINE_MS = 15 * 60 * 1000;
const PRIVATE_SEND_RPC_RETRY_MAX_ATTEMPTS = 90;
const PRIVATE_PUBLISH_CONFIRM_RETRY_DELAYS_MS = [1_000, 2_000, 3_000, 5_000, 8_000, 13_000, 21_000, 30_000];
const PRIVATE_PUBLISH_CONFIRM_ACTIVE_ATTEMPT_LIMIT = 24;
const PRIVATE_PENDING_PUBLISH_STALE_AFTER_MS = 10 * 60 * 1000;
const PRIVATE_PENDING_PUBLISH_CONFIRMATION_STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const PRIVATE_PUBLISH_CONFIRM_BACKGROUND_RETRY_MS = 30 * 1000;
const PRIVATE_PUBLISH_CONFIRM_HOT_AGE_MS = 5 * 60 * 1000;
// Publish + CapsuleHub ACK realistically spans 2-3 basechain blocks; the hot
// window must cover that plus the read round-trips or every send degrades
// into the slow recovery/retry path.
const PRIVATE_PUBLISH_CONFIRM_HOT_DEADLINE_MS = 25 * 1000;
const PRIVATE_PUBLISH_CONFIRM_HOT_REQUEST_TIMEOUT_MS = 4 * 1000;
const PRIVATE_PUBLISH_CONFIRM_RECOVERY_DEADLINE_MS = 30 * 1000;
const PRIVATE_PUBLISH_CONFIRM_RECOVERY_REQUEST_TIMEOUT_MS = 8 * 1000;
const PRIVATE_PUBLISH_MISSING_PART_RETRY_AFTER_MS = 2 * 60 * 1000;
// A signed publish external whose nonce the chain has already moved past can
// never be accepted again. After this age, if the entry is provably absent
// from the sender index back beyond the broadcast moment, the part is reset
// and re-signed with a fresh nonce instead of staying wedged forever.
const PRIVATE_PUBLISH_DROPPED_RECOVERY_AFTER_MS = 150 * 1000;
const PRIVATE_PUBLISH_DROPPED_RECOVERY_SCAN_LIMIT = 48;
const PRIVATE_PUBLISH_DROPPED_RECOVERY_MAX_RESIGNS = 3;
const PRIVATE_PUBLISH_DROPPED_RECOVERY_BROADCAST_MARGIN_S = 180;
const PRIVATE_OUTBOUND_SYNC_PAUSE_MS = 5 * 1000;
const PRIVATE_CHAIN_INDEX_STORAGE_PREFIX = 'platho.private.chain.index.v1';
const PRIVATE_CHAIN_HISTORY_UNAVAILABLE_STORAGE_PREFIX = 'platho.private.chain.history.unavailable.v1';
const PRIVATE_CHAIN_HISTORY_UNAVAILABLE_LIMIT = 200;
const PRIVATE_CHAIN_HISTORY_RETRY_COOLDOWN_MS = 3 * 60 * 1000;
const PRIVATE_CHAIN_HISTORY_RETRY_AUTO_LIMIT = 2;
const PRIVATE_CHAIN_HISTORY_RETRY_MANUAL_LIMIT = 16;
// A single entry that persistently fails with an unclassified error must not
// freeze the index cursor into a forever-resyncing loop: after this many
// failed passes the entry is skipped for the session and kept visible in the
// debug surface instead.
const PRIVATE_SCAN_UNKNOWN_ERROR_SKIP_AFTER = 3;
const PRIVATE_CHAIN_HEAD_REPAIR_STORAGE_PREFIX = 'platho.private.chain.head.repair.v1';
const PRIVATE_CHAIN_HEAD_REPAIR_SCAN_LIMIT = 8;
const PUBLIC_CHAIN_HISTORY_UNAVAILABLE_STORAGE_PREFIX = 'platho.public.chain.history.unavailable.v1';
const PUBLIC_CHAIN_HISTORY_UNAVAILABLE_LIMIT = 400;
const LEGACY_MESSAGE_HISTORY_DB_NAME = 'platho-local-message-history-v1';
const LEGACY_REPLAY_DB_NAME = 'platho-local-security-v1';
const PUBLIC_CHAIN_READ_LIMIT = 128;
const PRIVATE_CHAIN_INDEX_READ_LIMIT = 120;
const PRIVATE_CHAIN_AUTO_INDEX_READ_LIMIT = 48;
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
const PROFILE_AVATAR_PUBLISH_RECOVERY_STORAGE_PREFIX = 'platho.profile.avatar.publishRecovery.v1';
const PROFILE_AVATAR_ENTRY_SCAN_PADDING = 2048;
const PROFILE_AVATAR_FALLBACK_SCAN_LIMIT = 2048;
const PROFILE_AVATAR_PUBLISH_CONFIRM_ATTEMPTS = 60;
const PROFILE_AVATAR_PUBLISH_CONFIRM_DELAY_MS = 2000;
const PROFILE_AVATAR_PUBLISH_CONFIRM_SCAN_LIMIT = 512;
const PROFILE_AVATAR_PUBLISH_CONFIRM_DEADLINE_MS = 120 * 1000;
const PROFILE_AVATAR_ROUTE_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000];
const PROFILE_AVATAR_RECOVERY_RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 120_000, 180_000];
const PROFILE_AVATAR_RECOVERY_LOCAL_PENDING_MS = 15 * 60 * 1000;
const USERNAME_MINT_CONFIRM_ATTEMPTS = 20;
const USERNAME_MINT_CONFIRM_DELAY_MS = 1500;
const USERNAME_MINT_BACKGROUND_CONFIRM_ATTEMPTS = 240;
const USERNAME_MINT_BACKGROUND_CONFIRM_DELAY_MS = 15_000;
const USERNAME_MINT_LOCAL_PENDING_MS = USERNAME_MINT_BACKGROUND_CONFIRM_ATTEMPTS * USERNAME_MINT_BACKGROUND_CONFIRM_DELAY_MS;
const ATH_FULL_DISCOUNT_AMOUNT_ATOMIC = 10_000_000_000_000n;
const ATH_TOTAL_SUPPLY_ATOMIC = 100_000_000_000_000_000n;
const VAULT_ACTIVITY_AIRDROP_TOTAL_ATH_ATOMIC = 15_000_000_000_000_000n;
const VAULT_ACTIVITY_AIRDROP_DISCOUNT_UNLOCK_REMAINING_ATH_ATOMIC = 0n;
const USERNAME_PRICE_4_CHARS_ATOMIC = 10_000_000_000_000n;
const USERNAME_PRICE_5_CHARS_ATOMIC = 1_000_000_000_000n;
const USERNAME_PRICE_6_PLUS_CHARS_ATOMIC = 100_000_000_000n;
const VAULT_PUBLISH_PUBLIC_LOCAL_EXEC_RESERVE_NANOTONS = Object.freeze({
  1: 8_700_000n,
  2: 13_800_000n,
  4: 17_300_000n,
  8: 24_400_000n,
  16: 38_900_000n,
  32: 67_600_000n,
});
const VAULT_PUBLISH_PRIVATE_HYBRID_LOCAL_EXEC_RESERVE_NANOTONS = Object.freeze({
  1: 12_000_000n,
  2: 13_800_000n,
  4: 17_300_000n,
  8: 24_400_000n,
  16: 38_900_000n,
  32: 67_600_000n,
});
const VAULT_PUBLISH_NONCE_CONFIRM_TIMEOUT_MS = 90_000;
const VAULT_PUBLISH_NONCE_POLL_MS = 1_000;
const VAULT_ATH_WITHDRAW_CONFIRM_TIMEOUT_MS = 90_000;
const VAULT_ATH_WITHDRAW_POLL_MS = 1_500;
const PAYMENT_CHECK_CLAIM_CONFIRM_TIMEOUT_MS = 90_000;
const PAYMENT_CHECK_CLAIM_POLL_MS = 1_500;
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
const CAPSULEHUB_PUBLIC_EXEC_RESERVE_NANOTONS = Object.freeze({
  1: 2_400_000n,
  2: 4_300_000n,
  4: 4_500_000n,
  8: 5_000_000n,
  16: 5_800_000n,
  32: 7_600_000n,
});
const CAPSULEHUB_PRIVATE_STORAGE_CHARGE_NANOTONS = 1_000_000n + 3_300_000n + CAPSULEHUB_ACK_FORWARD_RESERVE_NANOTONS;
const CAPSULEHUB_PUBLIC_STORAGE_CHARGE_NANOTONS = 1_000_000n + 7_400_000n + CAPSULEHUB_ACK_FORWARD_RESERVE_NANOTONS;
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
let navVaultBalanceState = {
  status: 'idle',
  retryAttempt: 0,
  reason: null,
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
let athFlushState = {
  username_burn_due_ath: null,
  profile_burn_due_ath: null,
  username_pending_burn_flush_count: null,
  profile_pending_burn_flush_count: null,
  busy: false,
  error: null,
};

function localStorageOrNull() {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

function deploymentStorageSuffix() {
  const manifestHash = String(appConfig.vault?.deploymentManifestHash ?? '').replace(/^0x/i, '').toLowerCase();
  if (/^[0-9a-f]{64}$/.test(manifestHash)) return manifestHash.slice(0, 16);
  const vaultAddress = String(appConfig.vault?.address ?? '').replace(/[^a-z0-9_-]/gi, '');
  return vaultAddress.slice(-16) || 'no-deployment';
}

function scopedStorageKey(baseKey) {
  return `${baseKey}:${deploymentStorageSuffix()}`;
}

function scopedIndexedDbName(baseName) {
  return `${baseName}.${deploymentStorageSuffix()}`;
}

function walletIndexedDbSuffix(walletAddress = plathoWallet?.address) {
  if (!walletAddress) return 'wallet-locked';
  try {
    const parsed = parseTonAddress(walletAddress).raw;
    return String(parsed).replace(/[^a-z0-9_-]/gi, '').slice(-18) || 'wallet-unknown';
  } catch {
    return String(walletAddress).replace(/[^a-z0-9_-]/gi, '').slice(-18) || 'wallet-unknown';
  }
}

function walletScopedIndexedDbName(baseName, walletAddress = plathoWallet?.address) {
  return `${scopedIndexedDbName(baseName)}.${walletIndexedDbSuffix(walletAddress)}`;
}

function currentMessageHistoryDbName(walletAddress = plathoWallet?.address) {
  return walletScopedIndexedDbName(LEGACY_MESSAGE_HISTORY_DB_NAME, walletAddress);
}

function currentReplayDbName(walletAddress = plathoWallet?.address) {
  return walletScopedIndexedDbName(LEGACY_REPLAY_DB_NAME, walletAddress);
}

function deploymentScopedStorage(storage, scopedKeys) {
  if (!storage) return storage;
  const keyFor = (key) => (scopedKeys.has(key) ? scopedStorageKey(key) : key);
  return {
    getItem(key) {
      return storage.getItem(keyFor(key));
    },
    setItem(key, value) {
      return storage.setItem(keyFor(key), value);
    },
    removeItem(key) {
      return storage.removeItem(keyFor(key));
    },
  };
}

const PUBLIC_CHANNEL_STORAGE_KEYS = new Set([
  PUBLIC_CHANNEL_SUBSCRIPTIONS_KEY,
  PUBLIC_CHANNEL_FEED_CACHE_KEY,
]);

function publicChannelStorage() {
  return deploymentScopedStorage(localStorageOrNull(), PUBLIC_CHANNEL_STORAGE_KEYS);
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
      : 'Platho is a static PWA. After installation, the app shell, docs, and bounded local encrypted history cache are stored on this device. The cache improves recovery, but it is not a universal backup. Network access is still required for contract reads, verified public feed updates, message-history retrieval, and sending transactions. Platho does not use a server account that can read your messages or hold your keys.';
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
  return owner ? `${PROFILE_AVATAR_POINTER_STORAGE_PREFIX}:${deploymentStorageSuffix()}:${owner}` : null;
}

function profileAvatarPublishRecoveryStorageKey(owner, avatarHash) {
  try {
    const normalizedOwner = requireBasechainAddress(owner, 'Avatar owner');
    return `${PROFILE_AVATAR_PUBLISH_RECOVERY_STORAGE_PREFIX}:${deploymentStorageSuffix()}:${normalizedOwner}:${normalizeAvatarHashHex(avatarHash).toLowerCase()}`;
  } catch {
    return null;
  }
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

function webpDataUrlToBytes(dataUrl) {
  const prefix = 'data:image/webp;base64,';
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(prefix)) return null;
  try {
    const binary = atob(dataUrl.slice(prefix.length));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

async function readProfileAvatarMediaCache(avatarHash) {
  const key = profileAvatarMediaCacheKey(avatarHash);
  if (!key) return null;
  try {
    const parsed = JSON.parse(localStorageOrNull()?.getItem(key) ?? 'null');
    if (!parsed || parsed.hash !== normalizeAvatarHashHex(avatarHash)) return null;
    const bytes = webpDataUrlToBytes(parsed.url);
    if (!bytes) return null;
    const computedHash = await sha256Hex(bytes);
    if (computedHash.toLowerCase() !== normalizeAvatarHashHex(avatarHash).toLowerCase()) {
      localStorageOrNull()?.removeItem(key);
      return null;
    }
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
  return owner ? `${LINKED_PLATHO_USERNAME_STORAGE_PREFIX}:${deploymentStorageSuffix()}:${owner}` : null;
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

function walletAddressChanged(previousWallet, nextWallet) {
  if (!previousWallet?.address || !nextWallet?.address) return false;
  return !sameWalletAddress(previousWallet.address, nextWallet.address);
}

function activeWalletRuntimeAddress() {
  return activeRuntimeWalletAddress ?? plathoWallet?.address ?? null;
}

function walletScopedRuntimeChanged(nextWallet) {
  const currentAddress = activeWalletRuntimeAddress();
  if (!currentAddress || !nextWallet?.address) return false;
  return !sameWalletAddress(currentAddress, nextWallet.address);
}

function prepareWalletScopedRuntimeForWallet(wallet, reason = 'wallet replaced') {
  if (walletScopedRuntimeChanged(wallet)) {
    clearWalletScopedRuntimeState(reason);
  }
  if (wallet?.address) activeRuntimeWalletAddress = wallet.address;
}

function clearWalletScopedRuntimeState(reason = 'wallet changed') {
  for (const job of privateSendRetryJobs.values()) {
    if (job?.timer) window.clearTimeout(job.timer);
  }
  privateSendRetryJobs.clear();
  privateSendRetrySeq = 0;
  for (const job of privatePublishConfirmJobs.values()) {
    if (job?.timer) window.clearTimeout(job.timer);
  }
  privatePublishConfirmJobs.clear();
  privatePublishConfirmSeq = 0;
  activeRuntimeWalletAddress = null;
  clearMessageAutoSyncTimer();
  clearMessageAutoSyncCountdownTimer();
  privateChainSyncPromise = null;
  messageAutoSyncAt = 0;
  messageAutoSyncPhase = 'idle';
  messageAutoSyncLastResult = null;
  messageAutoSyncLastErrorLabel = null;
  threads = [];
  activeThreadId = null;
  if (appShell) appShell.dataset.chatOpen = 'false';
  localIdentity = null;
  localVaultAuthKeyPair = null;
  localRecipientKeyPair = null;
  localSignedPublicBundle = null;
  localVaultDraft = null;
  localReplayStore = createMemoryReplayStore();
  encryptedMessageStore = null;
  knownVaultKeyOwnerBySignPubkey.clear();
  knownVaultKeyRecordByWallet.clear();
  privateImageAttachments = [];
  privatePaymentCheckDraft = null;
  localProfileAvatarPointer = null;
  profileAvatarLoadPromises.clear();
  delete globalThis.plathoVaultBinding;
  delete globalThis.plathoLastEncryptedHistoryRestore;
  globalThis.plathoLastWalletScopedRuntimeReset = {
    reason,
    at: new Date().toISOString(),
  };
  updateImageAttachmentUi('private');
  refreshComposerCostStatus();
  renderThreads();
  renderConversation();
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
  if (identity.type === RECIPIENT_IDENTITY_TYPES.PLATHO_NFT) {
    return String(identity.label ?? identity.value ?? '').replace(/\.ath$/i, '');
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
  const includeSenderWalletMetadata = currentPrivateSenderMode() !== PRIVATE_SENDER_MODES.ANONYMOUS;
  const linkedUsername = includeSenderWalletMetadata ? readLinkedPlathoUsername(plathoWallet?.address) : null;
  return {
    includeSenderWalletMetadata,
    senderUsername: linkedUsername?.label ?? undefined,
  };
}

function privateSenderModeToggleBlockReason() {
  if (!plathoWallet) return 'Wallet required';
  if (pendingServiceWorkerAppShellReload === true) return 'Update ready - reload app';
  if (composer?.dataset.readOnly === 'true') return 'Read-only channel';
  return null;
}

function canTogglePrivateSenderMode() {
  return privateSenderModeToggleBlockReason() === null;
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
    const blockReason = privateSenderModeToggleBlockReason();
    privateAnonymousButton.disabled = Boolean(blockReason);
    privateAnonymousButton.setAttribute('aria-pressed', anonymous ? 'true' : 'false');
    privateAnonymousButton.setAttribute(
      'aria-label',
      anonymous ? 'Share wallet address' : 'Send pseudonymously without wallet address',
    );
    privateAnonymousButton.title = blockReason ?? (anonymous
      ? 'Pseudonymous: wallet address hidden, sender key may still link messages'
      : 'Recipient will see your wallet address');
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

function setProfileActionStatus(node, text, state = '') {
  if (!node) return;
  setText(node, text);
  if (state) {
    node.dataset.state = state;
  } else {
    delete node.dataset.state;
  }
}

function setProfileAvatarStatus(text, state = 'busy') {
  setProfileActionStatus(setAvatarStatus, text, state);
}

function setUsernameMintStatus(text, state = 'busy') {
  setProfileActionStatus(mintUsernameStatus, text, state);
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

function schedulePendingServiceWorkerAppShellReload(delayMs = 250) {
  if (!pendingServiceWorkerAppShellReload) return false;
  setTimeout(() => reloadForPendingServiceWorkerAppShellUpdate(), delayMs);
  return true;
}

async function liveAppRuntimeVersion() {
  try {
    const response = await fetch(`./?platho_version_check=${Date.now()}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!response.ok) return null;
    const html = await response.text();
    const match = html.match(/id="appVersionLabel">v(\d+)<\/span>/);
    return match ? `v${match[1]}` : null;
  } catch {
    return null;
  }
}

async function handleServiceWorkerControllerChange() {
  const liveVersion = await liveAppRuntimeVersion();
  if (!liveVersion || liveVersion === PLATHO_APP_RUNTIME_VERSION) {
    pendingServiceWorkerAppShellReload = false;
    refreshMessagingControls();
    return;
  }
  if (shouldDeferServiceWorkerReload()) {
    pendingServiceWorkerAppShellReload = true;
    flashWalletIdentityStatus('Update ready - reload before sending');
    refreshMessagingControls();
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
  localVaultAuthKeyPair = null;
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

function threadSelectedIdentity(thread) {
  const displayIdentity = primaryThreadIdentity({ displayIdentity: thread?.displayIdentity });
  if (displayIdentity) return displayIdentity;
  if (thread?.localLabel) return null;
  return primaryThreadIdentity(thread);
}

function threadDisplayLabel(thread) {
  const identity = threadSelectedIdentity(thread);
  if (identity) return displayIdentityLabel(identity);
  if (thread?.localLabel) return thread.localLabel;
  return thread?.name ?? '';
}

function threadDisplayTone(thread) {
  const identity = threadSelectedIdentity(thread);
  return identity ? identityTone(identity) : null;
}

function routeIdentitySubtitle(thread) {
  const identity = primaryThreadIdentity(thread);
  if (!identity) return thread?.subtitle ?? '';
  const label = displayIdentityLabel(identity);
  return label ? `${identityTypeLabel(identity)} - ${label}` : identityTypeLabel(identity);
}

function applyThreadDisplayFields(thread) {
  if (!thread) return thread;
  const label = threadDisplayLabel(thread);
  const identity = threadSelectedIdentity(thread);
  if (label) {
    thread.name = label;
    thread.avatar = String(label || 'P').slice(0, 1).toUpperCase() || thread.avatar || 'P';
  }
  thread.subtitle = identity ? identityTypeLabel(identity) : routeIdentitySubtitle(thread);
  return thread;
}

function persistThreadDisplayPreference(thread) {
  if (!thread?.messages?.length) return;
  Promise.all((thread.messages ?? [])
    .filter((message) => message?.localHistoryId)
    .map((message) => updateMessageInEncryptedHistory(thread, message)))
    .catch((error) => console.error(error));
}

function setIdentityLabel(node, thread, baseClass = 'identity-label') {
  const tone = threadDisplayTone(thread);
  node.textContent = threadDisplayLabel(thread);
  node.className = `${baseClass}${tone ? ` identity-label-${tone}` : ''}`;
}

function identityVariantRow(option, selected, onSelect) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = `identity-variant${option.identity ? ` identity-label-${identityTone(option.identity)}` : ''}`;
  row.setAttribute('role', 'menuitemradio');
  row.setAttribute('aria-checked', selected ? 'true' : 'false');
  const label = document.createElement('strong');
  label.textContent = option.label;
  const type = document.createElement('span');
  type.textContent = selected ? `${option.subtitle} - selected` : option.subtitle;
  row.append(label, type);
  row.addEventListener('click', () => onSelect(option));
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

function identityDisplayOptions(thread) {
  const options = [];
  if (thread?.localLabel) {
    options.push({
      key: 'local-label',
      label: thread.localLabel,
      subtitle: 'Local name',
      identity: null,
    });
  }
  for (const identity of uniqueDisplayIdentityVariants(thread)) {
    const key = identityDisplayKey(identity);
    if (!key) continue;
    options.push({
      key,
      label: displayIdentityLabel(identity),
      subtitle: identityTypeLabel(identity),
      identity,
    });
  }
  return options;
}

function selectedIdentityDisplayOptionKey(thread) {
  const selected = threadSelectedIdentity(thread);
  if (selected) return identityDisplayKey(selected);
  return thread?.localLabel ? 'local-label' : null;
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
  const options = identityDisplayOptions(thread);
  if (options.length === 0 || !anchor) return;
  const selectedKey = selectedIdentityDisplayOptionKey(thread);
  const popover = ensureIdentityPopover();
  popover.setAttribute('role', 'menu');
  popover.replaceChildren();
  const title = document.createElement('div');
  title.className = 'identity-popover-title';
  title.textContent = 'Display as';
  popover.append(title);
  for (const option of options) {
    popover.append(identityVariantRow(option, option.key === selectedKey, (selected) => {
      thread.displayIdentity = selected.identity ?? null;
      applyThreadDisplayFields(thread);
      hideIdentityPopover();
      renderThreads();
      renderConversation();
      persistThreadDisplayPreference(thread);
    }));
  }
  const rect = anchor.getBoundingClientRect();
  popover.style.left = `${Math.min(rect.left, window.innerWidth - 280)}px`;
  popover.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 220)}px`;
  popover.hidden = false;
  identityMenuButton?.setAttribute('aria-expanded', 'true');
}

function renderConversationIdentity(thread) {
  const identity = threadSelectedIdentity(thread);
  const labelText = threadDisplayLabel(thread);
  if (!identity) {
    activeTitle.textContent = labelText;
    if (identityMenuButton) {
      identityMenuButton.hidden = identityDisplayOptions(thread).length <= 1;
      identityMenuButton.setAttribute('aria-label', `Choose display name for ${labelText}`);
      identityMenuButton.setAttribute('title', 'Choose display name');
    }
    return;
  }
  const label = document.createElement('span');
  label.className = `identity-title-label identity-label-${identityTone(identity)}`;
  label.textContent = labelText;
  activeTitle.replaceChildren(label);
  if (identityMenuButton) {
    identityMenuButton.hidden = identityDisplayOptions(thread).length <= 1;
    identityMenuButton.setAttribute('aria-label', `Choose display name for ${labelText}`);
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

function debugTiny(value, fallback = '-') {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text.length > 18 ? `${text.slice(0, 8)}...${text.slice(-6)}` : text;
}

function debugCountdown(isoValue) {
  const parsed = Date.parse(isoValue ?? '');
  if (!Number.isFinite(parsed)) return '-';
  const delta = parsed - Date.now();
  return delta > 0 ? `${Math.ceil(delta / 1000)}s` : 'due';
}

function debugDurationMs(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms < 0) return '-';
  if (ms < 60_000) return `${Math.ceil(ms / 1000)}s`;
  return `${Math.ceil(ms / 60_000)}m`;
}

function privateDebugPublishMessages(thread) {
  const withPublish = (thread?.messages ?? []).filter((message) => message?.publishState);
  const pending = withPublish.filter((message) => (
    message.publishState?.status !== CAPSULEHUB_PUBLISH_STATUS_CONFIRMED
  ));
  const source = pending.length > 0 ? pending : withPublish;
  return source.slice(-5);
}

function privateDebugMessageLabel(thread, message) {
  const index = Math.max(0, (thread?.messages ?? []).indexOf(message));
  const text = String(message?.text ?? '').trim();
  const shortText = text ? debugTiny(text.replace(/\s+/g, ' '), '') : (message?.attachment ? 'image' : 'msg');
  return `m${index}${shortText ? `:${shortText}` : ''}`;
}

function privateDebugPartStatus(part) {
  const status = String(part?.status ?? '-');
  if (status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED) return 'ok';
  if (status === PUBLISH_PART_STATUS_VAULT_SUBMITTED) return 'vault';
  if (status === PUBLISH_PART_STATUS_SENDING) return 'send';
  if (status === PUBLISH_PART_STATUS_SENT) return 'sent';
  if (status === PUBLISH_PART_STATUS_UNKNOWN) return 'unk';
  if (status === PUBLISH_PART_STATUS_FAILED) return 'fail';
  if (status === PUBLISH_PART_STATUS_BUILT) return 'built';
  return debugTiny(status, '-');
}

function privateDebugPartLine(part) {
  const index = Number(part?.index ?? 0);
  const nonce = part?.clientNonce !== undefined && part?.clientNonce !== null ? ` n=${part.clientNonce}` : '';
  const boc = typeof part?.externalBoc === 'string' && part.externalBoc.length > 0 ? ' boc=y' : '';
  const pid = publishIdForPart(part) ? ` pid=${debugTiny(publishIdForPart(part), '-')}` : '';
  const previous = part?.retryPreviousStatus ? ` prev=${privateDebugPartStatus({ status: part.retryPreviousStatus })}` : '';
  const retry = Number(part?.broadcastRetryCount ?? 0) || 0;
  const retryText = retry > 0 ? ` br=${retry}` : '';
  const error = part?.error ?? part?.lastBroadcastRetryError ?? part?.retryReason;
  const err = error ? ` err=${debugTiny(error, '-')}` : '';
  return `p${index}:${privateDebugPartStatus(part)}${previous}${nonce}${boc}${pid}${retryText}${err}`;
}

function privateDebugStoredCapsuleCount(message) {
  if (Array.isArray(message?.capsules)) return message.capsules.filter(Boolean).length;
  return message?.capsule ? 1 : 0;
}

function privateDebugPublishDetailLines(thread) {
  return privateDebugPublishMessages(thread).map((message) => {
    const sendKey = message.privateSendRetryKey;
    const confirmKey = message.privatePublishConfirmRetryKey;
    const sendJob = sendKey && privateSendRetryJobs.has(sendKey) ? 'job' : 'idle';
    const confirmJob = confirmKey && privatePublishConfirmJobs.has(confirmKey) ? 'job' : 'idle';
    const sendNext = debugCountdown(message.privateSendRetryNextAt);
    const confirmNext = debugCountdown(message.privatePublishConfirmNextAt);
    const expectedCapsules = Number(message.publishState?.partCount ?? message.publishState?.parts?.length ?? 0) || 0;
    const storedCapsules = privateDebugStoredCapsuleCount(message);
    const sendAttempt = Number(message.privateSendRetryAttempt ?? 0) || 0;
    const confirmAttempt = Number(message.privatePublishConfirmAttempt ?? 0) || 0;
    const stopped = `${message.privateSendRetryStopped === true ? ' sendStop=1' : ''}${message.privatePublishConfirmStopped === true ? ' confStop=1' : ''}`;
    const parts = (message.publishState?.parts ?? []).map((part) => privateDebugPartLine(part)).join(' ');
    const retryable = publishStateHasRetryableSendParts(message.publishState) ? ' retryable=1' : '';
    const partialAge = privateMessageHasPartialRetryablePublish(message)
      ? ` pAge=${debugDurationMs(privatePartialSendRetryAgeMs(message))}`
      : '';
    const partialExpired = privatePartialSendRetryExpired(message) ? ' pExpired=1' : '';
    const stateError = message.publishState?.lastBroadcastRetryError
      ? ` stateErr=${debugTiny(message.publishState.lastBroadcastRetryError, '-')}`
      : '';
    return `${privateDebugMessageLabel(thread, message)} caps=${storedCapsules}/${expectedCapsules || '-'} send=${sendJob}/${sendNext} sA=${sendAttempt} conf=${confirmJob}/${confirmNext} cA=${confirmAttempt}${stopped}${retryable}${partialAge}${partialExpired}${stateError} ${parts || 'parts=-'}`;
  });
}

function privateDebugPublishLine(thread) {
  const items = privateDebugPublishMessages(thread)
    .map((message) => {
      const state = message.publishState ?? {};
      const status = publishStateMeta(state);
      const total = Math.max(1, Number(state.partCount) || 1);
      const counts = total > 1
        ? ` c${Number(state.confirmedCount ?? 0)}/${total} s${Number(state.submittedCount ?? 0)}/${total}`
        : '';
      const updated = state.updatedAt ? new Date(state.updatedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) : '-';
      const attempt = Number(message.privatePublishConfirmAttempt ?? 0) || 0;
      const nextAt = Date.parse(message.privatePublishConfirmNextAt ?? '');
      const next = Number.isFinite(nextAt) && nextAt > Date.now()
        ? `${Math.ceil((nextAt - Date.now()) / 1000)}s`
        : '-';
      const last = debugTiny(message.privatePublishConfirmLastResult ?? message.privatePublishConfirmLastError, '-');
      const retry = Number((state.parts ?? []).reduce((sum, part) => sum + (Number(part?.broadcastRetryCount ?? 0) || 0), 0));
      const confirm = attempt > 0 || next !== '-' || last !== '-' || retry > 0
        ? ` a${attempt} next=${next} last=${last} br=${retry}`
        : '';
      return `${privateDebugMessageLabel(thread, message)} ${status}${counts}@${updated}${confirm}`;
    });
  return items.length > 0 ? items.join(' | ') : '-';
}

function privateDebugLines(thread = activeThread()) {
  if (!thread) return [];
  const sync = globalThis.plathoLastPrivateSync ?? {};
  const reason = sync.reason ?? (sync.unchanged ? 'unchanged' : 'ok');
  const phase = messageAutoSyncPhase || 'idle';
  const error = messageAutoSyncLastErrorLabel ? ` err=${debugTiny(messageAutoSyncLastErrorLabel, '-')}` : '';
  const scanLog = Array.isArray(sync.scanLog) && sync.scanLog.length > 0
    ? sync.scanLog.join(' ')
    : '-';
  const recipientCursor = sync.recipientCursor ?? {};
  const senderCursor = sync.senderCursor ?? {};
  const indexError = sync.indexReadError ? ` idxErr=${debugTiny(sync.indexReadError, '-')}` : '';
  const indexFallback = sync.indexReadFallback ? ` idxFallback=${debugTiny(sync.indexReadFallback, '-')}` : '';
  return [
    `${PLATHO_APP_RUNTIME_VERSION} key=${shortKeyId(localRecipientKeyPair?.keyId)} phase=${phase}${error}`,
    `idx=${sync.indexKeyId ?? '-'} rh=${sync.recipientHead ?? '-'} sh=${sync.senderHead ?? '-'} mode=${sync.mode ?? '-'}`,
    `rc=${recipientCursor.processedHeadLink ?? '-'}:${recipientCursor.resumeLink ?? '-'} sc=${senderCursor.processedHeadLink ?? '-'}:${senderCursor.resumeLink ?? '-'}`,
    `imp=${sync.imported ?? 0} skip=${sync.skipped ?? 0} inc=${sync.incompletePrivateStreamCount ?? 0} catch=${sync.catchUpRemaining ?? 0}`,
    `reason=${reason}${indexError}${indexFallback} block=${sync.blockedEntryId ?? '-'} body=${sync.historyUnavailableCount ?? 0} scanned=${sync.indexEntriesScanned ?? 0} repair=${sync.headRepairScanned ?? 0} retry=${sync.historyRetryScanned ?? 0}`,
    `entries ${scanLog}`,
    `publish ${privateDebugPublishLine(thread)}`,
    ...privateDebugPublishDetailLines(thread),
  ];
}

function refreshPrivateDebugLog() {
  if (!privateDebugLog) return;
  const thread = activeThread();
  if (!thread || !isChatsViewActive()) {
    privateDebugLog.hidden = true;
    privateDebugLog.textContent = '';
    if (copyPrivateDebugButton) copyPrivateDebugButton.disabled = true;
    return;
  }
  privateDebugLog.hidden = false;
  privateDebugLog.textContent = privateDebugLines(thread).join('\n');
  if (copyPrivateDebugButton) copyPrivateDebugButton.disabled = privateDebugLog.textContent.trim().length === 0;
}

let privateDebugCopyStatusTimer = null;

function setPrivateDebugCopyButtonStatus(label, durationMs = 1400) {
  if (!copyPrivateDebugButton) return;
  if (privateDebugCopyStatusTimer) {
    window.clearTimeout(privateDebugCopyStatusTimer);
    privateDebugCopyStatusTimer = null;
  }
  copyPrivateDebugButton.setAttribute('aria-label', label);
  copyPrivateDebugButton.title = label;
  privateDebugCopyStatusTimer = window.setTimeout(() => {
    privateDebugCopyStatusTimer = null;
    copyPrivateDebugButton.setAttribute('aria-label', 'Copy debug text');
    copyPrivateDebugButton.title = 'Copy debug text';
  }, durationMs);
}

async function copyPrivateDebugText() {
  refreshPrivateDebugLog();
  const text = privateDebugLog?.textContent?.trim() ?? '';
  if (!text) throw new Error('No debug text to copy');
  await copyTextToClipboard(text);
  setPrivateDebugCopyButtonStatus('Debug copied');
}

function refreshConversationSubtitle() {
  const thread = activeThread();
  if (!thread || !activeSubtitle) return;
  activeSubtitle.textContent = conversationSubtitleText(thread);
  refreshPrivateDebugLog();
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
  refreshPrivateDebugLog();
}

function completeMessageSyncUi(result) {
  messageAutoSyncLastResult = result ?? null;
  const status = privateSyncStatusText(result);
  const complete = result
    && result.ok !== false
    && result.scanComplete === true
    && result.rateLimited !== true
    && Number(result.historyUnavailableCount ?? 0) === 0
    && !['body_history_unavailable', 'catch_up_pending'].includes(String(result.reason ?? ''));
  messageAutoSyncPhase = complete ? 'synced' : 'delayed';
  messageAutoSyncLastErrorLabel = complete ? null : status;
  refreshConversationSubtitle();
  refreshPrivateDebugLog();
}

function failMessageSyncUi(label) {
  messageAutoSyncPhase = 'delayed';
  messageAutoSyncLastErrorLabel = label || 'Sync delayed';
  refreshConversationSubtitle();
  refreshPrivateDebugLog();
}

function openNewChatDialog() {
  if (!newChatDialog || !recipientInput || !recipientHint) return;
  recipientInput.value = '';
  if (recipientLocalLabel) recipientLocalLabel.value = '';
  recipientHint.textContent = 'Use a Platho name, .ath, .ton, or wallet address. Local label is only shown on this device. Bare @alex is not accepted.';
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
      existing.displayIdentity = null;
      existing.name = result.thread.name;
      existing.avatar = result.thread.avatar;
      existing.subtitle = result.thread.subtitle;
      persistThreadDisplayPreference(existing);
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
  writePublicChannelSubscriptions(publicChannelStorage(), publicChannelSubscriptions);
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
  writePublicChannelSubscriptions(publicChannelStorage(), publicChannelSubscriptions);
  rebuildThreadsFromPublicSubscriptions({ preserveActive: false });
  renderPublicSurface({ anchorUnread: false });
  setPublicStatus(subscribed ? 'channel followed' : 'channel hidden');
  return true;
}

function readPublicReadCursors() {
  try {
    const parsed = JSON.parse(localStorageOrNull()?.getItem(scopedStorageKey(PUBLIC_READ_CURSORS_STORAGE_KEY)) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writePublicReadCursors() {
  try {
    localStorageOrNull()?.setItem(scopedStorageKey(PUBLIC_READ_CURSORS_STORAGE_KEY), JSON.stringify(publicReadCursors));
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
  const blockText = (blocks = []) => (blocks ?? [])
    .filter((block) => block?.type === 'text')
    .map((block) => block.text ?? '');
  const haystack = [
    item.title,
    item.text,
    ...blockText(item.blocks),
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
      ...blockText(comment.blocks),
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

function appendPublicItemContent(container, item) {
  const blocks = Array.isArray(item?.blocks) ? item.blocks : [];
  if (blocks.length > 0) {
    for (const block of blocks) {
      if (block?.type === 'text' && block.text) {
        const text = document.createElement('p');
        text.className = 'feed-block-text';
        text.textContent = block.text;
        container.append(text);
      } else if (block?.type === 'image' && block.url) {
        const image = document.createElement('img');
        image.className = 'feed-image feed-block-image';
        image.src = block.url;
        image.alt = '';
        image.loading = 'lazy';
        container.append(image);
      }
    }
    return;
  }
  if (item?.text) {
    const text = document.createElement('p');
    text.textContent = item.text;
    container.append(text);
  }
  if (item?.imageUrl) {
    const image = document.createElement('img');
    image.className = 'feed-image';
    image.src = item.imageUrl;
    image.alt = '';
    image.loading = 'lazy';
    container.append(image);
  }
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
    appendPublicItemContent(row, comment);
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
    appendPublicItemContent(article, item);
    appendPublicItemComments(article, item);
    appendPublicItemActions(article, item);
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
  appendPublicItemContent(article, item);
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
      writePublicChannelSubscriptions(publicChannelStorage(), publicChannelSubscriptions);
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
  setText(appVersionLabel, PLATHO_APP_RUNTIME_VERSION);
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

function configuredFeeAccumulatorAddress() {
  return appConfig.feeAccumulator?.address
    ?? globalThis.plathoFeeAccumulatorAddress
    ?? globalThis.PLATHO_FEE_ACCUMULATOR_ADDRESS
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

async function resolvePrivateEntryBody(provider, entry, address, options = {}) {
  if (entry?.body_boc || !provider?.resolvePrivateEntryBody) return entry;
  return provider.resolvePrivateEntryBody(entry, {
    capsuleHubAddress: address,
    vaultAddress: appConfig.vault?.address ?? null,
    messageCacheTtlMs: options.messageCacheTtlMs ?? 0,
    priority: options.priority ?? 'critical',
    verify: options.verify,
    allowUnverifiedCriticalRead: options.allowUnverifiedCriticalRead,
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

function diagnosticBigIntString(value) {
  if (value === undefined || value === null) return null;
  try {
    return BigInt(value).toString();
  } catch {
    return String(value);
  }
}

function diagnosticBigIntOrNull(value) {
  if (value === undefined || value === null) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function profileAvatarPublishDiagnosticParts(publishState) {
  return (publishState?.parts ?? []).map((part) => ({
    index: Number(part?.index ?? 0),
    status: part?.status ?? null,
    publishKind: part?.publishKind ?? part?.publish_kind ?? null,
    clientNonce: part?.clientNonce !== undefined && part?.clientNonce !== null ? String(part.clientNonce) : null,
    publishId: part?.publishId !== undefined && part?.publishId !== null ? String(part.publishId) : null,
    entryId: part?.entryId !== undefined && part?.entryId !== null ? String(part.entryId) : null,
    bodyHash: part?.bodyHash ?? part?.body_hash ?? null,
    headerHash: part?.header0Hash ?? part?.headerHash ?? part?.header_hash ?? null,
    error: part?.error ?? null,
    externalBocLength: typeof part?.externalBoc === 'string' ? part.externalBoc.length : null,
    broadcastRetryCount: Number(part?.broadcastRetryCount ?? 0) || 0,
    lastBroadcastAt: part?.lastBroadcastAt ?? null,
  }));
}

function profileAvatarPublishPayloadDiagnostics(payloads) {
  return (payloads ?? []).map((payload, index) => ({
    index,
    kind: payload?.kind ?? null,
    type: payload?.type ?? null,
    sizeClass: payload?.sizeClass ?? payload?.size_class ?? null,
    usefulBytes: payload?.usefulBytes ?? null,
    headerBytes: payload?.headerBytes ?? null,
    bodyBytes: payload?.bodyBytes ?? payload?.bytes ?? null,
    headerBocLength: typeof payload?.headerBoc === 'string' ? payload.headerBoc.length : null,
    bodyBocLength: typeof payload?.bodyBoc === 'string' ? payload.bodyBoc.length : null,
    headerHash: payload?.headerHash ?? payload?.header_hash ?? null,
    bodyHash: payload?.bodyHash ?? payload?.body_hash ?? null,
  }));
}

function profileAvatarPublishBroadcastErrorStatus(diagnostics) {
  const snapshots = [...(diagnostics?.snapshots ?? [])].reverse();
  for (const snapshot of snapshots) {
    const part = (snapshot?.parts ?? []).find((item) => item?.error);
    if (part?.error) return shortUiErrorText({ message: part.error }, 'TON RPC broadcast failed');
  }
  if (diagnostics?.initialPublishError) {
    return shortUiErrorText({ message: diagnostics.initialPublishError }, 'TON RPC broadcast failed');
  }
  return null;
}

async function readProfileAvatarPublishChainSnapshot(ownerWallet, publishState, label) {
  const snapshot = {
    label,
    at: new Date().toISOString(),
    ownerWallet,
    vaultAddress: null,
    capsuleHubAddress: null,
    userPublishNonce: null,
    userTonBalance: null,
    vaultPendingPublishCount: null,
    capsulePublicLatestId: null,
    capsulePrivateLatestId: null,
    publishStateStatus: publishState?.status ?? null,
    publishStateConfirmedCount: Number(publishState?.confirmedCount ?? 0) || 0,
    publishStateSubmittedCount: Number(publishState?.submittedCount ?? 0) || 0,
    parts: profileAvatarPublishDiagnosticParts(publishState),
    vaultError: null,
    capsuleHubError: null,
  };
  try {
    snapshot.vaultAddress = requireVaultAddress();
    const provider = await resolveVaultChainProvider();
    if (provider?.getUser) {
      const user = await provider.getUser(ownerWallet, {
        vaultAddress: snapshot.vaultAddress,
        verify: true,
        priority: 'critical',
        cacheTtlMs: 0,
      });
      snapshot.userPublishNonce = diagnosticBigIntString(user?.publish_nonce ?? user?.publishNonce);
      snapshot.userTonBalance = diagnosticBigIntString(user?.ton_balance ?? user?.tonBalance);
    }
    if (provider?.getGlobal) {
      const global = await provider.getGlobal({
        vaultAddress: snapshot.vaultAddress,
        verify: true,
        priority: 'critical',
        cacheTtlMs: 0,
      });
      snapshot.vaultPendingPublishCount = diagnosticBigIntString(global?.pending_publish_count ?? global?.pendingPublishCount);
    }
  } catch (error) {
    snapshot.vaultError = String(error?.message ?? error);
  }
  try {
    const resolved = await resolveCapsuleHubProvider();
    snapshot.capsuleHubAddress = resolved?.address ?? null;
    if (resolved?.provider?.getState) {
      const state = await resolved.provider.getState(criticalCapsuleHubReadOptions(resolved.address));
      snapshot.capsulePublicLatestId = diagnosticBigIntString(state?.public_latest_id ?? state?.publicLatestId);
      snapshot.capsulePrivateLatestId = diagnosticBigIntString(state?.private_latest_id ?? state?.privateLatestId);
    }
  } catch (error) {
    snapshot.capsuleHubError = String(error?.message ?? error);
  }
  return snapshot;
}

function profileAvatarPublishDiagnosticStatus(diagnostics) {
  const snapshots = diagnostics?.snapshots ?? [];
  const before = snapshots.find((item) => item.label === 'before-public-publish');
  const after = snapshots.findLast?.((item) => item.label === 'after-avatar-not-visible')
    ?? [...snapshots].reverse().find((item) => item.label === 'after-avatar-not-visible');
  if (!before || !after) return null;
  const beforeNonce = diagnosticBigIntOrNull(before.userPublishNonce);
  const afterNonce = diagnosticBigIntOrNull(after.userPublishNonce);
  const beforePublic = diagnosticBigIntOrNull(before.capsulePublicLatestId);
  const afterPublic = diagnosticBigIntOrNull(after.capsulePublicLatestId);
  const beforePending = diagnosticBigIntOrNull(before.vaultPendingPublishCount);
  const afterPending = diagnosticBigIntOrNull(after.vaultPendingPublishCount);
  if (afterPublic !== null && beforePublic !== null && afterPublic > beforePublic) {
    return 'CapsuleHub entry appeared; avatar search failed';
  }
  if (afterPending !== null && beforePending !== null && afterPending > beforePending) {
    return 'Vault publish pending; CapsuleHub ACK not seen yet';
  }
  if (afterNonce !== null && beforeNonce !== null && afterNonce > beforeNonce) {
    return 'Vault accepted publish, but CapsuleHub entry was not created';
  }
  const broadcastError = profileAvatarPublishBroadcastErrorStatus(diagnostics);
  if (broadcastError) return `TON RPC broadcast failed: ${broadcastError}`;
  return null;
}

function publicAvatarPartMatches(payload, ownerWallet, pointer) {
  if (payload?.type !== 'avatar') return false;
  if (String(payload.avatarHash ?? payload.avatar_hash ?? '').toLowerCase() !== pointer.avatarHash.toLowerCase()) return false;
  const pointerStreamId = pointer.avatarStreamId ?? pointer.avatar_stream_id ?? null;
  if (pointerStreamId && String(payload.stream_id ?? '').toLowerCase() !== String(pointerStreamId).toLowerCase()) return false;
  if (pointer.profileVersion && Number(payload.profileVersion ?? payload.profile_version ?? 0) !== Number(pointer.profileVersion)) return false;
  if (pointer.avatarPartCount && Number(payload.partCount ?? payload.part_count ?? 0) !== Number(pointer.avatarPartCount)) return false;
  if (ownerWallet && payload.authorWallet && !sameWalletAddress(payload.authorWallet, ownerWallet)) return false;
  return true;
}

function avatarPartStreamId(part) {
  return String(part?.stream_id ?? part?.streamId ?? '').toLowerCase();
}

function avatarPartsCompleteForPointer(parts, pointer) {
  const expected = Number(pointer.avatarPartCount ?? pointer.partCount ?? 0);
  if (!Number.isSafeInteger(expected) || expected <= 0) return false;
  const groups = new Map();
  for (const part of parts ?? []) {
    const index = Number(part.partIndex ?? part.part_index ?? -1);
    if (!Number.isSafeInteger(index) || index < 0 || index >= expected) continue;
    const streamId = avatarPartStreamId(part);
    const group = groups.get(streamId) ?? new Set();
    group.add(index);
    groups.set(streamId, group);
    if (group.size >= expected) return true;
  }
  return false;
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

async function assembledAvatarPartGroup(parts, pointer) {
  const groups = new Map();
  for (const part of parts ?? []) {
    const streamId = avatarPartStreamId(part);
    const group = groups.get(streamId) ?? [];
    group.push(part);
    groups.set(streamId, group);
  }
  for (const groupParts of groups.values()) {
    const imageUrl = await cacheAssembledAvatarParts(groupParts, pointer);
    if (!imageUrl) continue;
    return {
      imageUrl,
      parts: groupParts,
      streamId: groupParts[0]?.stream_id ?? groupParts[0]?.streamId ?? null,
    };
  }
  return null;
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
  const cached = await readProfileAvatarMediaCache(pointer?.avatarHash);
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
        const payload = await resolvePublicEntryPayload(provider, entry, address, { maxBytes: PUBLIC_POST_BODY_MAX_BYTES });
        if (!payload) continue;
        payload.authorWallet = String(entry.author_wallet ?? '');
        if (!publicAvatarPartMatches(payload, ownerWallet, pointer)) continue;
        parts.push({
          ...payload,
          entryId: entry.entry_id?.toString?.() ?? entryId.toString(),
          imageBytes: payload.imageBytes ?? payload.image_bytes,
        });
        if (avatarPartsCompleteForPointer(parts, pointer)) break;
      } catch (error) {
        if (!/not found|missing|does not exist/i.test(String(error?.message ?? error))) console.error(error);
      }
    }
    const assembled = await assembledAvatarPartGroup(parts, pointer);
    if (assembled?.imageUrl) return assembled.imageUrl;
  }

  const state = await provider.getState(readOptions);
  const latest = BigInt(state.public_latest_id ?? 0n);
  const configuredLimit = Number(options.scanLimit ?? appConfig.capsuleHub?.publicAvatarReadLimit ?? 0);
  const limit = BigInt(Math.max(
    PROFILE_AVATAR_FALLBACK_SCAN_LIMIT,
    Number.isFinite(configuredLimit) ? Math.max(0, Math.floor(configuredLimit)) : 0,
  ));
  const floor = latest > limit ? latest - limit : 0n;
  for (let entryId = latest - 1n; entryId >= floor; entryId -= 1n) {
    const entry = await provider.getPublicEntry(entryId, readOptions);
    if (entry.exists !== true) {
      if (entryId === 0n) break;
      continue;
    }
    const payload = await resolvePublicEntryPayload(provider, entry, address, { maxBytes: PUBLIC_POST_BODY_MAX_BYTES });
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
      if (avatarPartsCompleteForPointer(parts, pointer)) break;
    }
    if (entryId === 0n) break;
  }
  return (await assembledAvatarPartGroup(parts, pointer))?.imageUrl ?? null;
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
      const payload = await resolvePublicEntryPayload(provider, entry, address, { maxBytes: PUBLIC_POST_BODY_MAX_BYTES });
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
        if (avatarPartsCompleteForPointer(parts, pointer)) break;
      }
    }
    if (entryId === 0n) break;
  }
  const assembled = await assembledAvatarPartGroup(parts, pointer);
  if (!assembled?.imageUrl) return null;
  const firstEntryId = assembled.parts.reduce((min, part) => {
    const value = publicEntryIdBigInt(part.entryId) ?? min;
    return value < min ? value : min;
  }, publicEntryIdBigInt(assembled.parts[0]?.entryId) ?? 0n);
  return {
    imageUrl: assembled.imageUrl,
    firstEntryId,
    parts: assembled.parts,
    streamId: assembled.streamId,
    confirmedBy: 'recovered_from_existing_identical_payload',
  };
}

async function findConfirmedAvatarEntriesFromPublishState(ownerWallet, pointer, publishState) {
  const expectedParts = Number(pointer?.avatarPartCount ?? pointer?.partCount ?? 0);
  if (!Number.isSafeInteger(expectedParts) || expectedParts <= 0) return null;
  const confirmedParts = (publishState?.parts ?? []).filter((part) => (
    publishPartKind(part) === 'public'
    && part.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED
    && part.entryId !== undefined
    && part.entryId !== null
  )).sort((left, right) => Number(left?.index ?? 0) - Number(right?.index ?? 0));
  if (confirmedParts.length === 0) return null;
  if (confirmedParts.length >= expectedParts) {
    const byIndex = new Map();
    for (const part of confirmedParts) {
      const index = Number(part.index ?? -1);
      if (!Number.isSafeInteger(index) || index < 0 || index >= expectedParts) continue;
      byIndex.set(index, part);
    }
    if (byIndex.size >= expectedParts) {
      const ordered = [...byIndex.values()].sort((left, right) => Number(left.index ?? 0) - Number(right.index ?? 0));
      const firstEntryId = ordered.reduce((min, part) => {
        const value = publicEntryIdBigInt(part.entryId) ?? min;
        return value < min ? value : min;
      }, publicEntryIdBigInt(ordered[0]?.entryId) ?? 0n);
      return {
        imageUrl: await readProfileAvatarMediaCache(pointer.avatarHash),
        firstEntryId,
        parts: ordered.map((part) => ({
          entryId: String(part.entryId),
          partIndex: Number(part.index ?? 0),
          part_count: expectedParts,
          partCount: expectedParts,
          bodyHash: part.bodyHash ?? null,
          headerHash: part.header0Hash ?? null,
          stream_id: pointer.avatarStreamId ?? pointer.avatar_stream_id ?? null,
          streamId: pointer.avatarStreamId ?? pointer.avatar_stream_id ?? null,
          avatarHash: pointer.avatarHash,
          avatar_hash: pointer.avatarHash,
        })),
        streamId: pointer.avatarStreamId ?? pointer.avatar_stream_id ?? null,
        confirmedBy: 'publish_state_hashes',
      };
    }
  }
  const resolved = await resolveCapsuleHubProvider();
  if (!resolved) return null;
  const { provider, address } = resolved;
  const readOptions = criticalCapsuleHubReadOptions(address);
  const parts = [];
  for (const part of confirmedParts) {
    const entryId = publicEntryIdBigInt(part.entryId);
    if (entryId === null || entryId < 0n) continue;
    const entry = await provider.getPublicEntry(entryId, readOptions);
    if (entry.exists !== true) continue;
    const payload = await resolvePublicEntryPayload(provider, entry, address, { maxBytes: PUBLIC_POST_BODY_MAX_BYTES });
    if (!payload) continue;
    payload.authorWallet = String(entry.author_wallet ?? '');
    if (!publicAvatarPartMatches(payload, ownerWallet, pointer)) continue;
    parts.push({
      ...payload,
      entryId: entry.entry_id?.toString?.() ?? entryId.toString(),
      imageBytes: payload.imageBytes ?? payload.image_bytes,
    });
  }
  const assembled = await assembledAvatarPartGroup(parts, pointer);
  if (!assembled?.imageUrl) return null;
  const firstEntryId = assembled.parts.reduce((min, part) => {
    const value = publicEntryIdBigInt(part.entryId) ?? min;
    return value < min ? value : min;
  }, publicEntryIdBigInt(assembled.parts[0]?.entryId) ?? 0n);
  return {
    imageUrl: assembled.imageUrl,
    firstEntryId,
    parts: assembled.parts,
    streamId: assembled.streamId,
  };
}

async function waitForPublishedAvatarEntries(ownerWallet, pointer) {
  let lastTransientError = null;
  for (let attempt = 0; attempt < PROFILE_AVATAR_PUBLISH_CONFIRM_ATTEMPTS; attempt += 1) {
    try {
      const found = await findPublishedAvatarEntries(ownerWallet, pointer);
      if (found) return found;
      lastTransientError = null;
    } catch (error) {
      if (!isTonRpcRecoverableReadError(error) && !noteTonRpcRateLimit(error)) throw error;
      lastTransientError = error;
    }
    await delay(PROFILE_AVATAR_PUBLISH_CONFIRM_DELAY_MS);
  }
  if (lastTransientError) throw lastTransientError;
  const error = new Error('Avatar capsules are not visible on-chain yet');
  error.code = 'PLATHO_AVATAR_CAPSULES_NOT_VISIBLE';
  throw error;
}

async function waitForProfileAvatarRegistryUpdate(ownerWallet, avatarHash) {
  const expectedHash = normalizeAvatarHashHex(avatarHash);
  let lastTransientError = null;
  for (let attempt = 0; attempt < PROFILE_AVATAR_PUBLISH_CONFIRM_ATTEMPTS; attempt += 1) {
    try {
      const pointer = await readCurrentProfileAvatarPointerFromChain(ownerWallet, { required: true });
      if (pointer?.avatarHash?.toLowerCase() === expectedHash.toLowerCase()) return pointer;
      lastTransientError = null;
    } catch (error) {
      if (!isTonRpcRecoverableReadError(error) && !noteTonRpcRateLimit(error)) throw error;
      lastTransientError = error;
    }
    await delay(PROFILE_AVATAR_PUBLISH_CONFIRM_DELAY_MS);
  }
  if (lastTransientError) throw lastTransientError;
  throw new Error('Avatar registry update is not visible on-chain yet');
}

async function loadProfileAvatarImage(ownerWallet, pointer = null) {
  if (!ownerWallet) return null;
  const requestedPointer = pointer ? avatarPointerFromFields(pointer.profileVersion ?? pointer.profile_version, pointer.avatarHash ?? pointer.avatar_hash) : null;
  const cached = requestedPointer ? await readProfileAvatarMediaCache(requestedPointer.avatarHash) : null;
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
      writePublicChannelSubscriptions(publicChannelStorage(), publicChannelSubscriptions);
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
  writePublicChannelSubscriptions(publicChannelStorage(), publicChannelSubscriptions);
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
  const minEntryId = syncWindow === 'long' ? 0 : Math.max(0, latest - readLimit);
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
      payload = await resolvePublicEntryPayload(provider, entry, address, { maxBytes: PUBLIC_POST_BODY_MAX_BYTES });
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
      documentBytes: payload.documentBytes ?? payload.document_bytes,
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
    } else if (payload.type === 'comment' || payload.type === 'image_comment' || payload.type === 'document_comment') {
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
      const documentParts = ordered.filter((item) => item.documentBytes?.length);
      const documentBytes = documentParts.length > 0
        ? new Uint8Array(documentParts.reduce((sum, item) => sum + item.documentBytes.length, 0))
        : null;
      if (documentBytes) {
        let offset = 0;
        for (const item of documentParts) {
          documentBytes.set(item.documentBytes, offset);
          offset += item.documentBytes.length;
        }
      }
      const documentBlocks = documentBytes
        ? displayBlocksFromDocumentBlocks(decodeMessageDocumentBlocks(documentBytes))
        : [];
      const readEntryId = ordered.reduce((max, item) => {
        const value = publicEntryIdBigInt(item.entryId) ?? -1n;
        return value > max ? value : max;
      }, -1n);
      const item = {
        ...first,
        text: documentBlocks.length > 0
          ? messagePreviewFromBlocks(documentBlocks)
          : ordered.filter((part) => !part.imageBytes?.length && !part.documentBytes?.length).map((part) => part.text ?? '').join(''),
        blocks: documentBlocks.length > 0 ? documentBlocks : undefined,
        readEntryId: readEntryId >= 0n ? readEntryId.toString() : first.entryId,
        partCount: group.expected,
        avatarImageUrl: null,
      };
      if (imageBytes && documentBlocks.length === 0) {
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
  const channelIdsToRefresh = new Set([
    ...publicChannelRegistry.map((channel) => channel.id),
    ...Object.keys(publicChannelFeedCache ?? {}),
    ...postsByChannel.keys(),
  ]);
  const nextFeedCache = {};
  for (const channelId of channelIdsToRefresh) {
    const channelPosts = postsByChannel.get(channelId) ?? [];
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
    allTime: syncWindow === 'long',
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
    // First cycle on a fresh load pays the verifier failure that parks a dead
    // verifier (e.g. region-blocked toncenter); retry unverified in the same
    // call so the public feed loads immediately instead of next tick.
    const syncedFromChain = await callWithDegradedTransportReadFallback(
      () => syncPublicChannelFromChain(),
      () => syncPublicChannelFromChain(),
    );
    if (syncedFromChain) {
      writePublicChannelFeedCache(publicChannelStorage(), publicChannelFeedCache);
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
  writePublicChannelFeedCache(publicChannelStorage(), publicChannelFeedCache);
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
  writePublicChannelFeedCache(publicChannelStorage(), publicChannelFeedCache);
  rebuildThreadsFromPublicSubscriptions({ preserveActive: true });
  renderPublicSurface({ anchorUnread: false });
  renderThreads();
  renderConversation();
  return true;
}

function privateKeyIdIndexValue(keyId) {
  const bytes = base64UrlToBytes(keyId);
  if (bytes.length !== 32) throw new Error('Private messaging key id must be 32 bytes');
  return bytesToBigIntValue(bytes);
}

function privateChainIndexStorageKey(address = configuredCapsuleHubAddress(), role = 'recipient') {
  const hub = address ?? 'no-capsulehub';
  const keyId = localRecipientKeyPair?.keyId ?? 'no-key';
  return `${PRIVATE_CHAIN_INDEX_STORAGE_PREFIX}:${hub}:${keyId}:${role}`;
}

function normalizePrivateChainIndexCursor(cursor) {
  const normalized = {
    processedHeadLink: 0n,
    targetHeadLink: 0n,
    resumeLink: 0n,
  };
  if (!cursor || typeof cursor !== 'object') return normalized;
  for (const field of Object.keys(normalized)) {
    const raw = cursor[field];
    try {
      if (raw !== null && raw !== undefined && /^[0-9]+$/.test(String(raw))) normalized[field] = BigInt(raw);
    } catch {
      normalized[field] = 0n;
    }
  }
  return normalized;
}

function readPrivateChainIndexCursor(address, role) {
  try {
    const raw = localStorageOrNull()?.getItem(privateChainIndexStorageKey(address, role));
    if (!raw) return normalizePrivateChainIndexCursor(null);
    return normalizePrivateChainIndexCursor(JSON.parse(raw));
  } catch {
    // Non-persistent mode starts from the current indexed head.
  }
  return normalizePrivateChainIndexCursor(null);
}

function writePrivateChainIndexCursor(address, role, cursor) {
  try {
    const normalized = normalizePrivateChainIndexCursor(cursor);
    localStorageOrNull()?.setItem(privateChainIndexStorageKey(address, role), JSON.stringify({
      processedHeadLink: normalized.processedHeadLink.toString(),
      targetHeadLink: normalized.targetHeadLink.toString(),
      resumeLink: normalized.resumeLink.toString(),
    }));
  } catch {
    // Encrypted history still dedupes by capsule id when local storage is unavailable.
  }
}

function privateChainHeadRepairStorageKey(address = configuredCapsuleHubAddress(), role = 'recipient') {
  const hub = address ?? 'no-capsulehub';
  const keyId = localRecipientKeyPair?.keyId ?? 'no-key';
  return `${PRIVATE_CHAIN_HEAD_REPAIR_STORAGE_PREFIX}:${hub}:${keyId}:${role}`;
}

function readPrivateChainHeadRepairLink(address, role) {
  try {
    const raw = localStorageOrNull()?.getItem(privateChainHeadRepairStorageKey(address, role));
    if (!/^[0-9]+$/.test(String(raw ?? ''))) return 0n;
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

function writePrivateChainHeadRepairLink(address, role, link) {
  try {
    const normalized = privateIndexLinkValue(link);
    localStorageOrNull()?.setItem(privateChainHeadRepairStorageKey(address, role), normalized.toString());
  } catch {
    // Repair scans are opportunistic; normal chain cursors still gate steady-state sync.
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

function privateBodyHistoryRetryEntryIds(address, options = {}) {
  const ids = [];
  const records = readPrivateBodyHistoryUnavailable(address);
  const force = options.forceHistoryRetry === true;
  const retryLimit = force ? PRIVATE_CHAIN_HISTORY_RETRY_MANUAL_LIMIT : PRIVATE_CHAIN_HISTORY_RETRY_AUTO_LIMIT;
  const now = Date.now();
  for (const record of records) {
    if (!force) {
      const lastSeenMs = Date.parse(record.lastSeenAt ?? '');
      if (Number.isFinite(lastSeenMs) && now - lastSeenMs < PRIVATE_CHAIN_HISTORY_RETRY_COOLDOWN_MS) continue;
    }
    try {
      const id = BigInt(record.entryId);
      if (id < 0n) continue;
      ids.push(id);
    } catch {
      // Ignore corrupt local retry records.
    }
    if (ids.length >= retryLimit) break;
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

function plathoUsernameIdentity(label) {
  const parsed = parseRecipientIdentity(label);
  return parsed.ok && parsed.identity.type === RECIPIENT_IDENTITY_TYPES.PLATHO_NFT ? parsed.identity : null;
}

async function verifiedPlathoUsernameIdentityForWallet(label, walletAddress) {
  const rawWallet = rawWalletAddress(walletAddress);
  const identity = plathoUsernameIdentity(label);
  if (!rawWallet || !identity) return null;
  const key = `${identity.value}:${rawWallet}`;
  if (verifiedPlathoUsernameOwnerCache.has(key)) return verifiedPlathoUsernameOwnerCache.get(key);
  try {
    const resolved = await resolvePlathoUsernameOwner(identity.value);
    const verified = sameWalletAddress(resolved.ownerWallet, rawWallet)
      ? plathoUsernameIdentity(resolved.label)
      : null;
    verifiedPlathoUsernameOwnerCache.set(key, verified);
    return verified;
  } catch (error) {
    if (!noteTonRpcRateLimit(error)) {
      console.warn('Unable to verify private sender username', identity.value, error);
    }
    return null;
  }
}

async function privateWalletIdentityVariantsWithUsername(walletAddress, usernameLabel) {
  const base = privateWalletIdentityVariants(walletAddress);
  const username = await verifiedPlathoUsernameIdentityForWallet(usernameLabel, walletAddress);
  return normalizeIdentityVariants([username, ...base]);
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

function knownPrivateWalletForSigningPubkey(signPubkey) {
  let key = null;
  try {
    key = signPubkey ? BigInt(signPubkey).toString() : null;
  } catch {
    return null;
  }
  if (!key) return null;
  const remembered = knownVaultKeyOwnerBySignPubkey.get(key);
  if (remembered) return remembered;
  for (const thread of threads) {
    const wallet = rawWalletAddress(ownerWalletFromThread(thread));
    if (!wallet) continue;
    for (const message of thread.messages ?? []) {
      if (message?.type !== 'in') continue;
      const capsules = [
        message.capsule,
        ...(message.capsules ?? []),
      ].filter(Boolean);
      if (capsules.some((capsule) => senderSigningPublicKeyValue({ capsule }) === key)) {
        knownVaultKeyOwnerBySignPubkey.set(key, wallet);
        return wallet;
      }
    }
  }
  return null;
}

async function resolveCurrentKnownVaultKeyRecord(walletAddress, provider, options = {}) {
  const raw = rawWalletAddress(walletAddress);
  if (!raw) return null;
  const cached = knownVaultKeyRecordByWallet.get(raw);
  if (cached && options.allowCached !== false) return cached;
  // Key trust prefers dual-provider verification. When verification is
  // structurally impossible (no reachable verifier on this network), the
  // record is still bound to the on-chain key id by hash recomputation in
  // assertVaultKeyRecordMatchesOwner, and availability wins by policy.
  const readPair = async (chainReadOptions) => {
    const readOptions = { vaultAddress: requireVaultAddress(), ...chainReadOptions };
    const user = await provider.getUser(raw, readOptions);
    const currentKeyId = BigInt(user.current_key_id ?? 0n);
    if (user.exists !== true || currentKeyId === 0n) return null;
    const keyRecord = await provider.getKeyRecord(currentKeyId, {
      ownerWallet: raw,
      ...readOptions,
    });
    await assertVaultKeyRecordMatchesOwner(raw, keyRecord, currentKeyId);
    rememberKnownVaultKeyOwner(raw, keyRecord);
    return keyRecord;
  };
  return callWithDegradedTransportReadFallback(
    () => readPair(criticalChainReadOptions()),
    () => readPair(unverifiedCriticalChainReadOptions()),
  );
}

async function assertVaultKeyRecordMatchesOwner(walletAddress, keyRecord, expectedKeyId) {
  const expected = BigInt(expectedKeyId ?? 0n);
  if (expected === 0n) throw new Error('Vault key id is required');
  const computedKeyId = await computeVaultMessagingKeyId({
    owner_wallet: requireBasechainAddress(walletAddress, 'Vault key owner'),
    key_generation: keyRecord?.key_generation ?? keyRecord?.keyGeneration,
    enc_pubkey: keyRecord?.enc_pubkey ?? keyRecord?.encPubkey,
    sign_pubkey: keyRecord?.sign_pubkey ?? keyRecord?.signPubkey,
    pq_kem_pubkey_hash: keyRecord?.pq_kem_pubkey_hash ?? keyRecord?.pqKemPubkeyHash,
    pq_kem_pubkey_len: keyRecord?.pq_kem_pubkey_len ?? keyRecord?.pqKemPubkeyLen,
    crypto_suite_mask: keyRecord?.crypto_suite_mask ?? keyRecord?.cryptoSuiteMask,
  });
  if (computedKeyId !== expected) {
    throw new Error('Vault key record does not belong to this wallet');
  }
  return computedKeyId;
}

async function resolveVaultKeyRecordForSenderWallet(walletAddress, vaultKeyId, provider) {
  const raw = rawWalletAddress(walletAddress);
  if (!raw) return null;
  if (vaultKeyId !== null && vaultKeyId !== undefined && BigInt(vaultKeyId) > 0n) {
    const readRecord = async (chainReadOptions) => {
      const keyRecord = await provider.getKeyRecord(BigInt(vaultKeyId), {
        ownerWallet: raw,
        vaultAddress: requireVaultAddress(),
        ...chainReadOptions,
      });
      await assertVaultKeyRecordMatchesOwner(raw, keyRecord, BigInt(vaultKeyId));
      rememberKnownVaultKeyOwner(raw, keyRecord);
      return keyRecord;
    };
    return callWithDegradedTransportReadFallback(
      () => readRecord(criticalChainReadOptions()),
      () => readRecord(unverifiedCriticalChainReadOptions()),
    );
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
  const localMatch = knownPrivateWalletForSigningPubkey(signPubkey);
  if (localMatch) return localMatch;
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

async function threadForOpenedSenderCapsule(opened) {
  const recipientWallet = rawWalletAddress(opened?.payload?.recipientWallet ?? opened?.payload?.recipient_wallet);
  if (recipientWallet) {
    const variants = privateWalletIdentityVariants(recipientWallet);
    const identityThread = findThreadByIdentityVariants(threads, variants);
    if (identityThread) return refreshThreadIdentityFromVariants(identityThread, variants);
    const created = createRecipientThread(recipientWallet);
    if (created?.ok && created.thread) {
      const existingById = threads.find((thread) => thread.id === created.thread.id);
      if (existingById) return refreshThreadIdentityFromVariants(existingById, variants);
      threads.push(created.thread);
      return refreshThreadIdentityFromVariants(created.thread, variants);
    }
  }
  const recipientKeyId = opened?.capsule?.header0?.recipientKeyId ?? opened?.payload?.recipientKeyId ?? opened?.payload?.recipient_key_id;
  const fallback = createInboundPeerThread({
    senderKeyId: recipientKeyId,
    keyId: recipientKeyId,
    label: 'Recovered sent',
  });
  const existingById = threads.find((thread) => thread.id === fallback.id);
  if (existingById) return existingById;
  threads.push(fallback);
  return fallback;
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

function messageBlocksForHistory(message) {
  if (!Array.isArray(message?.blocks) || message.blocks.length <= 0) return null;
  return safeJsonClone(message.blocks) ?? null;
}

function valuesJsonEqual(a, b) {
  try {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  } catch {
    return false;
  }
}

function mergeOpenedPrivateMessage(existingMessage, incomingMessage) {
  if (!existingMessage || !incomingMessage) return false;
  let changed = false;
  const assignIfPresent = (field) => {
    const value = incomingMessage[field];
    if (value === undefined || value === null) return;
    if (valuesJsonEqual(existingMessage[field], value)) return;
    existingMessage[field] = safeJsonClone(value) ?? value;
    changed = true;
  };
  const incomingBlocks = Array.isArray(incomingMessage.blocks) && incomingMessage.blocks.length > 0
    ? incomingMessage.blocks
    : null;
  if (incomingBlocks && !valuesJsonEqual(existingMessage.blocks, incomingBlocks)) {
    existingMessage.blocks = safeJsonClone(incomingBlocks) ?? incomingBlocks;
    changed = true;
  }
  for (const field of [
    'text',
    'payment',
    'attachment',
    'capsule',
    'capsules',
    'chainEntryId',
    'chainLastEntryId',
    'createdAt',
    'createdAtMs',
    'meta',
    'profileVersion',
    'avatarHash',
  ]) {
    assignIfPresent(field);
  }
  if (/published/i.test(String(incomingMessage.meta ?? ''))) {
    if (existingMessage.privatePublishConfirmStopped === true) changed = true;
    if (existingMessage.privateSendRetryStopped === true) changed = true;
    if (existingMessage.privateManualRetryAvailable === true) changed = true;
    if (existingMessage.privateCancelAvailable === true) changed = true;
    if (existingMessage.privateSendLastError) changed = true;
    existingMessage.privateSendRetryStopped = false;
    existingMessage.privateSendRetryAttempt = 0;
    existingMessage.privatePublishConfirmStopped = false;
    existingMessage.privatePublishConfirmAttempt = 0;
    clearPrivateSendRetry(existingMessage);
    clearPrivatePublishConfirmRetry(existingMessage);
    clearPrivateMessageManualRecovery(existingMessage);
  }
  return changed;
}

async function upsertOpenedPrivateMessage(existing, targetThread, incomingMessage) {
  if (!existing?.message || !targetThread || !incomingMessage) return false;
  const relocated = relocateExistingCapsuleMessage(existing, targetThread);
  const changed = mergeOpenedPrivateMessage(existing.message, incomingMessage);
  if (relocated || changed) {
    refreshThreadAfterMessageChange(existing.thread);
    refreshThreadAfterMessageChange(targetThread);
    await updateMessageInEncryptedHistory(targetThread, existing.message);
  }
  return relocated || changed;
}

function refreshThreadIdentityFromVariants(thread, variants) {
  if (!thread || variants.length === 0) return thread;
  const normalizedVariants = normalizeIdentityVariants(variants);
  const preferred = preferredInboundIdentity(normalizedVariants);
  const existingIdentity = thread.identity ? primaryThreadIdentity({ identity: thread.identity }) : null;
  const nextIdentity = existingIdentity ?? preferred;
  thread.pendingIdentityResolution = false;
  thread.pendingIdentityResolutionAt = null;
  thread.identityVariants = normalizeIdentityVariants([
    nextIdentity,
    ...(thread.identityVariants ?? []),
    ...normalizedVariants,
  ]);
  if (!existingIdentity && nextIdentity) {
    thread.identity = nextIdentity;
  }
  if (!thread.localLabel && !thread.displayIdentity && nextIdentity) {
    const label = displayIdentityLabel(nextIdentity);
    thread.name = label;
    thread.subtitle = identityTypeLabel(nextIdentity);
    thread.avatar = String(label || 'P').slice(0, 1).toUpperCase() || thread.avatar || 'P';
  }
  return thread;
}

async function threadForChainCapsule(opened, entry) {
  if (opened?.openedAs === 'sender') {
    const target = await threadForOpenedSenderCapsule(opened);
    if (target) return target;
  }
  const senderKeyId = opened?.capsule?.header0?.senderKeyId;
  const senderWallet = await resolvePrivateCapsuleSenderWallet(opened, entry);
  const senderUsername = opened?.payload?.senderUsername ?? opened?.payload?.sender_username;
  const variants = await privateWalletIdentityVariantsWithUsername(senderWallet, senderUsername);
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
  if (!senderWallet) {
    created.pendingIdentityResolution = true;
    created.pendingIdentityResolutionAt = new Date().toISOString();
  }
  const existingById = threads.find((thread) => thread.id === created.id);
  if (existingById) {
    if (!senderWallet && isAnonymousPeerThread(existingById)) {
      existingById.pendingIdentityResolution = true;
      existingById.pendingIdentityResolutionAt = existingById.pendingIdentityResolutionAt ?? new Date().toISOString();
    }
    return refreshThreadIdentityFromVariants(existingById, variants);
  }
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
  const cached = pointer ? await readProfileAvatarMediaCache(pointer.avatarHash) : null;
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
  const local = Number(message?.localCreatedAtMs ?? message?.localHistoryCreatedAt);
  if (Number.isFinite(local) && local > 0) return local;
  const direct = Number(message?.createdAtMs);
  if (Number.isFinite(direct) && direct > 0) return direct;
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
  const isOutgoing = opened?.openedAs === 'sender';
  const payment = paymentFromCompactPayload(opened.payload);
  const isImage = opened.payload?.type === 'image';
  const isDocument = opened.payload?.type === 'document';
  const documentBlocks = isDocument ? displayBlocksFromDocumentBlocks(decodeMessageDocumentBlocks(opened.payload.bytes)) : [];
  const documentPayment = paymentFromDocumentBlocks(documentBlocks);
  const effectivePayment = payment ?? documentPayment;
  const text = isDocument
    ? messagePreviewFromBlocks(documentBlocks)
    : (payment ? paymentMessageText(payment) : (isImage ? '' : opened.plaintext));
  const message = {
    type: isOutgoing ? 'out' : 'in',
    text,
    meta,
    ...privateChainMessageOrderFields(entry),
    payment: effectivePayment,
    blocks: documentBlocks.length > 0 ? documentBlocks : undefined,
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
  if (entry?.openedAs === 'sender') return parts > 1 ? `published (${parts} parts)` : 'published';
  return parts > 1 ? `received (${parts} parts)` : 'received';
}

function privatePartKey(opened, entry) {
  const streamId = opened?.payload?.stream_id ?? 'single';
  const peer = opened?.openedAs === 'sender'
    ? rawWalletAddress(opened?.payload?.recipientWallet ?? opened?.payload?.recipient_wallet)
    : rawWalletAddress(opened?.payload?.senderWallet ?? opened?.payload?.sender_wallet);
  const identity = peer
    ?? privateEntryPublisherWallet(entry)
    ?? opened?.capsule?.header0?.senderKeyId
    ?? 'unknown';
  return `${opened?.openedAs ?? 'unknown'}:${identity}:${streamId}`;
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
  const isOutgoing = first?.openedAs === 'sender';
  const firstEntry = orderedByChain[0]?.entry;
  const lastEntry = orderedByChain[orderedByChain.length - 1]?.entry;
  const chainLastEntryId = privateEntryIdText(lastEntry);
  const documentParts = ordered.filter((part) => part.opened?.payload?.type === 'document');
  const documentBytes = documentParts.length > 0
    ? new Uint8Array(documentParts.reduce((sum, part) => sum + (part.opened?.payload?.bytes?.length ?? 0), 0))
    : null;
  if (documentBytes) {
    let offset = 0;
    for (const part of documentParts) {
      documentBytes.set(part.opened.payload.bytes, offset);
      offset += part.opened.payload.bytes.length;
    }
  }
  const documentBlocks = documentBytes ? displayBlocksFromDocumentBlocks(decodeMessageDocumentBlocks(documentBytes)) : [];
  const documentPayment = paymentFromDocumentBlocks(documentBlocks);
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
    type: isOutgoing ? 'out' : 'in',
    text: documentBlocks.length > 0 ? messagePreviewFromBlocks(documentBlocks) : text,
    meta,
    ...privateChainMessageOrderFields(firstEntry),
    capsule: first?.capsule,
    capsules: ordered.map((part) => part.opened?.capsule).filter(Boolean),
    payment: documentPayment,
    blocks: documentBlocks.length > 0 ? documentBlocks : undefined,
    profileVersion: first?.capsule?.header0?.profileVersion ?? 0,
    avatarHash: first?.capsule?.header0?.avatarHash ?? zeroAvatarHashHex(),
  };
  if (chainLastEntryId && chainLastEntryId !== message.chainEntryId) {
    message.chainLastEntryId = chainLastEntryId;
  }
  if (imageBytes && documentBlocks.length === 0) {
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
  thread.preview = last
    ? (messagePreviewFromBlocks(last.blocks) || last.text || (last.attachment ? 'Image' : ''))
    : 'No messages yet';
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
  if (privateMessageHasAutoRecoveryPending(message)) {
    if (/not sent|failed|blocked|retrying send|checking rpc/i.test(text)) {
      return message?.publishState ? publishStateMeta(message.publishState) : 'sending';
    }
  }
  if (/chain #\d+/i.test(text)) return text.includes('parts') ? 'received parts' : 'received';
  if (/local capsule/i.test(text)) return 'sending';
  return text;
}

function messageStatusKey(message) {
  const text = messageMetaText(message).toLowerCase();
  if (
    text.includes('sending')
    || text.includes('submitted')
    || text.includes('confirming')
    || text.includes('retrying')
    || text.includes('waiting for chain confirmation')
  ) return 'sending';
  if (
    text.includes('failed')
    || text.includes('blocked')
    || text.includes('not sent')
    || text.includes('not confirmed')
    || text.includes('cancel required')
  ) return 'failed';
  if (text.includes('published') || text.includes('sent')) return 'sent';
  if (text.includes('received')) return 'received';
  return 'info';
}

function isAnonymousPeerThread(thread) {
  return Boolean(
    thread
      && String(thread.id ?? '').startsWith('peer:')
      && !thread.localLabel
      && !primaryThreadIdentity(thread),
  );
}

function isPendingIdentityResolutionThread(thread) {
  return isAnonymousPeerThread(thread) && thread.pendingIdentityResolution === true;
}

function pruneEmptyAnonymousPeerThreads() {
  let changed = false;
  for (let index = threads.length - 1; index >= 0; index -= 1) {
    const thread = threads[index];
    if (!isAnonymousPeerThread(thread) || (thread.messages ?? []).length > 0) continue;
    threads.splice(index, 1);
    changed = true;
    if (activeThreadId === thread.id) activeThreadId = threads[0]?.id ?? null;
  }
  return changed;
}

function relocateExistingCapsuleMessage(existing, targetThread) {
  if (!existing?.thread || !existing?.message || !targetThread || existing.thread === targetThread) return false;
  const hadUnread = threadUnreadCount(existing.thread) > 0 && existing.message.type !== 'out';
  existing.thread.messages = (existing.thread.messages ?? []).filter((message) => message !== existing.message);
  if (hadUnread) existing.thread.unreadCount = Math.max(0, threadUnreadCount(existing.thread) - 1);
  if (!(targetThread.messages ?? []).includes(existing.message)) {
    insertThreadMessage(targetThread, existing.message);
    if (hadUnread) targetThread.unreadCount = threadUnreadCount(targetThread) + 1;
  }
  refreshThreadAfterMessageChange(existing.thread);
  refreshThreadAfterMessageChange(targetThread);
  pruneEmptyAnonymousPeerThreads();
  return true;
}

async function appendOpenedCapsuleMessage(opened, targetThread, meta, entry) {
  if (!targetThread) throw new Error('Private chain message target thread could not be resolved');
  const message = messageFromOpenedCapsule(opened, meta, entry);
  const existing = findMessageByCapsuleId(opened.capsule?.id);
  if (existing) return upsertOpenedPrivateMessage(existing, targetThread, message);
  insertThreadMessage(targetThread, message);
  refreshThreadAfterMessageChange(targetThread);
  if (message.type !== 'out') markIncomingThreadMessage(targetThread);
  await persistMessageToEncryptedHistory(targetThread, message);
  hydrateThreadAvatarFromPointer(
    targetThread,
    ownerWalletFromThread(targetThread),
    avatarPointerFromPrivateHeader(opened.capsule?.header0),
  ).catch((error) => console.error(error));
  return true;
}

async function appendOpenedPrivatePartsMessage(parts, targetThread, meta) {
  if (!targetThread) throw new Error('Private chain multipart target thread could not be resolved');
  const message = messageFromOpenedPrivateParts(parts, meta);
  const existing = parts.map((part) => findMessageByCapsuleId(part.opened?.capsule?.id)).find(Boolean);
  if (existing) return upsertOpenedPrivateMessage(existing, targetThread, message);
  insertThreadMessage(targetThread, message);
  refreshThreadAfterMessageChange(targetThread);
  if (message.type !== 'out') markIncomingThreadMessage(targetThread);
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

function isPrivateOpenKeyMismatchError(error) {
  return /recipient|decrypt|key mismatch|expired|operation-specific|unavailable/i.test(String(error?.message ?? error ?? ''));
}

function isPrivateUnreadableCapsuleError(error) {
  if (isPrivateOpenKeyMismatchError(error)) return true;
  const message = String(error?.message ?? error ?? '');
  return /private capsule|platho private capsule|capsulehub private entry|compact body|header0|header1|sender signature|magic mismatch|body size mismatch|suite mismatch|hash mismatch|invalid platho private capsule/i.test(message);
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
    indexLimitReachedWithoutCursor: fields.indexLimitReachedWithoutCursor === true,
    indexReadFallback: fields.indexReadFallback ?? null,
    historyUnavailableCount: Number(fields.historyUnavailableCount ?? 0),
    historyUnavailableEntries: Array.isArray(fields.historyUnavailableEntries) ? fields.historyUnavailableEntries : [],
    rateLimited: fields.rateLimited === true,
    rpcDelayed: fields.rpcDelayed === true,
    unchanged: fields.unchanged === true,
  };
}

function privateIndexLinkValue(value) {
  try {
    const link = BigInt(value ?? 0n);
    return link > 0n ? link : 0n;
  } catch {
    return 0n;
  }
}

function privateIndexLatestLink(index) {
  return privateIndexLinkValue(index?.latest_entry_link ?? 0n);
}

function privateIndexPreviousLink(entry, role) {
  return privateIndexLinkValue(
    role === 'sender'
      ? entry?.sender_prev_link
      : entry?.recipient_prev_link,
  );
}

function privateIndexEntryIdFromLink(link) {
  const normalized = privateIndexLinkValue(link);
  return normalized > 0n ? normalized - 1n : null;
}

function privateIndexCursorDebug(cursor) {
  const normalized = normalizePrivateChainIndexCursor(cursor);
  return {
    processedHeadLink: normalized.processedHeadLink.toString(),
    targetHeadLink: normalized.targetHeadLink.toString(),
    resumeLink: normalized.resumeLink.toString(),
  };
}

function privateIndexSyncReadLimit(options = {}) {
  const configured = Number(
    options.readLimit
      ?? appConfig.capsuleHub?.privateIndexReadLimit
      ?? (options.mode === 'auto' || options.fast === true
        ? PRIVATE_CHAIN_AUTO_INDEX_READ_LIMIT
        : PRIVATE_CHAIN_INDEX_READ_LIMIT),
  );
  return Number.isFinite(configured)
    ? Math.max(1, Math.floor(configured))
    : PRIVATE_CHAIN_INDEX_READ_LIMIT;
}

function privateIndexCursorPersistenceMode(readOptions = {}) {
  if (readOptions.verify === true && readOptions.allowUnverifiedCriticalRead !== true) return 'verified';
  return 'disabled_unverified';
}

function privateSyncImported(result) {
  if (typeof result === 'boolean') return result;
  return Number(result?.imported ?? 0) > 0;
}

function privateSyncStatusText(result) {
  if (typeof result === 'boolean') return result ? 'new messages' : 'up to date';
  if (!result) return 'up to date';
  if (result.rateLimited || result.rpcDelayed) return 'sync delayed';
  if (Number(result.historyUnavailableCount ?? 0) > 0) {
    return result.imported > 0 ? 'new messages, history gaps' : `history gaps ${result.historyUnavailableCount}`;
  }
  if (result.reason === 'body_history_unavailable') {
    return result.blockedEntryId ? `history unavailable #${result.blockedEntryId}` : 'history unavailable';
  }
  if (result.reason === 'private_key_open_failed') {
    return result.blockedEntryId ? `message key mismatch #${result.blockedEntryId}` : 'message key mismatch';
  }
  if (result.reason === 'private_index_unavailable') {
    return 'message index unavailable';
  }
  if (result.reason === 'private_index_read_failed') {
    return 'sync delayed';
  }
  if (result.reason === 'partial_stream_pending') {
    return 'message parts pending';
  }
  if (result.reason === 'index_limit_without_cursor') {
    return result.imported > 0 ? 'new messages, index scan limited' : 'index scan limited';
  }
  if (result.reason === 'catch_up_pending') {
    return result.imported > 0 ? 'new messages, catch-up pending' : `catch-up ${result.catchUpRemaining ?? 0} left`;
  }
  if (result.ok === false || result.scanComplete === false) return 'sync incomplete';
  return result.imported > 0 ? 'new messages' : 'up to date';
}

async function syncPrivateCapsulesFromChain(options = {}) {
  if (!localRecipientKeyPair) return privateSyncResult({ ok: false, reason: 'not_ready', scanComplete: false });
  const resolved = await resolveCapsuleHubProvider();
  if (!resolved) return privateSyncResult({ ok: false, reason: 'provider_unavailable', scanComplete: false });
  const { provider, address } = resolved;
  if (!provider?.getPrivateRecipientIndex || !provider?.getPrivateSenderIndex || !provider?.getPrivateEntry) {
    const result = privateSyncResult({ ok: false, reason: 'private_index_unavailable', scanComplete: false });
    globalThis.plathoLastPrivateSync = {
      capsuleHub: address,
      keyId: localRecipientKeyPair?.keyId ?? null,
      imported: 0,
      skipped: 0,
      scanComplete: false,
      reason: result.reason,
      mode: options.mode === 'auto' || options.fast === true ? 'auto' : 'recovery',
      scanLog: ['index-unavailable'],
    };
    refreshPrivateDebugLog();
    return result;
  }
  const quickSync = options.mode === 'auto' || options.fast === true;
  let allowUnverifiedPrivateIndexRead = options.allowUnverifiedPrivateIndexRead === true;
  const allowUnverifiedPrivateIndexFallback = quickSync && options.allowUnverifiedPrivateIndexRead !== false;
  let readOptions = allowUnverifiedPrivateIndexRead
    ? capsuleHubMessageSyncReadOptions(address)
    : criticalCapsuleHubReadOptions(address);
  const forceIndexRescan = options.forceIndexRescan === true;
  const keyIdIndex = privateKeyIdIndexValue(localRecipientKeyPair.keyId);
  let recipientIndex = null;
  let senderIndex = null;
  let indexReadFallback = null;
  const readPrivateIndexes = async () => Promise.all([
    provider.getPrivateRecipientIndex(keyIdIndex, readOptions),
    provider.getPrivateSenderIndex(keyIdIndex, readOptions),
  ]);
  const privateIndexReadFailure = (error) => {
    const rateLimited = noteTonRpcRateLimit(error);
    const rpcDelayed = !rateLimited && isTonRpcTransientError(error);
    const result = privateSyncResult({
      ok: false,
      reason: 'private_index_read_failed',
      scanComplete: false,
      rateLimited,
      rpcDelayed,
    });
    const indexReadError = shortUiErrorText(error, 'private index read failed');
    globalThis.plathoLastPrivateSync = {
      capsuleHub: address,
      keyId: localRecipientKeyPair?.keyId ?? null,
      indexKeyId: keyIdIndex.toString(),
      imported: 0,
      skipped: 0,
      scanComplete: false,
      pageComplete: false,
      reason: result.reason,
      mode: quickSync ? 'auto' : 'recovery',
      indexReadError,
      indexReadFallback,
      rateLimited,
      rpcDelayed,
      scanLog: ['index-read-error'],
    };
    refreshPrivateDebugLog();
    if (rpcDelayed) return result;
    throw error;
  };
  try {
    [recipientIndex, senderIndex] = await readPrivateIndexes();
  } catch (error) {
    if (!allowUnverifiedPrivateIndexRead && allowUnverifiedPrivateIndexFallback && isTonRpcVerificationSoftReadError(error)) {
      indexReadFallback = shortUiErrorText(error, 'verified private index unavailable');
      allowUnverifiedPrivateIndexRead = true;
      readOptions = capsuleHubMessageSyncReadOptions(address);
      try {
        [recipientIndex, senderIndex] = await readPrivateIndexes();
      } catch (fallbackError) {
        return privateIndexReadFailure(fallbackError);
      }
    } else {
      return privateIndexReadFailure(error);
    }
  }
  // Cursor persistence is a local performance cache, but advancing it can hide
  // older index entries. It only moves after a verified indexed walk; unverified
  // fallback may import self-authenticated entries but leaves the active cursor
  // untouched.
  const cursorPersistence = privateIndexCursorPersistenceMode(readOptions);
  const canPersistPrivateIndexCursor = cursorPersistence !== 'disabled_unverified';
  const recipientHead = privateIndexLatestLink(recipientIndex);
  const senderHead = privateIndexLatestLink(senderIndex);
  const retryEntryIds = privateBodyHistoryRetryEntryIds(address, {
    forceHistoryRetry: options.forceHistoryRetry === true,
  });
  const baseLimit = privateIndexSyncReadLimit(options);
  const limit = !canPersistPrivateIndexCursor && quickSync
    ? Math.max(baseLimit, PRIVATE_CHAIN_INDEX_READ_LIMIT)
    : baseLimit;
  let imported = 0;
  let skipped = 0;
  let scanComplete = true;
  let rateLimitError = null;
  let bodyHistoryError = null;
  let privateKeyOpenError = null;
  let blockedEntryId = null;
  const historyUnavailableEntries = [];
  let incompletePrivateStreamCount = 0;
  const privatePartGroups = new Map();
  const scannedPrivateEntryIds = new Set();
  const privateEntryCache = new Map();
  const cursorWrites = [];
  const headRepairWrites = [];
  const scanLog = [];
  const rememberPrivateScanLog = (entryId, status) => {
    const item = `${entryId.toString()}:${String(status ?? 'seen')}`;
    scanLog.push(item);
    if (scanLog.length > 14) scanLog.shift();
  };
  const readPrivateEntryCached = async (entryId) => {
    const entryIdKey = entryId.toString();
    if (privateEntryCache.has(entryIdKey)) return privateEntryCache.get(entryIdKey);
    const entry = await provider.getPrivateEntry(entryId, readOptions);
    privateEntryCache.set(entryIdKey, entry);
    return entry;
  };
  const scanPrivateEntryId = async (entryId, { source = 'index' } = {}) => {
    const entryIdKey = entryId.toString();
    if (scannedPrivateEntryIds.has(entryIdKey)) return { ok: true, entry: privateEntryCache.get(entryIdKey) ?? null };
    let entry = null;
    try {
      entry = await readPrivateEntryCached(entryId);
      if (entry.exists !== true) {
        scannedPrivateEntryIds.add(entryIdKey);
        rememberPrivateScanLog(entryId, 'empty');
        clearPrivateBodyHistoryUnavailable(address, entryId);
        return { ok: true, entry };
      }
      entry = await resolvePrivateEntryBody(provider, entry, address, readOptions);
      privateEntryCache.set(entryIdKey, entry);
      scannedPrivateEntryIds.add(entryIdKey);
      privateScanUnknownErrorCounts.delete(`${address}:${entryIdKey}`);
      clearPrivateBodyHistoryUnavailable(address, entryId);
      const opened = await openPrivateCapsuleChainEntry(entry, localRecipientKeyPair, {
        now: Date.now(),
      });
      const targetThread = await threadForChainCapsule(opened, entry);
      const partCount = Number(opened.payload?.partCount ?? 1);
      if (partCount > 1) {
        const key = privatePartKey(opened, entry);
        const existing = privatePartGroups.get(key) ?? {
          targetThread,
          parts: [],
          partCount,
          maxCreatedAtMs: 0,
          hasIndexedPart: false,
        };
        if (isPendingIdentityResolutionThread(existing.targetThread) && !isPendingIdentityResolutionThread(targetThread)) {
          existing.targetThread = targetThread;
        }
        existing.parts.push({ opened, entry, entryId, targetThread });
        existing.partCount = Math.max(existing.partCount, partCount);
        existing.hasIndexedPart = existing.hasIndexedPart || source !== 'history-retry';
        existing.maxCreatedAtMs = Math.max(existing.maxCreatedAtMs, privateEntryCreatedAtMs(entry) ?? 0);
        privatePartGroups.set(key, existing);
      } else {
        const added = await appendOpenedCapsuleMessage(
          opened,
          targetThread,
          privateChainMessageMeta({ ...entry, openedAs: opened.openedAs }),
          entry,
        );
        if (added) imported += 1;
      }
      rememberPrivateScanLog(entryId, `open-${opened.openedAs ?? 'ok'}`);
      return { ok: true, entry };
    } catch (error) {
      const message = String(error?.message ?? error);
      if (noteTonRpcRateLimit(error)) {
        rateLimitError = error;
        scanComplete = false;
        return { ok: false, entry };
      } else if (isBodyHistoryUnavailableError(error)) {
        scannedPrivateEntryIds.add(entryIdKey);
        rememberPrivateScanLog(entryId, 'body-gap');
        bodyHistoryError = error;
        blockedEntryId = entryId;
        historyUnavailableEntries.push({
          entryId: entryId.toString(),
          bodyHash: entryBodyHashHex(entry),
        });
        rememberPrivateBodyHistoryUnavailable(address, entry, entryId);
        skipped += 1;
        return { ok: true, entry };
      } else if (isPrivateUnreadableCapsuleError(error)) {
        scannedPrivateEntryIds.add(entryIdKey);
        clearPrivateBodyHistoryUnavailable(address, entryId);
        privateKeyOpenError = error;
        blockedEntryId = entryId;
        rememberPrivateScanLog(entryId, 'unreadable');
        skipped += 1;
        globalThis.plathoLastPrivateSyncKeyOpenError = {
          entryId: entryId.toString(),
          localKeyId: localRecipientKeyPair?.keyId ?? null,
          type: 'unreadable_capsule',
          message,
          at: new Date().toISOString(),
        };
        return { ok: true, entry };
      } else {
        const failureKey = `${address}:${entryIdKey}`;
        const failures = (privateScanUnknownErrorCounts.get(failureKey) ?? 0) + 1;
        privateScanUnknownErrorCounts.set(failureKey, failures);
        if (failures >= PRIVATE_SCAN_UNKNOWN_ERROR_SKIP_AFTER) {
          // This entry has failed identically across multiple passes; it must
          // not pin the cursor into a permanent resync loop. Skip it for the
          // session and keep the diagnostic reachable from the debug surface.
          scannedPrivateEntryIds.add(entryIdKey);
          rememberPrivateScanLog(entryId, 'error-skip');
          globalThis.plathoLastPrivateSyncBlockedEntry = {
            entryId: entryIdKey,
            message,
            failures,
            at: new Date().toISOString(),
          };
          skipped += 1;
          return { ok: true, entry };
        }
        rememberPrivateScanLog(entryId, 'error');
        console.error(error);
        scanComplete = false;
        return { ok: false, entry };
      }
    }
  };

  let indexEntriesScanned = 0;
  let headRepairScanned = 0;
  let historyRetryScanned = 0;
  let catchUpRemaining = 0;
  let indexLimitReachedWithoutCursor = false;
  const walkIndexedRole = async (role, latestHeadLink) => {
    const cursor = forceIndexRescan
      ? normalizePrivateChainIndexCursor(null)
      : readPrivateChainIndexCursor(address, role);
    const hasResume = cursor.resumeLink > 0n;
    const targetHeadLink = hasResume ? cursor.targetHeadLink : latestHeadLink;
    const stopLink = cursor.processedHeadLink;
    let currentLink = hasResume ? cursor.resumeLink : latestHeadLink;
    if (latestHeadLink === 0n) {
      if (cursor.processedHeadLink !== 0n || cursor.targetHeadLink !== 0n || cursor.resumeLink !== 0n) {
        cursorWrites.push({ role, cursor: normalizePrivateChainIndexCursor(null) });
      }
      return;
    }
    if (!hasResume && latestHeadLink === stopLink) return;
    let scannedForRole = 0;
    let nextLink = currentLink;
    while (currentLink > 0n && currentLink !== stopLink && scannedForRole < limit) {
      const entryId = privateIndexEntryIdFromLink(currentLink);
      if (entryId === null) {
        nextLink = 0n;
        break;
      }
      const result = await scanPrivateEntryId(entryId, { source: role });
      if (!result.ok) {
        scanComplete = false;
        return;
      }
      indexEntriesScanned += 1;
      scannedForRole += 1;
      const previousLink = privateIndexPreviousLink(result.entry, role);
      nextLink = previousLink;
      if (previousLink === currentLink) {
        scanComplete = false;
        return;
      }
      currentLink = previousLink;
    }
    if (currentLink > 0n && currentLink !== stopLink) {
      if (canPersistPrivateIndexCursor) {
        catchUpRemaining += 1;
        cursorWrites.push({
          role,
          cursor: {
            processedHeadLink: stopLink,
            targetHeadLink,
            resumeLink: nextLink,
          },
        });
      } else {
        indexLimitReachedWithoutCursor = true;
      }
      return;
    }
    cursorWrites.push({
      role,
      cursor: {
        processedHeadLink: targetHeadLink,
        targetHeadLink: 0n,
        resumeLink: 0n,
      },
    });
  };

  const walkRecentIndexedRoleForRepair = async (role, latestHeadLink) => {
    const latestLink = privateIndexLinkValue(latestHeadLink);
    if (latestLink === 0n) return;
    if (readPrivateChainHeadRepairLink(address, role) === latestLink) return;
    let currentLink = latestLink;
    let scannedForRole = 0;
    while (currentLink > 0n && scannedForRole < PRIVATE_CHAIN_HEAD_REPAIR_SCAN_LIMIT) {
      const entryId = privateIndexEntryIdFromLink(currentLink);
      if (entryId === null) break;
      const result = await scanPrivateEntryId(entryId, { source: `${role}-head-repair` });
      if (!result.ok) {
        scanComplete = false;
        return;
      }
      headRepairScanned += 1;
      scannedForRole += 1;
      const previousLink = privateIndexPreviousLink(result.entry, role);
      if (previousLink === currentLink) {
        scanComplete = false;
        return;
      }
      currentLink = previousLink;
    }
    headRepairWrites.push({ role, link: latestLink });
  };

  for (const entryId of retryEntryIds) {
    const result = await scanPrivateEntryId(entryId, { source: 'history-retry' });
    historyRetryScanned += 1;
    if (!result.ok) break;
  }
  if (!rateLimitError && scanComplete) {
    await walkIndexedRole('recipient', recipientHead);
  }
  if (!rateLimitError && scanComplete) {
    await walkIndexedRole('sender', senderHead);
  }
  if (!rateLimitError && scanComplete) {
    await walkRecentIndexedRoleForRepair('recipient', recipientHead);
  }
  if (!rateLimitError && scanComplete) {
    await walkRecentIndexedRoleForRepair('sender', senderHead);
  }

  const incompletePrivatePartGroups = [...privatePartGroups.values()].filter((group) => {
    const uniqueParts = new Set();
    for (const part of group.parts) {
      uniqueParts.add(Number(part.opened?.payload?.partIndex ?? 0));
    }
    if (uniqueParts.size === group.partCount) return false;
    return group.hasIndexedPart === true;
  });

  for (const group of privatePartGroups.values()) {
    const uniqueParts = new Map();
    for (const part of group.parts) {
      uniqueParts.set(Number(part.opened?.payload?.partIndex ?? 0), part);
    }
    if (uniqueParts.size !== group.partCount) {
      if (bodyHistoryError) {
        for (const part of uniqueParts.values()) {
          rememberPrivateBodyHistoryUnavailable(address, part.entry, part.entryId);
        }
        continue;
      }
      const ageMs = group.maxCreatedAtMs > 0 ? Date.now() - group.maxCreatedAtMs : Number.POSITIVE_INFINITY;
      if (ageMs <= PRIVATE_PENDING_PUBLISH_STALE_AFTER_MS) {
        scanComplete = false;
      }
      incompletePrivateStreamCount += 1;
      skipped += uniqueParts.size;
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
    try {
      const added = await appendOpenedPrivatePartsMessage(
        ordered,
        group.targetThread,
        privateChainMessageMeta({ ...firstEntry, openedAs: firstOpened?.openedAs }, ordered.length),
      );
      pruneEmptyAnonymousPeerThreads();
      if (added) imported += 1;
    } catch (error) {
      skipped += ordered.length;
      globalThis.plathoLastPrivateSyncGroupError = {
        message: String(error?.message ?? error ?? 'private multipart blocked'),
        entryId: privateEntryIdText(firstEntry),
        partCount: ordered.length,
        at: new Date().toISOString(),
      };
      console.error(error);
    }
  }
  const publishConfirmations = await confirmPendingPrivatePublishMessagesFromEntries(
    [...privateEntryCache.values()],
    'private_sync_index',
  );
  const hasFreshPartial = incompletePrivatePartGroups.some((group) => {
    const ageMs = group.maxCreatedAtMs > 0 ? Date.now() - group.maxCreatedAtMs : Number.POSITIVE_INFINITY;
    return ageMs <= PRIVATE_PENDING_PUBLISH_STALE_AFTER_MS;
  });
  if (canPersistPrivateIndexCursor && !rateLimitError && scanComplete && !hasFreshPartial && bodyHistoryError === null) {
    for (const write of cursorWrites) writePrivateChainIndexCursor(address, write.role, write.cursor);
    for (const write of headRepairWrites) writePrivateChainHeadRepairLink(address, write.role, write.link);
  } else if (canPersistPrivateIndexCursor && !rateLimitError && !hasFreshPartial && catchUpRemaining > 0 && bodyHistoryError === null) {
    for (const write of cursorWrites) writePrivateChainIndexCursor(address, write.role, write.cursor);
    for (const write of headRepairWrites) writePrivateChainHeadRepairLink(address, write.role, write.link);
  }
  const reason = bodyHistoryError
    ? 'body_history_unavailable'
    : privateKeyOpenError
      ? 'private_key_open_failed'
      : hasFreshPartial
        ? 'partial_stream_pending'
        : indexLimitReachedWithoutCursor
          ? 'index_limit_without_cursor'
          : (catchUpRemaining > 0 ? 'catch_up_pending' : null);
  const fullScanComplete = scanComplete
    && catchUpRemaining === 0
    && !hasFreshPartial
    && !indexLimitReachedWithoutCursor;
  const recipientCursor = readPrivateChainIndexCursor(address, 'recipient');
  const senderCursor = readPrivateChainIndexCursor(address, 'sender');
  globalThis.plathoLastPrivateSync = {
    capsuleHub: address,
    keyId: localRecipientKeyPair?.keyId ?? null,
    indexKeyId: keyIdIndex.toString(),
    recipientHead: recipientHead.toString(),
    senderHead: senderHead.toString(),
    recipientCursor: privateIndexCursorDebug(recipientCursor),
    senderCursor: privateIndexCursorDebug(senderCursor),
    cursorPersistence,
    imported,
    skipped,
    scanComplete: fullScanComplete,
    pageComplete: scanComplete,
    indexEntriesScanned,
    headRepairScanned,
    historyRetryScanned,
    publishConfirmations,
    readLimit: limit,
    forceIndexRescan,
    indexReadFallback,
    rateLimited: rateLimitError !== null,
    bodyHistoryUnavailable: bodyHistoryError !== null,
    privateKeyOpenFailed: privateKeyOpenError !== null,
    blockedEntryId: blockedEntryId?.toString?.() ?? null,
    historyUnavailableCount: historyUnavailableEntries.length,
    historyUnavailableEntries,
    incompletePrivateStreamCount,
    catchUpRemaining,
    indexLimitReachedWithoutCursor,
    reason,
    mode: quickSync ? 'auto' : 'recovery',
    scanLog,
  };
  const result = privateSyncResult({
    imported,
    skipped,
    scanComplete: fullScanComplete,
    reason,
    blockedEntryId: blockedEntryId?.toString?.() ?? null,
    historyUnavailableCount: historyUnavailableEntries.length,
    historyUnavailableEntries,
    catchUpRemaining,
    indexLimitReachedWithoutCursor,
    indexReadFallback,
    rateLimited: rateLimitError !== null,
    ok: rateLimitError === null,
  });
  if (imported > 0) {
    refreshMessagingControls();
    renderThreads();
    renderConversation();
    refreshPrivateDebugLog();
    resumePendingPrivatePublishConfirmations();
    resumePendingPrivateSendRetries();
    return result;
  }
  if (!scanComplete) {
    refreshMessagingControls();
    refreshPrivateDebugLog();
    resumePendingPrivateSendRetries();
    if (rateLimitError) throw rateLimitError;
    return result;
  }
  refreshMessagingControls();
  refreshPrivateDebugLog();
  resumePendingPrivatePublishConfirmations();
  resumePendingPrivateSendRetries();
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

function privateOutboundWorkActive() {
  return privateOutboundWorkDepth > 0;
}

function beginPrivateOutboundWork() {
  privateOutboundWorkDepth += 1;
  return () => {
    privateOutboundWorkDepth = Math.max(0, privateOutboundWorkDepth - 1);
    if (privateOutboundWorkDepth === 0 && isChatsViewActive() && !messageAutoSyncTimer) {
      scheduleMessageAutoSync(PRIVATE_OUTBOUND_SYNC_PAUSE_MS);
    }
  };
}

async function enterVaultPublishSendLock() {
  vaultPublishSendWaiters += 1;
  const previous = vaultPublishSendLock;
  let releaseLock = () => {};
  vaultPublishSendLock = new Promise((resolve) => {
    releaseLock = resolve;
  });
  await previous.catch(() => {});
  vaultPublishSendWaiters = Math.max(0, vaultPublishSendWaiters - 1);
  let released = false;
  return {
    hasWaiters: () => vaultPublishSendWaiters > 0,
    release() {
      if (released) return;
      released = true;
      releaseLock();
    },
  };
}

async function awaitVaultPublishNonceBarrier() {
  while (pendingVaultPublishNonceBarrier) {
    const barrier = pendingVaultPublishNonceBarrier;
    await barrier.catch(() => {});
    if (pendingVaultPublishNonceBarrier === barrier) pendingVaultPublishNonceBarrier = null;
  }
}

function installVaultPublishNonceBarrier(task) {
  const barrier = Promise.resolve(task).catch(() => {});
  pendingVaultPublishNonceBarrier = barrier;
  barrier.then(() => {
    if (pendingVaultPublishNonceBarrier === barrier) pendingVaultPublishNonceBarrier = null;
  });
  return barrier;
}

function vaultPublishNonceFloor(owner) {
  const key = rawWalletAddress(owner) ?? String(owner ?? '');
  return vaultPublishNonceFloorByOwner.get(key) ?? 0n;
}

function raiseVaultPublishNonceFloor(owner, nonce) {
  if (nonce === null || nonce === undefined) return;
  const key = rawWalletAddress(owner) ?? String(owner ?? '');
  const current = vaultPublishNonceFloorByOwner.get(key) ?? 0n;
  if (nonce > current) vaultPublishNonceFloorByOwner.set(key, nonce);
}

function scheduleMessageAutoSync(delayMs = MESSAGE_AUTO_SYNC_MS) {
  clearMessageAutoSyncTimer();
  if (!isChatsViewActive() || !plathoWallet || !localRecipientKeyPair || document.hidden) return;
  const transport = globalThis.plathoTonRpcTransport;
  const degradedTransport = typeof transport?.isDegraded === 'function' && transport.isDegraded();
  const requestedDelayMs = Math.max(1_000, Number(delayMs) || MESSAGE_AUTO_SYNC_MS);
  const effectiveDelayMs = degradedTransport ? Math.max(requestedDelayMs, MESSAGE_AUTO_SYNC_DEGRADED_MS) : requestedDelayMs;
  messageAutoSyncPhase = messageAutoSyncLastErrorLabel ? 'delayed' : (messageAutoSyncLastResult ? 'synced' : 'scheduled');
  messageAutoSyncAt = Date.now() + effectiveDelayMs;
  scheduleMessageAutoSyncCountdownUi();
  messageAutoSyncTimer = window.setTimeout(async () => {
    messageAutoSyncTimer = null;
    messageAutoSyncAt = 0;
    let nextSyncDelayMs = MESSAGE_AUTO_SYNC_MS;
    if (privateOutboundWorkActive()) {
      scheduleMessageAutoSync(PRIVATE_OUTBOUND_SYNC_PAUSE_MS);
      return;
    }
    beginMessageSyncUi();
    try {
      const result = await syncPrivateCapsulesFromChainOnce({ mode: 'auto' });
      completeMessageSyncUi(result);
      if ((result?.scanComplete === false && result?.reason !== 'index_limit_without_cursor') || result?.reason === 'catch_up_pending') {
        // Fast follow-up only while the catch-up actually makes progress;
        // a stalled walk (same state every pass) backs off exponentially so
        // it cannot melt the RPC budget with a 2-second resync loop.
        const progressed = privateSyncImported(result) || Number(result?.skipped ?? 0) > 0;
        messageAutoSyncStallStreak = progressed ? 0 : messageAutoSyncStallStreak + 1;
        nextSyncDelayMs = Math.min(2_000 * 2 ** Math.min(messageAutoSyncStallStreak, 5), MESSAGE_AUTO_SYNC_MS);
      } else {
        messageAutoSyncStallStreak = 0;
      }
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
      if (rateLimited) nextSyncDelayMs = tonRpcLimitBackoffMs(error);
    } finally {
      scheduleMessageAutoSync(nextSyncDelayMs);
    }
  }, effectiveDelayMs);
}

async function bootReplayStore() {
  if (!plathoWallet?.address) {
    localReplayStore = createMemoryReplayStore();
    setText(replayStoreStatus, hasStoredPlathoWalletRecord() ? 'unlock required' : 'memory');
    return;
  }
  try {
    localReplayStore = await createIndexedDbReplayStore({ dbName: currentReplayDbName() });
    setText(replayStoreStatus, 'device db');
  } catch {
    localReplayStore = createMemoryReplayStore();
    setText(replayStoreStatus, 'memory');
  }
}

function historyStatusLabel() {
  if (!encryptedMessageStore) return 'history off';
  const limit = encryptedMessageStore.maxRecords ? `last ${encryptedMessageStore.maxRecords}` : 'local';
  return encryptedMessageStore.persistent === false
    ? `device-encrypted memory cache (${limit})`
    : `device-encrypted local cache (${limit})`;
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
    payment: paymentForHistory(message.payment),
    paymentDraft: paymentDraftForHistory(message.paymentDraft),
    paymentCheckLedgerId: message.paymentCheckLedgerId ?? null,
    blocks: messageBlocksForHistory(message),
    capsule: message.capsule ?? null,
    capsules: message.capsules ?? null,
    publishState: message.publishState ?? null,
    recipientWallet: message.recipientWallet ?? null,
    vaultCreateIntent: safeJsonClone(message.vaultCreateIntent) ?? null,
    vaultPublish: safeJsonClone(message.vaultPublish) ?? null,
    vaultCancelIntent: safeJsonClone(message.vaultCancelIntent) ?? null,
    privateSendRetryAttempt: Number(message.privateSendRetryAttempt ?? 0) || 0,
    privateSendRetryStopped: message.privateSendRetryStopped === true,
    privateSendRetryStoppedAt: message.privateSendRetryStoppedAt ?? null,
    privatePublishConfirmAttempt: Number(message.privatePublishConfirmAttempt ?? 0) || 0,
    privatePublishConfirmStopped: message.privatePublishConfirmStopped === true,
    privatePublishConfirmStoppedAt: message.privatePublishConfirmStoppedAt ?? null,
    attachment: message.attachment ?? null,
    profileVersion: message.profileVersion ?? 0,
    avatarHash: message.avatarHash ?? zeroAvatarHashHex(),
  };
}

function safeJsonClone(value) {
  try {
    return JSON.parse(JSON.stringify(value, (_key, item) => (
      typeof item === 'bigint' ? item.toString() : item
    )));
  } catch {
    return null;
  }
}

function safeDiagnosticsJson(value) {
  return JSON.stringify(value ?? null, (_key, item) => (
    typeof item === 'bigint' ? item.toString() : item
  ), 2);
}

globalThis.plathoProfileAvatarPublishDiagnosticsJson = () => safeDiagnosticsJson(
  globalThis.plathoLastProfileAvatarPublishDiagnostics,
);

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
    const result = encryptedMessageStore.listMessagesDetailed
      ? await encryptedMessageStore.listMessagesDetailed()
      : { messages: await encryptedMessageStore.listMessages(), failed: [] };
    const restored = result.messages ?? [];
    const failed = result.failed ?? [];
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
    globalThis.plathoLastEncryptedHistoryRestore = {
      restored: restored.length,
      failed: failed.length,
      failedRecords: failed,
      dbName: currentMessageHistoryDbName(),
      walletAddress: plathoWallet?.address ?? null,
    };
    const restoredLabel = restored.length > 0 ? `${historyStatusLabel()} ${restored.length}` : historyStatusLabel();
    setText(localStateLabel, failed.length > 0 ? `${restoredLabel} · ${failed.length} blocked` : restoredLabel);
    if (changed) {
      renderThreads();
      renderConversation();
      resumePendingPrivatePublishConfirmations();
      resumePendingPrivateSendRetries();
    }
  } catch (error) {
    setText(localStateLabel, 'history blocked');
    console.error(error);
  }
}

function paymentCheckIntentIdText(payment) {
  try {
    return paymentIntentId(payment).toString();
  } catch {
    return String(payment?.intentId ?? payment?.intentIdHex ?? '');
  }
}

function paymentCheckPendingLedgerId(payment) {
  const hex = String(payment?.intentIdHex ?? '').replace(/^0x/i, '').toLowerCase();
  if (/^[0-9a-f]{64}$/.test(hex)) return `payment-check:${hex}`;
  return `payment-check:${paymentCheckIntentIdText(payment)}`;
}

function paymentCheckPendingLedgerStatusText(record) {
  const status = String(record?.status ?? '').toLowerCase();
  if (status.includes('cancel') && status.includes('submitted')) return 'check cancel submitted, confirming';
  if (status.includes('cancel')) return 'check cancelled';
  if (status.includes('claim') && status.includes('submitted')) return 'check claim submitted, confirming';
  if (status.includes('claim')) return 'check claimed';
  if (status.includes('publish') && status.includes('submitted')) return 'message submitted, confirming';
  if (status.includes('publish') && status.includes('failed')) return 'check not delivered, refund required';
  if (status.includes('publish') && status.includes('retry')) return 'checking RPC, retrying';
  if (status.includes('publish') && status.includes('partial')) return 'submitted, retrying';
  if (status.includes('publish')) return 'publishing message';
  if (status.includes('intent') || status.includes('create')) return 'payment check created, publishing message';
  return 'check recovery pending';
}

function isTerminalPaymentCheckLedgerRecord(record) {
  return /^(published_confirmed|claim_confirmed|claimed|cancel_confirmed|cancelled|removed)$/i.test(String(record?.status ?? ''));
}

function findPaymentCheckMessageByIntentId(intentIdText) {
  for (const thread of threads) {
    for (const message of thread.messages ?? []) {
      if (!message?.payment) continue;
      if (paymentCheckIntentIdText(message.payment) === intentIdText) return { thread, message };
    }
  }
  return null;
}

function ensurePendingPaymentCheckLedgerThread(record, payment) {
  if (record?.threadId) return ensureHistoryThread(record.threadId, record.thread, record.message);
  const recipientWallet = payment?.recipientWallet ?? record?.recipientWallet;
  if (recipientWallet) {
    const created = createRecipientThread(recipientWallet, {
      preview: 'payment check recovery',
      state: 'pending',
      time: 'local',
    });
    if (created?.ok) {
      const existing = threads.find((thread) => thread.id === created.thread.id);
      if (existing) return existing;
      threads.push(created.thread);
      return created.thread;
    }
  }
  return ensureHistoryThread(`payment-check:${record?.id ?? Date.now()}`, record?.thread, record?.message);
}

function upsertPendingPaymentCheckLedgerMessage(record) {
  if (isTerminalPaymentCheckLedgerRecord(record)) return false;
  const payment = normalizePaymentForMessage(record.payment ?? record);
  const intentIdText = paymentCheckIntentIdText(payment);
  const existing = findPaymentCheckMessageByIntentId(intentIdText);
  if (existing) {
    existing.message.paymentCheckLedgerId = record.id ?? record.ledgerId ?? existing.message.paymentCheckLedgerId;
    existing.message.vaultCreateIntent = record.vaultCreateIntent ?? existing.message.vaultCreateIntent;
    existing.message.vaultPublish = record.vaultPublish ?? existing.message.vaultPublish;
    existing.message.vaultCancelIntent = record.vaultCancelIntent ?? existing.message.vaultCancelIntent;
    if (!existing.message.meta || /recovery pending/i.test(existing.message.meta)) {
      existing.message.meta = paymentCheckPendingLedgerStatusText(record);
    }
    refreshThreadAfterMessageChange(existing.thread);
    return false;
  }
  const thread = ensurePendingPaymentCheckLedgerThread(record, payment);
  const snapshot = record.message && typeof record.message === 'object'
    ? (safeJsonClone(record.message) ?? {})
    : {};
  const message = {
    ...snapshot,
    type: snapshot.type ?? 'out',
    text: snapshot.text ?? paymentMessageText(payment),
    meta: paymentCheckPendingLedgerStatusText(record),
    payment,
    paymentDraft: null,
    paymentCheckLedgerId: record.id ?? record.ledgerId ?? paymentCheckPendingLedgerId(payment),
    recipientWallet: payment.recipientWallet ?? record.recipientWallet ?? snapshot.recipientWallet ?? null,
    vaultCreateIntent: record.vaultCreateIntent ?? snapshot.vaultCreateIntent ?? null,
    vaultPublish: record.vaultPublish ?? snapshot.vaultPublish ?? null,
    vaultCancelIntent: record.vaultCancelIntent ?? snapshot.vaultCancelIntent ?? null,
  };
  ensureMessageOrderFields(message, Number(record.createdAtMs ?? record.createdAt) || Date.now());
  insertThreadMessage(thread, message);
  refreshThreadAfterMessageChange(thread);
  return true;
}

async function restorePendingPaymentCheckLedger() {
  if (!encryptedMessageStore?.listPendingPaymentChecks) return;
  try {
    const result = await encryptedMessageStore.listPendingPaymentChecks();
    const records = result.records ?? [];
    let restored = 0;
    let skipped = 0;
    for (const record of records) {
      if (isTerminalPaymentCheckLedgerRecord(record)) {
        skipped += 1;
        continue;
      }
      if (upsertPendingPaymentCheckLedgerMessage(record)) restored += 1;
    }
    globalThis.plathoLastPaymentCheckPendingLedger = {
      restored,
      skipped,
      failed: result.failed ?? [],
      records: records.length,
      dbName: currentMessageHistoryDbName(),
      walletAddress: plathoWallet?.address ?? null,
    };
    if (restored > 0) {
      renderThreads();
      renderConversation();
    }
  } catch (error) {
    globalThis.plathoLastPaymentCheckPendingLedger = {
      error: String(error?.message ?? error ?? 'pending payment check ledger blocked'),
      dbName: currentMessageHistoryDbName(),
      walletAddress: plathoWallet?.address ?? null,
    };
    console.error(error);
  }
}

async function rememberPendingPaymentCheckLedgerRecord(thread, message, payment, fields = {}, options = {}) {
  if (!encryptedMessageStore?.putPendingPaymentCheck) return null;
  const id = paymentCheckPendingLedgerId(payment);
  if (message) message.paymentCheckLedgerId = id;
  try {
    const existing = encryptedMessageStore.getPendingPaymentCheck
      ? await encryptedMessageStore.getPendingPaymentCheck(id).catch(() => null)
      : null;
    const fieldSnapshot = safeJsonClone(fields) ?? {};
    const now = new Date().toISOString();
    const record = {
      ...(existing ?? {}),
      kind: PAYMENT_CHECK_PENDING_LEDGER_KIND,
      id,
      ledgerId: id,
      intentId: paymentCheckIntentIdText(payment),
      intentIdHex: payment.intentIdHex ?? existing?.intentIdHex ?? null,
      payment: normalizePaymentForMessage(payment),
      senderWallet: payment.senderWallet ?? existing?.senderWallet ?? null,
      recipientWallet: payment.recipientWallet ?? existing?.recipientWallet ?? null,
      threadId: thread?.id ?? existing?.threadId ?? null,
      thread: thread ? serializeThreadForHistory(thread) : existing?.thread ?? null,
      messageLocalHistoryId: message?.localHistoryId ?? existing?.messageLocalHistoryId ?? null,
      message: message ? serializeMessageForHistory(message) : existing?.message ?? null,
      publishState: message?.publishState ?? fieldSnapshot.publishState ?? existing?.publishState ?? null,
      vaultCreateIntent: message?.vaultCreateIntent ?? fieldSnapshot.vaultCreateIntent ?? existing?.vaultCreateIntent ?? null,
      vaultPublish: message?.vaultPublish ?? fieldSnapshot.vaultPublish ?? existing?.vaultPublish ?? null,
      vaultCancelIntent: message?.vaultCancelIntent ?? fieldSnapshot.vaultCancelIntent ?? existing?.vaultCancelIntent ?? null,
      createdAt: existing?.createdAt ?? messageCreatedAtMs(message) ?? Date.now(),
      updatedAt: now,
      ...fieldSnapshot,
      status: fieldSnapshot.status ?? existing?.status ?? 'prepared',
    };
    const stored = await encryptedMessageStore.putPendingPaymentCheck(record);
    return { ...record, id: stored.id, createdAt: stored.createdAt };
  } catch (error) {
    if (options.required === true) throw error;
    console.error(error);
    return null;
  }
}

async function markPendingPaymentCheckLedgerRecord(payment, fields = {}) {
  return rememberPendingPaymentCheckLedgerRecord(null, null, payment, fields);
}

async function removePendingPaymentCheckLedgerRecord(payment, options = {}) {
  if (!encryptedMessageStore?.removePendingPaymentCheck) return null;
  try {
    await encryptedMessageStore.removePendingPaymentCheck(paymentCheckPendingLedgerId(payment));
    return true;
  } catch (error) {
    if (options.required === true) throw error;
    console.error(error);
    return null;
  }
}

async function bootEncryptedMessageHistory() {
  if (!plathoWallet?.address) {
    encryptedMessageStore = null;
    setText(localStateLabel, hasStoredPlathoWalletRecord() ? 'history locked' : 'history off');
    return;
  }
  try {
    encryptedMessageStore = await createIndexedDbEncryptedMessageHistoryStore({ dbName: currentMessageHistoryDbName() });
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
  await restorePendingPaymentCheckLedger();
}

async function bootWalletScopedLocalStores() {
  await bootReplayStore();
  await bootEncryptedMessageHistory();
  if (plathoWallet?.address) activeRuntimeWalletAddress = plathoWallet.address;
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
  dismissOnBackdrop = true,
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
    dismissOnBackdrop,
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
    if (wallet) prepareWalletScopedRuntimeForWallet(wallet, 'wallet unlocked');
    plathoWallet = wallet;
    localProfileAvatarPointer = readStoredProfileAvatarPointer(wallet?.address);
    if (wallet) {
      markWalletUnlocked();
      scheduleWalletAutoLock();
      markNavVaultBalancePending('wallet loaded', {
        resetRetry: true,
        retry: true,
        retryDelayMs: 0,
      });
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
  prepareWalletScopedRuntimeForWallet(wallet, 'wallet replaced');
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
  vaultPocketState = {
    wallet: vaultPocketState.wallet ?? { ton_balance: null, ath_balance: null },
    vault: {
      ton_balance: user.exists === true ? nonNegativeBigInt(user.ton_balance) : 0n,
      ath_balance: user.exists === true ? nonNegativeBigInt(user.ath_balance) : 0n,
    },
  };
  markNavVaultBalanceReady();
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

function clearNavVaultBalanceRetryTimer() {
  if (!navVaultBalanceRetryTimer) return;
  clearTimeout(navVaultBalanceRetryTimer);
  navVaultBalanceRetryTimer = null;
}

function navVaultBalanceLoadingLabel() {
  return 'Refreshing Vault balance';
}

function markNavVaultBalanceIdle() {
  clearNavVaultBalanceRetryTimer();
  navVaultBalanceState = { status: 'idle', retryAttempt: 0, reason: null };
  refreshNavVaultBalance();
}

function markNavVaultBalanceReady() {
  clearNavVaultBalanceRetryTimer();
  navVaultBalanceState = { status: 'ready', retryAttempt: 0, reason: null };
  refreshNavVaultBalance();
}

function markNavVaultBalancePending(reason = 'refreshing', options = {}) {
  if (!plathoWallet?.address) {
    markNavVaultBalanceIdle();
    return;
  }
  if (options.resetRetry === true) {
    navVaultBalanceState.retryAttempt = 0;
  }
  navVaultBalanceState = {
    status: 'pending',
    retryAttempt: navVaultBalanceState.retryAttempt,
    reason,
  };
  refreshNavVaultBalance();
  if (options.retry === true) scheduleNavVaultBalanceRetry(options.retryDelayMs);
}

function scheduleNavVaultBalanceRetry(delayMs = null) {
  if (!plathoWallet?.address || document.hidden) return;
  if (navVaultBalanceRetryTimer) return;
  const attempt = Math.min(
    navVaultBalanceState.retryAttempt,
    VAULT_NAV_BALANCE_RETRY_DELAYS_MS.length - 1,
  );
  const effectiveDelayMs = delayMs ?? VAULT_NAV_BALANCE_RETRY_DELAYS_MS[attempt];
  navVaultBalanceRetryTimer = setTimeout(() => {
    navVaultBalanceRetryTimer = null;
    refreshVaultNavBalanceInBackground({ fromRetry: true }).catch((error) => {
      const rateLimited = noteTonRpcRateLimit(error);
      if (!rateLimited && !isExpectedVaultProviderUnavailable(error)) console.error(error);
    });
  }, Math.max(0, Number(effectiveDelayMs) || 0));
}

function markNavVaultBalanceRetryNeeded(reason = 'retrying') {
  navVaultBalanceState.retryAttempt = Math.min(
    navVaultBalanceState.retryAttempt + 1,
    VAULT_NAV_BALANCE_RETRY_DELAYS_MS.length - 1,
  );
  markNavVaultBalancePending(reason, { retry: true });
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
  if (/persistent encrypted local history/i.test(message)) return 'Local encrypted history unavailable; reload Platho before creating a check';
  if (/payment check recovery record could not be saved|payment check pending ledger could not be saved/i.test(message)) {
    return 'Payment check recovery could not be saved; reload Platho and try again';
  }
  if (/activate platho account before publishing/i.test(message)) return 'Activate Platho account before sending';
  if (/network surcharge .* exceeds the production cap/i.test(message)) return message;
  if (isTonRpcVerificationSoftReadError(error)) return 'RPC verification pending';
  if (/Vault chain provider|TON RPC|sendBoc transport|provider is not configured/i.test(message)) return message;
  return message;
}

function privateSendBlockedStatusText(error) {
  return `not sent: ${privateSendPreflightStatusText(error)}`;
}

function vaultActionBlockedStatusText(error, fallback = 'move blocked') {
  const message = shortUiErrorText(error, fallback);
  if (/unlock and activate your platho account before moving ton from vault/i.test(message)) {
    return 'Activate Platho account before moving TON from Vault';
  }
  if (/local vault auth key is not ready/i.test(message)) {
    return 'Unlock and activate Platho account before Vault actions';
  }
  return message;
}

function canEditPrivateComposerDraft(thread = activeThread()) {
  return Boolean(thread)
    && thread.readOnly !== true
    && Boolean(plathoWallet);
}

function privateSendBlockReason(thread = activeThread(), options = {}) {
  if (!thread) return 'Choose a private chat';
  if (thread.readOnly === true) return 'Read-only channel';
  if (!plathoWallet) return 'Wallet required';
  if (pendingServiceWorkerAppShellReload === true) return 'Update ready - reload app';
  if (!localIdentity || !localRecipientKeyPair || !localSignedPublicBundle) {
    return 'Unlock and activate Platho account before sending';
  }
  if (options.includeVaultShortfall !== false && privateComposerKnownVaultTonShortfall()) {
    return 'Vault TON hold required';
  }
  return null;
}

function canAttemptPrivateSend(thread = activeThread()) {
  return canEditPrivateComposerDraft(thread)
    && Boolean(localIdentity && localRecipientKeyPair && localSignedPublicBundle)
    && pendingServiceWorkerAppShellReload !== true
    && !privateComposerKnownVaultTonShortfall();
}

function isTonRpcTransientError(error) {
  const message = String(error?.message ?? error ?? '');
  return isTonRpcRateLimitError(error)
    || Number(error?.status ?? error?.response?.status ?? 0) >= 500
    || error?.code === 'TIMEOUT'
    || error?.code === 'NETWORK_ERROR'
    || error?.code === 'RPC_VERIFICATION_UNAVAILABLE'
    || error?.code === 'RPC_DISAGREEMENT'
    || /HTTP 5\d\d|timeout|network|failed to fetch|fetch failed|backoff|temporar(?:y|ily)|verification unavailable|rpc disagreement|provider unavailable|rpc busy|request aborted|bad gateway|service unavailable|gateway timeout|upstream request failed/i.test(message);
}

function isTonRpcVerificationUnavailableError(error) {
  const message = String(error?.message ?? error ?? '');
  return error?.code === 'RPC_VERIFICATION_UNAVAILABLE'
    || error?.code === 'RPC_DISAGREEMENT'
    || /RPC_VERIFICATION_UNAVAILABLE|verification unavailable|TON RPC disagreement|RPC_DISAGREEMENT/i.test(message);
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
  if (Number(error?.status ?? error?.response?.status ?? 0) >= 500) return true;
  return error?.code === 'TIMEOUT'
    || error?.code === 'NETWORK_ERROR'
    || /HTTP 5\d\d|timeout|network|failed to fetch|fetch failed|backoff|request aborted|bad gateway|service unavailable|gateway timeout|upstream request failed/i.test(message);
}

function privateSendRetryDelayMs(error = null, attempt = 0) {
  if (isTonRpcRateLimitError(error)) return tonRpcLimitBackoffMs(error);
  const index = Math.min(Math.max(0, Number(attempt) || 0), PRIVATE_SEND_RETRY_DELAYS_MS.length - 1);
  return PRIVATE_SEND_RETRY_DELAYS_MS[index];
}

function privateSendRetryMeta(error = null) {
  if (isTonRpcVerificationSoftReadError(error)) return 'checking RPC, retrying';
  return isTonRpcRateLimitError(error) ? 'retrying after RPC busy' : 'retrying send';
}

function privateSendRetryExhaustedStatusText(error = null) {
  if (error?.code === 'STALE_PRIVATE_PUBLISH') return 'not sent: retry window expired';
  if (error?.code === 'PARTIAL_PRIVATE_PUBLISH_RETRY_EXPIRED') {
    return /limit/i.test(String(error?.message ?? ''))
      ? 'not sent: partial publish retry limit reached'
      : 'not sent: partial publish retry window expired';
  }
  if (isTonRpcVerificationSoftReadError(error)) return 'not sent: RPC verification stayed unavailable';
  if (isTonRpcRateLimitError(error)) return 'not sent: RPC stayed busy';
  return 'not sent: retry limit reached';
}

function privateSendRetryMaxAttempts(error = null, message = null) {
  if (privateMessageHasPartialRetryablePublish(message)) return PRIVATE_SEND_PARTIAL_RETRY_MAX_ATTEMPTS;
  if (isTonRpcVerificationSoftReadError(error) || isTonRpcRateLimitError(error)) return PRIVATE_SEND_RPC_RETRY_MAX_ATTEMPTS;
  return PRIVATE_SEND_RETRY_MAX_ATTEMPTS;
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

function publicLocalExecReserveNanotons(sizeClass = 1) {
  const normalizedSizeClass = normalizePrivateSizeClass(sizeClass);
  const table = VAULT_PUBLISH_PUBLIC_LOCAL_EXEC_RESERVE_NANOTONS;
  return table[normalizedSizeClass] ?? table[1];
}

function publicCapsulehubChargeNanotons(sizeClass = 1) {
  const normalizedSizeClass = normalizePrivateSizeClass(sizeClass);
  const execReserve = CAPSULEHUB_PUBLIC_EXEC_RESERVE_NANOTONS[normalizedSizeClass]
    ?? CAPSULEHUB_PUBLIC_EXEC_RESERVE_NANOTONS[1];
  return execReserve + CAPSULEHUB_PUBLIC_STORAGE_CHARGE_NANOTONS;
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

function publicComposerPublishProfile(sizeClass = 1) {
  const normalizedSizeClass = normalizePrivateSizeClass(sizeClass);
  return {
    publishKind: VAULT_PUBLISH_KIND.PUBLIC,
    sizeClass: BigInt(normalizedSizeClass),
    cryptoSuite: VAULT_CRYPTO_SUITE.PUBLIC_NONE,
    priceSuite: MESSAGE_PRICE_SUITES.PUBLIC_V1,
    fixedCharge: publicLocalExecReserveNanotons(normalizedSizeClass) + publicCapsulehubChargeNanotons(normalizedSizeClass),
    protocolFee: PLATO_PUBLIC_POST_FEE_NANOTONS,
  };
}

function publicComposerPublishProfilesForPlan(plan) {
  const parts = Array.isArray(plan) && plan.length > 0 ? plan : [{ sizeClass: 1 }];
  return parts.map((part) => publicComposerPublishProfile(part.sizeClass));
}

function composerPartCount(text, maxTextBytes = SINGLE_CAPSULE_USEFUL_BYTES) {
  return messagePartCount(text ?? '', maxTextBytes);
}

function imageCompressionMode(modeId) {
  return IMAGE_COMPRESSION_MODES[modeId] ?? IMAGE_COMPRESSION_MODES[DEFAULT_IMAGE_COMPRESSION_MODE_ID];
}

function imageAttachmentPartCount(attachment) {
  if (!attachment?.bytes?.length) return 0;
  return splitBytesToCapsuleParts(attachment.bytes, MAX_CAPSULE_USEFUL_BYTES).length;
}

function privateImageAttachmentPartCount(attachment, options = currentPrivateSenderOptions()) {
  if (!attachment?.bytes?.length) return 0;
  return privateImageCapsulePartsForSend(attachment, options).length;
}

function normalizePrivateImageAttachments(attachments = privateImageAttachments) {
  if (Array.isArray(attachments)) return attachments.filter((attachment) => attachment?.bytes?.length);
  return attachments?.bytes?.length ? [attachments] : [];
}

function normalizePublicImageAttachments(attachments = publicImageAttachments) {
  return normalizePrivateImageAttachments(attachments);
}

function privateCompactPayloadOverhead(options = {}) {
  return PLATHO_COMPACT_SENDER_RECOVERY_BYTES
    + PLATHO_COMPACT_RECIPIENT_WALLET_METADATA_BYTES
    + (options.includeSenderWalletMetadata === false ? 0 : PLATHO_COMPACT_SENDER_WALLET_METADATA_BYTES)
    + privateSenderUsernameMetadataBytes(options);
}

function privateTextCapsulePartsForSend(text, options = {}) {
  return splitUtf8ToCapsuleParts(text, MAX_CAPSULE_USEFUL_BYTES, {
    perPartOverheadBytes: privateCompactPayloadOverhead(options),
  });
}

function privateImageCapsulePartsForSend(attachment, options = {}) {
  if (!attachment?.bytes?.length) return [];
  return splitBytesToCapsuleParts(attachment.bytes, MAX_CAPSULE_USEFUL_BYTES, {
    perPartOverheadBytes: privateCompactPayloadOverhead(options),
  });
}

function privateComposerRetrievalPartLimit() {
  const configuredLimit = Number(appConfig.capsuleHub?.privateIndexReadLimit ?? PRIVATE_CHAIN_INDEX_READ_LIMIT);
  return Number.isFinite(configuredLimit)
    ? Math.max(1, Math.floor(configuredLimit))
    : PRIVATE_CHAIN_INDEX_READ_LIMIT;
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

function privateSenderUsernameMetadataLabel(options = {}) {
  if (options.includeSenderWalletMetadata === false) return null;
  const explicit = normalizeLinkedPlathoUsername(options.senderUsername ?? options.sender_username);
  if (explicit) return explicit.label;
  return readLinkedPlathoUsername(plathoWallet?.address)?.label ?? null;
}

function privateSenderUsernameMetadataBytes(options = {}) {
  const label = privateSenderUsernameMetadataLabel(options);
  if (!label) return 0;
  return PLATHO_COMPACT_SENDER_USERNAME_METADATA_PREFIX_BYTES + new TextEncoder().encode(label).length;
}

function privateComposerSendPlan(text, attachments = privateImageAttachments, options = currentPrivateSenderOptions(), extras = {}) {
  const plan = [];
  const documentBytes = messageDocumentBytesFromDraft(text, attachments, extras.paymentCheck ?? privatePaymentCheckDraft, {
    allowMissingPaymentSecret: true,
  });
  if (!documentBytes) return plan;
  for (const part of splitBytesToCapsuleParts(documentBytes, MAX_CAPSULE_USEFUL_BYTES, {
    perPartOverheadBytes: privateCompactPayloadOverhead(options),
  })) {
    plan.push({ type: 'document', bytes: part.bytes, sizeClass: part.sizeClass, usefulBytes: part.usefulBytes });
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

// Map a composer publish profile to the kind label the batch hold model keys on.
function composerProfileKindLabel(profile) {
  return BigInt(profile?.publishKind ?? VAULT_PUBLISH_KIND.PRIVATE) === VAULT_PUBLISH_KIND.PUBLIC
    ? 'public'
    : 'private';
}

// VPB2 batch hold. The contract post-accept-rejects RJ_UNDERPRICED any batch whose signed max_charge is
// below canonical_total == SHARED_BASE + Σ perPartHold(kind,size). The protocol fee + per-part costs live
// INSIDE perPartHold (sandbox-measured), so we no longer add profile.fixedCharge/protocolFee here — those
// were the stale per-message model that under-quoted the batch and would strand a publish at RJ_UNDERPRICED.
// The network-fee surcharge rides on top, per part. Passing an ARRAY prices the whole batch (SHARED_BASE
// charged ONCE — amortized). Passing a single profile with `parts` prices `parts` independent SINGLE-capsule
// batches (SHARED_BASE per part): a deliberate, SAFE over-estimate for affordability, since the real grouped
// batch hold is never higher than the per-capsule sum.
function composerEstimatedMaxChargeNanotons(profile, parts = 1) {
  if (Array.isArray(profile)) {
    if (profile.length === 0) return 0n;
    const hold = batchHoldNanotons(profile.map((item) => ({
      kindLabel: composerProfileKindLabel(item),
      sizeClass: Number(item?.sizeClass ?? 1),
    })));
    return hold + currentNetworkFeeSurchargeNanotons() * BigInt(profile.length);
  }
  const count = BigInt(Math.max(1, Number(parts) || 1));
  const kindLabel = composerProfileKindLabel(profile);
  const sizeClass = Number(profile?.sizeClass ?? 1);
  const singleCapsuleHold = BATCH_SHARED_BASE_HOLD_NANOTONS + capsulePerPartHoldNanotons(kindLabel, sizeClass);
  return (singleCapsuleHold + currentNetworkFeeSurchargeNanotons()) * count;
}

// The OBSERVED SETTLED net price of one capsule (real user debit after the over-hold is refunded on ACK),
// from the sandbox-measured net-price tables, plus the retained network-fee surcharge (not refunded).
function composerProfileNetPriceNanotons(profile) {
  const sizeClass = Number(profile?.sizeClass ?? 1);
  const settled = composerProfileKindLabel(profile) === 'public'
    ? publicCapsuleBaseNetPriceNanotons(sizeClass)
    : privateCapsuleBaseNetPriceNanotons(sizeClass);
  return nonNegativeBigInt(settled) + currentNetworkFeeSurchargeNanotons();
}

function composerEstimatedNetCostNanotons(profile, parts = 1) {
  if (Array.isArray(profile)) {
    return profile.reduce((sum, item) => sum + composerProfileNetPriceNanotons(item), 0n);
  }
  return composerProfileNetPriceNanotons(profile) * BigInt(Math.max(1, Number(parts) || 1));
}

// Hold -> net fallback for paths that only have the final hold (no per-part profiles): the settled net cost
// is materially below the hold (the bulk of the hold is the refundable import over-hold + ACK float), so we
// estimate net from the observed-settled fraction of a 1-part hold. Used only for the price-change confirm
// dialog's "new cost" line; if profiles are available, composerEstimatedNetCostNanotons is exact.
function composerNetCostFromHoldNanotons(hold, parts = 1, profiles = null) {
  if (Array.isArray(profiles) && profiles.length > 0) {
    return composerEstimatedNetCostNanotons(profiles, profiles.length);
  }
  const value = nonNegativeBigInt(hold);
  // Conservative: report the hold itself as the cost ceiling when we lack profiles (never under-quote).
  return value * BigInt(Math.max(1, Number(parts) || 1)) / BigInt(Math.max(1, Number(parts) || 1));
}

function composerKnownVaultTonShortfall(profile, parts = 1) {
  const user = currentVaultUserSource();
  if (user?.exists !== true) return false;
  return vaultTonBalanceNanotons(user) < composerEstimatedMaxChargeNanotons(profile, parts);
}

function privateComposerKnownVaultTonShortfall() {
  const plan = privateComposerSendPlan(messageInput?.value ?? '', privateImageAttachments, currentPrivateSenderOptions(), {
    paymentCheck: privatePaymentCheckDraft,
  });
  if (privateComposerPartLimitMessage(plan.length)) return true;
  return composerKnownVaultTonShortfall(privateComposerPublishProfilesForPlan(currentOutgoingPrivateSuite(), plan), 1);
}

function publicComposerKnownVaultTonShortfall() {
  const plan = publicComposerSendPlan(publicMessageInput?.value ?? '', publicImageAttachments);
  return composerKnownVaultTonShortfall(publicComposerPublishProfilesForPlan(plan), 1);
}

function composerPublishProfileForDraft(publish) {
  if (BigInt(publish?.publish_kind ?? 0n) === VAULT_PUBLISH_KIND.PUBLIC) return publicComposerPublishProfile(Number(publish?.size_class ?? 1));
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
  const reason = privateSendBlockReason(thread);
  sendButton.disabled = Boolean(reason);
  sendButton.title = reason ?? 'Send private message';
}

function refreshPublicSendButtonState() {
  const publicSendButton = publicComposer?.querySelector?.('.send-button');
  if (publicSendButton) publicSendButton.disabled = !plathoWallet || !hasActivePlathoAccount() || pendingServiceWorkerAppShellReload || tonRpcLimited() || publicComposerKnownVaultTonShortfall();
}

async function assertVaultHasPrivatePublishHold(suite, plan, options = {}) {
  const provider = await resolveVaultChainProvider();
  const user = rememberConnectedVaultUser(options.allowOwnVaultActionReadFallback === false
    ? await loadConnectedVaultUser({ provider, ...criticalChainReadOptions() })
    : await readFreshConnectedVaultUserForOwnVaultAction(provider));
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
  const plan = imagePartsForSend(attachment, 'profile avatar');
  const pricedProfiles = publicComposerPublishProfilesForPlan(plan);
  return composerEstimatedMaxChargeNanotons(pricedProfiles, 1)
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
  if (options.ignoreTonRpcLimit !== true && tonRpcLimited()) {
    return {
      text: TON_RPC_CONNECTING_STATUS,
      state: 'short',
      parts,
    };
  }
  if (pendingServiceWorkerAppShellReload === true) {
    return {
      text: 'Update ready - reload app',
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
    const privatePlan = privateComposerSendPlan(messageInput?.value ?? '', privateImageAttachments, currentPrivateSenderOptions(), {
      paymentCheck: privatePaymentCheckDraft,
    });
    const limitMessage = privateComposerPartLimitMessage(privatePlan.length);
    const blockReason = privateSendBlockReason(activeThread(), { includeVaultShortfall: false });
    const status = blockReason
      ? { text: blockReason, state: 'short' }
      : limitMessage
      ? { text: limitMessage, state: 'short' }
      : composerCostStatusText(
        privateComposerPublishProfile(),
        messageInput?.value ?? '',
        SINGLE_CAPSULE_USEFUL_BYTES,
        privateImageAttachments[0] ?? null,
        {
          parts: Math.max(1, privatePlan.length),
          pricedProfile: privateComposerPublishProfilesForPlan(currentOutgoingPrivateSuite(), privatePlan),
          ignoreTonRpcLimit: true,
        },
      );
    const paymentDraftText = privatePaymentCheckDraft
      ? ` + ${paymentAssetLabel(privatePaymentCheckDraft.asset)} check ${formatAtomicAmount(privatePaymentCheckDraft.amount)}`
      : '';
    privateComposerCostStatus.textContent = `${status.text}${paymentDraftText}`;
    privateComposerCostStatus.dataset.state = status.state;
  }
  refreshPrivateSendButtonState();
  if (publicComposerCostStatus) {
    const publicPlan = publicComposerSendPlan(publicMessageInput?.value ?? '', publicImageAttachments);
    const status = composerCostStatusText(
      publicComposerPublishProfile(),
      publicMessageInput?.value ?? '',
      PUBLIC_POST_TEXT_MAX_BYTES,
      publicImageAttachments,
      {
        parts: Math.max(1, publicPlan.length),
        pricedProfile: publicComposerPublishProfilesForPlan(publicPlan),
      },
    );
    publicComposerCostStatus.textContent = status.text;
    publicComposerCostStatus.dataset.state = status.state;
  }
  refreshPublicSendButtonState();
}

function normalizePublicSyncWindow(value) {
  const text = String(value ?? 'short').toLowerCase();
  if (text === 'all' || text === 'long') return 'long';
  return 'short';
}

function readPublicSyncWindow() {
  try {
    return normalizePublicSyncWindow(localStorageOrNull()?.getItem(PUBLIC_SYNC_WINDOW_STORAGE_KEY));
  } catch {
    return 'short';
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
  return normalized === 'long' ? 'long public history' : 'short public history';
}

function publicSyncCutoffMs(value = readPublicSyncWindow()) {
  normalizePublicSyncWindow(value);
  return null;
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

function privateAttachmentLabelForImage(attachment) {
  return attachment
    ? `${attachment.name} - ${Math.ceil(attachment.bytes.length / 1024)} KiB ${attachment.mode.label.toLowerCase()}`
    : 'Image';
}

function createImageModeSelect(attachment, onChange) {
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Image compression');
  for (const mode of Object.values(IMAGE_COMPRESSION_MODES)) {
    const option = document.createElement('option');
    option.value = mode.id;
    option.textContent = `${mode.label} ${Math.round(mode.maxBytes / 1024)} KiB`;
    select.append(option);
  }
  select.value = attachment?.mode?.id ?? DEFAULT_IMAGE_COMPRESSION_MODE_ID;
  select.addEventListener('change', onChange);
  return select;
}

function updatePrivateAttachmentUi() {
  const panel = privateAttachmentPanel;
  if (!panel) return;
  const imageAttachments = normalizePrivateImageAttachments(privateImageAttachments);
  const hasPayment = Boolean(privatePaymentCheckDraft);
  const hasAttachments = imageAttachments.length > 0 || hasPayment;
  panel.hidden = !hasAttachments;
  panel.classList.toggle('is-list', hasAttachments);
  if (!hasAttachments) {
    panel.replaceChildren();
    return;
  }
  const rows = [];
  imageAttachments.forEach((attachment, index) => {
    const row = document.createElement('div');
    row.className = 'composer-attachment-row';
    const label = document.createElement('span');
    label.className = 'composer-attachment-label';
    label.textContent = privateAttachmentLabelForImage(attachment);
    const modeSelect = createImageModeSelect(attachment, () => {
      recompressPrivateImageAttachment(index, modeSelect.value).catch((error) => console.error(error));
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      privateImageAttachments = privateImageAttachments.filter((_, itemIndex) => itemIndex !== index);
      updateImageAttachmentUi('private');
      refreshComposerCostStatus();
    });
    row.append(label, modeSelect, remove);
    rows.push(row);
  });
  if (privatePaymentCheckDraft) {
    const row = document.createElement('div');
    row.className = 'composer-attachment-row';
    const label = document.createElement('span');
    label.className = 'composer-attachment-label';
    label.textContent = `Payment check - ${paymentAssetLabel(privatePaymentCheckDraft.asset)} ${formatAtomicAmount(privatePaymentCheckDraft.amount)}`;
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', async () => {
      const paymentDetails = await requestPaymentCheckDetails(privatePaymentCheckDraft);
      if (!paymentDetails) return;
      privatePaymentCheckDraft = paymentDetails;
      updateImageAttachmentUi('private');
      refreshComposerCostStatus();
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      privatePaymentCheckDraft = null;
      updateImageAttachmentUi('private');
      refreshComposerCostStatus();
    });
    row.append(label, edit, remove);
    rows.push(row);
  }
  panel.replaceChildren(...rows);
}

function updateImageAttachmentUi(kind) {
  if (kind === 'private') {
    updatePrivateAttachmentUi();
    return;
  }
  const attachments = normalizePublicImageAttachments(publicImageAttachments);
  const attachment = attachments[0] ?? null;
  const panel = kind === 'public' ? publicAttachmentPanel : privateAttachmentPanel;
  const label = kind === 'public' ? publicAttachmentLabel : privateAttachmentLabel;
  const modeSelect = kind === 'public' ? publicImageModeSelect : privateImageModeSelect;
  if (panel) panel.hidden = attachments.length === 0;
  if (label) {
    label.textContent = attachments.length > 1
      ? `${attachments.length} images attached`
      : attachment
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
      publicImageAttachments = [...publicImageAttachments, attachment];
      insertImageMarkerForComposer('public', publicImageAttachments.length);
    } else {
      privateImageAttachments = [...privateImageAttachments, attachment];
      insertImageMarkerForComposer('private', privateImageAttachments.length);
    }
    updateImageAttachmentUi(kind);
    refreshComposerPublishPolicy();
  } catch (error) {
    if (kind === 'public') {
      publicImageAttachments = [];
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

async function recompressPrivateImageAttachment(index, modeId) {
  const attachment = privateImageAttachments[index];
  if (!attachment?.sourceFile) return;
  const status = privateComposerCostStatus;
  try {
    if (status) {
      status.textContent = 'Recompressing image';
      status.dataset.state = 'short';
    }
    const next = await compressImageFile(attachment.sourceFile, modeId);
    privateImageAttachments = privateImageAttachments.map((item, itemIndex) => (
      itemIndex === index ? next : item
    ));
    updateImageAttachmentUi('private');
    refreshComposerCostStatus();
  } catch (error) {
    if (status) {
      status.textContent = error?.message ?? 'Image compression blocked';
      status.dataset.state = 'short';
    }
    throw error;
  }
}

async function recompressImageAttachment(kind) {
  const attachment = kind === 'public' ? normalizePublicImageAttachments(publicImageAttachments)[0] : privateImageAttachments[0];
  const modeSelect = kind === 'public' ? publicImageModeSelect : privateImageModeSelect;
  if (!attachment?.sourceFile || !modeSelect) return;
  if (kind === 'public') {
    const next = await compressImageFile(attachment.sourceFile, modeSelect.value);
    publicImageAttachments = publicImageAttachments.map((item, index) => (index === 0 ? next : item));
    updateImageAttachmentUi('public');
    refreshComposerCostStatus();
  } else {
    await recompressPrivateImageAttachment(0, modeSelect.value);
  }
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
    paymentCheckButton.title = canPublish ? 'Attach private payment check' : 'Create or import a wallet to attach a private payment check';
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

function composerBlocksFromDraft(text, attachments = [], paymentDraft = null) {
  const source = String(text ?? '');
  const images = normalizePrivateImageAttachments(attachments);
  const usedImages = new Set();
  let usedPayment = false;
  const blocks = [];
  const pushText = (value) => {
    const trimmed = String(value ?? '').trim();
    if (trimmed) blocks.push({ type: 'text', text: trimmed });
  };
  const pushImage = (index) => {
    const imageIndex = Number(index) - 1;
    const attachment = images[imageIndex];
    if (!attachment || usedImages.has(imageIndex)) return;
    usedImages.add(imageIndex);
    blocks.push({
      type: 'image',
      attachment,
      bytes: attachment.bytes,
      width: attachment.width,
      height: attachment.height,
      format: attachment.mediaFormat ?? PLATHO_COMPACT_IMAGE_FORMATS.WEBP,
      url: attachment.dataUrl,
      mode: attachment.mode?.id,
      modeLabel: attachment.mode?.label,
    });
  };
  const pushPayment = () => {
    if (!paymentDraft || usedPayment) return;
    usedPayment = true;
    blocks.push({ type: 'payment', paymentDraft, payment: paymentDraft });
  };
  let cursor = 0;
  COMPOSER_MARKER_RE.lastIndex = 0;
  for (const match of source.matchAll(COMPOSER_MARKER_RE)) {
    pushText(source.slice(cursor, match.index));
    if (match[1] !== undefined) pushImage(match[1]);
    else pushPayment();
    cursor = match.index + match[0].length;
  }
  pushText(source.slice(cursor));
  images.forEach((_, index) => {
    if (!usedImages.has(index)) pushImage(index + 1);
  });
  if (paymentDraft && !usedPayment) pushPayment();
  return blocks;
}

function displayBlocksFromDocumentBlocks(blocks) {
  return (blocks ?? []).map((block) => {
    if (block.type === 'text') return { type: 'text', text: block.text ?? '' };
    if (block.type === 'image') {
      const bytes = block.bytes instanceof Uint8Array ? block.bytes : new Uint8Array(block.bytes ?? []);
      return {
        type: 'image',
        url: block.url ?? bytesToImageDataUrl(bytes, 'image/webp'),
        bytes: bytes.length,
        width: block.width,
        height: block.height,
        mode: block.mode,
        modeLabel: block.modeLabel,
      };
    }
    if (block.type === 'payment') {
      const payment = block.payment ?? block.paymentDraft;
      return { type: 'payment', payment, text: payment ? paymentMessageText(payment) : 'Payment check' };
    }
    return null;
  }).filter(Boolean);
}

function messageDocumentBytesFromDraft(text, attachments = [], paymentDraft = null, options = {}) {
  const blocks = composerBlocksFromDraft(text, attachments, paymentDraft);
  if (blocks.length <= 0) return null;
  return encodeMessageDocumentBlocks(blocks, options);
}

function messagePreviewFromBlocks(blocks = []) {
  const text = blocks.find((block) => block?.type === 'text' && String(block.text ?? '').trim())?.text;
  if (text) return String(text).trim();
  const payment = blocks.find((block) => block?.type === 'payment')?.payment;
  if (payment) return paymentMessageText(payment);
  const imageCount = blocks.filter((block) => block?.type === 'image').length;
  if (imageCount > 0) return imageCount === 1 ? 'Image' : `${imageCount} images`;
  return '';
}

function insertComposerMarker(textarea, marker) {
  if (!textarea) return;
  const value = textarea.value ?? '';
  const start = Number.isFinite(textarea.selectionStart) ? textarea.selectionStart : value.length;
  const end = Number.isFinite(textarea.selectionEnd) ? textarea.selectionEnd : start;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const prefix = before && !before.endsWith('\n') ? '\n' : '';
  const suffix = after && !after.startsWith('\n') ? '\n' : '';
  const insert = `${prefix}${marker}${suffix}`;
  textarea.value = `${before}${insert}${after}`;
  const nextCursor = before.length + insert.length;
  textarea.focus?.();
  textarea.setSelectionRange?.(nextCursor, nextCursor);
  autoResizeComposerTextarea(textarea);
}

function insertImageMarkerForComposer(kind, index) {
  const marker = `[image ${index}]`;
  insertComposerMarker(kind === 'public' ? publicMessageInput : messageInput, marker);
}

function insertPaymentCheckMarker() {
  if (!messageInput) return;
  const value = messageInput.value ?? '';
  COMPOSER_CHECK_MARKER_RE.lastIndex = 0;
  if (COMPOSER_CHECK_MARKER_RE.test(value)) return;
  insertComposerMarker(messageInput, '[check]');
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
  LEGACY_MESSAGE_HISTORY_DB_NAME,
  LEGACY_REPLAY_DB_NAME,
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

async function plathoLocalIndexedDbNames() {
  const names = new Set([
    ...PLATHO_LOCAL_INDEXED_DB_NAMES,
    currentMessageHistoryDbName(),
    currentReplayDbName(),
  ]);
  if (globalThis.indexedDB?.databases) {
    try {
      const databases = await indexedDB.databases();
      for (const database of databases ?? []) {
        const name = database?.name;
        if (typeof name !== 'string') continue;
        if (
          name === LEGACY_MESSAGE_HISTORY_DB_NAME
          || name === LEGACY_REPLAY_DB_NAME
          || name.startsWith(`${LEGACY_MESSAGE_HISTORY_DB_NAME}.`)
          || name.startsWith(`${LEGACY_REPLAY_DB_NAME}.`)
        ) {
          names.add(name);
        }
      }
    } catch {
      // Some browsers expose IndexedDB but do not allow database enumeration.
    }
  }
  return [...names];
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
  await Promise.all((await plathoLocalIndexedDbNames()).map((name) => deleteIndexedDbDatabase(name)));
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
  const canEditPrivateDraft = canEditPrivateComposerDraft(thread);
  const canSendPrivate = canAttemptPrivateSend(thread);
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
  if (mintUsernameButton) mintUsernameButton.disabled = false;
  if (linkUsernameButton) linkUsernameButton.disabled = false;
  if (setAvatarButton) setAvatarButton.disabled = false;
  if (paymentCheckButton) paymentCheckButton.disabled = !canSendPrivate;
  if (privateImageButton) privateImageButton.disabled = !canEditPrivateDraft;
  if (privateComposerAddButton) privateComposerAddButton.disabled = !canEditPrivateDraft;
  if (privateAnonymousButton) privateAnonymousButton.disabled = !canEditPrivateDraft;
  if (privateSenderModeSelect) privateSenderModeSelect.disabled = !plathoWallet;
  if (messageInput) {
    messageInput.disabled = !canEditPrivateDraft;
  }
  if (sendButton) {
    refreshPrivateSendButtonState();
  }
  if (publicMessageInput) publicMessageInput.disabled = !plathoWallet || !signedActionsReady;
  if (publicComposerCommentsCheckbox) publicComposerCommentsCheckbox.disabled = !plathoWallet || !signedActionsReady;
  refreshPublicSendButtonState();
  if (burnAthButton) burnAthButton.disabled = !plathoWallet || !signedActionsReady;
  renderAthFlushStatus();
  for (const button of actionGrid?.querySelectorAll('button[data-action]') ?? []) {
    button.disabled = !plathoWallet || !signedActionsReady;
  }
  railItems.forEach((item) => {
    item.disabled = false;
    item.title = item.getAttribute('aria-label') ?? '';
  });
  refreshVaultMoveWidget();
  updatePrivateSenderModeUi();
  refreshComposerCostStatus();
  refreshConversationSubtitle();
  refreshMessageActionStatuses({ keepSyncStatus: true });
}

function setView(view) {
  appShell.dataset.view = view;
  if (view !== 'chats') {
    appShell.dataset.chatOpen = 'false';
    clearMessageAutoSyncTimer();
  }
  railItems.forEach((item) => item.classList.toggle('is-active', item.dataset.tab === view));
  panels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panel === view));
  if (view === 'chats' && plathoWallet && localRecipientKeyPair) {
    beginMessageSyncUi();
    syncPrivateCapsulesFromChainOnce({ mode: 'auto' }).then((result) => {
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
    .filter((thread) => {
      if (privateChainSyncPromise && isPendingIdentityResolutionThread(thread)) return false;
      return `${thread.name} ${thread.preview} ${thread.state} ${threadIdentitySearchText(thread)}`.toLowerCase().includes(q);
    })
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
    refreshPrivateDebugLog();
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
  refreshPrivateDebugLog();
  messageStrip.innerHTML = '';
  const isReadOnly = thread.readOnly === true;
  const canEditPrivateDraft = canEditPrivateComposerDraft(thread);
  const canSendPrivate = canAttemptPrivateSend(thread);

  if (composer) composer.dataset.readOnly = isReadOnly ? 'true' : 'false';
  refreshComposerPublishPolicy();
  if (messageInput) {
    messageInput.disabled = !canEditPrivateDraft;
    messageInput.placeholder = privateComposerPlaceholder({ readOnly: isReadOnly });
  }
  if (sendButton) sendButton.disabled = !canSendPrivate;
  if (paymentCheckButton) paymentCheckButton.disabled = !canSendPrivate;
  if (privateImageButton) privateImageButton.disabled = !canEditPrivateDraft;
  if (privateComposerAddButton) privateComposerAddButton.disabled = !canEditPrivateDraft;
  if (privateAnonymousButton) privateAnonymousButton.disabled = !canEditPrivateDraft;
  if (privateImageModeSelect) privateImageModeSelect.disabled = isReadOnly || !plathoWallet;

  refreshPrivateSendButtonState();
  updatePrivateSenderModeUi();
  sortThreadMessages(thread);
  thread.messages.forEach((message) => {
    const row = document.createElement('div');
    row.className = `message ${message.type}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    const blocks = Array.isArray(message.blocks) ? message.blocks : [];
    let paymentBlockElement = null;
    if (blocks.length > 0) {
      for (const block of blocks) {
        if (block?.type === 'text' && block.text) {
          const text = document.createElement('div');
          text.className = 'message-text-block';
          text.textContent = block.text;
          bubble.append(text);
        } else if (block?.type === 'image' && block.url) {
          const image = document.createElement('img');
          image.className = 'message-image';
          image.src = block.url;
          image.alt = 'Open image';
          image.loading = 'lazy';
          image.tabIndex = 0;
          image.role = 'button';
          image.title = 'Open full-size image';
          image.dataset.fullImageSrc = block.url;
          image.dataset.fullImageMeta = messageImageLightboxMeta(block);
          image.addEventListener('load', () => {
            image.dataset.fullImageMeta = messageImageLightboxMeta(block, image);
          }, { once: true });
          bubble.append(image);
        } else if (block?.type === 'payment') {
          const payment = block.payment ?? message.payment;
          const paymentBlock = document.createElement('div');
          paymentBlock.className = 'message-payment-block';
          const paymentLabel = document.createElement('span');
          paymentLabel.className = 'message-payment-label';
          paymentLabel.textContent = payment ? paymentMessageText(payment) : 'Payment check';
          paymentBlock.append(paymentLabel);
          paymentBlockElement = paymentBlock;
          bubble.append(paymentBlock);
        }
      }
    } else if (message.text) {
      const text = document.createElement('div');
      text.textContent = message.text;
      bubble.append(text);
    }
    if (blocks.length === 0 && message.attachment?.type === 'image' && message.attachment.url) {
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
      const paymentMetaText = String(message.meta ?? '').toLowerCase();
      const paymentActionPending = paymentMetaText.includes('claim submitted')
        || paymentMetaText.includes('claim confirming')
        || paymentMetaText.includes('claim signing')
        || paymentMetaText.includes('cancel submitted')
        || paymentMetaText.includes('cancel confirming')
        || paymentMetaText.includes('cancel signing')
        || paymentMetaText.includes('check claimed');
      const paymentActionTerminal = paymentMetaText.includes('already claimed')
        || paymentMetaText.includes('cancelled')
        || paymentMetaText.includes('check cancelled')
        || paymentMetaText.includes('another wallet')
        || paymentMetaText.includes('another sender');
      if (message.type !== 'out' && !paymentActionPending && !paymentActionTerminal) {
        const claim = document.createElement('button');
        claim.type = 'button';
        claim.textContent = 'Claim';
        claim.addEventListener('click', async () => {
          claim.disabled = true;
          try {
            message.meta = 'check claim signing';
            renderConversation();
            await updateMessageInEncryptedHistory(thread, message);
            await submitVaultClaimPaymentCheck(message.payment, {
              onStatus: async (status) => {
                message.meta = status;
                await updateMessageInEncryptedHistory(thread, message);
                renderConversation();
              },
            });
            message.meta = 'check claimed';
          } catch (error) {
            rememberPaymentCheckActionError('claim', error, message.payment);
            message.meta = isPaymentCheckClaimPending(error)
              ? 'check claim submitted, confirming'
              : paymentCheckClaimBlockedStatus(error);
            if (!isPaymentCheckClaimPending(error)) console.error(error);
          } finally {
            await updateMessageInEncryptedHistory(thread, message).catch((historyError) => console.error(historyError));
            queueVaultPostTransactionRefresh();
            renderConversation();
          }
        });
        actions.append(claim);
      }
      if (message.type === 'out' && !paymentActionPending && !paymentActionTerminal) {
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', async () => {
          cancel.disabled = true;
          try {
            message.meta = 'check cancel signing';
            renderConversation();
            await updateMessageInEncryptedHistory(thread, message);
            await submitVaultCancelPaymentCheck(message.payment, {
              onStatus: async (status) => {
                message.meta = status;
                await updateMessageInEncryptedHistory(thread, message);
                renderConversation();
              },
            });
            message.meta = 'check cancelled';
          } catch (error) {
            rememberPaymentCheckActionError('cancel', error, message.payment);
            message.meta = isPaymentCheckCancelPending(error)
              ? 'check cancel submitted, confirming'
              : paymentCheckCancelBlockedStatus(error);
            if (!isPaymentCheckCancelPending(error)) console.error(error);
          } finally {
            await updateMessageInEncryptedHistory(thread, message).catch((historyError) => console.error(historyError));
            queueVaultPostTransactionRefresh();
            renderConversation();
            if (message.meta === 'check cancelled') {
              schedulePendingServiceWorkerAppShellReload();
            }
          }
        });
        actions.append(cancel);
      }
      if (!paymentBlockElement) {
        paymentBlockElement = document.createElement('div');
        paymentBlockElement.className = 'message-payment-block';
        const paymentLabel = document.createElement('span');
        paymentLabel.className = 'message-payment-label';
        paymentLabel.textContent = paymentMessageText(message.payment);
        paymentBlockElement.append(paymentLabel);
        bubble.append(paymentBlockElement);
      }
      if (actions.children.length > 0) paymentBlockElement.append(actions);
    }
    const manualActions = privateMessageManualActionsElement(thread, message);
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
    if (manualActions) row.append(manualActions);
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
    setVaultStatus(rateLimited ? 'RPC busy, retrying' : vaultActionBlockedStatusText(error, 'transaction blocked'));
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
      setVaultStatus(rateLimited ? 'RPC busy, retrying' : vaultActionBlockedStatusText(error, 'move blocked'));
      if (!rateLimited) console.error(error);
    } finally {
      refreshVaultMoveWidget();
    }
  });
}

publicSyncWindowSelect?.addEventListener('change', async () => {
  const value = writePublicSyncWindow(publicSyncWindowSelect.value);
  updatePublicSyncWindowUi();
  setPublicStatus(`syncing ${publicSyncWindowLabel(value)}`);
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
    if (!plathoWallet) {
      setUsernameMintStatus('create wallet first', 'error');
      return;
    }
    mintUsernameButton.disabled = true;
    await submitUsernameMint();
  } catch (error) {
    const rateLimited = noteTonRpcRateLimit(error);
    setUsernameMintStatus(rateLimited ? TON_RPC_CONNECTING_STATUS : usernameMintStatusText(error), rateLimited ? 'busy' : 'error');
    console.error(error);
  } finally {
    mintUsernameButton.disabled = false;
  }
});

linkUsernameButton?.addEventListener('click', async () => {
  if (!plathoWallet) {
    setProfileAvatarStatus('create wallet first', 'error');
    return;
  }
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
    linkUsernameButton.disabled = false;
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

flushAthButton?.addEventListener('click', async () => {
  try {
    flushAthButton.disabled = true;
    await submitAthDueFlush();
  } catch (error) {
    athFlushState = {
      ...athFlushState,
      busy: false,
      error: String(error?.message ?? error ?? 'ATH flush blocked'),
    };
    renderAthFlushStatus();
    flashWalletIdentityStatus('ATH flush blocked');
    console.error(error);
  } finally {
    renderAthFlushStatus();
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
    const result = await syncPrivateCapsulesFromChainOnce({
      mode: 'manual',
      readLimit: PRIVATE_CHAIN_INDEX_READ_LIMIT,
      forceHistoryRetry: true,
      forceIndexRescan: true,
    });
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
      hint: 'Use a Platho name, .ath, .ton, or wallet address. Local label is only shown on this device.',
      submitLabel: 'Add channel',
      fields: [
        {
          id: 'channelIdentity',
          label: 'Channel',
          placeholder: 'alex, alex.ath, alex.ton, or EQ...',
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
    if (!canAttemptPrivateSend()) {
      refreshComposerPublishPolicy();
      return;
    }
    paymentCheckButton.disabled = true;
    const paymentDetails = await requestPaymentCheckDetails(privatePaymentCheckDraft);
    if (!paymentDetails) return;
    privatePaymentCheckDraft = paymentDetails;
    insertPaymentCheckMarker();
    updateImageAttachmentUi('private');
    refreshComposerCostStatus();
  } catch (error) {
    refreshMessagingControls();
    console.error(error);
  } finally {
    paymentCheckButton.disabled = !canAttemptPrivateSend();
  }
});

privateComposerAddButton?.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (!canEditPrivateComposerDraft()) {
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
  if (!canEditPrivateComposerDraft()) {
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
  await setImageAttachment('private', file, DEFAULT_IMAGE_COMPRESSION_MODE_ID);
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
    const rateLimited = noteTonRpcRateLimit(error);
    if (rateLimited || isTonRpcRecoverableReadError(error)) {
      setProfileAvatarStatus(TON_RPC_CONNECTING_STATUS, 'busy');
    } else {
      const message = String(error?.avatarDiagnosticStatus ?? error?.message ?? 'avatar blocked');
      setProfileAvatarStatus(message, 'error');
      console.error(error);
    }
  } finally {
    if (profileAvatarInput) profileAvatarInput.value = '';
    setAvatarButton?.toggleAttribute('disabled', false);
  }
});

privateClearImageButton?.addEventListener('click', () => {
  privateImageAttachments = [];
  privatePaymentCheckDraft = null;
  updateImageAttachmentUi('private');
  refreshComposerCostStatus();
});

publicClearImageButton?.addEventListener('click', () => {
  publicImageAttachments = [];
  updateImageAttachmentUi('public');
  refreshComposerCostStatus();
});

publicComposer?.addEventListener('submit', async (event) => {
  event.preventDefault();
  enforcePublicComposerByteLimit();
  const text = publicMessageInput?.value.trim() ?? '';
  const attachments = normalizePublicImageAttachments(publicImageAttachments);
  if (!text && attachments.length === 0) return;
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
      await submitPublicCommentThroughVault(publicCommentTarget, text, attachments);
    } else {
      await submitPublicPostThroughVault({
        text,
        attachments,
        commentsAllowed,
      });
    }
    publicMessageInput.value = '';
    publicImageAttachments = [];
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
  const attachments = normalizePrivateImageAttachments(privateImageAttachments);
  const paymentDraft = privatePaymentCheckDraft;
  if (!text && attachments.length === 0 && !paymentDraft) return;
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
  const sendPlan = privateComposerSendPlan(text, attachments, senderOptions, { paymentCheck: paymentDraft });
  const limitMessage = privateComposerPartLimitMessage(sendPlan.length);
  if (limitMessage) {
    if (privateComposerCostStatus) {
      privateComposerCostStatus.textContent = limitMessage;
      privateComposerCostStatus.dataset.state = 'short';
    }
    refreshPrivateSendButtonState();
    return;
  }
  const draftBlocks = composerBlocksFromDraft(text, attachments, paymentDraft);
  const displayBlocks = displayBlocksFromDocumentBlocks(draftBlocks);
  const message = {
    type: 'out',
    text: messagePreviewFromBlocks(displayBlocks),
    blocks: displayBlocks,
    meta: 'sending',
    privateDraft: {
      text,
      attachments,
      paymentDraft,
      selectedSuite,
      senderOptions,
    },
    privateManualRetryAvailable: false,
    privateCancelAvailable: false,
    ...localMessageOrderFields(),
  };
  if (paymentDraft) {
    message.paymentDraft = paymentDraftForHistory(paymentDraft);
  }
  insertThreadMessage(thread, message);
  const sendContext = {
    thread,
    message,
    text,
    attachments,
    paymentDraft,
    selectedSuite,
    senderOptions,
    retryAttempt: 0,
    confirmAttempt: 0,
  };
  refreshThreadAfterMessageChange(thread);
  messageInput.value = '';
  privateImageAttachments = [];
  privatePaymentCheckDraft = null;
  updateImageAttachmentUi('private');
  autoResizeComposerTextarea(messageInput);
  refreshComposerCostStatus();
  if (sendButton) sendButton.disabled = true;
  renderThreads();
  renderConversation();

  try {
    await assertVaultHasPrivatePublishHold(selectedSuite, sendPlan, {
      allowOwnVaultActionReadFallback: Boolean(paymentDraft),
    });
  } catch (error) {
    await settlePrivateComposerSendError(sendContext, error);
    refreshThreadAfterMessageChange(thread);
    renderThreads();
    renderConversation();
    return;
  }

  try {
    if (sendContext.paymentDraft) {
      await attemptPrivatePaymentCheckPublish(sendContext);
    } else {
      await attemptPrivateComposerMessagePublish(sendContext);
    }
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

copyPrivateDebugButton?.addEventListener('click', async () => {
  try {
    copyPrivateDebugButton.disabled = true;
    await copyPrivateDebugText();
  } catch (error) {
    setPrivateDebugCopyButtonStatus('Debug copy blocked');
    console.error(error);
  } finally {
    refreshPrivateDebugLog();
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

function requireVaultAuthSecretKey() {
  if (!localVaultAuthKeyPair?.secretKey) {
    throw new Error('Local Vault auth key is not ready');
  }
  return localVaultAuthKeyPair.secretKey;
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

function athFlushReadyAmount(state = athFlushState) {
  return nonNegativeBigInt(state.username_burn_due_ath) + nonNegativeBigInt(state.profile_burn_due_ath);
}

function athFlushPendingCount(state = athFlushState) {
  return nonNegativeBigInt(state.username_pending_burn_flush_count) + nonNegativeBigInt(state.profile_pending_burn_flush_count);
}

function athFlushStateKnown(state = athFlushState) {
  return state.username_burn_due_ath !== null || state.profile_burn_due_ath !== null;
}

function athFlushStatusText(state = athFlushState) {
  if (state.busy) return 'flushing';
  if (state.error) return 'sync delayed';
  if (!athFlushStateKnown(state)) return 'checking';
  const ready = athFlushReadyAmount(state);
  const pending = athFlushPendingCount(state);
  if (ready > 0n && pending > 0n) return `${formatAthProfileAmount(ready)} ready + pending`;
  if (ready > 0n) return `${formatAthProfileAmount(ready)} ready`;
  if (pending > 0n) return 'flush pending';
  return '0 ATH ready';
}

function renderAthFlushStatus() {
  const ready = athFlushReadyAmount();
  const canFlush = Boolean(plathoWallet?.address) && !athFlushState.busy && ready > 0n;
  if (flushAthButton) flushAthButton.disabled = !canFlush;
  setProfileActionStatus(
    flushAthStatus,
    !plathoWallet?.address ? 'wallet required' : athFlushStatusText(),
    athFlushState.error ? 'error' : (athFlushState.busy ? 'busy' : ''),
  );
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
  renderAthFlushStatus();
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

function localUsernameMintPriceAtomic(username) {
  const length = String(username ?? '').length;
  if (length === 4) return USERNAME_PRICE_4_CHARS_ATOMIC;
  if (length === 5) return USERNAME_PRICE_5_CHARS_ATOMIC;
  if (length >= 6 && length <= 16) return USERNAME_PRICE_6_PLUS_CHARS_ATOMIC;
  return null;
}

function usernameMintPendingMatches(record, username, owner) {
  if (!record) return false;
  const normalized = normalizeUsernameInput(username);
  const ownerAddress = requireBasechainAddress(owner, 'Connected wallet');
  return record.username === normalized
    && record.expiresAt > Date.now()
    && sameWalletAddress(record.owner, ownerAddress);
}

function pendingUsernameMintRecord(username, owner) {
  const record = globalThis.plathoPendingUsernameMint;
  if (usernameMintPendingMatches(record, username, owner)) return record;
  if (record?.expiresAt && record.expiresAt <= Date.now()) {
    globalThis.plathoPendingUsernameMint = null;
  }
  return null;
}

function rememberPendingUsernameMint(username, owner, submission = {}) {
  const normalized = normalizeUsernameInput(username);
  const now = Date.now();
  globalThis.plathoPendingUsernameMint = {
    username: normalized,
    label: `${normalized}.ath`,
    owner: requireBasechainAddress(owner, 'Connected wallet'),
    clientNonce: submission?.clientNonce === undefined || submission?.clientNonce === null
      ? null
      : String(submission.clientNonce),
    at: now,
    expiresAt: now + USERNAME_MINT_LOCAL_PENDING_MS,
  };
  return globalThis.plathoPendingUsernameMint;
}

function clearPendingUsernameMint(username, owner) {
  if (usernameMintPendingMatches(globalThis.plathoPendingUsernameMint, username, owner)) {
    globalThis.plathoPendingUsernameMint = null;
  }
}

function assertNoPendingUsernameMintRetry(username, owner) {
  if (pendingUsernameMintRecord(username, owner)) {
    throw new Error('Username mint is still finalizing; sync ownership before retrying');
  }
}

function usernameMintPricePreview(input) {
  try {
    const username = normalizeUsernameInput(input);
    const price = localUsernameMintPriceAtomic(username);
    return price === null
      ? '100-10k ATH by length; 50% goes to burn'
      : `${formatAthAtomic(price)} ATH; 50% goes to burn`;
  } catch {
    return '100-10k ATH by length; 50% goes to burn';
  }
}

function usernameMintStatusText(error) {
  const message = shortUiErrorText(error, 'username blocked');
  if (/not enough vault ath|not enough vault ton|activate platho account|usernameregistry rejected/i.test(message)) {
    return message;
  }
  if (/verification unavailable/i.test(message)) return 'RPC verification unavailable';
  if (/provider is not configured|username.*provider|ton rpc|sendboc/i.test(message)) return message;
  return `username blocked: ${message}`;
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

async function activateImportedEncryptedWalletRecord(wallet, record) {
  prepareWalletScopedRuntimeForWallet(wallet, 'wallet key imported');
  await writeEncryptedPlathoWalletRecord(record);
  plathoWallet = wallet;
  localProfileAvatarPointer = readStoredProfileAvatarPointer(wallet.address);
  markWalletUnlocked();
  scheduleWalletAutoLock();
  await bootCrypto();
  queueVaultRefreshAfterWalletChange();
  await refreshOwnProfileAvatar().catch((error) => console.error(error));
  refreshMessagingControls();
  renderWalletIdentity('Wallet key imported');
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
  return activateImportedEncryptedWalletRecord(wallet, record);
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
          { label: 'ATH price', value: usernameMintPricePreview(raw) },
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

async function requestPaymentCheckDetails(initial = null) {
  let feedback = 'The encrypted check is readable by this chat only.';
  let tone = 'muted';
  let assetValue = BigInt(initial?.asset ?? RECEIVE_ASSETS.TON) === RECEIVE_ASSETS.ATH ? 'ATH' : 'TON';
  let amountValue = initial?.amount
    ? (assetValue === 'TON' ? formatTonNanotons(initial.amount) : formatAtomicAmount(initial.amount))
    : '';
  while (true) {
    const result = await openActionDialog({
      title: initial ? 'Edit payment check' : 'Create payment check',
      hint: feedback,
      tone,
      submitLabel: initial ? 'Save check' : 'Create check',
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

function paymentHasIntent(payment) {
  return Boolean(payment && (
    payment.intentId !== undefined
    || payment.intentIdHex !== undefined
    || payment.intent_id !== undefined
  ));
}

function paymentDraftForHistory(paymentDraft) {
  if (!paymentDraft) return null;
  const draft = {
    asset: String(paymentDraft.asset ?? paymentDraft.asset_id ?? RECEIVE_ASSETS.TON),
    amount: String(paymentDraft.amount ?? 0n),
  };
  if (paymentDraft.senderWallet ?? paymentDraft.sender_wallet) {
    draft.senderWallet = requireBasechainAddress(paymentDraft.senderWallet ?? paymentDraft.sender_wallet, 'Payment check sender');
  }
  if (paymentDraft.recipientWallet ?? paymentDraft.recipient_wallet) {
    draft.recipientWallet = requireBasechainAddress(paymentDraft.recipientWallet ?? paymentDraft.recipient_wallet, 'Payment check recipient');
  }
  return draft;
}

function fixedHexBytes(value, length, name = 'hex bytes') {
  const text = String(value ?? '').trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]+$/.test(text) || text.length !== length * 2) {
    throw new Error(`${name} must be ${length} bytes`);
  }
  return hexToBytes(text);
}

function paymentSecret32Bytes(payment) {
  const bytes = payment?.secret32Bytes ?? payment?.secret32_bytes;
  if (bytes !== undefined && bytes !== null) {
    const out = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (out.length !== 32) throw new Error('Payment check claim secret must be 32 bytes');
    return out;
  }
  const hex = payment?.secret32Hex ?? payment?.secret32_hex ?? payment?.secret_32_hex;
  if (hex !== undefined && hex !== null) {
    return fixedHexBytes(hex, 32, 'Payment check claim secret');
  }
  const value = payment?.secret32 ?? payment?.secret_32 ?? payment?.secret;
  if (value !== undefined && value !== null) {
    return bigIntToFixedBytes(value, 32, 'secret32');
  }
  throw new Error('Payment check claim secret is missing');
}

function normalizePaymentForMessage(payment) {
  const intentId = payment.intentId ?? payment.intent_id;
  const intentIdHex = payment.intentIdHex ?? payment.intent_id_hex;
  const normalized = {
    asset: String(payment.asset),
    amount: String(payment.amount),
    intentId: String(intentId ?? (intentIdHex ? BigInt(`0x${intentIdHex}`) : 0n)),
    intentIdHex: intentIdHex ?? bytesToHex(bigIntToFixedBytes(intentId, 32, 'intent id')),
    secret32Hex: bytesToHex(paymentSecret32Bytes(payment)),
  };
  if (payment.senderWallet ?? payment.sender_wallet) {
    normalized.senderWallet = requireBasechainAddress(payment.senderWallet ?? payment.sender_wallet, 'Payment check sender');
  }
  if (payment.recipientWallet ?? payment.recipient_wallet) {
    normalized.recipientWallet = requireBasechainAddress(payment.recipientWallet ?? payment.recipient_wallet, 'Payment check recipient');
  }
  if (payment.clientNonce !== undefined || payment.client_nonce !== undefined) {
    normalized.clientNonce = String(payment.clientNonce ?? payment.client_nonce);
  }
  return normalized;
}

function paymentForHistory(payment) {
  if (!payment) return null;
  try {
    return paymentHasIntent(payment) ? normalizePaymentForMessage(payment) : paymentDraftForHistory(payment);
  } catch {
    return safeJsonClone(payment);
  }
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

const PLATHO_DOCUMENT_MAGIC = new Uint8Array([0x50, 0x44, 0x43, 0x31]); // "PDC1"
const PLATHO_DOCUMENT_VERSION = 1;
const PLATHO_DOCUMENT_HEADER_BYTES = 8;
const PLATHO_DOCUMENT_BLOCK_HEADER_BYTES = 6;
const PLATHO_DOCUMENT_BLOCK_TYPES = Object.freeze({
  TEXT: 1,
  IMAGE: 2,
  PAYMENT: 3,
});
const COMPOSER_IMAGE_MARKER_RE = /\[(?:image|img)\s+(\d+)\]/ig;
const COMPOSER_CHECK_MARKER_RE = /\[(?:check|payment)\]/ig;
const COMPOSER_MARKER_RE = /\[(?:image|img)\s+(\d+)\]|\[(?:check|payment)\]/ig;

function concatUint8Arrays(parts) {
  const arrays = parts.map((part) => part instanceof Uint8Array ? part : new Uint8Array(part ?? []));
  const out = new Uint8Array(arrays.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of arrays) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function uint16Bytes(value, name = 'uint16') {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > 0xffff) throw new RangeError(`${name} must fit uint16`);
  return new Uint8Array([(number >> 8) & 0xff, number & 0xff]);
}

function uint32Bytes(value, name = 'uint32') {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > 0xffffffff) throw new RangeError(`${name} must fit uint32`);
  return new Uint8Array([
    (number >> 24) & 0xff,
    (number >> 16) & 0xff,
    (number >> 8) & 0xff,
    number & 0xff,
  ]);
}

function readUint16FromBytes(bytes, offset, name = 'uint16') {
  if (offset + 2 > bytes.length) throw new Error(`${name} is truncated`);
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32FromBytes(bytes, offset, name = 'uint32') {
  if (offset + 4 > bytes.length) throw new Error(`${name} is truncated`);
  return (((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function documentPaymentContent(payment, options = {}) {
  let secret32Bytes;
  try {
    secret32Bytes = paymentSecret32Bytes(payment);
  } catch (error) {
    if (options.allowMissingPaymentSecret === true) {
      secret32Bytes = new Uint8Array(32);
    } else {
      throw error;
    }
  }
  return concatUint8Arrays([
    new Uint8Array([Number(BigInt(payment.asset ?? 0n)), 0]),
    bigIntToFixedBytes(BigInt(payment.amount ?? 0n), 16, 'payment amount'),
    bigIntToFixedBytes(BigInt(payment.intentId ?? payment.intent_id ?? 0n), 32, 'intent id'),
    secret32Bytes,
  ]);
}

function paymentFromDocumentContent(content) {
  if (content.length !== 82) throw new Error('Document payment block has invalid length');
  const intentIdBytes = content.subarray(18, 50);
  const secret32Bytes = content.subarray(50, 82);
  return normalizePaymentForMessage({
    asset: BigInt(content[0]),
    amount: bytesToBigIntValue(content.subarray(2, 18)),
    intentId: bytesToBigIntValue(intentIdBytes),
    intentIdHex: bytesToHex(intentIdBytes),
    secret32Hex: bytesToHex(secret32Bytes),
  });
}

function encodeMessageDocumentBlocks(blocks, options = {}) {
  const normalized = (blocks ?? []).filter((block) => block && block.type);
  if (normalized.length <= 0) throw new Error('Document message is empty');
  if (normalized.length > 0xffff) throw new Error('Document message has too many blocks');
  const encodedBlocks = normalized.map((block) => {
    let type = 0;
    let flags = 0;
    let content = new Uint8Array();
    if (block.type === 'text') {
      type = PLATHO_DOCUMENT_BLOCK_TYPES.TEXT;
      content = new TextEncoder().encode(String(block.text ?? ''));
    } else if (block.type === 'image') {
      type = PLATHO_DOCUMENT_BLOCK_TYPES.IMAGE;
      flags = Number(block.format ?? block.mediaFormat ?? PLATHO_COMPACT_IMAGE_FORMATS.WEBP) & 0xff;
      const bytes = block.bytes instanceof Uint8Array ? block.bytes : new Uint8Array(block.bytes ?? []);
      content = concatUint8Arrays([
        uint16Bytes(block.width ?? 0, 'image width'),
        uint16Bytes(block.height ?? 0, 'image height'),
        bytes,
      ]);
    } else if (block.type === 'payment') {
      type = PLATHO_DOCUMENT_BLOCK_TYPES.PAYMENT;
      content = documentPaymentContent(block.payment ?? block, options);
    } else {
      throw new Error('Unsupported document block type');
    }
    return concatUint8Arrays([
      new Uint8Array([type, flags]),
      uint32Bytes(content.length, 'document block length'),
      content,
    ]);
  });
  return concatUint8Arrays([
    PLATHO_DOCUMENT_MAGIC,
    new Uint8Array([PLATHO_DOCUMENT_VERSION, 0]),
    uint16Bytes(encodedBlocks.length, 'document block count'),
    ...encodedBlocks,
  ]);
}

function decodeMessageDocumentBlocks(bytesLike) {
  const bytes = bytesLike instanceof Uint8Array ? bytesLike : new Uint8Array(bytesLike ?? []);
  if (bytes.length < PLATHO_DOCUMENT_HEADER_BYTES) throw new Error('Document message is truncated');
  for (let index = 0; index < PLATHO_DOCUMENT_MAGIC.length; index += 1) {
    if (bytes[index] !== PLATHO_DOCUMENT_MAGIC[index]) throw new Error('Unsupported document message magic');
  }
  if (bytes[4] !== PLATHO_DOCUMENT_VERSION) throw new Error('Unsupported document message version');
  const count = readUint16FromBytes(bytes, 6, 'document block count');
  const blocks = [];
  let offset = PLATHO_DOCUMENT_HEADER_BYTES;
  for (let index = 0; index < count; index += 1) {
    if (offset + PLATHO_DOCUMENT_BLOCK_HEADER_BYTES > bytes.length) throw new Error('Document block is truncated');
    const type = bytes[offset];
    const flags = bytes[offset + 1];
    const length = readUint32FromBytes(bytes, offset + 2, 'document block length');
    offset += PLATHO_DOCUMENT_BLOCK_HEADER_BYTES;
    if (offset + length > bytes.length) throw new Error('Document block content is truncated');
    const content = bytes.subarray(offset, offset + length);
    offset += length;
    if (type === PLATHO_DOCUMENT_BLOCK_TYPES.TEXT) {
      blocks.push({ type: 'text', text: new TextDecoder().decode(content) });
    } else if (type === PLATHO_DOCUMENT_BLOCK_TYPES.IMAGE) {
      if (content.length < 4) throw new Error('Document image block is truncated');
      blocks.push({
        type: 'image',
        format: flags || PLATHO_COMPACT_IMAGE_FORMATS.WEBP,
        bytes: content.subarray(4),
        width: readUint16FromBytes(content, 0, 'image width'),
        height: readUint16FromBytes(content, 2, 'image height'),
      });
    } else if (type === PLATHO_DOCUMENT_BLOCK_TYPES.PAYMENT) {
      blocks.push({ type: 'payment', payment: paymentFromDocumentContent(content) });
    } else {
      throw new Error('Unsupported document block type');
    }
  }
  if (offset !== bytes.length) throw new Error('Document message has trailing bytes');
  return blocks;
}

function paymentFromDocumentBlocks(blocks) {
  return (blocks ?? []).find((block) => block?.type === 'payment' && block.payment)?.payment ?? null;
}

function paymentIntentId(payment) {
  return BigInt(payment.intentId ?? `0x${payment.intentIdHex}`);
}

function paymentSecret32(payment) {
  return bytesToBigIntValue(paymentSecret32Bytes(payment));
}

function paymentAssetVaultBalance(user, asset) {
  const value = typeof asset === 'bigint' ? asset : BigInt(asset ?? 0);
  return value === RECEIVE_ASSETS.ATH
    ? nonNegativeBigInt(user?.ath_balance ?? user?.athBalance ?? user?.ath)
    : vaultTonBalanceNanotons(user);
}

function paymentCheckClaimPendingError(message = 'Payment check claim submitted; Vault confirmation is still pending') {
  const error = new Error(message);
  error.code = 'PLATHO_PAYMENT_CHECK_CLAIM_PENDING';
  return error;
}

function isPaymentCheckClaimPending(error) {
  return error?.code === 'PLATHO_PAYMENT_CHECK_CLAIM_PENDING';
}

function paymentCheckClaimBlockedStatus(error) {
  const text = String(error?.message ?? error ?? '');
  if (/already claimed|cancelled|does not exist|not found/i.test(text)) return 'check already claimed or cancelled';
  if (/another wallet|recipient/i.test(text)) return 'check is for another wallet';
  if (/data mismatch|claim secret|commitment|exitcode=16280|exit code 16280/i.test(text)) return 'check data mismatch';
  if (noteTonRpcRateLimit(error)) return TON_RPC_CONNECTING_STATUS;
  return `check claim blocked: ${shortUiErrorText(error, 'blocked')}`;
}

function paymentCheckCancelPendingError(message = 'Payment check cancel submitted; Vault confirmation is still pending') {
  const error = new Error(message);
  error.code = 'PLATHO_PAYMENT_CHECK_CANCEL_PENDING';
  return error;
}

function isPaymentCheckCancelPending(error) {
  return error?.code === 'PLATHO_PAYMENT_CHECK_CANCEL_PENDING';
}

function rememberPaymentCheckActionError(action, error, payment = null) {
  globalThis.plathoLastPaymentCheckActionError = {
    action,
    message: String(error?.message ?? error ?? ''),
    code: error?.code ?? null,
    payment: paymentForHistory(payment),
    at: new Date().toISOString(),
  };
}

function paymentCheckCancelBlockedStatus(error) {
  const text = String(error?.message ?? error ?? '');
  if (/already claimed|cancelled|does not exist|not found|disappeared/i.test(text)) return 'check already claimed or cancelled';
  if (/another wallet|sender/i.test(text)) return 'check belongs to another sender';
  if (noteTonRpcRateLimit(error)) return TON_RPC_CONNECTING_STATUS;
  return `check cancel blocked: ${shortUiErrorText(error, 'blocked')}`;
}

function isTonRpcVerificationUnavailableForOwnVaultActionError(error) {
  const message = String(error?.message ?? error ?? '');
  return error?.code === 'RPC_VERIFICATION_UNAVAILABLE'
    || /TON RPC verification unavailable|RPC_VERIFICATION_UNAVAILABLE|verification unavailable/i.test(message);
}

function isTonRpcGetGlobalDisagreementError(error) {
  const message = String(error?.message ?? error ?? '');
  return error?.code === 'RPC_DISAGREEMENT' && /get_global/i.test(message);
}

function isTonRpcSoftVaultGlobalReadError(error) {
  return isTonRpcVerificationUnavailableForOwnVaultActionError(error)
    || isTonRpcGetGlobalDisagreementError(error);
}

function isTonRpcVerificationSoftReadError(error) {
  const message = String(error?.message ?? error ?? '');
  return error?.code === 'RPC_VERIFICATION_UNAVAILABLE'
    || error?.code === 'RPC_DISAGREEMENT'
    || /TON RPC verification unavailable|RPC_VERIFICATION_UNAVAILABLE|TON RPC disagreement|RPC_DISAGREEMENT|verification unavailable/i.test(message);
}

function isTonRpcRecoverableReadError(error) {
  return isTonRpcVerificationSoftReadError(error) || isTonRpcTransientError(error);
}

function assertReceiveIntentMatchesPayment(intent, payment) {
  if (intent?.exists !== true) throw new Error('Payment check is already claimed or cancelled');
  const connectedWallet = requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  if (!sameWalletAddress(intent.recipient_wallet, connectedWallet)) {
    throw new Error('Payment check is for another wallet');
  }
  if (BigInt(intent.asset ?? 0n) !== BigInt(payment.asset ?? 0n)) {
    throw new Error('Payment check asset mismatch');
  }
  if (BigInt(intent.amount ?? 0n) !== BigInt(payment.amount ?? 0n)) {
    throw new Error('Payment check amount mismatch');
  }
  if (BigInt(intent.commitment ?? -1n) !== paymentSecret32(payment)) {
    throw new Error('Payment check data mismatch; this check cannot be claimed');
  }
}

function assertReceiveIntentCancelableBySender(intent, payment) {
  if (intent?.exists !== true) throw new Error('Payment check is already claimed or cancelled');
  const connectedWallet = requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  if (!sameWalletAddress(intent.sender_wallet, connectedWallet)) {
    throw new Error('Payment check belongs to another sender');
  }
  if (payment.senderWallet && !sameWalletAddress(payment.senderWallet, connectedWallet)) {
    throw new Error('Payment check local sender mismatch');
  }
  if (payment.recipientWallet && !sameWalletAddress(intent.recipient_wallet, payment.recipientWallet)) {
    throw new Error('Payment check recipient mismatch');
  }
  if (BigInt(intent.asset ?? 0n) !== BigInt(payment.asset ?? 0n)) {
    throw new Error('Payment check asset mismatch');
  }
  if (BigInt(intent.amount ?? 0n) !== BigInt(payment.amount ?? 0n)) {
    throw new Error('Payment check amount mismatch');
  }
}

async function readFreshReceiveIntent(provider, intentId, options = {}) {
  if (!provider?.getReceiveIntent) throw new Error('Vault provider cannot confirm payment checks');
  return provider.getReceiveIntent(intentId, {
    vaultAddress: requireVaultAddress(),
    verify: options.verify !== false,
    allowUnverifiedCriticalRead: options.allowUnverifiedCriticalRead === true,
    priority: 'critical',
    cacheTtlMs: 0,
  });
}

async function readFreshReceiveIntentForOwnVaultAction(provider, intentId) {
  return callWithDegradedTransportReadFallback(
    () => readFreshReceiveIntent(provider, intentId),
    () => readFreshReceiveIntent(provider, intentId, unverifiedCriticalChainReadOptions()),
  );
}

async function readFreshReceiveIntentForCancel(provider, intentId) {
  return readFreshReceiveIntentForOwnVaultAction(provider, intentId);
}

async function readFreshConnectedVaultUser(provider, options = {}) {
  // Signed vault actions derive their client nonce from this read; wait for
  // any in-flight publish nonce to land so the next signature stays valid.
  await awaitVaultPublishNonceBarrier();
  return loadConnectedVaultUser({
    provider,
    verify: options.verify !== false,
    allowUnverifiedCriticalRead: options.allowUnverifiedCriticalRead === true,
    priority: 'critical',
    cacheTtlMs: 0,
  });
}

async function readFreshConnectedVaultUserForOwnVaultAction(provider) {
  return callWithDegradedTransportReadFallback(
    () => readFreshConnectedVaultUser(provider),
    () => readFreshConnectedVaultUser(provider, unverifiedCriticalChainReadOptions()),
  );
}

async function callWithOwnVaultActionReadFallback(readStrict, readUnverified) {
  try {
    return await readStrict();
  } catch (error) {
    if (!isTonRpcVerificationUnavailableForOwnVaultActionError(error)) throw error;
    return readUnverified();
  }
}

function tonRpcVerificationStructurallyDegraded() {
  const transport = globalThis.plathoTonRpcTransport;
  if (typeof transport?.isDegraded === 'function' && transport.isDegraded() === true) return true;
  // A dead verifier (for example keyless toncenter blocked for the user's
  // network) breaks dual-provider verification just as hard as a dead
  // primary gateway does.
  return typeof transport?.isVerificationDegraded === 'function' && transport.isVerificationDegraded() === true;
}

async function callWithDegradedTransportReadFallback(readStrict, readUnverified) {
  // Own-action pre-sign reads fail closed on any verification trouble while
  // dual-provider verification is actually possible. The unverified fallback
  // opens only when the transport reports that verification is structurally
  // impossible: the primary gateway is parked (censorship survival) or every
  // verifier transport is dead/blocked for this network.
  if (tonRpcVerificationStructurallyDegraded()) return readUnverified();
  try {
    return await readStrict();
  } catch (error) {
    if (!isTonRpcVerificationUnavailableForOwnVaultActionError(error)) throw error;
    if (!tonRpcVerificationStructurallyDegraded()) throw error;
    return readUnverified();
  }
}

async function callWithVerificationUnavailableReadFallback(readStrict, readUnverified) {
  try {
    return await readStrict();
  } catch (error) {
    if (!isTonRpcVerificationUnavailableForOwnVaultActionError(error)) throw error;
    return readUnverified();
  }
}

async function readConnectedVaultGlobalForOwnVaultAction(provider) {
  return callWithDegradedTransportReadFallback(
    () => loadConnectedVaultGlobal({ provider, ...criticalChainReadOptions() }),
    () => loadConnectedVaultGlobal({ provider, ...unverifiedCriticalChainReadOptions() }),
  );
}

async function readCanonicalPublishChargeForOwnVaultAction(provider, owner, publishKind, sizeClass, cryptoSuite) {
  const readCharge = (readOptions) => provider.getCanonicalPublishCharge(
    owner,
    BigInt(publishKind),
    BigInt(sizeClass),
    BigInt(cryptoSuite),
    { vaultAddress: requireVaultAddress(), ...readOptions },
  );
  return callWithDegradedTransportReadFallback(
    () => readCharge({ verify: true, priority: 'critical', cacheTtlMs: 0 }),
    () => readCharge(unverifiedCriticalChainReadOptions()),
  );
}

async function waitForPaymentCheckClaimConfirmation(provider, payment, beforeUser) {
  const intentId = paymentIntentId(payment);
  const asset = BigInt(payment.asset ?? 0n);
  const amount = BigInt(payment.amount ?? 0n);
  const beforeBalance = paymentAssetVaultBalance(beforeUser, asset);
  const expectedBalance = beforeBalance + amount;
  const deadline = Date.now() + PAYMENT_CHECK_CLAIM_CONFIRM_TIMEOUT_MS;
  let lastIntent = null;
  let lastUser = beforeUser;
  while (Date.now() <= deadline) {
    try {
      lastIntent = await readFreshReceiveIntentForOwnVaultAction(provider, intentId);
      lastUser = await readFreshConnectedVaultUserForOwnVaultAction(provider);
      const balance = paymentAssetVaultBalance(lastUser, asset);
      if (lastIntent?.exists === false && balance >= expectedBalance) {
        rememberConnectedVaultUser(lastUser);
        return { intent: lastIntent, user: lastUser, balance };
      }
    } catch (error) {
      if (!noteTonRpcRateLimit(error)) throw error;
    }
    await delay(PAYMENT_CHECK_CLAIM_POLL_MS);
  }
  if (lastIntent?.exists === false) {
    throw new Error('Payment check disappeared but Vault balance did not update');
  }
  throw paymentCheckClaimPendingError();
}

async function waitForPaymentCheckCancelConfirmation(provider, payment, beforeUser) {
  const intentId = paymentIntentId(payment);
  const asset = BigInt(payment.asset ?? 0n);
  const amount = BigInt(payment.amount ?? 0n);
  const beforeBalance = paymentAssetVaultBalance(beforeUser, asset);
  const expectedBalance = beforeBalance + amount;
  const deadline = Date.now() + PAYMENT_CHECK_CLAIM_CONFIRM_TIMEOUT_MS;
  let lastIntent = null;
  let lastUser = beforeUser;
  while (Date.now() <= deadline) {
    try {
      lastIntent = await readFreshReceiveIntentForCancel(provider, intentId);
      lastUser = await readFreshConnectedVaultUserForOwnVaultAction(provider);
      const balance = paymentAssetVaultBalance(lastUser, asset);
      if (lastIntent?.exists === false && balance >= expectedBalance) {
        rememberConnectedVaultUser(lastUser);
        return { intent: lastIntent, user: lastUser, balance };
      }
    } catch (error) {
      if (!noteTonRpcRateLimit(error)) throw error;
    }
    await delay(PAYMENT_CHECK_CLAIM_POLL_MS);
  }
  if (lastIntent?.exists === false) {
    throw new Error('Payment check disappeared but sender Vault balance was not restored');
  }
  throw paymentCheckCancelPendingError();
}

async function waitForPaymentCheckCreateConfirmation(provider, payment) {
  const intentId = paymentIntentId(payment);
  const deadline = Date.now() + PAYMENT_CHECK_CLAIM_CONFIRM_TIMEOUT_MS;
  while (Date.now() <= deadline) {
    try {
      const intent = await readFreshReceiveIntentForOwnVaultAction(provider, intentId);
      if (intent?.exists === true) return intent;
    } catch (error) {
      if (!noteTonRpcRateLimit(error)) throw error;
    }
    await delay(PAYMENT_CHECK_CLAIM_POLL_MS);
  }
  throw paymentCheckClaimPendingError('Payment check create submitted; Vault confirmation is still pending');
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
    || isTonRpcVerificationUnavailableError(error)
    || /Vault chain provider is not configured|Vault provider unavailable|verification unavailable/i.test(message);
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
    allowUnverifiedCriticalRead: options.allowUnverifiedCriticalRead === true,
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
    allowUnverifiedCriticalRead: options.allowUnverifiedCriticalRead === true,
    priority: options.priority,
    cacheTtlMs: options.cacheTtlMs,
  });
  return assertVaultGlobalMatchesConfig(global);
}

function unverifiedCriticalChainReadOptions() {
  return {
    verify: false,
    allowUnverifiedCriticalRead: true,
    priority: 'critical',
    cacheTtlMs: 0,
  };
}

async function readVaultGlobalForAthDeposit(provider, options = {}) {
  return loadConnectedVaultGlobal({
    provider,
    verify: options.verify !== false,
    allowUnverifiedCriticalRead: options.allowUnverifiedCriticalRead === true,
    priority: 'critical',
    cacheTtlMs: 0,
  });
}

async function readVaultGlobalForAthDepositWithFallback(provider) {
  return readVaultGlobalForAthDeposit(provider);
}

async function deriveVaultAthWalletAddressFromAthMaster(vault, options = {}) {
  const provider = await resolveAthMasterProvider();
  if (!provider?.getWalletAddress) throw new Error('ATHMaster provider cannot derive Vault ATH wallet');
  return provider.getWalletAddress(vault, {
    address: requireAthMasterAddress(),
    verify: options.verify !== false,
    allowUnverifiedCriticalRead: options.allowUnverifiedCriticalRead === true,
    priority: 'critical',
    cacheTtlMs: 0,
  });
}

async function deriveVaultAthWalletAddressFromAthMasterWithFallback(vault) {
  return deriveVaultAthWalletAddressFromAthMaster(vault);
}

async function requireVaultAthDepositRouteForOwnVaultAction(provider) {
  const vault = requireBasechainAddress(requireVaultAddress(), 'Vault');
  const global = await readVaultGlobalForAthDepositWithFallback(provider);
  const boundOfficialWallet = global.vault_ath_wallet_address
    ? requireBasechainAddress(global.vault_ath_wallet_address, 'Vault official ATH wallet')
    : null;
  if (!boundOfficialWallet) throw new Error('Vault official ATH wallet is not configured on this network');
  const derivedOfficialWallet = requireBasechainAddress(
    await deriveVaultAthWalletAddressFromAthMasterWithFallback(vault),
    'Vault derived ATH wallet',
  );
  if (boundOfficialWallet !== derivedOfficialWallet) {
    throw new Error('Vault official ATH wallet does not match ATHMaster-derived Vault wallet');
  }
  return { global, vault, vaultAthWalletAddress: boundOfficialWallet };
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
  // Critical reads are dual-provider verified while verification is actually
  // possible. When every verifier transport is dead or blocked for this
  // network (for example keyless toncenter answering 403), fail-closed
  // verification would freeze the whole messenger, so reads degrade to the
  // single live provider; entry/key payloads stay hash-bound to local
  // expectations and availability wins by explicit product policy.
  if (tonRpcVerificationStructurallyDegraded()) return unverifiedCriticalChainReadOptions();
  return { verify: true, priority: 'critical', cacheTtlMs: 0 };
}

function criticalCapsuleHubReadOptions(address) {
  return { capsuleHubAddress: address, ...criticalChainReadOptions() };
}

function capsuleHubMessageSyncReadOptions(address) {
  return {
    capsuleHubAddress: address,
    verify: false,
    allowUnverifiedCriticalRead: true,
    priority: 'messages',
    cacheTtlMs: 0,
    messageCacheTtlMs: 0,
  };
}

function requireManifestHashMatch(value, label) {
  const expectedManifest = uint256ConfigValue(requireVaultDeploymentManifestHash(), 'Vault deployment manifest hash');
  if (BigInt(value ?? 0n) !== expectedManifest) {
    throw new Error(`${label} deployment manifest hash does not match this app config`);
  }
}

function assertCapsuleHubGlobalMatchesConfig(global) {
  if (!global) throw new Error('CapsuleHub global state is missing');
  if (global.sealed !== true) {
    throw new Error('CapsuleHub is not sealed on this network');
  }
  if (global.vault_bound !== true) {
    throw new Error('CapsuleHub Vault route is not bound on this network');
  }
  requireManifestHashMatch(global.deployment_manifest_hash, 'CapsuleHub');
  const expectedVault = requireBasechainAddress(requireVaultAddress(), 'Vault');
  const boundVault = global.vault_address
    ? requireBasechainAddress(global.vault_address, 'CapsuleHub Vault')
    : null;
  if (boundVault !== expectedVault) {
    throw new Error('CapsuleHub Vault binding does not match this app config');
  }
  const feeAccumulatorAddress = configuredFeeAccumulatorAddress();
  const expectedFeeAccumulator = feeAccumulatorAddress
    ? requireBasechainAddress(feeAccumulatorAddress, 'FeeAccumulator')
    : null;
  if (expectedFeeAccumulator && global.fee_accumulator_address) {
    const boundFeeAccumulator = requireBasechainAddress(global.fee_accumulator_address, 'CapsuleHub FeeAccumulator');
    if (boundFeeAccumulator !== expectedFeeAccumulator) {
      throw new Error('CapsuleHub FeeAccumulator binding does not match this app config');
    }
  }
  return global;
}

async function requireCapsuleHubVaultRoute(global, options = {}) {
  const resolved = await resolveCapsuleHubProvider();
  if (!resolved?.provider?.getState) {
    throw new Error('CapsuleHub provider cannot verify Vault binding');
  }
  const providerAddress = requireBasechainAddress(resolved.address, 'CapsuleHub');
  const configuredAddress = configuredCapsuleHubAddress();
  const expectedCapsuleHub = configuredAddress
    ? requireBasechainAddress(configuredAddress, 'CapsuleHub')
    : null;
  const vaultBoundCapsuleHub = global?.capsule_hub_address
    ? requireBasechainAddress(global.capsule_hub_address, 'Vault CapsuleHub')
    : null;
  if (expectedCapsuleHub && providerAddress !== expectedCapsuleHub) {
    throw new Error('CapsuleHub provider address does not match this app config');
  }
  if (vaultBoundCapsuleHub && providerAddress !== vaultBoundCapsuleHub) {
    throw new Error('CapsuleHub provider address does not match Vault binding');
  }
  const readOptions = options.allowUnverifiedRead === true
    ? {
      capsuleHubAddress: providerAddress,
      verify: false,
      allowUnverifiedCriticalRead: true,
      priority: 'critical',
      cacheTtlMs: 0,
    }
    : criticalCapsuleHubReadOptions(providerAddress);
  return assertCapsuleHubGlobalMatchesConfig(await resolved.provider.getState(readOptions));
}

async function requireCapsuleHubVaultRouteForPublish(global) {
  return requireCapsuleHubVaultRoute(global);
}

async function requireProfileRegistryVaultRoute(global, options = {}) {
  const registry = requireVaultProfileAvatarRoute(global);
  const resolved = await resolveProfileRegistryProvider();
  if (!resolved?.provider?.getGlobal || !resolved.provider.getAthWalletAddress) {
    throw new Error('ProfileRegistry provider cannot verify Vault binding');
  }
  const resolvedRegistry = requireBasechainAddress(resolved.address, 'ProfileRegistry');
  if (resolvedRegistry !== registry) {
    throw new Error('ProfileRegistry provider address does not match Vault binding');
  }
  const readOptions = options.allowUnverifiedRead === true
    ? {
      verify: false,
      allowUnverifiedCriticalRead: true,
      priority: 'critical',
      cacheTtlMs: 0,
    }
    : criticalChainReadOptions();
  const [registryGlobal, derivedOfficialWallet] = await Promise.all([
    resolved.provider.getGlobal({ profileRegistryAddress: registry, ...readOptions }),
    resolved.provider.getAthWalletAddress(registry, { profileRegistryAddress: registry, ...readOptions }),
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

async function requireProfileRegistryVaultRouteForOwnVaultAction(global) {
  return requireProfileRegistryVaultRouteWithRetry(global);
}

async function requireProfileRegistryVaultRouteWithRetry(global, options = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= PROFILE_AVATAR_ROUTE_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await requireProfileRegistryVaultRoute(global, options);
    } catch (error) {
      if (!isTonRpcRecoverableReadError(error) && !noteTonRpcRateLimit(error)) throw error;
      lastError = error;
      const delayMs = PROFILE_AVATAR_ROUTE_RETRY_DELAYS_MS[attempt];
      if (!delayMs) break;
      await delay(delayMs);
    }
  }
  throw lastError ?? new Error('ProfileRegistry route verification is temporarily unavailable');
}

async function requireUsernameRegistryVaultRoute(global, options = {}) {
  const registry = requireVaultUsernameMintRoute(global);
  const provider = await resolveUsernameRegistryProvider();
  if (!provider?.getGlobal || !provider.getAthWalletAddress) {
    throw new Error('UsernameRegistry provider cannot verify Vault binding');
  }
  const expectedAthMaster = appConfig.ath?.masterAddress
    ? requireBasechainAddress(appConfig.ath.masterAddress, 'ATHMaster')
    : null;
  const athMasterProvider = expectedAthMaster ? await resolveAthMasterProvider() : null;
  const readOptions = options.allowUnverifiedRead === true
    ? {
      verify: false,
      allowUnverifiedCriticalRead: true,
      priority: 'critical',
      cacheTtlMs: 0,
    }
    : criticalChainReadOptions();
  const [registryGlobal, derivedOfficialWallet, appMasterOfficialWallet] = await Promise.all([
    provider.getGlobal({ address: registry, ...readOptions }),
    provider.getAthWalletAddress(registry, { address: registry, ...readOptions }),
    athMasterProvider?.getWalletAddress(registry, { address: expectedAthMaster, ...readOptions }) ?? null,
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
  if (expectedAthMaster) {
    const appDerivedWallet = requireBasechainAddress(appMasterOfficialWallet, 'ATHMaster derived UsernameRegistry ATH wallet');
    if (officialWallet !== appDerivedWallet) {
      throw new Error('UsernameRegistry official ATH wallet ATHMaster binding does not match this app config');
    }
  }
  let officialWalletData = null;
  try {
    officialWalletData = await createAthWalletTonRpcProvider({ athWalletAddress: officialWallet }).getWalletData({
      address: officialWallet,
      ...readOptions,
    });
  } catch (error) {
    if (!isAthWalletNotDeployedError(error)) throw error;
  }
  if (officialWalletData) {
    const officialWalletOwner = requireBasechainAddress(officialWalletData.owner_address, 'UsernameRegistry official ATH wallet owner');
    if (officialWalletOwner !== registry) {
      throw new Error('UsernameRegistry official ATH wallet owner does not match registry');
    }
    const walletAthMaster = officialWalletData.ath_master_address
      ? requireBasechainAddress(officialWalletData.ath_master_address, 'UsernameRegistry official ATH wallet ATHMaster')
      : null;
    if (expectedAthMaster && walletAthMaster !== expectedAthMaster) {
      throw new Error('UsernameRegistry official ATH wallet ATHMaster binding does not match this app config');
    }
  }
  return registry;
}

async function requireUsernameRegistryVaultRouteForOwnVaultAction(global) {
  return requireUsernameRegistryVaultRoute(global);
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
  const [user, global] = await Promise.all([
    readFreshConnectedVaultUser(provider),
    loadConnectedVaultGlobal({ provider, ...criticalChainReadOptions() }),
  ]);
  await requireProfileRegistryVaultRouteForOwnVaultAction(global);
  if (user.exists !== true || BigInt(user.current_key_id ?? 0n) === 0n) {
    throw new Error('Activate Platho account before setting an avatar');
  }
  requireVaultAuthSecretKey();
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
  const [user, global] = await Promise.all([
    readFreshConnectedVaultUserForOwnVaultAction(provider),
    readConnectedVaultGlobalForOwnVaultAction(provider),
  ]);
  await requireUsernameRegistryVaultRouteForOwnVaultAction(global);
  if (user.exists !== true || BigInt(user.current_key_id ?? 0n) === 0n) {
    throw new Error('Activate Platho account before minting a username');
  }
  requireVaultAuthSecretKey();
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
  const [global, rawUser] = await Promise.all([
    loadConnectedVaultGlobal({ provider, ...criticalChainReadOptions() }),
    readFreshConnectedVaultUser(provider),
  ]);
  const registry = await requireProfileRegistryVaultRouteForOwnVaultAction(global);
  const user = rememberConnectedVaultUser(rawUser);
  if (user.exists !== true || BigInt(user.current_key_id ?? 0n) === 0n) {
    throw new Error('Activate Platho account before setting an avatar');
  }
  requireVaultAuthSecretKey();
  const vaultTon = vaultTonBalanceNanotons(user);
  const vaultAth = nonNegativeBigInt(user.ath_balance ?? user.athBalance ?? 0n);
  if (vaultTon < PROFILE_AVATAR_VAULT_TON_CHARGE_NANOTONS) {
    throw new Error(`Not enough Vault TON: need ${formatTonNanotons(PROFILE_AVATAR_VAULT_TON_CHARGE_NANOTONS)} TON hold, have ${formatTonNanotons(vaultTon)} TON`);
  }
  if (vaultAth < PROFILE_AVATAR_PRICE_ATH) {
    throw new Error(`Not enough Vault ATH: need ${formatAthAtomic(PROFILE_AVATAR_PRICE_ATH)} ATH, have ${formatAthAtomic(vaultAth)} ATH`);
  }
  const submission = await submitVaultAuthExternalWithNonceConfirmation({
    provider,
    owner,
    user,
    buildExternal: (clientNonce) => buildVaultProfileAvatarExternalBoc({
      owner_wallet: owner,
      client_nonce: clientNonce,
      max_ton_charge: PROFILE_AVATAR_VAULT_TON_CHARGE_NANOTONS,
      profile_registry_address: registry,
      avatar_hash: uint256HexToBigInt(avatarHash, 'avatar_hash'),
      avatar_entry_id: avatarEntryId,
      avatar_stream_id: avatarStreamId,
      avatar_part_count: avatarPartCount,
      media_format: mediaFormat,
      signingSecretKey: requireVaultAuthSecretKey(),
      deploymentManifestHash: requireVaultDeploymentManifestHash(),
    }, {
      vaultAddress: requireVaultAddress(),
    }),
  });
  globalThis.plathoLastVaultProfileAvatarRegistration = {
    ...submission,
    owner,
    registry,
    avatarHash,
  };
  return submission;
}

async function readProfileAvatarVaultPaymentFinality(provider, submission = {}) {
  if (submission?.confirmationPending === true) {
    return {
      pending: true,
      pendingCount: null,
      reason: 'vault_nonce_confirmation_pending',
    };
  }
  const global = await loadConnectedVaultGlobal({ provider, ...criticalChainReadOptions() });
  const pendingCount = BigInt(global.pending_profile_avatar_payment_count ?? 0n);
  return {
    pending: pendingCount > 0n,
    pendingCount: pendingCount.toString(),
    reason: pendingCount > 0n ? 'vault_pending_profile_avatar_payment_count' : null,
  };
}

function profileAvatarPublishRecoveryKey(owner, avatarHash) {
  const normalizedOwner = requireBasechainAddress(owner, 'Avatar owner');
  return `${normalizedOwner}:${normalizeAvatarHashHex(avatarHash).toLowerCase()}`;
}

function profileAvatarRecoveryPublicDebug(job) {
  if (!job) return null;
  return {
    key: job.key,
    owner: shortAddress(job.owner),
    avatarHash: `${String(job.avatarHash).slice(0, 12)}...${String(job.avatarHash).slice(-8)}`,
    partCount: job.partCount,
    status: job.status,
    attempts: job.attempts,
    nextRetryAt: job.nextRetryAt ?? null,
    lastError: job.lastError ?? null,
    updatedAt: job.updatedAt ?? null,
    publishStateStatus: job.publishState?.status ?? null,
    submittedCount: job.publishState?.submittedCount ?? null,
    confirmedCount: job.publishState?.confirmedCount ?? null,
    registryPending: Boolean(job.registrySubmission),
  };
}

function refreshProfileAvatarRecoveryDebug() {
  globalThis.plathoProfileAvatarPublishRecoveries = [...profileAvatarPublishRecoveryJobs.values()]
    .map((job) => profileAvatarRecoveryPublicDebug(job));
}

function profileAvatarRecoveryAgeMs(job) {
  const started = Date.parse(job?.createdAt ?? job?.updatedAt ?? '');
  return Number.isFinite(started) ? Math.max(0, Date.now() - started) : null;
}

function serializableProfileAvatarRecovery(job) {
  if (!job?.owner || !job?.avatarHash || !job?.pendingPointer) return null;
  const streamIdHex = job.streamIdBytes
    ? `0x${bytesToHex(job.streamIdBytes)}`
    : job.pendingPointer?.avatarStreamId ?? null;
  return {
    version: 1,
    owner: requireBasechainAddress(job.owner, 'Avatar owner'),
    avatarHash: normalizeAvatarHashHex(job.avatarHash),
    streamIdHex,
    pendingPointer: {
      profileVersion: Number(job.pendingPointer.profileVersion ?? job.pendingPointer.profile_version ?? 0),
      avatarHash: normalizeAvatarHashHex(job.pendingPointer.avatarHash ?? job.pendingPointer.avatar_hash ?? job.avatarHash),
      avatarStreamId: streamIdHex,
      avatarPartCount: Number(job.pendingPointer.avatarPartCount ?? job.partCount ?? 0),
    },
    partCount: Number(job.partCount ?? job.pendingPointer.avatarPartCount ?? 0),
    mediaFormat: String(job.mediaFormat ?? PUBLIC_BODY_MEDIA_FORMATS.WEBP),
    status: String(job.status ?? 'pending'),
    createdAt: job.createdAt ?? new Date().toISOString(),
    updatedAt: job.updatedAt ?? new Date().toISOString(),
  };
}

function writeProfileAvatarPublishRecovery(job) {
  const payload = serializableProfileAvatarRecovery(job);
  const key = payload ? profileAvatarPublishRecoveryStorageKey(payload.owner, payload.avatarHash) : null;
  if (!key || !payload?.pendingPointer?.profileVersion || !payload.partCount) return;
  try {
    localStorageOrNull()?.setItem(key, JSON.stringify(payload));
  } catch {
    // The recovery hint is best effort; the paid publish remains on-chain.
  }
}

function readProfileAvatarPublishRecovery(owner, avatarHash) {
  const key = profileAvatarPublishRecoveryStorageKey(owner, avatarHash);
  if (!key) return null;
  try {
    const parsed = JSON.parse(localStorageOrNull()?.getItem(key) ?? 'null');
    if (!parsed || parsed.version !== 1) return null;
    const normalizedOwner = requireBasechainAddress(parsed.owner, 'Avatar owner');
    const normalizedHash = normalizeAvatarHashHex(parsed.avatarHash);
    if (!sameWalletAddress(normalizedOwner, owner)) return null;
    if (normalizedHash.toLowerCase() !== normalizeAvatarHashHex(avatarHash).toLowerCase()) return null;
    const createdAt = String(parsed.createdAt ?? parsed.updatedAt ?? new Date().toISOString());
    const ageMs = Date.now() - Date.parse(createdAt);
    if (Number.isFinite(ageMs) && ageMs > PROFILE_AVATAR_RECOVERY_LOCAL_PENDING_MS) {
      localStorageOrNull()?.removeItem(key);
      return null;
    }
    const partCount = Number(parsed.partCount ?? parsed.pendingPointer?.avatarPartCount ?? 0);
    const pendingPointer = {
      profileVersion: Number(parsed.pendingPointer?.profileVersion ?? parsed.pendingPointer?.profile_version ?? 0),
      avatarHash: normalizedHash,
      avatarStreamId: parsed.streamIdHex ?? parsed.pendingPointer?.avatarStreamId ?? null,
      avatarPartCount: partCount,
    };
    if (!Number.isSafeInteger(pendingPointer.profileVersion) || pendingPointer.profileVersion <= 0 || partCount <= 0) return null;
    return {
      key: profileAvatarPublishRecoveryKey(normalizedOwner, normalizedHash),
      owner: normalizedOwner,
      avatarHash: normalizedHash,
      streamIdBytes: pendingPointer.avatarStreamId ? hexToBytes(pendingPointer.avatarStreamId) : null,
      pendingPointer,
      partCount,
      mediaFormat: String(parsed.mediaFormat ?? PUBLIC_BODY_MEDIA_FORMATS.WEBP),
      status: 'persisted_pending',
      attempts: 0,
      createdAt,
      updatedAt: parsed.updatedAt ?? createdAt,
      persisted: true,
    };
  } catch {
    localStorageOrNull()?.removeItem(key);
    return null;
  }
}

function clearProfileAvatarPublishRecoveryStorage(owner, avatarHash) {
  const key = profileAvatarPublishRecoveryStorageKey(owner, avatarHash);
  if (!key) return;
  try {
    localStorageOrNull()?.removeItem(key);
  } catch {
    // Best effort.
  }
}

function rememberProfileAvatarPublishRecovery(context) {
  if (!context?.owner || !context?.avatarHash || !context?.pendingPointer) return null;
  const key = context.key ?? profileAvatarPublishRecoveryKey(context.owner, context.avatarHash);
  const existing = profileAvatarPublishRecoveryJobs.get(key) ?? {};
  const job = {
    ...existing,
    ...context,
    key,
    attempts: Number(existing.attempts ?? context.attempts ?? 0) || 0,
    createdAt: existing.createdAt ?? context.createdAt ?? new Date().toISOString(),
    status: context.status ?? existing.status ?? 'pending',
    updatedAt: new Date().toISOString(),
  };
  profileAvatarPublishRecoveryJobs.set(key, job);
  writeProfileAvatarPublishRecovery(job);
  refreshProfileAvatarRecoveryDebug();
  return job;
}

function profileAvatarPublishRecoveryFor(owner, avatarHash) {
  if (!owner || !avatarHash) return null;
  const key = profileAvatarPublishRecoveryKey(owner, avatarHash);
  const live = profileAvatarPublishRecoveryJobs.get(key);
  if (live) return live;
  const persisted = readProfileAvatarPublishRecovery(owner, avatarHash);
  if (!persisted) return null;
  profileAvatarPublishRecoveryJobs.set(key, persisted);
  refreshProfileAvatarRecoveryDebug();
  return persisted;
}

function clearProfileAvatarPublishRecovery(jobOrKey) {
  const key = typeof jobOrKey === 'string' ? jobOrKey : jobOrKey?.key;
  if (!key) return;
  const job = profileAvatarPublishRecoveryJobs.get(key);
  if (job?.timer) window.clearTimeout(job.timer);
  profileAvatarPublishRecoveryJobs.delete(key);
  if (job?.owner && job?.avatarHash) clearProfileAvatarPublishRecoveryStorage(job.owner, job.avatarHash);
  refreshProfileAvatarRecoveryDebug();
}

function profileAvatarRecoveryDelayMs(job) {
  const attempt = Math.max(0, Number(job?.attempts ?? 0) || 0);
  const index = Math.min(attempt, PROFILE_AVATAR_RECOVERY_RETRY_DELAYS_MS.length - 1);
  return PROFILE_AVATAR_RECOVERY_RETRY_DELAYS_MS[index];
}

function scheduleProfileAvatarPublishRecovery(context, delayMs = null) {
  const job = rememberProfileAvatarPublishRecovery(context);
  if (!job) return null;
  if (job.timer) window.clearTimeout(job.timer);
  const waitMs = Number.isFinite(Number(delayMs))
    ? Math.max(0, Math.floor(Number(delayMs)))
    : profileAvatarRecoveryDelayMs(job);
  job.nextRetryAt = new Date(Date.now() + waitMs).toISOString();
  job.status = 'scheduled';
  profileAvatarPublishRecoverySeq += 1;
  job.recoverySeq = profileAvatarPublishRecoverySeq;
  writeProfileAvatarPublishRecovery(job);
  job.timer = window.setTimeout(() => {
    const current = profileAvatarPublishRecoveryJobs.get(job.key);
    if (current) current.timer = null;
    runProfileAvatarPublishRecovery(job.key).catch((error) => {
      const latest = profileAvatarPublishRecoveryJobs.get(job.key);
      if (!latest) return;
      latest.lastError = shortUiErrorText(error, 'avatar recovery failed');
      latest.updatedAt = new Date().toISOString();
      if (isTonRpcRecoverableReadError(error) || noteTonRpcRateLimit(error)) {
        setProfileAvatarStatus('avatar still confirming');
        scheduleProfileAvatarPublishRecovery(latest);
      } else {
        setProfileAvatarStatus('avatar needs retry', 'error');
        refreshProfileAvatarRecoveryDebug();
      }
    });
  }, waitMs);
  refreshProfileAvatarRecoveryDebug();
  return job;
}

async function findProfileAvatarPublishedEntriesFromRecovery(job) {
  const pointer = job?.pendingPointer;
  if (!job?.owner || !pointer) return null;
  if (job.confirmed) return job.confirmed;
  let confirmed = await findConfirmedAvatarEntriesFromPublishState(job.owner, pointer, job.publishState)
    .catch((error) => {
      if (isTonRpcRecoverableReadError(error) || noteTonRpcRateLimit(error)) throw error;
      return null;
    });
  if (confirmed) return confirmed;
  confirmed = await findPublishedAvatarEntries(job.owner, pointer)
    .catch((error) => {
      if (isTonRpcRecoverableReadError(error) || noteTonRpcRateLimit(error)) throw error;
      return null;
    });
  if (confirmed) return confirmed;
  if (!job.publishState) return null;
  await retryUnconfirmedVaultPublishBroadcasts(job.publishState, {
    owner: job.owner,
    deadlineMs: PRIVATE_PUBLISH_BROADCAST_RETRY_DEADLINE_MS,
    readTimeoutMs: PRIVATE_PUBLISH_BROADCAST_RETRY_READ_TIMEOUT_MS,
    sendTimeoutMs: PRIVATE_PUBLISH_BROADCAST_RETRY_SEND_TIMEOUT_MS,
    queueTimeoutMs: PRIVATE_PUBLISH_BROADCAST_RETRY_QUEUE_TIMEOUT_MS,
  });
  await confirmCapsuleHubPublishEntries(job.publishState, {
    scanAvailableTransports: true,
    scanLimit: PROFILE_AVATAR_PUBLISH_CONFIRM_SCAN_LIMIT,
    deadlineMs: PROFILE_AVATAR_PUBLISH_CONFIRM_DEADLINE_MS,
    requestTimeoutMs: PRIVATE_PUBLISH_CONFIRM_RECOVERY_REQUEST_TIMEOUT_MS,
    queueTimeoutMs: PRIVATE_PUBLISH_CONFIRM_RECOVERY_QUEUE_TIMEOUT_MS,
  });
  confirmed = await findConfirmedAvatarEntriesFromPublishState(job.owner, pointer, job.publishState)
    .catch((error) => {
      if (isTonRpcRecoverableReadError(error) || noteTonRpcRateLimit(error)) throw error;
      return null;
    });
  if (confirmed) return confirmed;
  return findPublishedAvatarEntries(job.owner, pointer)
    .catch((error) => {
      if (isTonRpcRecoverableReadError(error) || noteTonRpcRateLimit(error)) throw error;
      return null;
    });
}

async function finalizeProfileAvatarUpdate({
  owner,
  avatarHash,
  confirmed,
  pendingPointer,
  partCount,
  mediaFormat,
  publishResult = null,
  payloads = [],
  streamIdBytes = null,
  registrySubmission = null,
}) {
  const currentPointer = await readCurrentProfileAvatarPointerFromChain(owner, { required: false });
  if (currentPointer?.avatarHash?.toLowerCase?.() === normalizeAvatarHashHex(avatarHash).toLowerCase()) {
    writeStoredProfileAvatarPointer(currentPointer, owner);
    if (confirmed?.imageUrl) setAvatarNode(profileAvatar, 'P', confirmed.imageUrl);
    setProfileAvatarStatus('avatar active', '');
    return {
      result: null,
      registryPointer: currentPointer,
      registryPending: false,
      alreadyActive: true,
    };
  }
  const streamIdValue = confirmed?.streamId !== undefined && confirmed?.streamId !== null
    ? BigInt(confirmed.streamId)
    : pendingPointer?.avatarStreamId
      ? BigInt(pendingPointer.avatarStreamId)
      : bytesToBigIntValue(streamIdBytes);
  setProfileAvatarStatus('signing avatar payment');
  const result = registrySubmission ?? await submitVaultProfileAvatarRegistration({
    owner,
    avatarHash,
    avatarEntryId: confirmed.firstEntryId,
    avatarStreamId: streamIdValue,
    avatarPartCount: BigInt(partCount),
    mediaFormat,
  });
  let registryPointer = null;
  let registryError = null;
  let profilePaymentFinality = null;
  let profilePaymentFinalityError = null;
  try {
    setProfileAvatarStatus('confirming registry');
    registryPointer = await waitForProfileAvatarRegistryUpdate(owner, avatarHash);
    writeStoredProfileAvatarPointer(registryPointer, owner);
    if (confirmed?.imageUrl) setAvatarNode(profileAvatar, 'P', confirmed.imageUrl);
    try {
      const provider = await resolveVaultChainProvider();
      profilePaymentFinality = await readProfileAvatarVaultPaymentFinality(provider, result);
    } catch (error) {
      profilePaymentFinalityError = error;
      if (!isTonRpcRecoverableReadError(error) && !noteTonRpcRateLimit(error)) console.error(error);
    }
    if (profilePaymentFinality?.pending === true) {
      setProfileAvatarStatus('active, Vault payment pending');
    } else {
      setProfileAvatarStatus('avatar active', '');
    }
  } catch (error) {
    registryError = error;
    if (isTonRpcRecoverableReadError(error) || noteTonRpcRateLimit(error)) {
      setProfileAvatarStatus('avatar payment submitted, confirming');
      return {
        result,
        registryPointer: null,
        registryPending: true,
        registryError,
        profilePaymentFinality,
      };
    }
    console.error(error);
    await refreshOwnProfileAvatar().catch((refreshError) => console.error(refreshError));
    setProfileAvatarStatus('avatar not active yet', 'error');
  }
  globalThis.plathoLastProfileAvatarUpdate = {
    avatarHash,
    streamId: pendingPointer?.avatarStreamId ?? (streamIdBytes ? `0x${bytesToHex(streamIdBytes)}` : null),
    parts: partCount,
    firstEntryId: confirmed.firstEntryId.toString(),
    payloads,
    publishResult,
    result,
    registryPointer,
    registryPending: !registryPointer,
    registryError: registryError ? String(registryError?.message ?? registryError) : null,
    profilePaymentFinality,
    profilePaymentPending: profilePaymentFinality?.pending === true,
    profilePaymentFinalityError: profilePaymentFinalityError ? String(profilePaymentFinalityError?.message ?? profilePaymentFinalityError) : null,
  };
  return {
    result,
    registryPointer,
    registryPending: !registryPointer,
    registryError,
    profilePaymentFinality,
  };
}

async function runProfileAvatarPublishRecovery(key) {
  const job = profileAvatarPublishRecoveryJobs.get(key);
  if (!job) return null;
  if (!plathoWallet?.address || !sameWalletAddress(plathoWallet.address, job.owner)) {
    scheduleProfileAvatarPublishRecovery(job, profileAvatarRecoveryDelayMs(job));
    return null;
  }
  job.attempts = (Number(job.attempts ?? 0) || 0) + 1;
  job.status = 'checking';
  job.updatedAt = new Date().toISOString();
  writeProfileAvatarPublishRecovery(job);
  refreshProfileAvatarRecoveryDebug();
  setProfileAvatarStatus('avatar still confirming');
  const confirmed = await findProfileAvatarPublishedEntriesFromRecovery(job);
  if (!confirmed) {
    const ageMs = profileAvatarRecoveryAgeMs(job);
    if (!job.publishState && ageMs !== null && ageMs >= PROFILE_AVATAR_RECOVERY_LOCAL_PENDING_MS) {
      clearProfileAvatarPublishRecovery(job);
      setProfileAvatarStatus('avatar needs retry', 'error');
      return null;
    }
    job.status = 'pending';
    job.lastError = null;
    job.updatedAt = new Date().toISOString();
    scheduleProfileAvatarPublishRecovery(job);
    return null;
  }
  job.status = 'registering';
  job.updatedAt = new Date().toISOString();
  refreshProfileAvatarRecoveryDebug();
  const finality = await finalizeProfileAvatarUpdate({
    owner: job.owner,
    avatarHash: job.avatarHash,
    confirmed,
    pendingPointer: job.pendingPointer,
    partCount: job.partCount,
    mediaFormat: job.mediaFormat,
    publishResult: job.publishResult,
    payloads: job.payloads ?? [],
    streamIdBytes: job.streamIdBytes ?? null,
    registrySubmission: job.registrySubmission ?? null,
  });
  if (finality?.registryPending === true) {
    const pendingJob = rememberProfileAvatarPublishRecovery({
      ...job,
      confirmed,
      registrySubmission: finality.result ?? job.registrySubmission ?? null,
      status: 'registry_pending',
      lastError: finality.registryError ? shortUiErrorText(finality.registryError, 'registry pending') : null,
    });
    scheduleProfileAvatarPublishRecovery(pendingJob);
    return finality;
  }
  clearProfileAvatarPublishRecovery(job);
  return finality;
}

async function submitVaultUsernameMint({ owner, username, priceAtomic }) {
  requireNoPendingServiceWorkerAppShellReload();
  const provider = await resolveVaultChainProvider();
  const [global, rawUser] = await Promise.all([
    readConnectedVaultGlobalForOwnVaultAction(provider),
    readFreshConnectedVaultUserForOwnVaultAction(provider),
  ]);
  const registry = await requireUsernameRegistryVaultRouteForOwnVaultAction(global);
  const user = rememberConnectedVaultUser(rawUser);
  if (user.exists !== true || BigInt(user.current_key_id ?? 0n) === 0n) {
    throw new Error('Activate Platho account before minting a username');
  }
  requireVaultAuthSecretKey();
  const vaultTon = vaultTonBalanceNanotons(user);
  const vaultAth = nonNegativeBigInt(user.ath_balance ?? user.athBalance ?? 0n);
  if (vaultTon < USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS) {
    throw new Error(`Not enough Vault TON: need ${formatTonNanotons(USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS)} TON hold, have ${formatTonNanotons(vaultTon)} TON`);
  }
  if (vaultAth < priceAtomic) {
    throw new Error(`Not enough Vault ATH: need ${formatAthAtomic(priceAtomic)} ATH, have ${formatAthAtomic(vaultAth)} ATH`);
  }
  const submission = await submitVaultAuthExternalWithNonceConfirmation({
    provider,
    owner,
    user,
    buildExternal: (clientNonce) => buildVaultUsernameMintExternalBoc({
      owner_wallet: owner,
      client_nonce: clientNonce,
      max_ton_charge: USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS,
      username_registry_address: registry,
      username,
      signingSecretKey: requireVaultAuthSecretKey(),
      deploymentManifestHash: requireVaultDeploymentManifestHash(),
    }, {
      vaultAddress: requireVaultAddress(),
    }),
  });
  globalThis.plathoLastVaultUsernameMint = {
    ...submission,
    owner,
    registry,
    username,
    priceAtomic,
  };
  return submission;
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
      ton_balance: vaultUser && vaultUser.exists !== true ? 0n : vaultUser?.exists === true ? nonNegativeBigInt(vaultUser.ton_balance) : null,
      ath_balance: vaultUser && vaultUser.exists !== true ? 0n : vaultUser?.exists === true ? nonNegativeBigInt(vaultUser.ath_balance) : null,
    },
  };
  renderVaultCards([]);
  refreshWalletTonProfileStatus();
  refreshVaultMoveWidget();
  if (vaultUser && typeof vaultUser === 'object') {
    markNavVaultBalanceReady();
  } else {
    markNavVaultBalancePending('vault user unavailable', { retry: true });
  }
}

function resetVaultPocketState() {
  vaultPocketState = {
    wallet: { ton_balance: null, ath_balance: null },
    vault: { ton_balance: null, ath_balance: null },
  };
  markNavVaultBalanceIdle();
  refreshWalletTonProfileStatus();
  refreshVaultMoveWidget();
}

function applyVaultUserPocketState(user) {
  vaultPocketState = {
    wallet: vaultPocketState.wallet ?? { ton_balance: null, ath_balance: null },
    vault: {
      ton_balance: user?.exists === true ? nonNegativeBigInt(user.ton_balance) : 0n,
      ath_balance: user?.exists === true ? nonNegativeBigInt(user.ath_balance) : 0n,
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
  markNavVaultBalanceReady();
  refreshComposerCostStatus();
  refreshComposerPublishPolicy();
  refreshMessageActionStatuses({ keepSyncStatus: true });
}

async function refreshVaultNavBalanceInBackground(options = {}) {
  if (!plathoWallet?.address) {
    delete globalThis.plathoVaultBinding;
    resetVaultPocketState();
    return null;
  }
  if (navVaultBalanceRefreshPromise) return navVaultBalanceRefreshPromise;
  markNavVaultBalancePending(options.fromRetry ? 'retrying' : 'refreshing');
  navVaultBalanceRefreshPromise = (async () => {
    try {
      const user = await loadConnectedVaultUser({ verify: true, priority: 'critical', cacheTtlMs: 0 });
      applyVaultUserPocketState(user);
      return user;
    } catch (error) {
      markNavVaultBalanceRetryNeeded('balance unavailable');
      throw error;
    }
  })();
  try {
    return await navVaultBalanceRefreshPromise;
  } finally {
    navVaultBalanceRefreshPromise = null;
  }
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

function navVaultBalanceHasKnownValue() {
  return vaultPocketState.vault?.ton_balance !== null
    && vaultPocketState.vault?.ton_balance !== undefined
    && vaultPocketState.vault?.ath_balance !== null
    && vaultPocketState.vault?.ath_balance !== undefined;
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
  if (asset === 'TON' && source === 'vault') {
    return balance > VAULT_RESERVES_NANOTONS.withdrawTonExec
      ? balance - VAULT_RESERVES_NANOTONS.withdrawTonExec
      : 0n;
  }
  return balance;
}

function refreshNavVaultBalance() {
  const loading = plathoWallet?.address && navVaultBalanceState.status === 'pending' && !navVaultBalanceHasKnownValue();
  if (loading) {
    navVaultTonBalances.forEach((node, index) => {
      node.hidden = false;
      node.classList.toggle('is-loading', index === 0);
      node.classList.toggle('is-placeholder', index > 0);
      node.textContent = index > 0 ? '\u00a0' : '';
      if (index === 0) {
        node.title = navVaultBalanceLoadingLabel();
        node.setAttribute('aria-label', navVaultBalanceLoadingLabel());
      } else {
        node.removeAttribute('aria-label');
        node.removeAttribute('title');
      }
    });
    for (const node of navVaultAthBalances) {
      node.classList.remove('is-loading');
      node.classList.add('is-placeholder');
      node.hidden = false;
      node.textContent = '\u00a0';
      node.setAttribute('aria-hidden', 'true');
      node.removeAttribute('aria-label');
      node.removeAttribute('title');
    }
    return;
  }
  const tonBalance = `${vaultMoveFormattedBalance('vault', 'TON')} TON`;
  const athBalance = `${vaultMoveFormattedBalance('vault', 'ATH')} ATH`;
  for (const node of navVaultTonBalances) {
    node.classList.remove('is-loading');
    node.classList.remove('is-placeholder');
    node.hidden = false;
    node.removeAttribute('aria-hidden');
    node.removeAttribute('aria-label');
    node.removeAttribute('title');
    setText(node, tonBalance);
  }
  for (const node of navVaultAthBalances) {
    node.classList.remove('is-loading');
    node.classList.remove('is-placeholder');
    node.hidden = false;
    node.removeAttribute('aria-hidden');
    node.removeAttribute('aria-label');
    node.removeAttribute('title');
    setText(node, athBalance);
  }
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
    loadConnectedVaultUser({ verify: true, priority: 'critical', cacheTtlMs: 0 }),
    loadConnectedVaultGlobal({ verify: true, priority: 'critical', cacheTtlMs: 0 }),
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

async function readAthBurnFlushState() {
  const readOptions = criticalChainReadOptions();
  const [usernameResult, profileResult] = await Promise.allSettled([
    resolveUsernameRegistryProvider()
      .then((provider) => provider.getGlobal({
        address: requireUsernameRegistryAddress(),
        ...readOptions,
      })),
    resolveProfileRegistryProvider()
      .then(({ provider, address }) => provider.getGlobal({
        address,
        ...readOptions,
      })),
  ]);
  const next = {
    username_burn_due_ath: null,
    profile_burn_due_ath: null,
    username_pending_burn_flush_count: null,
    profile_pending_burn_flush_count: null,
    busy: athFlushState.busy,
    error: null,
  };
  if (usernameResult.status === 'fulfilled') {
    next.username_burn_due_ath = nonNegativeBigInt(usernameResult.value?.burn_due_ath);
    next.username_pending_burn_flush_count = nonNegativeBigInt(usernameResult.value?.pending_burn_flush_count);
  } else {
    noteTonRpcRateLimit(usernameResult.reason);
  }
  if (profileResult.status === 'fulfilled') {
    next.profile_burn_due_ath = nonNegativeBigInt(profileResult.value?.burn_due_ath);
    next.profile_pending_burn_flush_count = nonNegativeBigInt(profileResult.value?.pending_burn_flush_count);
  } else {
    noteTonRpcRateLimit(profileResult.reason);
  }
  if (usernameResult.status === 'rejected' && profileResult.status === 'rejected') {
    throw usernameResult.reason ?? profileResult.reason ?? new Error('ATH flush state is unavailable');
  }
  return next;
}

async function refreshAthFlushState() {
  renderAthFlushStatus();
  try {
    athFlushState = await readAthBurnFlushState();
    renderAthFlushStatus();
    return athFlushState;
  } catch (error) {
    athFlushState = {
      ...athFlushState,
      busy: false,
      error: String(error?.message ?? error ?? 'ATH flush state unavailable'),
    };
    renderAthFlushStatus();
    throw error;
  }
}

async function refreshAthProtocolStats() {
  renderAthProfileStats();
  try {
    const provider = await resolveAthMasterProvider();
    if (!provider?.getJettonData) {
      await refreshAthFlushState();
      return athProtocolState;
    }
    const data = await provider.getJettonData({ address: requireAthMasterAddress() });
    athProtocolState = {
      total_supply: data?.total_supply === null || data?.total_supply === undefined
        ? null
        : nonNegativeBigInt(data.total_supply),
    };
    await refreshAthFlushState();
    renderAthProfileStats();
    return athProtocolState;
  } catch (error) {
    noteTonRpcRateLimit(error);
    refreshAthFlushState().catch(() => {});
    return athProtocolState;
  }
}

function queueAthProtocolStatsRefresh() {
  refreshAthProtocolStats().catch(() => {});
  for (const delayMs of VAULT_POST_TRANSACTION_REFRESH_DELAYS_MS) {
    setTimeout(() => refreshAthProtocolStats().catch(() => {}), delayMs);
  }
}

function queueAthFlushPostTransactionRefresh() {
  refreshAthProtocolStats().catch(() => {});
  for (const delayMs of ATH_FLUSH_POST_TRANSACTION_REFRESH_DELAYS_MS) {
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
  markNavVaultBalancePending('transaction submitted', {
    resetRetry: true,
    retry: true,
    retryDelayMs: 2_000,
  });
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
  markNavVaultBalancePending('wallet changed', {
    resetRetry: true,
    retry: true,
    retryDelayMs: 0,
  });
  refreshVaultNow({ includeActivation: true, includeStats: true }).catch((error) => {
    if (noteTonRpcRateLimit(error)) setVaultStatus('RPC busy, retrying');
    if (!isExpectedVaultProviderUnavailable(error)) console.error(error);
  });
}

async function resolveUsernameRegistryProvider() {
  const provider = globalThis.plathoUsernameRegistryProvider
    ?? createUsernameRegistryTonRpcProvider({ usernameRegistryAddress: requireUsernameRegistryAddress() });
  if (
    !provider?.getUsernamePrice
    || !provider?.getNameRecordByUsername
    || !provider?.getNameRecord
    || !provider?.getUsernameItemAddress
    || !provider?.getGlobal
    || !provider?.getAthWalletAddress
  ) {
    throw new Error('UsernameRegistry provider is not configured');
  }
  return provider;
}

async function readUsernameMintPriceForOwnVaultAction(provider, registry, username) {
  const length = String(username ?? '').length;
  const price = await provider.getUsernamePrice(length, {
    address: registry,
    ...criticalChainReadOptions(),
  });
  const priceAtomic = BigInt(price?.price_ath_atomic ?? 0n);
  if (price?.valid_length !== true || priceAtomic <= 0n) {
    throw new Error('UsernameRegistry rejected this username length');
  }
  return priceAtomic;
}

async function readUsernameMintAvailabilityForOwnVaultAction(provider, registry, username) {
  if (!provider?.getNameRecordByUsername || !provider?.getPendingMint) {
    throw new Error('UsernameRegistry provider cannot verify username availability');
  }
  const readOptions = { address: registry, ...criticalChainReadOptions() };
  const nameHash = await computeUsernameNameHash(username);
  const [record, pending] = await Promise.all([
    provider.getNameRecordByUsername(username, readOptions),
    provider.getPendingMint(nameHash, readOptions),
  ]);
  if (record?.exists === true) {
    throw new Error('Username is already registered');
  }
  if (pending?.exists === true) {
    throw new Error('Username mint is already pending');
  }
  return { nameHash, record, pending };
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

async function waitForPlathoUsernameOwnership(label, ownerWallet, options = {}) {
  const expectedOwner = requireBasechainAddress(ownerWallet, 'Expected username owner');
  const attempts = Math.max(1, Number(options.attempts ?? USERNAME_MINT_CONFIRM_ATTEMPTS));
  const delayMs = Math.max(250, Number(options.delayMs ?? USERNAME_MINT_CONFIRM_DELAY_MS));
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const identity = await resolvePlathoUsernameOwner(label);
      if (sameWalletAddress(identity.ownerWallet, expectedOwner)) return identity;
      throw new Error(`${identity.label} belongs to another wallet`);
    } catch (error) {
      lastError = error;
      await delay(delayMs);
    }
  }
  throw lastError ?? new Error('Username mint is not visible on-chain yet');
}

async function autoLinkMintedUsername(username, ownerWallet, options = {}) {
  const owner = requireBasechainAddress(ownerWallet, 'Connected wallet');
  setUsernameMintStatus(`${username}.ath finalizing`);
  const identity = await waitForPlathoUsernameOwnership(username, owner, options);
  if (!plathoWallet?.address || !sameWalletAddress(plathoWallet.address, owner)) return null;
  const linked = {
    mode: WALLET_DISPLAY_MODES.PLATHO_NFT,
    label: identity.label,
    verified_at: Date.now(),
  };
  writeLinkedPlathoUsername(linked, owner);
  writeWalletDisplayIdentity(linked, owner);
  if (walletDisplayModeSelect) walletDisplayModeSelect.value = WALLET_DISPLAY_MODES.PLATHO_NFT;
  clearPendingUsernameMint(username, owner);
  setUsernameMintStatus(`Linked ${identity.label}`, '');
  renderWalletIdentity();
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
  await assertVaultKeyRecordMatchesOwner(walletAddress, keyRecord, currentKeyId);
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
  markNavVaultBalancePending('wallet transaction submitted', {
    resetRetry: true,
    retry: true,
    retryDelayMs: 2_000,
  });
  return result;
}

async function submitVaultAuthExternalWithNonceConfirmation({ provider, owner, user, buildExternal }) {
  let clientNonce = BigInt(user.publish_nonce ?? user.publishNonce ?? 0n);
  const nonceFloor = vaultPublishNonceFloor(owner);
  if (clientNonce < nonceFloor) clientNonce = nonceFloor;
  const external = await buildExternal(clientNonce);
  let result = null;
  let ambiguousBroadcast = false;
  let broadcastError = null;
  try {
    result = await sendVaultExternalBoc(external);
    raiseVaultPublishNonceFloor(owner, clientNonce + 1n);
  } catch (error) {
    if (!isAmbiguousTonRpcBroadcastError(error)) throw error;
    ambiguousBroadcast = true;
    broadcastError = error;
    raiseVaultPublishNonceFloor(owner, clientNonce + 1n);
  }
  let nonceWaitError = null;
  try {
    await waitForVaultPublishNonce(provider, owner, clientNonce + 1n);
  } catch (error) {
    if (ambiguousBroadcast || result) {
      nonceWaitError = error;
    } else {
      throw error;
    }
  }
  return {
    external,
    result,
    clientNonce,
    ambiguousBroadcast,
    broadcastError: broadcastError ? String(broadcastError?.message ?? broadcastError) : null,
    confirmationPending: Boolean(nonceWaitError),
    nonceWaitError: nonceWaitError ? String(nonceWaitError?.message ?? nonceWaitError) : null,
  };
}

async function readFreshPendingAthWithdrawalForOwnVaultAction(provider, owner, clientNonce, options = {}) {
  if (!provider?.getPendingAthWithdrawalFor) throw new Error('Vault provider cannot confirm ATH withdrawal');
  return provider.getPendingAthWithdrawalFor(owner, clientNonce, {
    vaultAddress: requireVaultAddress(),
    verify: options.verify !== false,
    allowUnverifiedCriticalRead: options.allowUnverifiedCriticalRead === true,
    priority: 'critical',
    cacheTtlMs: 0,
  });
}

async function readPendingAthWithdrawalForOwnVaultAction(provider, owner, clientNonce) {
  return callWithVerificationUnavailableReadFallback(
    () => readFreshPendingAthWithdrawalForOwnVaultAction(provider, owner, clientNonce),
    () => readFreshPendingAthWithdrawalForOwnVaultAction(provider, owner, clientNonce, unverifiedCriticalChainReadOptions()),
  );
}

async function waitForVaultAthWithdrawalCompletion(provider, owner, clientNonce) {
  if (!provider?.getPendingAthWithdrawalFor) {
    return {
      pendingWithdrawal: null,
      athTransferPending: true,
      pendingWithdrawalError: 'Vault provider cannot confirm ATH withdrawal',
    };
  }
  const deadline = Date.now() + VAULT_ATH_WITHDRAW_CONFIRM_TIMEOUT_MS;
  let pendingWithdrawal = null;
  let pendingWithdrawalError = null;
  while (Date.now() <= deadline) {
    try {
      pendingWithdrawal = await readPendingAthWithdrawalForOwnVaultAction(provider, owner, clientNonce);
      pendingWithdrawalError = null;
      if (pendingWithdrawal?.exists === false) {
        return {
          pendingWithdrawal,
          athTransferPending: false,
          pendingWithdrawalError: null,
        };
      }
    } catch (error) {
      pendingWithdrawalError = error;
      if (!noteTonRpcRateLimit(error)) break;
    }
    await delay(VAULT_ATH_WITHDRAW_POLL_MS);
  }
  return {
    pendingWithdrawal,
    athTransferPending: true,
    pendingWithdrawalError: pendingWithdrawalError ? String(pendingWithdrawalError?.message ?? pendingWithdrawalError) : null,
  };
}

async function submitVaultReceiveIntentExternal(type, params, options = {}) {
  if (options.allowPendingServiceWorkerUpdate !== true) {
    requireNoPendingServiceWorkerAppShellReload();
  }
  const provider = options.provider ?? await resolveVaultChainProvider();
  const owner = requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  const user = options.user ?? await readFreshConnectedVaultUser(provider);
  if (user.exists !== true || BigInt(user.current_key_id ?? 0n) === 0n) {
    throw new Error('Activate Platho account before using payment checks');
  }
  requireVaultAuthSecretKey();
  let clientNonce = BigInt(user.publish_nonce ?? user.publishNonce ?? 0n);
  const nonceFloor = vaultPublishNonceFloor(owner);
  if (clientNonce < nonceFloor) clientNonce = nonceFloor;
  const external = await buildVaultReceiveIntentExternalBoc(type, {
    ...params,
    owner_wallet: owner,
    client_nonce: clientNonce,
    signingSecretKey: requireVaultAuthSecretKey(),
  }, {
    vaultAddress: requireVaultAddress(),
    deploymentManifestHash: requireVaultDeploymentManifestHash(),
  });
  let result = null;
  let ambiguousBroadcast = false;
  let broadcastError = null;
  try {
    result = await sendVaultExternalBoc(external);
    raiseVaultPublishNonceFloor(owner, clientNonce + 1n);
  } catch (error) {
    if (!isAmbiguousTonRpcBroadcastError(error)) throw error;
    ambiguousBroadcast = true;
    broadcastError = error;
    raiseVaultPublishNonceFloor(owner, clientNonce + 1n);
  }
  globalThis.plathoLastVaultReceiveIntentExternal = {
    type,
    params,
    external,
    result,
    clientNonce,
    ambiguousBroadcast,
    broadcastError: broadcastError ? String(broadcastError?.message ?? broadcastError) : null,
  };
  let nonceWaitError = null;
  try {
    await waitForVaultPublishNonce(provider, owner, clientNonce + 1n);
  } catch (error) {
    if (ambiguousBroadcast || result) {
      nonceWaitError = error;
    } else {
      throw error;
    }
  }
  return {
    external,
    result,
    clientNonce,
    ambiguousBroadcast,
    confirmationPending: Boolean(nonceWaitError),
    nonceWaitError: nonceWaitError ? String(nonceWaitError?.message ?? nonceWaitError) : null,
  };
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
  markNavVaultBalancePending('ATH transaction submitted', {
    resetRetry: true,
    retry: true,
    retryDelayMs: 2_000,
  });
  return result;
}

async function submitVaultDepositTon() {
  const amount = await requestTonAmountNanotons('Move TON to Vault', 'Moves TON from your connected Platho wallet into the Vault pocket.');
  if (amount === null) return null;
  return submitVaultDepositTonAmount(amount);
}

async function submitVaultDepositTonAmount(amount) {
  const provider = await resolveVaultChainProvider();
  const user = await readFreshConnectedVaultUser(provider);
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
  requireNoPendingServiceWorkerAppShellReload();
  const provider = await resolveVaultChainProvider();
  const owner = requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  const user = await loadConnectedVaultUser({
    provider,
    verify: true,
    priority: 'critical',
    cacheTtlMs: 0,
  });
  if (user.exists !== true || BigInt(user.current_key_id ?? 0n) === 0n || BigInt(user.auth_pubkey ?? 0n) === 0n) {
    throw new Error('Unlock and activate your Platho account before moving TON from Vault');
  }
  const totalDebit = BigInt(amount) + VAULT_RESERVES_NANOTONS.withdrawTonExec;
  if (BigInt(user.ton_balance ?? 0n) < totalDebit) {
    throw new Error('Vault TON balance is too low for amount plus transfer reserve');
  }
  const result = await submitVaultAuthExternalWithNonceConfirmation({
    provider,
    owner,
    user,
    buildExternal: (clientNonce) => buildVaultWithdrawTonExternalBoc({
      owner_wallet: owner,
      amount,
      recipient: owner,
      client_nonce: clientNonce,
      signingSecretKey: requireVaultAuthSecretKey(),
    }, {
      vaultAddress: requireVaultAddress(),
      deploymentManifestHash: requireVaultDeploymentManifestHash(),
    }),
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
  const provider = await resolveVaultChainProvider();
  setVaultStatus('checking ATH Vault route');
  const { vault } = await requireVaultAthDepositRouteForOwnVaultAction(provider);
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
  requireNoPendingServiceWorkerAppShellReload();
  const provider = await resolveVaultChainProvider();
  const owner = requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  const user = await loadConnectedVaultUser({
    provider,
    verify: true,
    priority: 'critical',
    cacheTtlMs: 0,
  });
  if (user.exists !== true || BigInt(user.current_key_id ?? 0n) === 0n || BigInt(user.auth_pubkey ?? 0n) === 0n) {
    throw new Error('Unlock and activate your Platho account before moving ATH from Vault');
  }
  if (BigInt(user.ath_balance ?? 0n) < BigInt(amount)) {
    throw new Error('Vault ATH balance is too low');
  }
  if (BigInt(user.ton_balance ?? 0n) < VAULT_RESERVES_NANOTONS.withdrawAthMinValue) {
    throw new Error('Vault TON balance is too low for ATH transfer reserve');
  }
  const result = await submitVaultAuthExternalWithNonceConfirmation({
    provider,
    owner,
    user,
    buildExternal: (clientNonce) => buildVaultWithdrawAthExternalBoc({
      owner_wallet: owner,
      amount,
      recipient: owner,
      client_nonce: clientNonce,
      signingSecretKey: requireVaultAuthSecretKey(),
    }, {
      vaultAddress: requireVaultAddress(),
      deploymentManifestHash: requireVaultDeploymentManifestHash(),
    }),
  });
  if (result.confirmationPending) {
    setVaultStatus('ATH transfer pending');
    return { ...result, athTransferPending: true, pendingWithdrawal: null };
  }
  setVaultStatus('ATH transfer pending');
  const athWithdrawal = await waitForVaultAthWithdrawalCompletion(provider, owner, result.clientNonce);
  setVaultStatus(athWithdrawal.athTransferPending ? 'ATH transfer pending' : 'move submitted');
  return { ...result, ...athWithdrawal };
}

async function submitUsernameMint() {
  const username = await requestUsernameMintName();
  if (!username) return null;
  const owner = requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  const registry = requireBasechainAddress(requireUsernameRegistryAddress(), 'UsernameRegistry');
  const provider = await resolveUsernameRegistryProvider();
  const priceAtomic = await readUsernameMintPriceForOwnVaultAction(provider, registry, username);
  setUsernameMintStatus('checking availability');
  await readUsernameMintAvailabilityForOwnVaultAction(provider, registry, username);
  assertNoPendingUsernameMintRetry(username, owner);
  await assertVaultUsernameMintCanStart(owner, username, priceAtomic);
  setUsernameMintStatus('signing through Vault');
  const result = await submitVaultUsernameMint({
    owner,
    username,
    priceAtomic,
  });
  rememberPendingUsernameMint(username, owner, result);
  setUsernameMintStatus(result.confirmationPending === true ? 'mint submitted, finalizing' : 'mint finalizing');
  autoLinkMintedUsername(username, owner, {
    attempts: USERNAME_MINT_BACKGROUND_CONFIRM_ATTEMPTS,
    delayMs: USERNAME_MINT_BACKGROUND_CONFIRM_DELAY_MS,
  }).catch((error) => {
    setUsernameMintStatus('mint submitted; link after sync');
    console.error(error);
  });
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

async function submitAthDueFlush() {
  requireNoPendingServiceWorkerAppShellReload();
  requirePlathoWallet();
  athFlushState = {
    ...athFlushState,
    busy: true,
    error: null,
  };
  renderAthFlushStatus();
  const state = await readAthBurnFlushState();
  athFlushState = {
    ...state,
    busy: true,
    error: null,
  };
  renderAthFlushStatus();
  const messages = [];
  const flushedBuckets = [];
  const usernameDue = nonNegativeBigInt(state.username_burn_due_ath);
  const profileDue = nonNegativeBigInt(state.profile_burn_due_ath);
  const usernamePending = nonNegativeBigInt(state.username_pending_burn_flush_count);
  const profilePending = nonNegativeBigInt(state.profile_pending_burn_flush_count);
  if (usernameDue > 0n && usernamePending === 0n) {
    messages.push(createUsernameRegistryMessage('FlushBurnAthDue', {
      query_id: nextQueryId(),
    }, {
      usernameRegistryAddress: requireUsernameRegistryAddress(),
      valueNanotons: REGISTRY_BURN_FLUSH_MESSAGE_VALUE_NANOTONS,
    }));
    flushedBuckets.push('username');
  }
  if (profileDue > 0n && profilePending === 0n) {
    messages.push(createProfileRegistryMessage('FlushProfileBurnAthDue', {
      query_id: nextQueryId(),
    }, {
      profileRegistryAddress: requireProfileRegistryAddress(),
      valueNanotons: REGISTRY_BURN_FLUSH_MESSAGE_VALUE_NANOTONS,
    }));
    flushedBuckets.push('profile');
  }
  if (messages.length === 0) {
    const pending = athFlushPendingCount(state);
    throw new Error(pending > 0n ? 'ATH burn flush is already pending' : 'No ATH is ready to flush');
  }
  const transaction = createWalletTransaction(messages);
  const result = await sendPlathoWalletTransaction(requirePlathoWallet(), transaction);
  athFlushState = {
    ...state,
    username_burn_due_ath: flushedBuckets.includes('username') ? 0n : state.username_burn_due_ath,
    profile_burn_due_ath: flushedBuckets.includes('profile') ? 0n : state.profile_burn_due_ath,
    username_pending_burn_flush_count: flushedBuckets.includes('username')
      ? usernamePending + 1n
      : state.username_pending_burn_flush_count,
    profile_pending_burn_flush_count: flushedBuckets.includes('profile')
      ? profilePending + 1n
      : state.profile_pending_burn_flush_count,
    busy: false,
    error: null,
  };
  globalThis.plathoLastAthDueFlush = { state, messages, transaction, result, flushedBuckets };
  renderAthFlushStatus();
  queueAthFlushPostTransactionRefresh();
  flashWalletIdentityStatus('ATH flush submitted');
  return result;
}

async function submitProfileAvatarUpdate(avatar) {
  const owner = requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  if (!avatar?.bytes?.length) return null;
  const avatarHash = await sha256Hex(avatar.bytes);
  const existingRecovery = profileAvatarPublishRecoveryFor(owner, avatarHash);
  if (existingRecovery) {
    setProfileAvatarStatus('avatar still confirming');
    scheduleProfileAvatarPublishRecovery(existingRecovery, 0);
    return existingRecovery;
  }
  setProfileAvatarStatus('checking current avatar');
  const currentPointer = await readCurrentProfileAvatarPointerFromChain(owner, { required: true });
  if (currentPointer?.avatarHash?.toLowerCase?.() === normalizeAvatarHashHex(avatarHash).toLowerCase()) {
    writeProfileAvatarMediaCache(avatarHash, bytesToImageDataUrl(avatar.bytes, 'image/webp'));
    const cachedImage = await readProfileAvatarMediaCache(avatarHash);
    if (cachedImage) setAvatarNode(profileAvatar, 'P', cachedImage);
    setProfileAvatarStatus('avatar active', '');
    return {
      status: 'active',
      registryPointer: currentPointer,
    };
  }
  const parts = imagePartsForSend(avatar, 'profile avatar');
  if (parts.length <= 0) throw new Error('Avatar image is empty');
  if (parts.length > 16) throw new Error('Avatar must fit 16 public capsules');

  let streamId = randomBytes(16);
  const createdAtSec = Math.floor(Date.now() / 1000);
  const nextVersion = (currentPointer?.profileVersion ?? 0) + 1;
  const publishDiagnostics = {
    avatarHash,
    streamId: `0x${bytesToHex(streamId)}`,
    partCount: parts.length,
    profileVersion: nextVersion,
    snapshots: [],
  };
  const capturePublishSnapshot = async (label, publishState = publishResult?.publishState ?? null) => {
    const snapshot = await readProfileAvatarPublishChainSnapshot(owner, publishState, label);
    publishDiagnostics.snapshots.push(snapshot);
    globalThis.plathoLastProfileAvatarPublishDiagnostics = publishDiagnostics;
    return snapshot;
  };
  const payloads = [];
  for (let index = 0; index < parts.length; index += 1) {
    payloads.push(await createPublicPostPayload({
      type: 'avatar',
      bytes: parts[index].bytes,
      mediaFormat: PUBLIC_BODY_MEDIA_FORMATS.WEBP,
      streamId,
      partIndex: index,
      partCount: parts.length,
      createdAtSec,
      profileVersion: nextVersion,
      avatarHash,
    }, { sizeClass: parts[index].sizeClass }));
  }
  publishDiagnostics.payloads = profileAvatarPublishPayloadDiagnostics(payloads);

  setProfileAvatarStatus('checking Vault balance');
  try {
    await assertVaultProfileAvatarCanStart(owner, parts.length);
  } catch (error) {
    const rateLimited = noteTonRpcRateLimit(error);
    const recoverableRpc = !rateLimited && isTonRpcRecoverableReadError(error);
    setProfileAvatarStatus(
      rateLimited || recoverableRpc ? TON_RPC_CONNECTING_STATUS : String(error?.message ?? 'avatar blocked'),
      rateLimited || recoverableRpc ? 'busy' : 'error',
    );
    throw error;
  }

  writeProfileAvatarMediaCache(avatarHash, bytesToImageDataUrl(avatar.bytes, 'image/webp'));
  const pendingPointer = {
    profileVersion: nextVersion,
    avatarHash,
    avatarStreamId: `0x${bytesToHex(streamId)}`,
    avatarPartCount: parts.length,
  };
  const avatarRecoveryContext = () => ({
    owner,
    avatarHash,
    streamIdBytes: streamId,
    partCount: parts.length,
    pendingPointer,
    mediaFormat: PUBLIC_BODY_MEDIA_FORMATS.WEBP,
    publishState: publishResult?.publishState ?? null,
    publishResult,
    payloads,
  });
  setProfileAvatarStatus('checking chain');
  let publishResult = null;
  let confirmed = await findPublishedAvatarEntries(owner, {
    ...pendingPointer,
    avatarStreamId: null,
  }).catch((error) => {
    if (!isTonRpcRecoverableReadError(error) && !noteTonRpcRateLimit(error)) console.error(error);
    return null;
  });
  if (confirmed?.streamId) streamId = bigIntToFixedBytes(BigInt(confirmed.streamId), 16, 'avatar stream id');
  if (confirmed) {
    setProfileAvatarStatus('avatar already published');
  } else {
    setProfileAvatarStatus('publishing avatar');
    await capturePublishSnapshot('before-public-publish', null);
    try {
      publishResult = await publishPublicPayloadParts(payloads, `profile-avatar-${Date.now()}`);
      globalThis.plathoLastProfileAvatarPublish = {
        avatarHash,
        streamId: `0x${bytesToHex(streamId)}`,
        partCount: parts.length,
        diagnostics: publishDiagnostics,
        result: publishResult,
        at: new Date().toISOString(),
      };
    } catch (error) {
      if (!isVaultPublishPartialError(error)) throw error;
      publishResult = error.publishResult;
      publishDiagnostics.initialPublishError = shortUiErrorText(error.cause ?? error, 'avatar publish failed');
      globalThis.plathoLastProfileAvatarPublishPartial = {
        avatarHash,
        streamId: `0x${bytesToHex(streamId)}`,
        parts: parts.length,
        diagnostics: publishDiagnostics,
        result: publishResult,
        cause: String(error?.cause?.message ?? error?.message ?? error),
        at: new Date().toISOString(),
      };
      globalThis.plathoLastProfileAvatarPublish = globalThis.plathoLastProfileAvatarPublishPartial;
      const broadcastStatus = profileAvatarPublishBroadcastErrorStatus(publishDiagnostics);
      setProfileAvatarStatus(broadcastStatus ? `broadcast uncertain: ${broadcastStatus}` : 'broadcast uncertain, confirming');
    }
    if (publishResult?.publishState) {
      rememberProfileAvatarPublishRecovery(avatarRecoveryContext());
      setProfileAvatarStatus('publish submitted, confirming');
      try {
        await confirmCapsuleHubPublishEntries(publishResult.publishState, {
          scanAvailableTransports: true,
          scanLimit: PROFILE_AVATAR_PUBLISH_CONFIRM_SCAN_LIMIT,
          deadlineMs: PROFILE_AVATAR_PUBLISH_CONFIRM_DEADLINE_MS,
          requestTimeoutMs: PRIVATE_PUBLISH_CONFIRM_RECOVERY_REQUEST_TIMEOUT_MS,
          queueTimeoutMs: PRIVATE_PUBLISH_CONFIRM_RECOVERY_QUEUE_TIMEOUT_MS,
        });
        if (publishResult.publishState.status === CAPSULEHUB_PUBLISH_STATUS_CONFIRMED) {
          publishResult.status = CAPSULEHUB_PUBLISH_STATUS_CONFIRMED;
        } else if (publishResult.publishState.status === VAULT_PUBLISH_STATUS_SUBMITTED) {
          publishResult.status = VAULT_PUBLISH_STATUS_SUBMITTED;
        }
        confirmed = await findConfirmedAvatarEntriesFromPublishState(owner, pendingPointer, publishResult.publishState)
          .catch((error) => {
            if (!isTonRpcRecoverableReadError(error) && !noteTonRpcRateLimit(error)) console.error(error);
            return null;
          });
      } catch (error) {
        if (!isTonRpcRecoverableReadError(error) && !noteTonRpcRateLimit(error)) console.error(error);
      }
    }
    if (
      publishResult?.status !== CAPSULEHUB_PUBLISH_STATUS_CONFIRMED
      && publishResult?.status !== VAULT_PUBLISH_STATUS_SUBMITTED
      && publishResult?.status !== VAULT_PUBLISH_STATUS_PARTIAL
    ) {
      setProfileAvatarStatus('publish blocked', 'error');
      return publishResult;
    }
    setProfileAvatarStatus('confirming avatar capsules');
    try {
      confirmed = confirmed ?? await waitForPublishedAvatarEntries(owner, pendingPointer);
    } catch (error) {
      if (error?.code !== 'PLATHO_AVATAR_CAPSULES_NOT_VISIBLE') throw error;
      if (publishResult?.publishState) {
        setProfileAvatarStatus('checking chain');
        let broadcastRetries = 0;
        try {
          broadcastRetries = await retryUnconfirmedVaultPublishBroadcasts(publishResult.publishState, {
            owner,
            deadlineMs: PRIVATE_PUBLISH_BROADCAST_RETRY_DEADLINE_MS,
            readTimeoutMs: PRIVATE_PUBLISH_BROADCAST_RETRY_READ_TIMEOUT_MS,
            sendTimeoutMs: PRIVATE_PUBLISH_BROADCAST_RETRY_SEND_TIMEOUT_MS,
            queueTimeoutMs: PRIVATE_PUBLISH_BROADCAST_RETRY_QUEUE_TIMEOUT_MS,
          });
          if (broadcastRetries > 0) {
            publishResult.broadcastRetryCount = (Number(publishResult.broadcastRetryCount ?? 0) || 0) + broadcastRetries;
            globalThis.plathoLastProfileAvatarPublishRecovery = {
              avatarHash,
              streamId: `0x${bytesToHex(streamId)}`,
              broadcastRetries,
              at: new Date().toISOString(),
            };
            setProfileAvatarStatus('broadcast retrying');
          }
          await confirmCapsuleHubPublishEntries(publishResult.publishState, {
            scanAvailableTransports: true,
            scanLimit: PROFILE_AVATAR_PUBLISH_CONFIRM_SCAN_LIMIT,
            deadlineMs: PROFILE_AVATAR_PUBLISH_CONFIRM_DEADLINE_MS,
            requestTimeoutMs: PRIVATE_PUBLISH_CONFIRM_RECOVERY_REQUEST_TIMEOUT_MS,
            queueTimeoutMs: PRIVATE_PUBLISH_CONFIRM_RECOVERY_QUEUE_TIMEOUT_MS,
          });
          confirmed = await findConfirmedAvatarEntriesFromPublishState(owner, pendingPointer, publishResult.publishState)
            .catch((confirmError) => {
              if (!isTonRpcRecoverableReadError(confirmError) && !noteTonRpcRateLimit(confirmError)) console.error(confirmError);
              return null;
            });
          if (!confirmed && broadcastRetries > 0) {
            setProfileAvatarStatus('confirming avatar capsules');
            confirmed = await waitForPublishedAvatarEntries(owner, pendingPointer)
              .catch((confirmError) => {
                if (!isTonRpcRecoverableReadError(confirmError) && !noteTonRpcRateLimit(confirmError)) console.error(confirmError);
                return null;
              });
          }
        } catch (confirmError) {
          if (!isTonRpcRecoverableReadError(confirmError) && !noteTonRpcRateLimit(confirmError)) console.error(confirmError);
        }
      }
      const looseConfirmed = await findPublishedAvatarEntries(owner, {
        ...pendingPointer,
        avatarStreamId: null,
      }).catch((looseError) => {
        if (!isTonRpcRecoverableReadError(looseError) && !noteTonRpcRateLimit(looseError)) console.error(looseError);
        return null;
      });
      confirmed = looseConfirmed ?? confirmed;
      if (confirmed) {
        if (confirmed.streamId) streamId = bigIntToFixedBytes(BigInt(confirmed.streamId), 16, 'avatar stream id');
      } else {
        await capturePublishSnapshot('after-avatar-not-visible', publishResult?.publishState ?? null);
        const diagnosticStatus = profileAvatarPublishDiagnosticStatus(publishDiagnostics);
        if (diagnosticStatus) error.avatarDiagnosticStatus = diagnosticStatus;
        if (publishResult?.publishState) {
          const job = scheduleProfileAvatarPublishRecovery({
            ...avatarRecoveryContext(),
            lastError: diagnosticStatus ?? shortUiErrorText(error, 'avatar not visible yet'),
          });
          setProfileAvatarStatus('avatar still confirming');
          return {
            status: VAULT_PUBLISH_STATUS_SUBMITTED,
            publishState: publishResult.publishState,
            recoveryJob: profileAvatarRecoveryPublicDebug(job),
          };
        }
        throw error;
      }
    }
  }

  let finality = null;
  try {
    finality = await finalizeProfileAvatarUpdate({
      owner,
      avatarHash,
      confirmed,
      pendingPointer,
      partCount: parts.length,
      mediaFormat: PUBLIC_BODY_MEDIA_FORMATS.WEBP,
      payloads,
      publishResult,
      streamIdBytes: streamId,
    });
  } catch (error) {
    if (!isTonRpcRecoverableReadError(error) && !noteTonRpcRateLimit(error)) throw error;
    const job = scheduleProfileAvatarPublishRecovery({
      ...avatarRecoveryContext(),
      confirmed,
      lastError: shortUiErrorText(error, 'avatar registry delayed'),
    });
    setProfileAvatarStatus('avatar still confirming');
    return {
      status: 'pending',
      recoveryJob: profileAvatarRecoveryPublicDebug(job),
    };
  }
  if (finality?.registryPending === true) {
    const job = scheduleProfileAvatarPublishRecovery({
      ...avatarRecoveryContext(),
      confirmed,
      registrySubmission: finality.result ?? null,
      lastError: finality.registryError ? shortUiErrorText(finality.registryError, 'registry pending') : null,
    });
    return {
      status: 'pending',
      recoveryJob: profileAvatarRecoveryPublicDebug(job),
    };
  }
  clearProfileAvatarPublishRecovery(profileAvatarPublishRecoveryKey(owner, avatarHash));
  return finality?.result ?? finality;
}

async function attemptPrivatePaymentCheckPublish(context) {
  const endPrivateOutboundWork = beginPrivateOutboundWork();
  try {
  const { thread, message, paymentDraft, selectedSuite, senderOptions = currentPrivateSenderOptions() } = context;
  clearPrivateMessageManualRecovery(message);
  if (!thread || thread.readOnly) throw new Error('Payment checks are only available in private chats');
  if (!paymentDraft) throw new Error('Payment check draft is missing');
  if (!localIdentity) throw new Error('Local encryption identity is not ready');
  const recipientEntry = await resolveRecipientPeerEntry(thread, { suite: selectedSuite ?? currentOutgoingPrivateSuite() });
  refreshThreadIdentityFromVariants(thread, privateWalletIdentityVariants(recipientEntry.walletAddress));
  const recipientWallet = recipientEntry.walletAddress;
  const { asset, amount } = paymentDraft;
  const provider = await resolveVaultChainProvider();
  const initialUser = await readFreshConnectedVaultUserForOwnVaultAction(provider);
  if (initialUser.exists !== true || BigInt(initialUser.current_key_id ?? 0n) === 0n) {
    throw new Error('Activate Platho account before using payment checks');
  }

  const senderWallet = requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  const clientNonce = BigInt(initialUser.publish_nonce ?? initialUser.publishNonce ?? 0n);
  const secret32Bytes = randomBytes(32);
  const secret32 = bytesToBigIntValue(secret32Bytes);
  const intentId = await computeVaultReceiveIntentId({
    senderWallet,
    recipientWallet,
    asset,
    amount,
    clientNonce,
  });
  const commitment = secret32;
  const payment = normalizePaymentForMessage({
    asset,
    amount,
    intentId,
    secret32Bytes,
    senderWallet,
    recipientWallet,
    clientNonce,
  });
  const capsules = await createPrivateComposerCapsules(context.text ?? '', context.attachments ?? [], recipientEntry, thread.id, senderOptions, { payment });
  const publishState = createCapsulePublishState(capsules);
  const displayBlocks = displayBlocksFromDocumentBlocks(composerBlocksFromDraft(context.text ?? '', context.attachments ?? [], payment));
  message.text = messagePreviewFromBlocks(displayBlocks) || paymentMessageText(payment);
  message.blocks = displayBlocks;
  message.payment = payment;
  message.paymentDraft = paymentDraftForHistory(paymentDraft);
  message.capsule = capsules[0];
  message.capsules = capsules;
  message.publishState = publishState;
  message.recipientWallet = recipientWallet;
  message.meta = 'message pricing';
  refreshThreadAfterMessageChange(thread);
  renderThreads();
  renderConversation();

  try {
    if (!encryptedMessageStore || encryptedMessageStore.persistent === false) {
      throw new Error('Persistent encrypted local history is required before creating a payment check');
    }
    const quotedPublish = await prepareCapsulesThroughVault(capsules, {
      publishState,
      allowOwnVaultActionReadFallback: true,
    });
    const createReserve = estimateVaultAttachedValueNanotons('CreateReceiveIntent');
    const preparedUser = quotedPublish.user ?? initialUser;
    const tonBalance = BigInt(preparedUser.ton_balance ?? preparedUser.tonBalance ?? 0n);
    const athBalance = BigInt(preparedUser.ath_balance ?? preparedUser.athBalance ?? 0n);
    if (asset === RECEIVE_ASSETS.TON) {
      if (tonBalance < amount + createReserve + quotedPublish.totalMaxCharge) {
        throw new Error('Not enough Vault TON for payment check and private publish hold');
      }
    } else {
      if (athBalance < amount) throw new Error(`Not enough ${paymentAssetLabel(asset)} in Vault`);
      if (tonBalance < createReserve + quotedPublish.totalMaxCharge) {
        throw new Error('Not enough Vault TON for payment check private publish hold');
      }
    }
    const storedRecovery = await persistMessageToEncryptedHistory(thread, message);
    if (!storedRecovery && !message.localHistoryId) {
      throw new Error('Payment check recovery record could not be saved');
    }
    const pendingLedger = await rememberPendingPaymentCheckLedgerRecord(
      thread,
      message,
      payment,
      { status: 'prepared' },
      { required: true },
    );
    if (!pendingLedger) {
      throw new Error('Payment check pending ledger could not be saved');
    }
  } catch (error) {
    rememberPaymentCheckActionError('pre-create', error, payment);
    throw error;
  }

  let createResult = null;
  let intentCreateSubmitted = false;
  try {
    setText(identitySubtitle, 'creating payment check');
    message.meta = 'creating payment check';
    await updateMessageInEncryptedHistory(thread, message);
    createResult = await submitVaultReceiveIntentExternal('CreateReceiveIntent', {
      asset,
      amount,
      recipient_wallet: recipientWallet,
      commitment,
    }, {
      provider,
      user: initialUser,
      });
    intentCreateSubmitted = true;
    context.paymentIntentCreated = true;
    message.paymentIntentCreated = true;
    message.vaultCreateIntent = createResult;
    message.meta = 'check created, confirming';
    await updateMessageInEncryptedHistory(thread, message);
    await rememberPendingPaymentCheckLedgerRecord(thread, message, payment, {
      status: 'intent_create_submitted',
      vaultCreateIntent: createResult,
    });
    await waitForPaymentCheckCreateConfirmation(provider, payment);
    message.meta = 'payment check created, publishing message';
    await updateMessageInEncryptedHistory(thread, message);
    await rememberPendingPaymentCheckLedgerRecord(thread, message, payment, {
      status: 'intent_confirmed',
      vaultCreateIntent: createResult,
    });
    const preparedPublish = await prepareCapsulesThroughVault(capsules, {
      publishState,
      allowOwnVaultActionReadFallback: true,
    });
    const publishResult = await sendPreparedCapsulesThroughVault(preparedPublish, {
      publishState,
      confirmFinalNonce: true,
      onPartState: () => {
        message.meta = publishStateMeta(publishState);
        updateMessageInEncryptedHistory(thread, message).catch((error) => console.error(error));
        renderConversation();
      },
    });
    clearPrivateSendRetry(message);
    clearPrivateMessageManualRecovery(message);
    message.vaultPublish = publishResult;
    message.publishState = publishResult.publishState ?? publishState;
    message.meta = publishStateMeta(message.publishState);
    thread.state = publishResult.status === CAPSULEHUB_PUBLISH_STATUS_CONFIRMED ? 'sealed' : 'pending';
    await updateMessageInEncryptedHistory(thread, message);
    if (publishResult.status !== CAPSULEHUB_PUBLISH_STATUS_CONFIRMED) {
      await rememberPendingPaymentCheckLedgerRecord(thread, message, payment, {
        status: 'publish_submitted',
        vaultPublish: publishResult,
        publishState: message.publishState,
      });
      schedulePrivatePublishConfirmationRetry(context);
    } else {
      message.privatePublishConfirmAttempt = 0;
      message.privatePublishConfirmStopped = false;
      message.privatePublishConfirmStoppedAt = null;
      clearPrivatePublishConfirmRetry(message);
      await removePendingPaymentCheckLedgerRecord(payment);
    }
    refreshMessagingControls();
    return { createResult, payment, capsule: capsules[0], capsules, publishResult };
  } catch (error) {
    const cancelled = isPublishPriceChangeCancelled(error);
    const partial = isVaultPublishPartialError(error);
    if (!intentCreateSubmitted) {
      if (cancelled) context.cancelled = true;
      await removePendingPaymentCheckLedgerRecord(payment);
      if (isRecoverablePrivateSendError(error)) {
        message.meta = privateSendRetryMeta(error);
        thread.state = 'pending';
        schedulePrivateSendRetry(context, error);
      } else {
        markPrivateMessageManualRecovery(context, error, cancelled ? 'not sent: cancelled' : privateSendBlockedStatusText(error));
      }
    } else if (partial) {
      message.vaultPublish = error.publishResult;
      message.publishState = error.publishResult?.publishState ?? message.publishState;
      message.meta = publishStateMeta(message.publishState);
      thread.state = privateMessageHasPublishAttempt(message) ? 'pending' : 'blocked';
      await rememberPendingPaymentCheckLedgerRecord(thread, message, payment, {
        status: 'publish_partial',
        vaultPublish: error.publishResult,
        publishState: message.publishState,
      });
      schedulePrivatePublishConfirmationRetry(context, error);
    } else if (isRecoverablePrivateSendError(error)) {
      message.meta = privateSendRetryMeta(error);
      thread.state = 'pending';
      context.payment = payment;
      context.paymentIntentCreated = true;
      await rememberPendingPaymentCheckLedgerRecord(thread, message, payment, {
        status: 'publish_retry_pending',
        publishState: message.publishState,
      });
      schedulePrivateSendRetry(context, error);
    } else {
      rememberPaymentCheckActionError('publish', error, payment);
      const cancelResult = await attemptCancelPaymentCheckAfterPublishFailure(payment).catch((cancelError) => {
        rememberPaymentCheckActionError('auto-cancel', cancelError, payment);
        if (isPaymentCheckCancelPending(cancelError)) return { pending: true };
        console.error(cancelError);
        return null;
      });
      message.vaultCancelIntent = cancelResult;
      const publishErrorText = privateSendPreflightStatusText(error);
      message.meta = cancelResult?.pending
        ? 'check cancel submitted, confirming'
        : cancelResult
        ? (cancelled ? 'check cancelled before publish' : `check publish failed, intent cancelled: ${publishErrorText}`)
        : (cancelled ? 'check publish cancelled, refund required' : 'check not delivered, refund required');
      thread.state = 'blocked';
      if (cancelResult?.pending) {
        await rememberPendingPaymentCheckLedgerRecord(thread, message, payment, {
          status: 'cancel_submitted',
          vaultCancelIntent: cancelResult,
        });
      } else if (cancelResult) {
        await removePendingPaymentCheckLedgerRecord(payment);
      } else {
        await rememberPendingPaymentCheckLedgerRecord(thread, message, payment, {
          status: 'publish_failed_refund_required',
          publishError: privateSendPreflightStatusText(error),
        });
      }
    }
    refreshMessagingControls();
    if (!cancelled && !partial) console.error(error);
    await updateMessageInEncryptedHistory(thread, message);
    return { createResult, payment, capsule: capsules[0], capsules, error };
  } finally {
    refreshThreadAfterMessageChange(thread);
    renderThreads();
    renderConversation();
  }
  } finally {
    endPrivateOutboundWork();
  }
}

async function submitCreatePaymentCheck(options = {}) {
  const thread = options.thread ?? activeThread();
  if (!thread || thread.readOnly) throw new Error('Payment checks are only available in private chats');
  const paymentDetails = options.paymentDetails ?? (await requestPaymentCheckDetails());
  if (!paymentDetails) return null;
  const message = {
    type: 'out',
    text: paymentMessageText(paymentDetails),
    meta: 'check preparing',
    ...localMessageOrderFields(),
    paymentDraft: paymentDraftForHistory(paymentDetails),
  };
  insertThreadMessage(thread, message);
  refreshThreadAfterMessageChange(thread);
  renderThreads();
  renderConversation();
  const context = {
    thread,
    message,
    paymentDraft: paymentDetails,
    selectedSuite: currentOutgoingPrivateSuite(),
    senderOptions: currentPrivateSenderOptions(),
    retryAttempt: 0,
    confirmAttempt: 0,
  };
  return attemptPrivatePaymentCheckPublish(context);
}

async function submitVaultClaimPaymentCheck(payment, options = {}) {
  const provider = await resolveVaultChainProvider();
  if (!provider?.getReceiveIntent || !provider?.getUser) {
    throw new Error('Vault provider cannot confirm payment checks');
  }
  const intentId = paymentIntentId(payment);
  const beforeUser = await readFreshConnectedVaultUserForOwnVaultAction(provider);
  const intent = await readFreshReceiveIntentForOwnVaultAction(provider, intentId);
  assertReceiveIntentMatchesPayment(intent, payment);
  setText(identitySubtitle, 'claim signing');
  await options.onStatus?.('check claim signing');
  const result = await submitVaultReceiveIntentExternal('ClaimReceiveIntent', {
    intent_id: intentId,
    secret32: paymentSecret32(payment),
  }, {
    provider,
    user: beforeUser,
    allowPendingServiceWorkerUpdate: true,
  });
  setText(identitySubtitle, 'claim confirming');
  await options.onStatus?.('check claim submitted, confirming');
  await markPendingPaymentCheckLedgerRecord(payment, {
    status: 'claim_submitted',
    vaultClaimIntent: result,
  });
  const confirmed = await waitForPaymentCheckClaimConfirmation(provider, payment, beforeUser);
  await removePendingPaymentCheckLedgerRecord(payment);
  const claimedAmountText = BigInt(payment.asset ?? 0n) === RECEIVE_ASSETS.TON
    ? formatTonNanotons(BigInt(payment.amount ?? 0n))
    : formatAtomicAmount(payment.amount);
  flashWalletIdentityStatus(`check claimed +${claimedAmountText} ${paymentAssetLabel(payment.asset)}`);
  queueVaultPostTransactionRefresh();
  return { result, confirmed };
}

async function submitVaultCancelPaymentCheck(payment, options = {}) {
  const provider = await resolveVaultChainProvider();
  if (!provider?.getReceiveIntent || !provider?.getUser) {
    throw new Error('Vault provider cannot confirm payment checks');
  }
  const intentId = paymentIntentId(payment);
  const beforeUser = await readFreshConnectedVaultUserForOwnVaultAction(provider);
  const intent = await readFreshReceiveIntentForCancel(provider, intentId);
  assertReceiveIntentCancelableBySender(intent, payment);
  setText(identitySubtitle, 'cancel signing');
  await options.onStatus?.('check cancel signing');
  const result = await submitVaultReceiveIntentExternal('CancelReceiveIntent', {
    intent_id: intentId,
  }, {
    provider,
    user: beforeUser,
    allowPendingServiceWorkerUpdate: true,
  });
  setText(identitySubtitle, 'cancel confirming');
  await options.onStatus?.('check cancel submitted, confirming');
  await markPendingPaymentCheckLedgerRecord(payment, {
    status: 'cancel_submitted',
    vaultCancelIntent: result,
  });
  const confirmed = await waitForPaymentCheckCancelConfirmation(provider, payment, beforeUser);
  await removePendingPaymentCheckLedgerRecord(payment);
  flashWalletIdentityStatus('check cancelled');
  queueVaultPostTransactionRefresh();
  return { result, confirmed };
}

async function attemptCancelPaymentCheckAfterPublishFailure(payment) {
  if (!payment) return null;
  setText(identitySubtitle, 'check auto-cancelling');
  return submitVaultCancelPaymentCheck(payment);
}

async function submitVaultRegisterMessagingKeys() {
  if (!localVaultDraft?.message) throw new Error('Local messaging key draft is not ready');
  const provider = await resolveVaultChainProvider();
  const user = await readFreshConnectedVaultUser(provider);
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
  const provider = await resolveVaultChainProvider();
  const user = await loadConnectedVaultUser({
    provider,
    verify: true,
    priority: 'critical',
    cacheTtlMs: 0,
  });
  const currentKeyId = BigInt(user.current_key_id ?? 0n);
  if (user.exists !== true || currentKeyId === 0n) {
    setText(vaultRotateStatus, 'activate account first');
    return null;
  }
  const requiredTon = estimateVaultAttachedValueNanotons('ReplaceMessagingKeys', localVaultDraft.message);
  const tonBalance = BigInt(user.ton_balance ?? user.tonBalance ?? 0n);
  if (tonBalance < requiredTon) {
    throw new Error(`Vault TON balance is too low for key rotation; need ${formatTonNanotons(requiredTon)} TON`);
  }
  setText(vaultRotateStatus, 'signing');
  const owner = requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  const submission = await submitVaultAuthExternalWithNonceConfirmation({
    provider,
    owner,
    user,
    buildExternal: (clientNonce) => buildVaultReplaceMessagingKeysExternalBoc({
      ...localVaultDraft.message,
      owner_wallet: owner,
      client_nonce: clientNonce,
      signingSecretKey: requireVaultAuthSecretKey(),
    }, {
      vaultAddress: requireVaultAddress(),
      deploymentManifestHash: requireVaultDeploymentManifestHash(),
    }),
  });
  globalThis.plathoLastVaultReplaceMessagingKeysExternal = submission;
  setText(vaultRotateStatus, submission.confirmationPending ? 'key update submitted, confirming' : 'key update sent');
  return submission;
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
const CAPSULEHUB_PUBLISH_CONFIRM_SCAN_LIMIT = 32;
const CAPSULEHUB_PUBLISH_CONFIRM_HOT_SCAN_LIMIT = 8;
const PRIVATE_PUBLISH_BROADCAST_RETRY_AFTER_MS = 35_000;
const PRIVATE_PUBLISH_BROADCAST_RETRY_LIMIT = 6;
const PRIVATE_PUBLISH_BROADCAST_RETRY_DEADLINE_MS = 12 * 1000;
const PRIVATE_PUBLISH_BROADCAST_RETRY_READ_TIMEOUT_MS = 4 * 1000;
const PRIVATE_PUBLISH_BROADCAST_RETRY_SEND_TIMEOUT_MS = 8 * 1000;
const PRIVATE_PUBLISH_BROADCAST_RETRY_QUEUE_TIMEOUT_MS = 30 * 1000;
const PRIVATE_PUBLISH_CONFIRM_HOT_QUEUE_TIMEOUT_MS = 30 * 1000;
const PRIVATE_PUBLISH_CONFIRM_RECOVERY_QUEUE_TIMEOUT_MS = 60 * 1000;

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
  const bodyHash = publishHashPlain(publish.body_hash ?? publish.bodyHash);
  return {
    capsuleId: capsule.id ?? null,
    index,
    partCount: total,
    status: PUBLISH_PART_STATUS_BUILT,
    publishKind: isPublic ? 'public' : 'private',
    sizeClass: Number(publish.size_class ?? publish.sizeClass ?? 1),
    cryptoSuite: Number(publish.crypto_suite ?? publish.cryptoSuite ?? 0),
    publishId: publishHashPlain(publish.publish_id ?? publish.publishId),
    bodyHash,
    header0Hash: publishHashPlain(publish.header_0_hash ?? publish.header0Hash ?? publish.header_hash ?? publish.headerHash),
    header1Hash: publishHashPlain(publish.header_1_hash ?? publish.header1Hash),
    entryId: null,
    error: null,
  };
}

function publishPartBodyHash(part) {
  return publishHashPlain(part?.bodyHash ?? part?.body_hash);
}

function publishPartHeader0Hash(part) {
  return publishHashPlain(part?.header0Hash ?? part?.header_0_hash ?? part?.headerHash ?? part?.header_hash);
}

function publishPartHeader1Hash(part) {
  return publishHashPlain(part?.header1Hash ?? part?.header_1_hash);
}

function publishPartKind(part) {
  const kind = part?.publishKind ?? part?.publish_kind ?? part?.kind;
  if (kind === 'public' || kind === 'private') return kind;
  try {
    return BigInt(kind ?? 0n) === VAULT_PUBLISH_KIND.PUBLIC ? 'public' : 'private';
  } catch {
    return 'private';
  }
}

function publishPartHasPayloadHashes(part) {
  if (!part) return false;
  if (!publishPartBodyHash(part) || !publishPartHeader0Hash(part)) return false;
  return publishPartKind(part) === 'public' || Boolean(publishPartHeader1Hash(part));
}

function publishIdForPart(part) {
  return publishHashPlain(part?.publishId ?? part?.publish_id);
}

function createCapsulePublishState(capsules) {
  const normalized = (capsules ?? []).filter(Boolean);
  return {
    status: 'built',
    partCount: normalized.length,
    confirmedCount: 0,
    submittedCount: 0,
    displaySubmittedCount: 0,
    confirmSearch: {},
    updatedAt: new Date().toISOString(),
    parts: normalized.map((capsule, index) => publishPartFromCapsule(capsule, index, normalized.length)),
  };
}

function setPublishPartStatus(publishState, index, status, extra = {}) {
  const part = publishState?.parts?.[index];
  if (!part) return null;
  Object.assign(part, extra, { status });
  if (
    status === PUBLISH_PART_STATUS_SENT
    || status === PUBLISH_PART_STATUS_VAULT_SUBMITTED
    || status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED
  ) {
    part.error = null;
    part.retryReason = null;
    if (status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED) {
      part.lastBroadcastRetryError = null;
      part.lastBroadcastRetryErrorAt = null;
    }
  }
  publishState.submittedCount = publishState.parts.filter((item) => (
    item.status === PUBLISH_PART_STATUS_VAULT_SUBMITTED
    || item.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED
  )).length;
  publishState.confirmedCount = publishState.parts.filter((item) => item.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED).length;
  publishState.displaySubmittedCount = publishStateVisibleSubmittedCount(publishState);
  if (publishState.confirmedCount === publishState.partCount) {
    publishState.status = CAPSULEHUB_PUBLISH_STATUS_CONFIRMED;
  } else if (publishState.submittedCount > 0 || publishState.parts.some((item) => item.status === PUBLISH_PART_STATUS_SENT || item.status === PUBLISH_PART_STATUS_UNKNOWN)) {
    publishState.status = VAULT_PUBLISH_STATUS_SUBMITTED;
  } else if (publishState.parts.some((item) => item.status === PUBLISH_PART_STATUS_FAILED)) {
    publishState.status = 'failed';
  } else {
    publishState.status = 'built';
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

function publishStateBroadcastCount(publishState) {
  return (publishState?.parts ?? []).filter((item) => (
    item.status === PUBLISH_PART_STATUS_SENT
    || item.status === PUBLISH_PART_STATUS_UNKNOWN
  )).length;
}

function publishStatePriorAttemptCount(publishState) {
  return (publishState?.parts ?? []).filter((item) => publishPartHadPriorChainAttempt(item)).length;
}

function publishStateVisibleSubmittedCount(publishState) {
  const total = Math.max(1, Number(publishState?.partCount) || 1);
  const previous = Math.max(0, Number(publishState?.displaySubmittedCount ?? 0) || 0);
  const current = Math.max(
    Number(publishState?.submittedCount ?? 0) || 0,
    Number(publishState?.confirmedCount ?? 0) || 0,
    publishStatePendingCount(publishState),
    publishStateBroadcastCount(publishState),
    publishStatePriorAttemptCount(publishState),
  );
  return Math.min(total, Math.max(previous, current));
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
  const broadcast = Math.max(0, publishStateBroadcastCount(publishState));
  const pending = Math.max(submitted, publishStatePendingCount(publishState), publishStateVisibleSubmittedCount(publishState));
  if (confirmed >= total) return 'published';
  if (publishState?.status === VAULT_PUBLISH_STATUS_PARTIAL) {
    if (pending <= 0) return 'not sent';
    if (submitted <= 0 && broadcast > 0) return total === 1 ? 'submitted, confirming' : `submitted ${broadcast}/${total}, confirming`;
    if (pending >= total) return total === 1 ? 'submitted, confirming' : `submitted ${pending}/${total}, confirming`;
    return `submitted ${pending}/${total}, retrying`;
  }
  if (submitted <= 0 && broadcast > 0) return total === 1 ? 'submitted, confirming' : `submitted ${broadcast}/${total}, confirming`;
  if (pending > 0 || publishState?.status === VAULT_PUBLISH_STATUS_SUBMITTED) {
    return total === 1 ? 'submitted, confirming' : `submitted ${pending}/${total}, confirming`;
  }
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

function publishEntryMatchesPartPayload(entry, part) {
  if (!entry?.exists || !part) return false;
  if (publishHashPlain(entry.body_hash ?? entry.bodyHash) !== publishPartBodyHash(part)) return false;
  const expectedAuthorWallet = part.authorWallet ?? part.author_wallet ?? null;
  if (expectedAuthorWallet) {
    const entryAuthorWallet = entry.author_wallet ?? entry.authorWallet ?? null;
    if (!entryAuthorWallet || !sameWalletAddress(entryAuthorWallet, expectedAuthorWallet)) return false;
  }
  if (publishPartKind(part) === 'public') {
    return publishHashPlain(entry.header_hash ?? entry.headerHash) === publishPartHeader0Hash(part);
  }
  return publishHashPlain(entry.header_0_hash ?? entry.header0Hash) === publishPartHeader0Hash(part)
    && publishHashPlain(entry.header_1_hash ?? entry.header1Hash) === publishPartHeader1Hash(part);
}

function publishEntryMatchesPart(entry, part, options = {}) {
  if (!publishEntryMatchesPartPayload(entry, part)) return false;
  const expectedPublishId = publishIdForPart(part);
  const entryPublishId = publishHashPlain(entry.publish_id);
  if (options.requirePublishIdMatch === true || expectedPublishId) {
    return Boolean(expectedPublishId && entryPublishId && entryPublishId === expectedPublishId);
  }
  return options.allowPublishIdMismatch === true;
}

async function confirmPendingPrivatePublishMessagesFromEntries(entries, confirmedBy = 'private_entry') {
  const candidates = (entries ?? []).filter((entry) => entry?.exists === true);
  if (candidates.length === 0) return 0;
  const updates = [];
  let changedMessages = 0;
  let matchedParts = 0;
  let checkedParts = 0;
  for (const thread of threads) {
    let threadChanged = false;
    for (const message of thread.messages ?? []) {
      const publishState = message?.publishState;
      if (!publishState?.parts?.length || publishState?.status === CAPSULEHUB_PUBLISH_STATUS_CONFIRMED) continue;
      let messageChanged = false;
      for (const part of publishState.parts ?? []) {
        if (publishPartKind(part) !== 'private') continue;
        if (part.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED) continue;
        if (!publishPartHasPayloadHashes(part)) continue;
        checkedParts += 1;
        const entry = candidates.find((candidate) => publishEntryMatchesPart(candidate, part, {
          allowPublishIdMismatch: true,
        }));
        if (!entry) continue;
        matchedParts += 1;
        setPublishPartStatus(publishState, part.index, PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED, {
          entryId: String(entry.entry_id ?? ''),
          confirmedBy,
        });
        messageChanged = true;
      }
      if (!messageChanged) continue;
      changedMessages += 1;
      threadChanged = true;
      message.meta = publishStateMeta(publishState);
      thread.state = publishState.status === CAPSULEHUB_PUBLISH_STATUS_CONFIRMED ? 'sealed' : 'pending';
      if (publishState.status === CAPSULEHUB_PUBLISH_STATUS_CONFIRMED) {
        message.privatePublishConfirmAttempt = 0;
        message.privatePublishConfirmStopped = false;
        message.privatePublishConfirmStoppedAt = null;
        clearPrivatePublishConfirmRetry(message);
        if (message.payment) {
          updates.push(removePendingPaymentCheckLedgerRecord(message.payment).catch((error) => console.error(error)));
        }
      }
      updates.push(updateMessageInEncryptedHistory(thread, message).catch((error) => console.error(error)));
    }
    if (threadChanged) refreshThreadAfterMessageChange(thread);
  }
  globalThis.plathoLastPrivatePublishSyncRepair = {
    confirmedBy,
    candidates: candidates.length,
    checkedParts,
    matchedParts,
    changedMessages,
    at: new Date().toISOString(),
  };
  if (changedMessages > 0) {
    renderThreads();
    renderConversation();
    await Promise.all(updates);
  }
  return changedMessages;
}

function publishConfirmSearchState(publishState, kind, latest) {
  if (!publishState.confirmSearch || typeof publishState.confirmSearch !== 'object') {
    publishState.confirmSearch = {};
  }
  const key = kind === 'public' ? 'public' : 'private';
  const existing = publishState.confirmSearch[key] && typeof publishState.confirmSearch[key] === 'object'
    ? publishState.confirmSearch[key]
    : {};
  const latestSeen = (() => {
    try {
      return BigInt(existing.latestSeen ?? 0n);
    } catch {
      return 0n;
    }
  })();
  if (existing.exhausted === true && latest > latestSeen) {
    delete existing.nextEntryId;
    existing.exhausted = false;
  }
  if (latest > latestSeen) {
    existing.latestSeen = String(latest);
    existing.nextEntryId = latest > 0n ? String(latest - 1n) : null;
    existing.exhausted = false;
  }
  if (existing.nextEntryId === undefined || existing.nextEntryId === null) {
    existing.nextEntryId = latest > 0n ? String(latest - 1n) : null;
  }
  publishState.confirmSearch[key] = existing;
  return existing;
}

function publishConfirmScanBounds(publishState, kind, latest, scanLimit = CAPSULEHUB_PUBLISH_CONFIRM_SCAN_LIMIT) {
  const search = publishConfirmSearchState(publishState, kind, latest);
  if (search.exhausted === true || latest <= 0n) return null;
  let start;
  try {
    start = BigInt(search.nextEntryId ?? (latest - 1n));
  } catch {
    start = latest - 1n;
  }
  if (start >= latest) start = latest - 1n;
  if (start < 0n) {
    search.exhausted = true;
    search.nextEntryId = null;
    return null;
  }
  const numericLimit = Number(scanLimit);
  const chunk = BigInt(Number.isFinite(numericLimit) && numericLimit > 0
    ? Math.floor(numericLimit)
    : CAPSULEHUB_PUBLISH_CONFIRM_SCAN_LIMIT);
  const minEntryId = start >= chunk ? start - chunk + 1n : 0n;
  search.lastScan = {
    latest: String(latest),
    from: String(start),
    to: String(minEntryId),
    at: new Date().toISOString(),
  };
  return { start, minEntryId };
}

function publishConfirmCommitScan(publishState, kind, minEntryId) {
  const search = publishConfirmSearchState(publishState, kind, 0n);
  if (minEntryId > 0n) {
    search.nextEntryId = String(minEntryId - 1n);
  } else {
    search.nextEntryId = null;
    search.exhausted = true;
  }
}

function publishConfirmDeadlineAt(options = {}) {
  const deadlineMs = Number(options.deadlineMs ?? 0);
  return Number.isFinite(deadlineMs) && deadlineMs > 0 ? Date.now() + Math.floor(deadlineMs) : 0;
}

function publishConfirmDeadlineExpired(deadlineAt) {
  return Number.isFinite(deadlineAt) && deadlineAt > 0 && Date.now() >= deadlineAt;
}

function publishConfirmReadOptions(address, options = {}) {
  const out = criticalCapsuleHubReadOptions(address);
  const timeoutMs = Number(options.requestTimeoutMs ?? options.timeoutMs ?? 0);
  if (Number.isFinite(timeoutMs) && timeoutMs > 0) out.requestTimeoutMs = Math.floor(timeoutMs);
  const queueTimeoutMs = Number(options.queueTimeoutMs ?? 0);
  if (Number.isFinite(queueTimeoutMs) && queueTimeoutMs > 0) out.queueTimeoutMs = Math.floor(queueTimeoutMs);
  return out;
}

function capsuleHubConfirmationProviderCandidates(baseProvider, address, options = {}) {
  const providers = [baseProvider];
  if (options.scanAvailableTransports !== true) return providers;
  const transport = globalThis.plathoCapsuleHubRpcTransport ?? globalThis.plathoTonRpcTransport;
  const transports = Array.isArray(transport?.transports) ? transport.transports : [];
  const primary = [];
  const emergency = [];
  for (const item of transports) {
    if (!item?.runGetMethod) continue;
    (item.verifierOnly === true ? emergency : primary).push(item);
  }
  const alivePrimary = primary.filter((item) => !isTonRpcTransportDead(item));
  const candidates = alivePrimary.length > 0
    ? alivePrimary
    : (emergency.filter((item) => !isTonRpcTransportDead(item)).length > 0
      ? emergency.filter((item) => !isTonRpcTransportDead(item))
      : (primary.length > 0 ? primary : emergency));
  for (const item of candidates) {
    providers.push(createCapsuleHubTonRpcProvider({ capsuleHubAddress: address, transport: item }));
  }
  return providers;
}

async function confirmPrivatePublishEntriesFromSenderIndex(publishState, pendingParts, providerCandidates, readOptions, options = {}) {
  const privateParts = pendingParts.filter((part) => publishPartKind(part) === 'private');
  if (privateParts.length === 0 || !localRecipientKeyPair?.keyId) return;
  const keyIdIndex = privateKeyIdIndexValue(localRecipientKeyPair.keyId);
  const scanLimit = Number.isFinite(Number(options.scanLimit)) && Number(options.scanLimit) > 0
    ? Math.floor(Number(options.scanLimit))
    : CAPSULEHUB_PUBLISH_CONFIRM_SCAN_LIMIT;
  const deadlineAt = Number(options.deadlineAt ?? 0) || 0;
  for (const candidateProvider of providerCandidates) {
    if (publishConfirmDeadlineExpired(deadlineAt)) return;
    if (privateParts.every((part) => part.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED)) break;
    let senderIndex = null;
    try {
      senderIndex = await candidateProvider.getPrivateSenderIndex(keyIdIndex, readOptions);
    } catch (error) {
      if (isTonRpcVerificationSoftReadError(error) || noteTonRpcRateLimit(error)) continue;
      continue;
    }
    let currentLink = privateIndexLatestLink(senderIndex);
    let scanned = 0;
    while (currentLink > 0n && scanned < scanLimit) {
      if (publishConfirmDeadlineExpired(deadlineAt)) return;
      const entryId = privateIndexEntryIdFromLink(currentLink);
      if (entryId === null) break;
      let entry = null;
      try {
        entry = await candidateProvider.getPrivateEntry(entryId, readOptions);
      } catch (error) {
        if (isTonRpcVerificationSoftReadError(error) || noteTonRpcRateLimit(error)) break;
      }
      if (!entry?.exists) break;
      for (const part of privateParts) {
        if (part.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED) continue;
        if (!publishEntryMatchesPart(entry, part, { allowPublishIdMismatch: true })) continue;
        setPublishPartStatus(publishState, part.index, PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED, {
          entryId: String(entry.entry_id ?? entryId),
          confirmedBy: 'private_sender_index',
        });
      }
      if (privateParts.every((part) => part.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED)) break;
      const previousLink = privateIndexPreviousLink(entry, 'sender');
      if (previousLink === currentLink) break;
      currentLink = previousLink;
      scanned += 1;
    }
  }
}

// Group the still-pending parts of a publishState back into their VPB2 batches. Every part of a batch was
// stamped at send time with the SHARED batch nonce (part.clientNonce) and batch id (part.batchPublishId), plus
// its position within the batch (part.batchPartIndex). The receipt ring is keyed by nonce, so a batch is the
// set of pending parts that share a (clientNonce) — confirming a batch is a SINGLE receipt read.
function pendingPublishBatchesFromState(publishState) {
  const groups = new Map();
  for (const part of publishState?.parts ?? []) {
    if (part.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED) continue;
    if (part.clientNonce === undefined || part.clientNonce === null) continue;
    let nonce = null;
    try {
      nonce = BigInt(part.clientNonce);
    } catch {
      continue;
    }
    const key = nonce.toString();
    let group = groups.get(key);
    if (!group) {
      group = { nonce, parts: [] };
      groups.set(key, group);
    }
    group.parts.push(part);
  }
  return [...groups.values()];
}

// PRIMARY confirm: read the Vault receipt ring once per in-flight batch and map the outcome onto the per-part
// publishState statuses. The receipt is the authoritative, single-read answer for a batch's fate:
//   confirmed  -> the Hub stored entries first_entry_id .. +partCount-1; derive each part's entry id from its
//                 batchPartIndex (= EPI1 order) and mark it CAPSULEHUB_CONFIRMED.
//   rejected   -> post-accept atomic reject WITH refund; surface the reject code, mark the batch FAILED.
//   bounced    -> the Hub bounced, the call value was refunded; mark FAILED so the UI re-sends.
//   processing -> accepted, awaiting the Hub ACK; leave pending (entry-scan / a later receipt read settle it).
//   tombstoned -> a stale pending was pruned, but a late ACK can still confirm it; leave pending.
//   evicted    -> the slot no longer reports our nonce (a newer action overwrote it); leave to the entry scan.
async function confirmVaultBatchReceiptsFromPublishState(publishState, options = {}) {
  const batches = pendingPublishBatchesFromState(publishState);
  if (batches.length === 0) return 0;
  let provider = null;
  try {
    provider = await resolveVaultChainProvider(options.provider);
  } catch {
    return 0;
  }
  if (typeof provider?.getUserReceipts !== 'function') return 0;
  const owner = options.owner ?? plathoWallet?.address ?? null;
  if (!owner) return 0;
  const vaultAddress = requireVaultAddress();
  const deadlineAt = Number(options.deadlineAt ?? 0) || 0;
  // The receipt ring confirmation is authoritative, so it reads VERIFIED (dual-provider) fail-closed — a
  // CAPSULEHUB_CONFIRMED transition must never rest on a single unverified replica. Transient verification
  // failures simply leave the batch pending for the entry-scan recovery / a later receipt read.
  const readOptions = {
    verify: true,
    priority: 'critical',
    cacheTtlMs: 0,
  };
  if (options.requestTimeoutMs) readOptions.requestTimeoutMs = options.requestTimeoutMs;
  if (options.queueTimeoutMs) readOptions.queueTimeoutMs = options.queueTimeoutMs;
  let changed = 0;
  for (const batch of batches) {
    if (publishConfirmDeadlineExpired(deadlineAt)) break;
    let interp = null;
    try {
      interp = await readBatchPublishReceipt(provider, vaultAddress, owner, batch.nonce, readOptions);
    } catch (error) {
      // Rate limits propagate so the caller can fall back to SUBMITTED; a soft verification miss (RPC
      // disagreement / verifier unavailable) just leaves this batch pending for the entry-scan recovery.
      if (noteTonRpcRateLimit(error)) throw error;
      if (isTonRpcVerificationSoftReadError(error) || isTonRpcRecoverableReadError(error)) continue;
      continue;
    }
    if (!interp) continue;
    if (interp.status === BATCH_PUBLISH_RECEIPT_STATUS.CONFIRMED) {
      const firstEntryId = interp.firstEntryId === undefined || interp.firstEntryId === null
        ? null
        : BigInt(interp.firstEntryId);
      for (const part of batch.parts) {
        if (part.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED) continue;
        const batchPartIndex = Number(part.batchPartIndex ?? 0) || 0;
        const entryId = firstEntryId === null ? null : firstEntryId + BigInt(batchPartIndex);
        setPublishPartStatus(publishState, part.index, PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED, {
          entryId: entryId === null ? (part.entryId ?? null) : String(entryId),
          confirmedBy: 'vault_batch_receipt',
          error: null,
        });
        changed += 1;
      }
    } else if (interp.status === BATCH_PUBLISH_RECEIPT_STATUS.REJECTED) {
      const rejectCode = interp.rejectCode === undefined || interp.rejectCode === null
        ? null
        : `0x${Number(interp.rejectCode).toString(16)}`;
      const failPartIndex = interp.failPartIndex === undefined || interp.failPartIndex === null
        ? null
        : interp.failPartIndex.toString();
      const reason = `Vault rejected the batch publish${rejectCode ? ` (reject ${rejectCode}${failPartIndex !== null ? `, part ${failPartIndex}` : ''})` : ''}`;
      for (const part of batch.parts) {
        if (part.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED) continue;
        setPublishPartStatus(publishState, part.index, PUBLISH_PART_STATUS_FAILED, {
          error: reason,
          batchRejectCode: rejectCode,
          batchFailPartIndex: failPartIndex,
        });
        changed += 1;
      }
    } else if (interp.status === BATCH_PUBLISH_RECEIPT_STATUS.BOUNCED) {
      for (const part of batch.parts) {
        if (part.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED) continue;
        setPublishPartStatus(publishState, part.index, PUBLISH_PART_STATUS_FAILED, {
          error: 'CapsuleHub bounced the batch publish; the charge was refunded',
        });
        changed += 1;
      }
    }
    // processing / tombstoned / evicted: leave the parts pending for the entry-scan fallback below.
  }
  return changed;
}

async function confirmCapsuleHubPublishEntriesWithReadMode(publishState, options = {}) {
  const pendingParts = (publishState?.parts ?? []).filter((part) => (
    part.status === PUBLISH_PART_STATUS_VAULT_SUBMITTED
    || part.status === PUBLISH_PART_STATUS_SENT
    || part.status === PUBLISH_PART_STATUS_UNKNOWN
    || publishPartHadPriorChainAttempt(part)
  ));
  if (pendingParts.length === 0) return publishState;
  const deadlineAt = publishConfirmDeadlineAt(options);
  // VPB2 PRIMARY confirm: the Vault receipt ring is the authoritative, single-read answer for each in-flight
  // batch (confirmed/rejected/bounced/processing/tombstoned). It supersedes the obsolete VPB1 per-message
  // PublishAck history scan; the CapsuleHub entry-scan strategies below remain the recovery fallback when the
  // receipt is still processing or has been evicted from the ring.
  if (options.skipBatchReceipt !== true) {
    try {
      await confirmVaultBatchReceiptsFromPublishState(publishState, {
        owner: options.owner,
        provider: options.vaultProvider,
        deadlineAt,
        requestTimeoutMs: options.requestTimeoutMs ?? options.timeoutMs,
        queueTimeoutMs: options.queueTimeoutMs,
      });
    } catch (error) {
      if (!isTonRpcRecoverableReadError(error) && !noteTonRpcRateLimit(error)) console.error(error);
    }
  }
  if (pendingParts.every((part) => part.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED)) return publishState;
  if (publishConfirmDeadlineExpired(deadlineAt)) return publishState;
  const resolved = await resolveCapsuleHubProvider();
  if (!resolved) return publishState;
  const { provider, address } = resolved;
  const readOptions = publishConfirmReadOptions(address, options);
  const providerCandidates = capsuleHubConfirmationProviderCandidates(provider, address, {
    scanAvailableTransports: options.scanAvailableTransports,
  });
  const scanLimit = options.scanLimit ?? CAPSULEHUB_PUBLISH_CONFIRM_SCAN_LIMIT;
  if (publishConfirmDeadlineExpired(deadlineAt)) return publishState;
  await confirmPrivatePublishEntriesFromSenderIndex(publishState, pendingParts, providerCandidates, readOptions, {
    scanLimit,
    deadlineAt,
  });
  for (const candidateProvider of providerCandidates) {
    if (publishConfirmDeadlineExpired(deadlineAt)) return publishState;
    if (pendingParts.every((part) => part.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED)) break;
    try {
      const state = await candidateProvider.getState(readOptions);
      const groups = [
        {
          kind: 'private',
          latest: BigInt(state.private_latest_id ?? 0n),
          parts: pendingParts.filter((part) => publishPartKind(part) === 'private'),
          read: (entryId) => candidateProvider.getPrivateEntry(entryId, readOptions),
        },
        {
          kind: 'public',
          latest: BigInt(state.public_latest_id ?? 0n),
          parts: pendingParts.filter((part) => publishPartKind(part) === 'public'),
          read: (entryId) => candidateProvider.getPublicEntry(entryId, readOptions),
        },
      ];
      for (const group of groups) {
        if (publishConfirmDeadlineExpired(deadlineAt)) return publishState;
        if (group.parts.length === 0 || group.latest <= 0n) continue;
        const scan = publishConfirmScanBounds(publishState, group.kind, group.latest, scanLimit);
        if (!scan) continue;
        for (let entryId = scan.start; entryId >= scan.minEntryId; entryId -= 1n) {
          if (publishConfirmDeadlineExpired(deadlineAt)) return publishState;
          let entry = null;
          try {
            entry = await group.read(entryId);
          } catch (error) {
            if (isTonRpcRecoverableReadError(error)) throw error;
            if (noteTonRpcRateLimit(error)) throw error;
            continue;
          }
          for (const part of group.parts) {
            if (part.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED) continue;
            const requirePublishIdMatch = group.kind === 'public';
            const allowPublishIdMismatch = group.kind === 'private';
            // Public sends must confirm the current Vault BOC by publish_id; payload-only
            // public recovery is reserved for explicit already-published lookup paths.
            if (!publishEntryMatchesPart(entry, part, { allowPublishIdMismatch, requirePublishIdMatch })) continue;
            setPublishPartStatus(publishState, part.index, PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED, {
              entryId: String(entry.entry_id ?? entryId),
              confirmedBy: requirePublishIdMatch ? 'confirmed_by_publish_id' : 'entry_payload_recovery',
            });
          }
          if (group.parts.every((part) => part.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED)) break;
          if (entryId === 0n) break;
        }
        publishConfirmCommitScan(publishState, group.kind, scan.minEntryId);
      }
    } catch (error) {
      if (isTonRpcRecoverableReadError(error) || noteTonRpcRateLimit(error)) {
        continue;
      }
      throw error;
    }
  }
  return publishState;
}

function isFreshPrivatePublishConfirmation(message) {
  const ageMs = privatePendingPublishAgeMs(message);
  return ageMs >= 0 && ageMs <= PRIVATE_PUBLISH_CONFIRM_HOT_AGE_MS;
}

async function confirmCapsuleHubPublishEntries(publishState, options = {}) {
  return confirmCapsuleHubPublishEntriesWithReadMode(publishState, options.hot === true
    ? {
      ...options,
      scanLimit: options.scanLimit ?? CAPSULEHUB_PUBLISH_CONFIRM_HOT_SCAN_LIMIT,
      deadlineMs: options.deadlineMs ?? PRIVATE_PUBLISH_CONFIRM_HOT_DEADLINE_MS,
      requestTimeoutMs: options.requestTimeoutMs ?? PRIVATE_PUBLISH_CONFIRM_HOT_REQUEST_TIMEOUT_MS,
      queueTimeoutMs: options.queueTimeoutMs ?? PRIVATE_PUBLISH_CONFIRM_HOT_QUEUE_TIMEOUT_MS,
    }
    : options);
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

async function sendVaultExternalBoc(built, options = {}) {
  const transport = globalThis.plathoWalletRpcTransport ?? globalThis.plathoTonRpcTransport;
  if (!transport?.sendBoc) throw new Error('TON RPC sendBoc transport is not configured');
  const request = { boc: built.boc, walletAddress: requireVaultAddress() };
  if (options.requestTimeoutMs !== undefined) request.requestTimeoutMs = options.requestTimeoutMs;
  if (options.timeoutMs !== undefined) request.timeoutMs = options.timeoutMs;
  if (options.queueTimeoutMs !== undefined) request.queueTimeoutMs = options.queueTimeoutMs;
  if (options.skipIfRateLimited !== undefined) request.skipIfRateLimited = options.skipIfRateLimited;
  if (options.priority !== undefined) request.priority = options.priority;
  const result = await transport.sendBoc(request);
  markNavVaultBalancePending('Vault action submitted', {
    resetRetry: true,
    retry: true,
    retryDelayMs: 2_000,
  });
  return { ...built, result };
}

function shouldConfirmVaultPublishNonceAfterSend(index, total, options = {}) {
  return index < total - 1 || options.confirmFinalNonce === true;
}

async function readVaultPublishNonce(provider, owner, options = {}) {
  if (!provider?.getUser) return null;
  if (options.ignoreNonceBarrier !== true) await awaitVaultPublishNonceBarrier();
  const user = await provider.getUser(owner, {
    vaultAddress: requireVaultAddress(),
    verify: options.verify !== false,
    allowUnverifiedCriticalRead: options.allowUnverifiedCriticalRead === true,
    priority: 'critical',
    cacheTtlMs: 0,
    requestTimeoutMs: options.requestTimeoutMs ?? options.timeoutMs,
    queueTimeoutMs: options.queueTimeoutMs,
  });
  const nonce = BigInt(user.publish_nonce ?? user.publishNonce ?? 0n);
  raiseVaultPublishNonceFloor(owner, nonce);
  return nonce;
}

async function readVaultPublishNonceForOwnVaultAction(provider, owner, options = {}) {
  // Pre-sign nonce reads stay verified fail-closed in normal operation; the
  // unverified path opens only in degraded survival mode, where the primary
  // gateway is parked and dual-provider verification is structurally
  // impossible. A wrong nonce can only produce a cleanly rejected external.
  return callWithDegradedTransportReadFallback(
    () => readVaultPublishNonce(provider, owner, options),
    () => readVaultPublishNonce(provider, owner, { ...options, ...unverifiedCriticalChainReadOptions() }),
  );
}

async function waitForVaultPublishNonce(provider, owner, expectedNonce, options = {}) {
  const timeoutMs = Number(options.timeoutMs ?? VAULT_PUBLISH_NONCE_CONFIRM_TIMEOUT_MS);
  const deadline = Date.now() + (Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.floor(timeoutMs)
    : VAULT_PUBLISH_NONCE_CONFIRM_TIMEOUT_MS);
  // Post-broadcast nonce polling is observational: the publish outcome is
  // re-authenticated by CapsuleHub confirmation, while dual-provider reads
  // of a value that changes during the hot window turn legitimate
  // block-height skew into RPC_DISAGREEMENT failures. Poll unverified.
  const readOptions = {
    ...options,
    ignoreNonceBarrier: true,
    verify: false,
    allowUnverifiedCriticalRead: true,
  };
  let lastNonce = null;
  let lastError = null;
  let sawNonceRead = false;
  for (;;) {
    try {
      lastNonce = await readVaultPublishNonce(provider, owner, readOptions);
      lastError = null;
      sawNonceRead = true;
      if (lastNonce === null || lastNonce >= expectedNonce) break;
    } catch (error) {
      // The external is already broadcast; transient RPC trouble (rate
      // limits, provider disagreement, a blocked gateway failing over) must
      // not fail the publish. Keep polling until the deadline decides.
      if (!isTonRpcRecoverableReadError(error) && !isTonRpcRateLimitError(error)) throw error;
      lastError = error;
    }
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    let pollMs = VAULT_PUBLISH_NONCE_POLL_MS;
    if (lastError && isTonRpcRateLimitError(lastError)) {
      pollMs = Math.max(pollMs, Math.min(tonRpcLimitBackoffMs(lastError), remainingMs));
    }
    await delay(Math.max(250, Math.min(pollMs, remainingMs)));
  }
  if (lastNonce !== null && lastNonce >= expectedNonce) return lastNonce;
  if (sawNonceRead && lastNonce === null) return lastNonce;
  const error = new Error('Vault publish was not confirmed after broadcast');
  error.code = 'NETWORK_ERROR';
  if (lastError) error.cause = lastError;
  throw error;
}

async function waitForVaultPublishNonceForOwnVaultAction(provider, owner, expectedNonce, options = {}) {
  return waitForVaultPublishNonce(provider, owner, expectedNonce, options);
}

async function readVaultPublishNonceForBroadcastRetry(provider, owner, options = {}) {
  return callWithOwnVaultActionReadFallback(
    () => readVaultPublishNonceForOwnVaultAction(provider, owner, options),
    () => readVaultPublishNonce(provider, owner, { ...options, verify: false, allowUnverifiedCriticalRead: true }),
  );
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
  if (options.allowOwnVaultActionReadFallback === true) {
    const global = await readConnectedVaultGlobalForOwnVaultAction(provider);
    await requireCapsuleHubVaultRouteForPublish(global);
  } else {
    const global = await loadConnectedVaultGlobal({ provider, verify: true, priority: 'critical', cacheTtlMs: 0 });
    await requireCapsuleHubVaultRouteForPublish(global);
  }
  const user = options.allowOwnVaultActionReadFallback === true
    ? await readFreshConnectedVaultUserForOwnVaultAction(provider)
    : await loadConnectedVaultUser({ provider, verify: true, priority: 'critical', cacheTtlMs: 0 });
  if (user.exists !== true || BigInt(user.current_key_id ?? 0n) === 0n) {
    throw new Error('Activate Platho account before publishing');
  }
  requireVaultAuthSecretKey();
  assertNetworkFeeSurchargeWithinCap();
  const surcharge = currentNetworkFeeSurchargeNanotons();
  refreshComposerCostStatus();
  const quotedProfiles = composerPublishProfilesForCapsules(normalizedCapsules);
  const quotedHold = composerEstimatedMaxChargeNanotons(quotedProfiles, 1);
  const quotedNetCost = composerEstimatedNetCostNanotons(quotedProfiles, 1);
  const publishState = options.publishState ?? createCapsulePublishState(normalizedCapsules);
  const chargePlans = [];
  let totalMaxCharge = 0n;
  const canonicalChargeCache = new Map();
  for (let index = 0; index < normalizedCapsules.length; index += 1) {
    const capsule = normalizedCapsules[index];
    const publish = capsule.publish;
    const chargeKey = `${publish.publish_kind}:${publish.size_class}:${publish.crypto_suite}`;
    let canonicalMaxCharge = canonicalChargeCache.get(chargeKey);
    if (canonicalMaxCharge === undefined) {
      canonicalMaxCharge = options.allowOwnVaultActionReadFallback === true
        ? await readCanonicalPublishChargeForOwnVaultAction(provider, owner, publish.publish_kind, publish.size_class, publish.crypto_suite)
        : await provider.getCanonicalPublishCharge(
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
    chargePlans.push({ capsuleId: capsule.id, messageType, publish, maxCharge, partIndex: index });
  }
  const balance = BigInt(user.ton_balance ?? user.tonBalance ?? 0n);
  if (balance < totalMaxCharge) {
    throw new Error('Vault TON balance is too low for this publish');
  }
  const finalNetCost = composerNetCostFromHoldNanotons(totalMaxCharge, normalizedCapsules.length, quotedProfiles);
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
  return {
    normalizedCapsules,
    provider,
    owner,
    user,
    publishState,
    results: chargePlans,
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
  // VPB2: the flat per-capsule charge plan is packed into batches of
  // 1..MAX_BATCH_PARTS contiguous same-kind items; each batch is ONE signed
  // external consuming ONE strictly-sequential nonce. Every item in a batch
  // shares the fate of that single external (sent/unknown/failed together).
  const batches = groupPublishItemsIntoBatches(results);
  const sendTurn = await enterVaultPublishSendLock();
  try {
    await awaitVaultPublishNonceBarrier();
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const batch = batches[batchIndex];
      const pendingItems = batch.items.filter((item) => !publishPartAlreadyAttempted(publishState.parts?.[item.partIndex]));
      // A batch is atomic (one nonce, one external, one BPI1): it is sent only when EVERY item is still
      // pending. Once any item has been attempted the whole batch is in-flight, so we keep its state and never
      // re-send — re-sending here would re-publish (and re-charge) the already-attempted parts under a fresh
      // nonce. Deterministic grouping makes the mixed case unreachable; this guard keeps that invariant explicit.
      if (pendingItems.length !== batch.items.length) {
        for (const item of batch.items) {
          const existingPart = publishState.parts?.[item.partIndex];
          if (existingPart) notifyPublishState(options, publishState, existingPart);
        }
        continue;
      }
      for (const item of batch.items) {
        notifyPublishState(options, publishState, setPublishPartStatus(publishState, item.partIndex, PUBLISH_PART_STATUS_SENDING));
      }
      let batchExternal = null;
      try {
        let clientNonce = options.allowOwnVaultActionReadFallback === true
          ? await readVaultPublishNonceForOwnVaultAction(provider, owner)
          : await readVaultPublishNonce(provider, owner);
        if (clientNonce === null) throw new Error('Vault publish nonce could not be read before signing');
        const nonceFloor = vaultPublishNonceFloor(owner);
        if (clientNonce < nonceFloor) {
          // A lagging replica returned a nonce we already observed consumed
          // (or consumed ourselves by broadcasting). Re-read briefly, then
          // trust the monotonic floor: signing below it can only produce a
          // permanently rejected external racing our own in-flight one.
          const staleReadDeadline = Date.now() + 10_000;
          while (clientNonce < nonceFloor && Date.now() < staleReadDeadline) {
            await delay(500);
            try {
              const reread = await readVaultPublishNonce(provider, owner, {
                verify: false,
                allowUnverifiedCriticalRead: true,
                requestTimeoutMs: 4_000,
              });
              if (reread !== null && reread > clientNonce) clientNonce = reread;
            } catch (rereadError) {
              if (!isTonRpcRecoverableReadError(rereadError) && !isTonRpcRateLimitError(rereadError)) throw rereadError;
            }
          }
          if (clientNonce < nonceFloor) clientNonce = nonceFloor;
        }
        batch.clientNonce = clientNonce;
        // ONE signed batch external for the whole group.
        batchExternal = await buildBatchExternalFromPublishItems(batch, {
          owner,
          clientNonce,
          vaultAddress: requireVaultAddress(),
          manifestHash: requireVaultDeploymentManifestHash(),
          authSecretKey: requireVaultAuthSecretKey(),
        });
        batch.external = batchExternal;
        batch.batchPublishId = publishHashPlain(batchExternal.batchPublishId);
        const broadcastAt = new Date().toISOString();
        // Stamp each item with its per-entry EPI1 publish_id and the SHARED
        // batch external/nonce: the confirm + broadcast-retry + dropped-recovery
        // paths key on these per part, but all parts of a batch carry the SAME
        // external boc and nonce (the one in-flight message they all ride).
        for (let entryIndex = 0; entryIndex < batch.items.length; entryIndex += 1) {
          const item = batch.items[entryIndex];
          item.clientNonce = clientNonce;
          const epi1 = publishHashPlain(batchExternal.entryPublishIds[entryIndex]);
          item.publishId = epi1;
          item.external = batchExternal;
          const partWithPublishId = publishState.parts?.[item.partIndex];
          if (partWithPublishId) {
            partWithPublishId.publishId = epi1;
            partWithPublishId.clientNonce = clientNonce.toString();
            partWithPublishId.batchPublishId = batch.batchPublishId;
            partWithPublishId.batchPartIndex = entryIndex;
            if (publishPartKind(partWithPublishId) === 'public') partWithPublishId.authorWallet = owner;
            partWithPublishId.externalBoc = batchExternal.boc;
            partWithPublishId.maxCharge = (batchExternal.maxCharge ?? batch.items.reduce((sum, it) => sum + BigInt(it.maxCharge ?? 0n), 0n)).toString();
            partWithPublishId.lastBroadcastAt = broadcastAt;
            notifyPublishState(options, publishState, partWithPublishId);
          }
        }
        lastResult = await sendVaultExternalBoc(batchExternal);
        batch.result = lastResult;
        for (const item of batch.items) item.result = lastResult;
        // The signed external is now out: this nonce is consumed from the
        // client's point of view even before the chain reflects it.
        raiseVaultPublishNonceFloor(owner, clientNonce + 1n);
        for (const item of batch.items) {
          notifyPublishState(options, publishState, setPublishPartStatus(publishState, item.partIndex, PUBLISH_PART_STATUS_SENT));
        }
        if (shouldConfirmVaultPublishNonceAfterSend(batchIndex, batches.length, options)) {
          const nonceWaitOptions = {
            timeoutMs: options.timeoutMs ?? VAULT_PUBLISH_NONCE_CONFIRM_TIMEOUT_MS,
            requestTimeoutMs: options.requestTimeoutMs,
            queueTimeoutMs: options.queueTimeoutMs,
          };
          if (batchIndex < batches.length - 1) {
            // Middle batches: the contract consumes one strictly sequential
            // nonce per accepted batch, so the next batch cannot be signed
            // until this one is reflected on-chain.
            await waitForVaultPublishNonce(provider, owner, clientNonce + 1n, nonceWaitOptions);
            for (const item of batch.items) {
              notifyPublishState(options, publishState, setPublishPartStatus(publishState, item.partIndex, PUBLISH_PART_STATUS_VAULT_SUBMITTED));
            }
          } else {
            // Final batch: do not block CapsuleHub confirmation on the nonce
            // poll. Track it in the background; the barrier serializes any
            // following signed vault action instead of this await.
            const finalPartIndexes = batch.items.map((item) => item.partIndex);
            const expectedNonce = clientNonce + 1n;
            installVaultPublishNonceBarrier((async () => {
              try {
                await waitForVaultPublishNonce(provider, owner, expectedNonce, nonceWaitOptions);
                for (const partIndex of finalPartIndexes) {
                  const part = publishState.parts?.[partIndex];
                  if (part && part.status === PUBLISH_PART_STATUS_SENT) {
                    notifyPublishState(options, publishState, setPublishPartStatus(publishState, partIndex, PUBLISH_PART_STATUS_VAULT_SUBMITTED));
                  }
                }
              } catch {
                // Confirmation retries re-broadcast and re-check this batch;
                // a failed background nonce poll must not surface here.
              }
            })());
          }
        }
      } catch (error) {
        const sentBeforeFailure = Boolean(batch.result);
        const ambiguousBroadcast = !sentBeforeFailure && isAmbiguousTonRpcBroadcastError(error);
        const nextStatus = sentBeforeFailure || ambiguousBroadcast ? PUBLISH_PART_STATUS_UNKNOWN : PUBLISH_PART_STATUS_FAILED;
        // The whole batch shares the fate of its single external.
        for (const item of batch.items) {
          const part = setPublishPartStatus(publishState, item.partIndex, nextStatus, {
            error: String(error?.message ?? error),
          });
          notifyPublishState(options, publishState, part);
        }
        if (publishState.submittedCount > 0 || sentBeforeFailure || ambiguousBroadcast) publishState.status = VAULT_PUBLISH_STATUS_PARTIAL;
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
  } finally {
    sendTurn.release();
  }
  try {
    await confirmCapsuleHubPublishEntries(publishState, { hot: true });
  } catch (error) {
    const softVerification = isTonRpcRecoverableReadError(error);
    const rateLimited = noteTonRpcRateLimit(error);
    if (softVerification || rateLimited) {
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
  return (message?.publishState?.parts ?? []).some((part) => publishPartEligibleForChainConfirmation(part));
}

function privateMessageHasPartialRetryablePublish(message) {
  return privateMessageHasPublishAttempt(message)
    && message?.publishState?.status !== CAPSULEHUB_PUBLISH_STATUS_CONFIRMED
    && publishStateHasRetryableSendParts(message?.publishState);
}

function privateMessageHasAutoRecoveryPending(message) {
  if (!message || message.privateManualRetryAvailable === true) return false;
  if (message.privateSendRetryStopped === true || message.privatePublishConfirmStopped === true) return false;
  const hasSendJob = Boolean(message.privateSendRetryKey && privateSendRetryJobs.has(message.privateSendRetryKey));
  const hasConfirmJob = Boolean(message.privatePublishConfirmRetryKey && privatePublishConfirmJobs.has(message.privatePublishConfirmRetryKey));
  const hasStoredCapsules = (Array.isArray(message.capsules) && message.capsules.length > 0) || Boolean(message.capsule);
  const sendPending = hasStoredCapsules
    && publishStateHasRetryableSendParts(message.publishState)
    && (!isStalePrivatePendingPublish(message) || privateMessageHasPublishAttempt(message));
  const confirmPending = privateMessageHasPublishAttempt(message)
    && message.publishState?.status !== CAPSULEHUB_PUBLISH_STATUS_CONFIRMED
    && !isStalePrivatePendingPublishConfirmation(message);
  return hasSendJob || hasConfirmJob || sendPending || confirmPending;
}

function privatePartialPublishStartedAtMs(message) {
  const times = [];
  const createdAtMs = messageCreatedAtMs(message);
  if (createdAtMs !== null) times.push(createdAtMs);
  for (const part of message?.publishState?.parts ?? []) {
    for (const value of [part?.lastBroadcastAt, part?.updatedAt]) {
      const parsed = Date.parse(value ?? '');
      if (Number.isFinite(parsed) && parsed > 0) times.push(parsed);
    }
  }
  if (times.length > 0) return Math.min(...times);
  return publishStateUpdatedAtMs(message?.publishState);
}

function privatePartialSendRetryAgeMs(message) {
  const startedAtMs = privatePartialPublishStartedAtMs(message);
  return startedAtMs === null ? null : Math.max(0, Date.now() - startedAtMs);
}

function privatePartialSendRetryExpired(message) {
  if (!privateMessageHasPartialRetryablePublish(message)) return false;
  const ageMs = privatePartialSendRetryAgeMs(message);
  return ageMs !== null && ageMs >= PRIVATE_SEND_PARTIAL_RETRY_DEADLINE_MS;
}

function publishPartAlreadyAttempted(part) {
  return part?.status === PUBLISH_PART_STATUS_SENT
    || part?.status === PUBLISH_PART_STATUS_UNKNOWN
    || part?.status === PUBLISH_PART_STATUS_VAULT_SUBMITTED
    || part?.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED;
}

function publishPartHadPriorChainAttempt(part) {
  const previousStatus = part?.retryPreviousStatus;
  return previousStatus === PUBLISH_PART_STATUS_SENT
    || previousStatus === PUBLISH_PART_STATUS_UNKNOWN
    || previousStatus === PUBLISH_PART_STATUS_VAULT_SUBMITTED
    || previousStatus === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED;
}

function publishPartEligibleForChainConfirmation(part) {
  return publishPartAlreadyAttempted(part) || publishPartHadPriorChainAttempt(part);
}

function publishStateHasRetryableSendParts(publishState) {
  return (publishState?.parts ?? []).some((part) => !publishPartAlreadyAttempted(part));
}

function publishPartAwaitingCapsuleHubConfirmation(part) {
  return part?.status === PUBLISH_PART_STATUS_SENT
    || part?.status === PUBLISH_PART_STATUS_UNKNOWN
    || part?.status === PUBLISH_PART_STATUS_VAULT_SUBMITTED;
}

function publishPartCanFreshSendRetry(part) {
  if (!part || publishPartAlreadyAttempted(part)) return false;
  if (part.clientNonce !== undefined && part.clientNonce !== null) return false;
  if (typeof part.externalBoc === 'string' && part.externalBoc.length > 0) return false;
  if (publishIdForPart(part)) return false;
  return part.status === PUBLISH_PART_STATUS_BUILT
    || part.status === PUBLISH_PART_STATUS_SENDING
    || part.status === PUBLISH_PART_STATUS_FAILED;
}

function clearPublishPartSignedAttempt(part) {
  if (!part) return;
  delete part.clientNonce;
  delete part.publishId;
  delete part.externalBoc;
  delete part.lastBroadcastAt;
  delete part.lastBroadcastResult;
  delete part.lastBroadcastRetryError;
  delete part.lastBroadcastRetryErrorAt;
  delete part.broadcastRetryCount;
}

function publishPartNeedsBroadcastRetry(part) {
  return (
    part?.status === PUBLISH_PART_STATUS_SENT
    || part?.status === PUBLISH_PART_STATUS_UNKNOWN
  )
    && typeof part.externalBoc === 'string'
    && part.externalBoc.length > 0
    && part.clientNonce !== undefined
    && part.clientNonce !== null;
}

function publishPartBroadcastRetryCount(part) {
  const count = Number(part?.broadcastRetryCount ?? 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function publishPartLastBroadcastAgeMs(part) {
  const parsed = Date.parse(part?.lastBroadcastAt ?? '');
  return Number.isFinite(parsed) ? Math.max(0, Date.now() - parsed) : Infinity;
}

async function retryUnconfirmedVaultPublishBroadcasts(publishState, options = {}) {
  const retryableParts = (publishState?.parts ?? []).filter((part) => publishPartNeedsBroadcastRetry(part));
  if (retryableParts.length === 0) return 0;
  const provider = await resolveVaultChainProvider();
  const owner = options.owner ?? requirePlathoWalletAddress();
  const deadlineAt = publishConfirmDeadlineAt({
    deadlineMs: options.deadlineMs ?? PRIVATE_PUBLISH_BROADCAST_RETRY_DEADLINE_MS,
  });
  const readTimeoutMs = options.readTimeoutMs ?? options.requestTimeoutMs ?? PRIVATE_PUBLISH_BROADCAST_RETRY_READ_TIMEOUT_MS;
  const sendTimeoutMs = options.sendTimeoutMs ?? PRIVATE_PUBLISH_BROADCAST_RETRY_SEND_TIMEOUT_MS;
  const queueTimeoutMs = options.queueTimeoutMs ?? PRIVATE_PUBLISH_BROADCAST_RETRY_QUEUE_TIMEOUT_MS;
  let changed = 0;
  let currentNonce = null;
  try {
    currentNonce = await readVaultPublishNonceForBroadcastRetry(provider, owner, {
      requestTimeoutMs: readTimeoutMs,
      queueTimeoutMs,
    });
  } catch (error) {
    publishState.lastBroadcastRetryError = shortUiErrorText(error, 'broadcast retry read failed');
    publishState.lastBroadcastRetryErrorAt = new Date().toISOString();
    if (isTonRpcTransientError(error) || noteTonRpcRateLimit(error)) return 0;
    throw error;
  }
  // VPB2: every part of a batch shares ONE externalBoc + nonce. Group the retryable parts by that shared nonce
  // so each distinct in-flight external is re-broadcast at most ONCE per pass; all parts of the batch then move
  // together (the contract accepts or rejects the single external atomically).
  const retryBatches = new Map();
  for (const part of retryableParts) {
    let clientNonce = null;
    try {
      clientNonce = BigInt(part.clientNonce);
    } catch {
      continue;
    }
    const key = clientNonce.toString();
    let group = retryBatches.get(key);
    if (!group) {
      group = { clientNonce, parts: [] };
      retryBatches.set(key, group);
    }
    group.parts.push(part);
  }
  for (const group of retryBatches.values()) {
    if (publishConfirmDeadlineExpired(deadlineAt)) break;
    const { clientNonce, parts } = group;
    if (currentNonce !== null && currentNonce > clientNonce) {
      // The chain consumed this batch's nonce: the external landed. Every part of the batch is on-chain.
      for (const part of parts) {
        setPublishPartStatus(publishState, part.index, PUBLISH_PART_STATUS_VAULT_SUBMITTED, {
          confirmedBy: 'vault_nonce',
          error: null,
        });
        changed += 1;
      }
      continue;
    }
    if (currentNonce !== null && currentNonce < clientNonce) continue;
    // Per-part retry budget/cooldown is identical across a batch (shared lastBroadcastAt/count); read it off the head.
    const head = parts[0];
    const retryCount = publishPartBroadcastRetryCount(head);
    if (retryCount >= PRIVATE_PUBLISH_BROADCAST_RETRY_LIMIT) continue;
    if (publishPartLastBroadcastAgeMs(head) < PRIVATE_PUBLISH_BROADCAST_RETRY_AFTER_MS) continue;
    let result = null;
    try {
      result = await sendVaultExternalBoc({ boc: head.externalBoc }, {
        requestTimeoutMs: sendTimeoutMs,
        queueTimeoutMs,
        skipIfRateLimited: true,
        priority: 'background',
      });
    } catch (error) {
      const retryError = shortUiErrorText(error, 'broadcast retry failed');
      const retryErrorAt = new Date().toISOString();
      for (const part of parts) {
        part.lastBroadcastRetryError = retryError;
        part.lastBroadcastRetryErrorAt = retryErrorAt;
      }
      if (isTonRpcTransientError(error) || noteTonRpcRateLimit(error)) continue;
      throw error;
    }
    const broadcastAt = new Date().toISOString();
    for (const part of parts) {
      part.lastBroadcastResult = result?.result ?? null;
      setPublishPartStatus(publishState, part.index, PUBLISH_PART_STATUS_SENT, {
        broadcastRetryCount: retryCount + 1,
        lastBroadcastAt: broadcastAt,
        error: null,
      });
      changed += 1;
    }
  }
  return changed;
}

async function retryUnconfirmedPrivatePublishBroadcasts(publishState, options = {}) {
  return retryUnconfirmedVaultPublishBroadcasts(publishState, options);
}

function markPublishStateAwaitingPartsForRetry(publishState, reason = 'missing CapsuleHub entry') {
  const parts = publishState?.parts ?? [];
  const confirmedCount = parts.filter((part) => part?.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED).length;
  if (parts.length <= 0 || confirmedCount >= parts.length) return 0;
  let changed = 0;
  for (const part of parts) {
    if (!publishPartCanFreshSendRetry(part)) continue;
    const previousStatus = part.status;
    clearPublishPartSignedAttempt(part);
    setPublishPartStatus(publishState, part.index, PUBLISH_PART_STATUS_BUILT, {
      error: null,
      retryReason: reason,
      retryPreviousStatus: previousStatus,
    });
    changed += 1;
  }
  return changed;
}

function markStaleUnconfirmedPublishPartsForRetry(message, reason = 'missing CapsuleHub entry') {
  const publishState = message?.publishState;
  const parts = publishState?.parts ?? [];
  const confirmedCount = parts.filter((part) => part?.status === PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED).length;
  if (parts.length <= 0 || confirmedCount >= parts.length) return 0;
  const createdAtMs = messageCreatedAtMs(message) ?? publishStateUpdatedAtMs(publishState);
  if (createdAtMs !== null && Date.now() - createdAtMs < PRIVATE_PUBLISH_MISSING_PART_RETRY_AFTER_MS) return 0;
  return markPublishStateAwaitingPartsForRetry(publishState, reason);
}

function publishPartSignedAndUnconfirmed(part) {
  return (
    part?.status === PUBLISH_PART_STATUS_SENT
    || part?.status === PUBLISH_PART_STATUS_UNKNOWN
    || part?.status === PUBLISH_PART_STATUS_VAULT_SUBMITTED
  )
    && typeof part.externalBoc === 'string'
    && part.externalBoc.length > 0
    && part.clientNonce !== undefined
    && part.clientNonce !== null;
}

// Walks the sender's own private index back past the part's broadcast moment.
// Every accepted private entry of this sender is linked in that index, so a
// completed walk without a payload match is proof the publish never landed.
async function provePublishPartAbsentFromSenderIndex(publishState, part) {
  if (!localRecipientKeyPair?.keyId) return 'inconclusive';
  const resolved = await resolveCapsuleHubProvider();
  if (!resolved) return 'inconclusive';
  const { provider, address } = resolved;
  const readOptions = publishConfirmReadOptions(address, { requestTimeoutMs: 6_000 });
  const broadcastAtS = Math.floor(Date.parse(part.lastBroadcastAt ?? '') / 1000);
  if (!Number.isFinite(broadcastAtS)) return 'inconclusive';
  const cutoffS = broadcastAtS - PRIVATE_PUBLISH_DROPPED_RECOVERY_BROADCAST_MARGIN_S;
  const keyIdIndex = privateKeyIdIndexValue(localRecipientKeyPair.keyId);
  let senderIndex = null;
  try {
    senderIndex = await provider.getPrivateSenderIndex(keyIdIndex, readOptions);
  } catch {
    return 'inconclusive';
  }
  let currentLink = privateIndexLatestLink(senderIndex);
  let scanned = 0;
  let reachedCutoff = false;
  while (currentLink > 0n && scanned < PRIVATE_PUBLISH_DROPPED_RECOVERY_SCAN_LIMIT) {
    const entryId = privateIndexEntryIdFromLink(currentLink);
    if (entryId === null) break;
    let entry = null;
    try {
      entry = await provider.getPrivateEntry(entryId, readOptions);
    } catch {
      return 'inconclusive';
    }
    if (!entry?.exists) break;
    if (publishEntryMatchesPart(entry, part, { allowPublishIdMismatch: true })) {
      setPublishPartStatus(publishState, part.index, PUBLISH_PART_STATUS_CAPSULEHUB_CONFIRMED, {
        entryId: String(entry.entry_id ?? entryId),
        confirmedBy: 'dropped_recovery_scan',
        error: null,
      });
      return 'found';
    }
    const createdAt = Number(entry.created_at ?? entry.createdAt ?? 0);
    if (Number.isFinite(createdAt) && createdAt > 0 && createdAt < cutoffS) {
      reachedCutoff = true;
      break;
    }
    const previousLink = privateIndexPreviousLink(entry, 'sender');
    if (previousLink === currentLink) break;
    currentLink = previousLink;
    scanned += 1;
  }
  // Absence is proven when the walk got past the broadcast window, or the
  // index simply has no entries newer than it.
  if (reachedCutoff || currentLink <= 0n) return 'absent';
  return 'inconclusive';
}

// Recovers parts wedged by a dropped/raced publish external: the chain nonce
// moved past the signed nonce (a re-broadcast can never be accepted again),
// and the entry is provably absent from the sender index. Such parts are
// reset to BUILT so the normal send path re-signs them with a fresh nonce.
async function recoverDroppedSignedPublishParts(message) {
  const publishState = message?.publishState;
  const candidates = (publishState?.parts ?? []).filter((part) => publishPartSignedAndUnconfirmed(part)
    && publishPartLastBroadcastAgeMs(part) >= PRIVATE_PUBLISH_DROPPED_RECOVERY_AFTER_MS
    && (Number(part.droppedRecoveryCount ?? 0) || 0) < PRIVATE_PUBLISH_DROPPED_RECOVERY_MAX_RESIGNS);
  if (candidates.length === 0) return { resigned: 0, confirmed: 0 };
  let chainNonce = null;
  try {
    const provider = await resolveVaultChainProvider();
    const owner = requirePlathoWalletAddress();
    chainNonce = await readVaultPublishNonce(provider, owner, {
      ignoreNonceBarrier: true,
      verify: false,
      allowUnverifiedCriticalRead: true,
      requestTimeoutMs: 6_000,
    });
  } catch {
    return { resigned: 0, confirmed: 0 };
  }
  if (chainNonce === null) return { resigned: 0, confirmed: 0 };
  let resigned = 0;
  let confirmed = 0;
  for (const part of candidates) {
    let clientNonce = null;
    try {
      clientNonce = BigInt(part.clientNonce);
    } catch {
      continue;
    }
    // While the chain nonce has not moved past the signed nonce, the
    // existing re-broadcast path can still land this exact external.
    if (chainNonce <= clientNonce) continue;
    const verdict = await provePublishPartAbsentFromSenderIndex(publishState, part);
    if (verdict === 'found') {
      confirmed += 1;
      continue;
    }
    if (verdict !== 'absent') continue;
    const previousStatus = part.status;
    const droppedRecoveryCount = (Number(part.droppedRecoveryCount ?? 0) || 0) + 1;
    clearPublishPartSignedAttempt(part);
    setPublishPartStatus(publishState, part.index, PUBLISH_PART_STATUS_BUILT, {
      error: null,
      retryReason: 'publish external dropped on-chain; re-signing with a fresh nonce',
      retryPreviousStatus: previousStatus,
      droppedRecoveryCount,
    });
    resigned += 1;
  }
  return { resigned, confirmed };
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

function publishStateUpdatedAtMs(publishState) {
  const parsed = Date.parse(publishState?.updatedAt ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function privatePendingPublishAgeMs(message) {
  const timestamp = publishStateUpdatedAtMs(message?.publishState) ?? messageCreatedAtMs(message);
  return timestamp === null ? 0 : Math.max(0, Date.now() - timestamp);
}

function isStalePrivatePendingPublish(message) {
  return privatePendingPublishAgeMs(message) > PRIVATE_PENDING_PUBLISH_STALE_AFTER_MS;
}

function isStalePrivatePendingPublishConfirmation(message) {
  return privatePendingPublishAgeMs(message) > PRIVATE_PENDING_PUBLISH_CONFIRMATION_STALE_AFTER_MS;
}

function stopPrivateSendRetry(context, error = null) {
  const { thread, message } = context;
  if (!thread?.messages?.includes(message)) return;
  clearPrivateSendRetry(message);
  message.privateSendRetryStopped = true;
  message.privateSendRetryStoppedAt = new Date().toISOString();
  message.meta = privateSendRetryExhaustedStatusText(error);
  message.privateManualRetryAvailable = true;
  message.privateCancelAvailable = privateMessageCanLocalCancel(message);
  message.privateSendLastError = shortUiErrorText(error, 'send retry stopped');
  thread.state = 'blocked';
  refreshThreadAfterMessageChange(thread);
  renderThreads();
  renderConversation();
  updateMessageInEncryptedHistory(thread, message).catch((historyError) => console.error(historyError));
}

function schedulePrivateSendRetry(context, error) {
  const { thread, message } = context;
  if (!thread?.messages?.includes(message)) return;
  if (message.privateSendRetryStopped === true) return;
  const attempt = Number(context.retryAttempt ?? message.privateSendRetryAttempt ?? 0) || 0;
  if (isStalePrivatePendingPublish(message) && !privateMessageHasPublishAttempt(message)) {
    stopPrivateSendRetry(context, { message: 'retry window expired', code: 'STALE_PRIVATE_PUBLISH' });
    return;
  }
  if (privatePartialSendRetryExpired(message)) {
    stopPartialPrivatePublishRecovery(context, { message: 'partial publish retry window expired', code: 'PARTIAL_PRIVATE_PUBLISH_RETRY_EXPIRED' });
    return;
  }
  if (attempt >= privateSendRetryMaxAttempts(error, message)) {
    message.privateSendRetryAttempt = attempt;
    if (!message.localHistoryId && !privateMessageHasPublishAttempt(message)) {
      markPrivateMessageManualRecovery(context, error, privateSendRetryExhaustedStatusText(error));
      if (privateComposerCostStatus && thread.id === activeThreadId) {
        privateComposerCostStatus.textContent = privateSendRetryExhaustedStatusText(error);
        privateComposerCostStatus.dataset.state = 'short';
      }
      return;
    }
    if (privateMessageHasPartialRetryablePublish(message)) {
      stopPartialPrivatePublishRecovery(context, { message: 'partial publish retry limit reached', code: 'PARTIAL_PRIVATE_PUBLISH_RETRY_EXPIRED' });
    } else {
      stopPrivateSendRetry(context, error);
    }
    if (privateComposerCostStatus && thread.id === activeThreadId) {
      privateComposerCostStatus.textContent = privateSendRetryExhaustedStatusText(error);
      privateComposerCostStatus.dataset.state = 'short';
    }
    return;
  }
  clearPrivateMessageManualRecovery(message);
  const delayMs = privateSendRetryDelayMs(error, attempt);
  context.retryAttempt = attempt + 1;
  message.privateSendRetryAttempt = context.retryAttempt;
  const scheduledAt = Date.now();
  message.privateSendRetryLastScheduledAt = new Date(scheduledAt).toISOString();
  message.privateSendRetryDelayMs = delayMs;
  message.privateSendRetryNextAt = new Date(scheduledAt + delayMs).toISOString();
  message.privateSendRetryLastError = error ? shortUiErrorText(error, 'send retry delayed') : null;
  refreshPrivateSendRetryUi(thread, message, privateSendRetryMeta(error));
  const key = privateSendRetryKey(message);
  const previous = privateSendRetryJobs.get(key);
  if (previous?.timer) window.clearTimeout(previous.timer);
  const timer = window.setTimeout(() => {
    privateSendRetryJobs.delete(key);
    runPrivateSendRetry(context).catch((retryError) => console.error(retryError));
  }, delayMs);
  privateSendRetryJobs.set(key, { timer, context });
}

function privateSendRetryContextForMessage(thread, message) {
  const draft = message?.privateDraft ?? {};
  const payment = message?.payment ?? null;
  const hasPaymentIntent = paymentHasIntent(payment) || message?.paymentIntentCreated === true;
  return {
    thread,
    message,
    text: draft.text ?? message?.text ?? '',
    attachments: normalizePrivateImageAttachments(draft.attachments ?? []),
    paymentDraft: hasPaymentIntent ? null : (draft.paymentDraft ?? message?.paymentDraft ?? null),
    selectedSuite: draft.selectedSuite ?? VAULT_RECEIVE_CRYPTO_SUITE,
    senderOptions: draft.senderOptions ?? message?.senderOptions ?? null,
    payment,
    paymentIntentCreated: hasPaymentIntent,
    retryAttempt: Number(message?.privateSendRetryAttempt ?? 0) || 0,
    confirmAttempt: Number(message?.privatePublishConfirmAttempt ?? 0) || 0,
  };
}

function revivePartialPrivateSendRetry(message) {
  if (!privateMessageHasPartialRetryablePublish(message)) return false;
  if (privatePartialSendRetryExpired(message)) return false;
  if (message?.privateSendRetryStopped !== true) return false;
  message.privateSendRetryStopped = false;
  message.privateSendRetryStoppedAt = null;
  message.privateSendRetryLastError = 'resuming partial publish';
  message.privateSendRetryAttempt = 0;
  return true;
}

function ensurePendingPrivateSendRetry(thread, message, error = { message: 'resume missing capsule parts', code: 'NETWORK_ERROR' }) {
  const revived = revivePartialPrivateSendRetry(message);
  if (!hasPendingPrivateSendRetry(message)) return false;
  const existingKey = message.privateSendRetryKey;
  if (existingKey && privateSendRetryJobs.has(existingKey)) return false;
  schedulePrivateSendRetry(privateSendRetryContextForMessage(thread, message), revived
    ? { message: 'resuming partial publish send', code: 'NETWORK_ERROR' }
    : error);
  return true;
}

function privatePublishConfirmStoppedStatusText(error = null) {
  if (error?.code === 'STALE_PRIVATE_PUBLISH') return 'not confirmed: chain lookup expired';
  if (error?.code === 'PARTIAL_PRIVATE_PUBLISH_RETRY_EXPIRED') {
    return /limit/i.test(String(error?.message ?? ''))
      ? 'not confirmed: partial publish retry limit reached'
      : 'not confirmed: partial publish retry window expired';
  }
  if (isTonRpcVerificationUnavailableError(error)) return 'not confirmed: RPC verification unavailable';
  if (isTonRpcRateLimitError(error)) return 'not confirmed: RPC stayed busy';
  const reason = privateSendPreflightStatusText(error);
  return reason && reason !== 'Send blocked'
    ? `not confirmed: ${reason}`
    : 'not confirmed: chain lookup timed out';
}

function stopPrivatePublishConfirmationRetry(context, error = null) {
  const { thread, message } = context;
  if (!thread?.messages?.includes(message)) return;
  clearPrivatePublishConfirmRetry(message);
  message.privatePublishConfirmStopped = true;
  message.privatePublishConfirmStoppedAt = new Date().toISOString();
  message.meta = privatePublishConfirmStoppedStatusText(error);
  message.privateManualRetryAvailable = true;
  message.privateCancelAvailable = false;
  message.privateSendLastError = shortUiErrorText(error, 'confirmation stopped');
  thread.state = 'blocked';
  refreshThreadAfterMessageChange(thread);
  renderThreads();
  renderConversation();
  updateMessageInEncryptedHistory(thread, message).catch((historyError) => console.error(historyError));
}

function stopPartialPrivatePublishRecovery(context, error = { message: 'partial publish retry window expired', code: 'PARTIAL_PRIVATE_PUBLISH_RETRY_EXPIRED' }) {
  const { thread, message } = context;
  if (!thread?.messages?.includes(message)) return false;
  if (!privateMessageHasPartialRetryablePublish(message)) return false;
  const forcedStop = error?.code === 'PARTIAL_PRIVATE_PUBLISH_RETRY_EXPIRED'
    && /limit/i.test(String(error?.message ?? ''));
  if (!privatePartialSendRetryExpired(message) && !forcedStop) return false;
  clearPrivateSendRetry(message);
  clearPrivatePublishConfirmRetry(message);
  message.privateSendRetryStopped = true;
  message.privateSendRetryStoppedAt = new Date().toISOString();
  message.privateSendRetryLastError = shortUiErrorText(error, 'partial publish expired');
  message.privatePublishConfirmStopped = true;
  message.privatePublishConfirmStoppedAt = new Date().toISOString();
  message.privatePublishConfirmLastResult = 'partial-expired';
  message.privatePublishConfirmLastError = shortUiErrorText(error, 'partial publish expired');
  message.meta = privatePublishConfirmStoppedStatusText(error);
  message.privateManualRetryAvailable = true;
  message.privateCancelAvailable = false;
  message.privateSendLastError = shortUiErrorText(error, 'partial publish expired');
  thread.state = 'blocked';
  refreshThreadAfterMessageChange(thread);
  renderThreads();
  renderConversation();
  updateMessageInEncryptedHistory(thread, message).catch((historyError) => console.error(historyError));
  return true;
}

function schedulePrivatePublishConfirmationRetry(context, error = null) {
  const { thread, message } = context;
  if (!thread?.messages?.includes(message) || !privateMessageHasPublishAttempt(message)) return;
  const attempt = Number(context.confirmAttempt ?? message.privatePublishConfirmAttempt ?? 0);
  if (message.privatePublishConfirmStopped === true) return;
  if (stopPartialPrivatePublishRecovery(context)) return;
  if (isStalePrivatePendingPublishConfirmation(message)) {
    stopPrivatePublishConfirmationRetry(context, { message: 'chain lookup expired', code: 'STALE_PRIVATE_PUBLISH' });
    return;
  }
  clearPrivateMessageManualRecovery(message);
  const delayMs = isTonRpcRateLimitError(error)
    ? tonRpcLimitBackoffMs(error)
    : (attempt >= PRIVATE_PUBLISH_CONFIRM_ACTIVE_ATTEMPT_LIMIT
      ? PRIVATE_PUBLISH_CONFIRM_BACKGROUND_RETRY_MS
      : PRIVATE_PUBLISH_CONFIRM_RETRY_DELAYS_MS[Math.min(attempt, PRIVATE_PUBLISH_CONFIRM_RETRY_DELAYS_MS.length - 1)]);
  context.confirmAttempt = attempt + 1;
  message.privatePublishConfirmAttempt = context.confirmAttempt;
  const scheduledAt = Date.now();
  message.privatePublishConfirmLastScheduledAt = new Date(scheduledAt).toISOString();
  message.privatePublishConfirmDelayMs = delayMs;
  message.privatePublishConfirmNextAt = new Date(scheduledAt + delayMs).toISOString();
  message.privatePublishConfirmLastError = error ? shortUiErrorText(error, 'confirm retry delayed') : null;
  const baseMeta = publishStateMeta(message.publishState);
  message.meta = attempt >= 6 && baseMeta.includes('confirming')
    ? `${baseMeta} - still checking`
    : baseMeta;
  globalThis.plathoLastPrivatePublishConfirmSchedule = {
    attempt: context.confirmAttempt,
    delayMs,
    meta: message.meta,
    error: message.privatePublishConfirmLastError,
    at: message.privatePublishConfirmLastScheduledAt,
    nextAt: message.privatePublishConfirmNextAt,
  };
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

function shouldRunImmediatePrivatePublishConfirmation(message) {
  const parts = message?.publishState?.parts ?? [];
  return hasPendingPrivatePublishConfirmation(message)
    && (isFreshPrivatePublishConfirmation(message)
      || privatePendingPublishAgeMs(message) >= PRIVATE_PUBLISH_MISSING_PART_RETRY_AFTER_MS)
    && parts.some((part) => publishPartAwaitingCapsuleHubConfirmation(part) || publishPartHadPriorChainAttempt(part));
}

function scheduleImmediatePrivatePublishConfirmation(context) {
  const { thread, message } = context;
  if (!thread?.messages?.includes(message) || !shouldRunImmediatePrivatePublishConfirmation(message)) return false;
  const key = privatePublishConfirmRetryKey(message);
  const previous = privatePublishConfirmJobs.get(key);
  if (previous?.timer) window.clearTimeout(previous.timer);
  context.confirmAttempt = 0;
  message.privatePublishConfirmAttempt = 0;
  const scheduledAt = Date.now();
  message.privatePublishConfirmLastScheduledAt = new Date(scheduledAt).toISOString();
  message.privatePublishConfirmDelayMs = 0;
  message.privatePublishConfirmNextAt = new Date(scheduledAt).toISOString();
  message.privatePublishConfirmLastResult = 'immediate';
  const timer = window.setTimeout(() => {
    privatePublishConfirmJobs.delete(key);
    runPrivatePublishConfirmationRetry(context).catch((confirmError) => console.error(confirmError));
  }, 0);
  privatePublishConfirmJobs.set(key, { timer, context });
  return true;
}

async function runPrivatePublishConfirmationRetry(context) {
  const { thread, message } = context;
  if (!thread?.messages?.includes(message) || !privateMessageHasPublishAttempt(message)) return;
  if (stopPartialPrivatePublishRecovery(context)) return;
  if (isStalePrivatePendingPublishConfirmation(message)) {
    stopPrivatePublishConfirmationRetry(context, { message: 'chain lookup expired', code: 'STALE_PRIVATE_PUBLISH' });
    return;
  }
  if (privateChainSyncPromise) {
    const key = privatePublishConfirmRetryKey(message);
    const previous = privatePublishConfirmJobs.get(key);
    if (previous?.timer) window.clearTimeout(previous.timer);
    const scheduledAt = Date.now();
    message.privatePublishConfirmLastRunAt = new Date(scheduledAt).toISOString();
    message.privatePublishConfirmLastResult = 'sync-busy';
    message.privatePublishConfirmDelayMs = 2_500;
    message.privatePublishConfirmNextAt = new Date(scheduledAt + 2_500).toISOString();
    refreshThreadAfterMessageChange(thread);
    renderThreads();
    renderConversation();
    updateMessageInEncryptedHistory(thread, message).catch((historyError) => console.error(historyError));
    const timer = window.setTimeout(() => {
      privatePublishConfirmJobs.delete(key);
      runPrivatePublishConfirmationRetry(context).catch((confirmError) => console.error(confirmError));
    }, 2_500);
    privatePublishConfirmJobs.set(key, { timer, context });
    return;
  }
  const endPrivateOutboundWork = beginPrivateOutboundWork();
  try {
    const runAt = Date.now();
    message.privatePublishConfirmLastRunAt = new Date(runAt).toISOString();
    message.privatePublishConfirmRunCount = (Number(message.privatePublishConfirmRunCount ?? 0) || 0) + 1;
    message.privatePublishConfirmLastResult = 'checking';
    message.privatePublishConfirmNextAt = null;
    const broadcastRetries = await retryUnconfirmedPrivatePublishBroadcasts(message.publishState, {
      deadlineMs: PRIVATE_PUBLISH_BROADCAST_RETRY_DEADLINE_MS,
      readTimeoutMs: PRIVATE_PUBLISH_BROADCAST_RETRY_READ_TIMEOUT_MS,
      sendTimeoutMs: PRIVATE_PUBLISH_BROADCAST_RETRY_SEND_TIMEOUT_MS,
      queueTimeoutMs: PRIVATE_PUBLISH_BROADCAST_RETRY_QUEUE_TIMEOUT_MS,
    });
    if (broadcastRetries > 0 && publishStateHasRetryableSendParts(message.publishState)) {
      message.privatePublishConfirmLastResult = `rebroadcast=${broadcastRetries}`;
      message.meta = publishStateMeta(message.publishState);
      thread.state = 'pending';
      await updateMessageInEncryptedHistory(thread, message);
      refreshThreadAfterMessageChange(thread);
      renderThreads();
      renderConversation();
      clearPrivatePublishConfirmRetry(message);
      schedulePrivateSendRetry(context, {
        code: 'NETWORK_ERROR',
        message: 'Retrying unsent capsule parts',
      });
      return;
    }
    const freshConfirmation = isFreshPrivatePublishConfirmation(message);
    const confirmOptions = freshConfirmation
      ? { hot: true }
      : {
        deadlineMs: PRIVATE_PUBLISH_CONFIRM_RECOVERY_DEADLINE_MS,
        requestTimeoutMs: PRIVATE_PUBLISH_CONFIRM_RECOVERY_REQUEST_TIMEOUT_MS,
        queueTimeoutMs: PRIVATE_PUBLISH_CONFIRM_RECOVERY_QUEUE_TIMEOUT_MS,
      };
    const confirmStartedAt = Date.now();
    await confirmCapsuleHubPublishEntries(message.publishState, confirmOptions);
    const droppedRecovery = message.publishState?.status === CAPSULEHUB_PUBLISH_STATUS_CONFIRMED
      ? { resigned: 0, confirmed: 0 }
      : await recoverDroppedSignedPublishParts(message);
    const retryableMissingParts = markStaleUnconfirmedPublishPartsForRetry(message, 'missing CapsuleHub entry')
      + droppedRecovery.resigned;
    const sendRetryScheduled = ensurePendingPrivateSendRetry(thread, message, {
      code: 'NETWORK_ERROR',
      message: retryableMissingParts > 0
        ? `Retrying ${retryableMissingParts} missing CapsuleHub part${retryableMissingParts === 1 ? '' : 's'}`
        : 'Retrying unsent capsule parts',
    });
    const statusAfterConfirm = message.publishState?.status === CAPSULEHUB_PUBLISH_STATUS_CONFIRMED
      ? 'confirmed'
      : `pending c${Number(message.publishState?.confirmedCount ?? 0)}/${Math.max(1, Number(message.publishState?.partCount) || 1)}`;
    const confirmDeadlineMs = freshConfirmation
      ? PRIVATE_PUBLISH_CONFIRM_HOT_DEADLINE_MS
      : PRIVATE_PUBLISH_CONFIRM_RECOVERY_DEADLINE_MS;
    const confirmTimedOut = message.publishState?.status !== CAPSULEHUB_PUBLISH_STATUS_CONFIRMED
      && Date.now() - confirmStartedAt >= Math.max(1000, confirmDeadlineMs - 500);
    const statusResult = confirmTimedOut ? `${statusAfterConfirm} timeout` : statusAfterConfirm;
    message.privatePublishConfirmLastResult = broadcastRetries > 0
      ? `${statusResult} rebroadcast=${broadcastRetries}`
      : (sendRetryScheduled ? `${statusResult} send-retry` : statusResult);
    message.meta = publishStateMeta(message.publishState);
    thread.state = message.publishState?.status === CAPSULEHUB_PUBLISH_STATUS_CONFIRMED ? 'sealed' : 'pending';
    await updateMessageInEncryptedHistory(thread, message);
    refreshThreadAfterMessageChange(thread);
    renderThreads();
    renderConversation();
    if (message.publishState?.status !== CAPSULEHUB_PUBLISH_STATUS_CONFIRMED) {
      schedulePrivatePublishConfirmationRetry(context);
    } else {
      message.privatePublishConfirmAttempt = 0;
      message.privatePublishConfirmStopped = false;
      message.privatePublishConfirmStoppedAt = null;
      clearPrivatePublishConfirmRetry(message);
      if (message.payment) await removePendingPaymentCheckLedgerRecord(message.payment);
    }
  } catch (error) {
    const rateLimited = noteTonRpcRateLimit(error);
    const softVerification = isTonRpcRecoverableReadError(error);
    if (!rateLimited && !softVerification) console.error(error);
    message.privatePublishConfirmLastRunAt = new Date().toISOString();
    message.privatePublishConfirmLastResult = softVerification ? 'rpc delayed' : 'error';
    message.privatePublishConfirmLastError = shortUiErrorText(error, 'confirm failed');
    schedulePrivatePublishConfirmationRetry(context, error);
  } finally {
    endPrivateOutboundWork();
  }
}

function hasPendingPrivatePublishConfirmation(message) {
  return privateMessageHasPublishAttempt(message)
    && message?.privatePublishConfirmStopped !== true
    && !privatePartialSendRetryExpired(message)
    && !isStalePrivatePendingPublishConfirmation(message)
    && message?.publishState?.status !== CAPSULEHUB_PUBLISH_STATUS_CONFIRMED;
}

function resumePendingPrivatePublishConfirmations() {
  if (document.hidden) return;
  for (const thread of threads) {
    for (const message of thread.messages ?? []) {
      if (stopPartialPrivatePublishRecovery({ thread, message })) continue;
      ensurePendingPrivateSendRetry(thread, message, {
        message: 'resume missing capsule parts',
        code: 'NETWORK_ERROR',
      });
      if (privateMessageHasPublishAttempt(message)
        && message?.privatePublishConfirmStopped !== true
        && message?.publishState?.status !== CAPSULEHUB_PUBLISH_STATUS_CONFIRMED
        && isStalePrivatePendingPublishConfirmation(message)) {
        stopPrivatePublishConfirmationRetry({ thread, message }, { message: 'chain lookup expired', code: 'STALE_PRIVATE_PUBLISH' });
        continue;
      }
      if (!hasPendingPrivatePublishConfirmation(message)) continue;
      const existingKey = message.privatePublishConfirmRetryKey;
      if (existingKey && privatePublishConfirmJobs.has(existingKey)) continue;
      if (scheduleImmediatePrivatePublishConfirmation({
        thread,
        message,
        confirmAttempt: 0,
      })) continue;
      schedulePrivatePublishConfirmationRetry({
        thread,
        message,
        confirmAttempt: Number(message.privatePublishConfirmAttempt ?? 0) || 0,
      });
    }
  }
}

function hasPendingPrivateSendRetry(message) {
  const hasStoredCapsules = (Array.isArray(message?.capsules) && message.capsules.length > 0) || Boolean(message?.capsule);
  return messageStatusKey(message) !== 'failed'
    && message?.privateSendRetryStopped !== true
    && (!isStalePrivatePendingPublish(message) || privateMessageHasPublishAttempt(message))
    && publishStateHasRetryableSendParts(message?.publishState)
    && hasStoredCapsules;
}

function resumePendingPrivateSendRetries() {
  if (document.hidden) return;
  for (const thread of threads) {
    for (const message of thread.messages ?? []) {
      if (stopPartialPrivatePublishRecovery({ thread, message })) continue;
      if (message?.privateSendRetryStopped !== true
        && publishStateHasRetryableSendParts(message?.publishState)
        && isStalePrivatePendingPublish(message)
        && !privateMessageHasPublishAttempt(message)) {
        stopPrivateSendRetry({ thread, message }, { message: 'retry window expired', code: 'STALE_PRIVATE_PUBLISH' });
        continue;
      }
      if (!hasPendingPrivateSendRetry(message)) continue;
      ensurePendingPrivateSendRetry(thread, message, { message: 'resume pending capsule send', code: 'NETWORK_ERROR' });
    }
  }
}

function clearPrivateMessageManualRecovery(message) {
  if (!message) return;
  message.privateManualRetryAvailable = false;
  message.privateCancelAvailable = false;
  message.privateSendLastError = null;
}

function privateMessageCanLocalCancel(message) {
  return Boolean(message)
    && !privateMessageHasPublishAttempt(message)
    && !message.localHistoryId
    && message.paymentIntentCreated !== true
    && !paymentHasIntent(message.payment);
}

function markPrivateMessageManualRecovery(context, error = null, metaText = null) {
  const { thread, message } = context ?? {};
  if (!thread?.messages?.includes(message)) return;
  clearPrivateSendRetry(message);
  clearPrivatePublishConfirmRetry(message);
  message.privateSendRetryStopped = true;
  message.privateSendRetryStoppedAt = new Date().toISOString();
  message.privateManualRetryAvailable = true;
  message.privateCancelAvailable = privateMessageCanLocalCancel(message);
  message.privateSendLastError = shortUiErrorText(error, 'send stopped');
  message.meta = metaText ?? privateSendBlockedStatusText(error);
  thread.state = 'blocked';
  refreshThreadAfterMessageChange(thread);
  renderThreads();
  renderConversation();
  updateMessageInEncryptedHistory(thread, message).catch((historyError) => console.error(historyError));
}

function privateMessageShouldShowManualActions(message) {
  if (!message?.privateManualRetryAvailable) return false;
  if (message.privateSendRetryKey && privateSendRetryJobs.has(message.privateSendRetryKey)) return false;
  if (message.privatePublishConfirmRetryKey && privatePublishConfirmJobs.has(message.privatePublishConfirmRetryKey)) return false;
  if (message.publishState?.status === CAPSULEHUB_PUBLISH_STATUS_CONFIRMED) return false;
  if (messageStatusKey(message) !== 'failed') return false;
  const meta = String(message.meta ?? '').toLowerCase();
  if (meta.includes('published')
    || meta.includes('sending')
    || meta.includes('submitted')
    || meta.includes('confirming')
    || meta.includes('retrying send')
    || meta.includes('checking rpc')) {
    return false;
  }
  return message.privateSendRetryStopped === true || message.privatePublishConfirmStopped === true;
}

function privateMessageManualActionsElement(thread, message) {
  if (!privateMessageShouldShowManualActions(message)) return null;
  const actions = document.createElement('div');
  actions.className = 'message-actions';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Retry';
  retry.addEventListener('click', async () => {
    retry.disabled = true;
    await retryPrivateMessageFromUi(thread, message).catch((error) => {
      markPrivateMessageManualRecovery({ thread, message }, error);
      console.error(error);
    });
  });
  actions.append(retry);
  if (message.privateCancelAvailable === true && privateMessageCanLocalCancel(message)) {
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => {
      cancelPrivateMessageFromUi(thread, message);
    });
    actions.append(cancel);
  }
  return actions.children.length > 0 ? actions : null;
}

async function retryPrivateMessageFromUi(thread, message) {
  if (!thread?.messages?.includes(message)) return;
  clearPrivateSendRetry(message);
  clearPrivatePublishConfirmRetry(message);
  clearPrivateMessageManualRecovery(message);
  message.privateSendRetryStopped = false;
  message.privateSendRetryStoppedAt = null;
  message.privatePublishConfirmStopped = false;
  message.privatePublishConfirmStoppedAt = null;
  message.privateSendRetryAttempt = 0;
  message.privatePublishConfirmAttempt = 0;
  message.meta = privateMessageHasPublishAttempt(message)
    ? publishStateMeta(message.publishState)
    : 'sending';
  thread.state = 'pending';
  refreshThreadAfterMessageChange(thread);
  renderThreads();
  renderConversation();

  const context = privateSendRetryContextForMessage(thread, message);
  try {
    if (privateMessageHasPublishAttempt(message) && !publishStateHasRetryableSendParts(message.publishState)) {
      await runPrivatePublishConfirmationRetry(context);
      return;
    }
    if (!privateMessageHasPublishAttempt(message) && !context.paymentIntentCreated) {
      const plan = privateComposerSendPlan(context.text, context.attachments, context.senderOptions, {
        paymentCheck: context.paymentDraft,
      });
      await assertVaultHasPrivatePublishHold(context.selectedSuite, plan, {
        allowOwnVaultActionReadFallback: Boolean(context.paymentDraft),
      });
    }
    await runPrivateSendRetry(context);
  } catch (error) {
    await settlePrivateComposerSendError(context, error);
  } finally {
    refreshThreadAfterMessageChange(thread);
    renderThreads();
    renderConversation();
  }
}

function cancelPrivateMessageFromUi(thread, message) {
  if (!thread?.messages?.includes(message) || !privateMessageCanLocalCancel(message)) return;
  clearPrivateSendRetry(message);
  clearPrivatePublishConfirmRetry(message);
  thread.messages = (thread.messages ?? []).filter((item) => item !== message);
  refreshThreadAfterMessageChange(thread);
  renderThreads();
  renderConversation();
  if (privateComposerCostStatus && thread.id === activeThreadId) {
    privateComposerCostStatus.textContent = 'Message cancelled';
    privateComposerCostStatus.dataset.state = 'ready';
  }
}

async function attemptPrivateComposerMessagePublish(context) {
  const endPrivateOutboundWork = beginPrivateOutboundWork();
  try {
  const { thread, message, text, attachments, attachment, selectedSuite, senderOptions, payment } = context;
  clearPrivateMessageManualRecovery(message);
  let capsules = Array.isArray(message.capsules) && message.capsules.length > 0
    ? message.capsules
    : (message.capsule ? [message.capsule] : null);
  if (!capsules) {
    const recipientEntry = await resolveRecipientPeerEntry(thread, { suite: selectedSuite });
    refreshThreadIdentityFromVariants(thread, privateWalletIdentityVariants(recipientEntry.walletAddress));
    capsules = await createPrivateComposerCapsules(text, attachments ?? (attachment ? [attachment] : []), recipientEntry, thread.id, senderOptions, { payment });
    message.recipientWallet = recipientEntry.walletAddress;
  }
  const capsule = capsules[0];
  const existingPublishState = message.publishState;
  const publishState = existingPublishState?.partCount === capsules.length ? existingPublishState : createCapsulePublishState(capsules);
  message.capsule = capsule;
  message.capsules = capsules;
  message.publishState = publishState;
  message.meta = publishStateMeta(publishState);
  refreshThreadAfterMessageChange(thread);
  renderConversation();
  const publishCallbacks = {
    publishState,
    allowOwnVaultActionReadFallback: true,
    confirmFinalNonce: true,
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
  clearPrivateMessageManualRecovery(message);
  message.privateSendRetryAttempt = 0;
  message.privateSendRetryStopped = false;
  message.privateSendRetryStoppedAt = null;
  message.vaultPublish = publishResult;
  message.publishState = publishResult.publishState ?? publishState;
  message.meta = publishStateMeta(message.publishState);
  thread.state = publishResult.status === CAPSULEHUB_PUBLISH_STATUS_CONFIRMED ? 'sealed' : 'pending';
  await updateMessageInEncryptedHistory(thread, message);
  if (publishResult.status !== CAPSULEHUB_PUBLISH_STATUS_CONFIRMED) {
    schedulePrivatePublishConfirmationRetry(context);
  } else {
    message.privatePublishConfirmAttempt = 0;
    message.privatePublishConfirmStopped = false;
    message.privatePublishConfirmStoppedAt = null;
    clearPrivatePublishConfirmRetry(message);
  }
  refreshMessagingControls();
  return publishResult;
  } finally {
    endPrivateOutboundWork();
  }
}

async function settlePrivateComposerSendError(context, error) {
  const { thread, message } = context;
  const cancelled = isPublishPriceChangeCancelled(error);
  const partial = isVaultPublishPartialError(error);
  const rateLimited = noteTonRpcRateLimit(error);
  globalThis.plathoLastPrivateComposerSendError = {
    message: String(error?.message ?? error ?? ''),
    code: error?.code ?? null,
    phase: message?.meta ?? null,
    hasPaymentDraft: Boolean(context.paymentDraft),
    paymentDraft: paymentDraftForHistory(context.paymentDraft),
    payment: paymentForHistory(message?.payment),
    paymentIntentCreated: context.paymentIntentCreated === true,
    hasPublishAttempt: privateMessageHasPublishAttempt(message),
    hasLocalHistory: Boolean(message?.localHistoryId),
    at: new Date().toISOString(),
  };
  if (context.paymentDraft && context.paymentIntentCreated !== true && !privateMessageHasPublishAttempt(message)) {
    rememberPaymentCheckActionError('pre-create', error, message?.payment ?? context.paymentDraft);
  }
  if (partial) {
    clearPrivateSendRetry(message);
    message.vaultPublish = error.publishResult;
    message.publishState = error.publishResult?.publishState ?? message.publishState;
    message.meta = publishStateMeta(message.publishState);
    thread.state = privateMessageHasPublishAttempt(message) ? 'pending' : 'blocked';
    await updateMessageInEncryptedHistory(thread, message);
    if (publishStateHasRetryableSendParts(message.publishState) && isRecoverablePrivateSendError(error.cause ?? error)) {
      schedulePrivateSendRetry(context, error.cause ?? error);
    } else {
      schedulePrivatePublishConfirmationRetry(context, error);
    }
  } else if (cancelled) {
    markPrivateMessageManualRecovery(context, error, 'not sent: cancelled');
  } else if (context.paymentIntentCreated && message.payment && !privateMessageHasPublishAttempt(message)) {
    if (isRecoverablePrivateSendError(error)) {
      message.meta = privateSendRetryMeta(error);
      thread.state = 'pending';
      await updateMessageInEncryptedHistory(thread, message);
      await rememberPendingPaymentCheckLedgerRecord(thread, message, message.payment, {
        status: 'publish_retry_pending',
        publishState: message.publishState,
      });
      schedulePrivateSendRetry(context, error);
    } else {
      rememberPaymentCheckActionError('publish', error, message.payment);
      const cancelResult = await attemptCancelPaymentCheckAfterPublishFailure(message.payment).catch((cancelError) => {
        rememberPaymentCheckActionError('auto-cancel', cancelError, message.payment);
        if (isPaymentCheckCancelPending(cancelError)) return { pending: true };
        console.error(cancelError);
        return null;
      });
      message.vaultCancelIntent = cancelResult;
      message.meta = cancelResult?.pending
        ? 'check cancel submitted, confirming'
        : cancelResult
        ? `check publish failed, intent cancelled: ${privateSendPreflightStatusText(error)}`
        : 'check not delivered, refund required';
      thread.state = 'blocked';
      if (cancelResult?.pending) {
        await rememberPendingPaymentCheckLedgerRecord(thread, message, message.payment, {
          status: 'cancel_submitted',
          vaultCancelIntent: cancelResult,
        });
      } else if (cancelResult) {
        await removePendingPaymentCheckLedgerRecord(message.payment);
      } else {
        await rememberPendingPaymentCheckLedgerRecord(thread, message, message.payment, {
          status: 'publish_failed_refund_required',
          publishError: privateSendPreflightStatusText(error),
        });
      }
      await updateMessageInEncryptedHistory(thread, message);
    }
  } else if (isRecoverablePrivateSendError(error) && !privateMessageHasPublishAttempt(message)) {
    schedulePrivateSendRetry(context, error);
  } else if (isRecoverablePrivateSendError(error) && privateMessageHasPublishAttempt(message)) {
    message.meta = publishStateMeta(message.publishState);
    thread.state = 'pending';
    await updateMessageInEncryptedHistory(thread, message);
    schedulePrivatePublishConfirmationRetry(context, error);
  } else if (!privateMessageHasPublishAttempt(message) && !message.localHistoryId) {
    markPrivateMessageManualRecovery(context, error, privateSendBlockedStatusText(error));
    if (privateComposerCostStatus) {
      privateComposerCostStatus.textContent = rateLimited ? TON_RPC_CONNECTING_STATUS : privateSendPreflightStatusText(error);
      privateComposerCostStatus.dataset.state = 'short';
    }
  } else {
    markPrivateMessageManualRecovery(context, error, privateSendBlockedStatusText(error));
  }
  if (privateComposerCostStatus) {
    const recoverable = isRecoverablePrivateSendError(error);
    if (cancelled || recoverable || partial || privateMessageHasPublishAttempt(message)) {
      refreshComposerCostStatus();
    } else {
      privateComposerCostStatus.textContent = rateLimited ? TON_RPC_CONNECTING_STATUS : privateSendPreflightStatusText(error);
      privateComposerCostStatus.dataset.state = 'short';
    }
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
    if (context.paymentDraft && !(context.paymentIntentCreated && message.payment && Array.isArray(message.capsules))) {
      await attemptPrivatePaymentCheckPublish(context);
    } else {
      await attemptPrivateComposerMessagePublish({
        ...context,
        payment: context.payment ?? message.payment ?? null,
        paymentDraft: null,
      });
    }
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
  const attachments = normalizePublicImageAttachments(attachment);
  const blocks = options.blocks ?? displayBlocksFromDocumentBlocks(publicDocumentBlocksFromDraft(text, attachments));
  feed.posts.push({
    id: `local-${Date.now()}`,
    text: messagePreviewFromBlocks(blocks) || text,
    blocks,
    imageUrl: blocks.length > 0 ? undefined : attachments[0]?.dataUrl,
    createdAt: new Date().toISOString(),
    author: 'you',
    authorWallet: plathoWallet?.address ?? null,
    profileVersion: profilePointer.profileVersion,
    avatarHash: profilePointer.avatarHash,
    avatarImageUrl: null,
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
  writePublicChannelFeedCache(publicChannelStorage(), publicChannelFeedCache);
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
    const attachments = normalizePublicImageAttachments(attachment);
    const blocks = options.blocks ?? displayBlocksFromDocumentBlocks(publicDocumentBlocksFromDraft(text, attachments));
    post.comments.push({
      id: `local-comment-${Date.now()}`,
      entryId: null,
      parentEntryId: String(parent.entryId),
      parentHash: parent.bodyHash,
      text: messagePreviewFromBlocks(blocks) || text,
      blocks,
      imageUrl: blocks.length > 0 ? undefined : attachments[0]?.dataUrl,
      createdAt: new Date().toISOString(),
      author: 'you',
      authorWallet: plathoWallet?.address ?? null,
      profileVersion: profilePointer.profileVersion,
      avatarHash: profilePointer.avatarHash,
      avatarImageUrl: null,
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
  writePublicChannelFeedCache(publicChannelStorage(), publicChannelFeedCache);
  rebuildThreadsFromPublicSubscriptions({ preserveActive: true });
  renderPublicSurface({ anchorUnread: false });
}

function imagePartsForSend(attachment, label = 'image') {
  if (!attachment?.bytes?.length) return [];
  return splitBytesToCapsuleParts(attachment.bytes, MAX_CAPSULE_USEFUL_BYTES);
}

function publicDocumentBlocksFromDraft(text, attachments = publicImageAttachments) {
  return composerBlocksFromDraft(text, normalizePublicImageAttachments(attachments), null)
    .filter((block) => block.type !== 'payment');
}

function publicDocumentBytesFromDraft(text, attachments = publicImageAttachments) {
  const blocks = publicDocumentBlocksFromDraft(text, attachments);
  if (blocks.length <= 0) return null;
  return encodeMessageDocumentBlocks(blocks);
}

function publicComposerSendPlan(text, attachments = publicImageAttachments) {
  const plan = [];
  const documentBytes = publicDocumentBytesFromDraft(text, attachments);
  if (!documentBytes) return plan;
  for (const part of splitBytesToCapsuleParts(documentBytes, MAX_CAPSULE_USEFUL_BYTES)) {
    plan.push({ type: 'document', bytes: part.bytes, sizeClass: part.sizeClass, usefulBytes: part.usefulBytes });
  }
  return plan;
}

async function createPrivateComposerCapsules(text, attachments, recipientEntry, threadId, options = currentPrivateSenderOptions(), extras = {}) {
  const senderWallet = requireBasechainAddress(requirePlathoWalletAddress(), 'Connected wallet');
  const recipientWallet = requireBasechainAddress(recipientEntry?.walletAddress, 'Recipient wallet');
  const senderVaultKeyId = currentVaultMessagingKeyId();
  const senderUsername = privateSenderUsernameMetadataLabel(options);
  const senderMetadata = options.includeSenderWalletMetadata === false
    ? {}
    : {
      senderWallet,
      senderVaultKeyId: senderVaultKeyId ?? undefined,
      senderUsername: senderUsername ?? undefined,
    };
  const recipientMetadata = {
    recipientWallet,
  };
  const documentBytes = messageDocumentBytesFromDraft(text, attachments, extras.payment ?? extras.paymentDraft ?? null);
  if (!documentBytes) return [];
  const documentParts = splitBytesToCapsuleParts(documentBytes, MAX_CAPSULE_USEFUL_BYTES, {
    perPartOverheadBytes: privateCompactPayloadOverhead(options),
  });
  const totalParts = documentParts.length;
  assertPrivateComposerPartLimit(totalParts);
  const streamId = randomBytes(16);
  const capsules = [];
  for (let index = 0; index < documentParts.length; index += 1) {
    const part = documentParts[index];
    const payloadBytes = encodeCompactPayload({
      type: 'document',
      bytes: part.bytes,
      sizeClass: part.sizeClass,
      streamId,
      partIndex: index,
      partCount: totalParts,
      ...senderMetadata,
      ...recipientMetadata,
      reservedTailBytes: PLATHO_COMPACT_SENDER_RECOVERY_BYTES,
    });
    capsules.push(await createEncryptedPrivateCapsuleFromPublicBundle('', recipientEntry.publicBundle, localIdentity, {
      payloadBytes,
      sizeClass: part.sizeClass,
      threadId,
      senderRecovery: true,
      ...currentProfilePointerFields(),
    }));
  }
  return capsules;
}

function publicPublishDraftFromPayload(payload) {
  return {
    publish_kind: VAULT_PUBLISH_KIND.PUBLIC,
    size_class: BigInt(payload.size_class ?? payload.sizeClass ?? VAULT_SIZE_CLASS.STANDARD),
    crypto_suite: VAULT_CRYPTO_SUITE.PUBLIC_NONE,
    header_0_hash: payload.headerHash,
    body_hash: payload.bodyHash,
    header_0_cell: payload.header_cell,
    body_cell: payload.body_cell,
  };
}

async function publishPublicPayloadParts(payloads, idPrefix, options = {}) {
  return publishCapsulesThroughVault(payloads.map((payload, index) => ({
    id: `${idPrefix}-${index}`,
    publish: publicPublishDraftFromPayload(payload),
  })), { ...options, allowOwnVaultActionReadFallback: true, confirmFinalNonce: options.confirmFinalNonce ?? true });
}

async function createPublicPayloadParts({ type, text, attachments = publicImageAttachments, commentsAllowed = true, parent = null }) {
  const documentParts = publicComposerSendPlan(text, attachments);
  const totalParts = documentParts.length;
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
  for (let index = 0; index < documentParts.length; index += 1) {
    const part = documentParts[index];
    payloads.push(await createPublicPostPayload({
      type: type === 'comment' ? 'document_comment' : 'document',
      bytes: part.bytes,
      commentsAllowed,
      streamId,
      partIndex: index,
      partCount: totalParts,
      createdAtSec,
      ...profilePointer,
      ...commentBase,
    }, { sizeClass: part.sizeClass }));
  }
  return payloads;
}

async function submitPublicPostThroughVault(draft = null) {
  const resolvedDraft = draft ?? {
    text: publicMessageInput?.value?.trim() ?? '',
    attachments: publicImageAttachments,
    commentsAllowed: publicComposerCommentsCheckbox?.checked !== false,
  };
  const attachments = normalizePublicImageAttachments(resolvedDraft.attachments ?? resolvedDraft.attachment);
  if (!resolvedDraft.text && attachments.length === 0) return null;
  setPublicStatus('public publish signing');
  const blocks = displayBlocksFromDocumentBlocks(publicDocumentBlocksFromDraft(resolvedDraft.text, attachments));
  const payloads = await createPublicPayloadParts({
    type: 'post',
    text: resolvedDraft.text,
    attachments,
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
    rememberLocalPublicPost(resolvedDraft.text, payloads[0]?.bodyHash, resolvedDraft.commentsAllowed, attachments, { blocks });
    setPublicStatus('public published');
  } else if (result?.status === VAULT_PUBLISH_STATUS_PARTIAL) {
    rememberLocalPublicPost(resolvedDraft.text, payloads[0]?.bodyHash, resolvedDraft.commentsAllowed, attachments, {
      blocks,
      publishStatus: 'partial public publish',
      publishState: result.publishState ?? null,
    });
    setPublicStatus('partial public publish');
  } else if (result?.status === VAULT_PUBLISH_STATUS_SUBMITTED) {
    rememberLocalPublicPost(resolvedDraft.text, payloads[0]?.bodyHash, resolvedDraft.commentsAllowed, attachments, {
      blocks,
      publishStatus: 'public publish submitted',
      publishState: result.publishState ?? null,
    });
    setPublicStatus('public publish submitted');
  } else {
    setPublicStatus('publish ready');
  }
  globalThis.plathoLastPublicPublish = { text: resolvedDraft.text, blocks, commentsAllowed: resolvedDraft.commentsAllowed, payloads, result };
  return result;
}

async function submitPublicCommentThroughVault(parent, bodyText = null, draftAttachments = publicImageAttachments) {
  if (parent?.entryId === undefined || parent?.entryId === null) throw new Error('Public comment parent is not synced from chain');
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(parent.bodyHash ?? ''))) throw new Error('Public comment parent hash is missing');
  if (parent.commentsAllowed === false) throw new Error('Comments are closed for this post');
  const text = bodyText?.trim() ?? publicMessageInput?.value?.trim() ?? '';
  const attachments = normalizePublicImageAttachments(draftAttachments);
  if (!text && attachments.length === 0) return null;
  setPublicStatus('comment signing');
  const blocks = displayBlocksFromDocumentBlocks(publicDocumentBlocksFromDraft(text, attachments));
  const payloads = await createPublicPayloadParts({
    type: 'comment',
    text,
    attachments,
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
    rememberLocalPublicComment(parent, text, payloads[0]?.bodyHash, attachments, { blocks });
    setPublicStatus('comment published');
  } else if (result?.status === VAULT_PUBLISH_STATUS_PARTIAL) {
    rememberLocalPublicComment(parent, text, payloads[0]?.bodyHash, attachments, {
      blocks,
      publishStatus: 'partial comment publish',
      publishState: result.publishState ?? null,
    });
    setPublicStatus('partial comment publish');
  } else if (result?.status === VAULT_PUBLISH_STATUS_SUBMITTED) {
    rememberLocalPublicComment(parent, text, payloads[0]?.bodyHash, attachments, {
      blocks,
      publishStatus: 'comment submitted',
      publishState: result.publishState ?? null,
    });
    setPublicStatus('comment submitted');
  } else {
    setPublicStatus('publish ready');
  }
  globalThis.plathoLastPublicComment = { parent, text, blocks, payloads, result };
  return result;
}

globalThis.plathoVaultTransactions = {
  createVaultWalletMessage,
  createAthWalletMessage,
  createPublicPostPayload,
  createWalletTransaction,
  submitVaultMessage,
  submitAthWalletMessage,
  submitVaultDepositTon,
  submitVaultWithdrawTon,
  submitVaultDepositAth,
  submitVaultWithdrawAth,
  submitUsernameMint,
  submitVaultUsernameMint,
  submitAthWalletBurn,
  submitAthDueFlush,
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
    const user = options.user ?? await provider.getUser(plathoWallet.address, {
      vaultAddress: requireVaultAddress(),
      verify: true,
      priority: 'critical',
      cacheTtlMs: 0,
    });
    const global = options.skipGlobal === true
      ? null
      : provider.getGlobal
        ? await loadConnectedVaultGlobal({ provider, verify: true, priority: 'critical', cacheTtlMs: 0 }).catch(() => null)
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
    const record = await provider.getKeyRecord(user.current_key_id, {
      vaultAddress: requireVaultAddress(),
      verify: true,
      priority: 'critical',
      cacheTtlMs: 0,
    });
    await assertVaultKeyRecordMatchesOwner(plathoWallet.address, record, user.current_key_id);
    const binding = await verifyVaultKeyRecordBinding(localSignedPublicBundle, record, {
      ownerWallet: plathoWallet.address,
      currentKeyId: user.current_key_id,
      recordKeyId: user.current_key_id,
    });
    const localAuthPubkey = localVaultAuthKeyPair?.publicKey
      ? bytesToBigIntValue(localVaultAuthKeyPair.publicKey)
      : 0n;
    if (localAuthPubkey === 0n || BigInt(user.auth_pubkey ?? 0n) !== localAuthPubkey) {
      throw new Error('Vault auth key does not match this wallet');
    }
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
      await bootWalletScopedLocalStores();
      localIdentity = null;
      localVaultAuthKeyPair = null;
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
    await bootWalletScopedLocalStores();
    renderWalletIdentity();
    localProfileAvatarPointer = readStoredProfileAvatarPointer(plathoWallet.address);
    localVaultAuthKeyPair = await deriveVaultAuthKeyPairFromWallet(plathoWallet);
    localIdentity = await loadMessagingIdentityFromWallet(VAULT_RECEIVE_CRYPTO_SUITE);
    localRecipientKeyPair = localIdentity?.encryptionKeyPair ?? null;
    localSignedPublicBundle = await exportSignedPublicKeyBundle(localIdentity, {
      purpose: appConfig.crypto?.signedBundlePurpose ?? 'pwa-runtime',
      ownerWallet: plathoWallet.address,
      vaultAddress: appConfig.vault?.address ?? null,
    });
    const verifiedBundle = await verifySignedPublicKeyBundle(localSignedPublicBundle);
    localVaultDraft = await createVaultMessagingKeyDraft(verifiedBundle.bundle, verifiedBundle.signingPublicKey, {
      authPublicKey: localVaultAuthKeyPair.publicKey,
    });
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
      const syncResult = await syncPrivateCapsulesFromChainOnce({ mode: 'auto' }).catch((error) => {
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
    localVaultAuthKeyPair = null;
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
  resumePendingPrivatePublishConfirmations();
  resumePendingPrivateSendRetries();
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
  resumePendingPrivatePublishConfirmations();
  resumePendingPrivateSendRetries();
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
publicChannelSubscriptions = readPublicChannelSubscriptions(publicChannelStorage(), publicChannelRegistry);
writePublicChannelSubscriptions(publicChannelStorage(), publicChannelSubscriptions);
publicChannelFeedCache = readPublicChannelFeedCache(publicChannelStorage());
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
document.documentElement.dataset.plathoAppJs = 'ready';
bootCrypto()
  .then(() => setTimeout(() => {
    promptStoredWalletUnlockOnStartup().catch((error) => console.error(error));
  }, 250))
  .catch((error) => console.error(error));
