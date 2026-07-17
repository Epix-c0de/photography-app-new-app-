import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/models/models.dart';
import 'package:photo_access_editor/state/providers.dart';

/// Curves adjustment panel — RGB + individual R/G/B channels
class CurvesPanel extends ConsumerStatefulWidget {
  const CurvesPanel({super.key});

  @override
  ConsumerState<CurvesPanel> createState() => _CurvesPanelState();
}

class _CurvesPanelState extends ConsumerState<CurvesPanel> {
  int _selectedChannel = 0; // 0=RGB, 1=Red, 2=Green, 3=Blue
  List<CurvePoint> _rgbPoints = [];
  List<CurvePoint> _redPoints = [];
  List<CurvePoint> _greenPoints = [];
  List<CurvePoint> _bluePoints = [];

  @override
  void initState() {
    super.initState();
    final curves = ref.read(editStateProvider).curves;
    _rgbPoints = List.from(curves.rgb);
    _redPoints = List.from(curves.red);
    _greenPoints = List.from(curves.green);
    _bluePoints = List.from(curves.blue);
    if (_rgbPoints.isEmpty) _rgbPoints = [const CurvePoint(0, 0), const CurvePoint(1, 1)];
    if (_redPoints.isEmpty) _redPoints = [const CurvePoint(0, 0), const CurvePoint(1, 1)];
    if (_greenPoints.isEmpty) _greenPoints = [const CurvePoint(0, 0), const CurvePoint(1, 1)];
    if (_bluePoints.isEmpty) _bluePoints = [const CurvePoint(0, 0), const CurvePoint(1, 1)];
  }

  List<CurvePoint> get _activePoints {
    switch (_selectedChannel) {
      case 1: return _redPoints;
      case 2: return _greenPoints;
      case 3: return _bluePoints;
      default: return _rgbPoints;
    }
  }

  void _onPointChanged(List<CurvePoint> points) {
    setState(() {
      switch (_selectedChannel) {
        case 1: _redPoints = points; break;
        case 2: _greenPoints = points; break;
        case 3: _bluePoints = points; break;
        default: _rgbPoints = points; break;
      }
    });
    ref.read(editStateProvider.notifier).updateCurves(CurvesAdjustment(
      rgb: _rgbPoints, red: _redPoints, green: _greenPoints, blue: _bluePoints,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('CURVES', style: TextStyle(color: AppTheme.textTertiary, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
        const SizedBox(height: 8),
        // Channel selector
        Row(
          children: [
            _ChBtn(label: 'RGB', isActive: _selectedChannel == 0, color: AppTheme.textPrimary, onTap: () => setState(() => _selectedChannel = 0)),
            const SizedBox(width: 4),
            _ChBtn(label: 'R', isActive: _selectedChannel == 1, color: Colors.red, onTap: () => setState(() => _selectedChannel = 1)),
            const SizedBox(width: 4),
            _ChBtn(label: 'G', isActive: _selectedChannel == 2, color: Colors.green, onTap: () => setState(() => _selectedChannel = 2)),
            const SizedBox(width: 4),
            _ChBtn(label: 'B', isActive: _selectedChannel == 3, color: Colors.blue, onTap: () => setState(() => _selectedChannel = 3)),
          ],
        ),
        const SizedBox(height: 8),
        // Curve editor
        SizedBox(
          height: 200,
          child: _CurveEditor(
            points: _activePoints,
            channelColor: _selectedChannel == 0 ? AppTheme.textPrimary :
                _selectedChannel == 1 ? Colors.red : _selectedChannel == 2 ? Colors.green : Colors.blue,
            onChanged: _onPointChanged,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            GestureDetector(
              onTap: () => _onPointChanged([const CurvePoint(0, 0), const CurvePoint(1, 1)]),
              child: const Text('Reset', style: TextStyle(color: AppTheme.gold, fontSize: 11)),
            ),
          ],
        ),
      ],
    );
  }
}

class _ChBtn extends StatelessWidget {
  final String label;
  final bool isActive;
  final Color color;
  final VoidCallback onTap;
  const _ChBtn({required this.label, required this.isActive, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: isActive ? color.withOpacity(0.2) : Colors.transparent,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: isActive ? color : AppTheme.border),
        ),
        child: Text(label, style: TextStyle(color: isActive ? color : AppTheme.textTertiary, fontSize: 10, fontWeight: FontWeight.w600)),
      ),
    );
  }
}

/// Interactive curve editor widget
class _CurveEditor extends StatefulWidget {
  final List<CurvePoint> points;
  final Color channelColor;
  final ValueChanged<List<CurvePoint>> onChanged;
  const _CurveEditor({required this.points, required this.channelColor, required this.onChanged});

  @override
  State<_CurveEditor> createState() => _CurveEditorState();
}

class _CurveEditorState extends State<_CurveEditor> {
  int? _dragIndex;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onPanStart: _onPanStart,
      onPanUpdate: _onPanUpdate,
      onPanEnd: (_) => _dragIndex = null,
      onDoubleTap: _onDoubleTap,
      child: CustomPaint(
        painter: _CurvePainter(points: widget.points, color: widget.channelColor),
        size: Size.infinite,
      ),
    );
  }

  void _onPanStart(DragStartDetails details) {
    final size = context.size!;
    final pos = details.localPosition;
    // Find closest point
    for (int i = 0; i < widget.points.length; i++) {
      final p = widget.points[i];
      final dx = p.x * size.width;
      final dy = (1 - p.y) * size.height;
      if ((pos - Offset(dx, dy)).distance < 15) {
        _dragIndex = i;
        return;
      }
    }
  }

  void _onPanUpdate(DragUpdateDetails details) {
    if (_dragIndex == null) return;
    final size = context.size!;
    final pos = details.localPosition;
    final x = (pos.dx / size.width).clamp(0.0, 1.0);
    final y = (1 - pos.dy / size.height).clamp(0.0, 1.0);

    final newPoints = List<CurvePoint>.from(widget.points);
    // Don't move first/last point on x axis
    if (_dragIndex == 0) {
      newPoints[0] = CurvePoint(0, y);
    } else if (_dragIndex == newPoints.length - 1) {
      newPoints[newPoints.length - 1] = CurvePoint(1, y);
    } else {
      newPoints[_dragIndex!] = CurvePoint(x, y);
    }
    widget.onChanged(newPoints);
  }

  void _onDoubleTap() {
    final size = context.size!;
    final RenderBox? box = context.findRenderObject() as RenderBox?;
    if (box == null) return;
    // Add point at tap position — simplified: add at center
    final mid = widget.points.length ~/ 2;
    final newPoints = List<CurvePoint>.from(widget.points);
    newPoints.insert(mid, const CurvePoint(0.5, 0.5));
    newPoints.sort((a, b) => a.x.compareTo(b.x));
    widget.onChanged(newPoints);
  }
}

class _CurvePainter extends CustomPainter {
  final List<CurvePoint> points;
  final Color color;
  _CurvePainter({required this.points, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final bgPaint = Paint()..color = const Color(0xFF1A1A2E);
    canvas.drawRRect(RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(6)), bgPaint);

    // Grid lines
    final gridPaint = Paint()..color = AppTheme.border..strokeWidth = 0.5;
    for (int i = 1; i < 4; i++) {
      final frac = i / 4.0;
      canvas.drawLine(Offset(frac * size.width, 0), Offset(frac * size.width, size.height), gridPaint);
      canvas.drawLine(Offset(0, frac * size.height), Offset(size.width, frac * size.height), gridPaint);
    }

    // Diagonal reference
    final refPaint = Paint()..color = AppTheme.textTertiary.withOpacity(0.3)..strokeWidth = 1;
    canvas.drawLine(Offset(0, size.height), Offset(size.width, 0), refPaint);

    // Draw curve
    if (points.length >= 2) {
      final sorted = List<CurvePoint>.from(points)..sort((a, b) => a.x.compareTo(b.x));
      final path = Path();
      path.moveTo(sorted[0].x * size.width, (1 - sorted[0].y) * size.height);
      for (int i = 1; i < sorted.length; i++) {
        final prev = sorted[i - 1];
        final curr = sorted[i];
        final cp1x = (prev.x + curr.x) / 2 * size.width;
        final cp1y = (1 - prev.y) * size.height;
        final cp2x = cp1x;
        final cp2y = (1 - curr.y) * size.height;
        path.cubicTo(cp1x, cp1y, cp2x, cp2y, curr.x * size.width, (1 - curr.y) * size.height);
      }

      final curvePaint = Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2;
      canvas.drawPath(path, curvePaint);

      // Draw control points
      for (final p in points) {
        canvas.drawCircle(
          Offset(p.x * size.width, (1 - p.y) * size.height),
          5,
          Paint()..color = color..style = PaintingStyle.fill,
        );
        canvas.drawCircle(
          Offset(p.x * size.width, (1 - p.y) * size.height),
          5,
          Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 1.5,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _CurvePainter oldDelegate) => true;
}
