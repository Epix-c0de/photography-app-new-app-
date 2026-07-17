import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/state/providers.dart';
import 'package:photo_access_editor/services/ai_scorer.dart';
import 'package:photo_access_editor/widgets/filmstrip.dart';

class CullScreen extends ConsumerWidget {
  const CullScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final photos = ref.watch(filteredPhotosProvider);
    final selectedPhoto = ref.watch(selectedPhotoProvider);
    final aiScoresAsync = ref.watch(selectedPhotoAiScoresProvider);

    return Row(
      children: [
        // Left: Session Filters
        Container(
          width: 200,
          decoration: const BoxDecoration(border: Border(right: BorderSide(color: AppTheme.border))),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _PanelHdr(title: 'SESSION FILTERS'),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    _FilterSec(title: 'Rating', children: [
                      _FilterChip(label: 'All', count: photos.length, isActive: true),
                      _FilterChip(label: '\u2605\u2605\u2605\u2605\u2605', count: photos.where((p) => p.rating == 5).length),
                      _FilterChip(label: '\u2605\u2605\u2605\u2605', count: photos.where((p) => p.rating == 4).length),
                      _FilterChip(label: '\u2605\u2605\u2605', count: photos.where((p) => p.rating == 3).length),
                    ]),
                    const SizedBox(height: 16),
                    _FilterSec(title: 'Flag', children: [
                      _FilterChip(label: 'All', count: photos.length, isActive: true),
                      _FilterChip(label: 'Pick', count: photos.where((p) => p.flag == 'pick').length, color: AppTheme.green),
                      _FilterChip(label: 'Reject', count: photos.where((p) => p.flag == 'reject').length, color: AppTheme.red),
                      _FilterChip(label: 'Review', count: photos.where((p) => p.flag == 'review').length, color: AppTheme.orange),
                    ]),
                    const SizedBox(height: 16),
                    _FilterSec(title: 'Type', children: [
                      _FilterChip(label: 'All', count: photos.length, isActive: true),
                      _FilterChip(label: 'RAW', count: photos.where((p) => p.isRaw).length, color: AppTheme.orange),
                      _FilterChip(label: 'Image', count: photos.where((p) => !p.isRaw).length, color: AppTheme.blue),
                    ]),
                    const SizedBox(height: 16),
                    _FilterSec(title: 'AI Score', children: [
                      _FilterChip(label: 'Excellent (80+)', count: 0, color: AppTheme.green),
                      _FilterChip(label: 'Good (60-79)', count: 0, color: AppTheme.gold),
                      _FilterChip(label: 'Fair (40-59)', count: 0, color: AppTheme.orange),
                      _FilterChip(label: 'Poor (<40)', count: 0, color: AppTheme.red),
                    ]),
                  ],
                ),
              ),
            ],
          ),
        ),

        // Center: Comparison View
        Expanded(
          child: Column(
            children: [
              Container(
                height: 40,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppTheme.border))),
                child: Row(
                  children: [
                    _ViewTab(label: 'Single', isActive: true),
                    _ViewTab(label: '2 Up'),
                    _ViewTab(label: '4 Up'),
                    const Spacer(),
                    _ActBtn(label: 'Pick', icon: Icons.check, color: AppTheme.green, onTap: selectedPhoto != null ? () {
                      ref.read(photosProvider.notifier).updateFlag(selectedPhoto.photoId, 'pick');
                    } : null),
                    const SizedBox(width: 8),
                    _ActBtn(label: 'Reject', icon: Icons.close, color: AppTheme.red, onTap: selectedPhoto != null ? () {
                      ref.read(photosProvider.notifier).updateFlag(selectedPhoto.photoId, 'reject');
                    } : null),
                    const SizedBox(width: 8),
                    _ActBtn(label: 'Review', icon: Icons.help_outline, color: AppTheme.orange, onTap: selectedPhoto != null ? () {
                      ref.read(photosProvider.notifier).updateFlag(selectedPhoto.photoId, 'review');
                    } : null),
                  ],
                ),
              ),
              Expanded(
                child: Container(
                  color: AppTheme.background,
                  child: selectedPhoto == null
                      ? const Center(child: Text('Select a photo to compare', style: TextStyle(color: AppTheme.textTertiary)))
                      : Center(
                          child: InteractiveViewer(
                            maxScale: 5.0,
                            child: Image.file(
                              File(selectedPhoto.filePath),
                              fit: BoxFit.contain,
                              gaplessPlayback: true,
                              errorBuilder: (ctx, e, s) => const Icon(Icons.broken_image, size: 48, color: AppTheme.textTertiary),
                            ),
                          ),
                        ),
                ),
              ),
              const Filmstrip(),
            ],
          ),
        ),

        // Right: AI Scores (real data)
        Container(
          width: 220,
          decoration: const BoxDecoration(border: Border(left: BorderSide(color: AppTheme.border))),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _PanelHdr(title: 'AI SCORES'),
              Expanded(
                child: aiScoresAsync.when(
                  loading: () => const Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.gold)),
                  error: (e, s) => Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline, size: 32, color: AppTheme.red),
                        const SizedBox(height: 8),
                        Text('Scoring failed', style: TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
                      ],
                    ),
                  ),
                  data: (scores) => scores == null
                      ? const Center(child: Text('Select a photo to score', style: TextStyle(color: AppTheme.textTertiary, fontSize: 11)))
                      : ListView(
                          padding: const EdgeInsets.all(12),
                          children: [
                            _ScoreCard(label: 'Sharpness', score: scores.sharpness),
                            const SizedBox(height: 8),
                            _ScoreCard(label: 'Exposure', score: scores.exposure),
                            const SizedBox(height: 8),
                            _ScoreCard(label: 'Composition', score: scores.composition),
                            const SizedBox(height: 8),
                            _ScoreCard(label: 'Color Quality', score: scores.colorQuality),
                            const SizedBox(height: 16),
                            _OverallScoreCard(score: scores.overall),
                          ],
                        ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _PanelHdr extends StatelessWidget {
  final String title;
  const _PanelHdr({required this.title});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 40,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppTheme.border))),
      child: Align(alignment: Alignment.centerLeft, child: Text(title, style: const TextStyle(color: AppTheme.textTertiary, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.5))),
    );
  }
}

class _FilterSec extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _FilterSec({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(color: AppTheme.textTertiary, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
        const SizedBox(height: 8),
        ...children,
      ],
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final int count;
  final bool isActive;
  final Color? color;
  const _FilterChip({required this.label, required this.count, this.isActive = false, this.color});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Material(
        color: isActive ? (color ?? AppTheme.gold).withAlpha(25) : Colors.transparent,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        child: InkWell(
          onTap: () {},
          borderRadius: BorderRadius.circular(AppTheme.borderRadius),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            child: Row(
              children: [
                Expanded(child: Text(label, style: TextStyle(color: isActive ? AppTheme.textPrimary : AppTheme.textSecondary, fontSize: 11))),
                Text('$count', style: const TextStyle(color: AppTheme.textTertiary, fontSize: 10)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ViewTab extends StatelessWidget {
  final String label;
  final bool isActive;
  const _ViewTab({required this.label, this.isActive = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(right: 4),
      child: Material(
        color: isActive ? AppTheme.gold.withAlpha(25) : Colors.transparent,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        child: InkWell(
          onTap: () {},
          borderRadius: BorderRadius.circular(AppTheme.borderRadius),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Text(label, style: TextStyle(color: isActive ? AppTheme.gold : AppTheme.textSecondary, fontSize: 11, fontWeight: isActive ? FontWeight.w500 : FontWeight.normal)),
          ),
        ),
      ),
    );
  }
}

class _ActBtn extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;
  const _ActBtn({required this.label, required this.icon, required this.color, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color.withAlpha(onTap != null ? 25 : 10),
      borderRadius: BorderRadius.circular(AppTheme.borderRadius),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 12, color: color.withAlpha(onTap != null ? 255 : 100)),
            const SizedBox(width: 4),
            Text(label, style: TextStyle(color: color.withAlpha(onTap != null ? 255 : 100), fontSize: 11, fontWeight: FontWeight.w500)),
          ]),
        ),
      ),
    );
  }
}

class _ScoreCard extends StatelessWidget {
  final String label;
  final int score;
  const _ScoreCard({required this.label, required this.score});

  Color get _color {
    if (score >= 80) return AppTheme.green;
    if (score >= 60) return AppTheme.gold;
    if (score >= 40) return AppTheme.orange;
    return AppTheme.red;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: AppTheme.surfaceLight, borderRadius: BorderRadius.circular(AppTheme.borderRadius), border: Border.all(color: AppTheme.border)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
            Text('$score', style: TextStyle(color: _color, fontSize: 11, fontWeight: FontWeight.bold)),
          ]),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: LinearProgressIndicator(value: score / 100, backgroundColor: AppTheme.border, valueColor: AlwaysStoppedAnimation(_color), minHeight: 3),
          ),
        ],
      ),
    );
  }
}

class _OverallScoreCard extends StatelessWidget {
  final int score;
  const _OverallScoreCard({required this.score});

  Color get _color {
    if (score >= 80) return AppTheme.green;
    if (score >= 60) return AppTheme.gold;
    if (score >= 40) return AppTheme.orange;
    return AppTheme.red;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _color.withAlpha(25),
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        border: Border.all(color: _color.withAlpha(75)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('OVERALL SCORE', style: TextStyle(color: _color, fontSize: 10, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text('$score', style: TextStyle(color: AppTheme.textPrimary, fontSize: 32, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(
            score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Review',
            style: TextStyle(color: _color, fontSize: 11),
          ),
        ],
      ),
    );
  }
}
