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
    func testBoundedNativeLeaseEncryptionAndRestorePerformance() throws {
        let origin = "https://synthetic-performance.example.test"
        let store = LandfallPrivateStore(origin: origin); store.clear(); defer { store.clear() }
        let value = String(repeating: "x", count: 4096)
        let names = (0..<8).map { "landfall-region-lease-v1:performance-\($0)" }
        let folder = "landfall-private-leases-v1-" + SHA256.hash(data: Data(origin.utf8)).map { String(format: "%02x", $0) }.joined()
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent(folder)
        XCTAssertTrue(store.put(names[0], value: value, expiresAt: Date().timeIntervalSince1970 * 1000 + 60000))
        store.remove(names[0])
        let options = XCTMeasureOptions(); options.iterationCount = 3
        var samples: [[String: Any]] = []
        measure(metrics: [XCTClockMetric(), XCTCPUMetric(), XCTMemoryMetric()], options: options) {
            let started = ProcessInfo.processInfo.systemUptime
            let expiry = Date().timeIntervalSince1970 * 1000 + 60000
            for name in names { XCTAssertTrue(store.put(name, value: value, expiresAt: expiry)) }
            let restored = LandfallPrivateStore(origin: origin)
            for name in names { XCTAssertEqual(restored.get(name), value) }
            let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.fileSizeKey])) ?? []
            let bytes = files.reduce(0) { total, file in total + ((try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0) }
            XCTAssertEqual(files.count, 8)
            XCTAssertLessThanOrEqual(bytes, 65536, "Preliminary encrypted native lease storage budget")
            for name in names { restored.remove(name) }
            XCTAssertTrue(restored.list().isEmpty)
            let elapsedMs = (ProcessInfo.processInfo.systemUptime - started) * 1000
            XCTAssertTrue(elapsedMs.isFinite && elapsedMs >= 0)
            XCTAssertLessThan(elapsedMs, 5000, "Preliminary native encryption/restore batch budget")
            samples.append(["elapsedMs": elapsedMs, "storedBytes": bytes, "records": files.count,
                            "withinPreliminaryBudget": elapsedMs < 5000 && bytes <= 65536 && files.count == 8])
            // Public synthetic measurements only. XCTest also records native CPU
            // and memory metrics in its source-bound result bundle.
            print("LANDFALL_NATIVE_LEASE_PERFORMANCE elapsedMs=\(elapsedMs) storedBytes=\(bytes) records=8 physicalEnergyProven=false")
        }
        let data = try JSONSerialization.data(withJSONObject: ["version": 1, "measurementClass": "NATIVE_ENCRYPTED_LEASE_BATCH",
            "configuredIterations": 3, "observedBatches": samples.count, "physicalEnergyProven": false,
            "elapsedBudgetMs": 5000, "storageBudgetBytes": 65536, "samples": samples], options: [.sortedKeys])
        let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
        attachment.name = "native-lease-performance.json"; attachment.lifetime = .keepAlways; add(attachment)
    }
}
