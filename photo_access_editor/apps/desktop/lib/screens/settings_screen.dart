import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/theme/app_theme.dart';

final _activeSettingsTabProvider = StateProvider<int>((ref) => 0);

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeTab = ref.watch(_activeSettingsTabProvider);

    return Row(
      children: [
        // ─── Left: Settings Navigation ──────────────────
        Container(
          width: 220,
          decoration: const BoxDecoration(border: Border(right: BorderSide(color: AppTheme.border))),
          child: ListView(
            padding: const EdgeInsets.all(8),
            children: [
              _SettingsNavItem(label: 'General', icon: Icons.settings, isActive: activeTab == 0, onTap: () => ref.read(_activeSettingsTabProvider.notifier).state = 0),
              _SettingsNavItem(label: 'Performance', icon: Icons.speed, isActive: activeTab == 1, onTap: () => ref.read(_activeSettingsTabProvider.notifier).state = 1),
              _SettingsNavItem(label: 'GPU', icon: Icons.memory, isActive: activeTab == 2, onTap: () => ref.read(_activeSettingsTabProvider.notifier).state = 2),
              _SettingsNavItem(label: 'AI', icon: Icons.psychology, isActive: activeTab == 3, onTap: () => ref.read(_activeSettingsTabProvider.notifier).state = 3),
              _SettingsNavItem(label: 'Catalog', icon: Icons.folder, isActive: activeTab == 4, onTap: () => ref.read(_activeSettingsTabProvider.notifier).state = 4),
              _SettingsNavItem(label: 'Plugins', icon: Icons.extension, isActive: activeTab == 5, onTap: () => ref.read(_activeSettingsTabProvider.notifier).state = 5),
              _SettingsNavItem(label: 'Shortcuts', icon: Icons.keyboard, isActive: activeTab == 6, onTap: () => ref.read(_activeSettingsTabProvider.notifier).state = 6),
              _SettingsNavItem(label: 'Appearance', icon: Icons.palette, isActive: activeTab == 7, onTap: () => ref.read(_activeSettingsTabProvider.notifier).state = 7),
            ],
          ),
        ),

        // ─── Right: Settings Content ────────────────────
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              if (activeTab == 0) ...[
                const Text('General Settings', style: TextStyle(color: AppTheme.textPrimary, fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 24),
                _SettingsSection(title: 'APPLICATION', children: [
                  _SettingsToggle(label: 'Auto-save edits', description: 'Automatically save edit changes', value: true, onChanged: (v) {}),
                  const SizedBox(height: 12),
                  _SettingsToggle(label: 'Show startup dashboard', description: 'Open catalog selection on launch', value: true, onChanged: (v) {}),
                  const SizedBox(height: 12),
                  _SettingsToggle(label: 'Check for updates', description: 'Automatically check for new versions', value: true, onChanged: (v) {}),
                ]),
                const SizedBox(height: 24),
                _SettingsSection(title: 'FILE HANDLING', children: [
                  _SettingsToggle(label: 'Copy files on import', description: 'Copy RAW files to catalog instead of linking', value: false, onChanged: (v) {}),
                  const SizedBox(height: 12),
                  _SettingsToggle(label: 'Generate previews on import', description: 'Create preview images during import', value: true, onChanged: (v) {}),
                ]),
                const SizedBox(height: 24),
                _SettingsSection(title: 'ACCOUNT', children: [
                  _SettingsRow(label: 'Email', value: 'photographer@example.com'),
                  const SizedBox(height: 8),
                  _SettingsRow(label: 'License', value: 'Professional', valueColor: AppTheme.gold),
                  const SizedBox(height: 8),
                  _SettingsRow(label: 'Subscription', value: 'Active', valueColor: AppTheme.green),
                ]),
              ],
              if (activeTab == 1) ...[
                const Text('Performance', style: TextStyle(color: AppTheme.textPrimary, fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 24),
                _SettingsSection(title: 'RENDERING', children: [
                  _SettingsRow(label: 'Preview quality', value: 'High'),
                  const SizedBox(height: 8),
                  _SettingsRow(label: 'Thumbnail size', value: '256px'),
                  const SizedBox(height: 8),
                  _SettingsRow(label: 'Cache size', value: '2.1 GB'),
                ]),
                const SizedBox(height: 24),
                _SettingsSection(title: 'MEMORY', children: [
                  _SettingsRow(label: 'Max memory usage', value: '4 GB'),
                  const SizedBox(height: 8),
                  _SettingsRow(label: 'Background processes', value: '4'),
                ]),
              ],
              if (activeTab == 2) ...[
                const Text('GPU', style: TextStyle(color: AppTheme.textPrimary, fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 24),
                _SettingsSection(title: 'GPU ACCELERATION', children: [
                  _SettingsToggle(label: 'Enable GPU rendering', description: 'Use GPU for image processing', value: true, onChanged: (v) {}),
                  const SizedBox(height: 12),
                  _SettingsRow(label: 'GPU', value: 'NVIDIA RTX 4060'),
                  const SizedBox(height: 8),
                  _SettingsRow(label: 'VRAM', value: '8 GB'),
                  const SizedBox(height: 8),
                  _SettingsRow(label: 'CUDA cores', value: '3072'),
                ]),
              ],
              if (activeTab == 3) ...[
                const Text('AI', style: TextStyle(color: AppTheme.textPrimary, fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 24),
                _SettingsSection(title: 'AI ENGINE', children: [
                  _SettingsToggle(label: 'Enable AI features', description: 'Use AI for culling, masking, and retouching', value: true, onChanged: (v) {}),
                  const SizedBox(height: 12),
                  _SettingsRow(label: 'Models loaded', value: '3'),
                  const SizedBox(height: 8),
                  _SettingsRow(label: 'GPU acceleration', value: 'Enabled'),
                ]),
              ],
              if (activeTab == 4) ...[
                const Text('Catalog', style: TextStyle(color: AppTheme.textPrimary, fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 24),
                _SettingsSection(title: 'CATALOG SETTINGS', children: [
                  _SettingsRow(label: 'Storage location', value: '~/PhotoAccess/Catalogs'),
                  const SizedBox(height: 8),
                  _SettingsRow(label: 'Total catalogs', value: '3'),
                  const SizedBox(height: 8),
                  _SettingsRow(label: 'Total photos', value: '1,247'),
                ]),
              ],
              if (activeTab == 5) ...[
                const Text('Plugins', style: TextStyle(color: AppTheme.textPrimary, fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 24),
                _SettingsSection(title: 'INSTALLED PLUGINS', children: [
                  _SettingsRow(label: 'No plugins installed', value: ''),
                ]),
              ],
              if (activeTab == 6) ...[
                const Text('Shortcuts', style: TextStyle(color: AppTheme.textPrimary, fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 24),
                _SettingsSection(title: 'KEYBOARD SHORTCUTS', children: [
                  _SettingsRow(label: 'Ctrl+Z', value: 'Undo'),
                  const SizedBox(height: 8),
                  _SettingsRow(label: 'Ctrl+Shift+Z', value: 'Redo'),
                  const SizedBox(height: 8),
                  _SettingsRow(label: 'Ctrl+S', value: 'Save'),
                  const SizedBox(height: 8),
                  _SettingsRow(label: 'G', value: 'Library'),
                  const SizedBox(height: 8),
                  _SettingsRow(label: 'C', value: 'Cull'),
                  const SizedBox(height: 8),
                  _SettingsRow(label: 'D', value: 'Develop'),
                  const SizedBox(height: 8),
                  _SettingsRow(label: 'R', value: 'Retouch'),
                  const SizedBox(height: 8),
                  _SettingsRow(label: 'E', value: 'Export'),
                ]),
              ],
              if (activeTab == 7) ...[
                const Text('Appearance', style: TextStyle(color: AppTheme.textPrimary, fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 24),
                _SettingsSection(title: 'THEME', children: [
                  _SettingsRow(label: 'Theme', value: 'Dark'),
                  const SizedBox(height: 8),
                  _SettingsRow(label: 'Accent color', value: 'Gold'),
                  const SizedBox(height: 8),
                  _SettingsRow(label: 'Font size', value: 'Default'),
                ]),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _SettingsNavItem extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isActive;
  final VoidCallback onTap;
  const _SettingsNavItem({required this.label, required this.icon, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isActive ? AppTheme.gold.withOpacity(0.1) : Colors.transparent,
      borderRadius: BorderRadius.circular(AppTheme.borderRadius),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: isActive ? BoxDecoration(borderRadius: BorderRadius.circular(AppTheme.borderRadius), border: Border.all(color: AppTheme.gold.withOpacity(0.3))) : null,
          child: Row(children: [
            Icon(icon, size: 16, color: isActive ? AppTheme.gold : AppTheme.textSecondary),
            const SizedBox(width: 10),
            Text(label, style: TextStyle(color: isActive ? AppTheme.textPrimary : AppTheme.textSecondary, fontSize: 12, fontWeight: isActive ? FontWeight.w500 : FontWeight.normal)),
          ]),
        ),
      ),
    );
  }
}

class _SettingsSection extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _SettingsSection({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppTheme.surface, borderRadius: BorderRadius.circular(AppTheme.borderRadiusLg), border: Border.all(color: AppTheme.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(color: AppTheme.textTertiary, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
        const SizedBox(height: 12),
        ...children,
      ]),
    );
  }
}

class _SettingsToggle extends StatelessWidget {
  final String label;
  final String description;
  final bool value;
  final ValueChanged<bool> onChanged;
  const _SettingsToggle({required this.label, required this.description, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(color: AppTheme.textPrimary, fontSize: 12)),
        Text(description, style: const TextStyle(color: AppTheme.textTertiary, fontSize: 11)),
      ])),
      Switch(value: value, onChanged: onChanged, activeColor: AppTheme.gold),
    ]);
  }
}

class _SettingsRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;
  const _SettingsRow({required this.label, required this.value, this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
      Text(value, style: TextStyle(color: valueColor ?? AppTheme.textPrimary, fontSize: 12, fontWeight: FontWeight.w500)),
    ]);
  }
}
