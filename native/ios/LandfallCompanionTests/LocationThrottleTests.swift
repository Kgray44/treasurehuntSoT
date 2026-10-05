import XCTest
import CoreLocation
@testable import LandfallCompanion

final class LocationThrottleTests: XCTestCase {
    private func sample(_ timestamp: Double, _ latitude: Double = 44, accuracy: Double = 5) -> CLLocation {
        CLLocation(coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: -72), altitude: 0,
                   horizontalAccuracy: accuracy, verticalAccuracy: -1, timestamp: Date(timeIntervalSince1970: timestamp / 1000))
    }
    func testFinalFixIsCoalescedWithoutAnotherNativeCallback() {
        var time=0.0, tasks:[() -> Void]=[], fixes:[CLLocation]=[]
        let throttle=LandfallLocationThrottle(intervalMs:{1000}, monotonicMs:{time}, wallMs:{100000+time},
            schedule:{ _, action in var cancelled=false; tasks.append { if !cancelled { action() } }; return { cancelled=true } }, deliver:{fixes.append($0)})
        throttle.start(); throttle.receive(sample(100000,44))
        time=100; throttle.receive(sample(100100,44.001))
        time=250; throttle.receive(sample(100250,44.002))
        XCTAssertEqual(fixes.count,1)
        time=1000; tasks.forEach {$0()}
        XCTAssertEqual(fixes.count,2); XCTAssertEqual(fixes.last?.coordinate.latitude,44.002)
        XCTAssertEqual(fixes.last?.timestamp.timeIntervalSince1970,100.25)
    }
    func testStopAndRestartCannotDeliverThePreviousPendingFix() {
        var time=0.0, tasks:[() -> Void]=[], fixes:[CLLocation]=[]
        let throttle=LandfallLocationThrottle(intervalMs:{1000}, monotonicMs:{time}, wallMs:{100000+time},
            schedule:{ _, action in tasks.append(action); return {} }, deliver:{fixes.append($0)})
        throttle.start(); throttle.receive(sample(100000))
        time=100; throttle.receive(sample(100100,44.001)); throttle.stop(); throttle.start()
        time=1000; tasks.forEach {$0()}; XCTAssertEqual(fixes.count,1)
        throttle.receive(sample(101000,44.002)); XCTAssertEqual(fixes.count,2)
    }
    func testStaleFutureInvalidAndOutOfOrderFixesCannotReplaceFreshPendingFix() {
        var time=0.0, tasks:[() -> Void]=[], fixes:[CLLocation]=[]
        let throttle=LandfallLocationThrottle(intervalMs:{1000}, monotonicMs:{time}, wallMs:{100000+time},
            schedule:{ _, action in tasks.append(action); return {} }, deliver:{fixes.append($0)})
        throttle.start(); throttle.receive(sample(69999)); throttle.receive(sample(101001))
        throttle.receive(sample(100000,accuracy:-1)); throttle.receive(sample(100000,91))
        XCTAssertTrue(fixes.isEmpty)
        throttle.receive(sample(100000)); time=100; throttle.receive(sample(100100,44.001))
        throttle.receive(sample(100050,44.002)); time=1000; tasks.forEach {$0()}
        XCTAssertEqual(fixes.count,2); XCTAssertEqual(fixes.last?.coordinate.latitude,44.001)
    }
    func testQueuedFixExpiresAndPowerIntervalIsRecheckedBeforeDelivery() {
        var time=0.0, interval=1000.0, tasks:[() -> Void]=[], fixes:[CLLocation]=[]
        let throttle=LandfallLocationThrottle(intervalMs:{interval}, monotonicMs:{time}, wallMs:{100000+time},
            schedule:{ _, action in tasks.append(action); return {} }, deliver:{fixes.append($0)})
        throttle.start(); throttle.receive(sample(100000)); time=100; throttle.receive(sample(100100,44.001))
        interval=60000; time=1000; tasks[0](); XCTAssertEqual(fixes.count,1)
        time=60000; tasks.last?(); XCTAssertEqual(fixes.count,1)
    }
}
