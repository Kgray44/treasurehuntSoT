import XCTest
import CoreLocation
@testable import LandfallCompanion

private final class InjectedPositionSource:SextantPositionSource {
    let fidelity="INJECTED",supported=true
    var permission="GRANTED",active=false,interval=0
    func configure(intervalMs:Int,precise:Bool)->Bool{active=true;interval=intervalMs;return true}
    func stop(){active=false}
}
final class SextantPositionTests:XCTestCase {
    func testSharedPositionLeaseScopedCleanupAndClockGeneration() {
        let source=InjectedPositionSource();var now=1000.0,events=[[String:Any]]()
        let owner=SextantPosition(source:source,now:{now},emit:{events.append($0)})
        let a=UUID().uuidString,b=UUID().uuidString
        func start(_ id:String)->[String:Any]{owner.start(["leaseId":id,"capabilities":[SextantPosition.capability],"intervalMs":200,"durationMs":60000],foreground:true)}
        XCTAssertFalse(source.active);XCTAssertEqual(start(a)["accepted"] as? Bool,true);XCTAssertEqual(start(b)["accepted"] as? Bool,true)
        XCTAssertEqual(source.interval,1000);XCTAssertTrue(owner.startLegacy(interval:5000,precise:true))
        owner.accept(SextantPositionFix(latitude:1,longitude:2,accuracy:5,capturedAt:now,captureAge:0));XCTAssertEqual(events.count,2)
        XCTAssertTrue(events.allSatisfy{$0["fidelity"] as? String == "INJECTED"})
        owner.stop(a);XCTAssertTrue(source.active);owner.stop(b);XCTAssertTrue(source.active)
        owner.stopLegacy();XCTAssertFalse(source.active)
        XCTAssertEqual(start(b)["accepted"] as? Bool,true)
        XCTAssertTrue(owner.startLegacy(interval:5000,precise:true))
        source.permission="APPROXIMATE";owner.authorizationChanged()
        XCTAssertEqual(owner.activeLeaseCount,0);XCTAssertTrue(source.active)
        XCTAssertEqual(events.last?["reason"] as? String,"PERMISSION")
        owner.stopLegacy();events.removeLast();source.permission="GRANTED"
        now=2000;XCTAssertEqual(start(a)["accepted"] as? Bool,true)
        owner.accept(SextantPositionFix(latitude:1,longitude:2,accuracy:5,capturedAt:1900,captureAge:100));XCTAssertEqual(events.count,2)
        owner.stopAll("BACKGROUND");XCTAssertFalse(source.active);XCTAssertEqual(owner.activeLeaseCount,0)
    }
    func testCaptureUncertaintyPermissionAndPowerRemainTruthful() {
        let source=InjectedPositionSource();var now=1000.0,events=[[String:Any]]()
        let owner=SextantPosition(source:source,now:{now},emit:{events.append($0)}),id=UUID().uuidString
        let request:[String:Any]=["leaseId":id,"capabilities":[SextantPosition.capability],"intervalMs":1000,"durationMs":60000]
        XCTAssertEqual(owner.start(request,foreground:false)["accepted"] as? Bool,false)
        XCTAssertEqual(owner.start(request,foreground:true)["accepted"] as? Bool,true)
        owner.accept(SextantPositionFix(latitude:1,longitude:2,accuracy:5,capturedAt:now,captureAge:0,captureUncertain:true))
        XCTAssertEqual((events.last?["sample"] as? [String:Any])?["qualityClass"] as? String,"LOW")
        owner.setConstrained(true);XCTAssertEqual(source.interval,15000)
        now=2000;owner.accept(SextantPositionFix(latitude:1,longitude:2,accuracy:5,capturedAt:now,captureAge:0));XCTAssertEqual(events.count,1)
        source.permission="DENIED";owner.accept(SextantPositionFix(latitude:1,longitude:2,accuracy:5,capturedAt:now,captureAge:0))
        XCTAssertEqual(events.last?["reason"] as? String,"PERMISSION");XCTAssertFalse(source.active)
        let actual=CoreLocationSextantSource(CLLocationManager())
        XCTAssertEqual(actual.enabled,CLLocationManager.locationServicesEnabled());actual.stop()
    }
}
