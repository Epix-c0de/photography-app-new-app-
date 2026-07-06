import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/models/models.dart';

// ─── Selected Photo ────────────────────────────────────────

final selectedPhotoProvider = StateProvider<PhotoModel?>((ref) => null);

// ─── Photos List ───────────────────────────────────────────

final photosProvider = StateNotifierProvider<PhotosNotifier, List<PhotoModel>>((ref) {
  return PhotosNotifier();
});

class PhotosNotifier extends StateNotifier<List<PhotoModel>> {
  PhotosNotifier() : super([]);

  void addPhotos(List<PhotoModel> photos) {
    state = [...state, ...photos];
  }

  void addPhoto(PhotoModel photo) {
    state = [...state, photo];
  }

  void removePhoto(String photoId) {
    state = state.where((p) => p.photoId != photoId).toList();
  }

  void removePhotos(List<String> photoIds) {
    state = state.where((p) => !photoIds.contains(p.photoId)).toList();
  }

  void updateRating(String photoId, int rating) {
    state = state.map((p) {
      if (p.photoId == photoId) {
        return p.copyWith(rating: rating);
      }
      return p;
    }).toList();
  }

  void updateFlag(String photoId, String flag) {
    state = state.map((p) {
      if (p.photoId == photoId) {
        return p.copyWith(flag: flag);
      }
      return p;
    }).toList();
  }

  void clear() {
    state = [];
  }
}

// ─── Edit State ────────────────────────────────────────────

final editStateProvider = StateNotifierProvider<EditStateNotifier, EditStateModel>((ref) {
  return EditStateNotifier();
});

class EditStateNotifier extends StateNotifier<EditStateModel> {
  EditStateNotifier() : super(EditStateModel());

  void updateExposure(double value) => state = state.copyWith(exposure: value);
  void updateContrast(double value) => state = state.copyWith(contrast: value);
  void updateHighlights(double value) => state = state.copyWith(highlights: value);
  void updateShadows(double value) => state = state.copyWith(shadows: value);
  void updateWhites(double value) => state = state.copyWith(whites: value);
  void updateBlacks(double value) => state = state.copyWith(blacks: value);
  void updateTemperature(double value) => state = state.copyWith(temperature: value);
  void updateTint(double value) => state = state.copyWith(tint: value);
  void updateVibrance(double value) => state = state.copyWith(vibrance: value);
  void updateSaturation(double value) => state = state.copyWith(saturation: value);
  void updateClarity(double value) => state = state.copyWith(clarity: value);
  void updateTexture(double value) => state = state.copyWith(texture: value);
  void updateDehaze(double value) => state = state.copyWith(dehaze: value);
  
  void reset() => state = state.reset();
}

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
