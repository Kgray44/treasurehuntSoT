import Foundation
import NearbyInteraction

/** Optional foreground hints. Discovery-token possession is not verified Player identity. */
final class LandfallNearbyInteraction: NSObject, NISessionDelegate {
    private let emit: ([String: Any]) -> Void
    private var session: NISession?
    private var peerToken: NIDiscoveryToken?
    private var peerId: String?
    private var preparationExpiresAt = 0.0
    private var expiresAt = 0.0
    private var lastAt = 0.0
    private var expiry: DispatchWorkItem?
    private let now: () -> Double
    private let supported: () -> Bool

    init(now: @escaping () -> Double = { Date().timeIntervalSince1970 * 1000 },
         supported: @escaping () -> Bool = { NISession.deviceCapabilities.supportsPreciseDistanceMeasurement },
         emit: @escaping ([String: Any]) -> Void) {
        self.now = now; self.supported = supported; self.emit = emit
        super.init()
    }
    deinit { expiry?.cancel(); session?.invalidate() }
    func state() -> [String: Any] {
        ["state": supported() ? (session == nil ? "UNAVAILABLE" : "INITIALIZING") : "UNSUPPORTED",
         "supported": supported(), "peerVerified": false, "canComplete": false]
    }
    func prepare(foreground: Bool) -> [String: Any] {
        stop()
        guard foreground else { return ["state": "UNAVAILABLE"] }
        guard supported() else { return ["state": "UNSUPPORTED"] }
        let candidate = NISession()
        candidate.delegate = self
        guard let token = candidate.discoveryToken,
              let data = try? NSKeyedArchiver.archivedData(withRootObject: token, requiringSecureCoding: true),
              data.count <= 4096 else { candidate.invalidate(); return ["state": "UNAVAILABLE"] }
        session = candidate
        preparationExpiresAt = now() + 60000
        scheduleExpiry(at: preparationExpiresAt, session: candidate)
        return ["state": "READY", "discoveryToken": data.base64EncodedString()]
    }
    static func validSession(_ payload: [String: Any], now: Double) -> Bool {
        guard Set(payload.keys) == Set(["peerId", "discoveryToken", "expiresAt"]),
              let peer = payload["peerId"] as? String,
              peer.utf8.count <= 128, peer.range(of: "^[A-Za-z0-9][A-Za-z0-9._:-]*$", options: .regularExpression) != nil,
              let token = payload["discoveryToken"] as? String, token.utf8.count <= 5464,
              let data = Data(base64Encoded: token), !data.isEmpty, data.count <= 4096,
              data.base64EncodedString() == token,
              let end = payload["expiresAt"] as? Double, now.isFinite, end.isFinite,
              end > now, end - now <= 300000 else { return false }
        return true
    }
    func start(_ payload: [String: Any], foreground: Bool) -> [String: Any] {
        guard foreground, supported(), let current = session, peerToken == nil,
              now() < preparationExpiresAt, Self.validSession(payload, now: now()),
              let encoded = payload["discoveryToken"] as? String, let data = Data(base64Encoded: encoded),
              let token = try? NSKeyedUnarchiver.unarchivedObject(ofClass: NIDiscoveryToken.self, from: data) else {
            stop(); return ["state": supported() ? "UNAVAILABLE" : "UNSUPPORTED"]
        }
        peerToken = token; peerId = payload["peerId"] as? String
        expiresAt = payload["expiresAt"] as? Double ?? 0; lastAt = 0
        scheduleExpiry(at: expiresAt, session: current)
        current.run(NINearbyPeerConfiguration(peerToken: token))
        return ["state": "INITIALIZING"]
    }
    private func scheduleExpiry(at: Double, session current: NISession) {
        expiry?.cancel()
        let work = DispatchWorkItem { [weak self, weak current] in
            guard let self = self, let current = current, self.session === current else { return }
            self.stop(); self.emit(["type": "nearby-state", "family": "UWB", "platform": "IOS", "state": "EXPIRED"])
        }
        expiry = work
        DispatchQueue.main.asyncAfter(deadline: .now() + max(0, at - now()) / 1000, execute: work)
    }
    func stop() {
        expiry?.cancel(); expiry = nil
        let old = session; session = nil
        peerToken = nil; peerId = nil; preparationExpiresAt = 0; expiresAt = 0; lastAt = 0
        old?.delegate = nil; old?.invalidate()
    }
    func session(_ session: NISession, didUpdate nearbyObjects: [NINearbyObject]) {
        guard self.session === session, now() < expiresAt, now() - lastAt >= 1000,
              let peer = peerToken, let identity = peerId,
              let object = nearbyObjects.first(where: { $0.discoveryToken == peer }),
              let distance = object.distance, distance.isFinite, distance >= 0, distance <= 1000 else { return }
        lastAt = now()
        emit(["type": "nearby", "family": "UWB", "platform": "IOS", "id": UUID().uuidString,
              "peerId": identity, "observedAt": Int(lastAt), "distanceMeters": Double(distance),
              "uncertaintyMeters": NSNull(), "authenticated": false, "sessionProtected": false])
    }
    private func unavailable(_ current: NISession) {
        guard session === current else { return }
        stop(); emit(["type": "nearby-state", "family": "UWB", "platform": "IOS", "state": "UNAVAILABLE"])
    }
    func session(_ session: NISession, didInvalidateWith error: Error) { unavailable(session) }
    func sessionWasSuspended(_ session: NISession) { unavailable(session) }
    func sessionSuspensionEnded(_ session: NISession) { unavailable(session) }
    func session(_ session: NISession, didRemove nearbyObjects: [NINearbyObject], reason: NINearbyObject.RemovalReason) { unavailable(session) }
}
