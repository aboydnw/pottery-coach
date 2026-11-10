import Foundation
import XCTest
@testable import PotteryCameraCore

/// Rasterizes the literal tag glyphs from the shipped SVG, not native-generated family codes.
/// Decorative lines/text are intentionally omitted; this is a board/family parity test only.
private final class BoardGlyphRasterizer: NSObject, XMLParserDelegate {
    let width = 840
    let height = 592
    var pixels = [UInt8](repeating: 255, count: 840 * 592)
    var tagDepth: Int?
    var depth = 0
    var foundIDs = Set<Int>()
    var validBoard = false
    func parser(_ parser: XMLParser, didStartElement name: String, namespaceURI: String?, qualifiedName: String?, attributes: [String: String]) {
        depth += 1
        if name == "svg" {
            validBoard = attributes["data-revision"] == "board-v1" && attributes["viewBox"] == "0 0 210 148"
        }
        if name == "g", let rawID = attributes["data-tag-id"], let id = Int(rawID), attributes["data-family"] == "tagStandard41h12" {
            tagDepth = depth
            foundIDs.insert(id)
        }
        guard name == "rect", tagDepth != nil,
              let x = attributes["x"].flatMap(Double.init), let y = attributes["y"].flatMap(Double.init),
              let w = attributes["width"].flatMap(Double.init), let h = attributes["height"].flatMap(Double.init) else { return }
        let left = max(0, Int((x * 4).rounded()))
        let right = min(width, Int(((x + w) * 4).rounded()))
        let top = max(0, Int((y * 4).rounded()))
        let bottom = min(height, Int(((y + h) * 4).rounded()))
        guard left < right, top < bottom else { return }
        for py in top..<bottom { for px in left..<right { pixels[py * width + px] = 0 } }
    }
    func parser(_ parser: XMLParser, didEndElement name: String, namespaceURI: String?, qualifiedName: String?) {
        if tagDepth == depth { tagDepth = nil }
        depth -= 1
    }
}

final class BoardFixtureTests: XCTestCase {
    func testNativeDetectorRecognizesActualShippedBoardGlyphs() throws {
        let repository = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("../../../../")
        let data = try Data(contentsOf: repository.appendingPathComponent("public/calibration/board-v1.svg"))
        let raster = BoardGlyphRasterizer()
        let parser = XMLParser(data: data)
        parser.shouldResolveExternalEntities = false
        parser.delegate = raster
        XCTAssertTrue(parser.parse())
        XCTAssertTrue(raster.validBoard)
        XCTAssertEqual(raster.foundIDs, Set(0...3))
        let detector = try XCTUnwrap(MarkerDetector())
        let markers = detector.detect(grayscale: raster.pixels, width: raster.width, height: raster.height)
        XCTAssertEqual(Set(markers.map(\.id)), Set(0...3))
        XCTAssertEqual(markers.count, 4)
        XCTAssertTrue(markers.allSatisfy { $0.hamming == 0 })
    }
}
