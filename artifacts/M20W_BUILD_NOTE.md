# M20W Build Note

Contract compilation was exercised through the passing Vitest/Tact wrapper tests and regenerated code/hash artifacts.

A separate direct `tact --project ...` command was not retained as a proof artifact in this sandbox because the direct compiler command can exceed the tool execution window while emitting reports for larger projects.

Proof artifacts retained for M20W are the chunked regression outputs, regenerated code hashes, M16 conformance, M17 gas sanity, and M18 artifact integrity reports.
