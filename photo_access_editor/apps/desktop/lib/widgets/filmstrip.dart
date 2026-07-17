import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/state/providers.dart';

class Filmstrip extends ConsumerWidget {
  const Filmstrip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final photos = ref.watch(filteredPhotosProvider);
    final selectedPhoto = ref.watch(selectedPhotoProvider);
    final controller = ScrollController();

    return Container(
      height: AppTheme.filmstripHeight,
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        border: Border(top: BorderSide(color: AppTheme.border)),
      ),
      child: photos.isEmpty
          ? const Center(child: Text('No photos', style: TextStyle(color: AppTheme.textTertiary, fontSize: 12)))
          : ListView.builder(
              controller: controller,
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              itemCount: photos.length,
              itemBuilder: (context, index) {
                final photo = photos[index];
                final isSelected = selectedPhoto?.photoId == photo.photoId;

                return GestureDetector(
                  onTap: () => ref.read(selectedPhotoProvider.notifier).state = photo,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    width: 80,
                    margin: const EdgeInsets.only(right: 4),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(
                        color: isSelected ? AppTheme.gold : AppTheme.border,
                        width: isSelected ? 2 : 1,
                      ),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(3),
                      child: Image.file(
                        File(photo.filePath),
                        fit: BoxFit.cover,
                        gaplessPlayback: true,
                        errorBuilder: (context, error, stackTrace) {
                          return Container(
                            color: AppTheme.surfaceLight,
                            child: const Icon(Icons.image_outlined, size: 20, color: AppTheme.textTertiary),
                          );
                        },
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
