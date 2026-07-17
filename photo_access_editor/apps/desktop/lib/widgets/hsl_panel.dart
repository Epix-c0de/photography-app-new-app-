import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/models/models.dart';
import 'package:photo_access_editor/state/providers.dart';

/// HSL adjustment panel — 8 color ranges × 3 controls (hue/sat/lum)
class HslPanel extends ConsumerWidget {
  const HslPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hsl = ref.watch(editStateProvider).hsl;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('HSL / COLOR', style: TextStyle(color: AppTheme.textTertiary, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
        const SizedBox(height: 12),
        Expanded(
          child: ListView(
            children: [
              _ColorRow(label: 'Red', color: Colors.red,
                hue: hsl.hueRed, sat: hsl.satRed, lum: hsl.lumRed,
                onHue: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(hueRed: v)),
                onSat: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(satRed: v)),
                onLum: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(lumRed: v)),
              ),
              _ColorRow(label: 'Orange', color: Colors.orange,
                hue: hsl.hueOrange, sat: hsl.satOrange, lum: hsl.lumOrange,
                onHue: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(hueOrange: v)),
                onSat: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(satOrange: v)),
                onLum: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(lumOrange: v)),
              ),
              _ColorRow(label: 'Yellow', color: Colors.yellow,
                hue: hsl.hueYellow, sat: hsl.satYellow, lum: hsl.lumYellow,
                onHue: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(hueYellow: v)),
                onSat: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(satYellow: v)),
                onLum: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(lumYellow: v)),
              ),
              _ColorRow(label: 'Green', color: Colors.green,
                hue: hsl.hueGreen, sat: hsl.satGreen, lum: hsl.lumGreen,
                onHue: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(hueGreen: v)),
                onSat: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(satGreen: v)),
                onLum: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(lumGreen: v)),
              ),
              _ColorRow(label: 'Aqua', color: Colors.teal,
                hue: hsl.hueAqua, sat: hsl.satAqua, lum: hsl.lumAqua,
                onHue: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(hueAqua: v)),
                onSat: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(satAqua: v)),
                onLum: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(lumAqua: v)),
              ),
              _ColorRow(label: 'Blue', color: Colors.blue,
                hue: hsl.hueBlue, sat: hsl.satBlue, lum: hsl.lumBlue,
                onHue: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(hueBlue: v)),
                onSat: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(satBlue: v)),
                onLum: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(lumBlue: v)),
              ),
              _ColorRow(label: 'Purple', color: Colors.purple,
                hue: hsl.huePurple, sat: hsl.satPurple, lum: hsl.lumPurple,
                onHue: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(huePurple: v)),
                onSat: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(satPurple: v)),
                onLum: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(lumPurple: v)),
              ),
              _ColorRow(label: 'Magenta', color: Colors.pink,
                hue: hsl.hueMagenta, sat: hsl.satMagenta, lum: hsl.lumMagenta,
                onHue: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(hueMagenta: v)),
                onSat: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(satMagenta: v)),
                onLum: (v) => ref.read(editStateProvider.notifier).updateHsl(hsl.copyWith(lumMagenta: v)),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ColorRow extends StatelessWidget {
  final String label;
  final Color color;
  final double hue, sat, lum;
  final ValueChanged<double> onHue, onSat, onLum;

  const _ColorRow({
    required this.label, required this.color,
    required this.hue, required this.sat, required this.lum,
    required this.onHue, required this.onSat, required this.onLum,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
            const SizedBox(width: 6),
            Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
          ]),
          const SizedBox(height: 4),
          _MiniSlider(label: 'H', value: hue, min: -180, max: 180, onChanged: onHue),
          _MiniSlider(label: 'S', value: sat, min: -100, max: 100, onChanged: onSat),
          _MiniSlider(label: 'L', value: lum, min: -100, max: 100, onChanged: onLum),
        ],
      ),
    );
  }
}

class _MiniSlider extends StatelessWidget {
  final String label;
  final double value, min, max;
  final ValueChanged<double> onChanged;
  const _MiniSlider({required this.label, required this.value, required this.min, required this.max, required this.onChanged});

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
              thumbColor: AppTheme.gold, overlayShape: const RoundSliderOverlayShape(overlayRadius: 10),
            ),
            child: Slider(value: value, min: min, max: max, onChanged: onChanged),
          ),
        ),
        SizedBox(width: 32, child: Text(value.round().toString(), style: const TextStyle(color: AppTheme.textTertiary, fontSize: 9), textAlign: TextAlign.right)),
      ],
    );
  }
}
