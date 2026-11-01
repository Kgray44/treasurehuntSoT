import XCTest
import Foundation
import UIKit

final class NativeLifecycleTests: XCTestCase {
    @MainActor private func revealLensTarget(_ target:XCUIElement,in app:XCUIApplication) -> Bool {
        // Reuse the original ten-second target window while the native overlay
        // releases the actual WebView. An existing but covered label is not ready.
        let ready=NSPredicate {_,_ in
            target.exists && (target.isHittable || (app.webViews.count == 1 && app.webViews.firstMatch.isHittable))
        }
        guard XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:ready,object:app)],timeout:10) == .completed else {
            print("NCL01_LENS_TARGET_READINESS: targetExists=\(target.exists) targetHittable=\(target.isHittable) webViewCount=\(app.webViews.count) webViewHittable=\(app.webViews.count == 1 && app.webViews.firstMatch.isHittable)")
            return false
        }
        // The real dialog footer may be below the phone viewport. Scroll only
        // toward this exact observed target, with one original three-swipe cap.
        for index in 0...3 {
            if target.isHittable {return true}
            guard index < 3,app.webViews.count == 1,app.webViews.firstMatch.isHittable else {return false}
            let web=app.webViews.firstMatch
            if !target.frame.isEmpty,target.frame.maxY <= web.frame.minY {web.swipeDown()} else {web.swipeUp()}
        }
        return false
    }
    @MainActor private func keepNoticeUi(_ springboard:XCUIApplication,_ name:String) {
        let screenshot=XCTAttachment(screenshot:springboard.screenshot());screenshot.name=name;screenshot.lifetime = .keepAlways;add(screenshot)
        let hierarchy=XCTAttachment(string:springboard.debugDescription);hierarchy.name=name+" hierarchy";hierarchy.lifetime = .keepAlways;add(hierarchy)
    }
    @MainActor private func observedBackground(_ app: XCUIApplication) -> Bool {
        let started=ProcessInfo.processInfo.systemUptime
        var states:[[String:Any]]=[];var previous:Int?
        let eitherState=NSPredicate { _, _ in
            let state=Int(app.state.rawValue)
            if state != previous {states.append(["state":state,"elapsedMs":Int((ProcessInfo.processInfo.systemUptime-started)*1000)]);previous=state}
            return app.state == .runningBackground || app.state == .runningBackgroundSuspended
        }
        let observed=XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:eitherState,object:app)],timeout:15) == .completed
        if let bytes=try? JSONSerialization.data(withJSONObject:["observedBackground":observed,"states":states,"finalState":app.state.rawValue],options:[.sortedKeys]) {
            let attachment=XCTAttachment(data:bytes,uniformTypeIdentifier:"public.json");attachment.name="Owned Home background state observations";attachment.lifetime = .keepAlways;add(attachment)
        }
        return observed
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
            // Window geometry changes before the rotation animation and text
            // layout settle. Require stable actual horizontal text bounds.
            var previous=CGRect.zero,stableSince=Date(),settled=false
            let settleDeadline=Date().addingTimeInterval(10)
            while Date() < settleDeadline {
                let frame=shell.frame,window=app.windows.firstMatch.frame
                if frame != previous {previous=frame;stableSince=Date()}
                if frame.width > 0,frame.minX >= window.minX-1,frame.maxX <= window.maxX+1,Date().timeIntervalSince(stableSince) >= 2 {settled=true;break}
                RunLoop.current.run(until:Date().addingTimeInterval(0.1))
            }
            XCTAssertTrue(settled,"LANDFALL_ROTATED_TEXT_LAYOUT_UNSETTLED")
            let attachment=XCTAttachment(screenshot:app.screenshot());attachment.name=landscape ? "Owned large-text landscape fallback" : "Owned large-text portrait fallback";attachment.lifetime = .keepAlways;add(attachment)
            let screen=XCUIScreen.main.screenshot()
            let full=XCTAttachment(screenshot:screen);full.name=landscape ? "Owned device landscape screen" : "Owned device portrait screen";full.lifetime = .keepAlways;add(full)
            let bounds:[String:Any]=["landscape":landscape,"orientation":XCUIDevice.shared.orientation.rawValue,"window":["x":app.windows.firstMatch.frame.minX,"y":app.windows.firstMatch.frame.minY,"width":app.windows.firstMatch.frame.width,"height":app.windows.firstMatch.frame.height],"text":["x":shell.frame.minX,"y":shell.frame.minY,"width":shell.frame.width,"height":shell.frame.height],"deviceImage":["width":screen.image.size.width,"height":screen.image.size.height,"orientation":screen.image.imageOrientation.rawValue]]
            let geometryAttachment=XCTAttachment(data:try JSONSerialization.data(withJSONObject:bounds),uniformTypeIdentifier:"public.json");geometryAttachment.name=landscape ? "Owned landscape actual bounds" : "Owned portrait actual bounds";geometryAttachment.lifetime = .keepAlways;add(geometryAttachment)
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
        // Settings exposes the entire labelled row as a Switch. The recorded
        // center tap landed in its blank middle; target its trailing control.
        if !wasEnabled {toggle.coordinate(withNormalizedOffset:CGVector(dx:0.9,dy:0.5)).tap()}
        let enabled=NSPredicate {_,_ in toggle.value as? String == "1"}
        guard XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:enabled,object:toggle)],timeout:10) == .completed else {XCTFail("LANDFALL_REDUCED_MOTION_NOT_ENABLED");return}
        // Use the ordinary Home-screen entry after changing the real system
        // setting. The retained direct Settings-to-app launch showed no Window;
        // this is one explicit foreground path, never a relaunch after failure.
        XCUIDevice.shared.press(.home)
        let app=XCUIApplication();app.launch()
        let shell=app.staticTexts.containing(NSPredicate(format:"label CONTAINS %@","Landfall companion is not configured")).firstMatch
        let readable=NSPredicate {_,_ in app.state == .runningForeground && shell.exists && shell.isHittable}
        let observed=XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:readable,object:app)],timeout:10) == .completed
        let state=XCTAttachment(data:try JSONSerialization.data(withJSONObject:["foregroundObserved":app.state == .runningForeground,"windowCount":app.windows.count,"readableFallback":observed]),uniformTypeIdentifier:"public.json")
        state.name="Owned reduced-motion foreground presentation";state.lifetime = .keepAlways;add(state)
        let hierarchy=XCTAttachment(string:app.debugDescription);hierarchy.name="Owned reduced-motion actual hierarchy";hierarchy.lifetime = .keepAlways;add(hierarchy)
        XCTAssertTrue(observed,"LANDFALL_REDUCED_MOTION_FALLBACK_UNREADABLE")
        let attachment=XCTAttachment(screenshot:app.screenshot());attachment.name="Owned reduced-motion fallback";attachment.lifetime = .keepAlways;add(attachment);app.terminate()
        settings.activate()
        if !wasEnabled && toggle.waitForExistence(timeout:10) && toggle.value as? String == "1" {toggle.coordinate(withNormalizedOffset:CGVector(dx:0.9,dy:0.5)).tap()}
        let restored=NSPredicate {_,_ in toggle.value as? String == (wasEnabled ? "1" : "0")}
        XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:restored,object:toggle)],timeout:10),.completed,"LANDFALL_REDUCED_MOTION_NOT_RESTORED")
    }

    /** Translates bounded OS/UI actions from the existing owned loopback lab. */
    @MainActor func testCanonicalScenarioOperations() async throws {
        guard let raw = ProcessInfo.processInfo.environment["LANDFALL_LAB_ORIGIN"],
              let origin = URL(string: raw), origin.scheme == "http", origin.host == "127.0.0.1", origin.port != nil,
              origin.user == nil, origin.password == nil, origin.path.isEmpty, origin.query == nil, origin.fragment == nil
        else { throw XCTSkip("Canonical lab endpoint is not configured for this build test.") }
        let app = XCUIApplication()
        app.launchArguments = ["--landfall-lab-origin=\(raw)"]
        let cameraFree=ProcessInfo.processInfo.environment["LANDFALL_LAB_CAMERA_FREE"] == "1"
        if cameraFree {app.launchArguments.append("--landfall-lab-camera-free")}
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
                  let type=action["type"] as? String, ["LIFECYCLE","NOTIFICATION","LENS_UI"].contains(type) else { throw NSError(domain: "LandfallLab", code: 1) }
            if type == "LENS_UI" {
                guard cameraFree,let operation=action["operation"] as? String,["OPEN","TAP","INSPECT","RETURN","CLOSE"].contains(operation) else {throw NSError(domain:"LandfallLab",code:4)}
                var result="FAIL"
                if operation == "OPEN" {
                    let button=app.buttons.matching(identifier:"Open camera-free Lens")
                    if button.firstMatch.waitForExistence(timeout:10),button.count == 1,button.firstMatch.isHittable {
                        button.firstMatch.tap()
                        let start=app.buttons.matching(identifier:"Open camera-free Device Lab")
                        if start.firstMatch.waitForExistence(timeout:10),start.count == 1,revealLensTarget(start.firstMatch,in:app),start.firstMatch.isEnabled {start.firstMatch.tap();result="PASS"}
                    }
                } else if operation == "TAP" {
                    guard let x=action["x"] as? Double,let y=action["y"] as? Double,x.isFinite,y.isFinite,(0...1).contains(x),(0...1).contains(y) else {throw NSError(domain:"LandfallLab",code:5)}
                    let viewport=app.otherElements["parallax.native.scene"]
                    let status=app.staticTexts["parallax.native.status"]
                    let loaded=NSPredicate {_,_ in viewport.exists && viewport.isHittable && status.exists && status.label.contains("objects loaded")}
                    if XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:loaded,object:app)],timeout:20) == .completed {viewport.coordinate(withNormalizedOffset:CGVector(dx:x,dy:y)).tap();result="PASS"}
                } else if operation == "CLOSE" {
                    let close=app.buttons["Close Chronicle Lens"]
                    if close.waitForExistence(timeout:10),close.isHittable {
                        close.tap()
                        let heading=app.staticTexts["Synthetic Device Lab Voyage"]
                        let returned=NSPredicate {_,_ in heading.exists && heading.isHittable && !close.exists}
                        if XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:returned,object:app)],timeout:10) == .completed {result="PASS"}
                    }
                } else {
                    let identifier=operation == "INSPECT" ? "parallax.native.inspect" : "parallax.native.return"
                    let button=app.buttons[identifier]
                    let enabled=NSPredicate {_,_ in button.exists && button.isHittable && button.isEnabled}
                    if XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:enabled,object:app)],timeout:10) == .completed {
                        button.tap()
                        let nativeReturn=app.buttons["parallax.native.return"]
                        let rejection=app.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","Camera-free simulation cannot record a real native observation"))
                        let returned=NSPredicate {_,_ in
                            !nativeReturn.exists && (operation != "INSPECT" || rejection.count == 1)
                        }
                        if XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:returned,object:app)],timeout:20) == .completed,
                           operation != "INSPECT" || revealLensTarget(rejection.firstMatch,in:app) {result="PASS"}
                    }
                }
                // This proves only public UIKit/SceneKit input. The independent
                // canonical observation must still reject its SIMULATED receipt.
                let screenshot=XCTAttachment(screenshot:app.screenshot());screenshot.name="Camera-free Lens \(operation)";screenshot.lifetime = .keepAlways;add(screenshot)
                try await post(origin,"/lab/os/result",["index":index,"state":result,"nativeInputOnly":true,"fidelity":"SCENEKIT_CAMERA_FREE_V1","operation":operation])
                continue
            }
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
                    let contentButtons=springboard.buttons.matching(identifier:"ShortLook.Platter.Content.Seamless").matching(NSPredicate(format:"label CONTAINS %@ AND label CONTAINS %@",title,"No visit has been confirmed."))
                    let ownedCards=springboard.buttons.matching(identifier:"ListCell").matching(NSPredicate(format:"label CONTAINS %@ AND label CONTAINS %@ AND label CONTAINS %@","VOYAGEWRIGHT LANDFALL",title,"No visit has been confirmed."))
                    // SpringBoard can expose a notice as one combined accessible
                    // card/button rather than a separate title static text.
                    var notice:XCUIElement?
                    var initialTarget="NONE"
                    if contentButtons.firstMatch.waitForExistence(timeout:5),contentButtons.count == 1,contentButtons.firstMatch.isHittable {notice=contentButtons.firstMatch;initialTarget="NOTICE_CONTENT_BUTTON"}
                    else if text.firstMatch.waitForExistence(timeout:5),text.count == 1,text.firstMatch.isHittable {notice=text.firstMatch;initialTarget="STATIC_TITLE"}
                    else if openButtons.firstMatch.waitForExistence(timeout:5),openButtons.count == 1 {notice=openButtons.firstMatch;initialTarget="OPEN_BUTTON"}
                    else if cards.firstMatch.waitForExistence(timeout:5),cards.count == 1 {notice=cards.firstMatch;initialTarget="COMBINED_CARD"}
                    keepNoticeUi(springboard,"Owned notice before tap")
                    var tapped=false,foregroundObserved=false
                    var tapAttempts=0,holdAttempts=0,systemOpenButtonCount=0
                    var returnTarget="NONE"
                    if let notice=notice,notice.isHittable {
                        notice.tap();tapped=true;tapAttempts=1
                        // The retained screen shows the first tap expanding the
                        // list. Use Apple's public touch-and-hold preview route
                        // on the same uniquely identified owned notification.
                        if !app.wait(for:.runningForeground,timeout:5) {
                            keepNoticeUi(springboard,"Owned notice after first tap")
                            if contentButtons.count == 1,contentButtons.firstMatch.isHittable {
                                contentButtons.firstMatch.press(forDuration:1.2);holdAttempts=1
                                keepNoticeUi(springboard,"Owned notice after public touch and hold")
                                // The retained actual screen/hierarchy exposes
                                // Open inside this unique owned ListCell. Scope
                                // the system action to that card, never Settings.
                                if ownedCards.count == 1 {
                                    let systemOpen=ownedCards.firstMatch.buttons.matching(identifier:"swipe-action-button-identifier").matching(NSPredicate(format:"label == %@","Open"))
                                    systemOpenButtonCount=min(systemOpen.count,64)
                                    if systemOpen.count == 1 {
                                        // XCTest resolved this actual button, then lost
                                        // its dynamic query while synthesizing .tap().
                                        // Use only its observed on-screen center,
                                        // anchored to the stable SpringBoard frame.
                                        let openFrame=systemOpen.firstMatch.frame
                                        let boardFrame=springboard.frame
                                        if !openFrame.isEmpty,openFrame.midX.isFinite,openFrame.midY.isFinite,boardFrame.contains(openFrame) {
                                            springboard.coordinate(withNormalizedOffset:.zero).withOffset(CGVector(dx:openFrame.midX-boardFrame.minX,dy:openFrame.midY-boardFrame.minY)).tap()
                                            tapAttempts=2;returnTarget="SYSTEM_OPEN"
                                        }
                                    }
                                }
                            }
                        }
                        foregroundObserved=app.wait(for:.runningForeground,timeout:15)
                        if foregroundObserved {result="PASS"}
                    }
                    keepNoticeUi(springboard,"Owned notice after bounded taps")
                    noticeDiagnostic=["initialTarget":initialTarget,"returnTarget":returnTarget,"systemOpenButtonCount":systemOpenButtonCount,"noticeContentButtonCount":min(contentButtons.count,64),"buttonTitleCount":min(buttons.count,64),"openButtonCount":min(openButtons.count,64),"tapAttempts":tapAttempts,"holdAttempts":holdAttempts,"combinedCardCount":min(cards.count,64),"staticTitleCount":min(text.count,64),"tapped":tapped,"foregroundObserved":foregroundObserved]
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
