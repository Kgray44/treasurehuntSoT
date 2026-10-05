import Foundation
import CoreLocation

/** Retains at most one transient latest fix; throttling must not lose a final update. */
final class LandfallLocationThrottle {
    private let monotonicMs: () -> Double
    private let wallMs: () -> Double
    private let intervalMs: () -> Double
    private let schedule: (Double, @escaping () -> Void) -> (() -> Void)
    private let deliver: (CLLocation) -> Void
    private var pending: CLLocation?
    private var lastAcceptedTimestamp = 0.0
    private var lastDeliveryAt: Double?
    private var cancel: (() -> Void)?
    private var generation = 0
    private var active = false

    init(intervalMs: @escaping () -> Double,
         monotonicMs: @escaping () -> Double = { ProcessInfo.processInfo.systemUptime * 1000 },
         wallMs: @escaping () -> Double = { Date().timeIntervalSince1970 * 1000 },
         schedule: @escaping (Double, @escaping () -> Void) -> (() -> Void) = { delay, action in
             let work = DispatchWorkItem(block: action)
             DispatchQueue.main.asyncAfter(deadline: .now() + delay / 1000, execute: work)
             return { work.cancel() }
         }, deliver: @escaping (CLLocation) -> Void) {
        self.intervalMs=intervalMs; self.monotonicMs=monotonicMs; self.wallMs=wallMs
        self.schedule=schedule; self.deliver=deliver
    }
    func start() { stop(); active=true }
    func stop() {
        generation += 1; active=false; cancel?(); cancel=nil; pending=nil
        lastAcceptedTimestamp=0; lastDeliveryAt=nil
    }
    private func fresh(_ sample: CLLocation) -> Bool {
        let timestamp=sample.timestamp.timeIntervalSince1970 * 1000, now=wallMs()
        return timestamp.isFinite && timestamp >= 0 && timestamp <= now + 1000 && now - timestamp <= 30000
    }
    func receive(_ sample: CLLocation) {
        let timestamp=sample.timestamp.timeIntervalSince1970 * 1000
        guard active, sample.horizontalAccuracy.isFinite, sample.horizontalAccuracy > 0,
              CLLocationCoordinate2DIsValid(sample.coordinate), fresh(sample), timestamp > lastAcceptedTimestamp else { return }
        lastAcceptedTimestamp=timestamp; pending=sample; drain()
    }
    private func drain() {
        guard active, let sample=pending else { return }
        cancel?(); cancel=nil
        let now=monotonicMs(), delay=lastDeliveryAt.map { max(0, intervalMs() - (now - $0)) } ?? 0
        if delay > 0 {
            let current=generation
            cancel=schedule(delay) { [weak self] in
                guard let self=self, self.active, self.generation == current else { return }
                self.cancel=nil; self.drain()
            }
            return
        }
        pending=nil
        guard fresh(sample) else { return }
        lastDeliveryAt=now; deliver(sample)
    }
}
