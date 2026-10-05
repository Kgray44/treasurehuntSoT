import XCTest
import NearbyInteraction
@testable import LandfallCompanion

final class NearbyInteractionTests: XCTestCase {
    func testFrameworkCapabilityAndInactiveLifecycle() throws {
        var events = [[String: Any]]()
        let provider = LandfallNearbyInteraction { events.append($0) }
        let supported = NISession.deviceCapabilities.supportsPreciseDistanceMeasurement
        XCTAssertEqual(provider.state()["supported"] as? Bool, supported)
        XCTAssertEqual(provider.prepare(foreground: false)["state"] as? String, "UNAVAILABLE")
        if !supported { XCTAssertEqual(provider.prepare(foreground: true)["state"] as? String, "UNSUPPORTED") }
        provider.stop(); XCTAssertTrue(events.isEmpty)
        let receipt = try JSONSerialization.data(withJSONObject: ["supportsPreciseDistanceMeasurement": supported, "rangeSessionStarted": false, "observedRanges": 0, "canComplete": false])
        let attachment = XCTAttachment(data: receipt, uniformTypeIdentifier: "public.json")
        attachment.name = "nearby-interaction-framework-capability"; attachment.lifetime = .keepAlways
        add(attachment)
    }
    func testUnsupportedDeviceDoesNotPrepareOrEmitAReportedRange() {
        var events = [[String: Any]]()
        let provider = LandfallNearbyInteraction(supported: { false }) { events.append($0) }
        XCTAssertEqual(provider.prepare(foreground: true)["state"] as? String, "UNSUPPORTED")
        XCTAssertEqual(provider.start([:], foreground: true)["state"] as? String, "UNSUPPORTED")
        XCTAssertEqual(provider.prepare(foreground: false)["state"] as? String, "UNAVAILABLE")
        provider.stop(); provider.stop()
        XCTAssertTrue(events.isEmpty)
        XCTAssertEqual(provider.state()["canComplete"] as? Bool, false)
    }
    func testPairingRejectsReplayUnboundedArchiveAndIdentityClaims() {
        let baseline: [String: Any] = ["peerId": "peer-1", "discoveryToken": Data([1,2]).base64EncodedString(), "expiresAt": 30000.0]
        XCTAssertTrue(LandfallNearbyInteraction.validSession(baseline, now: 1000))
        let replacements: [[String: Any]] = [
            ["expiresAt": 1000.0], ["expiresAt": 301001.0], ["expiresAt": Double.infinity],
            ["peerId": "../peer"], ["discoveryToken": "AQI=\n"],
            ["discoveryToken": Data(repeating: 0, count: 4097).base64EncodedString()],
            ["authenticated": true]
        ]
        for replacement in replacements {
            var invalid = baseline; invalid.merge(replacement) { _, new in new }
            XCTAssertFalse(LandfallNearbyInteraction.validSession(invalid, now: 1000))
        }
        XCTAssertFalse(LandfallNearbyInteraction.validSession(baseline, now: .nan))
    }
}
