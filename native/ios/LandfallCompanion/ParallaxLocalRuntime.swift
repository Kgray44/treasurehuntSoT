import ARKit
import SceneKit
import AVFoundation
import UIKit
import simd
import GLTFKit2

/// UIButton's default intrinsic height can clip a wrapped Dynamic Type title.
private final class ParallaxActionButton: UIButton {
    private var measuredWidth:CGFloat=0
    override var intrinsicContentSize: CGSize {
        let base=super.intrinsicContentSize
        guard bounds.width > 0,let label=titleLabel else {return base}
        let width=max(1,bounds.width-contentEdgeInsets.left-contentEdgeInsets.right)
        let text=label.sizeThatFits(CGSize(width:width,height:CGFloat.greatestFiniteMagnitude))
        return CGSize(width:base.width,height:max(48,text.height+contentEdgeInsets.top+contentEdgeInsets.bottom))
    }
    override func layoutSubviews() {
        super.layoutSubviews()
        if measuredWidth != bounds.width {measuredWidth=bounds.width;invalidateIntrinsicContentSize()}
    }
    override func accessibilityActivate() -> Bool {
        guard isEnabled,isUserInteractionEnabled,!isHidden,alpha > 0 else {return false}
        sendActions(for:.touchUpInside);return true
    }
}

/// Foreground, local-only AR provider. No frames, meshes, calibration images or world maps leave this controller.
final class ParallaxLocalRuntime: UIViewController, ARSCNViewDelegate, ARSessionDelegate, UIAdaptivePresentationControllerDelegate {
    private let scene: SCNView
    private var arScene: ARSCNView? { scene as? ARSCNView }
    let softwareFixture: Bool
    private let status = UILabel()
    private let controls = UIStackView()
    private let selectCenterButton = ParallaxActionButton(type:.system)
    private let inspectButton = ParallaxActionButton(type:.system)
    private let placeButton = ParallaxActionButton(type:.system)
    private let returnButton = ParallaxActionButton(type:.system)
    private var phase = "STARTING"
    private var loadingProgress = ""
    private var openingPlayer = false
    private var entities: [[String:Any]] = []
    private var nodes: [String:SCNNode] = [:]
    private var anchors: [String:ARAnchor] = [:]
    private var anchorFrames: [String:simd_float4x4] = [:]
    private var modelNodes: [String:SCNNode] = [:]
    private let assets: ParallaxAssetCache
    private var renderGeneration = 0
    private var pendingRender: ((Bool) -> Void)?
    private var selected: String?
    private var lastTracking = "INITIALIZING"
    private var normalFrames = 0
    let transfer: ParallaxSceneTransfer
    private var active = true
    var terminated: (() -> Void)?
    init(sessionId: String, epoch: Int, deliveryVersion: Int = 1, versionChecksum: String? = nil, instanceId: String? = nil, origin: URL? = nil, softwareFixture requestedFixture: Bool = false, cookies: @escaping (@escaping ([HTTPCookie]) -> Void) -> Void = { $0([]) }) {
        #if DEBUG && targetEnvironment(simulator)
        softwareFixture = requestedFixture && Self.isLoopbackLabOrigin(origin)
        #else
        softwareFixture = false
        #endif
        scene = softwareFixture ? SCNView(frame:.zero) : ARSCNView(frame:.zero)
        transfer = ParallaxSceneTransfer(sessionId:sessionId,epoch:epoch,deliveryVersion:deliveryVersion,versionChecksum:versionChecksum,instanceId:instanceId)
        assets=ParallaxAssetCache(origin:origin,softwareFixture:softwareFixture,cookies:cookies);super.init(nibName:nil,bundle:nil)
    }
    required init?(coder: NSCoder) { fatalError("Programmatic local provider only") }
    private func send(_ value: [String:Any]) { guard active else { return }; var event = value; event["sessionId"] = transfer.sessionId; event["epoch"] = transfer.epoch; emit?(event) }
    var emit: (([String:Any]) -> Void)?
    static func isLoopbackLabOrigin(_ origin: URL?) -> Bool {
        guard let url=origin, url.scheme == "http", url.host == "127.0.0.1", let port=url.port, (1...65535).contains(port), url.path.isEmpty,
              url.user == nil, url.password == nil, url.query == nil, url.fragment == nil else { return false }
        return true
    }
    static func softwareFixtureEnabled(origin: URL?) -> Bool {
        #if DEBUG && targetEnvironment(simulator)
        return ProcessInfo.processInfo.arguments.contains("--landfall-lab-camera-free") && isLoopbackLabOrigin(origin)
        #else
        return false
        #endif
    }
    static func state() -> [String:Any] {
        let authorization = AVCaptureDevice.authorizationStatus(for: .video)
        return ["sceneTransferVersion":1,"sceneDeliveryVersions":[1,2],"capabilities":ParallaxSceneDelivery.capabilities, "supported": ARWorldTrackingConfiguration.isSupported,
                "permission": authorization == .authorized ? "GRANTED" : authorization == .notDetermined ? "PROMPT" : "DENIED"]
    }
    static func permission(reply: @escaping (Any?,String?) -> Void) {
        guard ARWorldTrackingConfiguration.isSupported else { reply(state(),nil); return }
        AVCaptureDevice.requestAccess(for: .video) { _ in DispatchQueue.main.async { reply(self.state(),nil) } }
    }
    override func viewDidLoad() {
        super.viewDidLoad()
        guard active else { return }
        presentationController?.delegate = self
        view.backgroundColor = UIColor(red:0.04,green:0.12,blue:0.16,alpha:1)
        scene.frame = view.bounds; scene.autoresizingMask = [.flexibleWidth,.flexibleHeight]
        arScene?.delegate = self; arScene?.session.delegate = self; arScene?.automaticallyUpdatesLighting = true
        scene.autoenablesDefaultLighting = true; view.addSubview(scene)
        scene.accessibilityIdentifier="parallax.native.scene"
        scene.isAccessibilityElement=true;scene.accessibilityLabel=softwareFixture ? "Camera-free 3D scene" : "Camera 3D scene"
        scene.accessibilityHint="Tap a visible object or use Select object at center. Return to Guided View to read and select objects without the camera."
        if softwareFixture {
            scene.scene=SCNScene()
            let camera=SCNNode();camera.camera=SCNCamera();camera.camera?.zNear=0.01;camera.camera?.zFar=100
            scene.scene?.rootNode.addChildNode(camera);scene.pointOfView=camera
        }
        let tap=UITapGestureRecognizer(target:self,action:#selector(pick(_:))); scene.addGestureRecognizer(tap)
        status.numberOfLines=0;status.font = .preferredFont(forTextStyle:.body);status.adjustsFontForContentSizeCategory=true
        status.accessibilityIdentifier="parallax.native.status";status.accessibilityTraits.insert(.updatesFrequently)
        status.textColor = .white; status.backgroundColor=UIColor.black.withAlphaComponent(0.65)
        status.translatesAutoresizingMaskIntoConstraints=false
        var statusTop=view.safeAreaLayoutGuide.topAnchor
        if softwareFixture {
            let fidelity=UILabel();fidelity.text="Device Lab: camera-free software fixture. No AR tracking or physical proof."
            fidelity.accessibilityIdentifier="parallax.native.fidelity";fidelity.numberOfLines=0;fidelity.textColor = .white
            fidelity.font = .preferredFont(forTextStyle:.caption1);fidelity.adjustsFontForContentSizeCategory=true
            fidelity.backgroundColor=UIColor(red:0.2,green:0.12,blue:0.02,alpha:1);fidelity.translatesAutoresizingMaskIntoConstraints=false;view.addSubview(fidelity)
            NSLayoutConstraint.activate([fidelity.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor,constant:12),fidelity.leadingAnchor.constraint(equalTo:view.leadingAnchor,constant:16),fidelity.trailingAnchor.constraint(equalTo:view.trailingAnchor,constant:-16)])
            statusTop=fidelity.bottomAnchor
        }
        controls.axis = .vertical;controls.spacing=10;controls.translatesAutoresizingMaskIntoConstraints=false
        for (button,name,identifier,action) in [(selectCenterButton,"Select object at center","parallax.native.selectCenter",#selector(selectCenter)),(inspectButton,"Inspect selected object","parallax.native.inspect",#selector(inspect)),(placeButton,"Place on a surface","parallax.native.place",#selector(place)),(returnButton,"Return to Guided View","parallax.native.return",#selector(closeLens))] {
            button.setTitle(name,for:.normal);button.setTitleColor(.white,for:.normal);button.setTitleColor(.lightGray,for:.disabled)
            button.accessibilityIdentifier=identifier;button.titleLabel?.font = .preferredFont(forTextStyle:.body)
            button.titleLabel?.adjustsFontForContentSizeCategory=true;button.titleLabel?.numberOfLines=0
            button.titleLabel?.lineBreakMode = .byWordWrapping;button.titleLabel?.textAlignment = .center
            button.contentEdgeInsets=UIEdgeInsets(top:10,left:12,bottom:10,right:12)
            button.backgroundColor=UIColor(red:0.07,green:0.2,blue:0.25,alpha:0.95);button.layer.cornerRadius=10
            button.heightAnchor.constraint(greaterThanOrEqualToConstant:48).isActive=true
            button.addTarget(self,action:action,for:.touchUpInside);controls.addArrangedSubview(button)
        }
        // Keep the escape button visible even when large text makes the other
        // guidance/controls scroll. A short panel leaves the camera tappable.
        controls.removeArrangedSubview(returnButton);returnButton.removeFromSuperview();returnButton.translatesAutoresizingMaskIntoConstraints=false;view.addSubview(returnButton)
        // The preferred scroll height must yield before the escape title can
        // compress, including when another control or large text fills the panel.
        returnButton.setContentCompressionResistancePriority(.required,for:.vertical)
        let panel=UIStackView(arrangedSubviews:[status,controls]);panel.axis = .vertical;panel.spacing=12;panel.translatesAutoresizingMaskIntoConstraints=false
        let scroll=UIScrollView();scroll.translatesAutoresizingMaskIntoConstraints=false;view.addSubview(scroll);scroll.addSubview(panel)
        NSLayoutConstraint.activate([scroll.topAnchor.constraint(equalTo:statusTop,constant:12),scroll.leadingAnchor.constraint(equalTo:view.leadingAnchor,constant:16),scroll.trailingAnchor.constraint(equalTo:view.trailingAnchor,constant:-16),scroll.bottomAnchor.constraint(lessThanOrEqualTo:returnButton.topAnchor,constant:-12),scroll.heightAnchor.constraint(greaterThanOrEqualToConstant:0),returnButton.leadingAnchor.constraint(equalTo:view.leadingAnchor,constant:16),returnButton.trailingAnchor.constraint(equalTo:view.trailingAnchor,constant:-16),returnButton.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor,constant:-12),panel.leadingAnchor.constraint(equalTo:scroll.contentLayoutGuide.leadingAnchor),panel.trailingAnchor.constraint(equalTo:scroll.contentLayoutGuide.trailingAnchor),panel.topAnchor.constraint(equalTo:scroll.contentLayoutGuide.topAnchor),panel.bottomAnchor.constraint(equalTo:scroll.contentLayoutGuide.bottomAnchor),panel.widthAnchor.constraint(equalTo:scroll.frameLayoutGuide.widthAnchor)])
        let preferredHeight=scroll.heightAnchor.constraint(equalTo:panel.heightAnchor);preferredHeight.priority = .defaultHigh;preferredHeight.isActive=true
        updatePresentation()
        let configuration=ARWorldTrackingConfiguration();configuration.planeDetection=[.horizontal,.vertical]
        configuration.environmentTexturing = .automatic
        arScene?.session.run(configuration)
    }
    func stop() {
        guard active else { return }
        active = false; lastTracking = "INTERRUPTED"; normalFrames = 0; selected = nil; transfer.clear();transfer.completeActivation()
        renderGeneration += 1;let pending=pendingRender;pendingRender=nil;pending?(false);assets.stop()
        arScene?.session.pause();anchors.values.forEach{arScene?.session.remove(anchor:$0)};anchors.removeAll();anchorFrames.removeAll()
        nodes.values.forEach{$0.removeFromParentNode()}; nodes.removeAll();modelNodes.removeAll();entities=[]
        arScene?.delegate=nil;arScene?.session.delegate=nil;scene.scene=SCNScene();phase="CLOSED";openingPlayer=false;updatePresentation()
        if presentedViewController != nil { presentedViewController?.dismiss(animated:false) }
        dismiss(animated:false)
        terminated?(); terminated = nil
        // Presentation closure also invalidates the camera-free test session;
        // it never supplies a NORMAL frame or a measured plane in that mode.
        emit?(["type":"parallax-tracking","state":"INTERRUPTED","sessionId":transfer.sessionId,"epoch":transfer.epoch])
    }
    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) { stop() }
    override func viewDidDisappear(_ animated: Bool) { super.viewDidDisappear(animated); if isBeingDismissed || presentingViewController == nil { stop() } }
    @objc private func closeLens(){ stop() }
    @objc private func pick(_ gesture:UITapGestureRecognizer){
        select(at:gesture.location(in:scene))
    }
    @objc private func selectCenter(){
        guard inputAvailable else {return}
        if select(at:CGPoint(x:scene.bounds.midX,y:scene.bounds.midY)) == nil {
            UIAccessibility.post(notification:.announcement,argument:"No selectable object at the center. Look around and try again, or return to Guided View.")
        }
    }
    private var inputAvailable: Bool { active && !openingPlayer && phase == "READY" && (softwareFixture || lastTracking == "NORMAL") }
    @discardableResult func select(at point: CGPoint) -> String? {
        guard inputAvailable,point.x.isFinite,point.y.isFinite,scene.bounds.contains(point) else { return nil }
        let result=scene.hitTest(point,options:[.searchMode:SCNHitTestSearchMode.closest.rawValue,.boundingBoxOnly:false,.ignoreHiddenNodes:true]).first
        let id=Self.entityId(for:result?.node,entities:nodes)
        selected=id.flatMap { eligible($0) ? $0 : nil };updatePresentation()
        if let id=selected,permits(id,"PICK") { interaction(id,"PICK") }
        return selected
    }
    private func interaction(_ id: String,_ type: String) {
        if softwareFixture { send(["type":"parallax-lab-interaction","synthetic":true,"entityId":id,"interactionType":type]) }
        else { send(["type":"parallax-interaction","entityId":id,"interactionType":type]) }
    }
    @objc private func inspect(){
        guard inputAvailable,let id=selected,permits(id,"INSPECT") else{return}
        // Only the existing Player can show the accepted observation or its error.
        // A native content dialog would claim success before canonical handling.
        openingPlayer=true;updatePresentation();interaction(id,"INSPECT")
    }
    @objc private func place(){if inputAvailable,!softwareFixture,let id=selected,permits(id,"PLACE") {interaction(id,"PLACE")}}
    private func updatePresentation() {
        guard isViewLoaded else { return }
        let message:String
        if !active { message="The camera scene has closed." }
        else if openingPlayer { message="Opening this object in the Player. If it does not return, use Return to Guided View." }
        else if phase == "FAILED" { message="The 3D scene could not load. Return to Guided View to retry or continue." }
        else if phase == "LOADING" { message=loadingProgress+" Keep the app open, or return to Guided View." }
        else if softwareFixture { message="\(nodes.count) objects loaded. Tap an object or use Select object at center, then Inspect." }
        else if lastTracking == "LIMITED_EXCESSIVE_MOTION" { message="Move more slowly to recover tracking. Objects are hidden until tracking returns." }
        else if lastTracking == "LIMITED_FEATURES" { message="Aim at a well-lit, textured surface to recover tracking. Objects are hidden until tracking returns." }
        else if ["RELOCALIZING","INTERRUPTED","LOST"].contains(lastTracking) { message="Tracking paused. Return near the place you began, or return to Guided View." }
        else if phase == "READY",lastTracking == "NORMAL" { message=selected == nil ? "\(nodes.count) objects loaded. Look around, then tap an object or use Select object at center. Placement uses the chosen surface; it does not recognize this room." : "Object selected. Inspect opens it in the Player. Place uses the surface at the center of the camera." }
        else { message="Move slowly and aim the center of the camera at the intended surface. Finding a surface can take a moment. Return to Guided View whenever you like." }
        if status.text != message { status.text=message;UIAccessibility.post(notification:.announcement,argument:message) }
        selectCenterButton.isEnabled=inputAvailable
        inspectButton.isEnabled=inputAvailable && selected.map{permits($0,"INSPECT")} == true
        placeButton.isEnabled=inputAvailable && !softwareFixture && selected.map{permits($0,"PLACE")} == true
        returnButton.isEnabled=active
    }
    static func entityId(for hit: SCNNode?, entities: [String:SCNNode]) -> String? {
        var current=hit
        while let node=current { if let name=node.name,entities[name] === node { return name };current=node.parent }
        return nil
    }
    private func permits(_ id: String, _ interaction: String) -> Bool {
        guard let entity=entities.first(where:{$0["id"] as? String == id}),entity["visible"] as? Bool != false,entity["selectable"] as? Bool != false,
              nodes[id]?.isHidden != true,nodes[id]?.opacity != 0 else { return false }
        return (entity["interactions"] as? [String])?.contains(interaction) ?? (transfer.deliveryVersion == 1)
    }
    private func eligible(_ id:String) -> Bool { ["PICK","INSPECT","PLACE"].contains(where:{permits(id,$0)}) }
    var isStagingScene: Bool { pendingRender != nil }
    func abortScene(_ payload: [String:Any]) -> Bool {
        let canceledStaging=transfer.stagedMatches(payload)
        let accepted=transfer.abort(payload)
        // A matching abort ends this foreground provider. Old transaction aborts
        // cannot cancel a newer stage, and canceled loaders cannot reactivate it.
        if canceledStaging { stop() }
        return accepted
    }
    static func quadOrientation(deliveryVersion: Int, surfaceRelative: Bool) -> simd_quatf {
        deliveryVersion == 2 && surfaceRelative ? simd_quatf(angle:-Float.pi/2,axis:SIMD3<Float>(1,0,0)) : simd_quatf(angle:0,axis:SIMD3<Float>(1,0,0))
    }
    func placement(alignment:String) -> [String:Any]? {
        guard active,!softwareFixture,lastTracking == "NORMAL",let arScene=arScene,let query=arScene.raycastQuery(from:CGPoint(x:scene.bounds.midX,y:scene.bounds.midY),allowing:.existingPlaneGeometry,alignment:alignment == "VERTICAL" ? .vertical : .horizontal),let hit=arScene.session.raycast(query).first else{return nil}
        return pose(hit.worldTransform)
    }
    private func pose(_ matrix:simd_float4x4)->[String:Any]{
        let q=simd_quatf(matrix);let p=matrix.columns.3
        return ["position":["x":Double(p.x),"y":Double(p.y),"z":Double(p.z)],"rotation":["x":Double(q.imag.x),"y":Double(q.imag.y),"z":Double(q.imag.z),"w":Double(q.real)],"scale":1]
    }
    func render(_ input:[[String:Any]])->Bool {
        guard active, ParallaxSceneTransfer.validEntities(input) else{return false}
        return activate(input,models:[:])
    }
    func renderScene(_ delivery: [String:Any], completion: @escaping (Bool) -> Void) {
        guard active, ParallaxSceneDelivery.valid(delivery,version:transfer.deliveryVersion,checksum:transfer.versionChecksum,instanceId:transfer.instanceId),
              let input=delivery["entities"] as? [[String:Any]],pendingRender == nil else { completion(false);return }
        renderGeneration += 1;let generation=renderGeneration;pendingRender=completion
        func finish(_ accepted: Bool) {
            guard self.active,self.renderGeneration == generation,self.pendingRender != nil else { return }
            self.renderGeneration += 1
            self.transfer.completeActivation()
            let done=self.pendingRender;self.pendingRender=nil
            self.phase=accepted ? "READY" : "FAILED";if !accepted {self.selected=nil};self.updatePresentation();done?(accepted)
        }
        DispatchQueue.main.asyncAfter(deadline:.now()+55) { [weak self] in
            guard let self=self,self.renderGeneration == generation,self.pendingRender != nil else { return }
            self.renderGeneration += 1;let done=self.pendingRender;self.pendingRender=nil;self.stop();done?(false)
        }
        var seen=Set<String>()
        let models=input.compactMap{$0["model"] as? [String:Any]}.compactMap{ParallaxAssetCache.Model.parse($0)}.filter{seen.insert($0.sha256).inserted}
        phase="LOADING"
        let surfaceAnchors=Set((delivery["anchors"] as? [[String:Any]] ?? []).filter{$0["kind"] as? String == "SURFACE_RELATIVE"}.compactMap{$0["id"] as? String})
        var loaded:[String:SCNNode]=[:]
        func stage(_ index: Int) {
            guard self.active,self.renderGeneration == generation,self.pendingRender != nil else { return }
            guard index < models.count else { finish(self.activate(input,models:loaded,surfaceAnchors:surfaceAnchors));return }
            self.loadingProgress="Loading 3D model \(index+1) of \(models.count).";self.updatePresentation()
            let model=models[index]
            if let cached=self.modelNodes[model.sha256] { loaded[model.sha256]=cached;stage(index+1);return }
            self.assets.load(model) { [weak self] url in
                guard let self=self,self.active,self.renderGeneration == generation else { return }
                guard let url=url else { finish(false);return }
                GLTFAsset.load(with:url,options:[:]) { _,status,asset,error,_ in
                    if status == .error { DispatchQueue.main.async { finish(false) };return }
                    guard status == .complete, error == nil, let asset=asset else { return }
                    DispatchQueue.main.async {
                        guard self.active,self.renderGeneration == generation,self.pendingRender != nil else { return }
                        let source=GLTFSCNSceneSource(asset:asset)
                        guard let imported=source.defaultScene else { finish(false);return }
                        let prototype=ParallaxModelPreparation.prototype(from:imported)
                        self.modelNodes[model.sha256]=prototype;loaded[model.sha256]=prototype;stage(index+1)
                    }
                }
            }
        }
        stage(0)
    }
    @discardableResult func activate(_ input:[[String:Any]],models:[String:SCNNode],surfaceAnchors:Set<String> = []) -> Bool {
        guard active else { return false }
        var next:[String:SCNNode]=[:]
        var poses:[String:simd_float4x4]=[:]
        for entity in input {
            guard let id=entity["id"] as? String, id.utf16.count<=128, let text=entity["content"] as? String,text.utf16.count<=2000,
                  let width=entity["widthMeters"] as? Double,(0.01...5).contains(width),let transform=entity["transform"] as? [String:Any],
                  let p=transform["position"] as? [String:Double],let q=transform["rotation"] as? [String:Double],let scale=transform["scale"] as? Double,
                  let x=p["x"],let y=p["y"],let z=p["z"],let qx=q["x"],let qy=q["y"],let qz=q["z"],let qw=q["w"],
                  [x,y,z,qx,qy,qz,qw,scale].allSatisfy({$0.isFinite}),[x,y,z].allSatisfy({abs($0)<=1000000}),abs(sqrt(qx*qx+qy*qy+qz*qz+qw*qw)-1)<0.00001,scale > 0, scale <= 100000000, (0.000001...100).contains(width*scale),next[id] == nil else {return false}
            let node:SCNNode
            if let value=entity["model"] as? [String:Any],let model=ParallaxAssetCache.Model.parse(value),let prototype=models[model.sha256] {
                node=ParallaxModelPreparation.modelNode(prototype:prototype,widthMeters:width,sourceWidthMeters:model.sourceWidthMeters)
            } else {
                guard entity["model"] == nil else { return false }
                let geometry=SCNPlane(width:CGFloat(width),height:CGFloat(width*0.7))
            let image=UIGraphicsImageRenderer(size:CGSize(width:1024,height:716)).image{context in
                UIColor(red:0.91,green:0.84,blue:0.67,alpha:1).setFill();context.fill(CGRect(x:0,y:0,width:1024,height:716))
                (text as NSString).draw(in:CGRect(x:70,y:60,width:884,height:596),withAttributes:[.font:UIFont.systemFont(ofSize:40),.foregroundColor:UIColor.darkGray])
            }
            geometry.firstMaterial?.diffuse.contents=image;geometry.firstMaterial?.isDoubleSided=true
                node=SCNNode(geometry:geometry)
                // v2 leaves the anchor's +Y surface normal canonical for all content.
                // Only legacy plane geometry changes its local facing from +Z to +Y.
                node.simdOrientation=Self.quadOrientation(deliveryVersion:transfer.deliveryVersion,surfaceRelative:surfaceAnchors.contains(entity["anchorId"] as? String ?? ""))
            }
            // ARKit owns each anchor node. Authored changes stay on its child, so
            // timeline/state redraws retain anchors and their tracking history.
            var entityPose=simd_float4x4(simd_quatf(ix:Float(qx),iy:Float(qy),iz:Float(qz),r:Float(qw)))
            entityPose.columns.3=SIMD4<Float>(Float(x),Float(y),Float(z),1)
            poses[id]=entityPose
            let frame=softwareFixture ? matrix_identity_float4x4 : anchorFrames[id] ?? entityPose
            let root=ParallaxModelPreparation.entityRoot(content:node,id:id,entityPose:entityPose,anchorFrame:frame,scale:scale,opacity:(entity["opacity"] as? Double) ?? 1,hidden:(!softwareFixture && lastTracking != "NORMAL") || entity["visible"] as? Bool == false)
            next[id]=root
        }
        // Validate/build the complete next graph before changing live anchors.
        for (id,anchor) in anchors where next[id] == nil { arScene?.session.remove(anchor:anchor);anchors.removeValue(forKey:id);anchorFrames.removeValue(forKey:id) }
        if !softwareFixture { for (id,pose) in poses where anchors[id] == nil { let anchor=ARAnchor(name:id,transform:pose);anchors[id]=anchor;anchorFrames[id]=pose;arScene?.session.add(anchor:anchor) } }
        nodes.values.forEach{$0.removeFromParentNode()};nodes=next;entities=input
        for (id,node) in nodes { if softwareFixture { scene.scene?.rootNode.addChildNode(node) } else if let anchor=anchors[id],let parent=arScene?.node(for:anchor) { parent.addChildNode(node) } }
        if let id=selected,!eligible(id) { selected=nil }
        phase="READY";updatePresentation();return true
    }
    func renderer(_ renderer: SCNSceneRenderer, didAdd node: SCNNode, for anchor: ARAnchor) {
        DispatchQueue.main.async { [weak self] in guard let self=self,self.active,let id=anchor.name,self.anchors[id]?.identifier == anchor.identifier,let content=self.nodes[id] else { return };node.addChildNode(content) }
    }
    func session(_ session:ARSession,didUpdate frame:ARFrame){
        let state:String
        switch frame.camera.trackingState {
        case .normal:state="NORMAL"
        case .notAvailable:state="LOST"
        case .limited(let reason):
            switch reason {case .excessiveMotion:state="LIMITED_EXCESSIVE_MOTION";case .insufficientFeatures:state="LIMITED_FEATURES";case .relocalizing:state="RELOCALIZING";case .initializing:state="MAPPING";@unknown default:state="LOST"}
        }
        DispatchQueue.main.async { [weak self] in
            self?.applyTrackingState(state)
        }
    }
    func applyTrackingState(_ state:String) {
        guard active,!softwareFixture else{return}
        normalFrames=state == "NORMAL" ? normalFrames+1:0
        if state != lastTracking || (state == "NORMAL" && normalFrames<=3){lastTracking=state;send(["type":"parallax-tracking","state":state])}
        if state != "NORMAL" {selected=nil}
        for (id,node) in nodes { node.isHidden=state != "NORMAL" || entities.first(where:{$0["id"] as? String == id})?["visible"] as? Bool == false }
        updatePresentation()
    }
    func sessionShouldAttemptRelocalization(_ session:ARSession) -> Bool { active }
    func sessionWasInterrupted(_ session:ARSession){DispatchQueue.main.async{[weak self] in
        self?.applyTrackingState("RELOCALIZING")
    }}
    func sessionInterruptionEnded(_ session:ARSession){DispatchQueue.main.async{[weak self] in
        self?.applyTrackingState("RELOCALIZING")
    }}
    func session(_ session:ARSession,didFailWithError error:Error){DispatchQueue.main.async{[weak self] in self?.stop()}}
}
