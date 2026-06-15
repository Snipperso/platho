// ============================================================================
// TEMPORARY / THROWAWAY PROBE CONTRACT — NOT PART OF THE PROTOCOL SUITE.
//
// Purpose: a minimal, standalone TEP-62 NFT *collection + item* pair used only
// to probe how tonapi.io's ONCHAIN image renderer treats different on-chain
// TEP-64 content configurations. tonapi does NOT index collection-less items,
// so this probe is a real collection that supplies each item's full on-chain
// content via get_nft_content(index, individual_content) — mirroring the live,
// correctly-indexed Platho username registry pattern:
//
//   * Items are CONTENT-LESS: init is just (collection, index, owner). Their own
//     get_nft_data returns a minimal VALID TEP-64 placeholder content cell; the
//     collection OVERRIDES it via get_nft_content (TEP-62 "collection completes
//     the item content"). See contracts/UsernameNFTItem.tact get_nft_data and
//     contracts/UsernameRegistry.tact get_nft_content/get_nft_address_by_index.
//
//   * The COLLECTION carries a `contents` map<index, Cell> of fully-assembled
//     on-chain content cells (built OFFLINE) and serves them per index.
//
// The four content configs (built off-chain, baked into `contents` keys 0..3):
//   index 0 (A): { name, description, image_data: <raw full SVG bytes> }   (no image)
//   index 1 (B): { name, description, image_data: <trivial SVG bytes> }    (no image)
//   index 2 (C): { name, description, image: "data:image/svg+xml;base64,..." } (no image_data)
//   index 3 (D): { name, description, image: "data:image/svg+xml,<percent>" } (no image_data)
//
// Do NOT import this from any production contract. It lives under contracts/_probe/
// with its own build entry (tact.config.probe.json) so it never disturbs the
// protocol build or test suite. The collection + all four items deploy in ONE
// external: the deploy message body is ProbeMintAll, which loops and deploys each
// content-less item from the collection.
// ============================================================================

// TEP-62 get_nft_data return shape for the content-less item.
struct ProbeItemDataView {
    init: Bool;
    index: Int;
    collection_address: Address;
    owner_address: Address;
    individual_content: Cell;
}

// TEP-62 get_collection_data return shape (mirror UsernameCollectionDataView).
struct ProbeCollectionDataView {
    next_item_index: Int;
    collection_content: Cell;
    owner_address: Address;
}

// Forced-opcode mint message so it is trivially hand-serializable off-chain:
// 0x50524f42 = ASCII "PROB". The collection's deploy external carries this as its
// body, so the collection self-initializes AND mints all items in the same tx.
message(0x50524f42) ProbeMintAll {
    item_value: Int as coins;
}

// ----------------------------------------------------------------------------
// Content-less item. Its init is (collection, index, owner) only — no metadata.
// ----------------------------------------------------------------------------
contract ProbeItem {
    collection: Address;
    index: Int as uint64;
    owner: Address;

    init(collection: Address, index: Int, owner: Address) {
        self.collection = collection;
        self.index = index;
        self.owner = owner;
    }

    // Accept the bodyless internal deploy message (and any plain top-up). The
    // item does no transfers; it only needs to exist so explorers can read it.
    receive() {}

    get fun get_nft_data(): ProbeItemDataView {
        return ProbeItemDataView {
            init: true,
            index: self.index,
            collection_address: self.collection,
            owner_address: self.owner,
            // Minimal VALID TEP-64 on-chain content placeholder: 0x00 marker byte
            // + empty HashmapE (single 0 bit). The collection overrides the real
            // content via get_nft_content, so this is just a valid stand-in.
            individual_content: beginCell().storeUint(0, 8).storeUint(0, 1).endCell()
        };
    }
}

// ----------------------------------------------------------------------------
// Collection. Holds the off-chain-assembled per-index content cells and serves
// them via get_nft_content, mirroring UsernameRegistry's getter shapes exactly.
// ----------------------------------------------------------------------------
contract ProbeCollection {
    owner: Address;
    next_index: Int as uint64;
    collection_content: Cell;
    contents: map<Int as uint64, Cell>;

    init(owner: Address, next_index: Int, collection_content: Cell, contents: map<Int as uint64, Cell>) {
        self.owner = owner;
        self.next_index = next_index;
        self.collection_content = collection_content;
        self.contents = contents;
    }

    // Accept plain top-ups.
    receive() {}

    // Mint-on-deploy: loop 0..next_index-1, deploy each content-less item.
    receive(msg: ProbeMintAll) {
        let i: Int = 0;
        while (i < self.next_index) {
            let init: StateInit = initOf ProbeItem(myAddress(), i, self.owner);
            send(SendParameters {
                to: contractAddress(init),
                value: msg.item_value,
                mode: SendIgnoreErrors,
                bounce: false,
                code: init.code,
                data: init.data,
                body: emptyCell()
            });
            i += 1;
        }
    }

    get fun get_collection_data(): ProbeCollectionDataView {
        return ProbeCollectionDataView {
            next_item_index: self.next_index,
            collection_content: self.collection_content,
            owner_address: self.owner
        };
    }

    get fun get_nft_address_by_index(index: Int): Address {
        return contractAddress(initOf ProbeItem(myAddress(), index, self.owner));
    }

    get fun get_nft_content(index: Int, individual_content: Cell): Cell {
        let stored: Cell? = self.contents.get(index);
        if (stored != null) {
            return stored!!;
        }
        // Minimal VALID TEP-64 placeholder for any index without baked content.
        return beginCell().storeUint(0, 8).storeUint(0, 1).endCell();
    }
}
