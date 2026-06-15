// ============================================================================
// TEMPORARY / THROWAWAY PROBE CONTRACT — NOT PART OF THE PROTOCOL SUITE.
//
// Purpose: a minimal, standalone TEP-62/TEP-64 NFT *item* (no collection) used
// only to probe how testnet.tonapi.io / Tonkeeper-testnet / GetGems-testnet
// render fully on-chain SVG metadata, in two configurations:
//
//   Config A: { name, description, image_data: <raw SVG bytes> }       (no `image`)
//   Config B: A + image: "data:image/svg+xml," + percent-encoded(SVG)
//
// Do NOT import this from any production contract. It lives under contracts/_probe/
// with its own build entry so it never disturbs the protocol build or test suite.
//
// Design note: the full TEP-64 metadata dictionary (including the chunked snake
// SVG cells) is assembled OFF-CHAIN by scripts/testnet_nft_probe_deploy.mjs and
// embedded into this contract's init data. The contract is intentionally trivial:
// it stores the metadata map + owner + a config discriminator, and returns them
// verbatim from get_nft_data (TEP-62). Building the ~5 KB SVG snake off-chain
// avoids the on-chain string-builder cell-size limits entirely and keeps the
// returned individual_content a genuine on-chain `map<Int as uint256, Cell>`.
// ============================================================================

// TEP-62 get_nft_data return shape.
struct ProbeNftDataView {
    init: Bool;
    index: Int;
    collection_address: Address?;   // addr_none (null) for a standalone item
    owner_address: Address;
    individual_content: Cell;
}

// TEP-64 on-chain content: 0x00 dictionary marker byte, then a
// map<Int as uint256, Cell> keyed by sha256(attribute_name); each value is a
// 0x00-marker snake string cell.
struct ProbeOnchainContent {
    marker: Int as uint8;                 // 0x00 = on-chain dictionary
    metadata: map<Int as uint256, Cell>;  // sha256(key) -> snake-string value cell
}

contract SvgRenderProbeItem {
    // config: 0 = Config A (no image key), 1 = Config B (image data-URI present).
    // It is part of init data so Config A and Config B derive to DIFFERENT
    // addresses even with otherwise-identical owner/content shapes.
    config: Int as uint8;
    owner_address: Address;
    metadata: map<Int as uint256, Cell>;

    init(config: Int, owner_address: Address, metadata: map<Int as uint256, Cell>) {
        self.config = config;
        self.owner_address = owner_address;
        self.metadata = metadata;
    }

    // Accept a bodyless internal deploy message (and any plain top-up). The probe
    // does no transfers — it only needs to exist on-chain so explorers can read it.
    receive() {}

    get fun get_nft_data(): ProbeNftDataView {
        return ProbeNftDataView {
            init: true,
            index: 0,
            collection_address: null,        // addr_none — standalone item, no collection
            owner_address: self.owner_address,
            individual_content: ProbeOnchainContent {
                marker: 0,
                metadata: self.metadata
            }.toCell()
        };
    }

    // Convenience getter for the deploy script's offline cross-check.
    get fun get_config(): Int {
        return self.config;
    }
}
