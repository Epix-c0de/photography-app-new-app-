import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;

// Import generated Rust bridge bindings
import '../src/rust/api/photo_decoding.dart' as rust;
import '../src/rust/api/editing.dart' as rust_editing;
import '../src/rust/api/export.dart' as rust_export;
import '../src/rust/frb_generated.dart';

/// Rust bridge service — uses flutter_rust_bridge generated bindings
/// Falls back to pure Dart when Rust native lib is not available
class RustBridge {
  static bool _initialized = false;

  /// Initialize the Rust engine
  static Future<void> initialize() async {
    if (_initialized) return;
    try {
      await RustLib.init();
      _initialized = true;
    } catch (e) {
      print('Rust bridge not available, using Dart fallback: $e');
      _initialized = true;
    }
  }

  /// Decode a RAW/image file and return metadata + pixel data
  static Future<RawDecodeResult> decodeImage(String filePath) async {
    if (!_initialized) await initialize();
    try {
      final result = await rust.decodePhoto(path: filePath);
      final data = await result.data();
      return RawDecodeResult(
        width: await result.width(),
        height: await result.height(),
        format: p.extension(filePath).replaceAll('.', '').toUpperCase(),
        pixels: data,
      );
    } catch (e) {
      return _decodeWithDart(filePath);
    }
  }

  /// Decode at reduced resolution for previews
  static Future<RawDecodeResult> decodePreview(String filePath, int maxSize) async {
    if (!_initialized) await initialize();
    try {
      final result = await rust.decodePhotoPreview(path: filePath, maxSize: maxSize);
      final data = await result.data();
      return RawDecodeResult(
        width: await result.width(),
        height: await result.height(),
        format: p.extension(filePath).replaceAll('.', '').toUpperCase(),
        pixels: data,
      );
    } catch (e) {
      return _decodeWithDart(filePath);
    }
  }

  /// Extract EXIF metadata
  static Future<PhotoMetadata> extractMetadata(String filePath) async {
    if (!_initialized) await initialize();
    try {
      final result = await rust.extractMetadata(path: filePath);
      return PhotoMetadata(
        width: result.width,
        height: result.height,
        format: result.format,
        cameraMake: result.cameraMake,
        cameraModel: result.cameraModel,
        lens: result.lens,
        iso: result.iso,
        aperture: result.aperture,
        shutterSpeed: result.shutterSpeed,
        focalLength: result.focalLength,
        captureDate: result.captureDate,
        orientation: result.orientation,
        bitDepth: result.bitDepth,
      );
    } catch (e) {
      return PhotoMetadata.empty();
    }
  }

  /// Apply edits via Rust engine
  static Future<Uint8List?> applyEdits(
    Uint8List pixels,
    int width,
    int height,
    Map<String, double> params,
  ) async {
    if (!_initialized) await initialize();
    try {
      final editParams = rust_editing.EditParams(
        exposure: params['exposure'] ?? 0,
        contrast: params['contrast'] ?? 0,
        highlights: params['highlights'] ?? 0,
        shadows: params['shadows'] ?? 0,
        whites: params['whites'] ?? 0,
        blacks: params['blacks'] ?? 0,
        temperature: params['temperature'] ?? 5500,
        tint: params['tint'] ?? 0,
        vibrance: params['vibrance'] ?? 0,
        saturation: params['saturation'] ?? 0,
        clarity: params['clarity'] ?? 0,
        texture: params['texture'] ?? 0,
        dehaze: params['dehaze'] ?? 0,
      );
      final result = await rust_editing.applyEdits(
        pixels: Uint8List.fromList(pixels),
        width: width,
        height: height,
        params: editParams,
      );
      return Uint8List.fromList(result);
    } catch (e) {
      return null;
    }
  }

  /// Compute histogram via Rust engine
  static Future<HistogramResult?> computeHistogram(Uint8List pixels) async {
    if (!_initialized) await initialize();
    try {
      final result = await rust_editing.computeHistogram(
        pixels: Uint8List.fromList(pixels),
      );
      return HistogramResult(
        red: result.red.toList(),
        green: result.green.toList(),
        blue: result.blue.toList(),
        luminance: result.luminance.toList(),
      );
    } catch (e) {
      return null;
    }
  }

  /// Generate thumbnail at specified size
  static Future<File> generateThumbnail(
    String sourcePath,
    String outputDir,
    String photoId,
    int size,
  ) async {
    final dir = Directory(outputDir);
    if (!dir.existsSync()) dir.createSync(recursive: true);

    final outputPath = p.join(outputDir, '${photoId}_$size.jpg');
    final outputFile = File(outputPath);

    if (outputFile.existsSync()) return outputFile;

    // Decode and resize via Rust, then save
    try {
      final result = await decodePreview(sourcePath, size);
      if (result.width > 0 && result.height > 0) {
        // Save the decoded pixels as JPEG
        final file = File(outputPath);
        await file.writeAsBytes(result.pixels);
        return file;
      }
    } catch (_) {}

    // Fallback: copy source
    if (!outputFile.existsSync()) {
      await File(sourcePath).copy(outputPath);
    }
    return outputFile;
  }

  /// Export image via Rust engine
  static Future<bool> exportImage(
    Uint8List pixels,
    int width,
    int height,
    String outputPath,
    String format,
    int quality,
  ) async {
    if (!_initialized) await initialize();
    try {
      await rust_export.exportImage(
        pixels: Uint8List.fromList(pixels),
        width: width,
        height: height,
        outputPath: outputPath,
        format: format,
        quality: quality,
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  /// Check if a file is RAW format
  static Future<bool> isRawFile(String path) async {
    if (!_initialized) await initialize();
    try {
      return await rust.isRawFile(path: path);
    } catch (e) {
      return false;
    }
  }

  // ─── Dart Fallbacks ──────────────────────────────────────

  static RawDecodeResult _decodeWithDart(String filePath) {
    final file = File(filePath);
    final bytes = file.readAsBytesSync();
    final ext = p.extension(filePath).toLowerCase().replaceAll('.', '');

    return RawDecodeResult(
      width: 0,
      height: 0,
      format: ext.toUpperCase(),
      pixels: bytes,
    );
  }
}

class RawDecodeResult {
  final int width;
  final int height;
  final String format;
  final Uint8List pixels;

  RawDecodeResult({
    required this.width,
    required this.height,
    required this.format,
    required this.pixels,
  });
}

class PhotoMetadata {
  final int width;
  final int height;
  final String format;
  final String? cameraMake;
  final String? cameraModel;
  final String? lens;
  final int? iso;
  final double? aperture;
  final String? shutterSpeed;
  final double? focalLength;
  final String? captureDate;
  final int? orientation;
  final int? bitDepth;

  PhotoMetadata({
    required this.width,
    required this.height,
    required this.format,
    this.cameraMake,
    this.cameraModel,
    this.lens,
    this.iso,
    this.aperture,
    this.shutterSpeed,
    this.focalLength,
    this.captureDate,
    this.orientation,
    this.bitDepth,
  });

  factory PhotoMetadata.empty() => PhotoMetadata(
        width: 0,
        height: 0,
        format: 'UNKNOWN',
      );
}

class HistogramResult {
  final List<int> red;
  final List<int> green;
  final List<int> blue;
  final List<int> luminance;

  HistogramResult({
    required this.red,
    required this.green,
    required this.blue,
    required this.luminance,
  });
}
