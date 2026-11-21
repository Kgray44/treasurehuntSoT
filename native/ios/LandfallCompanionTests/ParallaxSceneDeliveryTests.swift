import XCTest
import SceneKit
import GLTFKit2
import CryptoKit
import simd
import UIKit
import ARKit
@testable import LandfallCompanion

/// A matched frame after a graph mutation establishes the test view's current
/// viewport. It is neither GPU-completion nor an AR tracking observation.
private final class ParallaxViewportRenderProbe: NSObject, SCNSceneRendererDelegate {
    private let rendered: XCTestExpectation
    private let lock=NSLock()
    private var observed=false
    private var frameTime:TimeInterval?
    init(_ rendered:XCTestExpectation) {self.rendered=rendered}
    func renderer(_ renderer:SCNSceneRenderer,willRenderScene scene:SCNScene,atTime time:TimeInterval) {
        lock.lock();if !observed {frameTime=time};lock.unlock()
    }
    func renderer(_ renderer:SCNSceneRenderer,didRenderScene scene:SCNScene,atTime time:TimeInterval) {
        lock.lock();let first = !observed && frameTime == time;if first {observed=true};lock.unlock()
        if first {rendered.fulfill()}
    }
}

final class ParallaxSceneDeliveryTests: XCTestCase {
    private let checksum=String(repeating:"a",count:64)
    private func model(_ id: String) -> [String:Any] {
        let chest=id == "treasure-chest"
        return ["assetId":id,"version":"1.0.0","sha256":chest ? "2e31b5eed11242e583cfc99a5491ff2e4b10dec0d4fed5d90dffe1ccab122e6f" : "5af1158b1a7f2b3339c159fbdca8b9d3d29020eaa06d41848bf5c04c0a682ccb",
                "byteLength":chest ? 630120:313396,"url":"/api/player/playthroughs/fixture-voyage/parallax/assets/"+id+"?block=fixture-block&versionChecksum="+checksum,"format":"GLB","metersPerUnit":1,"sourceWidthMeters":chest ? 0.8:0.16]
    }
    private func view(_ root:UIView,identifier:String) -> UIView? {
        if root.accessibilityIdentifier == identifier { return root }
        for child in root.subviews { if let found=view(child,identifier:identifier) { return found } }
        return nil
    }
    private func inputEntity(_ id:String="actual-chest",x:Double=0) -> [String:Any] {
        ["id":id,"content":"Canonical content is handled in the Player, never a local success dialog.","widthMeters":0.4,
         "transform":["position":["x":x,"y":0.0,"z":-1.0],"rotation":["x":0.0,"y":0.0,"z":0.0,"w":1.0],"scale":1.0],
         "model":model("treasure-chest"),"visible":true,"selectable":true,"opacity":1.0,"interactions":["PICK","INSPECT","PLACE"]]
    }
    @MainActor private func fixtureWindow(_ runtime:ParallaxLocalRuntime) throws -> (owned:UIWindow,previous:UIWindow?) {
        let scene=try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first(where:{$0.activationState == .foregroundActive}),"Owned test host needs a foreground window scene")
        let previous=scene.windows.first(where:{$0.isKeyWindow})
        let window=UIWindow(windowScene:scene);window.frame=CGRect(x:0,y:0,width:400,height:800)
        window.rootViewController=runtime;window.makeKeyAndVisible();window.layoutIfNeeded();runtime.view.layoutIfNeeded()
        return (window,previous)
    }
    @MainActor private func requireRenderedViewport(_ scene:SCNView,in window:UIWindow,deadline:TimeInterval,phase:String) throws {
        XCTAssertTrue(scene.window === window);XCTAssertTrue(window.isKeyWindow)
        XCTAssertGreaterThan(scene.bounds.width,0);XCTAssertGreaterThan(scene.bounds.height,0)
        let rendered=expectation(description:"Owned SceneKit view renders the current \(phase) graph")
        let probe=ParallaxViewportRenderProbe(rendered),previousDelegate=scene.delegate
        let continuous=scene.rendersContinuously
        SCNTransaction.flush()
        scene.delegate=probe;scene.rendersContinuously=true;scene.setNeedsDisplay()
        defer {scene.rendersContinuously=continuous;scene.delegate=previousDelegate}
        // Every mutation shares the one original five-second setup deadline.
        // This is a frame barrier, never a retry until a desired hit appears.
        // SceneKit retains its renderer delegate weakly. Keep this probe alive
        // for the entire frame barrier; a vanished probe is not a render miss.
        let observed=withExtendedLifetime(probe) {
            XCTWaiter.wait(for:[rendered],timeout:max(0,deadline-ProcessInfo.processInfo.systemUptime)) == .completed
        }
        let withinDeadline=ProcessInfo.processInfo.systemUptime <= deadline
        let projected=scene.projectPoint(SCNVector3(0,0,-1))
        let coordinates=[Double(projected.x),Double(projected.y),Double(projected.z)]
        let evidence:[String:Any]=["evidenceClass":"SIMULATOR_TEST_VIEWPORT_SETUP_ONLY","phase":phase,"sharedSetupBudgetSeconds":5,"withinSharedSetupDeadline":withinDeadline,"attachedToOwnedWindow":scene.window === window,"ownedWindowKey":window.isKeyWindow,"renderCallbackObserved":observed,"viewportWidth":Double(scene.bounds.width),"viewportHeight":Double(scene.bounds.height),"pointOfViewAssigned":scene.pointOfView != nil,"projectedCenter":coordinates.map{ $0.isFinite ? $0 as Any : NSNull() }]
        let attachment=XCTAttachment(data:try JSONSerialization.data(withJSONObject:evidence,options:[.sortedKeys]),uniformTypeIdentifier:"public.json")
        attachment.name="Owned production controller viewport setup - "+phase;attachment.lifetime = .keepAlways;add(attachment)
        guard observed,withinDeadline else {throw NSError(domain:"NCLViewportFixture",code:1,userInfo:[NSLocalizedDescriptionKey:"Owned SceneKit viewport did not render within its original shared five-second setup budget"])}
        XCTAssertTrue(coordinates.allSatisfy{$0.isFinite})
        XCTAssertEqual(Double(projected.x),Double(scene.bounds.midX),accuracy:0.5)
        XCTAssertEqual(Double(projected.y),Double(scene.bounds.midY),accuracy:0.5)
    }
    @MainActor func testProductionControllerMeshInputAndInspectOnlyEmitIntent() throws {
        #if DEBUG && targetEnvironment(simulator)
        let runtime=ParallaxLocalRuntime(sessionId:"native-input",epoch:1,deliveryVersion:2,versionChecksum:checksum,instanceId:"native-input",origin:URL(string:"http://127.0.0.1:3137"),softwareFixture:true)
        let window=try fixtureWindow(runtime)
        defer {runtime.stop();window.owned.isHidden=true;window.owned.rootViewController=nil;window.previous?.makeKey()}
        let scene=try XCTUnwrap(view(runtime.view,identifier:"parallax.native.scene") as? SCNView)
        XCTAssertFalse(scene is ARSCNView);XCTAssertTrue(runtime.softwareFixture)
        // This focused input test uses a synthetic mesh. The separate immutable
        // catalog raster test and joined Device Lab route use the original GLBs.
        let prototype=SCNNode();let mesh=SCNNode(geometry:SCNBox(width:0.8,height:0.8,length:0.8,chamferRadius:0));mesh.name="fixture-mesh";prototype.addChildNode(mesh)
        let digest=try XCTUnwrap(ParallaxAssetCache.Model.parse(model("treasure-chest"))).sha256
        XCTAssertTrue(runtime.activate([inputEntity()],models:[digest:prototype]))
        let viewportDeadline=ProcessInfo.processInfo.systemUptime+5
        try requireRenderedViewport(scene,in:window.owned,deadline:viewportDeadline,phase:"initial-input")
        var events:[[String:Any]]=[];runtime.emit={events.append($0)}
        let selectCenter=try XCTUnwrap(view(runtime.view,identifier:"parallax.native.selectCenter") as? UIButton)
        XCTAssertTrue(selectCenter.isEnabled);XCTAssertEqual(selectCenter.title(for:.normal),"Select object at center")
        XCTAssertTrue(selectCenter.accessibilityActivate(),"The ordinary accessible button must activate the same production mesh picker")
        XCTAssertEqual(events.compactMap{$0["entityId"] as? String},["actual-chest"])
        XCTAssertEqual(events.compactMap{$0["interactionType"] as? String},["PICK"])
        events.removeAll()
        let center=CGPoint(x:scene.bounds.midX,y:scene.bounds.midY)
        XCTAssertEqual(runtime.select(at:center),"actual-chest","Selection must come from the production SceneKit hit path")
        let inspect=try XCTUnwrap(view(runtime.view,identifier:"parallax.native.inspect") as? UIButton)
        let place=try XCTUnwrap(view(runtime.view,identifier:"parallax.native.place") as? UIButton)
        let status=try XCTUnwrap(view(runtime.view,identifier:"parallax.native.status") as? UILabel)
        let fidelity=try XCTUnwrap(view(runtime.view,identifier:"parallax.native.fidelity") as? UILabel)
        XCTAssertTrue(fidelity.text?.contains("No AR tracking or physical proof") == true)
        XCTAssertTrue(inspect.isEnabled);XCTAssertFalse(place.isEnabled,"Camera-free fixture cannot claim a surface")
        let fixtureURL=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"native-delivery-v2",withExtension:"json"))
        let fixture=try XCTUnwrap(try JSONSerialization.jsonObject(with:Data(contentsOf:fixtureURL)) as? [String:Any])
        let sceneCases=try XCTUnwrap(fixture["sceneCases"] as? [[String:Any]])
        var redraw=try XCTUnwrap(sceneCases.first?["scene"] as? [String:Any])
        var identity=try XCTUnwrap(redraw["identity"] as? [String:Any]);identity["versionChecksum"]=checksum;identity["instanceId"]="native-input";redraw["identity"]=identity
        var text=try XCTUnwrap((redraw["entities"] as? [[String:Any]])?.first);text.removeValue(forKey:"model");text.removeValue(forKey:"element");text["id"]="actual-chest";redraw["entities"]=[text]
        var selectionRedrawReplies:[Bool]=[]
        runtime.renderScene(redraw) {selectionRedrawReplies.append($0)}
        XCTAssertEqual(selectionRedrawReplies,[true]);XCTAssertTrue(inspect.isEnabled,"PICK → real renderScene redraw must retain the eligible selection for Inspect")
        XCTAssertTrue(inspect.accessibilityActivate());inspect.sendActions(for:.touchUpInside)
        XCTAssertEqual(events.compactMap{$0["interactionType"] as? String},["PICK","INSPECT"])
        XCTAssertTrue(events.allSatisfy{$0["type"] as? String == "parallax-lab-interaction" && $0["synthetic"] as? Bool == true && $0["sessionId"] as? String == "native-input" && $0["epoch"] as? Int == 1})
        XCTAssertNil(runtime.presentedViewController,"Native Inspect must not show a premature local success")
        XCTAssertFalse(inspect.isEnabled);XCTAssertTrue(status.text?.contains("Opening this object in the Player") == true)
        XCTAssertFalse(selectCenter.isEnabled);XCTAssertFalse(selectCenter.accessibilityActivate(),"Pending canonical Inspect cannot reopen native input")
        var redrawReplies:[Bool]=[]
        runtime.renderScene(redraw) {redrawReplies.append($0)}
        XCTAssertEqual(redrawReplies,[true],"Exercise the real COMMIT renderScene path during a pending Inspect")
        XCTAssertTrue(status.text?.contains("Opening this object in the Player") == true,"A real redraw must preserve pending canonical handling")
        inspect.sendActions(for:.touchUpInside)
        XCTAssertEqual(events.compactMap{$0["interactionType"] as? String},["PICK","INSPECT"])
        XCTAssertNil(runtime.placement(alignment:"HORIZONTAL"))
        XCTAssertEqual(status.font,.preferredFont(forTextStyle:.body));XCTAssertTrue(status.adjustsFontForContentSizeCategory)
        #else
        throw XCTSkip("The camera-free input fixture is restricted to DEBUG Simulator builds.")
        #endif
    }
    @MainActor func testAtomicGraphReplacementRejectsMissingModelAndStopsStaleInput() throws {
        #if DEBUG && targetEnvironment(simulator)
        let runtime=ParallaxLocalRuntime(sessionId:"native-cancel",epoch:1,deliveryVersion:2,origin:URL(string:"http://127.0.0.1:3137"),softwareFixture:true)
        let window=try fixtureWindow(runtime)
        defer {runtime.stop();window.owned.isHidden=true;window.owned.rootViewController=nil;window.previous?.makeKey()}
        let scene=try XCTUnwrap(view(runtime.view,identifier:"parallax.native.scene") as? SCNView)
        let prototype=SCNNode(geometry:SCNBox(width:0.8,height:0.8,length:0.8,chamferRadius:0))
        let digest=try XCTUnwrap(ParallaxAssetCache.Model.parse(model("treasure-chest"))).sha256
        XCTAssertTrue(runtime.activate([inputEntity()],models:[digest:prototype]))
        XCTAssertFalse(runtime.activate([inputEntity("replacement")],models:[:]),"A failed model must never turn into a text plane")
        let viewportDeadline=ProcessInfo.processInfo.systemUptime+5
        try requireRenderedViewport(scene,in:window.owned,deadline:viewportDeadline,phase:"rejected-replacement")
        let center=CGPoint(x:scene.bounds.midX,y:scene.bounds.midY)
        XCTAssertEqual(runtime.select(at:center),"actual-chest","Rejected replacement leaves the complete old graph intact")
        var hidden=inputEntity();hidden["visible"]=false
        XCTAssertTrue(runtime.activate([hidden],models:[digest:prototype]))
        try requireRenderedViewport(scene,in:window.owned,deadline:viewportDeadline,phase:"hidden")
        XCTAssertNil(runtime.select(at:center))
        XCTAssertTrue(runtime.activate([inputEntity()],models:[digest:prototype]))
        // An unrelated closer mesh occludes the real entity. A miss is never
        // replaced with the first entity or a same-name impostor.
        let unrelated=SCNNode(geometry:SCNPlane(width:1,height:1));unrelated.name="actual-chest";unrelated.position=SCNVector3(0,0,-0.5)
        scene.scene?.rootNode.addChildNode(unrelated)
        try requireRenderedViewport(scene,in:window.owned,deadline:viewportDeadline,phase:"closer-unrelated-mesh")
        XCTAssertNil(runtime.select(at:center));unrelated.removeFromParentNode()
        var revoked=inputEntity();revoked["selectable"]=false
        XCTAssertTrue(runtime.activate([revoked],models:[digest:prototype]))
        try requireRenderedViewport(scene,in:window.owned,deadline:viewportDeadline,phase:"revoked-selection")
        XCTAssertNil(runtime.select(at:center))
        var noActions=inputEntity();noActions["interactions"]=[] as [String]
        XCTAssertTrue(runtime.activate([noActions],models:[digest:prototype]))
        try requireRenderedViewport(scene,in:window.owned,deadline:viewportDeadline,phase:"no-actions")
        XCTAssertNil(runtime.select(at:center))
        var inspectOnly=inputEntity();inspectOnly["interactions"]=["INSPECT"]
        XCTAssertTrue(runtime.activate([inspectOnly],models:[digest:prototype]))
        try requireRenderedViewport(scene,in:window.owned,deadline:viewportDeadline,phase:"inspect-only")
        var intents:[[String:Any]]=[];runtime.emit={intents.append($0)}
        XCTAssertEqual(runtime.select(at:center),"actual-chest","INSPECT-only authored content is still selectable")
        XCTAssertTrue(intents.isEmpty,"Selection cannot manufacture a forbidden PICK intent")
        let inspect=try XCTUnwrap(view(runtime.view,identifier:"parallax.native.inspect") as? UIButton)
        XCTAssertTrue(inspect.isEnabled);inspect.sendActions(for:.touchUpInside)
        XCTAssertEqual(intents.compactMap{$0["interactionType"] as? String},["INSPECT"])
        var terminations=0;runtime.terminated={terminations += 1};runtime.stop();runtime.stop()
        XCTAssertEqual(terminations,1);XCTAssertNil(runtime.select(at:center));XCTAssertFalse(runtime.activate([inputEntity()],models:[digest:prototype]))
        let closed=try XCTUnwrap(view(runtime.view,identifier:"parallax.native.status") as? UILabel);XCTAssertEqual(closed.text,"The camera scene has closed.")
        #else
        throw XCTSkip("The camera-free input fixture is restricted to DEBUG Simulator builds.")
        #endif
    }
    func testCameraFreeOriginGateNeverAcceptsRemoteOrCredentialedOrigins() {
        XCTAssertTrue(ParallaxLocalRuntime.isLoopbackLabOrigin(URL(string:"http://127.0.0.1:3137")))
        for raw in ["https://127.0.0.1:3137","http://localhost:3137","http://127.0.0.1","http://127.0.0.1:3137/","http://user@127.0.0.1:3137","http://127.0.0.1:3137?flag=1","http://example.com:3137"] {
            XCTAssertFalse(ParallaxLocalRuntime.isLoopbackLabOrigin(URL(string:raw)),raw)
        }
    }
    @MainActor func testTrackingTransitionsStopWithoutStaleEmissions() {
        // State-machine input only: this is not an ARSession or tracking receipt.
        let runtime=ParallaxLocalRuntime(sessionId:"tracking-input",epoch:4)
        var events:[[String:Any]]=[];runtime.emit={events.append($0)}
        for state in ["NORMAL","NORMAL","NORMAL","NORMAL","LIMITED_FEATURES","RELOCALIZING","NORMAL"] {runtime.applyTrackingState(state)}
        XCTAssertEqual(events.compactMap{$0["state"] as? String},["NORMAL","NORMAL","NORMAL","LIMITED_FEATURES","RELOCALIZING","NORMAL"])
        runtime.stop();let stoppedCount=events.count;runtime.applyTrackingState("NORMAL")
        XCTAssertEqual(events.count,stoppedCount);XCTAssertEqual(events.last?["state"] as? String,"INTERRUPTED")
        XCTAssertTrue(events.allSatisfy{$0["sessionId"] as? String == "tracking-input" && $0["epoch"] as? Int == 4})
    }
    @MainActor func testCameraFreeOverlayKeepsEscapeVisibleWithLargeTextAndRotation() throws {
        #if DEBUG && targetEnvironment(simulator)
        let parent=UIViewController()
        let runtime=ParallaxLocalRuntime(sessionId:"native-large-text",epoch:1,origin:URL(string:"http://127.0.0.1:3137"),softwareFixture:true)
        parent.addChild(runtime);parent.view.addSubview(runtime.view);runtime.didMove(toParent:parent)
        parent.setOverrideTraitCollection(UITraitCollection(preferredContentSizeCategory:.accessibilityExtraExtraExtraLarge),forChild:runtime)
        defer {runtime.stop()}
        for size in [CGSize(width:390,height:844),CGSize(width:844,height:390)] {
            parent.view.frame=CGRect(origin:.zero,size:size);runtime.view.frame=parent.view.bounds
            parent.view.setNeedsLayout();parent.view.layoutIfNeeded();runtime.view.setNeedsLayout();runtime.view.layoutIfNeeded()
            let escape=try XCTUnwrap(view(runtime.view,identifier:"parallax.native.return") as? UIButton)
            let selectCenter=try XCTUnwrap(view(runtime.view,identifier:"parallax.native.selectCenter") as? UIButton)
            XCTAssertGreaterThanOrEqual(selectCenter.bounds.height,48)
            XCTAssertTrue(escape.isEnabled);XCTAssertTrue(runtime.view.bounds.contains(escape.convert(escape.bounds,to:runtime.view)))
            XCTAssertGreaterThanOrEqual(escape.bounds.height,48)
            let label=try XCTUnwrap(escape.titleLabel)
            let text=label.sizeThatFits(CGSize(width:escape.bounds.width-escape.contentEdgeInsets.left-escape.contentEdgeInsets.right,height:CGFloat.greatestFiniteMagnitude))
            XCTAssertGreaterThanOrEqual(escape.bounds.height+1,text.height+escape.contentEdgeInsets.top+escape.contentEdgeInsets.bottom,"Escape title must not clip at the declared Dynamic Type size")
        }
        #else
        throw XCTSkip("The camera-free overlay fixture is restricted to DEBUG Simulator builds.")
        #endif
    }
    func testAuthorizedAssetReferencesAndIntegrity() throws {
        let usage=try XCTUnwrap(Bundle(for:LandfallCompanion.self).object(forInfoDictionaryKey:"NSLocalNetworkUsageDescription") as? String)
        XCTAssertFalse(usage.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty)
        let configuration=ParallaxAssetCache.sessionConfiguration()
        XCTAssertTrue(configuration.waitsForConnectivity)
        XCTAssertEqual(configuration.timeoutIntervalForResource,45)
        XCTAssertNil(configuration.httpCookieStorage);XCTAssertNil(configuration.urlCache)
        XCTAssertEqual(configuration.requestCachePolicy,.reloadIgnoringLocalCacheData)
        for id in ["treasure-chest","brass-compass"] {
            let reference=try XCTUnwrap(ParallaxAssetCache.Model.parse(model(id)))
            let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:id,withExtension:"glb"))
            var bytes=try Data(contentsOf:url)
            XCTAssertTrue(ParallaxAssetCache.verified(bytes,model:reference))
            bytes[bytes.count-1] ^= 1
            XCTAssertFalse(ParallaxAssetCache.verified(bytes,model:reference))
        }
        for invalid in ["https://other.example/model.glb","//other.example/model.glb","/api/player/playthroughs/fixture-voyage/parallax/assets/treasure-chest?block=b&versionChecksum="+checksum+"&extra=1","/parallax/sc02/models/treasure-chest.glb"] {
            var value=model("treasure-chest");value["url"]=invalid;XCTAssertNil(ParallaxAssetCache.Model.parse(value))
        }
        var value=model("treasure-chest");value["sha256"]=String(repeating:"0",count:64);XCTAssertNil(ParallaxAssetCache.Model.parse(value))
        value=model("treasure-chest");value["byteLength"]=true;XCTAssertNil(ParallaxAssetCache.Model.parse(value))
    }
    func testCatalogGLBLoadsRealGeometryAndMaterialsWithoutCamera() throws {
        // One original 20-second budget covers preflight, both imports, all GPU
        // completions, CPU measurements and PNG encoding. No camera or AR owner.
        let started=ProcessInfo.processInfo.systemUptime
        let finished=expectation(description:"Exact catalog models produce and release SceneKit pixels")
        let fixture=ParallaxModelRasterFixture(bundle:Bundle(for:Self.self),started:started,deadline:started+20,finished:finished)
        fixture.start()
        let waited=XCTWaiter.wait(for:[finished],timeout:max(0,started+20-ProcessInfo.processInfo.systemUptime))
        let snapshot=fixture.seal(timedOut:waited != .completed)
        for (name,bytes) in snapshot.images {
            let attachment=XCTAttachment(data:bytes,uniformTypeIdentifier:"public.png")
            attachment.name=name;attachment.lifetime = .keepAlways;add(attachment)
        }
        let report=XCTAttachment(data:try JSONSerialization.data(withJSONObject:snapshot.report,options:[.prettyPrinted,.sortedKeys]),uniformTypeIdentifier:"public.json")
        report.name="ncl01-scenekit-catalog.json";report.lifetime = .keepAlways;add(report)
        XCTAssertEqual(waited,.completed,"One monotonic SceneKit proof deadline")
        XCTAssertEqual(snapshot.report["result"] as? String,"PASS",snapshot.report["failure"] as? String ?? "Missing raster proof")
        XCTAssertLessThanOrEqual(ProcessInfo.processInfo.systemUptime,started+20,"Proof publication shares the original deadline")
    }
    @MainActor func testSelectionUsesHitAncestryAndNeverAnArbitraryFirstEntity() {
        let root=SCNNode();root.name="actual-chest";let child=SCNNode();child.name="authored-mesh";root.addChildNode(child)
        XCTAssertEqual(ParallaxLocalRuntime.entityId(for:child,entities:["actual-chest":root]),"actual-chest")
        XCTAssertNil(ParallaxLocalRuntime.entityId(for:nil,entities:["actual-chest":root]))
        let unrelated=SCNNode();unrelated.name="actual-chest"
        XCTAssertNil(ParallaxLocalRuntime.entityId(for:unrelated,entities:["actual-chest":root]))
        let quadNormal=SIMD3<Float>(0,0,1)
        let surface=ParallaxLocalRuntime.quadOrientation(deliveryVersion:2,surfaceRelative:true).act(quadNormal)
        XCTAssertEqual(surface.y,1,accuracy:0.00001);XCTAssertEqual(surface.z,0,accuracy:0.00001)
        for (version,onSurface) in [(1,true),(1,false),(2,false)] {
            let normal=ParallaxLocalRuntime.quadOrientation(deliveryVersion:version,surfaceRelative:onSurface).act(quadNormal)
            XCTAssertEqual(normal.y,0,accuracy:0.00001);XCTAssertEqual(normal.z,1,accuracy:0.00001)
        }
    }
    @MainActor func testSharedVersionTwoSceneTransferAndIdentityFixtures() throws {
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"native-delivery-v2",withExtension:"json"))
        let fixture=try XCTUnwrap(try JSONSerialization.jsonObject(with:Data(contentsOf:url)) as? [String:Any])
        let cases=try XCTUnwrap(fixture["sceneCases"] as? [[String:Any]])
        func deliver(_ scene:[String:Any],_ transfer:ParallaxSceneTransfer,_ transaction:[String:Any]) throws -> [String:Any]? {
            let bytes=try JSONSerialization.data(withJSONObject:scene)
            var begin=transaction;begin["sceneTransferVersion"]=2;begin["totalBytes"]=bytes.count;begin["chunkCount"]=(bytes.count+8191)/8192;begin["digest"]=SHA256.hash(data:bytes).map{String(format:"%02x",$0)}.joined()
            XCTAssertTrue(transfer.begin(begin,0))
            for offset in stride(from:0,to:bytes.count,by:8192) {
                var chunk=transaction;chunk["index"]=offset/8192;chunk["data"]=bytes.subdata(in:offset..<min(bytes.count,offset+8192)).base64EncodedString();XCTAssertTrue(transfer.chunk(chunk,0))
            }
            return transfer.commitScene(transaction,0)
        }
        let transaction:[String:Any]=["sessionId":"ncl-fixture","epoch":1,"generation":1,"transactionId":"ncl-transfer"]
        for test in cases {
            let scene=try XCTUnwrap(test["scene"] as? [String:Any]);let identity=try XCTUnwrap(scene["identity"] as? [String:Any])
            let transfer=ParallaxSceneTransfer(sessionId:"ncl-fixture",epoch:1,deliveryVersion:2,versionChecksum:identity["versionChecksum"] as? String,instanceId:identity["instanceId"] as? String)
            XCTAssertEqual(try deliver(scene,transfer,transaction) != nil,test["accepted"] as? Bool,test["name"] as? String ?? "fixture")
            XCTAssertFalse(ParallaxSceneDelivery.valid(scene,version:2,checksum:String(repeating:"0",count:64),instanceId:identity["instanceId"] as? String))
        }
        let scene=try XCTUnwrap(cases.first?["scene"] as? [String:Any]);let identity=try XCTUnwrap(scene["identity"] as? [String:Any])
        var heldCookies: (([HTTPCookie]) -> Void)?
        let runtime=ParallaxLocalRuntime(sessionId:"ncl-fixture",epoch:1,deliveryVersion:2,versionChecksum:identity["versionChecksum"] as? String,instanceId:identity["instanceId"] as? String,origin:URL(string:"https://ncl-fixture.example"),cookies:{ heldCookies=$0 })
        let staged=try XCTUnwrap(try deliver(scene,runtime.transfer,transaction));XCTAssertTrue(runtime.transfer.stagedMatches(transaction))
        // A later transaction in the same provider must never be canceled by an old abort.
        runtime.transfer.completeActivation()
        var next=transaction;next["generation"]=2;next["transactionId"]="ncl-next"
        XCTAssertNotNil(try deliver(scene,runtime.transfer,next))
        XCTAssertTrue(runtime.transfer.abort(transaction));XCTAssertTrue(runtime.transfer.stagedMatches(next))
        var replies:[Bool]=[];var terminations=0
        runtime.terminated={ terminations += 1 }
        runtime.renderScene(staged) { replies.append($0) }
        XCTAssertTrue(runtime.isStagingScene);XCTAssertNotNil(heldCookies)
        XCTAssertTrue(runtime.abortScene(transaction));XCTAssertTrue(runtime.isStagingScene);XCTAssertEqual(terminations,0)
        XCTAssertTrue(runtime.abortScene(next));XCTAssertFalse(runtime.isStagingScene);XCTAssertEqual(replies,[false]);XCTAssertEqual(terminations,1)
        // Releasing a delayed cookie/asset continuation after the acknowledged abort
        // cannot resurrect the scene or complete the canceled COMMIT a second time.
        heldCookies?([])
        let settled=expectation(description:"Canceled activation remains terminated after delayed callback")
        DispatchQueue.main.async { XCTAssertFalse(runtime.isStagingScene);XCTAssertEqual(replies,[false]);XCTAssertEqual(terminations,1);settled.fulfill() }
        wait(for:[settled],timeout:2)
    }
}
