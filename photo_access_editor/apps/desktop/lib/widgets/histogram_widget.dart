import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/state/providers.dart';
import 'package:photo_access_editor/models/models.dart';

/// Histogram widget — displays real RGB + luminance histogram from image
class HistogramWidget extends ConsumerWidget {
  const HistogramWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final histogramAsync = ref.watch(histogramProvider);

    return Container(
      height: 120,
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: AppTheme.surfaceLight,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
      ),
      child: histogramAsync.when(
        data: (data) {
          if (data == null) {
            return const Center(child: Text('No image', style: TextStyle(color: AppTheme.textTertiary, fontSize: 10)));
          }
          return _HistogramPainterWidget(data: data);
        },
        loading: () => const Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.gold)),
        error: (_, __) => const Center(child: Text('Error', style: TextStyle(color: AppTheme.textTertiary, fontSize: 10))),
      ),
    );
  }
}

class _HistogramPainterWidget extends StatelessWidget {
  final HistogramData data;
  const _HistogramPainterWidget({required this.data});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(painter: _HistogramPainter(data: data), size: Size.infinite);
  }
}

class _HistogramPainter extends CustomPainter {
  final HistogramData data;
  _HistogramPainter({required this.data});

  @override
  void paint(Canvas canvas, Size size) {
    final maxVal = data.maxValue.toDouble();
    if (maxVal == 0) return;
    final binWidth = size.width / 256;

    // Draw luminance (white, semi-transparent)
    _drawChannel(canvas, data.luminance, Colors.white.withOpacity(0.3), binWidth, size.width, size.height, maxVal);
    // Draw RGB channels
    _drawChannel(canvas, data.red, Colors.red.withOpacity(0.5), binWidth, size.width, size.height, maxVal);
    _drawChannel(canvas, data.green, Colors.green.withOpacity(0.5), binWidth, size.width, size.height, maxVal);
    _drawChannel(canvas, data.blue, Colors.blue.withOpacity(0.5), binWidth, size.width, size.height, maxVal);
  }

  void _drawChannel(Canvas canvas, List<int> channel, Color color, double binWidth, double width, double height, double maxVal) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final path = Path();
    path.moveTo(0, height);

    for (int i = 0; i < 256; i++) {
      final x = i * binWidth;
      final y = height - (channel[i] / maxVal) * height;
      path.lineTo(x, y);
    }

    path.lineTo(width, height);
    path.close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _HistogramPainter oldDelegate) => true;
}
