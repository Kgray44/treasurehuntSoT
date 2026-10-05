import Foundation
import UIKit

/** Read OS state without predicting physical endurance or bypassing platform policy. */
final class LandfallPower {
    var thermalPressure: Bool { ProcessInfo.processInfo.thermalState == .serious || ProcessInfo.processInfo.thermalState == .critical }
    var critical: Bool { ProcessInfo.processInfo.thermalState == .critical }
    var lowPower: Bool { ProcessInfo.processInfo.isLowPowerModeEnabled || (UIDevice.current.batteryLevel >= 0 && UIDevice.current.batteryLevel <= 0.15) }
    var constrained: Bool { lowPower || thermalPressure }
    func interval(_ requested: Int) -> Int { constrained ? max(15000, requested) : requested }
    func snapshot() -> [String: Any] { ["state": "READY", "lowPower": lowPower, "thermalPressure": thermalPressure, "critical": critical, "observedAt": Int(Date().timeIntervalSince1970 * 1000)] }
}
