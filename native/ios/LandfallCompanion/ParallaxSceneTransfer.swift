import Foundation
import CoreFoundation
import CryptoKit

/// Version 1, bounded foreground local transfer. Authoring bounds never validate composed transforms.
final class ParallaxSceneTransfer {
    static let sceneBytes = 393216, chunkBytes = 8192, maxChunks = 48, timeoutMs = 15000
    let sessionId: String
    let epoch: Int
    private var generation = 0, currentGeneration = 0, count = 0, total = 0, next = 0
    private var deadline: Double = 0
    private var transaction: String?, digest = ""
    private var buffer: Data?
    init(sessionId: String, epoch: Int) { self.sessionId = sessionId; self.epoch = epoch }
    private static func numeric(_ value: Any?) -> Double? {
        guard let n = value as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(), n.doubleValue.isFinite else { return nil }; return n.doubleValue
    }
    private static func integer(_ value: Any?) -> Bool { guard let n = numeric(value) else { return false }; return n >= 0 && n <= 2147483647 && n.rounded(.towardZero) == n }
    func matches(_ p: [String:Any]) -> Bool { p["sessionId"] as? String == sessionId && Self.integer(p["epoch"]) && p["epoch"] as? Int == epoch }
    func clear() { buffer = nil; transaction = nil }
    func expire(_ now: Double) { if buffer != nil && now >= deadline { clear() } }
    private func current(_ p: [String:Any], _ now: Double) -> Bool { expire(now); return matches(p) && buffer != nil && p["transactionId"] as? String == transaction && Self.integer(p["generation"]) && p["generation"] as? Int == currentGeneration }
    func begin(_ p: [String:Any], _ now: Double) -> Bool {
        expire(now)
        guard p.count == 8, ["generation","totalBytes","chunkCount","sceneTransferVersion"].allSatisfy({Self.integer(p[$0])}), matches(p), buffer == nil, p["sceneTransferVersion"] as? Int == 1, let g = p["generation"] as? Int, g > generation, g > 0, g <= 2147483647,
              let n = p["totalBytes"] as? Int, n > 0, n <= Self.sceneBytes, let c = p["chunkCount"] as? Int, c == (n + Self.chunkBytes - 1) / Self.chunkBytes, c <= Self.maxChunks,
              let t = p["transactionId"] as? String, t.range(of: "^[A-Za-z0-9-]{1,64}$", options: .regularExpression) != nil,
              let d = p["digest"] as? String, d.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { return false }
        generation = g; currentGeneration = g; count = c; total = n; next = 0; deadline = now + Double(Self.timeoutMs); transaction = t; digest = d; buffer = Data(); return true
    }
    func chunk(_ p: [String:Any], _ now: Double) -> Bool {
        guard current(p, now) else { return false }
        guard p.count == 6, Self.integer(p["index"]), p["index"] as? Int == next, next < count, let encoded = p["data"] as? String, encoded.utf8.count <= 10924,
              let bytes = Data(base64Encoded: encoded), bytes.base64EncodedString() == encoded, bytes.count == min(Self.chunkBytes, total - next * Self.chunkBytes) else { clear(); return false }
        buffer?.append(bytes); next += 1; return true
    }
    func abort(_ p: [String:Any]) -> Bool { if matches(p) && p["transactionId"] as? String == transaction && Self.integer(p["generation"]) && p["generation"] as? Int == currentGeneration { clear() }; return matches(p) }
    func commit(_ p: [String:Any], _ now: Double) -> [[String:Any]]? {
        guard current(p, now) else { return nil }
        defer { clear() }
        guard p.count == 4, next == count, let bytes = buffer, bytes.count == total, SHA256.hash(data: bytes).map({String(format:"%02x", $0)}).joined() == digest,
              String(data: bytes, encoding: .utf8) != nil, let scene = (try? JSONSerialization.jsonObject(with: bytes)) as? [String:Any], scene.count == 4,
              Self.integer(scene["schemaVersion"]), scene["schemaVersion"] as? Int == 1, scene["transformKind"] as? String == "RESOLVED_LOCAL_V1", scene["coordinateFrame"] as? String == "LOCAL_Y_UP_NEGATIVE_Z",
              let entities = scene["entities"] as? [[String:Any]], Self.validEntities(entities) else { return nil }
        return entities
    }
    static func validEntities(_ input: [[String:Any]]) -> Bool {
        guard (1...32).contains(input.count) else { return false }
        var ids = Set<String>()
        for j in input {
            guard j.count == 5, let id = j["id"] as? String, id.range(of:"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$",options:.regularExpression) != nil, ids.insert(id).inserted,
                  let text = j["content"] as? String, (1...2000).contains(text.utf16.count), let kind = j["kind"] as? String, ["PARCHMENT","TEXT","MARKER"].contains(kind),
                  let width = numeric(j["widthMeters"]), (0.01...5).contains(width), let t = j["transform"] as? [String:Any], t.count == 3,
                  let p = t["position"] as? [String:Any], p.count == 3, let q = t["rotation"] as? [String:Any], q.count == 4,
                  let scale = numeric(t["scale"]), scale > 0, scale <= 100000000,
                  (0.000001...100).contains(width * scale), let x = numeric(p["x"]), let y = numeric(p["y"]), let z = numeric(p["z"]), [x,y,z].allSatisfy({$0.isFinite && abs($0) <= 1000000}),
                  let qx = numeric(q["x"]), let qy = numeric(q["y"]), let qz = numeric(q["z"]), let qw = numeric(q["w"]), [qx,qy,qz,qw].allSatisfy({$0.isFinite}), abs(sqrt(qx*qx+qy*qy+qz*qz+qw*qw)-1) < 0.00001 else { return false }
        }
        return true
    }
}
