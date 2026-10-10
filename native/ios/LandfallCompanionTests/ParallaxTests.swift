import XCTest
import CryptoKit
@testable import LandfallCompanion

final class ParallaxTests: XCTestCase {
    func testStartIdentityUsesStrictNumbers() {
        let start:[String:Any]=["sessionId":"fixture-session","epoch":1,"sceneTransferVersion":1,"versionChecksum":String(repeating:"a",count:64),"instanceId":"fixture-instance"]
        XCTAssertTrue(ParallaxSceneTransfer.validStart(start))
        for invalid:Any in [1.5,true,"1",0,2147483648] {var p=start;p["epoch"]=invalid;XCTAssertFalse(ParallaxSceneTransfer.validStart(p))}
        var p=start;p["sceneTransferVersion"]=true;XCTAssertFalse(ParallaxSceneTransfer.validStart(p))
        p=start;p["extra"]=1;XCTAssertFalse(ParallaxSceneTransfer.validStart(p))
    }
    @MainActor func testTerminationIsAcknowledgedOnceWithoutOpeningCamera() {
        var events:[[String:Any]]=[];var owners=0
        let runtime=ParallaxLocalRuntime(sessionId:"lifecycle-test",epoch:1)
        runtime.emit={events.append($0)};runtime.terminated={owners += 1}
        runtime.stop();runtime.stop()
        XCTAssertEqual(owners,1);XCTAssertEqual(events.count,1)
        XCTAssertEqual(events.first?["state"] as? String,"INTERRUPTED")
        XCTAssertEqual(events.first?["sessionId"] as? String,"lifecycle-test")
        XCTAssertEqual(events.first?["epoch"] as? Int,1)
    }
    func testSharedBoundaryFixtures() throws {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "native-boundary-v1", withExtension: "json"))
        let fixture = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String:Any])
        let limits = try XCTUnwrap(fixture["limits"] as? [String:Int])
        XCTAssertEqual(limits["sceneBytes"],ParallaxSceneTransfer.sceneBytes); XCTAssertEqual(limits["chunkBytes"],ParallaxSceneTransfer.chunkBytes)
        XCTAssertEqual(limits["chunks"],ParallaxSceneTransfer.maxChunks); XCTAssertEqual(limits["timeoutMs"],ParallaxSceneTransfer.timeoutMs)
        let cases = try XCTUnwrap(fixture["sceneCases"] as? [[String:Any]])
        func identity() -> [String:Any] { ["sessionId":"fixture-session","epoch":1,"transactionId":"fixture-transaction","generation":1] }
        func scene(_ value: [String:Any]) throws -> Bool {
            let bytes = try JSONSerialization.data(withJSONObject:value)
            let transfer=ParallaxSceneTransfer(sessionId:"fixture-session",epoch:1)
            var begin=identity();begin["sceneTransferVersion"]=1;begin["totalBytes"]=bytes.count;begin["chunkCount"]=(bytes.count+8191)/8192;begin["digest"]=SHA256.hash(data:bytes).map{String(format:"%02x",$0)}.joined()
            XCTAssertTrue(transfer.begin(begin,0))
            for offset in stride(from:0,to:bytes.count,by:8192) {var chunk=identity();chunk["index"]=offset/8192;chunk["data"]=bytes.subdata(in:offset..<min(bytes.count,offset+8192)).base64EncodedString();XCTAssertTrue(transfer.chunk(chunk,0))}
            return transfer.commit(identity(),0) != nil
        }
        for c in cases { XCTAssertEqual(try scene(try XCTUnwrap(c["scene"] as? [String:Any])),c["accepted"] as? Bool,c["name"] as? String ?? "case") }
        for trace in try XCTUnwrap(fixture["transferTraces"] as? [[String:Any]]) {
            let transfer=ParallaxSceneTransfer(sessionId:"fixture-session",epoch:1); var now:Double=0
            for step in try XCTUnwrap(trace["steps"] as? [[Any]]) {
                let p=try XCTUnwrap(step[1] as? [String:Any]);let result:Bool
                switch step[0] as? String {case "BEGIN":result=transfer.begin(p,now);case "CHUNK":result=transfer.chunk(p,now);case "COMMIT":result=transfer.commit(p,now) != nil;case "ABORT":result=transfer.abort(p);case "EXPIRE":now=15000;transfer.expire(now);result=true;default:throw NSError(domain:"Unknown fixture operation",code:1)}
                XCTAssertEqual(result,step[2] as? Bool,trace["name"] as? String ?? "trace")
            }
        }
        for c in try XCTUnwrap(fixture["sizeCases"] as? [[String:Any]]) {
            var value=try XCTUnwrap(cases[0]["scene"] as? [String:Any]);let entity=try XCTUnwrap((value["entities"] as? [[String:Any]])?.first)
            value["entities"]=(0..<(c["count"] as? Int ?? 0)).map{index -> [String:Any] in var e=entity;e["id"]="entity-\(index)";e["content"]=c["content"];return e}
            XCTAssertTrue(try scene(value))
        }
    }
}
