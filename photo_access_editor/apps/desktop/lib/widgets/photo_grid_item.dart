import 'dart:io';
import 'package:flutter/material.dart';
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/models/models.dart';

class PhotoGridItem extends StatelessWidget {
  final PhotoModel photo;
  final bool isSelected;
  final VoidCallback onTap;
  final ValueChanged<int>? onRatingChanged;

  const PhotoGridItem({
    super.key,
    required this.photo,
    required this.isSelected,
    required this.onTap,
    this.onRatingChanged,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      onSecondaryTap: () {
        // Right-click context menu could go here
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppTheme.borderRadius),
          border: Border.all(
            color: isSelected ? AppTheme.gold : AppTheme.border,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(isSelected ? AppTheme.borderRadius - 1 : AppTheme.borderRadius),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Thumbnail
              _buildThumbnail(),
              
              // Bottom info bar
              Positioned(left: 0, right: 0, bottom: 0, child: _buildInfoBar()),
              
              // Rating badge
              if (photo.rating > 0)
                Positioned(top: 6, right: 6, child: _buildRatingBadge()),
              
              // RAW badge
              if (photo.isRaw)
                Positioned(top: 6, left: 6, child: _buildBadge('RAW', AppTheme.orange)),
              
              // Selection ring
              if (isSelected)
                Positioned(
                  top: 6, left: 6,
                  child: Container(
                    width: 20, height: 20,
                    decoration: const BoxDecoration(color: AppTheme.gold, shape: BoxShape.circle),
                    child: const Icon(Icons.check, size: 12, color: Colors.black),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildThumbnail() {
    return Container(
      color: AppTheme.surfaceLight,
      child: Image.file(
        File(photo.filePath),
        fit: BoxFit.cover,
        gaplessPlayback: true,
        errorBuilder: (context, error, stackTrace) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.image_outlined, size: 32, color: AppTheme.textTertiary.withAlpha(75)),
                const SizedBox(height: 4),
                Text(photo.extension, style: TextStyle(color: AppTheme.textTertiary.withAlpha(125), fontSize: 10, fontWeight: FontWeight.w500)),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildInfoBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.transparent, Colors.black.withAlpha(200)],
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              photo.displayName,
              style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w500),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (photo.cameraModel != null)
            Text(photo.cameraModel!, style: TextStyle(color: Colors.white.withAlpha(150), fontSize: 9)),
        ],
      ),
    );
  }

  Widget _buildRatingBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      decoration: BoxDecoration(color: Colors.black.withAlpha(180), borderRadius: BorderRadius.circular(4)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(photo.rating, (_) => const Icon(Icons.star, size: 8, color: AppTheme.gold)),
      ),
    );
  }

  Widget _buildBadge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      decoration: BoxDecoration(color: color.withAlpha(230), borderRadius: BorderRadius.circular(4)),
      child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold)),
    );
  }
}
