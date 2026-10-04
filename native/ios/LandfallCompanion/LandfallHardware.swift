import Foundation
import CoreBluetooth
import CoreNFC
import AVFoundation
import UIKit
import CryptoKit

/** No radio or camera signal can complete progression; signed payloads go to the canonical verifier. */
final class LandfallHardware: NSObject, CBCentralManagerDelegate, NFCNDEFReaderSessionDelegate {
    private let emit: ([String: Any]) -> Void
    private var bluetooth: CBCentralManager?
    private var nfc: NFCNDEFReaderSession?
    private var scanning=false
    private var lastBle=Date.distantPast
    private let salt=UUID().uuidString
    private var qr: LandfallQRViewController?
    private var qrScanId: String?
    private var nfcScanId: String?
    private var interactionExpiry: DispatchWorkItem?
    init(emit: @escaping ([String: Any]) -> Void) { self.emit=emit; super.init() }
    func startBle(foreground: Bool) -> String {
        guard foreground else { return "UNAVAILABLE" }
        guard CBCentralManager.authorization != .denied && CBCentralManager.authorization != .restricted else { return "DENIED" }
        scanning=true
        if bluetooth==nil { bluetooth=CBCentralManager(delegate: self, queue: .main) }
        if bluetooth?.state == .poweredOn { bluetooth?.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true]); return "GRANTED" }
        return bluetooth?.state == .unsupported ? "UNSUPPORTED" : "PROMPTABLE"
    }
    func centralManagerDidUpdateState(_ central: CBCentralManager) { if scanning && central.state == .poweredOn { central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true]) } }
    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi: NSNumber) {
        guard scanning, Date().timeIntervalSince(lastBle)>=1 else { return }; lastBle=Date()
        let peer=SHA256.hash(data: Data((salt+peripheral.identifier.uuidString).utf8)).map { String(format: "%02x", $0) }.joined()
        emit(["type": "nearby", "family": "BLE", "authenticated": false, "peerId": peer, "rssi": rssi, "observedAt": Int(Date().timeIntervalSince1970*1000)])
    }
    func startNfc(foreground: Bool, scanId: String) -> String {
        guard foreground, UUID(uuidString: scanId) != nil, nfc == nil, qr == nil else { return "UNAVAILABLE" }; guard NFCNDEFReaderSession.readingAvailable else { return "UNSUPPORTED" }
        nfcScanId=scanId
        nfc=NFCNDEFReaderSession(delegate: self, queue: .main, invalidateAfterFirstRead: true); nfc?.alertMessage="Read a signed journey token. Links never change Voyage progress."
        let expiry=DispatchWorkItem { [weak self] in guard let self=self, self.nfcScanId==scanId else { return };self.stopInteractions();self.emit(["type":"interaction-ended", "medium":"NFC", "scanId":scanId]) }
        interactionExpiry=expiry;DispatchQueue.main.asyncAfter(deadline: .now()+30,execute: expiry)
        nfc?.begin(); return "GRANTED"
    }
    func readerSession(_ session: NFCNDEFReaderSession, didInvalidateWithError error: Error) {
        guard session === nfc else { return }; let scanId=nfcScanId; nfc=nil; nfcScanId=nil
        interactionExpiry?.cancel();interactionExpiry=nil
        if let scanId=scanId { emit(["type":"interaction-ended", "medium":"NFC", "scanId":scanId]) }
    }
    func readerSession(_ session: NFCNDEFReaderSession, didDetectNDEFs messages: [NFCNDEFMessage]) {
        guard session === nfc, let scanId=nfcScanId else { return }
        guard messages.flatMap({ $0.records }).reduce(0, { $0 + $1.payload.count })<=4096 else { stopInteractions();return }
        for record in messages.flatMap({ $0.records }).prefix(16) where record.typeNameFormat == .nfcWellKnown && record.type == Data([0x54]) {
            if let token=record.wellKnownTypeTextPayload().0, token.utf8.count<=2048 { nfcScanId=nil; emit(["type": "interaction", "medium": "NFC", "scanId": scanId, "token": token]); return }
        }
    }
    func startQr(foreground: Bool, scanId: String, presenter: UIViewController?) -> String {
        guard foreground, UUID(uuidString: scanId) != nil, let presenter=presenter, qr==nil, nfc==nil else { return "UNAVAILABLE" }
        guard AVCaptureDevice.default(for: .video) != nil else { return "UNSUPPORTED" }
        let status=AVCaptureDevice.authorizationStatus(for: .video)
        if status == .denied || status == .restricted { return "DENIED" }
        if status == .notDetermined { AVCaptureDevice.requestAccess(for: .video) { _ in }; return "PROMPTABLE" }
        qrScanId=scanId
        let controller=LandfallQRViewController { [weak self] token in
            guard let self=self, self.qrScanId==scanId else { return }
            self.qrScanId=nil;self.qr=nil;self.interactionExpiry?.cancel();self.interactionExpiry=nil
            if let token=token, token.utf8.count<=2048 { self.emit(["type": "interaction", "medium": "QR", "scanId":scanId, "token": token]) }
            else { self.emit(["type":"interaction-ended", "medium":"QR", "scanId":scanId]) }
        }
        let expiry=DispatchWorkItem { [weak self] in guard let self=self, self.qrScanId==scanId else { return }; self.stopInteractions();self.emit(["type":"interaction-ended", "medium":"QR", "scanId":scanId]) }
        interactionExpiry=expiry;DispatchQueue.main.asyncAfter(deadline: .now()+30,execute: expiry)
        qr=controller; presenter.present(controller, animated: true); return "GRANTED"
    }
    func stopInteractions() { interactionExpiry?.cancel();interactionExpiry=nil;nfcScanId=nil;qrScanId=nil;nfc?.invalidate();nfc=nil;qr?.dismiss(animated: false);qr=nil }
    func stop() { scanning=false; bluetooth?.stopScan();stopInteractions() }
}

final class LandfallQRViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    private let session=AVCaptureSession()
    private let sessionQueue=DispatchQueue(label:"voyagewright.landfall.qr-camera")
    private let done: (String?) -> Void
    private var completed=false
    init(done: @escaping (String?) -> Void) { self.done=done; super.init(nibName: nil, bundle: nil) }
    required init?(coder: NSCoder) { fatalError("Unsupported initializer") }
    override func viewDidLoad() {
        super.viewDidLoad(); view.backgroundColor = .black
        let close=UIButton(type: .system); close.setTitle("Cancel QR scan", for: .normal); close.addTarget(self, action: #selector(cancel), for: .touchUpInside); close.frame=CGRect(x: 20,y: 50,width: 200,height: 44); close.accessibilityLabel="Cancel QR scan"
        guard let device=AVCaptureDevice.default(for: .video), let input=try? AVCaptureDeviceInput(device: device), session.canAddInput(input) else { finish(nil); return }
        session.addInput(input); let output=AVCaptureMetadataOutput(); guard session.canAddOutput(output) else { finish(nil); return };session.addOutput(output);output.setMetadataObjectsDelegate(self, queue: .main);output.metadataObjectTypes=[.qr]
        let preview=AVCaptureVideoPreviewLayer(session: session);preview.frame=view.bounds;preview.videoGravity = .resizeAspectFill;view.layer.addSublayer(preview);view.addSubview(close)
        sessionQueue.async { [weak self] in self?.session.startRunning() }
    }
    override func viewDidDisappear(_ animated: Bool) { super.viewDidDisappear(animated);sessionQueue.async { [weak self] in self?.session.stopRunning() };if !completed {completed=true;done(nil)} }
    @objc private func cancel() { finish(nil) }
    private func finish(_ token: String?) { guard !completed else {return};completed=true;sessionQueue.async { [weak self] in self?.session.stopRunning() };done(token);dismiss(animated: true) }
    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput objects: [AVMetadataObject], from connection: AVCaptureConnection) { if let token=(objects.first as? AVMetadataMachineReadableCodeObject)?.stringValue {finish(token)} }
}
