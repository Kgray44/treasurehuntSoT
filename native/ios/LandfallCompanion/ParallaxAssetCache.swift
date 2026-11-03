import Foundation
import CoreFoundation
import CryptoKit

/// Assets never cross the small JSON bridge. This foreground-session cache only accepts
/// same-origin catalog GLBs, rejects redirects, and verifies every cache read before use.
final class ParallaxAssetCache: NSObject, URLSessionDataDelegate {
    static let assetBytes = 32 * 1024 * 1024
    static let cacheBytes = 64 * 1024 * 1024
    static func sessionConfiguration() -> URLSessionConfiguration {
        let config=URLSessionConfiguration.ephemeral
        config.httpCookieStorage=nil;config.urlCache=nil;config.requestCachePolicy = .reloadIgnoringLocalCacheData
        // The first local download may wait for the owner's network permission.
        // Bound that wait and transfer inside the existing 55-second activation deadline.
        config.waitsForConnectivity=true;config.timeoutIntervalForResource=45
        return config
    }
    struct Model {
        let assetId: String, version: String, sha256: String, byteLength: Int, path: String, sourceWidthMeters: Double
        static func parse(_ value: [String:Any]) -> Model? {
            guard Set(value.keys) == Set(["assetId","version","sha256","byteLength","url","format","metersPerUnit","sourceWidthMeters"]),
                  let assetId=value["assetId"] as? String, ["treasure-chest","brass-compass"].contains(assetId),
                  let version=value["version"] as? String, version == "1.0.0",
                  let digest=value["sha256"] as? String, digest.range(of:"^[a-f0-9]{64}$",options:.regularExpression) != nil,
                  let bytes=ParallaxAssetCache.strictInteger(value["byteLength"]), (1...ParallaxAssetCache.assetBytes).contains(bytes),
                  let path=value["url"] as? String, ParallaxAssetCache.catalogPath(path,assetId:assetId), value["format"] as? String == "GLB",
                  let unit=value["metersPerUnit"] as? NSNumber, CFGetTypeID(unit) != CFBooleanGetTypeID(), unit.doubleValue == 1,
                  let width=value["sourceWidthMeters"] as? NSNumber, CFGetTypeID(width) != CFBooleanGetTypeID(), width.doubleValue == (assetId == "treasure-chest" ? 0.8 : 0.16) else { return nil }
            let canonicalDigest=assetId == "treasure-chest" ? "2e31b5eed11242e583cfc99a5491ff2e4b10dec0d4fed5d90dffe1ccab122e6f" : "5af1158b1a7f2b3339c159fbdca8b9d3d29020eaa06d41848bf5c04c0a682ccb"
            guard digest == canonicalDigest,bytes == (assetId == "treasure-chest" ? 630120 : 313396) else { return nil }
            return Model(assetId:assetId,version:version,sha256:digest,byteLength:bytes,path:path,sourceWidthMeters:width.doubleValue)
        }
    }
    static func strictInteger(_ value: Any?) -> Int? {
        guard let n=value as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(), n.doubleValue.isFinite,
              n.doubleValue >= 0, n.doubleValue <= Double(Int32.max), n.doubleValue.rounded(.towardZero) == n.doubleValue else { return nil }
        return n.intValue
    }
    static func catalogPath(_ path: String, assetId: String? = nil) -> Bool {
        guard let parts=URLComponents(string:path),parts.scheme == nil,parts.host == nil,parts.fragment == nil,
              parts.path.range(of:"^/api/player/playthroughs/[A-Za-z0-9._:-]+/parallax/assets/(treasure-chest|brass-compass)$",options:.regularExpression) != nil,
              assetId == nil || parts.path.hasSuffix("/"+assetId!),let query=parts.queryItems,query.count == 2,
              Set(query.map{$0.name}) == Set(["block","versionChecksum"]),
              let block=query.first(where:{$0.name == "block"})?.value, block.range(of:"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$",options:.regularExpression) != nil,
              let checksum=query.first(where:{$0.name == "versionChecksum"})?.value,checksum.range(of:"^[a-f0-9]{64}$",options:.regularExpression) != nil else { return false }
        return true
    }
    static func verified(_ data: Data, model: Model) -> Bool {
        data.count == model.byteLength && SHA256.hash(data:data).map{String(format:"%02x",$0)}.joined() == model.sha256 && selfContainedGLB(data)
    }
    /// A digest is not permission to resolve arbitrary file/network dependencies inside a model.
    static func selfContainedGLB(_ data: Data) -> Bool {
        func u32(_ offset: Int) -> UInt32 { data.subdata(in:offset..<(offset+4)).enumerated().reduce(UInt32(0)){ $0 | UInt32($1.element) << UInt32(8*$1.offset) } }
        guard data.count >= 20, u32(0) == 0x46546c67, u32(4) == 2, Int(u32(8)) == data.count,
              u32(16) == 0x4e4f534a, Int(u32(12)) <= data.count-20,
              let json=(try? JSONSerialization.jsonObject(with:data.subdata(in:20..<(20+Int(u32(12)))))) as? [String:Any],
              let asset=json["asset"] as? [String:Any], asset["version"] as? String == "2.0" else { return false }
        for key in ["buffers","images"] {
            if let entries=json[key] as? [[String:Any]], entries.contains(where:{$0["uri"] != nil}) { return false }
        }
        // The NCL-01 profile is static PBR. Required extensions and embedded animation
        // need separate capability qualification before they can enter this provider.
        if let required=json["extensionsRequired"] as? [Any], !required.isEmpty { return false }
        if let animations=json["animations"] as? [Any], !animations.isEmpty { return false }
        return true
    }
    private let origin: URL?
    private let softwareFixture: Bool
    private let cookies: (@escaping ([HTTPCookie]) -> Void) -> Void
    private let directory: URL
    private var session: URLSession?
    private var task: URLSessionDataTask?
    private var pending: Model?
    private var completion: ((URL?) -> Void)?
    private var bytes=Data(), stopped=false
    init(origin: URL?, softwareFixture requestedFixture: Bool = false, cookies: @escaping (@escaping ([HTTPCookie]) -> Void) -> Void) {
        self.origin=origin; self.cookies=cookies
        #if DEBUG && targetEnvironment(simulator)
        softwareFixture=requestedFixture && ParallaxLocalRuntime.isLoopbackLabOrigin(origin)
        #else
        softwareFixture=false
        #endif
        directory=FileManager.default.temporaryDirectory.appendingPathComponent("parallax-assets-"+UUID().uuidString,isDirectory:true)
        super.init()
    }
    func load(_ model: Model, completion: @escaping (URL?) -> Void) {
        guard !stopped, task == nil, self.completion == nil,
              let origin=origin, origin.scheme == "https" || softwareFixture, let url=URL(string:model.path,relativeTo:origin)?.absoluteURL,
              url.host == origin.host, url.port == origin.port else { completion(nil); return }
        let local=directory.appendingPathComponent(model.sha256+".glb")
        if let data=try? Data(contentsOf:local,options:.mappedIfSafe), Self.verified(data,model:model) { completion(local); return }
        self.completion=completion; pending=model
        cookies { [weak self] values in DispatchQueue.main.async {
            guard let self=self, !self.stopped, self.completion != nil else { return }
            var request=URLRequest(url:url,cachePolicy:.reloadIgnoringLocalCacheData,timeoutInterval:45)
            request.setValue("model/gltf-binary",forHTTPHeaderField:"Accept")
            request.setValue("identity",forHTTPHeaderField:"Accept-Encoding")
            let allowed=values.filter { cookie in
                let domain=cookie.domain.hasPrefix(".") ? String(cookie.domain.dropFirst()) : cookie.domain
                return (url.host == domain || url.host?.hasSuffix("."+domain) == true) && url.path.hasPrefix(cookie.path) && (cookie.expiresDate == nil || cookie.expiresDate! > Date())
            }
            for (name,value) in HTTPCookie.requestHeaderFields(with:allowed) { request.setValue(value,forHTTPHeaderField:name) }
            let config=Self.sessionConfiguration()
            self.session=URLSession(configuration:config,delegate:self,delegateQueue:.main)
            self.bytes=Data();self.task=self.session?.dataTask(with:request);self.task?.resume()
        } }
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        guard !stopped, let response=response as? HTTPURLResponse, response.statusCode == 200,
              let expected=pending?.byteLength, response.expectedContentLength < 0 || response.expectedContentLength == Int64(expected) else { completionHandler(.cancel); return }
        completionHandler(.allow)
    }
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard let model=pending, bytes.count <= model.byteLength-data.count else { dataTask.cancel(); return };bytes.append(data)
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        var result: URL?
        if !stopped, error == nil, let model=pending, Self.verified(bytes,model:model) {
            do {
                try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true,attributes:[.protectionKey:FileProtectionType.complete])
                let existing=(try? FileManager.default.contentsOfDirectory(at:directory,includingPropertiesForKeys:[.fileSizeKey])) ?? []
                let size=existing.reduce(0){ $0 + ((try? $1.resourceValues(forKeys:[.fileSizeKey]).fileSize) ?? 0) }
                guard size+bytes.count <= Self.cacheBytes else { finish(nil);return }
                let local=directory.appendingPathComponent(model.sha256+".glb")
                try bytes.write(to:local,options:[.atomic,.completeFileProtection]);result=local
            } catch { result=nil }
        }
        finish(result)
    }
    private func finish(_ url: URL?) {
        let done=completion;completion=nil;pending=nil;bytes=Data();task=nil
        session?.finishTasksAndInvalidate();session=nil;done?(url)
    }
    func stop() {
        stopped=true;task?.cancel();session?.invalidateAndCancel();finish(nil)
        try? FileManager.default.removeItem(at:directory)
    }
}
