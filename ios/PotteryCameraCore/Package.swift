// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "PotteryCameraCore",
    platforms: [.iOS(.v17), .macOS(.v13)],
    products: [.library(name: "PotteryCameraCore", targets: ["PotteryCameraCore"])],
    targets: [
        .target(name: "CAprilTag", sources: ["apriltag.c", "apriltag_quad_thresh.c", "tagStandard41h12.c", "common", "pottery_detector.c"], publicHeadersPath: "include", cSettings: [.headerSearchPath(".")]),
        .target(name: "PotteryCameraCore", dependencies: ["CAprilTag"]),
        .testTarget(name: "PotteryCameraCoreTests", dependencies: ["PotteryCameraCore", "CAprilTag"])
    ]
)
