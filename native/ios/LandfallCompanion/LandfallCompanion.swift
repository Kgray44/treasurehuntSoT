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
    private var locationIntervalMs = 5000
    private lazy var locationThrottle = LandfallLocationThrottle(
        intervalMs: { [weak self] in Double(self?.locationIntervalMs ?? 5000) },
        deliver: { [weak self] sample in self?.forwardLocation(sample) })
    private var locationCallbacks = 0
    private var forwardedFixes = 0
    private var systemLocationPaused = false
    private var locationFailure = "NONE"
    private var permissionReply: ((Any?, String?) -> Void)?
    private var geofenceReplies: [String: (Any?, String?) -> Void] = [:]
    private var geofenceRequests: [String: UUID] = [:]
    private let hints = LandfallSecureHints()
    private var hardware: LandfallHardware?
    private var nearby: LandfallNearbyInteraction?
    private var observers: [NSObjectProtocol] = []
    private var pendingReturn:String?
    private var privateStore: LandfallPrivateStore?
    private let power = LandfallPower()
    private var requestedIntervalMs = 5000
    private var requestedPrecise = true

    static func allowedOrigin(_ raw: String) -> URL? {
        guard let url = URL(string: raw), let parts = URLComponents(url: url, resolvingAgainstBaseURL: false), parts.scheme == "https", parts.host != nil, parts.user == nil, parts.password == nil, parts.query == nil, parts.fragment == nil, (parts.path.isEmpty || parts.path == "/") else { return nil }
        return url
    }
    override init() {
        var configured = Self.allowedOrigin(Bundle.main.object(forInfoDictionaryKey: "LandfallOrigin") as? String ?? "")
        #if DEBUG
        if let argument = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("--landfall-lab-origin=") }), let url=URL(string: String(argument.dropFirst("--landfall-lab-origin=".count))), url.scheme=="http", url.host=="127.0.0.1", url.port != nil, url.path.isEmpty, url.user==nil, url.password==nil, url.query==nil, url.fragment==nil { configured=url }
        #endif
        // WebKit's app-bound domain list is also required for the persistent
        // public offline shell. An incomplete deployment remains unconfigured.
        if let host = configured?.host {
            let domains = Bundle.main.object(forInfoDictionaryKey: "WKAppBoundDomains") as? [String] ?? []
            if !domains.contains(host) { configured = nil }
        }
        origin = configured
        super.init()
        // A region event can cold-launch the process directly in background.
        // Do not treat that initial state as permission for foreground bridges.
        foreground = UIApplication.shared.applicationState != .background
        if let origin = origin { privateStore = LandfallPrivateStore(origin: origin.absoluteString) }
        location.delegate = self
        UNUserNotificationCenter.current().delegate=self
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in self?.pause() })
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            self?.foreground = true
            if let self=self { for region in self.location.monitoredRegions where !self.hints.active(handle:region.identifier) {self.location.stopMonitoring(for:region)} }
            self?.event(["type": "lifecycle", "state": "FOREGROUND", "pendingHints": self?.hints.read() ?? []])
        })
        hardware = LandfallHardware { [weak self] event in self?.event(event) }
        nearby = LandfallNearbyInteraction { [weak self] event in self?.event(event) }
        UIDevice.current.isBatteryMonitoringEnabled = true
        _ = ProcessInfo.processInfo.thermalState
        for name in [Notification.Name.NSProcessInfoPowerStateDidChange, ProcessInfo.thermalStateDidChangeNotification, UIDevice.batteryLevelDidChangeNotification] {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in self?.powerChanged() })
        }
    }
    deinit { for observer in observers { NotificationCenter.default.removeObserver(observer) }; location.stopUpdatingLocation(); location.stopUpdatingHeading(); motion.stopDeviceMotionUpdates(); altimeter.stopRelativeAltitudeUpdates() }
    func accepts(_ url: URL?) -> Bool {
        guard let url = url, let origin = origin else { return false }
        return url.scheme == origin.scheme && url.host == origin.host && (url.port ?? 443) == (origin.port ?? 443) && url.user == nil && url.password == nil
    }
    func makeWebView() -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.limitsNavigationsToAppBoundDomains = true
        configuration.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "landfall")
        let script = "Object.defineProperty(window,'LandfallNative',{value:Object.freeze({version:1,platform:'IOS',request:message=>window.webkit.messageHandlers.landfall.postMessage(JSON.parse(message))}),configurable:false})"
        configuration.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = self
        web = view
        if let origin = origin {
            var target = URLComponents(url: origin, resolvingAgainstBaseURL: false)!
            if let handle = pendingReturn { target.path = "/player/landfall-return"; target.queryItems = [URLQueryItem(name: "handle", value: handle)] }
            else if let saved = privateStore?.lastJourney() { target.path = "/player/playthroughs/\(saved)/journal" }
            else { target.path = "/player" }
            if let player = target.url { view.load(URLRequest(url: player)); pendingReturn = nil }
        }
        return view
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) { decisionHandler(accepts(navigationAction.request.url) ? .allow : .cancel) }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, accepts(message.frameInfo.request.url), let request = message.body as? [String: Any], request["version"] as? Int == 1,
              let operation = request["operation"] as? String, let id = request["id"] as? String, id.count <= 128,
              JSONSerialization.isValidJSONObject(request), let encoded = try? JSONSerialization.data(withJSONObject: request), encoded.count <= 16384 else { replyHandler(nil, "INVALID_NATIVE_REQUEST"); return }
        let payload = request["payload"] as? [String: Any] ?? [:]
        switch operation {
        case "PRIVATE_STORE_PUT": replyHandler(["accepted": foreground && (privateStore?.put(payload["key"] as? String ?? "", value: payload["value"] as? String ?? "", expiresAt: payload["expiresAt"] as? Double ?? 0) ?? false)], nil)
        case "PRIVATE_STORE_GET": replyHandler(["value": foreground ? privateStore?.get(payload["key"] as? String ?? "") as Any? ?? NSNull() : NSNull()], nil)
        case "PRIVATE_STORE_LIST": replyHandler(["keys": foreground ? privateStore?.list() ?? [] : []], nil)
        case "PRIVATE_STORE_DELETE": if foreground { privateStore?.remove(payload["key"] as? String ?? "") }; replyHandler(["accepted": foreground], nil)
        case "LOCATION_PERMISSION_STATE": replyHandler(["state": permission()], nil)
        case "LOCATION_STATE":
            replyHandler(["provider":"core-location","registered":acquiring,"enabled":CLLocationManager.locationServicesEnabled(),
              "permission":permission(),"nativeCallbacks":locationCallbacks,"forwardedCallbacks":forwardedFixes,
              "foreground":foreground,"paused":systemLocationPaused,"intervalMs":locationIntervalMs,"failure":locationFailure],nil)
        case "LOCATION_PERMISSION":
            guard foreground, permissionReply == nil else { replyHandler(["state": "UNAVAILABLE"], nil); return }
            if location.authorizationStatus == .notDetermined { permissionReply = replyHandler; location.requestWhenInUseAuthorization() }
            else { replyHandler(["state": permission()], nil) }
        case "LOCATION_START":
            let interval = payload["intervalMs"] as? Int ?? 5000
            guard foreground, !power.critical, payload["background"] as? Bool != true, (1000...60000).contains(interval), ["GRANTED", "APPROXIMATE"].contains(permission()) else { replyHandler(["accepted": false], nil); return }
            requestedIntervalMs = interval; requestedPrecise = payload["precise"] as? Bool == true
            stopLocation(); configureLocationPower(); locationThrottle.start(); systemLocationPaused = false; locationFailure = "NONE"
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
            notificationPermissionDiagnostic(stage:"REQUESTED",granted:false,callbackOnMain:false)
            UNUserNotificationCenter.current().requestAuthorization(options:[.alert,.sound]){ [weak self] granted,_ in
                let callbackOnMain=Thread.isMainThread
                DispatchQueue.main.async {
                    self?.notificationPermissionDiagnostic(stage:"REPLIED",granted:granted,callbackOnMain:callbackOnMain)
                    replyHandler(["state":granted ? "GRANTED":"DENIED"],nil)
                }
            }
        case "GEOFENCE_CLEAR": clearGeofences(); replyHandler(["accepted": true], nil)
        case "POWER_STATE": replyHandler(power.snapshot(), nil)
        case "SENSORS_START": replyHandler(["accepted": startSensors()], nil)
        case "SENSORS_STOP": stopSensors(); replyHandler(["accepted": true], nil)
        case "BLE_START": replyHandler(["state": hardware?.startBle(foreground: foreground && !power.constrained, scanId: payload["scanId"] as? String ?? "") ?? "UNAVAILABLE"], nil)
        case "BLE_STOP": hardware?.stopBle(scanId: payload["scanId"] as? String ?? ""); replyHandler(["accepted": true], nil)
        case "NI_STATE": replyHandler(nearby?.state() ?? ["state": "UNAVAILABLE"], nil)
        case "NI_PREPARE": replyHandler(nearby?.prepare(foreground: foreground && !power.critical) ?? ["state": "UNAVAILABLE"], nil)
        case "NI_START": replyHandler(nearby?.start(payload, foreground: foreground && !power.critical) ?? ["state": "UNAVAILABLE"], nil)
        case "NI_STOP": nearby?.stop(); replyHandler(["accepted": true], nil)
        case "NFC_READ": replyHandler(["state": hardware?.startNfc(foreground: foreground && !power.constrained, scanId: payload["scanId"] as? String ?? "") ?? "UNAVAILABLE"], nil)
        case "QR_SCAN": replyHandler(["state": hardware?.startQr(foreground: foreground && !power.constrained, scanId: payload["scanId"] as? String ?? "", presenter: web?.window?.rootViewController) ?? "UNAVAILABLE"], nil)
        case "INTERACTION_STOP": hardware?.stopInteractions(scanId: payload["scanId"] as? String ?? ""); replyHandler(["accepted": true], nil)
        case "CLEAR_PRIVATE_DATA":
            stopLocation(); stopSensors(); hardware?.stop(); nearby?.stop()
            clearGeofences(); privateStore?.clear()
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
        // A pending fix belongs to the previous precision/permission epoch.
        // In particular, never deliver a precise fix after an approximate grant.
        if acquiring { locationThrottle.start() }
        if manager.authorizationStatus != .notDetermined { permissionReply?(["state": permission()], nil); permissionReply = nil }
        if !["GRANTED", "APPROXIMATE"].contains(permission()) { stopLocation(); clearGeofences() }
        else if manager.authorizationStatus != .authorizedAlways { clearGeofences() }
        event(["type": "permission", "state": permission()])
    }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        locationCallbacks = min(100000,locationCallbacks + locations.count)
        guard foreground, acquiring, ["GRANTED", "APPROXIMATE"].contains(permission()) else { return }
        for sample in locations.suffix(4) { locationThrottle.receive(sample) }
    }
    private func forwardLocation(_ sample: CLLocation) {
        guard foreground, acquiring, ["GRANTED", "APPROXIMATE"].contains(permission()) else { return }
        systemLocationPaused=false; locationFailure="NONE"
        var fix: [String: Any] = ["id": UUID().uuidString, "timestamp": Int(sample.timestamp.timeIntervalSince1970 * 1000), "latitude": sample.coordinate.latitude, "longitude": sample.coordinate.longitude, "accuracyMeters": sample.horizontalAccuracy]
        if sample.course >= 0 { fix["headingDegrees"] = sample.course }
        if sample.speed >= 0 { fix["speedMetersPerSecond"] = sample.speed }
        if sample.verticalAccuracy > 0 { fix["altitudeMeters"] = sample.altitude; fix["altitudeAccuracyMeters"] = sample.verticalAccuracy }
        forwardedFixes = min(100000,forwardedFixes + 1)
        event(["type": "fix", "fix": fix])
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if let value = error as? CLError, value.code == .locationUnknown { locationFailure="LOCATION_UNKNOWN";return }
        if let value = error as? CLError, value.code == .headingFailure { locationFailure="HEADING_FAILURE";manager.stopUpdatingHeading(); event(["type":"provider-health","family":"HEADING","state":"UNAVAILABLE"]); return }
        if (error as? CLError)?.code == .denied { stopLocation() }
        locationFailure=(error as? CLError)?.code == .denied ? "DENIED":"OTHER"
        event(["type": "error"])
    }
    func locationManagerDidPauseLocationUpdates(_ manager:CLLocationManager) { systemLocationPaused=true; locationThrottle.stop() }
    func locationManagerDidResumeLocationUpdates(_ manager:CLLocationManager) {
        systemLocationPaused=false
        if foreground, acquiring, ["GRANTED","APPROXIMATE"].contains(permission()) {locationThrottle.start()}
    }
    private func registerGeofence(_ payload: [String: Any], reply: @escaping (Any?, String?) -> Void) {
        guard CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) else { reply(["state": "UNSUPPORTED"], nil); return }
        guard foreground, location.authorizationStatus == .authorizedAlways, CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self), location.monitoredRegions.count < 20,
              let handle = payload["returnHandle"] as? String, (32...2048).contains(handle.count), handle.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil,
              let latitude = payload["latitude"] as? Double, let longitude = payload["longitude"] as? Double, let radius = payload["radiusMeters"] as? Double,
              let expires = payload["expiresAt"] as? Double, latitude.isFinite, longitude.isFinite, abs(latitude)<=90, abs(longitude)<=180, radius>=100, radius<=min(10000, location.maximumRegionMonitoringDistance),
              expires>Date().timeIntervalSince1970*1000, expires-Date().timeIntervalSince1970*1000<=86400000 else { reply(["state": "UNAVAILABLE"], nil); return }
        let region = CLCircularRegion(center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude), radius: radius, identifier: handle)
        guard geofenceReplies[handle] == nil, geofenceReplies.count + location.monitoredRegions.count < 20 else { reply(["state": "UNAVAILABLE"], nil); return }
        region.notifyOnEntry=true; region.notifyOnExit=true
        hints.register(handle:handle,expiresAt:expires,notifications:payload["notifications"] as? Bool==true)
        let request=UUID(); geofenceRequests[handle]=request
        geofenceReplies[handle] = reply
        location.startMonitoring(for: region)
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
            guard let self=self, self.geofenceRequests[handle] == request, let pending=self.geofenceReplies.removeValue(forKey:handle) else { return }
            self.geofenceRequests.removeValue(forKey:handle)
            self.location.stopMonitoring(for:region); self.hints.remove(handle:handle)
            pending(["state":"UNAVAILABLE"],nil)
        }
    }
    private func clearGeofences() {
        let pending=geofenceReplies; geofenceReplies.removeAll(); geofenceRequests.removeAll()
        for region in location.monitoredRegions { location.stopMonitoring(for:region) }
        hints.clear()
        for reply in pending.values { reply(["state":"UNAVAILABLE"],nil) }
    }
    func locationManager(_ manager: CLLocationManager, didStartMonitoringFor region: CLRegion) {
        geofenceRequests.removeValue(forKey:region.identifier)
        guard let reply=geofenceReplies.removeValue(forKey:region.identifier) else {
            if !hints.active(handle:region.identifier) { manager.stopMonitoring(for:region) }; return
        }
        guard hints.active(handle:region.identifier), manager.authorizationStatus == .authorizedAlways else {
            manager.stopMonitoring(for:region); hints.remove(handle:region.identifier); reply(["state":"UNAVAILABLE"],nil); return
        }
        reply(["state":"GRANTED"],nil)
    }
    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        guard hints.active(handle:region.identifier) else {manager.stopMonitoring(for:region);return}
        hints.append(handle:region.identifier,event:"ENTER")
        if hints.notices(handle:region.identifier){let content=UNMutableNotificationContent();content.title="Your journey may be nearby";content.body="Open your current Chart for a fresh check. No visit has been confirmed.";content.userInfo=["returnHandle":region.identifier];UNUserNotificationCenter.current().add(UNNotificationRequest(identifier:region.identifier,content:content,trigger:nil))}
    }
    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {if hints.active(handle:region.identifier){hints.append(handle:region.identifier,event:"EXIT")}else{manager.stopMonitoring(for:region)} }
    private func notificationPermissionDiagnostic(stage:String,granted:Bool,callbackOnMain:Bool) {
        #if DEBUG
        guard ["REQUESTED","REPLIED"].contains(stage) else {return}
        let file=FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("landfall-notification-debug.json")
        let value:[String:Any]=["stage":stage,"granted":granted,"callbackOnMain":callbackOnMain,"replyOnMain":Thread.isMainThread]
        if let data=try? JSONSerialization.data(withJSONObject:value) {
            try? FileManager.default.createDirectory(at:file.deletingLastPathComponent(),withIntermediateDirectories:true)
            try? data.write(to:file,options:[.atomic,.completeFileProtectionUntilFirstUserAuthentication])
        }
        #endif
    }
    func userNotificationCenter(_ center:UNUserNotificationCenter,didReceive response:UNNotificationResponse,withCompletionHandler completionHandler:@escaping()->Void){
        if let handle=response.notification.request.content.userInfo["returnHandle"] as? String,(32...2048).contains(handle.count),handle.range(of:"^[A-Za-z0-9_-]+$",options:.regularExpression) != nil{
            pendingReturn=handle
            if let origin=origin,let url=URL(string:"/player/landfall-return?handle=\(handle)",relativeTo:origin),let web=web{web.load(URLRequest(url:url));pendingReturn=nil}
        }
        completionHandler()
    }
    func locationManager(_ manager: CLLocationManager, monitoringDidFailFor region: CLRegion?, withError error: Error) {
        if let region=region {
            geofenceRequests.removeValue(forKey:region.identifier)
            manager.stopMonitoring(for:region); hints.remove(handle:region.identifier)
            geofenceReplies.removeValue(forKey:region.identifier)?(["state":"UNAVAILABLE"],nil)
        } else { clearGeofences() }
        event(["type": "provider-health", "family":"GEOFENCE", "state":"UNAVAILABLE"])
    }
    private func startSensors() -> Bool {
        guard foreground, !power.constrained else { return false }
        stopSensors()
        if CLLocationManager.headingAvailable() { location.headingFilter=10; location.startUpdatingHeading() }
        if motion.isAccelerometerAvailable { motion.accelerometerUpdateInterval=0.25; motion.startAccelerometerUpdates(to: .main) { [weak self] sample, _ in if let value=sample?.acceleration { self?.sensor("ACCELEROMETER", [value.x*9.80665,value.y*9.80665,value.z*9.80665], accuracy: 1) } } }
        if CMAltimeter.isRelativeAltitudeAvailable() { altimeter.startRelativeAltitudeUpdates(to: .main) { [weak self] sample, _ in if let sample=sample { self?.sensor("PRESSURE", [sample.pressure.doubleValue*10], accuracy: 1) } } }
        return CLLocationManager.headingAvailable() || motion.isAccelerometerAvailable || CMAltimeter.isRelativeAltitudeAvailable()
    }
    func locationManager(_ manager: CLLocationManager, didUpdateHeading heading: CLHeading) { if heading.headingAccuracy>=0 { sensor("HEADING", [heading.magneticHeading], accuracy: heading.headingAccuracy) } }
    private func sensor(_ kind: String, _ values: [Double], accuracy: Double) { guard foreground else { return }; event(["type": "sensor", "frame": ["id": UUID().uuidString, "observedAt": Int(Date().timeIntervalSince1970*1000), "kind": kind, "values": values, "accuracy": accuracy]]) }
    private func stopLocation() { acquiring=false; locationThrottle.stop(); location.stopUpdatingLocation() }
    private func configureLocationPower() {
        locationIntervalMs = power.interval(requestedIntervalMs)
        location.desiredAccuracy = requestedPrecise && !power.constrained && location.accuracyAuthorization == .fullAccuracy ? kCLLocationAccuracyBest : kCLLocationAccuracyHundredMeters
        location.distanceFilter = locationIntervalMs >= 15000 ? 10 : kCLDistanceFilterNone
    }
    private func powerChanged() {
        guard foreground else { return }
        if power.constrained { stopSensors() }
        if power.constrained { hardware?.stopInteractions();hardware?.stopBle() }
        if power.critical { hardware?.stop(); nearby?.stop(); if acquiring { stopLocation(); event(["type":"error"]) } }
        else if acquiring { configureLocationPower() }
        event(["type":"power", "power":power.snapshot()])
    }
    private func stopSensors() { location.stopUpdatingHeading(); motion.stopAccelerometerUpdates(); motion.stopDeviceMotionUpdates(); altimeter.stopRelativeAltitudeUpdates() }
    private func pause() { event(["type":"lifecycle","state":"BACKGROUND"]); foreground=false; stopLocation(); stopSensors(); hardware?.stop(); nearby?.stop() }
    private func event(_ payload: [String: Any]) {
        guard foreground, let web=web, accepts(web.url), JSONSerialization.isValidJSONObject(payload), let data=try? JSONSerialization.data(withJSONObject: payload, options: [.fragmentsAllowed]), let json=String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self=self, self.accepts(web.url), self.foreground || payload["type"] as? String == "lifecycle" else { return }
            web.evaluateJavaScript("window.dispatchEvent(new CustomEvent('landfall-native-event',{detail:\(json)}))", completionHandler: nil)
        }
    }
}
