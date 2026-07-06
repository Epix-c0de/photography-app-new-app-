import 'package:flutter/material.dart';
import 'package:photo_access_editor/theme/app_theme.dart';

class AdjustmentSlider extends StatelessWidget {
  final String label;
  final double value;
  final double min;
  final double max;
  final double defaultValue;
  final ValueChanged<double> onChanged;

  const AdjustmentSlider({
    super.key,
    required this.label,
    required this.value,
    required this.min,
    required this.max,
    required this.defaultValue,
    required this.onChanged,
  });

  bool get isModified => (value - defaultValue).abs() > 0.01;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: AppTheme.textSecondary,
                  fontSize: 11,
                ),
              ),
              const Spacer(),
              if (isModified)
                GestureDetector(
                  onTap: () => onChanged(defaultValue),
                  child: Text(
                    _formatValue(value),
                    style: const TextStyle(
                      color: AppTheme.gold,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                )
              else
                Text(
                  _formatValue(value),
                  style: const TextStyle(
                    color: AppTheme.textTertiary,
                    fontSize: 11,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 4),
          SliderTheme(
            data: SliderThemeData(
              activeTrackColor: isModified ? AppTheme.gold : AppTheme.textTertiary,
              inactiveTrackColor: AppTheme.border,
              thumbColor: isModified ? AppTheme.gold : AppTheme.textTertiary,
              overlayColor: AppTheme.gold.withValues(alpha:0.1),
              trackHeight: 2,
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 5),
              overlayShape: const RoundSliderOverlayShape(overlayRadius: 10),
            ),
            child: Slider(
              value: value.clamp(min, max),
              min: min,
              max: max,
              onChanged: onChanged,
            ),
          ),
        ],
      ),
    );
  }

  String _formatValue(double val) {
    if (min == 2000 && max == 50000) {
      return '${val.round()}K';
    }
    if (val == val.roundToDouble()) {
      return val.round().toString();
    }
    return val.toStringAsFixed(1);
  }
}
