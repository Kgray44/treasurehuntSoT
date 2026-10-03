import Foundation
import CryptoKit
import Security

/** Restart leases stay encrypted under a device-only Keychain key and never enter backup. */
final class LandfallPrivateStore {
    private let alias: String
    private let now: () -> Double
    init(origin: String, now: @escaping () -> Double = { Date().timeIntervalSince1970 * 1000 }) { self.now = now; self.alias = "landfall-private-leases-v1-" + SHA256.hash(data: Data(origin.utf8)).map { String(format: "%02x", $0) }.joined() }
    private var directory: URL { FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent(alias, isDirectory: true) }
    static func validKey(_ key: String) -> Bool { key.range(of: "^landfall-offline-identity-v2(:chunk:[0-9]{1,3})?$", options: .regularExpression) != nil || key.range(of: "^landfall-(offline-lease-v2|region-lease-v1):[A-Za-z0-9._:-]{1,160}$", options: .regularExpression) != nil }
    private func file(_ name: String) throws -> URL {
        guard Self.validKey(name) else { throw CocoaError(.fileReadInvalidFileName) }
        let hash = SHA256.hash(data: Data(name.utf8)).map { String(format: "%02x", $0) }.joined()
        return directory.appendingPathComponent(hash + ".enc")
    }
    private func key() throws -> SymmetricKey {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: alias, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var result: CFTypeRef?; let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecSuccess, let bytes = result as? Data, bytes.count == 32 { return SymmetricKey(data: bytes) }
        guard status == errSecItemNotFound else { throw NSError(domain: NSOSStatusErrorDomain, code: Int(status)) }
        var bytes = Data(count: 32)
        guard bytes.withUnsafeMutableBytes({ SecRandomCopyBytes(kSecRandomDefault, 32, $0.baseAddress!) }) == errSecSuccess else { throw CocoaError(.fileWriteUnknown) }
        let added = SecItemAdd([kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: alias, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly, kSecValueData as String: bytes] as CFDictionary, nil)
        guard added == errSecSuccess else { throw NSError(domain: NSOSStatusErrorDomain, code: Int(added)) }
        return SymmetricKey(data: bytes)
    }
    private func read(_ url: URL) -> [String: Any]? {
        do {
            let bytes = try Data(contentsOf: url); guard bytes.count <= 32768 else { throw CocoaError(.fileReadTooLarge) }
            let plain = try AES.GCM.open(AES.GCM.SealedBox(combined: bytes), using: key(), authenticating: Data(alias.utf8))
            guard let value = try JSONSerialization.jsonObject(with: plain) as? [String: Any], let name = value["key"] as? String, Self.validKey(name), let expiry = value["expiresAt"] as? Double, expiry > now(), expiry <= now() + 86400000 else { throw CocoaError(.fileReadCorruptFile) }
            return value
        } catch { try? FileManager.default.removeItem(at: url); return nil }
    }
    func list() -> [String] {
        let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        guard files.count <= 128 else { clear(); return [] }
        return files.compactMap { read($0)?["key"] as? String }
    }
    func get(_ name: String) -> String? { guard let url = try? file(name), let value = read(url), value["key"] as? String == name else { return nil }; return value["value"] as? String }
    func put(_ name: String, value: String, expiresAt: Double) -> Bool {
        do {
            guard Self.validKey(name), value.utf8.count <= 8192, expiresAt > now(), expiresAt <= now() + 86400000 else { return false }
            let rows = list(); let url = try file(name)
            guard rows.count < 128 || FileManager.default.fileExists(atPath: url.path) else { return false }
            let plain = try JSONSerialization.data(withJSONObject: ["key": name, "value": value, "expiresAt": expiresAt])
            let box = try AES.GCM.seal(plain, using: key(), authenticating: Data(alias.utf8))
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            guard let encrypted = box.combined else { return false }
            try encrypted.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            var target = url; var values = URLResourceValues(); values.isExcludedFromBackup = true; try target.setResourceValues(values)
            return true
        } catch { return false }
    }
    func remove(_ name: String) { if let url = try? file(name) { try? FileManager.default.removeItem(at: url) } }
    func clear() { try? FileManager.default.removeItem(at: directory); SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: alias] as CFDictionary) }
    func lastJourney() -> String? {
        let rows = list().filter { $0.hasPrefix("landfall-offline-lease-v2:") }.compactMap { name -> (String, Double)? in
            guard let text = get(name), let metadataBytes = text.data(using: .utf8), let metadata = try? JSONSerialization.jsonObject(with: metadataBytes) as? [String: Any], metadata["version"] as? Int == 1, let chunks = metadata["chunks"] as? Int, (1...4).contains(chunks) else { return nil }
            var encoded = ""
            for chunk in 0..<chunks { guard let part = get(name + ":chunk:\(chunk)"), part.count <= 5000 else { return nil }; encoded += part }
            guard let bytes = Data(base64Encoded: encoded), SHA256.hash(data: bytes).map({ String(format: "%02x", $0) }).joined() == metadata["sha256"] as? String, let value = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any], let session = value["sessionId"] as? String, session.range(of: "^[A-Za-z0-9._:-]{1,128}$", options: .regularExpression) != nil, name == "landfall-offline-lease-v2:" + session, let expiry = value["expiresAt"] as? Double, expiry > now() else { return nil }
            return (session, expiry)
        }
        return rows.sorted { $0.1 > $1.1 }.first?.0
    }
}
