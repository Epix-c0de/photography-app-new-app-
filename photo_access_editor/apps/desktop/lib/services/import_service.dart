import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:photo_access_editor/models/models.dart';
import 'package:photo_access_editor/services/rust_bridge.dart';
import 'package:uuid/uuid.dart';

const _rawExtensions = [
  'cr2', 'cr3', 'nef', 'nrw', 'arw', 'srf', 'raf', 'dng',
  'orf', 'rw2', 'pef', 'srw', '3fr', 'kdc', 'mrw', 'raw',
];

const _imageExtensions = [
  'jpg', 'jpeg', 'png', 'tiff', 'tif', 'webp', 'bmp',
];

class ImportService {
  /// Scan a directory for supported image files
  static Future<List<ImportCandidate>> scanDirectory(String dirPath) async {
    final dir = Directory(dirPath);
    if (!dir.existsSync()) return [];

    final candidates = <ImportCandidate>[];
    
    await for (final entity in dir.list(recursive: false)) {
      if (entity is File) {
        final ext = p.extension(entity.path).toLowerCase().replaceAll('.', '');
        if (_rawExtensions.contains(ext) || _imageExtensions.contains(ext)) {
          final stat = await entity.stat();
          candidates.add(ImportCandidate(
            file: entity,
            filename: p.basename(entity.path),
            extension: ext,
            fileSize: stat.size,
            isRaw: _rawExtensions.contains(ext),
          ));
        }
      }
    }

    // Sort: RAW first, then by name
    candidates.sort((a, b) {
      if (a.isRaw && !b.isRaw) return -1;
      if (!a.isRaw && b.isRaw) return 1;
      return a.filename.compareTo(b.filename);
    });

    debugPrint('Scanned ${candidates.length} images from $dirPath');
    return candidates;
  }

  /// Import photos from a list of files
  static Future<List<PhotoModel>> importPhotos({
    required String catalogId,
    required List<ImportCandidate> candidates,
    required String thumbnailDir,
    void Function(int current, int total, String filename)? onProgress,
  }) async {
    final photos = <PhotoModel>[];
    final uuid = Uuid();

    for (int i = 0; i < candidates.length; i++) {
      final candidate = candidates[i];
      onProgress?.call(i + 1, candidates.length, candidate.filename);

      try {
        // Extract metadata
        final metadata = await RustBridge.decodeImage(candidate.file.path);

        // Create photo model
        final photoId = uuid.v4();
        final now = DateTime.now().toUtc();

        final photo = PhotoModel(
          photoId: photoId,
          catalogId: catalogId,
          filename: candidate.filename,
          filePath: candidate.file.path,
          captureDate: now,
          createdAt: now,
          updatedAt: now,
        );

        // Generate thumbnail in background
        _generateThumbnailAsync(candidate.file.path, thumbnailDir, photoId);

        photos.add(photo);
      } catch (e) {
        debugPrint('Failed to import ${candidate.filename}: $e');
      }
    }

    debugPrint('Imported ${photos.length} photos');
    return photos;
  }

  /// Generate a single thumbnail asynchronously
  static void _generateThumbnailAsync(
    String sourcePath,
    String outputDir,
    String photoId,
  ) {
    // Run in isolate to avoid blocking UI
    compute(_generateThumbnailIsolate, _ThumbnailParams(
      sourcePath: sourcePath,
      outputDir: outputDir,
      photoId: photoId,
    )).catchError((e) {
      debugPrint('Thumbnail generation failed: $e');
    });
  }

  static Future<void> _generateThumbnailIsolate(_ThumbnailParams params) async {
    for (final size in [128, 256, 512]) {
      await RustBridge.generateThumbnail(
        params.sourcePath,
        params.outputDir,
        params.photoId,
        size,
      );
    }
  }
}

class ImportCandidate {
  final File file;
  final String filename;
  final String extension;
  final int fileSize;
  final bool isRaw;

  const ImportCandidate({
    required this.file,
    required this.filename,
    required this.extension,
    required this.fileSize,
    required this.isRaw,
  });

  String get displayName {
    final parts = filename.split('.');
    if (parts.length > 1) {
      parts.removeLast();
      return parts.join('.');
    }
    return filename;
  }

  String get sizeText {
    if (fileSize > 1024 * 1024) {
      return '${(fileSize / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(fileSize / 1024).toStringAsFixed(0)} KB';
  }
}

class _ThumbnailParams {
  final String sourcePath;
  final String outputDir;
  final String photoId;

  const _ThumbnailParams({
    required this.sourcePath,
    required this.outputDir,
    required this.photoId,
  });
}
