import XCTest
import CAprilTag
@testable import PotteryCameraCore

final class MarkerTrackingTests: XCTestCase {
    func board(dx: Double = 0) -> [Marker] {
        (0...3).map { id in
            let x = 0.1 + Double(id % 2) * 0.6 + dx
            let y = 0.1 + Double(id / 2) * 0.6
            return Marker(id: id, corners: [.init(x: x, y: y + 0.1), .init(x: x + 0.1, y: y + 0.1), .init(x: x + 0.1, y: y), .init(x: x, y: y)])
        }
    }
    func testRequiresStableWindowAndAllFourMarkers() {
        var tracker = BoardTracker()
        for time in [0.0, 0.1, 0.2, 0.3, 0.4] { XCTAssertEqual(tracker.observe(board(), at: time), .stabilizing) }
        XCTAssertEqual(tracker.observe(board().reversed(), at: 0.5), .stable)
        XCTAssertEqual(tracker.observe(Array(board().prefix(3)), at: 0.6), .searching)
        XCTAssertEqual(tracker.observe(board(), at: 0.7), .stabilizing)
    }
    func testMovementInterruptionAndResetDiscardOldLock() {
        var tracker = BoardTracker()
        for time in [0.0, 0.1, 0.2, 0.3, 0.4, 0.5] { _ = tracker.observe(board(), at: time) }
        XCTAssertEqual(tracker.observe(board(dx: 0.02), at: 0.6), .stabilizing)
        XCTAssertEqual(tracker.observe(board(), at: 4), .stabilizing)
        tracker.reset()
        XCTAssertEqual(tracker.observe(board(), at: 4.1), .stabilizing)
    }
    func testRejectsDuplicateIdsCorruptionAndInvalidCoordinates() {
        var tracker = BoardTracker()
        var invalid = board(); invalid[3].id = 0
        XCTAssertEqual(tracker.observe(invalid, at: 0), .searching)
        invalid = board(); invalid[0].hamming = 1
        XCTAssertEqual(tracker.observe(invalid, at: 0), .searching)
        invalid = board(); invalid[0].corners[0].x = .nan
        XCTAssertEqual(tracker.observe(invalid, at: 0), .searching)
        invalid = board(); invalid[0].corners = Array(repeating: .init(x: 0.2, y: 0.2), count: 4)
        XCTAssertEqual(tracker.observe(invalid, at: 0), .searching)
        XCTAssertEqual(tracker.observe(board(), at: .infinity), .searching)
    }
    func testPinnedNativeDetectorDecodesSyntheticFamilyTags() throws {
        let detector = try XCTUnwrap(MarkerDetector())
        for id in 0...3 {
            var image = [UInt8](repeating: 255, count: 256 * 256)
            XCTAssertEqual(pc_render_test_tag(Int32(id), &image, 256, 256), 1)
            let detections = detector.detect(grayscale: image, width: 256, height: 256)
            XCTAssertEqual(detections.map(\.id), [id])
            XCTAssertEqual(detections.first?.hamming, 0)
        }
    }
    func testBlankAndInvalidImagesNeverProduceDetections() throws {
        let detector = try XCTUnwrap(MarkerDetector())
        XCTAssertTrue(detector.detect(grayscale: [UInt8](repeating: 255, count: 256 * 256), width: 256, height: 256).isEmpty)
        XCTAssertTrue(detector.detect(grayscale: [], width: 256, height: 256).isEmpty)
    }
}
