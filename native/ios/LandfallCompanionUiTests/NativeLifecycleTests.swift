import XCTest
import Foundation
import UIKit

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

    @MainActor func testOwnedSimulatorLargeTextAndOrientation() throws {
        guard ProcessInfo.processInfo.environment["LANDFALL_LAB_PRESENTATION"] == "1" else {throw XCTSkip("Owned presentation environment is not configured.")}
        let app=XCUIApplication();app.launch()
        defer {XCUIDevice.shared.orientation = .portrait;app.terminate()}
        let shell=app.staticTexts.containing(NSPredicate(format:"label CONTAINS %@","Landfall companion is not configured")).firstMatch
        for orientation in [UIDeviceOrientation.portrait,.landscapeLeft] {
            XCUIDevice.shared.orientation=orientation
            let landscape=orientation == .landscapeLeft
            let geometry=NSPredicate {_,_ in let frame=app.windows.firstMatch.frame;return frame.width > 0 && (landscape ? frame.width > frame.height : frame.height > frame.width)}
            XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:geometry,object:app)],timeout:10),.completed,"LANDFALL_ORIENTATION_UNOBSERVED")
            XCTAssertTrue(shell.waitForExistence(timeout:10) && shell.isHittable,"LANDFALL_LARGE_TEXT_FALLBACK_UNREADABLE")
            let attachment=XCTAttachment(screenshot:app.screenshot());attachment.name=landscape ? "Owned large-text landscape fallback" : "Owned large-text portrait fallback";attachment.lifetime = .keepAlways;add(attachment)
        }
    }

    @MainActor func testOwnedSimulatorReducedMotionSetting() throws {
        guard ProcessInfo.processInfo.environment["LANDFALL_LAB_PRESENTATION"] == "1" else {throw XCTSkip("Owned presentation environment is not configured.")}
        let settings=XCUIApplication(bundleIdentifier:"com.apple.Preferences");settings.launch()
        defer {settings.terminate()}
        let accessibility=settings.staticTexts["Accessibility"]
        for _ in 0..<5 {if accessibility.exists && accessibility.isHittable {break};settings.swipeUp()}
        XCTAssertTrue(accessibility.waitForExistence(timeout:10) && accessibility.isHittable,"LANDFALL_SETTINGS_ACCESSIBILITY_UNAVAILABLE");accessibility.tap()
        let motion=settings.staticTexts["Motion"]
        for _ in 0..<5 {if motion.exists && motion.isHittable {break};settings.swipeUp()}
        guard motion.waitForExistence(timeout:10) && motion.isHittable else {XCTFail("LANDFALL_SETTINGS_MOTION_UNAVAILABLE");return}
        // The recorded Settings hierarchy exposes an actual MOTION_TITLE
        // button nested in its row. This check runs at normal Settings text
        // size; the separate XXXL test retains its own portrait/landscape proof.
        let motionButtons=settings.buttons.matching(identifier:"MOTION_TITLE")
        guard motionButtons.count == 1,motionButtons.firstMatch.isHittable else {XCTFail("LANDFALL_MOTION_BUTTON_UNAVAILABLE");return}
        motionButtons.firstMatch.tap()
        let motionPage=settings.navigationBars["Motion"]
        if !motionPage.waitForExistence(timeout:5) {
            // If the observed public button did not open its destination,
            // Use Settings' own public search UI as a separate real route.
            let back=settings.navigationBars["Accessibility"].buttons["Settings"]
            guard back.exists && back.isHittable else {XCTFail("LANDFALL_SETTINGS_SEARCH_RETURN_UNAVAILABLE");return}
            back.tap()
            guard settings.navigationBars["Settings"].waitForExistence(timeout:10) else {XCTFail("LANDFALL_SETTINGS_HOME_UNOBSERVED");return}
            let search=settings.searchFields.firstMatch
            guard search.waitForExistence(timeout:10) && search.isHittable else {XCTFail("LANDFALL_SETTINGS_SEARCH_UNAVAILABLE");return}
            search.tap();search.typeText("Reduce Motion")
            let result=settings.staticTexts.matching(identifier:"Reduce Motion")
            guard result.firstMatch.waitForExistence(timeout:15),result.count == 1,result.firstMatch.isHittable else {XCTFail("LANDFALL_REDUCED_MOTION_SEARCH_UNAVAILABLE");return}
            let found=XCTAttachment(screenshot:settings.screenshot());found.name="Owned Settings Reduce Motion search result";found.lifetime = .keepAlways;add(found)
            result.firstMatch.tap()
        }
        guard motionPage.waitForExistence(timeout:10) else {XCTFail("LANDFALL_MOTION_PAGE_UNOBSERVED");return}
        let before=XCTAttachment(screenshot:settings.screenshot());before.name="Owned Motion settings before selection";before.lifetime = .keepAlways;add(before)
        let labelled=settings.switches.matching(NSPredicate(format:"label CONTAINS %@","Reduce Motion"))
        let row=settings.cells.containing(.staticText,identifier:"Reduce Motion").firstMatch
        var selected:XCUIElement?
        for _ in 0..<5 {
            if labelled.count == 1 && labelled.firstMatch.isHittable {selected=labelled.firstMatch;break}
            if row.exists && row.switches.count == 1 && row.switches.firstMatch.isHittable {selected=row.switches.firstMatch;break}
            settings.swipeUp()
        }
        guard let toggle=selected else {XCTFail("LANDFALL_REDUCED_MOTION_UNAVAILABLE");return}
        let wasEnabled=toggle.value as? String == "1"
        if !wasEnabled {toggle.tap()}
        XCTAssertEqual(toggle.value as? String,"1","LANDFALL_REDUCED_MOTION_NOT_ENABLED")
        let app=XCUIApplication();app.launch()
        let shell=app.staticTexts.containing(NSPredicate(format:"label CONTAINS %@","Landfall companion is not configured")).firstMatch
        XCTAssertTrue(shell.waitForExistence(timeout:10) && shell.isHittable,"LANDFALL_REDUCED_MOTION_FALLBACK_UNREADABLE")
        let attachment=XCTAttachment(screenshot:app.screenshot());attachment.name="Owned reduced-motion fallback";attachment.lifetime = .keepAlways;add(attachment);app.terminate()
        settings.activate()
        if !wasEnabled && toggle.waitForExistence(timeout:10) && toggle.value as? String == "1" {toggle.tap()}
        XCTAssertEqual(toggle.value as? String,wasEnabled ? "1" : "0","LANDFALL_REDUCED_MOTION_NOT_RESTORED")
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
                  let type=action["type"] as? String, ["LIFECYCLE","NOTIFICATION"].contains(type) else { throw NSError(domain: "LandfallLab", code: 1) }
            if type == "NOTIFICATION" {
                let springboard=XCUIApplication(bundleIdentifier:"com.apple.springboard")
                var result="FAIL"
                var noticeDiagnostic:[String:Any]=[:]
                if action["operation"] as? String == "DELIVER" {
                    let denied=action["permissionDecision"] as? String == "DENIED"
                    let decision=denied ? springboard.alerts.buttons.matching(NSPredicate(format:"label == %@ OR label == %@","Don't Allow","Don’t Allow")) : springboard.alerts.buttons.matching(identifier:"Allow")
                    if decision.firstMatch.waitForExistence(timeout:20),decision.count == 1 {decision.firstMatch.tap();result="PASS"}
                } else if action["operation"] as? String == "OPEN" {
                    // Open Notification Center and tap only the one observed generic
                    // Landfall notice. Never activate a PendingIntent/delegate directly.
                    springboard.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.005)).press(forDuration:0.1,thenDragTo:springboard.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.8)))
                    let title="Your journey may be nearby"
                    let buttons=springboard.buttons.matching(NSPredicate(format:"label CONTAINS %@",title))
                    let openButtons=springboard.buttons.matching(NSPredicate(format:"label CONTAINS %@ AND NOT (label CONTAINS[c] %@) AND NOT (label CONTAINS[c] %@)",title,"Clear","Dismiss"))
                    let cards=springboard.otherElements.matching(NSPredicate(format:"label CONTAINS %@ AND label CONTAINS %@",title,"No visit has been confirmed."))
                    let text=springboard.staticTexts.matching(NSPredicate(format:"label == %@",title))
                    // SpringBoard can expose a notice as one combined accessible
                    // card/button rather than a separate title static text.
                    var notice:XCUIElement?
                    if openButtons.firstMatch.waitForExistence(timeout:5),openButtons.count == 1 {notice=openButtons.firstMatch}
                    else if cards.firstMatch.waitForExistence(timeout:5),cards.count == 1 {notice=cards.firstMatch}
                    else if text.firstMatch.waitForExistence(timeout:5),text.count == 1 {notice=text.firstMatch}
                    var tapped=false,foregroundObserved=false
                    var tapAttempts=0
                    if let notice=notice,notice.isHittable {
                        notice.tap();tapped=true;tapAttempts=1
                        // A collapsed notification can consume the first tap to
                        // expand. A second real tap is allowed only while the
                        // same unique public notice is still visible/hittable.
                        if !app.wait(for:.runningForeground,timeout:5),openButtons.count == 1,openButtons.firstMatch.isHittable {openButtons.firstMatch.tap();tapAttempts=2}
                        foregroundObserved=app.wait(for:.runningForeground,timeout:15)
                        if foregroundObserved {result="PASS"}
                    }
                    noticeDiagnostic=["buttonTitleCount":min(buttons.count,64),"openButtonCount":min(openButtons.count,64),"tapAttempts":tapAttempts,"combinedCardCount":min(cards.count,64),"staticTitleCount":min(text.count,64),"tapped":tapped,"foregroundObserved":foregroundObserved]
                }
                try await post(origin,"/lab/os/result",["index":index,"state":result,"noticeUi":noticeDiagnostic])
                continue
            }
            guard let state=action["state"] as? String else {throw NSError(domain:"LandfallLab",code:3)}
            var result = "PASS"
            if state == "FOREGROUND" { app.activate(); if !app.wait(for: .runningForeground, timeout: 10) { result="FAIL" } }
            else if state == "BACKGROUND" { XCUIDevice.shared.press(.home); if !observedBackground(app) { result="FAIL" } }
            else if state == "TERMINATED" { app.terminate(); if !app.wait(for: .notRunning, timeout: 10) { result="FAIL" } }
            else if state == "RELAUNCH" { if !app.wait(for: .runningForeground, timeout: 10) { result="FAIL" } }
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
