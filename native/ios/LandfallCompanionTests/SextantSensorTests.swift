import XCTest
import CoreMotion
@testable import LandfallCompanion

private final class InjectedSextantSource:SextantSensorSource {
    let fidelity="INJECTED"
    var allowed=true,active=Set<String>(),interval=0,stopped=false,emit:((SextantNativeSample)->Void)?
    func supports(_ id:String)->Bool{id != "sextant.motion.pedometer"}
    func permission(_ id:String)->String{allowed ? "NOT_REQUIRED":"DENIED"}
    func configure(_ caps:Set<String>,intervalMs:Int,emit:@escaping(SextantNativeSample)->Void,fail:@escaping(String)->Void)->Bool{active=caps;interval=intervalMs;self.emit=emit;return true}
    func stop(){active.removeAll();stopped=true;emit=nil}
}
final class SextantSensorTests:XCTestCase {
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
        let q=CMQuaternion(x:0,y:0,z:0,w:1),local=CoreMotionSextantSource.canonicalAttitude(q,magnetic:false),earth=CoreMotionSextantSource.canonicalAttitude(q,magnetic:true)
        XCTAssertEqual(local["w"],1);XCTAssertEqual(earth["z"] ?? 0,sqrt(0.5),accuracy:0.000001)
        let relative=SextantSensors.relativeAttitude(earth,earth)
        XCTAssertEqual(relative?["w"] ?? 0,1,accuracy:0.000001);XCTAssertEqual(relative?["z"] ?? 1,0,accuracy:0.000001)
    }
}
