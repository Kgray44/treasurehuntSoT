import XCTest
import CoreMotion
@testable import LandfallCompanion

private final class InjectedSextantSource:SextantSensorSource {
    let fidelity="INJECTED"
    var allowed=true,active=Set<String>(),interval=0,stopped=false,emit:((SextantNativeSample)->Void)?
    var unsupported=Set(["sextant.motion.pedometer"])
    func supports(_ id:String)->Bool{!unsupported.contains(id)}
    func permission(_ id:String)->String{allowed ? "NOT_REQUIRED":"DENIED"}
    func configure(_ caps:Set<String>,intervalMs:Int,emit:@escaping(SextantNativeSample)->Void,fail:@escaping(String)->Void)->Bool{active=caps;interval=intervalMs;self.emit=emit;return true}
    func stop(){active.removeAll();stopped=true;emit=nil}
}
final class SextantSensorTests:XCTestCase {
    func testRadioOperationalStateDoesNotInventPermissionOrSuspendForegroundLifecycle() {
        let disabled=SextantHardware.capabilityState("SUPPORTED","GRANTED",true,false,false)
        XCTAssertEqual(disabled["support"] as? String,"SUPPORTED")
        XCTAssertEqual(disabled["permission"] as? String,"GRANTED")
        XCTAssertEqual(disabled["availability"] as? String,"TEMPORARILY_UNAVAILABLE")
        XCTAssertEqual(disabled["lifecycle"] as? String,"FOREGROUND_ONLY")
        XCTAssertEqual(SextantHardware.capabilityState("SUPPORTED","DENIED",true)["availability"] as? String,"TEMPORARILY_UNAVAILABLE")
        XCTAssertEqual(SextantHardware.capabilityState("SUPPORTED","GRANTED",true)["availability"] as? String,"AVAILABLE")
    }
    @MainActor func testEmptyDiscoveryAndLifecycleDoNotCreateFitnessServices() {
        var altimeters=0,pedometers=0
        let source=CoreMotionSextantSource(makeAltimeter:{altimeters+=1;return CMAltimeter()},makePedometer:{pedometers+=1;return CMPedometer()})
        _=source.supports("sextant.pressure.observation")
        _=source.supports("sextant.motion.pedometer")
        _=source.permission("sextant.pressure.observation")
        _=source.permission("sextant.motion.pedometer")
        XCTAssertTrue(source.configure([],intervalMs:250,emit:{_ in XCTFail("Empty discovery emitted a sample")},fail:{_ in XCTFail("Empty discovery started a service")}))
        source.stop();source.stop()
        let sensors=SextantSensors(source:source,now:{1000},emit:{_ in})
        sensors.setConstrained(true);sensors.stopAll("BACKGROUND")
        XCTAssertEqual(altimeters,0,"Discovery or empty-lease cleanup initialized an altimeter")
        XCTAssertEqual(pedometers,0,"Discovery or empty-lease cleanup initialized a pedometer")
    }
    func testConstrainedCadenceIsLowQualityAndUnsupportedBiasStaysUnavailable() {
        let source=InjectedSextantSource();var clock=1000.0,events=[[String:Any]]()
        let sensors=SextantSensors(source:source,now:{clock},emit:{events.append($0)}),cap="sextant.magnetic.field"
        XCTAssertEqual(sensors.start(["leaseId":UUID().uuidString,"capabilities":[cap],"intervalMs":100,"durationMs":60000],foreground:true)["accepted"] as? Bool,true)
        sensors.setConstrained(true);XCTAssertEqual(source.interval,1000)
        func send(){source.emit?(SextantNativeSample(capability:cap,value:["x":20.0,"y":0.0,"z":-45.0],units:"microtesla",frame:"DEVICE",at:clock))}
        send();clock=1200;send();XCTAssertEqual(events.count,1)
        clock=2000;send();XCTAssertEqual(events.count,2)
        let sample=events.last?["sample"] as? [String:Any]
        XCTAssertEqual(sample?["qualityClass"] as? String,"LOW")
        XCTAssertTrue((sample?["warnings"] as? [String])?.contains("POWER_CADENCE_THROTTLED") == true)
        XCTAssertFalse(CoreMotionSextantSource().supports("sextant.magnetic.bias"))
        sensors.stopAll("SLEEP");XCTAssertEqual(sensors.activeLeaseCount,0)
    }
    func testImpossibleStepCadenceCannotBecomeStepEvidence() {
        let source=InjectedSextantSource();source.unsupported=[]
        var clock=1000.0,events=[[String:Any]]()
        let sensors=SextantSensors(source:source,now:{clock},emit:{events.append($0)}),cap="sextant.motion.pedometer"
        XCTAssertEqual(sensors.start(["leaseId":UUID().uuidString,"capabilities":[cap],"intervalMs":100,"durationMs":60000],foreground:true)["accepted"] as? Bool,true)
        func send(_ total:Int){source.emit?(SextantNativeSample(capability:cap,value:["stepDelta":total,"cadenceClass":"UNKNOWN","method":"OS_PEDOMETER"],units:"step-evidence",frame:"DEVICE",at:clock))}
        send(100);clock=1200;send(200);XCTAssertEqual(events.count,1)
        clock=1400;send(201)
        let sample=events.last?["sample"] as? [String:Any],value=sample?["value"] as? [String:Any]
        XCTAssertEqual(value?["stepDelta"] as? Int,0)
        sensors.stopAll("END")
    }
    func testHapticsNeverClaimPhysicalOutputAndRespectLifecycleAndPreferences() {
        let haptics=SextantHaptics(),valid:[String:Any]=["leaseId":UUID().uuidString,"enabled":true,"reducedSensory":false,"pattern":[15]]
        XCTAssertEqual(haptics.execute(valid,foreground:false,critical:false)["accepted"] as? Bool,false)
        XCTAssertEqual(haptics.execute(valid,foreground:true,critical:true)["accepted"] as? Bool,false)
        var disabled=valid;disabled["enabled"]=false
        XCTAssertEqual(haptics.execute(disabled,foreground:true,critical:false)["accepted"] as? Bool,false)
        XCTAssertEqual(haptics.execute(valid,foreground:false,critical:false)["physicalOutputConfirmed"] as? Bool,false)
        haptics.stopAll()
    }
    func testActualCoreMotionDiscoveryDoesNotFabricateSimulatorSupport() {
        let native=CoreMotionSextantSource()
        XCTAssertEqual(native.supports("sextant.motion.acceleration-including-gravity"),CMMotionManager().isAccelerometerAvailable)
        XCTAssertEqual(native.supports("sextant.motion.pedometer"),CMPedometer.isStepCountingAvailable())
        XCTAssertFalse(native.supports("sextant.invented.sensor"));native.stop()
    }
    func testInjectedNativeLeaseSharingMonotonicCadenceAndLifecycleCleanup() {
        let source=InjectedSextantSource();var clock=1000.0,events=[[String:Any]]()
        let sensors=SextantSensors(source:source,now:{clock},emit:{events.append($0)})
        let a=UUID().uuidString,b=UUID().uuidString,cap="sextant.magnetic.field"
        func start(_ id:String,_ interval:Int)->[String:Any]{sensors.start(["leaseId":id,"capabilities":[cap],"intervalMs":interval,"durationMs":60000],foreground:true)}
        XCTAssertTrue(source.active.isEmpty);XCTAssertEqual(start(a,200)["accepted"] as? Bool,true);XCTAssertEqual(start(b,1000)["accepted"] as? Bool,true);XCTAssertEqual(source.interval,200)
        source.emit?(SextantNativeSample(capability:cap,value:["x":20.0,"y":0.0,"z":-45.0],units:"microtesla",frame:"DEVICE",at:clock,calibration:"GOOD"))
        XCTAssertEqual(events.count,2);XCTAssertTrue(events.allSatisfy{$0["fidelity"] as? String == "INJECTED"})
        clock=1200;source.emit?(SextantNativeSample(capability:cap,value:["x":20.0,"y":0.0,"z":-45.0],units:"microtesla",frame:"DEVICE",at:clock));XCTAssertEqual(events.count,3)
        sensors.stop(a);XCTAssertEqual(sensors.activeLeaseCount,1);XCTAssertEqual(source.interval,1000)
        sensors.stopAll("BACKGROUND");XCTAssertEqual(sensors.activeLeaseCount,0);XCTAssertTrue(source.stopped)
        XCTAssertEqual(events.last?["reason"] as? String,"BACKGROUND")
    }
    func testInjectedNativeRejectsStalePermissionAndUnboundedRequests() {
        let source=InjectedSextantSource();var events=[[String:Any]]()
        let sensors=SextantSensors(source:source,now:{10000},emit:{events.append($0)}),id=UUID().uuidString,cap="sextant.magnetic.field"
        let valid:[String:Any]=["leaseId":id,"capabilities":[cap],"intervalMs":100,"durationMs":60000]
        XCTAssertEqual(sensors.start(valid,foreground:false)["accepted"] as? Bool,false)
        var bad=valid;bad["intervalMs"]=1;XCTAssertEqual(sensors.start(bad,foreground:true)["accepted"] as? Bool,false)
        XCTAssertEqual(sensors.start(valid,foreground:true)["accepted"] as? Bool,true)
        source.emit?(SextantNativeSample(capability:cap,value:["x":20.0,"y":0.0,"z":-45.0],units:"microtesla",frame:"DEVICE",at:8000));XCTAssertTrue(events.isEmpty)
        source.allowed=false;source.emit?(SextantNativeSample(capability:cap,value:["x":20.0,"y":0.0,"z":-45.0],units:"microtesla",frame:"DEVICE",at:10000))
        XCTAssertEqual(events.last?["reason"] as? String,"PERMISSION");XCTAssertEqual(sensors.activeLeaseCount,0)
    }
    func testFrameTransformAndRelativeAttitudeUseCanonicalQuaternion() {
        let acceleration=CoreMotionSextantSource.canonicalAcceleration(CMAcceleration(x:-1/9.80665,y:-2/9.80665,z:-3/9.80665))
        XCTAssertEqual(acceleration["x"] ?? 0,1,accuracy:0.000001);XCTAssertEqual(acceleration["y"] ?? 0,2,accuracy:0.000001);XCTAssertEqual(acceleration["z"] ?? 0,3,accuracy:0.000001)
        let q=CMQuaternion(x:0,y:0,z:0,w:1),local=CoreMotionSextantSource.canonicalAttitude(q,magnetic:false),earth=CoreMotionSextantSource.canonicalAttitude(q,magnetic:true)
        XCTAssertEqual(local["w"],1);XCTAssertEqual(earth["z"] ?? 0,sqrt(0.5),accuracy:0.000001)
        let relative=SextantSensors.relativeAttitude(earth,earth)
        XCTAssertEqual(relative?["w"] ?? 0,1,accuracy:0.000001);XCTAssertEqual(relative?["z"] ?? 1,0,accuracy:0.000001)
    }
}
