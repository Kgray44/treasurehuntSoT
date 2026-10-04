import XCTest
import Foundation

final class NativeLifecycleTests: XCTestCase {
    @MainActor private func observedBackground(_ app: XCUIApplication) -> Bool {
        let eitherState=NSPredicate { _, _ in app.state == .runningBackground || app.state == .runningBackgroundSuspended }
        return XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:eitherState,object:app)],timeout:15) == .completed
    }
    @MainActor func testUnconfiguredShellReturnsFromHome() throws {
        let app = XCUIApplication()
        app.launch()
        let shell = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "Landfall companion is not configured")).firstMatch
        XCTAssertTrue(shell.waitForExistence(timeout: 10), "LANDFALL_INITIAL_SHELL_UNAVAILABLE")
        XCUIDevice.shared.press(.home)
        XCTAssertTrue(observedBackground(app), "LANDFALL_HOME_BACKGROUND_UNOBSERVED")
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10), "LANDFALL_FOREGROUND_RETURN_UNOBSERVED")
        XCTAssertTrue(shell.waitForExistence(timeout: 10), "LANDFALL_RETURNED_SHELL_UNAVAILABLE")
        app.terminate()
        XCTAssertTrue(app.wait(for: .notRunning, timeout: 10), "LANDFALL_TERMINATION_UNOBSERVED")
    }

    /** Translates only canonical lifecycle actions from the owned loopback lab. */
    @MainActor func testCanonicalScenarioOperations() async throws {
        guard let raw = ProcessInfo.processInfo.environment["LANDFALL_LAB_ORIGIN"],
              let origin = URL(string: raw), origin.scheme == "http", origin.host == "127.0.0.1", origin.port != nil,
              origin.user == nil, origin.password == nil, origin.path.isEmpty, origin.query == nil, origin.fragment == nil
        else { throw XCTSkip("Canonical lab endpoint is not configured for this build test.") }
        let app = XCUIApplication()
        app.launchArguments = ["--landfall-lab-origin=\(raw)"]
        app.launch()
        try await post(origin, "/lab/os/ready", [:])
        let deadline = Date().addingTimeInterval(2100)
        while Date() < deadline {
            let url = URL(string: "/lab/os/next", relativeTo: origin)!
            let (data, response) = try await URLSession.shared.data(from: url)
            if (response as? HTTPURLResponse)?.statusCode == 204 { try await Task.sleep(nanoseconds: 100_000_000); continue }
            let message = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
            if message["stop"] as? Bool == true { app.terminate(); return }
            guard let index = message["index"] as? Int, let action = message["action"] as? [String: Any],
                  action["type"] as? String == "LIFECYCLE", let state = action["state"] as? String else { throw NSError(domain: "LandfallLab", code: 1) }
            var result = "PASS"
            if state == "FOREGROUND" { app.activate(); if !app.wait(for: .runningForeground, timeout: 10) { result="FAIL" } }
            else if state == "BACKGROUND" { XCUIDevice.shared.press(.home); if !observedBackground(app) { result="FAIL" } }
            else if state == "TERMINATED" { app.terminate(); if !app.wait(for: .notRunning, timeout: 10) { result="FAIL" } }
            else if state == "RELAUNCH" { app.terminate(); app.launch(); if !app.wait(for: .runningForeground, timeout: 10) { result="FAIL" } }
            else { result="UNSUPPORTED" }
            try await post(origin, "/lab/os/result", ["index":index, "state":result])
        }
        XCTFail("Canonical native lifecycle lab exceeded its bounded deadline.")
    }
    private func post(_ origin: URL, _ route: String, _ body: [String: Any]) async throws {
        var request = URLRequest(url: URL(string: route, relativeTo: origin)!)
        request.httpMethod="POST"; request.httpBody=try JSONSerialization.data(withJSONObject: body)
        let (_, response)=try await URLSession.shared.data(for:request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw NSError(domain:"LandfallLab",code:2) }
    }
}
