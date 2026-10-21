import ARKit
import SceneKit
import AVFoundation
import UIKit
import simd
import GLTFKit2

/// Foreground, local-only AR provider. No frames, meshes, calibration images or world maps leave this controller.
final class ParallaxLocalRuntime: UIViewController, ARSCNViewDelegate, ARSessionDelegate, UIAdaptivePresentationControllerDelegate {
    private let scene = ARSCNView(frame: .zero)
    private let status = UILabel()
    private let controls = UIStackView()
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
    init(sessionId: String, epoch: Int, deliveryVersion: Int = 1, versionChecksum: String? = nil, instanceId: String? = nil, origin: URL? = nil, cookies: @escaping (@escaping ([HTTPCookie]) -> Void) -> Void = { $0([]) }) {
        transfer = ParallaxSceneTransfer(sessionId:sessionId,epoch:epoch,deliveryVersion:deliveryVersion,versionChecksum:versionChecksum,instanceId:instanceId)
        assets=ParallaxAssetCache(origin:origin,cookies:cookies);super.init(nibName:nil,bundle:nil)
    }
    required init?(coder: NSCoder) { fatalError("Programmatic local provider only") }
    private func send(_ value: [String:Any]) { guard active else { return }; var event = value; event["sessionId"] = transfer.sessionId; event["epoch"] = transfer.epoch; emit?(event) }
    var emit: (([String:Any]) -> Void)?
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
        scene.delegate = self; scene.session.delegate = self; scene.automaticallyUpdatesLighting = true
        scene.autoenablesDefaultLighting = true; view.addSubview(scene)
        let tap=UITapGestureRecognizer(target:self,action:#selector(pick(_:))); scene.addGestureRecognizer(tap)
        status.text="Move your device slowly. Guided View remains available."; status.numberOfLines=0
        status.textColor = .white; status.backgroundColor=UIColor.black.withAlphaComponent(0.65)
        status.translatesAutoresizingMaskIntoConstraints=false; view.addSubview(status)
        controls.axis = .vertical;controls.spacing=10;controls.translatesAutoresizingMaskIntoConstraints=false
        for (name,action) in [("Inspect selected object",#selector(inspect)),("Place on a surface",#selector(place)),("Return to Guided View",#selector(closeLens))] {
            let button=UIButton(type:.system);button.setTitle(name,for:.normal);button.setTitleColor(.white,for:.normal)
            button.backgroundColor=UIColor(red:0.07,green:0.2,blue:0.25,alpha:0.95);button.layer.cornerRadius=10
            button.heightAnchor.constraint(greaterThanOrEqualToConstant:48).isActive=true
            button.addTarget(self,action:action,for:.touchUpInside);controls.addArrangedSubview(button)
        }
        view.addSubview(controls)
        NSLayoutConstraint.activate([status.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor,constant:12),status.leadingAnchor.constraint(equalTo:view.leadingAnchor,constant:16),status.trailingAnchor.constraint(equalTo:view.trailingAnchor,constant:-16),controls.leadingAnchor.constraint(equalTo:view.leadingAnchor,constant:16),controls.trailingAnchor.constraint(equalTo:view.trailingAnchor,constant:-16),controls.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor,constant:-12)])
        let configuration=ARWorldTrackingConfiguration();configuration.planeDetection=[.horizontal,.vertical]
        configuration.environmentTexturing = .automatic
        scene.session.run(configuration)
    }
    func stop() {
        guard active else { return }
        active = false; lastTracking = "INTERRUPTED"; normalFrames = 0; selected = nil; transfer.clear();transfer.completeActivation()
        renderGeneration += 1;let pending=pendingRender;pendingRender=nil;pending?(false);assets.stop()
        scene.session.pause();anchors.values.forEach{scene.session.remove(anchor:$0)};anchors.removeAll();anchorFrames.removeAll()
        nodes.values.forEach{$0.removeFromParentNode()}; nodes.removeAll();modelNodes.removeAll();entities=[]
        scene.delegate=nil;scene.session.delegate=nil;scene.scene=SCNScene()
        if presentedViewController != nil { presentedViewController?.dismiss(animated:false) }
        dismiss(animated:false)
        terminated?(); terminated = nil
        emit?(["type":"parallax-tracking","state":"INTERRUPTED","sessionId":transfer.sessionId,"epoch":transfer.epoch])
    }
    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) { stop() }
    override func viewDidDisappear(_ animated: Bool) { super.viewDidDisappear(animated); if isBeingDismissed || presentingViewController == nil { stop() } }
    @objc private func closeLens(){ stop() }
    @objc private func pick(_ gesture:UITapGestureRecognizer){
        guard active, lastTracking == "NORMAL" else{return}
        let result=scene.hitTest(gesture.location(in:scene),options:[.searchMode:SCNHitTestSearchMode.closest.rawValue]).first
        selected=Self.entityId(for:result?.node,entities:nodes)
        if let id=selected, permits(id,"PICK") {send(["type":"parallax-interaction","entityId":id,"interactionType":"PICK"])}
    }
    @objc private func inspect(){
        guard active, let id=selected,permits(id,"INSPECT"),let entity=entities.first(where:{$0["id"] as? String == id}),lastTracking == "NORMAL" else{return}
        let alert=UIAlertController(title:"Inspect object",message:entity["content"] as? String,preferredStyle:.alert)
        alert.addAction(UIAlertAction(title:"Return to the Lens",style:.default));present(alert,animated:false)
        send(["type":"parallax-interaction","entityId":id,"interactionType":"INSPECT"])
    }
    @objc private func place(){if active,let id=selected,permits(id,"PLACE"),lastTracking == "NORMAL" {send(["type":"parallax-interaction","entityId":id,"interactionType":"PLACE"])}}
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
        guard active, lastTracking == "NORMAL",let query=scene.raycastQuery(from:CGPoint(x:scene.bounds.midX,y:scene.bounds.midY),allowing:.existingPlaneGeometry,alignment:alignment == "VERTICAL" ? .vertical : .horizontal),let hit=scene.session.raycast(query).first else{return nil}
        return pose(hit.worldTransform)
    }
    private func pose(_ matrix:simd_float4x4)->[String:Any]{
        let q=simd_quatf(matrix);let p=matrix.columns.3
        return ["position":["x":Double(p.x),"y":Double(p.y),"z":Double(p.z)],"rotation":["x":Double(q.imag.x),"y":Double(q.imag.y),"z":Double(q.imag.z),"w":Double(q.real)],"scale":1]
    }
    func render(_ input:[[String:Any]])->Bool {
        guard active, ParallaxSceneTransfer.validEntities(input) else{return false}
        activate(input,models:[:]);return true
    }
    func renderScene(_ delivery: [String:Any], completion: @escaping (Bool) -> Void) {
        guard active, ParallaxSceneDelivery.valid(delivery,version:transfer.deliveryVersion,checksum:transfer.versionChecksum,instanceId:transfer.instanceId),
              let input=delivery["entities"] as? [[String:Any]],pendingRender == nil else { completion(false);return }
        renderGeneration += 1;let generation=renderGeneration;pendingRender=completion
        func finish(_ accepted: Bool) {
            guard self.renderGeneration == generation else { return }
            self.transfer.completeActivation()
            let done=self.pendingRender;self.pendingRender=nil;done?(accepted)
        }
        DispatchQueue.main.asyncAfter(deadline:.now()+55) { [weak self] in
            guard let self=self,self.renderGeneration == generation,self.pendingRender != nil else { return }
            self.renderGeneration += 1;let done=self.pendingRender;self.pendingRender=nil;self.stop();done?(false)
        }
        let models=input.compactMap{$0["model"] as? [String:Any]}.compactMap{ParallaxAssetCache.Model.parse($0)}
        let surfaceAnchors=Set((delivery["anchors"] as? [[String:Any]] ?? []).filter{$0["kind"] as? String == "SURFACE_RELATIVE"}.compactMap{$0["id"] as? String})
        var loaded:[String:SCNNode]=[:]
        func stage(_ index: Int) {
            guard self.active,self.renderGeneration == generation else { return }
            guard index < models.count else { self.activate(input,models:loaded,surfaceAnchors:surfaceAnchors);finish(true);return }
            let model=models[index]
            if let cached=self.modelNodes[model.sha256] { loaded[model.sha256]=cached;stage(index+1);return }
            self.assets.load(model) { [weak self] url in
                guard let self=self,self.active,self.renderGeneration == generation else { return }
                guard let url=url else { finish(false);return }
                GLTFAsset.load(with:url,options:[:]) { _,status,asset,error,_ in
                    if status == .error { DispatchQueue.main.async { finish(false) };return }
                    guard status == .complete, error == nil, let asset=asset else { return }
                    let source=GLTFSCNSceneSource(asset:asset)
                    guard let imported=source.defaultScene else { DispatchQueue.main.async { finish(false) };return }
                    let prototype=ParallaxModelPreparation.prototype(from:imported)
                    DispatchQueue.main.async {
                        guard self.active,self.renderGeneration == generation else { return }
                        self.modelNodes[model.sha256]=prototype;loaded[model.sha256]=prototype;stage(index+1)
                    }
                }
            }
        }
        stage(0)
    }
    private func activate(_ input:[[String:Any]],models:[String:SCNNode],surfaceAnchors:Set<String> = []) {
        var next:[String:SCNNode]=[:]
        for entity in input {
            guard let id=entity["id"] as? String, id.utf16.count<=128, let text=entity["content"] as? String,text.utf16.count<=2000,
                  let width=entity["widthMeters"] as? Double,(0.01...5).contains(width),let transform=entity["transform"] as? [String:Any],
                  let p=transform["position"] as? [String:Double],let q=transform["rotation"] as? [String:Double],let scale=transform["scale"] as? Double,
                  let x=p["x"],let y=p["y"],let z=p["z"],let qx=q["x"],let qy=q["y"],let qz=q["z"],let qw=q["w"],
                  [x,y,z,qx,qy,qz,qw,scale].allSatisfy({$0.isFinite}),[x,y,z].allSatisfy({abs($0)<=1000000}),abs(sqrt(qx*qx+qy*qy+qz*qz+qw*qw)-1)<0.00001,scale > 0, scale <= 100000000, (0.000001...100).contains(width*scale) else {return}
            let node:SCNNode
            if let value=entity["model"] as? [String:Any],let model=ParallaxAssetCache.Model.parse(value),let prototype=models[model.sha256] {
                node=ParallaxModelPreparation.modelNode(prototype:prototype,widthMeters:width,sourceWidthMeters:model.sourceWidthMeters)
            } else {
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
            if anchors[id] == nil { let anchor=ARAnchor(name:id,transform:entityPose);anchors[id]=anchor;anchorFrames[id]=entityPose;scene.session.add(anchor:anchor) }
            let root=ParallaxModelPreparation.entityRoot(content:node,id:id,entityPose:entityPose,anchorFrame:anchorFrames[id] ?? matrix_identity_float4x4,scale:scale,opacity:(entity["opacity"] as? Double) ?? 1,hidden:lastTracking != "NORMAL" || entity["visible"] as? Bool == false)
            next[id]=root
        }
        for (id,anchor) in anchors where next[id] == nil { scene.session.remove(anchor:anchor);anchors.removeValue(forKey:id);anchorFrames.removeValue(forKey:id) }
        nodes.values.forEach{$0.removeFromParentNode()};nodes=next;entities=input
        for (id,node) in nodes { if let anchor=anchors[id],let parent=scene.node(for:anchor) { parent.addChildNode(node) } }
        if let id=selected,!permits(id,"INSPECT") { selected=nil }
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
            guard let self=self, self.active else{return};self.normalFrames=state == "NORMAL" ? self.normalFrames+1:0
            if state != self.lastTracking || (state == "NORMAL" && self.normalFrames<=3){self.lastTracking=state;self.send(["type":"parallax-tracking","state":state])}
            if state != "NORMAL" { self.selected=nil }
            for (id,node) in self.nodes {node.isHidden=state != "NORMAL" || self.entities.first(where:{$0["id"] as? String == id})?["visible"] as? Bool == false}
            self.status.text=state == "NORMAL" ? "Tap an object to choose it. Use Inspect to read it." : "Finding the space again. Return to Guided View whenever you like."
        }
    }
    func sessionShouldAttemptRelocalization(_ session:ARSession) -> Bool { active }
    func sessionWasInterrupted(_ session:ARSession){DispatchQueue.main.async{[weak self] in
        guard let self=self,self.active else{return};self.lastTracking="RELOCALIZING";self.normalFrames=0;self.selected=nil;self.nodes.values.forEach{$0.isHidden=true};self.send(["type":"parallax-tracking","state":"RELOCALIZING"])
    }}
    func sessionInterruptionEnded(_ session:ARSession){DispatchQueue.main.async{[weak self] in
        guard let self=self,self.active else{return};self.status.text="Return near the place you began to recover the scene, or return to Guided View."
    }}
    func session(_ session:ARSession,didFailWithError error:Error){DispatchQueue.main.async{[weak self] in self?.stop()}}
}
