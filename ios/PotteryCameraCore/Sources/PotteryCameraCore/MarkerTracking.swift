import Foundation
import CAprilTag

public struct MarkerPoint: Equatable, Sendable {
    public var x: Double
    public var y: Double
    public init(x: Double, y: Double) { self.x = x; self.y = y }
}

public struct Marker: Equatable, Sendable {
    public var id: Int
    public var hamming: Int
    public var margin: Double
    /// Normalized image coordinates, x right and y down, AprilTag corner order.
    public var corners: [MarkerPoint]
    public init(id: Int, hamming: Int = 0, margin: Double = 50, corners: [MarkerPoint]) {
        self.id = id; self.hamming = hamming; self.margin = margin; self.corners = corners
    }
}

/// Own on one processing queue. Pixels are borrowed only during detection; never persisted.
public final class MarkerDetector {
    private let detector: OpaquePointer
    public init?() {
        guard let value = pc_detector_create() else { return nil }
        detector = value
    }
    deinit { pc_detector_destroy(detector) }
    public func detect(grayscale: [UInt8], width: Int, height: Int) -> [Marker] {
        guard width > 0, height > 0, width <= 4096, height <= 4096,
              grayscale.count == width * height else { return [] }
        var output = [pc_tag](repeating: pc_tag(), count: 32)
        let count = grayscale.withUnsafeBufferPointer { pixels in
            pc_detector_detect(detector, pixels.baseAddress, Int32(width), Int32(height), Int32(width), &output, 32)
        }
        guard count >= 0 else { return [] }
        return output.prefix(Int(count)).map { value in
            let x = [value.x.0, value.x.1, value.x.2, value.x.3]
            let y = [value.y.0, value.y.1, value.y.2, value.y.3]
            return Marker(id: Int(value.id), hamming: Int(value.hamming), margin: Double(value.margin),
                          corners: (0..<4).map { MarkerPoint(x: x[$0] / Double(width), y: y[$0] / Double(height)) })
        }
    }
}

public enum MarkerTrackingStatus: String, Sendable {
    case searching = "Show all four board markers"
    case stabilizing = "Hold the phone still"
    case stable = "Four markers stable · detection only"
}

/// A native detector feasibility gate, NOT metric calibration or a physical accuracy decision.
/// Board-v1 uses tagStandard41h12 IDs 0...3. Five valid observations span at least 500 ms.
public struct BoardTracker {
    private var observations: [(time: Double, markers: [Marker])] = []
    public init() {}
    public mutating func reset() { observations.removeAll() }
    public mutating func observe(_ markers: [Marker], at time: Double) -> MarkerTrackingStatus {
        guard time.isFinite, markers.count == 4, Set(markers.map(\.id)) == Set(0...3),
              markers.allSatisfy({ marker in
                  marker.hamming == 0 && marker.margin.isFinite && marker.margin >= 20 &&
                  marker.corners.count == 4 && marker.corners.allSatisfy { point in
                      point.x.isFinite && point.y.isFinite && point.x > 0 && point.x < 1 && point.y > 0 && point.y < 1
                  } && abs(Self.area(marker.corners)) > 0.0001
              }) else { reset(); return .searching }
        let sorted = markers.sorted { $0.id < $1.id }
        if let last = observations.last, time <= last.time || time - last.time > 0.5 { reset() }
        if let first = observations.first, !Self.matches(first.markers, sorted) { reset() }
        observations.append((time, sorted))
        // Keep a bounded window with enough time for 10 Hz and modest timing variation.
        if observations.count > 8 { observations.removeFirst() }
        guard observations.count >= 5, let first = observations.first, time - first.time >= 0.5 else { return .stabilizing }
        return .stable
    }
    private static func area(_ points: [MarkerPoint]) -> Double {
        guard points.count == 4 else { return 0 }
        return (0..<4).reduce(0) { value, i in
            let next = points[(i + 1) % 4]
            return value + points[i].x * next.y - next.x * points[i].y
        } / 2
    }
    private static func matches(_ left: [Marker], _ right: [Marker]) -> Bool {
        zip(left, right).allSatisfy { a, b in
            zip(a.corners, b.corners).allSatisfy { p, q in hypot(p.x - q.x, p.y - q.y) <= 0.008 }
        }
    }
}
