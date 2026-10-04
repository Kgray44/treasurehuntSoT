import Foundation
import CryptoKit
import Security

/** Actor-neutral opaque wake hints only; private app storage and a device-only Keychain key. */
final class LandfallSecureHints {
    private(set) var storageState = "UNKNOWN"
    private let alias = "com.voyagewright.landfall.wake-hints-v1"
    private let registrations = "landfall-geofence-registrations-v1"
    private func handleHash(_ handle:String)->String { SHA256.hash(data:Data(handle.utf8)).map {String(format:"%02x",$0)}.joined() }
    func register(handle: String, expiresAt: Double, notifications: Bool) {
        var rows = UserDefaults.standard.dictionary(forKey: registrations) ?? [:]
        rows[handleHash(handle)] = ["expiresAt": expiresAt, "notifications": notifications] as [String: Any]
        UserDefaults.standard.set(rows, forKey: registrations)
    }
    func remove(handle: String) {
        var rows = UserDefaults.standard.dictionary(forKey: registrations) ?? [:]
        rows.removeValue(forKey: handleHash(handle))
        UserDefaults.standard.set(rows, forKey: registrations)
    }
    func active(handle:String)->Bool{guard let rows=UserDefaults.standard.dictionary(forKey:registrations),let row=rows[handleHash(handle)] as? [String:Any],let expiry=row["expiresAt"] as? Double else{return false};return expiry>Date().timeIntervalSince1970*1000}
    func notices(handle:String)->Bool{guard active(handle:handle),let rows=UserDefaults.standard.dictionary(forKey:registrations),let row=rows[handleHash(handle)] as? [String:Any] else{return false};return row["notifications"] as? Bool==true}
    private var file: URL { FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("landfall-wake-hints.enc") }
    private func key() throws -> SymmetricKey {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: alias, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecSuccess, let data = result as? Data, data.count == 32 { return SymmetricKey(data: data) }
        guard status == errSecItemNotFound else { throw CocoaError(.fileReadNoPermission) }
        var bytes = Data(count: 32)
        let generated = bytes.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, 32, $0.baseAddress!) }
        guard generated == errSecSuccess else { throw CocoaError(.fileWriteUnknown) }
        let item: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: alias, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly, kSecValueData as String: bytes]
        let added = SecItemAdd(item as CFDictionary, nil)
        guard added == errSecSuccess else { throw NSError(domain: NSOSStatusErrorDomain, code: Int(added)) }
        return SymmetricKey(data: bytes)
    }
    func read() -> [[String: Any]] {
        guard let data = try? Data(contentsOf: file), data.count <= 131072 else { return [] }
        do {
            let bytes = try AES.GCM.open(AES.GCM.SealedBox(combined: data), using: key(), authenticating: Data(alias.utf8))
            let rows = try JSONSerialization.jsonObject(with: bytes) as? [[String: Any]] ?? []
            return Array(rows.filter { row in guard let at = row["receivedAt"] as? Double else { return false }; return Date().timeIntervalSince1970*1000-at < 300000 && at <= Date().timeIntervalSince1970*1000 }.prefix(32))
        } catch { clear(); return [] }
    }
    func append(handle: String, event: String) {
        guard (32...2048).contains(handle.count), ["ENTER", "EXIT"].contains(event) else { return }
        var rows=read(); guard rows.count < 32 else { return }
        rows.append(["id": UUID().uuidString, "returnHandle": handle, "event": event, "receivedAt": Date().timeIntervalSince1970*1000])
        do {
            let bytes=try JSONSerialization.data(withJSONObject: rows)
            let encrypted=try AES.GCM.seal(bytes, using: key(), authenticating: Data(alias.utf8))
            try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
            try encrypted.combined?.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            var resource=file; var values=URLResourceValues(); values.isExcludedFromBackup=true; try resource.setResourceValues(values)
            storageState = "READY"
        } catch { let value = error as NSError; storageState = "ERROR:\(value.domain):\(value.code)" }
    }
    func clear() { UserDefaults.standard.removeObject(forKey:registrations);try? FileManager.default.removeItem(at: file); SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: alias] as CFDictionary) }
}
