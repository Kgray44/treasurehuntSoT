import Foundation
import CoreLocation

struct SextantPositionFix {
    let latitude:Double,longitude:Double,accuracy:Double,capturedAt:Double,captureAge:Double
    var captureUncertain=false
}
protocol SextantPositionSource:AnyObject {
    var fidelity:String {get}
    var supported:Bool {get}
    var enabled:Bool {get}
    var permission:String {get}
    func configure(intervalMs:Int,precise:Bool)->Bool
    func stop()
}
extension SextantPositionSource {var enabled:Bool{true}}
final class CoreLocationSextantSource:SextantPositionSource {
    let fidelity="OS",manager:CLLocationManager
    init(_ manager:CLLocationManager){self.manager=manager}
    var supported:Bool{true}
    var enabled:Bool{CLLocationManager.locationServicesEnabled()}
    var permission:String {
        switch manager.authorizationStatus {
        case .authorizedAlways,.authorizedWhenInUse:return manager.accuracyAuthorization == .fullAccuracy ? "GRANTED":"APPROXIMATE"
        case .denied:return "DENIED"
        case .restricted:return "RESTRICTED"
        default:return "PROMPT"
        }
    }
    func configure(intervalMs:Int,precise:Bool)->Bool {
        guard supported,enabled,["GRANTED","APPROXIMATE"].contains(permission) else{return false}
        manager.allowsBackgroundLocationUpdates=false;manager.pausesLocationUpdatesAutomatically=true
        manager.desiredAccuracy=precise && permission == "GRANTED" ? kCLLocationAccuracyBest:kCLLocationAccuracyHundredMeters
        manager.distanceFilter=intervalMs>=15000 ? 10:kCLDistanceFilterNone
        manager.startUpdatingLocation();return true
    }
    func stop(){manager.stopUpdatingLocation()}
}
/** Single foreground Core Location owner. Navigation delegates retain geofence,
 * Worldspace and arrival policy; this class never writes Chronicle progression. */
final class SextantPosition {
    static let capability="sextant.position.observation"
    private final class Lease {
        let id:String,generation=UUID().uuidString,startedAt:Double
        var interval:Int,last:Double?,sequence=0,expiry:DispatchWorkItem?
        init(_ id:String,_ interval:Int,_ startedAt:Double){self.id=id;self.interval=max(1000,interval);self.startedAt=startedAt}
    }
    private let source:SextantPositionSource,emit:([String:Any])->Void,now:()->Double
    private var leases=[String:Lease](),legacyInterval:Int?,legacyPrecise=false,constrained=false
    init(source:SextantPositionSource,now:@escaping()->Double={ProcessInfo.processInfo.systemUptime*1000},emit:@escaping([String:Any])->Void){self.source=source;self.now=now;self.emit=emit}
    var activeLeaseCount:Int{leases.count}
    var permission:String{source.permission}
    func snapshot(foreground:Bool)->[String:Any] {
        ["support":source.supported ? "SUPPORTED":"UNSUPPORTED","availability":source.supported && source.enabled && foreground && ["GRANTED","APPROXIMATE"].contains(permission) ? "AVAILABLE":"TEMPORARILY_UNAVAILABLE","permission":permission == "APPROXIMATE" ? "GRANTED":permission,"calibration":"NOT_APPLICABLE","quality":"UNKNOWN","freshness":"UNKNOWN","lifecycle":foreground ? "FOREGROUND_ONLY":"SUSPENDED"]
    }
    @discardableResult func startLegacy(interval:Int,precise:Bool)->Bool {
        legacyInterval=interval;legacyPrecise=precise
        if reconcile(){return true};legacyInterval=nil;_ = reconcile();return false
    }
    func stopLegacy(){legacyInterval=nil;_ = reconcile()}
    func start(_ payload:[String:Any],foreground:Bool)->[String:Any] {
        guard foreground,let id=payload["leaseId"] as? String,UUID(uuidString:id) != nil,leases[id]==nil,leases.count<8,
              let caps=payload["capabilities"] as? [String],caps == [Self.capability],
              let interval=payload["intervalMs"] as? Int,(16...5000).contains(interval),let duration=payload["durationMs"] as? Int,(1...60000).contains(duration),["GRANTED","APPROXIMATE"].contains(permission) else{return ["accepted":false]}
        let lease=Lease(id,interval,now());leases[id]=lease
        guard reconcile() else{leases.removeValue(forKey:id);_ = reconcile();return ["accepted":false]}
        let expiry=DispatchWorkItem{[weak self] in self?.end(id,"EXPIRED")};lease.expiry=expiry;DispatchQueue.main.asyncAfter(deadline:.now()+Double(duration)/1000,execute:expiry)
        return ["accepted":true,"generation":lease.generation,"nativeMonotonicMs":now()]
    }
    func stop(_ id:String){guard let lease=leases.removeValue(forKey:id) else{return};lease.expiry?.cancel();_ = reconcile()}
    func update(_ id:String,interval:Int)->Bool{guard let lease=leases[id],(16...5000).contains(interval) else{return false};lease.interval=max(1000,interval);return reconcile()}
    func stopAll(_ reason:String){for id in Array(leases.keys){end(id,reason)};legacyInterval=nil;source.stop()}
    func authorizationChanged(){for id in Array(leases.keys){end(id,"PERMISSION")};_ = reconcile()}
    func setConstrained(_ value:Bool){constrained=value;_ = reconcile()}
    private func end(_ id:String,_ reason:String){guard let lease=leases[id] else{return};emit(["type":"sextant-ended","leaseId":id,"generation":lease.generation,"reason":reason]);stop(id)}
    private func reconcile()->Bool {
        if leases.isEmpty && legacyInterval==nil{source.stop();return true}
        let interval=max(constrained ? 15000:1000,min(legacyInterval ?? 60000,leases.values.map{$0.interval}.min() ?? 60000))
        return source.configure(intervalMs:interval,precise:!constrained && (legacyPrecise || !leases.isEmpty))
    }
    func acceptLocation(_ location:CLLocation) {
        // Core Location supplies wall capture time. Keep the uncertainty explicit
        // instead of presenting receipt uptime as an exact hardware clock.
        let age=Date().timeIntervalSince(location.timestamp)*1000
        accept(SextantPositionFix(latitude:location.coordinate.latitude,longitude:location.coordinate.longitude,accuracy:location.horizontalAccuracy,capturedAt:now()-age,captureAge:age,captureUncertain:true))
    }
    func accept(_ fix:SextantPositionFix) {
        guard ["GRANTED","APPROXIMATE"].contains(permission) else{stopAll("PERMISSION");return}
        guard fix.latitude.isFinite,fix.longitude.isFinite,abs(fix.latitude)<=90,abs(fix.longitude)<=180,fix.accuracy.isFinite,fix.accuracy>0,fix.capturedAt.isFinite,fix.capturedAt>=0,fix.captureAge.isFinite,fix.captureAge>=0,fix.captureAge<=1000,now()>=fix.capturedAt,now()-fix.capturedAt<=1000 else{return}
        for lease in Array(leases.values) {
            if fix.capturedAt<lease.startedAt{continue}
            if let previous=lease.last,fix.capturedAt-previous<Double(max(constrained ? 15000:1000,lease.interval)){continue}
            lease.last=fix.capturedAt
            let sample:[String:Any]=["capabilityId":Self.capability,"value":["latitude":fix.latitude,"longitude":fix.longitude,"accuracyMeters":fix.accuracy],"units":"degrees/meters","referenceFrame":"WGS84","qualityClass":!fix.captureUncertain && !constrained && permission == "GRANTED" ? "MEDIUM":"LOW","calibrationState":"NOT_APPLICABLE","confidence":NSNull(),"uncertainty":fix.accuracy,"warnings":fix.captureUncertain ? ["POSITION_IS_CONTEXT_NOT_ARRIVAL_PROOF","CAPTURE_CLOCK_UNCERTAIN"]:["POSITION_IS_CONTEXT_NOT_ARRIVAL_PROOF"]]
            emit(["type":"sextant-sample","version":1,"leaseId":lease.id,"generation":lease.generation,"sequence":lease.sequence,"emittedAtWallMs":Int(Date().timeIntervalSince1970*1000),"captureMonotonicMs":fix.capturedAt,"captureAgeMs":fix.captureAge,"fidelity":source.fidelity,"sample":sample]);lease.sequence+=1
        }
    }
    deinit{for lease in leases.values{lease.expiry?.cancel()};source.stop()}
}
