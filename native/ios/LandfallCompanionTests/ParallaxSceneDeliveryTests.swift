import XCTest
import SceneKit
import GLTFKit2
import CryptoKit
import simd
@testable import LandfallCompanion

final class ParallaxSceneDeliveryTests: XCTestCase {
    private let checksum=String(repeating:"a",count:64)
    private func model(_ id: String) -> [String:Any] {
        let chest=id == "treasure-chest"
        return ["assetId":id,"version":"1.0.0","sha256":chest ? "2e31b5eed11242e583cfc99a5491ff2e4b10dec0d4fed5d90dffe1ccab122e6f" : "5af1158b1a7f2b3339c159fbdca8b9d3d29020eaa06d41848bf5c04c0a682ccb",
                "byteLength":chest ? 630120:313396,"url":"/api/player/playthroughs/fixture-voyage/parallax/assets/"+id+"?block=fixture-block&versionChecksum="+checksum,"format":"GLB","metersPerUnit":1,"sourceWidthMeters":chest ? 0.8:0.16]
    }
    func testAuthorizedAssetReferencesAndIntegrity() throws {
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
        let finished=expectation(description:"Both exact catalog GLBs load through production SceneKit bridge");finished.expectedFulfillmentCount=2
        for id in ["treasure-chest","brass-compass"] {
            let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:id,withExtension:"glb"))
            GLTFAsset.load(with:url,options:[:]) { _,status,asset,error,_ in
                if status == .error { XCTFail("Catalog GLB failed to load: \(String(describing:error))");finished.fulfill();return }
                guard status == .complete else { return }
                guard let asset=asset,let scene=GLTFSCNSceneSource(asset:asset).defaultScene else { XCTFail("SceneKit graph missing");finished.fulfill();return }
                var geometryCount=0,materialCount=0
                scene.rootNode.enumerateChildNodes { node,_ in if let geometry=node.geometry { geometryCount += 1;materialCount += geometry.materials.count } }
                XCTAssertGreaterThan(geometryCount,0);XCTAssertGreaterThan(materialCount,0)
                let bounds=scene.rootNode.boundingBox
                XCTAssertGreaterThan(bounds.max.x-bounds.min.x,0);XCTAssertGreaterThan(bounds.max.y-bounds.min.y,0)
                finished.fulfill()
            }
        }
        wait(for:[finished],timeout:20)
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
