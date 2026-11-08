// JPEG frame sequence → H.264 MP4 with AVFoundation (AVAssetWriter). No ffmpeg, no packages.
//   swift scripts/demo/encode.swift <manifest.json> <out.mp4>
// manifest.json (written by record.mjs):
//   { "dir": "/tmp/…/frames", "fps": 24, "width": 1440, "height": 900, "bitrate": 480000, "duration_ms": 182000,
//     "keyframe_s": 10, "frames": [{ "t": 0, "f": "000001.jpg" }, …] }   t = ms on the recording clock (waits cut out)
// Output frame k (time k/fps) shows the last captured frame with t ≤ k/fps, so a still screen is the same
// frame repeated (it costs almost no bits) and the video runs at a constant 24 fps.
import AVFoundation
import CoreGraphics
import CoreText
import CoreVideo
import Foundation
import ImageIO

// Optional (short cut): "crops": per output frame [x, y, w, h] in page pixels or null (camera zoom: the crop is scaled
// to the full frame), "captions": [{ "start": ms, "end": ms, "text": "…" }] drawn on top as a dark pill with a fade.

struct Frame: Decodable { let t: Double; let f: String }
struct Caption: Decodable { let start: Double; let end: Double; let text: String }
struct Manifest: Decodable {
  let dir: String; let fps: Int; let width: Int; let height: Int; let bitrate: Int; let duration_ms: Double; let frames: [Frame]
  let keyframe_s: Int?
  let crops: [[Double]?]?
  let captions: [Caption]?
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
func loadImage(_ file: String) -> CGImage? {
  let url = URL(fileURLWithPath: m.dir).appendingPathComponent(file) as CFURL
  guard let src = CGImageSourceCreateWithURL(url, nil) else { return nil }
  return CGImageSourceCreateImageAtIndex(src, 0, [kCGImageSourceShouldCacheImmediately: true] as CFDictionary)
}

// caption pill: bold system font, white on #0e151c, 30 px above the bottom edge, fades/slides over 180 ms
let capFont = CTFontCreateUIFontForLanguage(.emphasizedSystem, 31, nil)!
func drawCaption(_ ctx: CGContext, _ text: String, _ alpha: Double) {
  let attr = NSAttributedString(string: text, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): capFont,
    NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(red: 1, green: 1, blue: 1, alpha: 1)])
  let line = CTLineCreateWithAttributedString(attr)
  var asc: CGFloat = 0, desc: CGFloat = 0, lead: CGFloat = 0
  let tw = CGFloat(CTLineGetTypographicBounds(line, &asc, &desc, &lead))
  let ph: CGFloat = 70, pw = tw + 72
  let py = 30 - 10 * CGFloat(1 - alpha)
  let pill = CGRect(x: (CGFloat(m.width) - pw) / 2, y: py, width: pw, height: ph)
  ctx.saveGState()
  ctx.setAlpha(CGFloat(alpha))
  ctx.setShadow(offset: CGSize(width: 0, height: -10), blur: 36, color: CGColor(red: 14 / 255, green: 21 / 255, blue: 28 / 255, alpha: 0.28))
  ctx.addPath(CGPath(roundedRect: pill, cornerWidth: ph / 2, cornerHeight: ph / 2, transform: nil))
  ctx.setFillColor(CGColor(red: 14 / 255, green: 21 / 255, blue: 28 / 255, alpha: 1)); ctx.fillPath()
  ctx.setShadow(offset: .zero, blur: 0, color: nil)
  ctx.textPosition = CGPoint(x: pill.minX + 36, y: py + (ph - (asc + desc)) / 2 + desc)
  CTLineDraw(line, ctx)
  ctx.restoreGState()
}
func captionAt(_ tms: Double) -> (String, Double)? {
  guard let caps = m.captions, let c = caps.last(where: { $0.start <= tms && tms < $0.end }) else { return nil }
  let a = min(1, (tms - c.start) / 180, (c.end - tms) / 180)
  return (c.text, max(0, a))
}
func render(_ img: CGImage, _ crop: [Double]?, _ cap: (String, Double)?) -> CVPixelBuffer? {
  guard let pool = adaptor.pixelBufferPool else { return nil }
  var pb: CVPixelBuffer?
  guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pb) == kCVReturnSuccess, let b = pb else { return nil }
  CVPixelBufferLockBaseAddress(b, [])
  defer { CVPixelBufferUnlockBaseAddress(b, []) }
  guard let ctx = CGContext(data: CVPixelBufferGetBaseAddress(b), width: m.width, height: m.height, bitsPerComponent: 8,
                            bytesPerRow: CVPixelBufferGetBytesPerRow(b), space: srgb,
                            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue) else { return nil }
  ctx.interpolationQuality = .high
  let full = CGRect(x: 0, y: 0, width: m.width, height: m.height)
  if let c = crop, c.count == 4 {
    // page pixels (top-left origin) → scale the crop up to the full frame; drawing the whole image scaled and shifted
    // keeps sub-pixel camera motion smooth (CGImage.cropping would snap to whole pixels)
    let s = Double(m.width) / c[2]
    let dx = -c[0] * s, dy = -(Double(img.height) - c[1] - c[3]) * s
    ctx.clip(to: full)
    ctx.draw(img, in: CGRect(x: dx, y: dy, width: Double(img.width) * s, height: Double(img.height) * s))
  } else {
    ctx.draw(img, in: full)
  }
  if let (text, a) = cap, a > 0.01 { drawCaption(ctx, text, a) }
  return b
}

let total = Int((m.duration_ms / 1000.0 * Double(m.fps)).rounded(.up))
var shown = -1
var image: CGImage?
var current: CVPixelBuffer?
var lastKey = ""
var decoded = 0
for k in 0..<total {
  let tms = Double(k) * 1000.0 / Double(m.fps)
  var j = max(shown, 0)
  while j + 1 < m.frames.count && m.frames[j + 1].t <= tms { j += 1 }
  if j != shown || image == nil {
    if let img = loadImage(m.frames[j].f) { image = img; decoded += 1 } else { fputs("skip unreadable frame \(m.frames[j].f)\n", stderr) }
    shown = j
  }
  let crop = (m.crops != nil && k < m.crops!.count) ? m.crops![k] : nil
  let cap = captionAt(tms)
  let key = "\(shown)|\(crop.map { "\($0)" } ?? "-")|\(cap.map { "\($0.0)\(String(format: "%.2f", $0.1))" } ?? "-")"
  if key != lastKey || current == nil, let img = image { current = render(img, crop, cap); lastKey = key }
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
