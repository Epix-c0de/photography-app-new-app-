import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/models/models.dart';
import 'package:photo_access_editor/state/providers.dart';

/// Color Grading panel — shadows/midtones/highlights wheels
class ColorGradingPanel extends ConsumerWidget {
  const ColorGradingPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cg = ref.watch(editStateProvider).colorGrading;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('COLOR GRADING', style: TextStyle(color: AppTheme.textTertiary, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
        const SizedBox(height: 12),
        _ColorWheelControl(
          label: 'Shadows',
          wheel: cg.shadows,
          onChanged: (w) => ref.read(editStateProvider.notifier).updateColorGrading(cg.copyWith(shadows: w)),
        ),
        const SizedBox(height: 12),
        _ColorWheelControl(
          label: 'Midtones',
          wheel: cg.midtones,
          onChanged: (w) => ref.read(editStateProvider.notifier).updateColorGrading(cg.copyWith(midtones: w)),
        ),
        const SizedBox(height: 12),
        _ColorWheelControl(
          label: 'Highlights',
          wheel: cg.highlights,
          onChanged: (w) => ref.read(editStateProvider.notifier).updateColorGrading(cg.copyWith(highlights: w)),
        ),
        const SizedBox(height: 12),
        const Text('BALANCE', style: TextStyle(color: AppTheme.textTertiary, fontSize: 9, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
        const SizedBox(height: 4),
        Row(
          children: [
            const Text('Shadows', style: TextStyle(color: AppTheme.textTertiary, fontSize: 9)),
            Expanded(
              child: SliderTheme(
                data: SliderThemeData(
                  trackHeight: 2, thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 4),
                  activeTrackColor: AppTheme.gold, inactiveTrackColor: AppTheme.border,
                  thumbColor: AppTheme.gold,
                ),
                child: Slider(value: cg.balance, min: -100, max: 100,
                  onChanged: (v) => ref.read(editStateProvider.notifier).updateColorGrading(cg.copyWith(balance: v)),
                ),
              ),
            ),
            const Text('Highlights', style: TextStyle(color: AppTheme.textTertiary, fontSize: 9)),
          ],
        ),
      ],
    );
  }
}

class _ColorWheelControl extends StatefulWidget {
  final String label;
  final ColorWheel wheel;
  final ValueChanged<ColorWheel> onChanged;
  const _ColorWheelControl({required this.label, required this.wheel, required this.onChanged});

  @override
  State<_ColorWheelControl> createState() => _ColorWheelControlState();
}

class _ColorWheelControlState extends State<_ColorWheelControl> {
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11, fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        SizedBox(
          height: 120,
          child: GestureDetector(
            onPanUpdate: _onPanUpdate,
            child: CustomPaint(
              painter: _WheelPainter(hue: widget.wheel.hue, saturation: widget.wheel.saturation),
              size: Size.infinite,
            ),
          ),
        ),
        const SizedBox(height: 4),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('H: ${widget.wheel.hue.round()}°', style: const TextStyle(color: AppTheme.textTertiary, fontSize: 9)),
            Text('S: ${widget.wheel.saturation.round()}%', style: const TextStyle(color: AppTheme.textTertiary, fontSize: 9)),
          ],
        ),
      ],
    );
  }

  void _onPanUpdate(DragUpdateDetails details) {
    final size = context.size!;
    final cx = size.width / 2;
    final cy = size.height / 2;
    final dx = details.localPosition.dx - cx;
    final dy = details.localPosition.dy - cy;
    final dist = sqrt(dx * dx + dy * dy);
    final maxR = min(cx, cy);
    final saturation = (dist / maxR * 100).clamp(0.0, 100.0);
    final hue = (atan2(dy, dx) * 180 / pi + 180) % 360;
    widget.onChanged(ColorWheel(hue: hue, saturation: saturation));
  }
}

class _WheelPainter extends CustomPainter {
  final double hue;
  final double saturation;
  _WheelPainter({required this.hue, required this.saturation});

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final r = min(cx, cy) - 4;

    // Draw color wheel background
    for (int angle = 0; angle < 360; angle += 2) {
      final paint = Paint()
        ..color = HSLColor.fromAHSL(1, angle.toDouble(), 1, 0.5).toColor()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3;
      final startAngle = angle * pi / 180;
      canvas.drawArc(Rect.fromCircle(center: Offset(cx, cy), radius: r), startAngle, 4 * pi / 180, false, paint);
    }

    // Draw gray ring
    canvas.drawCircle(Offset(cx, cy), r * 0.4, Paint()..color = const Color(0xFF2A2A3E)..style = PaintingStyle.fill);

    // Draw indicator
    final indicatorAngle = hue * pi / 180;
    final indicatorR = r * 0.4 + (r * 0.6) * (saturation / 100);
    final ix = cx + cos(indicatorAngle) * indicatorR;
    final iy = cy + sin(indicatorAngle) * indicatorR;
    canvas.drawCircle(Offset(ix, iy), 6, Paint()..color = Colors.white..style = PaintingStyle.fill);
    canvas.drawCircle(Offset(ix, iy), 6, Paint()..color = Colors.black..style = PaintingStyle.stroke..strokeWidth = 2);
  }

  @override
  bool shouldRepaint(covariant _WheelPainter oldDelegate) => true;
}
