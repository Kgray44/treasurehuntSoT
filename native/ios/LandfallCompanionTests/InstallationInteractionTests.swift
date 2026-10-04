import XCTest
import CoreNFC
import AVFoundation
import CoreBluetooth
import UIKit
@testable import LandfallCompanion

final class InstallationInteractionTests: XCTestCase {
    @MainActor
    func testActualFrameworkCapabilitiesAndInactiveAcquisition() throws {
        var events = [[String: Any]]()
        let hardware = LandfallHardware { events.append($0) }
        let scanId = UUID().uuidString
        XCTAssertEqual(hardware.startNfc(foreground: false, scanId: scanId), "UNAVAILABLE")
        XCTAssertEqual(hardware.startBle(foreground: false, scanId: scanId), "UNAVAILABLE")
        XCTAssertEqual(hardware.startBle(foreground: true, scanId: "invalid"), "UNAVAILABLE")
        XCTAssertEqual(hardware.startQr(foreground: false, scanId: scanId, presenter: nil), "UNAVAILABLE")
        XCTAssertEqual(hardware.startNfc(foreground: true, scanId: "invalid"), "UNAVAILABLE")
        XCTAssertEqual(hardware.startQr(foreground: true, scanId: "invalid", presenter: UIViewController()), "UNAVAILABLE")
        let nfcAvailable = NFCNDEFReaderSession.readingAvailable
        let cameraAvailable = AVCaptureDevice.default(for: .video) != nil
        if !nfcAvailable { XCTAssertEqual(hardware.startNfc(foreground: true, scanId: scanId), "UNSUPPORTED") }
        if !cameraAvailable { XCTAssertEqual(hardware.startQr(foreground: true, scanId: scanId, presenter: UIViewController()), "UNSUPPORTED") }
        hardware.stopInteractions(); hardware.stop(); hardware.stop()
        XCTAssertTrue(events.isEmpty)
        let receipt = try JSONSerialization.data(withJSONObject: [
            "nfcReadingAvailable": nfcAvailable, "cameraAvailable": cameraAvailable,
            "cameraAuthorization": AVCaptureDevice.authorizationStatus(for: .video).rawValue,
            "bluetoothAuthorization": CBCentralManager.authorization.rawValue,
            "acquisitionStarted": false, "observedTokens": 0, "physicalPresence": "NOT_PROVEN", "canComplete": false
        ])
        let attachment = XCTAttachment(data: receipt, uniformTypeIdentifier: "public.json")
        attachment.name = "installation-framework-capabilities-and-inactive-guards"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
