import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:photo_access_editor/models/models.dart';
import 'package:photo_access_editor/services/image_processor.dart';

/// Renders a preview image with adjustments applied
class EditRenderer {
  static String? _cacheDir;

  /// Get cache directory for processed previews
  static Future<String> _getCacheDir() async {
    if (_cacheDir != null) return _cacheDir!;
    final dir = await getApplicationSupportDirectory();
    _cacheDir = p.join(dir.path, 'preview_cache');
    await Directory(_cacheDir!).create(recursive: true);
    return _cacheDir!;
  }

  /// Generate a preview with adjustments applied
  static Future<File> renderPreview({
    required String sourcePath,
    required EditStateModel adjustments,
    required String photoId,
    int maxSize = 1024,
  }) async {
    final cacheDir = await _getCacheDir();
    // Hash the edit state to detect changes
    final editHash = adjustments.hashCode.toRadixString(16);
    final outputPath = p.join(cacheDir, '${photoId}_$editHash.jpg');

    final cachedFile = File(outputPath);
    if (await cachedFile.exists()) return cachedFile;

    // Process via ImageProcessor
    final result = await ImageProcessor.process(
      sourcePath: sourcePath,
      edits: adjustments,
      outputPath: outputPath,
      maxSize: maxSize,
    );
    return File(result);
  }

  /// Generate a histogram from image data
  static Future<HistogramData> generateHistogram(String filePath) async {
    return ImageProcessor.computeHistogram(filePath);
  }

  /// Generate a before/after comparison image
  static Future<File> generateComparison({
    required String originalPath,
    required String editedPath,
    required double splitPosition,
  }) async {
    // For now, return the edited file — full composite would use Rust
    return File(editedPath);
  }

  /// Clear preview cache
  static Future<void> clearCache() async {
    final dir = Directory(_cacheDir ?? '');
    if (await dir.exists()) {
      await dir.delete(recursive: true);
    }
  }
}

/// Manages undo/redo for edit operations
class EditHistory {
  final List<EditStateModel> _states = [];
  int _currentIndex = -1;

  EditHistory() {
    _states.add(EditStateModel());
    _currentIndex = 0;
  }

  EditStateModel get current => _states[_currentIndex];
  bool get canUndo => _currentIndex > 0;
  bool get canRedo => _currentIndex < _states.length - 1;

  void push(EditStateModel state) {
    if (_currentIndex < _states.length - 1) {
      _states.removeRange(_currentIndex + 1, _states.length);
    }
    _states.add(state);
    _currentIndex = _states.length - 1;
  }

  EditStateModel? undo() {
    if (!canUndo) return null;
    _currentIndex--;
    return _states[_currentIndex];
  }

  EditStateModel? redo() {
    if (!canRedo) return null;
    _currentIndex++;
    return _states[_currentIndex];
  }

  void clear() {
    _states.clear();
    _states.add(EditStateModel());
    _currentIndex = 0;
  }

  int get count => _states.length;
}
