import XCTest
import Foundation
import CryptoKit
@testable import LandfallCompanion

final class PrivateStoreTests: XCTestCase {
    func testRestartLeaseIsEncryptedOriginBoundAndClearable() throws {
        let origin = "https://synthetic-lease.example.test"
        let store = LandfallPrivateStore(origin: origin); store.clear(); defer { store.clear() }
        let name = "landfall-offline-lease-v2:synthetic-session"
        let secret = "SYNTHETIC_PRIVATE_LEASE_ONLY"
        XCTAssertTrue(store.put(name, value: secret, expiresAt: Date().timeIntervalSince1970 * 1000 + 60000))
        XCTAssertEqual(LandfallPrivateStore(origin: origin).get(name), secret)
        XCTAssertNil(LandfallPrivateStore(origin: "https://other-origin.example.test").get(name))
        let folder = "landfall-private-leases-v1-" + SHA256.hash(data: Data(origin.utf8)).map { String(format: "%02x", $0) }.joined()
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent(folder)
        let file = try XCTUnwrap(FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil).first)
        let ciphertext = try Data(contentsOf: file)
        XCTAssertNil(ciphertext.range(of: Data(secret.utf8)))
        var tampered = ciphertext; tampered[0] ^= 1; try tampered.write(to: file)
        XCTAssertNil(store.get(name))
        XCTAssertTrue(store.list().isEmpty)
    }
    func testInvalidKeysExpiredLeasesAndOversizedValuesFailClosed() {
        let store = LandfallPrivateStore(origin: "https://synthetic-bounds.example.test"); store.clear(); defer { store.clear() }
        let now = Date().timeIntervalSince1970 * 1000
        XCTAssertFalse(store.put("../../private", value: "synthetic", expiresAt: now + 60000))
        XCTAssertFalse(store.put("landfall-offline-identity-v2", value: "synthetic", expiresAt: now - 1))
        XCTAssertFalse(store.put("landfall-offline-identity-v2", value: "synthetic", expiresAt: now + 86401000))
        XCTAssertFalse(store.put("landfall-offline-identity-v2", value: String(repeating: "x", count: 8193), expiresAt: now + 60000))
        XCTAssertTrue(store.list().isEmpty)
        XCTAssertTrue(store.put("landfall-offline-identity-v2:chunk:0", value: "synthetic-identity-chunk", expiresAt: now + 60000))
        XCTAssertEqual(store.get("landfall-offline-identity-v2:chunk:0"), "synthetic-identity-chunk")
    }
    func testCompleteLeaseReturnsOnlyItsBoundJourney() throws {
        let store = LandfallPrivateStore(origin: "https://synthetic-journey.example.test"); store.clear(); defer { store.clear() }
        let expiry = Date().timeIntervalSince1970 * 1000 + 60000
        let name = "landfall-offline-lease-v2:synthetic-session"
        let lease = try JSONSerialization.data(withJSONObject: ["sessionId": "synthetic-session", "versionId": "synthetic-version", "csrfToken": "synthetic-csrf", "expiresAt": expiry])
        XCTAssertTrue(store.put(name + ":chunk:0", value: lease.base64EncodedString(), expiresAt: expiry))
        XCTAssertNil(store.lastJourney())
        let digest = SHA256.hash(data: lease).map { String(format: "%02x", $0) }.joined()
        let metadata = try JSONSerialization.data(withJSONObject: ["version": 1, "chunks": 1, "sha256": digest, "expiresAt": expiry])
        XCTAssertTrue(store.put(name, value: String(decoding: metadata, as: UTF8.self), expiresAt: expiry))
        XCTAssertEqual(store.lastJourney(), "synthetic-session")
        store.remove(name + ":chunk:0"); XCTAssertNil(store.lastJourney())
    }
}
