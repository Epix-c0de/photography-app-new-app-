import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/models/models.dart';
import 'package:photo_access_editor/services/catalog_service.dart';
import 'package:photo_access_editor/services/edit_renderer.dart';
import 'package:photo_access_editor/services/ai_scorer.dart';

// ─── Current Catalog ───────────────────────────────────────

final currentCatalogProvider = StateProvider<CatalogModel?>((ref) => null);

// ─── Selected Photo ────────────────────────────────────────

final selectedPhotoProvider = StateProvider<PhotoModel?>((ref) => null);

// ─── Photos List ───────────────────────────────────────────

final photosProvider = StateNotifierProvider<PhotosNotifier, List<PhotoModel>>((ref) {
  return PhotosNotifier();
});

class PhotosNotifier extends StateNotifier<List<PhotoModel>> {
  PhotosNotifier() : super([]);

  void setPhotos(List<PhotoModel> photos) => state = photos;
  void addPhotos(List<PhotoModel> photos) => state = [...state, ...photos];
  void addPhoto(PhotoModel photo) => state = [...state, photo];
  void removePhoto(String photoId) => state = state.where((p) => p.photoId != photoId).toList();
  void removePhotos(List<String> photoIds) => state = state.where((p) => !photoIds.contains(p.photoId)).toList();

  void updateRating(String photoId, int rating) {
    state = [for (final p in state) if (p.photoId == photoId) p.copyWith(rating: rating) else p];
  }

  void updateFlag(String photoId, String flag) {
    state = [for (final p in state) if (p.photoId == photoId) p.copyWith(flag: flag) else p];
  }

  void clear() => state = [];
}

// ─── Edit State ────────────────────────────────────────────

final editStateProvider = StateNotifierProvider<EditStateNotifier, EditStateModel>((ref) {
  return EditStateNotifier();
});

class EditStateNotifier extends StateNotifier<EditStateModel> {
  final EditHistory _history = EditHistory();

  EditStateNotifier() : super(EditStateModel());

  EditHistory get history => _history;

  void _updateState(EditStateModel newState) {
    state = newState;
    _history.push(newState);
  }

  // Basic adjustments
  void updateExposure(double v) => _updateState(state.copyWith(exposure: v));
  void updateContrast(double v) => _updateState(state.copyWith(contrast: v));
  void updateHighlights(double v) => _updateState(state.copyWith(highlights: v));
  void updateShadows(double v) => _updateState(state.copyWith(shadows: v));
  void updateWhites(double v) => _updateState(state.copyWith(whites: v));
  void updateBlacks(double v) => _updateState(state.copyWith(blacks: v));
  void updateTemperature(double v) => _updateState(state.copyWith(temperature: v));
  void updateTint(double v) => _updateState(state.copyWith(tint: v));
  void updateVibrance(double v) => _updateState(state.copyWith(vibrance: v));
  void updateSaturation(double v) => _updateState(state.copyWith(saturation: v));
  void updateClarity(double v) => _updateState(state.copyWith(clarity: v));
  void updateTexture(double v) => _updateState(state.copyWith(texture: v));
  void updateDehaze(double v) => _updateState(state.copyWith(dehaze: v));

  // Curves
  void updateCurves(CurvesAdjustment curves) => _updateState(state.copyWith(curves: curves));

  // HSL
  void updateHsl(HslAdjustment hsl) => _updateState(state.copyWith(hsl: hsl));

  // Color Grading
  void updateColorGrading(ColorGradingAdjustment cg) => _updateState(state.copyWith(colorGrading: cg));

  // Crop
  void updateCrop(CropSettings crop) => _updateState(state.copyWith(crop: crop));

  // Lens Corrections
  void updateLensCorrections(LensCorrections lc) => _updateState(state.copyWith(lensCorrections: lc));

  // Batch update (for preset application)
  void applyPreset(EditStateModel preset) => _updateState(preset);

  void reset() => _updateState(EditStateModel());

  bool undo() {
    final prev = _history.undo();
    if (prev != null) { state = prev; return true; }
    return false;
  }

  bool redo() {
    final next = _history.redo();
    if (next != null) { state = next; return true; }
    return false;
  }
}

// ─── Retouch State ─────────────────────────────────────────

final retouchStateProvider = StateNotifierProvider<RetouchStateNotifier, RetouchState>((ref) {
  return RetouchStateNotifier();
});

class RetouchStateNotifier extends StateNotifier<RetouchState> {
  RetouchStateNotifier() : super(const RetouchState());

  void updateSkinSmoothing(double v) => state = state.copyWith(skinSmoothing: v);
  void updateBlemishRemoval(double v) => state = state.copyWith(blemishRemoval: v);
  void updatePoreRefinement(double v) => state = state.copyWith(poreRefinement: v);
  void updateShineReduction(double v) => state = state.copyWith(shineReduction: v);
  void updateDetailPreservation(double v) => state = state.copyWith(detailPreservation: v);
  void updateEyeWhitening(double v) => state = state.copyWith(eyeWhitening: v);
  void updateEyeSharpening(double v) => state = state.copyWith(eyeSharpening: v);
  void updateTeethWhitening(double v) => state = state.copyWith(teethWhitening: v);
  void reset() => state = const RetouchState();
}

// ─── Active Tool ───────────────────────────────────────────

enum DevelopTool { basic, curves, hsl, colorGrading, crop, lens }

final activeDevelopToolProvider = StateProvider<DevelopTool>((ref) => DevelopTool.basic);

// ─── Workspace ─────────────────────────────────────────────

final currentWorkspaceProvider = StateProvider<Workspace>((ref) => Workspace.library);

// ─── Zoom Level ────────────────────────────────────────────

final zoomLevelProvider = StateProvider<double>((ref) => 1.0);

// ─── Grid Size ─────────────────────────────────────────────

final gridSizeProvider = StateProvider<double>((ref) => 200.0);

// ─── Search ────────────────────────────────────────────────

final searchQueryProvider = StateProvider<String>((ref) => '');

// ─── Filtered Photos ───────────────────────────────────────

final filteredPhotosProvider = Provider<List<PhotoModel>>((ref) {
  final photos = ref.watch(photosProvider);
  final query = ref.watch(searchQueryProvider).toLowerCase();
  if (query.isEmpty) return photos;
  return photos.where((p) {
    return p.filename.toLowerCase().contains(query) ||
        (p.cameraModel?.toLowerCase().contains(query) ?? false) ||
        (p.cameraMake?.toLowerCase().contains(query) ?? false);
  }).toList();
});

// ─── Preview Image ─────────────────────────────────────────

final previewImageProvider = FutureProvider.family<File?, String>((ref, photoId) async {
  final photo = ref.watch(selectedPhotoProvider);
  final edits = ref.watch(editStateProvider);
  if (photo == null || photo.photoId != photoId) return null;
  return EditRenderer.renderPreview(
    sourcePath: photo.filePath,
    adjustments: edits,
    photoId: photo.photoId,
  );
});

// ─── Histogram ─────────────────────────────────────────────

final histogramProvider = FutureProvider<HistogramData?>((ref) async {
  final photo = ref.watch(selectedPhotoProvider);
  if (photo == null) return null;
  return EditRenderer.generateHistogram(photo.filePath);
});

// ─── Catalog Loader ────────────────────────────────────────

final catalogInitializerProvider = FutureProvider<void>((ref) async {
  final catalog = await CatalogService.getDefaultCatalog();
  ref.read(currentCatalogProvider.notifier).state = catalog;
  final photos = await CatalogService.listPhotos(catalog.catalogId);
  ref.read(photosProvider.notifier).setPhotos(photos);
});

// ─── AI Scores ──────────────────────────────────────────

final aiScoresProvider = FutureProvider.family<AiScores?, String>((ref, filePath) async {
  return AiScorer.scorePhoto(filePath);
});

final selectedPhotoAiScoresProvider = Provider<AsyncValue<AiScores?>>((ref) {
  final photo = ref.watch(selectedPhotoProvider);
  if (photo == null) return const AsyncValue.data(null);
  return ref.watch(aiScoresProvider(photo.filePath));
});
