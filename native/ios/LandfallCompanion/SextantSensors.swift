import Foundation
import CoreMotion
import CoreLocation

struct SextantNativeSample {
    let capability: String, value: Any, units: String, frame: String, at: Double
    var quality = "MEDIUM", calibration = "UNKNOWN", warnings = ["PLATFORM_ACCURACY_UNQUALIFIED"]
    var uncertainty: Double? = nil
}
protocol SextantSensorSource: AnyObject {
    var fidelity: String { get }
    func supports(_ capability: String) -> Bool
    func permission(_ capability: String) -> String
    func requestPermission(_ capability:String,reply:@escaping(String)->Void)
    func configure(_ capabilities: Set<String>, intervalMs: Int, emit: @escaping (SextantNativeSample) -> Void, fail: @escaping (String) -> Void) -> Bool
    func stop()
}
extension SextantSensorSource {
    func requestPermission(_ capability:String,reply:@escaping(String)->Void){reply(permission(capability))}
}

/** Actual native APIs; no fabricated simulator sensor availability. All callbacks
 * use main-queue ownership and capture uptime, not Date for motion integration. */
final class CoreMotionSextantSource: NSObject, SextantSensorSource, CLLocationManagerDelegate {
    let fidelity = "OS"
    private let motion = CMMotionManager(), altitude = CMAltimeter(), steps = CMPedometer(), heading = CLLocationManager()
    private var emit: ((SextantNativeSample) -> Void)?, fail: ((String) -> Void)?
    private var caps = Set<String>(), altitudeActive = false, stepsActive = false, headingActive = false, magneticFrame = false
    private var interval = 0.25
    private var stability = [(at:Double,magnitude:Double)]()
    private var permissionGeneration:UUID?,permissionReply:((String)->Void)?,permissionTimeout:DispatchWorkItem?
    override init() { super.init(); heading.delegate = self }
    private func suffix(_ id: String) -> String { String(id.dropFirst("sextant.".count)) }
    func supports(_ id: String) -> Bool {
        switch suffix(id) {
        case "motion.acceleration-including-gravity": return motion.isAccelerometerAvailable
        case "motion.angular-velocity": return motion.isGyroAvailable
        case "motion.linear-acceleration", "motion.gravity", "motion.stability", "motion.moving", "orientation.relative", "orientation.attitude": return motion.isDeviceMotionAvailable
        case "orientation.absolute": return motion.isDeviceMotionAvailable && CMMotionManager.availableAttitudeReferenceFrames().contains(.xMagneticNorthZVertical)
        case "heading.estimate": return CLLocationManager.headingAvailable()
        case "magnetic.field", "magnetic.uncalibrated-field": return motion.isMagnetometerAvailable
        case "pressure.observation": return CMAltimeter.isRelativeAltitudeAvailable()
        case "motion.pedometer": return CMPedometer.isStepCountingAvailable()
        default: return false
        }
    }
    func permission(_ id: String) -> String {
        if id == "sextant.heading.estimate" {
            switch heading.authorizationStatus { case .denied: return "DENIED"; case .restricted: return "RESTRICTED"; case .notDetermined: return "PROMPT"; default: return "GRANTED" }
        }
        let status: CMAuthorizationStatus? = id == "sextant.motion.pedometer" ? CMPedometer.authorizationStatus() : id == "sextant.pressure.observation" ? CMAltimeter.authorizationStatus() : nil
        switch status { case .some(.denied): return "DENIED"; case .some(.restricted): return "RESTRICTED"; case .some(.notDetermined): return "PROMPT"; default: return "NOT_REQUIRED" }
    }
    func requestPermission(_ id:String,reply:@escaping(String)->Void) {
        let current=permission(id)
        guard current == "PROMPT" else{reply(current);return}
        guard permissionGeneration == nil,["sextant.motion.pedometer","sextant.pressure.observation"].contains(id) else{reply("RESTRICTED");return}
        let generation=UUID();permissionGeneration=generation;permissionReply=reply
        let finish:()->Void = {[weak self] in
            guard let self=self,self.permissionGeneration == generation else{return}
            self.permissionTimeout?.cancel();self.permissionTimeout=nil;self.permissionGeneration=nil
            if id == "sextant.pressure.observation" && !self.altitudeActive {self.altitude.stopRelativeAltitudeUpdates()}
            let callback=self.permissionReply;self.permissionReply=nil;callback?(self.permission(id))
        }
        let timeout=DispatchWorkItem(block:finish);permissionTimeout=timeout;DispatchQueue.main.asyncAfter(deadline:.now()+15,execute:timeout)
        if id == "sextant.motion.pedometer" {
            // The platform's bounded authorization query is not a sensor lease.
            steps.queryPedometerData(from:Date(),to:Date()){_,_ in DispatchQueue.main.async(execute:finish)}
        }else{
            guard !altitudeActive else{finish();return}
            altitude.startRelativeAltitudeUpdates(to:.main){_,_ in finish()}
        }
    }
    private func vector(_ x: Double, _ y: Double, _ z: Double) -> [String: Double] { ["x":x,"y":y,"z":z] }
    static func canonicalAcceleration(_ value:CMAcceleration)->[String:Double]{["x":-value.x*9.80665,"y":-value.y*9.80665,"z":-value.z*9.80665]}
    private func publish(_ suffix: String, _ value: Any, _ units: String, _ frame: String, _ at: Double, calibration: String = "UNKNOWN", quality: String = "MEDIUM", uncertainty: Double? = nil, receiptTime: Bool = false) {
        let id="sextant.\(suffix)"; guard caps.contains(id) else { return }
        emit?(SextantNativeSample(capability:id,value:value,units:units,frame:frame,at:at*1000,quality:receiptTime ? "LOW":quality,calibration:calibration,warnings:receiptTime ? ["PLATFORM_ACCURACY_UNQUALIFIED","RECEIPT_TIME_CAPTURE_UNCERTAIN"]:["PLATFORM_ACCURACY_UNQUALIFIED"],uncertainty:uncertainty))
    }
    func configure(_ requested: Set<String>, intervalMs: Int, emit: @escaping (SextantNativeSample) -> Void, fail: @escaping (String) -> Void) -> Bool {
        let device = requested.contains { ["sextant.motion.linear-acceleration","sextant.motion.gravity","sextant.motion.stability","sextant.motion.moving","sextant.orientation.relative","sextant.orientation.attitude","sextant.orientation.absolute","sextant.magnetic.field"].contains($0) }
        let absolute = requested.contains("sextant.orientation.absolute")
        // A reference change requires a fresh consumer acquisition; preserve an
        // existing local-frame consumer instead of silently reorienting it.
        if absolute && motion.isDeviceMotionActive && !magneticFrame { return false }
        caps=requested;self.emit=emit;self.fail=fail;interval=Double(intervalMs)/1000
        motion.accelerometerUpdateInterval=interval;motion.gyroUpdateInterval=interval;motion.magnetometerUpdateInterval=interval;motion.deviceMotionUpdateInterval=interval
        if requested.contains("sextant.motion.acceleration-including-gravity") && motion.isAccelerometerAvailable {
            if !motion.isAccelerometerActive { motion.startAccelerometerUpdates(to:.main) { [weak self] value,error in
                guard let self=self else{return};if error != nil {self.fail?("sextant.motion.acceleration-including-gravity");return};guard let value=value else{return}
                // Core Motion reports gravity acceleration; canonical Sextant
                // specific force uses the Android/W3C stationary +up sign.
                self.publish("motion.acceleration-including-gravity",Self.canonicalAcceleration(value.acceleration),"m/s^2","DEVICE",value.timestamp)
            } }
        } else { motion.stopAccelerometerUpdates() }
        if requested.contains("sextant.motion.angular-velocity") && motion.isGyroAvailable {
            if !motion.isGyroActive {motion.startGyroUpdates(to:.main) { [weak self] value,error in
                guard let self=self else{return};if error != nil {self.fail?("sextant.motion.angular-velocity");return};if let v=value {self.publish("motion.angular-velocity",self.vector(v.rotationRate.x,v.rotationRate.y,v.rotationRate.z),"rad/s","DEVICE",v.timestamp)}
            } }
        } else {motion.stopGyroUpdates()}
        if (requested.contains("sextant.magnetic.uncalibrated-field") || (requested.contains("sextant.magnetic.field") && !motion.isDeviceMotionAvailable)) && motion.isMagnetometerAvailable {
            if !motion.isMagnetometerActive {motion.startMagnetometerUpdates(to:.main) { [weak self] value,error in
                guard let self=self else{return};if error != nil {self.fail?("sextant.magnetic.field");return};if let v=value {
                    // Raw CMMagnetometerData has no calibration-quality field.
                    if !self.motion.isDeviceMotionAvailable {self.publish("magnetic.field",self.vector(v.magneticField.x,v.magneticField.y,v.magneticField.z),"microtesla","DEVICE",v.timestamp,quality:"LOW")}
                    self.publish("magnetic.uncalibrated-field",self.vector(v.magneticField.x,v.magneticField.y,v.magneticField.z),"microtesla","DEVICE",v.timestamp,quality:"LOW")
                }
            } }
        } else {motion.stopMagnetometerUpdates()}
        if device && motion.isDeviceMotionAvailable {
            if !motion.isDeviceMotionActive {
                magneticFrame=absolute
                let reference:CMAttitudeReferenceFrame=absolute ? .xMagneticNorthZVertical : CMMotionManager.availableAttitudeReferenceFrames().contains(.xArbitraryCorrectedZVertical) ? .xArbitraryCorrectedZVertical:.xArbitraryZVertical
                motion.startDeviceMotionUpdates(using:reference,to:.main) { [weak self] value,error in
                    guard let self=self else{return};if error != nil {
                        for cap in Array(self.caps) where ["sextant.motion.linear-acceleration","sextant.motion.gravity","sextant.motion.stability","sextant.motion.moving","sextant.orientation.relative","sextant.orientation.attitude","sextant.orientation.absolute","sextant.magnetic.field"].contains(cap){self.fail?(cap)}
                        return
                    };guard let v=value else{return}
                    let g=v.gravity,a=v.userAcceleration
                    self.publish("motion.gravity",Self.canonicalAcceleration(g),"m/s^2","DEVICE",v.timestamp)
                    self.publish("motion.linear-acceleration",Self.canonicalAcceleration(a),"m/s^2","DEVICE",v.timestamp)
                    let q=Self.canonicalAttitude(v.attitude.quaternion,magnetic:self.magneticFrame)
                    self.publish("orientation.attitude",q,"quaternion",self.magneticFrame ? "EARTH_MAGNETIC":"LOCAL_ARBITRARY",v.timestamp)
                    self.publish("orientation.relative",q,"quaternion","LOCAL_ARBITRARY",v.timestamp)
                    if self.magneticFrame {self.publish("orientation.absolute",q,"quaternion","EARTH_MAGNETIC",v.timestamp,calibration:v.magneticField.accuracy == .uncalibrated ? "CALIBRATING":"GOOD",quality:v.magneticField.accuracy == .uncalibrated ? "LOW":"MEDIUM")}
                    let m=v.magneticField,field=m.field
                    self.publish("magnetic.field",self.vector(field.x,field.y,field.z),"microtesla","DEVICE",v.timestamp,calibration:m.accuracy == .uncalibrated ? "CALIBRATING":"GOOD",quality:[CMMagneticFieldCalibrationAccuracy.medium,.high].contains(m.accuracy) ? "MEDIUM":"LOW")
                    let magnitude=sqrt(a.x*a.x+a.y*a.y+a.z*a.z)*9.80665
                    self.publish("motion.moving",magnitude>1.5,"boolean","DEVICE",v.timestamp)
                    self.stability.append((v.timestamp,magnitude));self.stability=self.stability.filter{v.timestamp-$0.at<=1.2};if self.stability.count>64{self.stability.removeFirst(self.stability.count-64)}
                    let enough=self.stability.count>=5 && v.timestamp-(self.stability.first?.at ?? v.timestamp)>=0.8
                    self.publish("motion.stability",enough ? (self.stability.allSatisfy{$0.magnitude<0.5} ? "STABLE":"MOVING"):"UNKNOWN","classification","DEVICE",v.timestamp)
                }
            }
        } else {motion.stopDeviceMotionUpdates()}
        if requested.contains("sextant.pressure.observation") && CMAltimeter.isRelativeAltitudeAvailable() && !altitudeActive {
            altitudeActive=true;altitude.startRelativeAltitudeUpdates(to:.main) { [weak self] value,error in
                guard let self=self else{return};if error != nil {self.fail?("sextant.pressure.observation");return};if let v=value {self.publish("pressure.observation",v.pressure.doubleValue*10,"hPa","NONE",v.timestamp,calibration:"GOOD")}
            }
        } else if !requested.contains("sextant.pressure.observation") {altitude.stopRelativeAltitudeUpdates();altitudeActive=false}
        if requested.contains("sextant.motion.pedometer") && CMPedometer.isStepCountingAvailable() && !stepsActive {
            stepsActive=true;steps.startUpdates(from:Date()) { [weak self] value,error in DispatchQueue.main.async {
                guard let self=self else{return};if error != nil {self.fail?("sextant.motion.pedometer");return};if let v=value {self.publish("motion.pedometer",["stepDelta":v.numberOfSteps.intValue,"cadenceClass":"UNKNOWN","method":"OS_PEDOMETER"],"step-evidence","DEVICE",ProcessInfo.processInfo.systemUptime,receiptTime:true)}
            } }
        } else if !requested.contains("sextant.motion.pedometer") {steps.stopUpdates();stepsActive=false}
        if requested.contains("sextant.heading.estimate") && CLLocationManager.headingAvailable() && ["GRANTED","NOT_REQUIRED"].contains(permission("sextant.heading.estimate")) {heading.headingFilter=1;heading.startUpdatingHeading();headingActive=true}
        else if headingActive {heading.stopUpdatingHeading();headingActive=false}
        return true
    }
    static func canonicalAttitude(_ q: CMQuaternion, magnetic: Bool) -> [String:Double] {
        let n=sqrt(q.x*q.x+q.y*q.y+q.z*q.z+q.w*q.w);guard n.isFinite,n>0.000001 else{return [:]}
        // CMAttitude's reference-to-device DCM is inverted. Apple magnetic
        // reference X=north/Y=west becomes ENU through a +90-degree Z rotation.
        let x = -q.x/n, y = -q.y/n, z = -q.z/n, w=q.w/n
        if !magnetic {return ["x":x,"y":y,"z":z,"w":w]}
        let s=sqrt(0.5);return ["x":s*(x-y),"y":s*(x+y),"z":s*(z+w),"w":s*(w-z)]
    }
    func locationManager(_ manager: CLLocationManager, didUpdateHeading value: CLHeading) {
        guard value.headingAccuracy>=0 else{return}
        publish("heading.estimate",value.magneticHeading,"degrees","EARTH_MAGNETIC",ProcessInfo.processInfo.systemUptime,calibration:"GOOD",uncertainty:value.headingAccuracy,receiptTime:true)
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {fail?("sextant.heading.estimate")}
    func stop(){caps.removeAll();stability.removeAll();permissionTimeout?.cancel();permissionTimeout=nil;permissionGeneration=nil;let pending=permissionReply;permissionReply=nil;pending?("RESTRICTED");motion.stopAccelerometerUpdates();motion.stopGyroUpdates();motion.stopMagnetometerUpdates();motion.stopDeviceMotionUpdates();altitude.stopRelativeAltitudeUpdates();steps.stopUpdates();heading.stopUpdatingHeading();altitudeActive=false;stepsActive=false;headingActive=false;emit=nil;fail=nil}
    deinit {stop()}
}

final class SextantSensors {
    static let capabilities = ["motion.acceleration-including-gravity","motion.linear-acceleration","motion.gravity","motion.angular-velocity","motion.stability","motion.moving","orientation.relative","orientation.attitude","orientation.absolute","heading.estimate","magnetic.field","magnetic.uncalibrated-field","magnetic.bias","pressure.observation","motion.pedometer"].map{"sextant.\($0)"}
    private final class Lease {
        let id:String,generation=UUID().uuidString,caps:Set<String>
        var interval:Int,sequence=0,last=[String:Double](),expiry:DispatchWorkItem?,steps:Int?,reference:[String:Double]?
        init(_ id:String,_ caps:Set<String>,_ interval:Int){self.id=id;self.caps=caps;self.interval=interval}
    }
    private let source:SextantSensorSource,emit:([String:Any])->Void,now:()->Double
    private var leases=[String:Lease](),legacy:String?,constrained=false
    init(source:SextantSensorSource=CoreMotionSextantSource(),now:@escaping ()->Double={ProcessInfo.processInfo.systemUptime*1000},emit:@escaping ([String:Any])->Void){self.source=source;self.now=now;self.emit=emit}
    func snapshot(foreground:Bool)->[String:Any]{
        var states=[String:Any]()
        for id in Self.capabilities {let supported=source.supports(id),permission=source.permission(id)
            states[id]=["support":supported ? "SUPPORTED":"UNSUPPORTED","availability":supported && foreground && !["DENIED","RESTRICTED"].contains(permission) ? "AVAILABLE":"TEMPORARILY_UNAVAILABLE","permission":permission,"calibration":"UNKNOWN","quality":"UNKNOWN","freshness":"UNKNOWN","lifecycle":foreground ? "FOREGROUND_ONLY":"SUSPENDED"]
        }
        return ["version":1,"states":states,"background":"FOREGROUND_ONLY"]
    }
    func start(_ payload:[String:Any],foreground:Bool)->[String:Any]{
        guard foreground,let id=payload["leaseId"] as? String,UUID(uuidString:id) != nil,leases[id]==nil,leases.count<8,let caps=payload["capabilities"] as? [String],!caps.isEmpty,caps.count<=16,Set(caps).count==caps.count,caps.allSatisfy({Self.capabilities.contains($0)}),let interval=payload["intervalMs"] as? Int,(16...5000).contains(interval),let duration=payload["durationMs"] as? Int,(1...60000).contains(duration),caps.contains(where:{source.supports($0) && !["DENIED","RESTRICTED"].contains(source.permission($0))}) else{return ["accepted":false]}
        let lease=Lease(id,Set(caps),interval);leases[id]=lease
        guard reconcile() else{leases.removeValue(forKey:id);_ = reconcile();return ["accepted":false]}
        let expiry=DispatchWorkItem{[weak self] in self?.end(id,reason:"EXPIRED")};lease.expiry=expiry;DispatchQueue.main.asyncAfter(deadline:.now()+Double(duration)/1000,execute:expiry)
        return ["accepted":true,"generation":lease.generation,"nativeMonotonicMs":now()]
    }
    func update(_ id:String,interval:Int)->Bool{guard let lease=leases[id],(16...5000).contains(interval) else{return false};lease.interval=interval;return reconcile()}
    func stop(_ id:String){leases.removeValue(forKey:id)?.expiry?.cancel();if legacy==id{legacy=nil};_ = reconcile()}
    func stopAll(_ reason:String){for id in Array(leases.keys){end(id,reason:reason)};source.stop()}
    func setConstrained(_ value:Bool){constrained=value;_ = reconcile()}
    private func end(_ id:String,reason:String){guard let lease=leases[id] else{return};emit(["type":"sextant-ended","leaseId":id,"generation":lease.generation,"reason":reason]);stop(id)}
    private func reconcile()->Bool{
        if leases.isEmpty{source.stop();return true}
        let caps=Set(leases.values.flatMap{$0.caps}),interval=max(constrained ? 1000:16,leases.values.map{$0.interval}.min() ?? 5000)
        return source.configure(caps,intervalMs:interval,emit:{[weak self] in self?.accept($0)},fail:{[weak self] cap in
            guard let self=self else{return};for lease in Array(self.leases.values) where lease.caps.contains(cap){self.end(lease.id,reason:"PROVIDER_ERROR")}
        })
    }
    private func accept(_ raw:SextantNativeSample){
        let age=now()-raw.at;guard age.isFinite,age>=0,age<=1000,JSONSerialization.isValidJSONObject(["value":raw.value]) else{return}
        for lease in Array(leases.values) where lease.caps.contains(raw.capability){
            guard !["DENIED","RESTRICTED"].contains(source.permission(raw.capability)) else{end(lease.id,reason:"PERMISSION");continue}
            let previousAt=lease.last[raw.capability]
            if let last=previousAt,raw.at-last<Double(max(constrained ? 1000:16,lease.interval)){continue}
            var value=raw.value
            if raw.capability=="sextant.orientation.relative",let q=raw.value as? [String:Double] {
                if lease.reference==nil{lease.reference=q};guard let ref=lease.reference,let relative=Self.relativeAttitude(ref,q) else{continue};value=relative
            }
            if raw.capability=="sextant.motion.pedometer",var steps=raw.value as? [String:Any],let total=steps["stepDelta"] as? Int {
                let delta=lease.steps.map{total >= $0 ? total-$0:0} ?? 0
                if let previous=previousAt,delta>10000 || Double(delta)/((raw.at-previous)/1000)>5 {lease.steps=nil;continue}
                lease.steps=total;steps["stepDelta"]=delta;value=steps
            }
            lease.last[raw.capability]=raw.at
            var sample:[String:Any]=["capabilityId":raw.capability,"value":value,"units":raw.units,"referenceFrame":raw.frame,"qualityClass":constrained ? "LOW":raw.quality,"calibrationState":raw.calibration,"confidence":NSNull(),"warnings":raw.warnings+(constrained ? ["POWER_CADENCE_THROTTLED"]:[])]
            if let uncertainty=raw.uncertainty{sample["uncertainty"]=uncertainty}
            emit(["type":"sextant-sample","version":1,"leaseId":lease.id,"generation":lease.generation,"sequence":lease.sequence,"emittedAtWallMs":Int(Date().timeIntervalSince1970*1000),"captureMonotonicMs":raw.at,"captureAgeMs":age,"fidelity":source.fidelity,"sample":sample]);lease.sequence+=1
            if lease.id==legacy && source.fidelity=="OS"{legacyProjection(raw)}
        }
    }
    func startLegacy(foreground:Bool)->Bool{
        if let id=legacy{stop(id)};let id=UUID().uuidString
        let reply=start(["leaseId":id,"capabilities":["sextant.heading.estimate","sextant.motion.acceleration-including-gravity","sextant.pressure.observation"],"intervalMs":250,"durationMs":60000],foreground:foreground)
        if reply["accepted"] as? Bool == true{legacy=id;leases[id]?.expiry?.cancel();return true};return false
    }
    func stopLegacy(){if let id=legacy{stop(id)}}
    private func legacyProjection(_ raw:SextantNativeSample){
        var values=[Double](),kind="",accuracy=1.0
        if raw.capability=="sextant.heading.estimate",let v=raw.value as? Double{kind="HEADING";values=[v];accuracy=raw.uncertainty ?? 180}
        if raw.capability=="sextant.pressure.observation",let v=raw.value as? Double{kind="PRESSURE";values=[v]}
        if raw.capability=="sextant.motion.acceleration-including-gravity",let v=raw.value as? [String:Double],let x=v["x"],let y=v["y"],let z=v["z"]{kind="ACCELEROMETER";values=[-x,-y,-z]}
        if !kind.isEmpty{emit(["type":"sensor","frame":["id":UUID().uuidString,"observedAt":Int(Date().timeIntervalSince1970*1000),"kind":kind,"values":values,"accuracy":accuracy]])}
    }
    var activeLeaseCount:Int{leases.count}
    func permission(_ capability:String)->String{Self.capabilities.contains(capability) ? source.permission(capability):"RESTRICTED"}
    func requestPermission(_ capability:String,reply:@escaping(String)->Void){guard Self.capabilities.contains(capability) else{reply("RESTRICTED");return};source.requestPermission(capability,reply:reply)}
    static func relativeAttitude(_ ref:[String:Double],_ next:[String:Double])->[String:Double]? {
        guard let ax=ref["x"],let ay=ref["y"],let az=ref["z"],let aw=ref["w"],let bx=next["x"],let by=next["y"],let bz=next["z"],let bw=next["w"] else{return nil}
        return ["x":aw*bx-ax*bw-ay*bz+az*by,"y":aw*by+ax*bz-ay*bw-az*bx,"z":aw*bz-ax*by+ay*bx-az*bw,"w":aw*bw+ax*bx+ay*by+az*bz]
    }
    deinit{for lease in leases.values{lease.expiry?.cancel()};source.stop()}
}
