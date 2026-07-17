import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/models/models.dart';
import 'package:photo_access_editor/state/providers.dart';

/// Crop tool overlay and settings panel
class CropOverlay extends ConsumerStatefulWidget {
  const CropOverlay({super.key});

  @override
  ConsumerState<CropOverlay> createState() => _CropOverlayState();
}

class _CropOverlayState extends ConsumerState<CropOverlay> {
  String _selectedRatio = 'Free';
  static const _ratios = <String, double?>{
    'Free': null,
    '1:1': 1.0,
    '4:5': 0.8,
    '3:2': 1.5,
    '16:9': 16 / 9,
    '9:16': 9 / 16,
    '5:4': 1.25,
    '2:3': 2 / 3,
  };

  @override
  Widget build(BuildContext context) {
    final crop = ref.watch(editStateProvider).crop;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('CROP', style: TextStyle(color: AppTheme.textTertiary, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
        const SizedBox(height: 12),
        const Text('ASPECT RATIO', style: TextStyle(color: AppTheme.textTertiary, fontSize: 9, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: _ratios.entries.map((e) {
            final isSelected = _selectedRatio == e.key;
            return GestureDetector(
              onTap: () {
                setState(() => _selectedRatio = e.key);
                _applyRatio(e.value);
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: isSelected ? AppTheme.gold.withAlpha(25) : AppTheme.surfaceLight,
                  borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                  border: Border.all(color: isSelected ? AppTheme.gold : AppTheme.border),
                ),
                child: Text(e.key, style: TextStyle(
                  color: isSelected ? AppTheme.gold : AppTheme.textSecondary,
                  fontSize: 11, fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                )),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 16),
        const Text('POSITION', style: TextStyle(color: AppTheme.textTertiary, fontSize: 9, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
        const SizedBox(height: 8),
        _CropSlider(label: 'X', value: crop.x, max: 1, onChanged: (v) => _updateCrop(crop.copyWith(x: v))),
        _CropSlider(label: 'Y', value: crop.y, max: 1, onChanged: (v) => _updateCrop(crop.copyWith(y: v))),
        _CropSlider(label: 'W', value: crop.width, max: 1, onChanged: (v) => _updateCrop(crop.copyWith(width: v))),
        _CropSlider(label: 'H', value: crop.height, max: 1, onChanged: (v) => _updateCrop(crop.copyWith(height: v))),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: GestureDetector(
                onTap: () => _updateCrop(const CropSettings()),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(border: Border.all(color: AppTheme.border), borderRadius: BorderRadius.circular(AppTheme.borderRadius)),
                  child: const Center(child: Text('Reset', style: TextStyle(color: AppTheme.textSecondary, fontSize: 11))),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: GestureDetector(
                onTap: () {
                  // Apply crop to image (would call ImageProcessor in production)
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(color: AppTheme.gold, borderRadius: BorderRadius.circular(AppTheme.borderRadius)),
                  child: const Center(child: Text('Apply', style: TextStyle(color: Colors.black, fontSize: 11, fontWeight: FontWeight.w600))),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  void _applyRatio(double? ratio) {
    if (ratio == null) {
      _updateCrop(const CropSettings());
      return;
    }
    final currentWidth = ref.read(editStateProvider).crop.width;
    final newHeight = currentWidth / ratio;
    _updateCrop(ref.read(editStateProvider).crop.copyWith(height: newHeight.clamp(0.1, 1.0)));
  }

  void _updateCrop(CropSettings crop) {
    ref.read(editStateProvider.notifier).updateCrop(crop);
  }
}

class _CropSlider extends StatelessWidget {
  final String label;
  final double value, max;
  final ValueChanged<double> onChanged;
  const _CropSlider({required this.label, required this.value, required this.max, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox(width: 14, child: Text(label, style: const TextStyle(color: AppTheme.textTertiary, fontSize: 9))),
        Expanded(
          child: SliderTheme(
            data: SliderThemeData(
              trackHeight: 2, thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 4),
              activeTrackColor: AppTheme.gold, inactiveTrackColor: AppTheme.border,
              thumbColor: AppTheme.gold,
            ),
            child: Slider(value: value, min: 0, max: max, onChanged: onChanged),
          ),
        ),
        SizedBox(width: 36, child: Text('${(value * 100).round()}%', style: const TextStyle(color: AppTheme.textTertiary, fontSize: 9), textAlign: TextAlign.right)),
      ],
    );
  }
}

/// Crop grid overlay — draws rule-of-thirds grid on the image
class CropGridOverlay extends StatelessWidget {
  final CropSettings crop;
  const CropGridOverlay({super.key, required this.crop});

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: CustomPaint(
        painter: _CropGridPainter(crop: crop),
      ),
    );
  }
}

class _CropGridPainter extends CustomPainter {
  final CropSettings crop;
  _CropGridPainter({required this.crop});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(0.5)
      ..strokeWidth = 0.5
      ..style = PaintingStyle.stroke;

    final x = crop.x * size.width;
    final y = crop.y * size.height;
    final w = crop.width * size.width;
    final h = crop.height * size.height;

    // Draw crop border
    canvas.drawRect(Rect.fromLTWH(x, y, w, h), Paint()
      ..color = AppTheme.gold
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2);

    // Draw rule of thirds
    for (int i = 1; i <= 2; i++) {
      final fx = x + w * i / 3;
      canvas.drawLine(Offset(fx, y), Offset(fx, y + h), paint);
      final fy = y + h * i / 3;
      canvas.drawLine(Offset(x, fy), Offset(x + w, fy), paint);
    }

    // Darken outside area
    final outsidePaint = Paint()..color = Colors.black.withOpacity(0.5);
    // Top
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, y), outsidePaint);
    // Bottom
    canvas.drawRect(Rect.fromLTWH(0, y + h, size.width, size.height - y - h), outsidePaint);
    // Left
    canvas.drawRect(Rect.fromLTWH(0, y, x, h), outsidePaint);
    // Right
    canvas.drawRect(Rect.fromLTWH(x + w, y, size.width - x - w, h), outsidePaint);
  }

  @override
  bool shouldRepaint(covariant _CropGridPainter oldDelegate) => true;
}
