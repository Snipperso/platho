// Platho v1 transferable username NFT item.
// Scope: standard NFT transfer surface, on-chain username identity, registry-bound mint initialization,
// and permissionless deployed-ACK resend. No admin/pause/upgrade/rescue/fallback behavior is implemented.

const USERNAME_ITEM_ACK_FORWARD_RESERVE: Int = 3000000;
const USERNAME_ITEM_ACK_EXEC_RESERVE: Int = 1000000;
const USERNAME_ITEM_ACK_MAX_RESEND_VALUE: Int = 20000000;
const USERNAME_ITEM_TRANSFER_EXEC_RESERVE: Int = 2000000;
const USERNAME_ITEM_TRANSFER_FWD_FEE_ALLOWANCE: Int = 10000000;
const USERNAME_ITEM_EXCESSES_MIN_VALUE: Int = 100000;
const USERNAME_ITEM_MAX_LENGTH: Int = 16;
const USERNAME_ITEM_NAME_HASH_DOMAIN: Int = 0xC5CC7CD6;
const USERNAME_ITEM_METADATA_KEY_NAME: Int = 0x82a3537ff0dbce7eec35d69edc3a189ee6f17d82f353a553f9aa96cb0be3ce89;
const USERNAME_ITEM_METADATA_KEY_DESCRIPTION: Int = 0xc9046f7a37ad0ea7cee73355984fa5428982f8b37c8f7bcec91f7ac71a7cd104;
const USERNAME_ITEM_METADATA_KEY_IMAGE: Int = 0x6105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3d;
const USERNAME_ITEM_METADATA_KEY_IMAGE_DATA: Int = 0xd9a88ccec79eef59c84b671136a20ece4cd00caaad5bc47e2c208829154ee9e4;

message(0x554E494E) InitializeUsernameItem {
    owner_wallet: Address;
    username_len: Int as uint8;
    username: Slice as remaining;
}

message(0x639CFC6C) ResendDeployedAck {}

message(0x27ACDF8B) TopUpStorageReserve {}

message(0xBBA3EC19) UsernameItemDeployedAck {
    name_hash: Int as uint256;
    owner_wallet: Address;
}

// TEP-62 NFT transfer surface.
message(0x5FCC3D14) NftTransfer {
    query_id: Int as uint64;
    new_owner: Address;
    response_destination: Address;
    custom_payload: Cell?;
    forward_amount: Int as coins;
    forward_payload: Slice as remaining;
}

message(0x05138D91) NftOwnershipAssigned {
    query_id: Int as uint64;
    previous_owner: Address;
    forward_payload: Slice as remaining;
}

message(0xD53276DB) NftExcesses {
    query_id: Int as uint64;
}

struct UsernameNFTItemStateView {
    initialized: Bool;
    owner_wallet: Address;
    username_registry_address: Address;
    name_hash: Int;
    username_len: Int;
    username: Cell;
    tier: Int;
}

struct UsernameNftDataView {
    initialized: Bool;
    index: Int;
    collection_address: Address;
    owner_address: Address;
    individual_content: Cell;
}

struct UsernameNftOnchainContent {
    marker: Int as uint8;
    metadata: map<Int as uint256, Cell>;
}

contract UsernameNFTItem {
    initialized: Bool;
    owner_wallet: Address;
    username_registry_address: Address;
    name_hash: Int as uint256;
    username_len: Int as uint8;
    username: Cell;

    init(username_registry_address: Address, name_hash: Int) {
        throwUnless(18001, name_hash != 0);
        self.initialized = false;
        self.owner_wallet = username_registry_address;
        self.username_registry_address = username_registry_address;
        self.name_hash = name_hash;
        self.username_len = 0;
        self.username = beginCell().endCell();
    }

    fun isBasechainAddress(address: Address): Bool {
        let std: StdAddress = parseStdAddress(address.asSlice());
        return std.workchain == 0;
    }

    fun isValidNameLength(name_len: Int): Bool {
        return (name_len >= 4) && (name_len <= USERNAME_ITEM_MAX_LENGTH);
    }

    fun isValidUsernameBytes(name_len: Int, username: Slice): Bool {
        if (!self.isValidNameLength(name_len)) {
            return false;
        }
        if (username.bits() != (name_len * 8)) {
            return false;
        }
        if (!username.refsEmpty()) {
            return false;
        }

        let cursor: Slice = username;
        let i: Int = 0;
        while (i < name_len) {
            let ch: Int = cursor.loadUint(8);
            let lower: Bool = (ch >= 97) && (ch <= 122);
            let digit: Bool = (ch >= 48) && (ch <= 57);
            let separator: Bool = (ch == 45) || (ch == 95);
            if (!(lower || digit || separator)) {
                return false;
            }
            i += 1;
        }
        return cursor.empty();
    }

    fun computeNameHash(username: Slice): Int {
        return beginCell()
            .storeUint(USERNAME_ITEM_NAME_HASH_DOMAIN, 32)
            .storeSlice(username)
            .endCell()
            .hash();
    }

    fun tier(): Int {
        if (self.username_len == 4) {
            return 1;
        }
        if (self.username_len == 5) {
            return 2;
        }
        return 3;
    }

    fun snakeNameCell(): Cell {
        return beginCell()
            .storeUint(0, 8)
            .storeSlice(self.username.beginParse())
            .storeUint(0x2e617468, 32) // ".ath"
            .endCell();
    }

    fun snakeDescriptionCell(): Cell {
        return beginCell()
            .storeUint(0, 8)
            .storeUint(0x506c6174686f20757365726e616d65, 120) // "Platho username"
            .endCell();
    }



    fun appendUsernameSvgChar(b: StringBuilder, ch: Int): StringBuilder {
        if (ch == 45) { return b.concat("-"); }
        if (ch == 48) { return b.concat("0"); }
        if (ch == 49) { return b.concat("1"); }
        if (ch == 50) { return b.concat("2"); }
        if (ch == 51) { return b.concat("3"); }
        if (ch == 52) { return b.concat("4"); }
        if (ch == 53) { return b.concat("5"); }
        if (ch == 54) { return b.concat("6"); }
        if (ch == 55) { return b.concat("7"); }
        if (ch == 56) { return b.concat("8"); }
        if (ch == 57) { return b.concat("9"); }
        if (ch == 95) { return b.concat("_"); }
        if (ch == 97) { return b.concat("a"); }
        if (ch == 98) { return b.concat("b"); }
        if (ch == 99) { return b.concat("c"); }
        if (ch == 100) { return b.concat("d"); }
        if (ch == 101) { return b.concat("e"); }
        if (ch == 102) { return b.concat("f"); }
        if (ch == 103) { return b.concat("g"); }
        if (ch == 104) { return b.concat("h"); }
        if (ch == 105) { return b.concat("i"); }
        if (ch == 106) { return b.concat("j"); }
        if (ch == 107) { return b.concat("k"); }
        if (ch == 108) { return b.concat("l"); }
        if (ch == 109) { return b.concat("m"); }
        if (ch == 110) { return b.concat("n"); }
        if (ch == 111) { return b.concat("o"); }
        if (ch == 112) { return b.concat("p"); }
        if (ch == 113) { return b.concat("q"); }
        if (ch == 114) { return b.concat("r"); }
        if (ch == 115) { return b.concat("s"); }
        if (ch == 116) { return b.concat("t"); }
        if (ch == 117) { return b.concat("u"); }
        if (ch == 118) { return b.concat("v"); }
        if (ch == 119) { return b.concat("w"); }
        if (ch == 120) { return b.concat("x"); }
        if (ch == 121) { return b.concat("y"); }
        if (ch == 122) { return b.concat("z"); }
        return b;
    }

    fun appendSvgTile(b: StringBuilder, tileStart: String, ch: Int): StringBuilder {
        b.append(tileStart);
        b = self.appendUsernameSvgChar(b, ch);
        b.append("</text>");
        return b;
    }

    fun appendSvgUriTile(b: StringBuilder, tileStart: String, ch: Int): StringBuilder {
        b.append(tileStart);
        b = self.appendUsernameSvgChar(b, ch);
        b.append("%3C%2Ftext%3E");
        return b;
    }

    fun appendEpicTile(b: StringBuilder, i: Int, ch: Int): StringBuilder {
        if (i == 0) { return self.appendSvgTile(b, "<rect x=\"169\" y=\"378\" width=\"152\" height=\"152\" rx=\"30\" fill=\"url(#tile)\"/><text x=\"245\" y=\"474\" fill=\"#06100d\" font-family=\"Arial,sans-serif\" font-size=\"76\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        if (i == 1) { return self.appendSvgTile(b, "<rect x=\"347\" y=\"378\" width=\"152\" height=\"152\" rx=\"30\" fill=\"url(#tile)\"/><text x=\"423\" y=\"474\" fill=\"#06100d\" font-family=\"Arial,sans-serif\" font-size=\"76\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        if (i == 2) { return self.appendSvgTile(b, "<rect x=\"525\" y=\"378\" width=\"152\" height=\"152\" rx=\"30\" fill=\"url(#tile)\"/><text x=\"601\" y=\"474\" fill=\"#06100d\" font-family=\"Arial,sans-serif\" font-size=\"76\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        if (i == 3) { return self.appendSvgTile(b, "<rect x=\"703\" y=\"378\" width=\"152\" height=\"152\" rx=\"30\" fill=\"url(#tile)\"/><text x=\"779\" y=\"474\" fill=\"#06100d\" font-family=\"Arial,sans-serif\" font-size=\"76\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        return b;
    }

    fun appendRareTile(b: StringBuilder, i: Int, ch: Int): StringBuilder {
        if (i == 0) { return self.appendSvgTile(b, "<rect x=\"162\" y=\"392\" width=\"132\" height=\"132\" rx=\"26\" fill=\"url(#tile)\"/><text x=\"228\" y=\"477\" fill=\"#07100f\" font-family=\"Arial,sans-serif\" font-size=\"66\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        if (i == 1) { return self.appendSvgTile(b, "<rect x=\"304\" y=\"392\" width=\"132\" height=\"132\" rx=\"26\" fill=\"url(#tile)\"/><text x=\"370\" y=\"477\" fill=\"#07100f\" font-family=\"Arial,sans-serif\" font-size=\"66\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        if (i == 2) { return self.appendSvgTile(b, "<rect x=\"446\" y=\"392\" width=\"132\" height=\"132\" rx=\"26\" fill=\"url(#tile)\"/><text x=\"512\" y=\"477\" fill=\"#07100f\" font-family=\"Arial,sans-serif\" font-size=\"66\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        if (i == 3) { return self.appendSvgTile(b, "<rect x=\"588\" y=\"392\" width=\"132\" height=\"132\" rx=\"26\" fill=\"url(#tile)\"/><text x=\"654\" y=\"477\" fill=\"#07100f\" font-family=\"Arial,sans-serif\" font-size=\"66\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        if (i == 4) { return self.appendSvgTile(b, "<rect x=\"730\" y=\"392\" width=\"132\" height=\"132\" rx=\"26\" fill=\"url(#tile)\"/><text x=\"796\" y=\"477\" fill=\"#07100f\" font-family=\"Arial,sans-serif\" font-size=\"66\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        return b;
    }

    fun appendCommonSingleTile(b: StringBuilder, len: Int, i: Int, ch: Int): StringBuilder {
        if (len == 6) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"252\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"292\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"340\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"380\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 2) { return self.appendSvgTile(b, "<rect x=\"428\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"468\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 3) { return self.appendSvgTile(b, "<rect x=\"516\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"556\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 4) { return self.appendSvgTile(b, "<rect x=\"604\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"644\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 5) { return self.appendSvgTile(b, "<rect x=\"692\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"732\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        }
        if (len == 7) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"208\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"248\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"296\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"336\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 2) { return self.appendSvgTile(b, "<rect x=\"384\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"424\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 3) { return self.appendSvgTile(b, "<rect x=\"472\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"512\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 4) { return self.appendSvgTile(b, "<rect x=\"560\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"600\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 5) { return self.appendSvgTile(b, "<rect x=\"648\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"688\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 6) { return self.appendSvgTile(b, "<rect x=\"736\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"776\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        }
        if (len == 8) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"164\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"204\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"252\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"292\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 2) { return self.appendSvgTile(b, "<rect x=\"340\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"380\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 3) { return self.appendSvgTile(b, "<rect x=\"428\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"468\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 4) { return self.appendSvgTile(b, "<rect x=\"516\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"556\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 5) { return self.appendSvgTile(b, "<rect x=\"604\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"644\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 6) { return self.appendSvgTile(b, "<rect x=\"692\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"732\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 7) { return self.appendSvgTile(b, "<rect x=\"780\" y=\"418\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"820\" y=\"472\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        }
        return b;
    }

    fun appendCommonTopTile(b: StringBuilder, i: Int, ch: Int): StringBuilder {
        if (i == 0) { return self.appendSvgTile(b, "<rect x=\"164\" y=\"372\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"204\" y=\"426\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        if (i == 1) { return self.appendSvgTile(b, "<rect x=\"252\" y=\"372\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"292\" y=\"426\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        if (i == 2) { return self.appendSvgTile(b, "<rect x=\"340\" y=\"372\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"380\" y=\"426\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        if (i == 3) { return self.appendSvgTile(b, "<rect x=\"428\" y=\"372\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"468\" y=\"426\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        if (i == 4) { return self.appendSvgTile(b, "<rect x=\"516\" y=\"372\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"556\" y=\"426\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        if (i == 5) { return self.appendSvgTile(b, "<rect x=\"604\" y=\"372\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"644\" y=\"426\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        if (i == 6) { return self.appendSvgTile(b, "<rect x=\"692\" y=\"372\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"732\" y=\"426\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        if (i == 7) { return self.appendSvgTile(b, "<rect x=\"780\" y=\"372\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"820\" y=\"426\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        return b;
    }

    fun appendCommonSecondTile(b: StringBuilder, rem: Int, i: Int, ch: Int): StringBuilder {
        if (rem == 1) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"472\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"512\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        }
        if (rem == 2) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"428\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"468\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"516\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"556\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        }
        if (rem == 3) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"384\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"424\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"472\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"512\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 2) { return self.appendSvgTile(b, "<rect x=\"560\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"600\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        }
        if (rem == 4) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"340\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"380\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"428\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"468\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 2) { return self.appendSvgTile(b, "<rect x=\"516\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"556\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 3) { return self.appendSvgTile(b, "<rect x=\"604\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"644\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        }
        if (rem == 5) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"296\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"336\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"384\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"424\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 2) { return self.appendSvgTile(b, "<rect x=\"472\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"512\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 3) { return self.appendSvgTile(b, "<rect x=\"560\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"600\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 4) { return self.appendSvgTile(b, "<rect x=\"648\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"688\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        }
        if (rem == 6) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"252\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"292\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"340\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"380\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 2) { return self.appendSvgTile(b, "<rect x=\"428\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"468\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 3) { return self.appendSvgTile(b, "<rect x=\"516\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"556\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 4) { return self.appendSvgTile(b, "<rect x=\"604\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"644\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 5) { return self.appendSvgTile(b, "<rect x=\"692\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"732\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        }
        if (rem == 7) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"208\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"248\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"296\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"336\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 2) { return self.appendSvgTile(b, "<rect x=\"384\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"424\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 3) { return self.appendSvgTile(b, "<rect x=\"472\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"512\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 4) { return self.appendSvgTile(b, "<rect x=\"560\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"600\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 5) { return self.appendSvgTile(b, "<rect x=\"648\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"688\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 6) { return self.appendSvgTile(b, "<rect x=\"736\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"776\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        }
        if (rem == 8) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"164\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"204\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"252\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"292\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 2) { return self.appendSvgTile(b, "<rect x=\"340\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"380\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 3) { return self.appendSvgTile(b, "<rect x=\"428\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"468\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 4) { return self.appendSvgTile(b, "<rect x=\"516\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"556\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 5) { return self.appendSvgTile(b, "<rect x=\"604\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"644\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 6) { return self.appendSvgTile(b, "<rect x=\"692\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"732\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
            if (i == 7) { return self.appendSvgTile(b, "<rect x=\"780\" y=\"464\" width=\"80\" height=\"80\" rx=\"16\" fill=\"url(#tile)\"/><text x=\"820\" y=\"518\" fill=\"#04120f\" font-family=\"Arial,sans-serif\" font-size=\"42\" font-weight=\"900\" text-anchor=\"middle\">", ch); }
        }
        return b;
    }


    fun appendEpicUriTile(b: StringBuilder, i: Int, ch: Int): StringBuilder {
        if (i == 0) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22169%22%20y%3D%22378%22%20width%3D%22152%22%20height%3D%22152%22%20rx%3D%2230%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22245%22%20y%3D%22474%22%20fill%3D%22%2306100d%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2276%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        if (i == 1) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22347%22%20y%3D%22378%22%20width%3D%22152%22%20height%3D%22152%22%20rx%3D%2230%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22423%22%20y%3D%22474%22%20fill%3D%22%2306100d%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2276%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        if (i == 2) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22525%22%20y%3D%22378%22%20width%3D%22152%22%20height%3D%22152%22%20rx%3D%2230%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22601%22%20y%3D%22474%22%20fill%3D%22%2306100d%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2276%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        if (i == 3) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22703%22%20y%3D%22378%22%20width%3D%22152%22%20height%3D%22152%22%20rx%3D%2230%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22779%22%20y%3D%22474%22%20fill%3D%22%2306100d%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2276%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        return b;
    }

    fun appendRareUriTile(b: StringBuilder, i: Int, ch: Int): StringBuilder {
        if (i == 0) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22162%22%20y%3D%22392%22%20width%3D%22132%22%20height%3D%22132%22%20rx%3D%2226%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22228%22%20y%3D%22477%22%20fill%3D%22%2307100f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2266%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        if (i == 1) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22304%22%20y%3D%22392%22%20width%3D%22132%22%20height%3D%22132%22%20rx%3D%2226%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22370%22%20y%3D%22477%22%20fill%3D%22%2307100f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2266%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        if (i == 2) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22446%22%20y%3D%22392%22%20width%3D%22132%22%20height%3D%22132%22%20rx%3D%2226%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22512%22%20y%3D%22477%22%20fill%3D%22%2307100f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2266%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        if (i == 3) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22588%22%20y%3D%22392%22%20width%3D%22132%22%20height%3D%22132%22%20rx%3D%2226%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22654%22%20y%3D%22477%22%20fill%3D%22%2307100f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2266%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        if (i == 4) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22730%22%20y%3D%22392%22%20width%3D%22132%22%20height%3D%22132%22%20rx%3D%2226%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22796%22%20y%3D%22477%22%20fill%3D%22%2307100f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2266%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        return b;
    }

    fun appendCommonUriSingleTile(b: StringBuilder, len: Int, i: Int, ch: Int): StringBuilder {
        if (len == 6) {
            if (i == 0) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22252%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22292%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 1) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22340%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22380%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 2) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22428%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22468%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 3) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22516%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22556%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 4) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22604%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22644%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 5) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22692%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22732%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        }
        if (len == 7) {
            if (i == 0) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22208%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22248%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 1) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22296%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22336%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 2) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22384%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22424%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 3) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22472%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22512%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 4) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22560%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22600%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 5) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22648%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22688%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 6) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22736%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22776%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        }
        if (len == 8) {
            if (i == 0) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22164%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22204%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 1) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22252%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22292%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 2) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22340%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22380%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 3) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22428%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22468%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 4) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22516%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22556%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 5) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22604%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22644%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 6) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22692%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22732%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 7) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22780%22%20y%3D%22418%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22820%22%20y%3D%22472%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        }
        return b;
    }

    fun appendCommonUriTopTile(b: StringBuilder, i: Int, ch: Int): StringBuilder {
        if (i == 0) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22164%22%20y%3D%22372%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22204%22%20y%3D%22426%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        if (i == 1) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22252%22%20y%3D%22372%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22292%22%20y%3D%22426%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        if (i == 2) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22340%22%20y%3D%22372%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22380%22%20y%3D%22426%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        if (i == 3) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22428%22%20y%3D%22372%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22468%22%20y%3D%22426%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        if (i == 4) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22516%22%20y%3D%22372%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22556%22%20y%3D%22426%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        if (i == 5) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22604%22%20y%3D%22372%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22644%22%20y%3D%22426%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        if (i == 6) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22692%22%20y%3D%22372%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22732%22%20y%3D%22426%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        if (i == 7) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22780%22%20y%3D%22372%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22820%22%20y%3D%22426%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        return b;
    }

    fun appendCommonUriSecondTile(b: StringBuilder, rem: Int, i: Int, ch: Int): StringBuilder {
        if (rem == 1) {
            if (i == 0) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22472%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22512%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        }
        if (rem == 2) {
            if (i == 0) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22428%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22468%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 1) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22516%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22556%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        }
        if (rem == 3) {
            if (i == 0) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22384%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22424%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 1) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22472%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22512%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 2) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22560%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22600%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        }
        if (rem == 4) {
            if (i == 0) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22340%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22380%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 1) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22428%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22468%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 2) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22516%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22556%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 3) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22604%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22644%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        }
        if (rem == 5) {
            if (i == 0) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22296%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22336%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 1) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22384%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22424%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 2) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22472%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22512%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 3) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22560%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22600%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 4) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22648%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22688%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        }
        if (rem == 6) {
            if (i == 0) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22252%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22292%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 1) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22340%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22380%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 2) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22428%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22468%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 3) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22516%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22556%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 4) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22604%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22644%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 5) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22692%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22732%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        }
        if (rem == 7) {
            if (i == 0) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22208%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22248%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 1) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22296%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22336%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 2) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22384%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22424%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 3) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22472%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22512%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 4) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22560%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22600%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 5) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22648%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22688%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 6) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22736%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22776%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        }
        if (rem == 8) {
            if (i == 0) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22164%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22204%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 1) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22252%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22292%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 2) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22340%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22380%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 3) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22428%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22468%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 4) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22516%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22556%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 5) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22604%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22644%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 6) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22692%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22732%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
            if (i == 7) { return self.appendSvgUriTile(b, "%3Crect%20x%3D%22780%22%20y%3D%22464%22%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2216%22%20fill%3D%22url(%23tile)%22%2F%3E%3Ctext%20x%3D%22820%22%20y%3D%22518%22%20fill%3D%22%2304120f%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2242%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E", ch); }
        }
        return b;
    }


    fun appendUsernameTiles(b: StringBuilder): StringBuilder {
        let cursor: Slice = self.username.beginParse();
        let i: Int = 0;
        if (self.username_len == 4) {
            while (i < 4) {
                let ch: Int = cursor.loadUint(8);
                b = self.appendEpicTile(b, i, ch);
                i += 1;
            }
            return b;
        }
        if (self.username_len == 5) {
            while (i < 5) {
                let ch: Int = cursor.loadUint(8);
                b = self.appendRareTile(b, i, ch);
                i += 1;
            }
            return b;
        }
        if (self.username_len <= 8) {
            while (i < self.username_len) {
                let ch: Int = cursor.loadUint(8);
                b = self.appendCommonSingleTile(b, self.username_len, i, ch);
                i += 1;
            }
            return b;
        }
        while (i < 8) {
            let ch: Int = cursor.loadUint(8);
            b = self.appendCommonTopTile(b, i, ch);
            i += 1;
        }
        let j: Int = 0;
        let rem: Int = self.username_len - 8;
        while (j < rem) {
            let ch: Int = cursor.loadUint(8);
            b = self.appendCommonSecondTile(b, rem, j, ch);
            j += 1;
        }
        return b;
    }


    fun appendUsernameUriTiles(b: StringBuilder): StringBuilder {
        let cursor: Slice = self.username.beginParse();
        let i: Int = 0;
        if (self.username_len == 4) {
            while (i < 4) {
                let ch: Int = cursor.loadUint(8);
                b = self.appendEpicUriTile(b, i, ch);
                i += 1;
            }
            return b;
        }
        if (self.username_len == 5) {
            while (i < 5) {
                let ch: Int = cursor.loadUint(8);
                b = self.appendRareUriTile(b, i, ch);
                i += 1;
            }
            return b;
        }
        if (self.username_len <= 8) {
            while (i < self.username_len) {
                let ch: Int = cursor.loadUint(8);
                b = self.appendCommonUriSingleTile(b, self.username_len, i, ch);
                i += 1;
            }
            return b;
        }
        while (i < 8) {
            let ch: Int = cursor.loadUint(8);
            b = self.appendCommonUriTopTile(b, i, ch);
            i += 1;
        }
        let j: Int = 0;
        let rem: Int = self.username_len - 8;
        while (j < rem) {
            let ch: Int = cursor.loadUint(8);
            b = self.appendCommonUriSecondTile(b, rem, j, ch);
            j += 1;
        }
        return b;
    }

    fun appendSvgUsernameLine(b: StringBuilder): StringBuilder {
        let cursor: Slice = self.username.beginParse();
        let i: Int = 0;
        while (i < self.username_len) {
            let ch: Int = cursor.loadUint(8);
            b = self.appendUsernameSvgChar(b, ch);
            i += 1;
        }
        return b;
    }

    fun appendSvgUriUsernameLine(b: StringBuilder): StringBuilder {
        return self.appendSvgUsernameLine(b);
    }

    fun appendSvgDefs(b: StringBuilder): StringBuilder {
        b.append("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1024 1024\" role=\"img\"><defs><linearGradient id=\"bg\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#050807\"/><stop offset=\".55\" stop-color=\"#071411\"/><stop offset=\"1\" stop-color=\"#05080a\"/></linearGradient>");
        if (self.username_len == 4) {
            b.append("<linearGradient id=\"accent\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#fff5b7\" stop-opacity=\"0\"/><stop offset=\".18\" stop-color=\"#fff5b7\"/><stop offset=\".55\" stop-color=\"#f4b84b\"/><stop offset=\".92\" stop-color=\"#fff0a0\" stop-opacity=\"0\"/></linearGradient><linearGradient id=\"tile\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#fff6b8\"/><stop offset=\".52\" stop-color=\"#f2ba4b\"/><stop offset=\"1\" stop-color=\"#7d5520\"/></linearGradient>");
        } else {
            if (self.username_len == 5) {
                b.append("<linearGradient id=\"accent\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#eef4f8\" stop-opacity=\"0\"/><stop offset=\".18\" stop-color=\"#eef4f8\"/><stop offset=\".55\" stop-color=\"#aab8c3\"/><stop offset=\".92\" stop-color=\"#ffffff\" stop-opacity=\"0\"/></linearGradient><linearGradient id=\"tile\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#f4f8fa\"/><stop offset=\".52\" stop-color=\"#aeb8c1\"/><stop offset=\"1\" stop-color=\"#65727e\"/></linearGradient>");
            } else {
                b.append("<linearGradient id=\"accent\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#27d4ad\" stop-opacity=\"0\"/><stop offset=\".18\" stop-color=\"#27d4ad\"/><stop offset=\".55\" stop-color=\"#1ea487\"/><stop offset=\".92\" stop-color=\"#27d4ad\" stop-opacity=\"0\"/></linearGradient><linearGradient id=\"tile\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#39e3bf\"/><stop offset=\".55\" stop-color=\"#24b995\"/><stop offset=\"1\" stop-color=\"#145546\"/></linearGradient>");
            }
        }
        b.append("</defs>");
        return b;
    }


    fun appendSvgUriDefs(b: StringBuilder): StringBuilder {
        b.append("%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%201024%201024%22%20role%3D%22img%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22bg%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23050807%22%2F%3E%3Cstop%20offset%3D%22.55%22%20stop-color%3D%22%23071411%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2305080a%22%2F%3E%3C%2FlinearGradient%3E");
        if (self.username_len == 4) {
            b.append("%3ClinearGradient%20id%3D%22accent%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23fff5b7%22%20stop-opacity%3D%220%22%2F%3E%3Cstop%20offset%3D%22.18%22%20stop-color%3D%22%23fff5b7%22%2F%3E%3Cstop%20offset%3D%22.55%22%20stop-color%3D%22%23f4b84b%22%2F%3E%3Cstop%20offset%3D%22.92%22%20stop-color%3D%22%23fff0a0%22%20stop-opacity%3D%220%22%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D%22tile%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23fff6b8%22%2F%3E%3Cstop%20offset%3D%22.52%22%20stop-color%3D%22%23f2ba4b%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%237d5520%22%2F%3E%3C%2FlinearGradient%3E");
        } else {
            if (self.username_len == 5) {
                b.append("%3ClinearGradient%20id%3D%22accent%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23eef4f8%22%20stop-opacity%3D%220%22%2F%3E%3Cstop%20offset%3D%22.18%22%20stop-color%3D%22%23eef4f8%22%2F%3E%3Cstop%20offset%3D%22.55%22%20stop-color%3D%22%23aab8c3%22%2F%3E%3Cstop%20offset%3D%22.92%22%20stop-color%3D%22%23ffffff%22%20stop-opacity%3D%220%22%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D%22tile%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23f4f8fa%22%2F%3E%3Cstop%20offset%3D%22.52%22%20stop-color%3D%22%23aeb8c1%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2365727e%22%2F%3E%3C%2FlinearGradient%3E");
            } else {
                b.append("%3ClinearGradient%20id%3D%22accent%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%2327d4ad%22%20stop-opacity%3D%220%22%2F%3E%3Cstop%20offset%3D%22.18%22%20stop-color%3D%22%2327d4ad%22%2F%3E%3Cstop%20offset%3D%22.55%22%20stop-color%3D%22%231ea487%22%2F%3E%3Cstop%20offset%3D%22.92%22%20stop-color%3D%22%2327d4ad%22%20stop-opacity%3D%220%22%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D%22tile%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%2339e3bf%22%2F%3E%3Cstop%20offset%3D%22.55%22%20stop-color%3D%22%2324b995%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23145546%22%2F%3E%3C%2FlinearGradient%3E");
            }
        }
        b.append("%3C%2Fdefs%3E");
        return b;
    }


    fun appendSvgShell(b: StringBuilder): StringBuilder {
        b = self.appendSvgDefs(b);
        b.append("<rect width=\"1024\" height=\"1024\" fill=\"url(#bg)\"/><rect x=\"52\" y=\"52\" width=\"920\" height=\"920\" rx=\"78\" fill=\"#07100f\" stroke=\"#1b2a29\" stroke-width=\"3\"/><path d=\"M104 260Q104 108 256 108H920\" fill=\"none\" stroke=\"url(#accent)\" stroke-width=\"10\" stroke-linecap=\"round\" opacity=\".42\"/><path d=\"M104 796Q104 916 224 916H888\" fill=\"none\" stroke=\"url(#accent)\" stroke-width=\"8\" stroke-linecap=\"round\" opacity=\".24\"/><rect x=\"112\" y=\"108\" width=\"108\" height=\"108\" rx=\"28\" fill=\"#0b1514\" stroke=\"#1f3432\" stroke-width=\"2\"/>");
        b.append("<svg x=\"124\" y=\"120\" width=\"88\" height=\"88\" viewBox=\"0 0 512 512\" overflow=\"visible\"><g transform=\"translate(0 512) scale(1 -1)\"><path fill=\"#28d7b1\" fill-rule=\"evenodd\" d=\"M167.5 432.1 L330.5 432.1 L346.5 429.9 L364.5 424.8 L380.5 417.7 L393.5 409.6 L404.5 401.0 L416.0 389.5 L425.8 376.5 L435.9 358.5 L441.7 343.5 L445.9 325.5 L446.9 296.5 L445.8 285.5 L442.8 271.5 L435.7 251.5 L425.9 233.5 L416.9 221.5 L402.5 207.1 L387.5 196.1 L362.5 184.1 L348.5 180.1 L334.5 178.0 L221.5 177.2 L220.5 79.2 L137.5 79.4 L137.2 139.5 L166.5 140.2 L166.8 174.5 L136.5 175.1 L135.6 174.5 L135.7 163.5 L134.5 162.8 L104.1 163.5 L104.5 192.7 L134.5 192.9 L135.5 193.5 L135.4 220.5 L136.2 221.5 L166.8 222.5 L166.5 253.0 L135.5 253.3 L134.5 235.2 L105.5 235.1 L104.1 236.5 L104.3 264.5 L134.5 265.3 L135.5 292.5 L197.5 292.7 L198.4 293.5 L198.0 323.5 L166.8 324.5 L16");
        b.append("7.3 364.5 L198.4 365.5 L198.3 394.5 L166.9 395.5 L166.7 430.5 L167.5 432.1 Z M104.5 407.6 L134.9 407.5 L134.5 377.7 L104.5 377.9 L104.5 407.6 Z M221.5 372.3 L221.5 237.2 L322.5 237.1 L329.5 238.1 L342.5 242.1 L352.5 247.4 L359.5 252.8 L369.6 263.5 L377.0 275.5 L381.5 288.5 L383.1 298.5 L382.7 316.5 L379.7 327.5 L374.8 338.5 L368.9 347.5 L358.5 357.9 L344.5 366.7 L332.5 370.8 L322.5 372.4 L221.5 372.3 Z M65.5 324.3 L93.5 324.3 L93.9 294.5 L64.9 294.5 L64.6 322.5 L65.5 324.3 Z\"/></g></svg><text x=\"244\" y=\"152\" fill=\"#d7ebe6\" font-family=\"Arial,sans-serif\" font-size=\"48\" font-weight=\"800\">Platho usernames</text>");
        if (self.username_len == 4) {
            b.append("<text x=\"244\" y=\"202\" fill=\"#f2ba4b\" font-family=\"Arial,sans-serif\" font-size=\"28\" font-weight=\"800\" letter-spacing=\"4\">EPIC</text>");
        } else {
            if (self.username_len == 5) {
                b.append("<text x=\"244\" y=\"202\" fill=\"#d9e1e6\" font-family=\"Arial,sans-serif\" font-size=\"28\" font-weight=\"800\" letter-spacing=\"4\">RARE</text>");
            } else {
                b.append("<text x=\"244\" y=\"202\" fill=\"#27d4ad\" font-family=\"Arial,sans-serif\" font-size=\"28\" font-weight=\"800\" letter-spacing=\"4\">COMMON</text>");
            }
        }
        b.append("<rect x=\"104\" y=\"276\" width=\"816\" height=\"408\" rx=\"52\" fill=\"#091211\" stroke=\"#1b2d2b\" stroke-width=\"3\"/><path d=\"M154 318H870\" stroke=\"url(#accent)\" stroke-width=\"12\" stroke-linecap=\"round\" opacity=\".38\"/>");
        b = self.appendUsernameTiles(b);
        b.append("<text x=\"512\" y=\"604\" fill=\"#dff8f2\" font-family=\"Arial,sans-serif\" font-size=\"58\" font-weight=\"900\" text-anchor=\"middle\">.ath</text><path d=\"M176 624H848\" stroke=\"url(#accent)\" stroke-width=\"6\" stroke-linecap=\"round\" opacity=\".58\"/><text x=\"512\" y=\"754\" fill=\"#d7ebe6\" font-family=\"Arial,sans-serif\" font-size=\"44\" font-weight=\"800\" text-anchor=\"middle\">");
        b = self.appendSvgUsernameLine(b);
        b.append(".ath</text><text x=\"512\" y=\"826\" fill=\"#68807a\" font-family=\"Arial,sans-serif\" font-size=\"26\" font-weight=\"700\" letter-spacing=\"3\" text-anchor=\"middle\">PLATHO USERNAME</text><text x=\"512\" y=\"890\" fill=\"#2f7062\" font-family=\"Arial,sans-serif\" font-size=\"22\" font-weight=\"700\" letter-spacing=\"4\" text-anchor=\"middle\">ON-CHAIN SVG</text></svg>");
        return b;
    }


    fun appendSvgUriShell(b: StringBuilder): StringBuilder {
        b = self.appendSvgUriDefs(b);
        b.append("%3Crect%20width%3D%221024%22%20height%3D%221024%22%20fill%3D%22url(%23bg)%22%2F%3E%3Crect%20x%3D%2252%22%20y%3D%2252%22%20width%3D%22920%22%20height%3D%22920%22%20rx%3D%2278%22%20fill%3D%22%2307100f%22%20stroke%3D%22%231b2a29%22%20stroke-width%3D%223%22%2F%3E%3Cpath%20d%3D%22M104%20260Q104%20108%20256%20108H920%22%20fill%3D%22none%22%20stroke%3D%22url(%23accent)%22%20stroke-width%3D%2210%22%20stroke-linecap%3D%22round%22%20opacity%3D%22.42%22%2F%3E%3Cpath%20d%3D%22M104%20796Q104%20916%20224%20916H888%22%20fill%3D%22none%22%20stroke%3D%22url(%23accent)%22%20stroke-width%3D%228%22%20stroke-linecap%3D%22round%22%20opacity%3D%22.24%22%2F%3E%3Crect%20x%3D%22112%22%20y%3D%22108%22%20width%3D%22108%22%20height%3D%22108%22%20rx%3D%2228%22%20fill%3D%22%230b1514%22%20stroke%3D%22%231f3432%22%20stroke-width%3D%222%22%2F%3E");
        b.append("%3Csvg%20x%3D%22124%22%20y%3D%22120%22%20width%3D%2288%22%20height%3D%2288%22%20viewBox%3D%220%200%20512%20512%22%20overflow%3D%22visible%22%3E%3Cg%20transform%3D%22translate(0%20512)%20scale(1%20-1)%22%3E%3Cpath%20fill%3D%22%2328d7b1%22%20fill-rule%3D%22evenodd%22%20d%3D%22M167.5%20432.1%20L330.5%20432.1%20L346.5%20429.9%20L364.5%20424.8%20L380.5%20417.7%20L393.5%20409.6%20L404.5%20401.0%20L416.0%20389.5%20L425.8%20376.5%20L435.9%20358.5%20L441.7%20343.5%20L445.9%20325.5%20L446.9%20296.5%20L445.8%20285.5%20L442.8%20271.5%20L435.7%20251.5%20L425.9%20233.5%20L416.9%20221.5%20L402.5%20207.1%20L387.5%20196.1%20L362.5%20184.1%20L348.5%20180.1%20L334.5%20178.0%20L221.5%20177.2%20L220.5%2079.2%20L137.5%2079.4%20L137.2%20139.5%20L166.5%20140.2%20L166.8%20174.5%20L136.5%20175.1%20L135.6%20174.5%20L135.7%20163.5%20L134.5%20162.8%20L104.1%20163.5%2");
        b.append("0L104.5%20192.7%20L134.5%20192.9%20L135.5%20193.5%20L135.4%20220.5%20L136.2%20221.5%20L166.8%20222.5%20L166.5%20253.0%20L135.5%20253.3%20L134.5%20235.2%20L105.5%20235.1%20L104.1%20236.5%20L104.3%20264.5%20L134.5%20265.3%20L135.5%20292.5%20L197.5%20292.7%20L198.4%20293.5%20L198.0%20323.5%20L166.8%20324.5%20L167.3%20364.5%20L198.4%20365.5%20L198.3%20394.5%20L166.9%20395.5%20L166.7%20430.5%20L167.5%20432.1%20Z%20M104.5%20407.6%20L134.9%20407.5%20L134.5%20377.7%20L104.5%20377.9%20L104.5%20407.6%20Z%20M221.5%20372.3%20L221.5%20237.2%20L322.5%20237.1%20L329.5%20238.1%20L342.5%20242.1%20L352.5%20247.4%20L359.5%20252.8%20L369.6%20263.5%20L377.0%20275.5%20L381.5%20288.5%20L383.1%20298.5%20L382.7%20316.5%20L379.7%20327.5%20L374.8%20338.5%20L368.9%20347.5%20L358.5%20357.9%20L344.5%20366.7%20L332.5%20370.8%20L322.5%20372.4%20L221.5%20372.3%20Z%20M65.");
        b.append("5%20324.3%20L93.5%20324.3%20L93.9%20294.5%20L64.9%20294.5%20L64.6%20322.5%20L65.5%20324.3%20Z%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E%3Ctext%20x%3D%22244%22%20y%3D%22152%22%20fill%3D%22%23d7ebe6%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2248%22%20font-weight%3D%22800%22%3EPlatho%20usernames%3C%2Ftext%3E");
        if (self.username_len == 4) {
            b.append("%3Ctext%20x%3D%22244%22%20y%3D%22202%22%20fill%3D%22%23f2ba4b%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2228%22%20font-weight%3D%22800%22%20letter-spacing%3D%224%22%3EEPIC%3C%2Ftext%3E");
        } else {
            if (self.username_len == 5) {
                b.append("%3Ctext%20x%3D%22244%22%20y%3D%22202%22%20fill%3D%22%23d9e1e6%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2228%22%20font-weight%3D%22800%22%20letter-spacing%3D%224%22%3ERARE%3C%2Ftext%3E");
            } else {
                b.append("%3Ctext%20x%3D%22244%22%20y%3D%22202%22%20fill%3D%22%2327d4ad%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2228%22%20font-weight%3D%22800%22%20letter-spacing%3D%224%22%3ECOMMON%3C%2Ftext%3E");
            }
        }
        b.append("%3Crect%20x%3D%22104%22%20y%3D%22276%22%20width%3D%22816%22%20height%3D%22408%22%20rx%3D%2252%22%20fill%3D%22%23091211%22%20stroke%3D%22%231b2d2b%22%20stroke-width%3D%223%22%2F%3E%3Cpath%20d%3D%22M154%20318H870%22%20stroke%3D%22url(%23accent)%22%20stroke-width%3D%2212%22%20stroke-linecap%3D%22round%22%20opacity%3D%22.38%22%2F%3E");
        b = self.appendUsernameUriTiles(b);
        b.append("%3Ctext%20x%3D%22512%22%20y%3D%22604%22%20fill%3D%22%23dff8f2%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2258%22%20font-weight%3D%22900%22%20text-anchor%3D%22middle%22%3E.ath%3C%2Ftext%3E%3Cpath%20d%3D%22M176%20624H848%22%20stroke%3D%22url(%23accent)%22%20stroke-width%3D%226%22%20stroke-linecap%3D%22round%22%20opacity%3D%22.58%22%2F%3E%3Ctext%20x%3D%22512%22%20y%3D%22754%22%20fill%3D%22%23d7ebe6%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2244%22%20font-weight%3D%22800%22%20text-anchor%3D%22middle%22%3E");
        b = self.appendSvgUriUsernameLine(b);
        b.append(".ath%3C%2Ftext%3E%3Ctext%20x%3D%22512%22%20y%3D%22826%22%20fill%3D%22%2368807a%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2226%22%20font-weight%3D%22700%22%20letter-spacing%3D%223%22%20text-anchor%3D%22middle%22%3EPLATHO%20USERNAME%3C%2Ftext%3E%3Ctext%20x%3D%22512%22%20y%3D%22890%22%20fill%3D%22%232f7062%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22700%22%20letter-spacing%3D%224%22%20text-anchor%3D%22middle%22%3EON-CHAIN%20SVG%3C%2Ftext%3E%3C%2Fsvg%3E");
        return b;
    }

    fun snakeImageCell(): Cell {
        let b: StringBuilder = beginTailString();
        b.append("data:image/svg+xml,");
        b = self.appendSvgUriShell(b);
        return b.toCell();
    }

    fun snakeImageDataCell(): Cell {
        let b: StringBuilder = beginTailString();
        b = self.appendSvgShell(b);
        return b.toCell();
    }

    fun individualContent(): Cell {


        let metadata: map<Int as uint256, Cell> = emptyMap();
        metadata.set(USERNAME_ITEM_METADATA_KEY_NAME, self.snakeNameCell());
        metadata.set(USERNAME_ITEM_METADATA_KEY_DESCRIPTION, self.snakeDescriptionCell());
        metadata.set(USERNAME_ITEM_METADATA_KEY_IMAGE, self.snakeImageCell());
        metadata.set(USERNAME_ITEM_METADATA_KEY_IMAGE_DATA, self.snakeImageDataCell());
        return UsernameNftOnchainContent {
            marker: 0,
            metadata: metadata
        }.toCell();
    }

    fun normalizedForwardPayload(payload: Slice): Slice {
        if (payload.empty()) {
            return beginCell().storeBit(false).endCell().beginParse();
        }
        return payload;
    }

    fun sendDeployedAck() {
        message(MessageParameters {
            to: self.username_registry_address,
            value: USERNAME_ITEM_ACK_FORWARD_RESERVE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: UsernameItemDeployedAck {
                name_hash: self.name_hash,
                owner_wallet: self.owner_wallet
            }.toCell()
        });
    }

    receive(msg: InitializeUsernameItem) {
        throwUnless(18010, sender() == self.username_registry_address);
        throwUnless(18011, !self.initialized);
        throwUnless(18012, self.isBasechainAddress(msg.owner_wallet));
        throwUnless(18013, self.isValidUsernameBytes(msg.username_len, msg.username));
        throwUnless(18014, self.computeNameHash(msg.username) == self.name_hash);
        throwUnless(18015, context().value >= USERNAME_ITEM_ACK_FORWARD_RESERVE + USERNAME_ITEM_ACK_EXEC_RESERVE);

        self.initialized = true;
        self.owner_wallet = msg.owner_wallet;
        self.username_len = msg.username_len;
        self.username = beginCell().storeSlice(msg.username).endCell();

        self.sendDeployedAck();
    }

    receive(msg: ResendDeployedAck) {
        throwUnless(18020, self.initialized);
        throwUnless(18021, context().value >= USERNAME_ITEM_ACK_FORWARD_RESERVE + USERNAME_ITEM_ACK_EXEC_RESERVE);
        throwUnless(18022, context().value <= USERNAME_ITEM_ACK_MAX_RESEND_VALUE);
        self.sendDeployedAck();
    }

    receive(msg: NftTransfer) {
        throwUnless(18030, self.initialized);
        throwUnless(18031, sender() == self.owner_wallet);
        throwUnless(18032, self.isBasechainAddress(msg.new_owner));
        throwUnless(18033, self.isBasechainAddress(msg.response_destination));
        throwUnless(18034, msg.forward_amount >= 0);
        throwUnless(18035, context().value >= USERNAME_ITEM_TRANSFER_EXEC_RESERVE + msg.forward_amount + USERNAME_ITEM_TRANSFER_FWD_FEE_ALLOWANCE);

        let previousOwner: Address = self.owner_wallet;
        self.owner_wallet = msg.new_owner;

        if (msg.forward_amount > 0) {
            message(MessageParameters {
                to: msg.new_owner,
                value: msg.forward_amount,
                mode: SendPayFwdFeesSeparately,
                bounce: false,
                body: NftOwnershipAssigned {
                    query_id: msg.query_id,
                    previous_owner: previousOwner,
                    forward_payload: self.normalizedForwardPayload(msg.forward_payload)
                }.toCell()
            });
        }

        if (context().value >= USERNAME_ITEM_TRANSFER_EXEC_RESERVE + msg.forward_amount + USERNAME_ITEM_TRANSFER_FWD_FEE_ALLOWANCE + USERNAME_ITEM_EXCESSES_MIN_VALUE) {
            message(MessageParameters {
                to: msg.response_destination,
                value: 0,
                mode: SendRemainingValue,
                bounce: false,
                body: NftExcesses {
                    query_id: msg.query_id
                }.toCell()
            });
        }
    }

    receive(msg: TopUpStorageReserve) {
        // Accept TON for storage reserve only. Grants no authority and mutates no protocol state.
    }

    get fun get_state(): UsernameNFTItemStateView {
        return UsernameNFTItemStateView {
            initialized: self.initialized,
            owner_wallet: self.owner_wallet,
            username_registry_address: self.username_registry_address,
            name_hash: self.name_hash,
            username_len: self.username_len,
            username: self.username,
            tier: self.tier()
        };
    }

    get fun get_nft_data(): UsernameNftDataView {
        return UsernameNftDataView {
            initialized: self.initialized,
            index: self.name_hash,
            collection_address: self.username_registry_address,
            owner_address: self.owner_wallet,
            individual_content: self.individualContent()
        };
    }

    receive() {
        throw(18099);
    }
}
