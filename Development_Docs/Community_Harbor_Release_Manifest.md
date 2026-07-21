# Community Harbor release manifest

Schema version 1 requires `listingId`, semantic version (`MAJOR.MINOR.PATCH` with optional prerelease), immutable `sourcePublishedTaleVersionId`, public metadata, license key/version, and ordered attribution. Minimum platform version and compatibility metadata are stored alongside the manifest. The source service loads an actual `PublishedTaleVersion`, captures source Tale ID/checksum separately, and rejects draft IDs or source substitution.

Canonical serialization recursively sorts object keys while retaining array order, then computes SHA-256 over UTF-8 JSON. Thus `{a:1,b:2}` and `{b:2,a:1}` have the same checksum while a changed value produces a new checksum. Test vector: schema 1/listing `l`/version `1.0.0` with stable metadata has the same checksum on repeated construction; changing title changes it.

Public listing data is not an installable package. Raw snapshots, answers, hidden variables, notes, coordinates, private assets, and participant data are excluded. Immutable payload fields cannot be updated; corrections create a new release. Deprecation, replacement, and moderation delivery status are separate fields. Future schemas require a new manifest schema version and compatibility adapter; older releases remain identifiable.
