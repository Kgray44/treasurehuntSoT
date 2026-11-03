import XCTest
import SceneKit
import Metal
import GLTFKit2
import CryptoKit
import ImageIO
import UniformTypeIdentifiers
import UIKit
import simd
@testable import LandfallCompanion

/// Camera-free software evidence for the production SceneKit preparation boundary.
/// All renderer work is serialized off the main thread. A separate publication lock
/// lets XCTest seal a timed-out result without waiting for a stalled GPU/encoder.
final class ParallaxModelRasterFixture {
    struct Snapshot { let report: [String:Any]; let images: [(String,Data)] }
    private struct Failure: Error { let message: String }
    private struct SelectionPixels { let opaque: CGPoint; let mirror: CGPoint; let background: CGPoint }
    private let queue=DispatchQueue(label:"voyagewright.ncl01.scenekit-proof")
    private let publication=NSLock()
    private let bundle: Bundle
    private let started: TimeInterval
    private let deadline: TimeInterval
    private let finished: XCTestExpectation
    private var sealed=false, ended=false
    private var report: [String:Any]=[
        "schemaVersion":1,"evidenceClass":"INSTRUMENTED_SCENEKIT_GLTF_RENDERING_ONLY",
        "fixtureUsesCamera":false,"fixtureCreatesARSession":false,"physicalTrackingProven":false,
        "productionBoundary":"Prototype clone/sanitize, width normalization, entity root relative to a supplied anchor frame and hit-node ancestry to authored entity ID",
        "testOwnedBoundary":"Nonidentity rigid anchor frame, camera, lighting, offscreen Metal target and geometry hit queries in its viewport",
        "productionActivateOrARAnchorPathExercised":false,"physicalMaterialFidelityProven":false,
        "arViewTouchCoordinateMappingProven":false,"physicalInspectInteractionProven":false,
        "gpuDriverMemoryReleaseProven":false,"deadlineSeconds":20,
    ]
    private var images: [(String,Data)]=[]
    private var frames: [[String:Any]]=[]
    private var assets: [[String:Any]]=[]
    private var device: MTLDevice?
    private var commands: MTLCommandQueue?
    private var renderer: SCNRenderer?
    private var scene: SCNScene?
    private var colorTarget: MTLTexture?
    private var depthTarget: MTLTexture?
    private var inFlight=false
    private let size=256
    private let tolerance: Float=0.0001

    init(bundle: Bundle, started: TimeInterval, deadline: TimeInterval, finished: XCTestExpectation) {
        self.bundle=bundle;self.started=started;self.deadline=deadline;self.finished=finished
    }
    func start() { queue.async { self.perform { try self.preflight() } } }
    private var open: Bool {
        publication.lock();defer { publication.unlock() }
        return !sealed && !ended && ProcessInfo.processInfo.systemUptime < deadline
    }
    private func record(_ key: String, _ value: Any) {
        publication.lock();defer { publication.unlock() }
        if !sealed && !ended { report[key]=value }
    }
    private func phase(_ value: String) { record("phase",value) }
    private func require(_ condition: Bool, _ message: String) throws {
        if !condition { throw Failure(message:message) }
    }
    private func requireTime() throws {
        try require(open,"The single monotonic SceneKit proof deadline expired")
    }
    private func perform(_ operation: () throws -> Void) {
        guard open else { if !inFlight { releaseOwners() };return }
        do { try operation() }
        catch { end(failure:(error as? Failure)?.message ?? String(describing:error)) }
    }
    func seal(timedOut: Bool) -> Snapshot {
        publication.lock();defer { publication.unlock() }
        sealed=true
        if timedOut || !ended {
            report["result"]="FAIL";report["failure"]="One 20-second monotonic proof deadline expired before completion"
            report["cleanup"]="UNOBSERVED_OR_DEFERRED_UNTIL_IN_FLIGHT_WORK_COMPLETES"
        }
        report["sealedElapsedMs"]=(ProcessInfo.processInfo.systemUptime-started)*1000
        return Snapshot(report:report,images:images)
    }
    private func releaseOwners() {
        scene?.rootNode.childNodes.forEach { $0.removeFromParentNode() }
        renderer?.pointOfView=nil;renderer?.scene=nil
        scene=nil;renderer=nil;colorTarget=nil;depthTarget=nil;commands=nil;device=nil
    }
    private func end(failure: String? = nil) {
        // Never tear down owners under an executing command buffer. Its handler
        // captures the renderer, scene and textures through GPU completion.
        if !inFlight { releaseOwners() }
        publication.lock();defer { publication.unlock() }
        guard !sealed && !ended else { return }
        let completedAt=ProcessInfo.processInfo.systemUptime
        let finalFailure=failure ?? (completedAt>deadline ? "Proof cleanup exceeded the single monotonic deadline":nil)
        ended=true;report["result"]=finalFailure == nil ? "PASS":"FAIL"
        if let failure=finalFailure { report["failure"]=failure }
        report["completedElapsedMs"]=(completedAt-started)*1000
        report["cleanup"]=inFlight ? "DEFERRED_UNTIL_IN_FLIGHT_COMMAND_COMPLETES":"SCENE_DETACHED_AND_FIXTURE_OWNERS_RELEASED"
        // The seal and fulfillment are atomic with respect to the waiter. Late
        // callbacks cannot mutate a finalized XCTest or its published evidence.
        finished.fulfill()
    }

    private func texture(width: Int, height: Int, format: MTLPixelFormat, shared: Bool) throws -> MTLTexture {
        let descriptor=MTLTextureDescriptor.texture2DDescriptor(pixelFormat:format,width:width,height:height,mipmapped:false)
        descriptor.usage=[.renderTarget];descriptor.storageMode=shared ? .shared:.private
        guard let result=device?.makeTexture(descriptor:descriptor) else { throw Failure(message:"Metal target allocation failed") }
        return result
    }
    private func preflight() throws {
        phase("METAL_DEVICE_PREFLIGHT")
        guard let available=MTLCreateSystemDefaultDevice() else {
            record("metalPreflight",["deviceAvailable":false,"readableCompletedTarget":false])
            throw Failure(message:"Actual Simulator MTLCreateSystemDefaultDevice returned nil; raster proof is unavailable")
        }
        device=available
        record("metalPreflight",["deviceAvailable":true,"deviceName":available.name,"registryID":String(available.registryID),"readableCompletedTarget":false])
        guard let commandQueue=available.makeCommandQueue(),let command=commandQueue.makeCommandBuffer() else { throw Failure(message:"Metal preflight command queue/buffer unavailable") }
        commands=commandQueue
        let target=try texture(width:8,height:8,format:.bgra8Unorm,shared:true)
        let pass=MTLRenderPassDescriptor();pass.colorAttachments[0].texture=target
        pass.colorAttachments[0].loadAction = .clear;pass.colorAttachments[0].storeAction = .store
        pass.colorAttachments[0].clearColor=MTLClearColor(red:64.0/255,green:128.0/255,blue:191.0/255,alpha:1)
        guard let encoder=command.makeRenderCommandEncoder(descriptor:pass) else { throw Failure(message:"Metal preflight clear encoder unavailable") }
        encoder.endEncoding()
        phase("METAL_PREFLIGHT_SUBMITTED");inFlight=true;record("inFlightCommand",true)
        command.addCompletedHandler { [target,available] completed in
            let callbackAt=ProcessInfo.processInfo.systemUptime
            self.queue.async {
                self.inFlight=false
                self.perform {
                    self.record("inFlightCommand",false)
                    self.record("metalPreflight",["deviceAvailable":true,"deviceName":available.name,"registryID":String(available.registryID),"readableCompletedTarget":false,"commandStatus":String(describing:completed.status),"commandStatusRawValue":completed.status.rawValue,"commandError":String(describing:completed.error),"callbackElapsedMs":(callbackAt-self.started)*1000])
                    try self.require(callbackAt<=self.deadline,"Metal preflight completed after the single deadline")
                    try self.require(completed.status == .completed && completed.error == nil,"Metal preflight command failed: \(String(describing:completed.error))")
                    let bytes=self.read(target)
                    let expected=[191,128,64,255]
                    try self.require(bytes.enumerated().allSatisfy { abs(Int($0.element)-expected[$0.offset%4])<=1 },"Completed Metal preflight target did not contain its expected BGRA clear pixels")
                    self.record("metalPreflight",["deviceAvailable":true,"deviceName":available.name,"registryID":String(available.registryID),"readableCompletedTarget":true,"commandStatus":"completed","storageMode":"shared","expectedBGRA":expected,"sampleBGRA":Array(bytes.prefix(4)),"completedElapsedMs":(callbackAt-self.started)*1000])
                    try self.requireTime()
                    self.renderer=SCNRenderer(device:available,options:nil)
                    self.renderer?.autoenablesDefaultLighting=false;self.renderer?.isJitteringEnabled=false
                    self.colorTarget=try self.texture(width:self.size,height:self.size,format:.bgra8Unorm,shared:true)
                    self.depthTarget=try self.texture(width:self.size,height:self.size,format:.depth32Float,shared:false)
                    self.record("sameColorTargetAcrossAllModelFrames",true)
                    self.loadAsset(index:0)
                }
            }
        }
        command.commit()
    }

    private func loadAsset(index: Int) {
        perform {
            guard index<2 else {
                phase("ALL_MODELS_CLEARED");try require(assets.count==2 && frames.count==6,"Both originals require empty/populated/removed frame evidence")
                try requireTime();end();return
            }
            let id=["treasure-chest","brass-compass"][index]
            phase("IMPORT_"+id)
            guard let url=bundle.url(forResource:id,withExtension:"glb") else { throw Failure(message:"Original bundled GLB missing: "+id) }
            let chest=id == "treasure-chest",width=chest ? 0.8:0.16
            let digest=chest ? "2e31b5eed11242e583cfc99a5491ff2e4b10dec0d4fed5d90dffe1ccab122e6f":"5af1158b1a7f2b3339c159fbdca8b9d3d29020eaa06d41848bf5c04c0a682ccb"
            let bytes=try Data(contentsOf:url)
            try require(bytes.count == (chest ? 630120:313396),"Original GLB byte length changed")
            try require(SHA256.hash(data:bytes).map { String(format:"%02x",$0) }.joined() == digest,"Original GLB digest changed")
            try require(ParallaxAssetCache.selfContainedGLB(bytes),"Catalog model must remain self-contained")
            GLTFAsset.load(with:url,options:[:]) { _,status,asset,error,_ in
                guard status == .complete || status == .error else { return }
                self.queue.async {
                    self.perform {
                        try self.require(status == .complete && error == nil,"Catalog GLB import failed: \(String(describing:error))")
                        guard let asset=asset,let imported=GLTFSCNSceneSource(asset:asset).defaultScene else { throw Failure(message:"SceneKit graph missing") }
                        try self.prepareAsset(id:id,index:index,width:width,digest:digest,imported:imported)
                    }
                }
            }
        }
    }

    private func prepareAsset(id: String, index: Int, width: Double, digest: String, imported: SCNScene) throws {
        phase("PREPARE_"+id)
        let prototype=ParallaxModelPreparation.prototype(from:imported)
        try compareChildren(imported.rootNode,prototype)
        var geometries=0,materials=Set<ObjectIdentifier>()
        prototype.enumerateChildNodes { node,_ in
            if let geometry=node.geometry { geometries += 1;geometry.materials.forEach { materials.insert(ObjectIdentifier($0)) } }
        }
        try require(geometries>0 && materials.count>=4,"Original geometry and four authored material assignments must survive import")
        let original=try bounds(prototype,relativeTo:prototype)
        let dimensions: [Float]=id == "treasure-chest" ? [0.8,0.61,0.5]:[0.16,0.045,0.19]
        for axis in 0..<3 { try require(abs(original[axis+3]-original[axis]-dimensions[axis])<=tolerance,"Original authored meter dimensions changed") }
        try require(abs(original[1])<=tolerance && abs(original[0]+original[3])<=tolerance && abs(original[2]+original[5])<=tolerance,"Original bottom-center pivot changed")
        let model=ParallaxModelPreparation.modelNode(prototype:prototype,widthMeters:width*1.25,sourceWidthMeters:width)
        try compareChildren(prototype,model)
        var pose=simd_float4x4(simd_quatf(angle:Float.pi/6,axis:SIMD3<Float>(0,1,0)))
        pose.columns.3=SIMD4<Float>(0.23,0.17,-0.31,1)
        var frame=simd_float4x4(simd_quatf(angle:-Float.pi/12,axis:SIMD3<Float>(0,1,0)))
        frame.columns.3=SIMD4<Float>(-0.13,0.08,0.21,1)
        let anchorFrame=SCNNode();anchorFrame.simdTransform=frame
        let entityId="fixture-model-"+id
        let root=ParallaxModelPreparation.entityRoot(content:model,id:entityId,entityPose:pose,anchorFrame:frame,scale:1.2,opacity:1,hidden:false)
        anchorFrame.addChildNode(root)
        var normalization=matrix_identity_float4x4
        normalization.columns.0.x=1.5;normalization.columns.1.y=1.5;normalization.columns.2.z=1.5
        let expected=try bounds(prototype,relativeTo:prototype,extra:pose*normalization)
        let transformed=try bounds(root,relativeTo:nil)
        for component in 0..<6 { try require(abs(expected[component]-transformed[component])<=tolerance,"Production entity transform/width normalization changed authored bounds") }
        try require(root.name == entityId && entityId != id && !root.isHidden && root.opacity == 1,"Prepared authored entity identity and visibility changed")
        var result: [String:Any]=["assetId":id,"entityId":entityId,"sha256":digest,"geometryNodes":geometries,"materialInstances":materials.count,"originalBoundsMeters":original,"transformedBoundsMeters":transformed,"sourceWidthMeters":width,"widthNormalization":1.25,"entityScale":1.2,"entityYawRadians":Float.pi/6,"entityTranslationMeters":[0.23,0.17,-0.31],"testAnchorFrameYawRadians":-Float.pi/12,"testAnchorFrameTranslationMeters":[-0.13,0.08,0.21],"authoredChildMatricesAndMaterialObjectsPreserved":true,"bottomCenterPivotPreserved":true]
        let ownedScene=SCNScene();ownedScene.background.contents=UIColor.clear
        let camera=SCNNode();camera.camera=SCNCamera();camera.camera?.fieldOfView=45
        camera.camera?.zNear=0.001;camera.camera?.zFar=100
        let center=SIMD3<Float>((transformed[0]+transformed[3])/2,(transformed[1]+transformed[4])/2,(transformed[2]+transformed[5])/2)
        let extent=max(transformed[3]-transformed[0],max(transformed[4]-transformed[1],transformed[5]-transformed[2]))
        camera.simdPosition=center+SIMD3<Float>(extent*1.2,extent,extent*2.2)
        camera.look(at:SCNVector3(center.x,center.y,center.z));ownedScene.rootNode.addChildNode(camera)
        let ambient=SCNNode();ambient.light=SCNLight();ambient.light?.type = .ambient;ambient.light?.intensity=600
        ownedScene.rootNode.addChildNode(ambient)
        let key=SCNNode();key.light=SCNLight();key.light?.type = .directional;key.light?.intensity=1200
        key.eulerAngles=SCNVector3(-Float.pi/4,Float.pi/4,0);ownedScene.rootNode.addChildNode(key)
        guard let renderer=renderer else { throw Failure(message:"SceneKit renderer missing") }
        scene=ownedScene;renderer.scene=ownedScene;renderer.pointOfView=camera
        renderFrame(name:id+"-empty") { empty,_ in
            try self.require(empty==0,"Empty SceneKit target must have zero nontransparent pixels")
            ownedScene.rootNode.addChildNode(anchorFrame)
            self.phase("ASYNC_GPU_PREPARE_"+id)
            renderer.prepare([root]) { success in
                self.queue.async {
                    self.perform {
                        try self.require(success,"SceneKit asynchronous resource preparation failed")
                        self.renderFrame(name:id+"-populated") { populated,populatedBytes in
                            try self.require(populated>32,"Actual SceneKit frame must rasterize model geometry")
                            self.verifyRenderedSelection(renderer:renderer,root:root,assetId:id,entityId:entityId,bytes:populatedBytes) { selection,pixels in
                                result["geometrySelection"]=selection
                                root.removeFromParentNode()
                                var retainedGeometry=false
                                ownedScene.rootNode.enumerateChildNodes { node,_ in if node.geometry != nil { retainedGeometry=true } }
                                try self.require(root.parent == nil && !retainedGeometry,"Removed model still belongs to rendered scene")
                                self.renderFrame(name:id+"-removed") { removed,removedBytes in
                                    try self.require(removed==0,"Removed SceneKit model retained old pixels")
                                    self.verifyRemovedSelection(renderer:renderer,root:root,entityId:entityId,pixels:pixels,bytes:removedBytes) { removedSelection in
                                        result["removedGeometrySelection"]=removedSelection
                                        result["emptyNontransparentPixels"]=empty;result["renderedNontransparentPixels"]=populated;result["removedNontransparentPixels"]=removed
                                        result["modelDetachedFromScene"]=true
                                        self.assets.append(result);self.record("assets",self.assets)
                                        renderer.scene=nil;renderer.pointOfView=nil;self.scene=nil
                                        self.loadAsset(index:index+1)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private func neighborhoodAlpha(_ point: CGPoint, bytes: [UInt8]) -> [UInt8] {
        let x=Int(point.x),y=Int(point.y)
        return (-3...3).flatMap { dy in (-3...3).map { dx in bytes[((y+dy)*size+x+dx)*4+3] } }
    }
    private func selectionPixels(_ bytes: [UInt8]) throws -> SelectionPixels {
        try require(bytes.count==size*size*4,"Selection requires the original completed BGRA target")
        var chosen: CGPoint?,bestDistance=Double.infinity
        for y in 3..<(size-3) {
            if y%16==0 { try requireTime() }
            // An asymmetric silhouette makes a guessed vertical flip observable:
            // the selected interior is opaque, but its mirror is wholly clear.
            guard abs(Double(y)+0.5-Double(size)/2)>=16 else { continue }
            for x in 3..<(size-3) where bytes[(y*size+x)*4+3]>=240 {
                let point=CGPoint(x:Double(x)+0.5,y:Double(y)+0.5)
                let mirror=CGPoint(x:point.x,y:Double(size)-point.y)
                guard neighborhoodAlpha(point,bytes:bytes).allSatisfy({ $0>=240 }),neighborhoodAlpha(mirror,bytes:bytes).allSatisfy({ $0==0 }) else { continue }
                let distance=pow(Double(point.x)-Double(size)/2,2)+pow(Double(point.y)-Double(size)/2,2)
                if distance<bestDistance { bestDistance=distance;chosen=point }
            }
        }
        guard let opaque=chosen else { throw Failure(message:"Original rendered model has no alpha-safe asymmetric selection interior") }
        let background=CGPoint(x:3.5,y:3.5)
        try require(neighborhoodAlpha(background,bytes:bytes).allSatisfy { $0==0 },"Selection background neighborhood must be wholly transparent")
        return SelectionPixels(opaque:opaque,mirror:CGPoint(x:opaque.x,y:Double(size)-opaque.y),background:background)
    }
    private func mapHits(_ hits: [SCNHitTestResult?], entities: [String:SCNNode], completion: @escaping ([String?]) throws -> Void) {
        // UIViewController's production mapper is main-actor isolated. The graph
        // remains unchanged while this asynchronous, CPU-only hop is in flight.
        // No renderer work or GPU wait moves onto the main queue.
        DispatchQueue.main.async {
            guard self.open else { self.queue.async { self.perform {} };return }
            let identifiers=hits.map { ParallaxLocalRuntime.entityId(for:$0?.node,entities:entities) }
            self.queue.async { self.perform { try self.requireTime();try completion(identifiers) } }
        }
    }
    private func convertedViewportPoint(_ point: CGPoint) -> CGPoint {
        // Fixed opposite Y origins for this origin-zero offscreen target. This
        // involution converts once per direction; it never probes another mapping.
        return CGPoint(x:point.x,y:CGFloat(size)-point.y)
    }
    private func verifyRenderedSelection(renderer: SCNRenderer, root: SCNNode, assetId: String, entityId: String, bytes: [UInt8], completion: @escaping ([String:Any],SelectionPixels) throws -> Void) {
        perform {
            phase("GEOMETRY_HIT_"+assetId);try requireTime()
            let pixels=try selectionPixels(bytes),viewport=renderer.currentViewport
            let opaqueQuery=convertedViewportPoint(pixels.opaque),mirrorQuery=convertedViewportPoint(pixels.mirror),backgroundQuery=convertedViewportPoint(pixels.background)
            func pair(_ point: CGPoint) -> [Double] { [Double(point.x),Double(point.y)] }
            record("selectionProbe",["assetId":assetId,"entityId":entityId,"opaquePixelCenter":pair(pixels.opaque),"transparentVerticalMirrorPixelCenter":pair(pixels.mirror),"backgroundPixelCenter":pair(pixels.background),"sceneKitOpaqueQueryCenter":pair(opaqueQuery),"sceneKitTransparentMirrorQueryCenter":pair(mirrorQuery),"sceneKitBackgroundQueryCenter":pair(backgroundQuery),"readbackToQueryMapping":"x unchanged; queryY = targetHeight - readbackPixelCenterY, exactly once","currentViewport":[Double(viewport.origin.x),Double(viewport.origin.y),Double(viewport.width),Double(viewport.height)]])
            try require(viewport==CGRect(x:0,y:0,width:size,height:size),"Geometry hit viewport differs from the completed Metal target")
            let options: [SCNHitTestOption:Any]=[.searchMode:SCNHitTestSearchMode.closest.rawValue]
            let hit=renderer.hitTest(opaqueQuery,options:options).first
            let mirror=renderer.hitTest(mirrorQuery,options:options).first
            let background=renderer.hitTest(backgroundQuery,options:options).first
            record("selectionProbeHitCounts",["opaque":hit == nil ? 0:1,"transparentVerticalMirror":mirror == nil ? 0:1,"background":background == nil ? 0:1])
            guard let hit=hit else { throw Failure(message:"Actual rendered opaque interior did not hit original SceneKit geometry") }
            try require(hit.node.geometry != nil && hit.node !== root,"Actual model hit must identify imported geometry below the authored entity root")
            try require(mirror == nil && background == nil,"Transparent mirror or background unexpectedly hit SceneKit geometry")
            let world=hit.worldCoordinates,projected=renderer.projectPoint(world)
            try require([world.x,world.y,world.z,projected.x,projected.y,projected.z].allSatisfy { $0.isFinite },"Geometry hit or its projected viewport point is not finite")
            try require(abs(Double(projected.x)-Double(opaqueQuery.x))<=0.51 && abs(Double(projected.y)-Double(opaqueQuery.y))<=0.51 && projected.z>=0 && projected.z<=1,"Real geometry hit does not reproject onto its converted SceneKit query point")
            let projectedReadback=convertedViewportPoint(CGPoint(x:CGFloat(projected.x),y:CGFloat(projected.y)))
            try require(abs(Double(projectedReadback.x)-Double(pixels.opaque.x))<=0.51 && abs(Double(projectedReadback.y)-Double(pixels.opaque.y))<=0.51,"Real geometry hit does not back-convert onto its completed rendered pixel")
            let evidence: [String:Any]=["query":"SCNRenderer.hitTest","searchMode":"closest","boundingBoxOnlyOverride":false,"pixelCoordinateMapping":"x unchanged; queryY = targetHeight - readbackPixelCenterY, exactly once; fixed inverse for projected readback; no fallback","opaquePixelCenter":pair(pixels.opaque),"transparentVerticalMirrorPixelCenter":pair(pixels.mirror),"backgroundPixelCenter":pair(pixels.background),"sceneKitOpaqueQueryCenter":pair(opaqueQuery),"sceneKitTransparentMirrorQueryCenter":pair(mirrorQuery),"sceneKitBackgroundQueryCenter":pair(backgroundQuery),"neighborhoodWidthPixels":7,"opaqueNeighborhoodMinimumAlpha":Int(neighborhoodAlpha(pixels.opaque,bytes:bytes).min()!),"mirrorNeighborhoodMaximumAlpha":Int(neighborhoodAlpha(pixels.mirror,bytes:bytes).max()!),"backgroundNeighborhoodMaximumAlpha":Int(neighborhoodAlpha(pixels.background,bytes:bytes).max()!),"populatedRawBgraSha256":SHA256.hash(data:Data(bytes)).map { String(format:"%02x",$0) }.joined(),"hitNodeName":hit.node.name ?? "","geometryIndex":hit.geometryIndex,"faceIndex":hit.faceIndex,"worldCoordinates":[world.x,world.y,world.z],"projectedViewportCoordinates":[projected.x,projected.y,projected.z],"projectedReadbackCoordinates":pair(projectedReadback),"currentViewport":[Double(viewport.origin.x),Double(viewport.origin.y),Double(viewport.width),Double(viewport.height)]]
            try requireTime()
            mapHits([hit,mirror,background],entities:[entityId:root]) { identifiers in
                try self.require(identifiers.count==3 && identifiers[0]==entityId && identifiers[0] != assetId && identifiers[1]==nil && identifiers[2]==nil,"Real geometry hit did not resolve through the production mapper to the exact authored entity ID, or a miss selected an entity")
                var result=evidence
                result["selectedEntityId"]=identifiers[0]!;result["transparentVerticalMirrorMiss"]=true;result["backgroundMiss"]=true
                result["productionMapper"]="ParallaxLocalRuntime.entityId(for:entities:)";result["verifiedElapsedMs"]=(ProcessInfo.processInfo.systemUptime-self.started)*1000
                try completion(result,pixels)
            }
        }
    }
    private func verifyRemovedSelection(renderer: SCNRenderer, root: SCNNode, entityId: String, pixels: SelectionPixels, bytes: [UInt8], completion: @escaping ([String:Any]) throws -> Void) {
        perform {
            phase("REMOVED_GEOMETRY_HIT_"+entityId);try requireTime()
            let points=[pixels.opaque,pixels.mirror,pixels.background]
            try require(points.allSatisfy { neighborhoodAlpha($0,bytes:bytes).allSatisfy { $0==0 } },"Removed selection neighborhoods retained pixels")
            let queries=points.map { convertedViewportPoint($0) }
            let hits=queries.map { renderer.hitTest($0,options:[.searchMode:SCNHitTestSearchMode.closest.rawValue]).first }
            try require(hits.allSatisfy { $0==nil },"Removed scene geometry still produces a hit")
            // Keep the old root in the lookup to prove misses come from the
            // cleared geometry, rather than merely emptying the identity map.
            mapHits(hits,entities:[entityId:root]) { identifiers in
                try self.require(identifiers.count==3 && identifiers.allSatisfy { $0==nil },"Removed scene hit unexpectedly selected the retained authored entity")
                try completion(["formerOpaquePixelMiss":true,"transparentVerticalMirrorMiss":true,"backgroundMiss":true,"rawReadbackPixelCenters":points.map { [Double($0.x),Double($0.y)] },"sceneKitQueryCenters":queries.map { [Double($0.x),Double($0.y)] },"readbackToQueryMapping":"x unchanged; queryY = targetHeight - readbackPixelCenterY, exactly once","retainedRootLookupUsed":true,"verifiedElapsedMs":(ProcessInfo.processInfo.systemUptime-self.started)*1000])
            }
        }
    }

    private func compareChildren(_ original: SCNNode, _ prepared: SCNNode) throws {
        try require(original.childNodes.count == prepared.childNodes.count,"Authored node hierarchy changed")
        for (source,node) in zip(original.childNodes,prepared.childNodes) {
            for column in 0..<4 { for row in 0..<4 {
                try require(abs(source.simdTransform[column][row]-node.simdTransform[column][row])<=tolerance,"Authored child matrix changed")
            } }
            try require(node.geometry === source.geometry,"Production preparation replaced authored geometry/material ownership")
            try require(node.camera == nil && node.light == nil && node.animationKeys.isEmpty,"Prepared catalog nodes retain autonomous camera/light/animation")
            for material in node.geometry?.materials ?? [] {
                try require(material.lightingModel == .physicallyBased && material.diffuse.contents != nil && material.metalness.contents != nil && material.roughness.contents != nil,"Original metallic/roughness material intent missing")
            }
            try compareChildren(source,node)
        }
    }
    private func bounds(_ root: SCNNode, relativeTo reference: SCNNode?, extra: simd_float4x4=matrix_identity_float4x4) throws -> [Float] {
        var minimum=SIMD3<Float>(repeating:.infinity),maximum=SIMD3<Float>(repeating:-.infinity),count=0
        root.enumerateChildNodes { node,_ in
            guard let geometry=node.geometry else { return }
            let box=geometry.boundingBox
            for corner in 0..<8 {
                let point=SIMD3<Float>(corner&1 == 0 ? box.min.x:box.max.x,corner&2 == 0 ? box.min.y:box.max.y,corner&4 == 0 ? box.min.z:box.max.z)
                let local=node.simdConvertPosition(point,to:reference)
                let transformed=extra*SIMD4<Float>(local.x,local.y,local.z,1)
                let value=SIMD3<Float>(transformed.x,transformed.y,transformed.z)
                minimum=simd_min(minimum,value);maximum=simd_max(maximum,value);count += 1
            }
        }
        try require(count>0 && [minimum.x,minimum.y,minimum.z,maximum.x,maximum.y,maximum.z].allSatisfy { $0.isFinite },"Actual imported geometry has no finite bounds")
        return [minimum.x,minimum.y,minimum.z,maximum.x,maximum.y,maximum.z]
    }

    private func renderFrame(name: String, completion: @escaping (Int,[UInt8]) throws -> Void) {
        perform {
            try requireTime();phase("RENDER_"+name)
            guard let renderer=renderer,let scene=scene,let command=commands?.makeCommandBuffer(),let target=colorTarget,let depth=depthTarget else { throw Failure(message:"SceneKit command owners missing") }
            let pass=MTLRenderPassDescriptor();pass.colorAttachments[0].texture=target
            pass.colorAttachments[0].loadAction = .clear;pass.colorAttachments[0].storeAction = .store
            pass.colorAttachments[0].clearColor=MTLClearColor(red:0,green:0,blue:0,alpha:0)
            pass.depthAttachment.texture=depth;pass.depthAttachment.loadAction = .clear;pass.depthAttachment.storeAction = .dontCare;pass.depthAttachment.clearDepth=1
            // This private serial queue has no run loop to commit SceneKit's
            // automatic transaction. Apply graph changes before advancing the
            // presentation hierarchy at the actual monotonic system timestamp.
            SCNTransaction.flush()
            let renderTime=ProcessInfo.processInfo.systemUptime
            renderer.render(atTime:renderTime,viewport:CGRect(x:0,y:0,width:size,height:size),commandBuffer:command,passDescriptor:pass)
            try requireTime();inFlight=true;record("inFlightCommand",true)
            command.addCompletedHandler { [renderer,scene,target,depth] completed in
                let callbackAt=ProcessInfo.processInfo.systemUptime
                self.queue.async {
                    // Keep all owners alive until the GPU completes, including on
                    // timeout. No late callback can publish into the sealed result.
                    _=renderer;_=scene;_=depth;self.inFlight=false
                    self.perform {
                        self.record("inFlightCommand",false)
                        try self.require(callbackAt<=self.deadline,"SceneKit GPU frame completed after the single deadline")
                        try self.require(completed.status == .completed && completed.error == nil,"SceneKit Metal command failed: \(String(describing:completed.error))")
                        let bytes=self.read(target)
                        var visible=0,nonblack=0
                        for offset in stride(from:0,to:bytes.count,by:4) {
                            if bytes[offset+3]>16 { visible += 1;if max(bytes[offset],max(bytes[offset+1],bytes[offset+2]))>8 { nonblack += 1 } }
                        }
                        if visible>0 { try self.require(nonblack>32,"Populated target contains no meaningful shaded RGB pixels") }
                        let png=try self.png(bytes,width:self.size,height:self.size)
                        try self.requireTime()
                        let measuredAt=ProcessInfo.processInfo.systemUptime
                        self.publication.lock()
                        if !self.sealed && !self.ended {
                            self.images.append((name+".png",png))
                            self.frames.append(["name":name,"width":self.size,"height":self.size,"pixelFormat":"BGRA8Unorm","commandStatus":"completed","transactionFlushed":true,"renderSystemUptime":renderTime,"renderElapsedMs":(renderTime-self.started)*1000,"gpuCallbackElapsedMs":(callbackAt-self.started)*1000,"measuredAndEncodedElapsedMs":(measuredAt-self.started)*1000,"nontransparentPixels":visible,"nonblackVisiblePixels":nonblack,"pngSha256":SHA256.hash(data:png).map { String(format:"%02x",$0) }.joined()])
                            self.report["frames"]=self.frames
                        }
                        self.publication.unlock()
                        try self.requireTime();try completion(visible,bytes)
                    }
                }
            }
            command.commit()
        }
    }
    private func read(_ target: MTLTexture) -> [UInt8] {
        var bytes=[UInt8](repeating:0,count:target.width*target.height*4)
        bytes.withUnsafeMutableBytes { buffer in
            target.getBytes(buffer.baseAddress!,bytesPerRow:target.width*4,from:MTLRegionMake2D(0,0,target.width,target.height),mipmapLevel:0)
        }
        return bytes
    }
    private func png(_ bytes: [UInt8], width: Int, height: Int) throws -> Data {
        let data=Data(bytes)
        guard let provider=CGDataProvider(data:data as CFData),let image=CGImage(width:width,height:height,bitsPerComponent:8,bitsPerPixel:32,bytesPerRow:width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGBitmapInfo(rawValue:CGImageAlphaInfo.premultipliedFirst.rawValue).union(.byteOrder32Little),provider:provider,decode:nil,shouldInterpolate:false,intent:.defaultIntent) else { throw Failure(message:"Original BGRA readback cannot form a PNG image") }
        let output=NSMutableData()
        guard let destination=CGImageDestinationCreateWithData(output,UTType.png.identifier as CFString,1,nil) else { throw Failure(message:"PNG destination unavailable") }
        CGImageDestinationAddImage(destination,image,nil)
        try require(CGImageDestinationFinalize(destination),"PNG encoding failed")
        return output as Data
    }
}
