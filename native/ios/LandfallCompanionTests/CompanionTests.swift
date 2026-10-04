import XCTest
import CoreLocation
@testable import LandfallCompanion

final class CompanionTests: XCTestCase {
    func testConfiguredOriginRequiresSingleHTTPSAuthority() {
        for value in ["http://example.com", "https://user@example.com", "https://example.com/player", "https://example.com?token=secret", "https://example.com#fragment", "file:///private", "javascript:alert(1)"] { XCTAssertNil(LandfallCompanion.allowedOrigin(value)) }
        XCTAssertNotNil(LandfallCompanion.allowedOrigin("https://example.com:443"))
    }
    func testNativeWakeJournalIsEncryptedBoundedAndClearable() {
        let hints=LandfallSecureHints();hints.clear()
        for _ in 0..<40 { hints.append(handle: String(repeating: "a", count: 64), event: "ENTER") }
        XCTAssertEqual(hints.read().count,32, hints.storageState)
        XCTAssertFalse(hints.read().contains { $0["latitude"] != nil || $0["longitude"] != nil })
        hints.clear();XCTAssertTrue(hints.read().isEmpty)
    }
    func testUnconfiguredShellDoesNotAcquireLocation() {
        let companion=LandfallCompanion()
        XCTAssertNil(companion.origin)
        XCTAssertFalse(companion.accepts(URL(string:"https://example.com/player")))
        XCTAssertNotNil(CLLocationManager())
    }
    func testFailedRegistrationCanRemoveOnlyItsOwnConsent() {
        let hints=LandfallSecureHints(); hints.clear()
        defer { hints.clear() }
        let failed=String(repeating:"a",count:64), other=String(repeating:"b",count:64)
        let expiry=Date().timeIntervalSince1970*1000+60000
        hints.register(handle:failed,expiresAt:expiry,notifications:true)
        hints.register(handle:other,expiresAt:expiry,notifications:false)
        hints.remove(handle:failed)
        XCTAssertFalse(hints.active(handle:failed)); XCTAssertFalse(hints.notices(handle:failed))
        XCTAssertTrue(hints.active(handle:other)); XCTAssertFalse(hints.notices(handle:other))
    }
}
