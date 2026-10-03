import Foundation
import Combine
import WebKit
import CoreLocation
import CoreMotion
import UIKit
import UserNotifications

/** Native acquisition and presentation. Canonical progression stays on the authorized One Voyage server. */
final class LandfallCompanion: NSObject, ObservableObject, WKNavigationDelegate, WKScriptMessageHandlerWithReply, CLLocationManagerDelegate, UNUserNotificationCenterDelegate {
    let origin: URL?
    private let location = CLLocationManager()
    private let motion = CMMotionManager()
    private let altimeter = CMAltimeter()
    private var web: WKWebView?
    private var foreground = true
    private var acquiring = false
    private var permissionReply: ((Any?, String?) -> Void)?
    private let hints = LandfallSecureHints()
    private var hardware: LandfallHardware?
    private var observers: [NSObjectProtocol] = []
    private var pendingReturn:String?

    static func allowedOrigin(_ raw: String) -> URL? {
        guard let url = URL(string: raw), let parts = URLComponents(url: url, resolvingAgainstBaseURL: false), parts.scheme == "https", parts.host != nil, parts.user == nil, parts.password == nil, parts.query == nil, parts.fragment == nil, (parts.path.isEmpty || parts.path == "/") else { return nil }
        return url
    }
    override init() {
        var configured = Self.allowedOrigin(Bundle.main.object(forInfoDictionaryKey: "LandfallOrigin") as? String ?? "")
        #if DEBUG
        if let argument = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("--landfall-lab-origin=") }), let url=URL(string: String(argument.dropFirst("--landfall-lab-origin=".count))), url.scheme=="http", url.host=="127.0.0.1", url.port != nil, url.path.isEmpty, url.user==nil, url.password==nil, url.query==nil, url.fragment==nil { configured=url }
        #endif
        origin = configured
        super.init()
        location.delegate = self
        UNUserNotificationCenter.current().delegate=self
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in self?.pause() })
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            self?.foreground = true
            if let self=self { for region in self.location.monitoredRegions where !self.hints.active(handle:region.identifier) {self.location.stopMonitoring(for:region)} }
            self?.event(["type": "lifecycle", "state": "FOREGROUND", "pendingHints": self?.hints.read() ?? []])
        })
        hardware = LandfallHardware { [weak self] event in self?.event(event) }
    }
    deinit { for observer in observers { NotificationCenter.default.removeObserver(observer) }; location.stopUpdatingLocation(); location.stopUpdatingHeading(); motion.stopDeviceMotionUpdates(); altimeter.stopRelativeAltitudeUpdates() }
    func accepts(_ url: URL?) -> Bool {
        guard let url = url, let origin = origin else { return false }
        return url.scheme == origin.scheme && url.host == origin.host && (url.port ?? 443) == (origin.port ?? 443) && url.user == nil && url.password == nil
    }
    func makeWebView() -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "landfall")
        let script = "Object.defineProperty(window,'LandfallNative',{value:Object.freeze({version:1,platform:'IOS',request:message=>window.webkit.messageHandlers.landfall.postMessage(JSON.parse(message))}),configurable:false})"
        configuration.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = self
        web = view
        if let origin = origin, let player = URL(string: pendingReturn.map{"/player/landfall-return?handle=\($0)"} ?? "/player", relativeTo: origin) { view.load(URLRequest(url: player));pendingReturn=nil }
        return view
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) { decisionHandler(accepts(navigationAction.request.url) ? .allow : .cancel) }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, accepts(message.frameInfo.request.url), let request = message.body as? [String: Any], request["version"] as? Int == 1,
              let operation = request["operation"] as? String, let id = request["id"] as? String, id.count <= 128,
              JSONSerialization.isValidJSONObject(request), let encoded = try? JSONSerialization.data(withJSONObject: request), encoded.count <= 16384 else { replyHandler(nil, "INVALID_NATIVE_REQUEST"); return }
        let payload = request["payload"] as? [String: Any] ?? [:]
        switch operation {
        case "LOCATION_PERMISSION":
            guard foreground, permissionReply == nil else { replyHandler(["state": "UNAVAILABLE"], nil); return }
            if location.authorizationStatus == .notDetermined { permissionReply = replyHandler; location.requestWhenInUseAuthorization() }
            else { replyHandler(["state": permission()], nil) }
        case "LOCATION_START":
            let interval = payload["intervalMs"] as? Int ?? 5000
            guard foreground, payload["background"] as? Bool != true, (1000...60000).contains(interval), ["GRANTED", "APPROXIMATE"].contains(permission()) else { replyHandler(["accepted": false], nil); return }
            location.desiredAccuracy = payload["precise"] as? Bool == true && location.accuracyAuthorization == .fullAccuracy ? kCLLocationAccuracyBest : kCLLocationAccuracyHundredMeters
            location.distanceFilter = interval >= 15000 ? 10 : 3
            location.allowsBackgroundLocationUpdates = false
            location.pausesLocationUpdatesAutomatically = true
            acquiring = true; location.startUpdatingLocation(); replyHandler(["accepted": true], nil)
        case "LOCATION_STOP": stopLocation(); replyHandler(["accepted": true], nil)
        case "BACKGROUND_PERMISSION":
            guard foreground, location.authorizationStatus == .authorizedWhenInUse || location.authorizationStatus == .authorizedAlways else { replyHandler(["state": "DENIED"], nil); return }
            if location.authorizationStatus != .authorizedAlways { location.requestAlwaysAuthorization() }
            replyHandler(["state": location.authorizationStatus == .authorizedAlways ? "GRANTED" : "PROMPTABLE"], nil)
        case "GEOFENCE_REGISTER": registerGeofence(payload, reply: replyHandler)
        case "NOTIFICATION_PERMISSION":
            guard foreground else {replyHandler(["state":"UNAVAILABLE"],nil);return}
            UNUserNotificationCenter.current().requestAuthorization(options:[.alert,.sound]){ granted,_ in replyHandler(["state":granted ? "GRANTED":"DENIED"],nil) }
        case "GEOFENCE_CLEAR": for region in location.monitoredRegions { location.stopMonitoring(for: region) }; hints.clear(); replyHandler(["accepted": true], nil)
        case "SENSORS_START": replyHandler(["accepted": startSensors()], nil)
        case "SENSORS_STOP": stopSensors(); replyHandler(["accepted": true], nil)
        case "BLE_START": replyHandler(["state": hardware?.startBle(foreground: foreground) ?? "UNAVAILABLE"], nil)
        case "BLE_STOP": hardware?.stop(); replyHandler(["accepted": true], nil)
        case "NFC_READ": replyHandler(["state": hardware?.startNfc(foreground: foreground) ?? "UNAVAILABLE"], nil)
        case "QR_SCAN": replyHandler(["state": hardware?.startQr(foreground: foreground, presenter: web?.window?.rootViewController) ?? "UNAVAILABLE"], nil)
        case "CLEAR_PRIVATE_DATA":
            stopLocation(); stopSensors(); hardware?.stop()
            for region in location.monitoredRegions { location.stopMonitoring(for: region) }; hints.clear()
            UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
            UNUserNotificationCenter.current().removeAllDeliveredNotifications()
            replyHandler(["accepted": true], nil)
        default: replyHandler(["state": "UNSUPPORTED"], nil)
        }
    }
    private func permission() -> String {
        switch location.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways: return location.accuracyAuthorization == .fullAccuracy ? "GRANTED" : "APPROXIMATE"
        case .notDetermined: return "PROMPTABLE"
        case .denied, .restricted: return "DENIED"
        @unknown default: return "UNAVAILABLE"
        }
    }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if manager.authorizationStatus != .notDetermined { permissionReply?(["state": permission()], nil); permissionReply = nil }
        if !["GRANTED", "APPROXIMATE"].contains(permission()) { stopLocation(); for region in manager.monitoredRegions { manager.stopMonitoring(for: region) }; hints.clear() }
        event(["type": "permission", "state": permission()])
    }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard foreground, acquiring, ["GRANTED", "APPROXIMATE"].contains(permission()) else { return }
        for sample in locations.suffix(4) where sample.horizontalAccuracy > 0 {
            var fix: [String: Any] = ["id": UUID().uuidString, "timestamp": Int(sample.timestamp.timeIntervalSince1970 * 1000), "latitude": sample.coordinate.latitude, "longitude": sample.coordinate.longitude, "accuracyMeters": sample.horizontalAccuracy]
            if sample.course >= 0 { fix["headingDegrees"] = sample.course }
            if sample.speed >= 0 { fix["speedMetersPerSecond"] = sample.speed }
            if sample.verticalAccuracy > 0 { fix["altitudeMeters"] = sample.altitude; fix["altitudeAccuracyMeters"] = sample.verticalAccuracy }
            event(["type": "fix", "fix": fix])
        }
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) { event(["type": "error"]) }
    private func registerGeofence(_ payload: [String: Any], reply: @escaping (Any?, String?) -> Void) {
        guard foreground, location.authorizationStatus == .authorizedAlways, CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self), location.monitoredRegions.count < 20,
              let handle = payload["returnHandle"] as? String, (32...2048).contains(handle.count), handle.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil,
              let latitude = payload["latitude"] as? Double, let longitude = payload["longitude"] as? Double, let radius = payload["radiusMeters"] as? Double,
              let expires = payload["expiresAt"] as? Double, latitude.isFinite, longitude.isFinite, abs(latitude)<=90, abs(longitude)<=180, radius>=100, radius<=min(10000, location.maximumRegionMonitoringDistance),
              expires>Date().timeIntervalSince1970*1000, expires-Date().timeIntervalSince1970*1000<=86400000 else { reply(["state": "UNAVAILABLE"], nil); return }
        let region = CLCircularRegion(center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude), radius: radius, identifier: handle)
        region.notifyOnEntry=true; region.notifyOnExit=true
        hints.register(handle:handle,expiresAt:expires,notifications:payload["notifications"] as? Bool==true)
        location.startMonitoring(for: region); reply(["state": "GRANTED"], nil)
    }
    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        guard hints.active(handle:region.identifier) else {manager.stopMonitoring(for:region);return}
        hints.append(handle:region.identifier,event:"ENTER")
        if hints.notices(handle:region.identifier){let content=UNMutableNotificationContent();content.title="Your journey may be nearby";content.body="Open your current Chart for a fresh check. No visit has been confirmed.";content.userInfo=["returnHandle":region.identifier];UNUserNotificationCenter.current().add(UNNotificationRequest(identifier:region.identifier,content:content,trigger:nil))}
    }
    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {if hints.active(handle:region.identifier){hints.append(handle:region.identifier,event:"EXIT")}else{manager.stopMonitoring(for:region)} }
    func userNotificationCenter(_ center:UNUserNotificationCenter,didReceive response:UNNotificationResponse,withCompletionHandler completionHandler:@escaping()->Void){
        if let handle=response.notification.request.content.userInfo["returnHandle"] as? String,(32...2048).contains(handle.count),handle.range(of:"^[A-Za-z0-9_-]+$",options:.regularExpression) != nil{
            pendingReturn=handle
            if let origin=origin,let url=URL(string:"/player/landfall-return?handle=\(handle)",relativeTo:origin),let web=web{web.load(URLRequest(url:url));pendingReturn=nil}
        }
        completionHandler()
    }
    func locationManager(_ manager: CLLocationManager, monitoringDidFailFor region: CLRegion?, withError error: Error) { event(["type": "error"]) }
    private func startSensors() -> Bool {
        guard foreground else { return false }
        stopSensors()
        if CLLocationManager.headingAvailable() { location.headingFilter=10; location.startUpdatingHeading() }
        if motion.isAccelerometerAvailable { motion.accelerometerUpdateInterval=0.25; motion.startAccelerometerUpdates(to: .main) { [weak self] sample, _ in if let value=sample?.acceleration { self?.sensor("ACCELEROMETER", [value.x*9.80665,value.y*9.80665,value.z*9.80665], accuracy: 1) } } }
        if CMAltimeter.isRelativeAltitudeAvailable() { altimeter.startRelativeAltitudeUpdates(to: .main) { [weak self] sample, _ in if let sample=sample { self?.sensor("PRESSURE", [sample.pressure.doubleValue*10], accuracy: 1) } } }
        return CLLocationManager.headingAvailable() || motion.isAccelerometerAvailable || CMAltimeter.isRelativeAltitudeAvailable()
    }
    func locationManager(_ manager: CLLocationManager, didUpdateHeading heading: CLHeading) { if heading.headingAccuracy>=0 { sensor("HEADING", [heading.magneticHeading], accuracy: heading.headingAccuracy) } }
    private func sensor(_ kind: String, _ values: [Double], accuracy: Double) { guard foreground else { return }; event(["type": "sensor", "frame": ["id": UUID().uuidString, "observedAt": Int(Date().timeIntervalSince1970*1000), "kind": kind, "values": values, "accuracy": accuracy]]) }
    private func stopLocation() { acquiring=false; location.stopUpdatingLocation() }
    private func stopSensors() { location.stopUpdatingHeading(); motion.stopAccelerometerUpdates(); motion.stopDeviceMotionUpdates(); altimeter.stopRelativeAltitudeUpdates() }
    private func pause() { event(["type":"lifecycle","state":"BACKGROUND"]); foreground=false; stopLocation(); stopSensors(); hardware?.stop() }
    private func event(_ payload: [String: Any]) {
        guard foreground, let web=web, accepts(web.url), JSONSerialization.isValidJSONObject(payload), let data=try? JSONSerialization.data(withJSONObject: payload, options: [.fragmentsAllowed]), let json=String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async { web.evaluateJavaScript("window.dispatchEvent(new CustomEvent('landfall-native-event',{detail:\(json)}))", completionHandler: nil) }
    }
}
