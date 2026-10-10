import ARKit
import SceneKit
import AVFoundation
import UIKit
import simd

/// Foreground, local-only AR provider. No frames, meshes, calibration images or world maps leave this controller.
final class ParallaxLocalRuntime: UIViewController, ARSCNViewDelegate, ARSessionDelegate, UIAdaptivePresentationControllerDelegate {
    private let scene = ARSCNView(frame: .zero)
    private let status = UILabel()
    private let controls = UIStackView()
    private var entities: [[String:Any]] = []
    private var nodes: [String:SCNNode] = [:]
    private var selected: String?
    private var lastTracking = "INITIALIZING"
    private var normalFrames = 0
    let transfer: ParallaxSceneTransfer
    private var active = true
    var terminated: (() -> Void)?
    init(sessionId: String, epoch: Int) { transfer = ParallaxSceneTransfer(sessionId: sessionId, epoch: epoch); super.init(nibName: nil, bundle: nil) }
    required init?(coder: NSCoder) { fatalError("Programmatic local provider only") }
    private func send(_ value: [String:Any]) { guard active else { return }; var event = value; event["sessionId"] = transfer.sessionId; event["epoch"] = transfer.epoch; emit?(event) }
    var emit: (([String:Any]) -> Void)?
    static func state() -> [String:Any] {
        let authorization = AVCaptureDevice.authorizationStatus(for: .video)
        return ["sceneTransferVersion":1, "supported": ARWorldTrackingConfiguration.isSupported,
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
        scene.session.run(configuration)
    }
    func stop() {
        guard active else { return }
        active = false; lastTracking = "INTERRUPTED"; normalFrames = 0; selected = nil; transfer.clear()
        scene.session.pause(); nodes.values.forEach{$0.removeFromParentNode()}; nodes.removeAll(); entities=[]
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
        if let id=result?.node.name,nodes[id] != nil {selected=id;send(["type":"parallax-interaction","entityId":id,"interactionType":"PICK"])}
    }
    @objc private func inspect(){
        guard let id=selected ?? entities.first?["id"] as? String,let entity=entities.first(where:{$0["id"] as? String == id}),lastTracking == "NORMAL" else{return}
        let alert=UIAlertController(title:"Inspect object",message:entity["content"] as? String,preferredStyle:.alert)
        alert.addAction(UIAlertAction(title:"Return to the Lens",style:.default));present(alert,animated:false)
        send(["type":"parallax-interaction","entityId":id,"interactionType":"INSPECT"])
    }
    @objc private func place(){if let id=selected ?? entities.first?["id"] as? String,lastTracking == "NORMAL" {send(["type":"parallax-interaction","entityId":id,"interactionType":"PLACE"])}}
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
        var next:[String:SCNNode]=[:]
        for entity in input {
            guard let id=entity["id"] as? String, id.utf16.count<=128, let text=entity["content"] as? String,text.utf16.count<=2000,
                  let width=entity["widthMeters"] as? Double,(0.01...5).contains(width),let transform=entity["transform"] as? [String:Any],
                  let p=transform["position"] as? [String:Double],let q=transform["rotation"] as? [String:Double],let scale=transform["scale"] as? Double,
                  let x=p["x"],let y=p["y"],let z=p["z"],let qx=q["x"],let qy=q["y"],let qz=q["z"],let qw=q["w"],
                  [x,y,z,qx,qy,qz,qw,scale].allSatisfy({$0.isFinite}),[x,y,z].allSatisfy({abs($0)<=1000000}),abs(sqrt(qx*qx+qy*qy+qz*qz+qw*qw)-1)<0.00001,scale > 0, scale <= 100000000, (0.000001...100).contains(width*scale) else {return false}
            let geometry=SCNPlane(width:CGFloat(width),height:CGFloat(width*0.7))
            let image=UIGraphicsImageRenderer(size:CGSize(width:1024,height:716)).image{context in
                UIColor(red:0.91,green:0.84,blue:0.67,alpha:1).setFill();context.fill(CGRect(x:0,y:0,width:1024,height:716))
                (text as NSString).draw(in:CGRect(x:70,y:60,width:884,height:596),withAttributes:[.font:UIFont.systemFont(ofSize:40),.foregroundColor:UIColor.darkGray])
            }
            geometry.firstMaterial?.diffuse.contents=image;geometry.firstMaterial?.isDoubleSided=true
            let node=SCNNode(geometry:geometry);node.name=id;node.position=SCNVector3(Float(x),Float(y),Float(z))
            node.orientation=SCNQuaternion(Float(qx),Float(qy),Float(qz),Float(qw));node.scale=SCNVector3(Float(scale),Float(scale),Float(scale))
            next[id]=node
        }
        nodes.values.forEach{$0.removeFromParentNode()};nodes=next;entities=input
        nodes.values.forEach{scene.scene.rootNode.addChildNode($0)};return true
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
            self.status.text=state == "NORMAL" ? "Tap an object to choose it. Use Inspect to read it." : "Finding the space again. Return to Guided View whenever you like."
        }
    }
    func sessionWasInterrupted(_ session:ARSession){DispatchQueue.main.async{[weak self] in self?.stop()}}
    func session(_ session:ARSession,didFailWithError error:Error){DispatchQueue.main.async{[weak self] in self?.stop()}}
}
