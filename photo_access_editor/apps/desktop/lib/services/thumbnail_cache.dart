import 'dart:io';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:photo_access_editor/services/rust_bridge.dart';

class ThumbnailCache {
  static Directory? _cacheDir;
  static final Map<String, File> _memoryCache = {};

  /// Initialize the cache directory
  static Future<void> initialize() async {
    final appDir = await getApplicationSupportDirectory();
    _cacheDir = Directory(p.join(appDir.path, 'thumbnails'));
    if (!_cacheDir!.existsSync()) {
      _cacheDir!.createSync(recursive: true);
    }
  }

  /// Get cache directory path
  static String get cachePath => _cacheDir?.path ?? '';

  /// Get or generate a thumbnail for a photo
  static Future<File> getThumbnail({
    required String photoId,
    required String sourcePath,
    required int size,
  }) async {
    final key = '${photoId}_$size';
    
    // Check memory cache
    if (_memoryCache.containsKey(key) && _memoryCache[key]!.existsSync()) {
      return _memoryCache[key]!;
    }

    // Check disk cache
    final cachedFile = File(p.join(_cacheDir!.path, '$key.jpg'));
    if (cachedFile.existsSync()) {
      _memoryCache[key] = cachedFile;
      return cachedFile;
    }

    // Generate new thumbnail
    final thumbnail = await RustBridge.generateThumbnail(
      sourcePath,
      _cacheDir!.path,
      photoId,
      size,
    );

    _memoryCache[key] = thumbnail;
    return thumbnail;
  }

  /// Get the best available thumbnail size for a given display size
  static int bestSize(double displaySize) {
    if (displaySize <= 128) return 128;
    if (displaySize <= 256) return 256;
    if (displaySize <= 512) return 512;
    return 1024;
  }

  /// Clear all cached thumbnails
  static Future<void> clear() async {
    _memoryCache.clear();
    if (_cacheDir != null && _cacheDir!.existsSync()) {
      await _cacheDir!.delete(recursive: true);
      _cacheDir!.createSync(recursive: true);
    }
  }

  /// Get cache size in bytes
  static Future<int> getCacheSize() async {
    if (_cacheDir == null || !_cacheDir!.existsSync()) return 0;
    
    int totalSize = 0;
    await for (final file in _cacheDir!.list()) {
      if (file is File) {
        totalSize += await file.length();
      }
    }
    return totalSize;
  }

  /// Remove cached thumbnails for a specific photo
  static Future<void> removeForPhoto(String photoId) async {
    _memoryCache.keys
        .where((key) => key.startsWith(photoId))
        .toList()
        .forEach(_memoryCache.remove);
    
    if (_cacheDir != null && _cacheDir!.existsSync()) {
      await for (final file in _cacheDir!.list()) {
        if (file is File && p.basename(file.path).startsWith(photoId)) {
          await file.delete();
        }
      }
    }
  }
}
