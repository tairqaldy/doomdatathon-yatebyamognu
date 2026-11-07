// JPEG frame sequence → H.264 MP4 with AVFoundation (AVAssetWriter). No ffmpeg, no packages.
//   swift scripts/demo/encode.swift <manifest.json> <out.mp4>
// manifest.json (written by record.mjs):
//   { "dir": "/tmp/…/frames", "fps": 24, "width": 1440, "height": 900, "bitrate": 480000, "duration_ms": 182000,
//     "keyframe_s": 10, "frames": [{ "t": 0, "f": "000001.jpg" }, …] }   t = ms on the recording clock (waits cut out)
// Output frame k (time k/fps) shows the last captured frame with t ≤ k/fps, so a still screen is the same
// frame repeated (it costs almost no bits) and the video runs at a constant 24 fps.
import AVFoundation
import CoreGraphics
import CoreVideo
import Foundation
import ImageIO

struct Frame: Decodable { let t: Double; let f: String }
struct Manifest: Decodable {
  let dir: String; let fps: Int; let width: Int; let height: Int; let bitrate: Int; let duration_ms: Double; let frames: [Frame]
  let keyframe_s: Int?
}

let args = CommandLine.arguments
guard args.count >= 3 else { fputs("usage: swift encode.swift <manifest.json> <out.mp4>\n", stderr); exit(2) }
let m: Manifest
do { m = try JSONDecoder().decode(Manifest.self, from: Data(contentsOf: URL(fileURLWithPath: args[1]))) }
catch { fputs("bad manifest: \(error)\n", stderr); exit(2) }
guard !m.frames.isEmpty else { fputs("no frames\n", stderr); exit(2) }

let out = URL(fileURLWithPath: args[2])
try? FileManager.default.removeItem(at: out)
let writer: AVAssetWriter
do { writer = try AVAssetWriter(outputURL: out, fileType: .mp4) } catch { fputs("writer: \(error)\n", stderr); exit(1) }
writer.shouldOptimizeForNetworkUse = true // moov atom first, so the landing page can start playing before the download ends

let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264,
  AVVideoWidthKey: m.width,
  AVVideoHeightKey: m.height,
  AVVideoColorPropertiesKey: [
    AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
    AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
    AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
  ],
  AVVideoCompressionPropertiesKey: [
    AVVideoAverageBitRateKey: m.bitrate,
    // screen recordings are mostly still: rare keyframes leave the bits for scrolling and transitions
    AVVideoMaxKeyFrameIntervalKey: m.fps * (m.keyframe_s ?? 10),
    AVVideoExpectedSourceFrameRateKey: m.fps,
    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    AVVideoH264EntropyModeKey: AVVideoH264EntropyModeCABAC,
    AVVideoAllowFrameReorderingKey: true,
  ],
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
  kCVPixelBufferWidthKey as String: m.width,
  kCVPixelBufferHeightKey as String: m.height,
])
writer.add(input)
guard writer.startWriting() else { fputs("startWriting: \(String(describing: writer.error))\n", stderr); exit(1) }
writer.startSession(atSourceTime: .zero)

let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
func pixelBuffer(_ file: String) -> CVPixelBuffer? {
  let url = URL(fileURLWithPath: m.dir).appendingPathComponent(file) as CFURL
  guard let src = CGImageSourceCreateWithURL(url, nil), let img = CGImageSourceCreateImageAtIndex(src, 0, nil),
        let pool = adaptor.pixelBufferPool else { return nil }
  var pb: CVPixelBuffer?
  guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pb) == kCVReturnSuccess, let b = pb else { return nil }
  CVPixelBufferLockBaseAddress(b, [])
  defer { CVPixelBufferUnlockBaseAddress(b, []) }
  guard let ctx = CGContext(data: CVPixelBufferGetBaseAddress(b), width: m.width, height: m.height, bitsPerComponent: 8,
                            bytesPerRow: CVPixelBufferGetBytesPerRow(b), space: srgb,
                            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue) else { return nil }
  ctx.interpolationQuality = .high
  ctx.draw(img, in: CGRect(x: 0, y: 0, width: m.width, height: m.height))
  return b
}

let total = Int((m.duration_ms / 1000.0 * Double(m.fps)).rounded(.up))
var shown = -1
var current: CVPixelBuffer?
var decoded = 0
for k in 0..<total {
  let tms = Double(k) * 1000.0 / Double(m.fps)
  var j = max(shown, 0)
  while j + 1 < m.frames.count && m.frames[j + 1].t <= tms { j += 1 }
  if j != shown || current == nil {
    if let b = pixelBuffer(m.frames[j].f) { current = b; decoded += 1 } else { fputs("skip unreadable frame \(m.frames[j].f)\n", stderr) }
    shown = j
  }
  guard let b = current else { continue }
  while !input.isReadyForMoreMediaData { usleep(500) }
  if !adaptor.append(b, withPresentationTime: CMTime(value: CMTimeValue(k), timescale: CMTimeScale(m.fps))) {
    fputs("append failed at frame \(k): \(String(describing: writer.error))\n", stderr); exit(1)
  }
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
guard writer.status == .completed else { fputs("encode failed: \(String(describing: writer.error))\n", stderr); exit(1) }
print("encoded \(total) frames (\(decoded) distinct) at \(m.fps) fps, \(m.width)x\(m.height), \(m.bitrate / 1000) kbps target")
