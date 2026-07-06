import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/state/providers.dart';

class HomeScreen extends ConsumerWidget {
  final Widget child;

  const HomeScreen({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentRoute = GoRouterState.of(context).uri.path;

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: Row(
        children: [
          // ─── Sidebar ───────────────────────────────────
          _Sidebar(currentRoute: currentRoute),
          
          // ─── Main Content ──────────────────────────────
          Expanded(
            child: Column(
              children: [
                // ─── Top Bar ──────────────────────────────
                _TopBar(),
                
                // ─── Workspace ────────────────────────────
                Expanded(child: child),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Sidebar ───────────────────────────────────────────────

class _Sidebar extends StatelessWidget {
  final String currentRoute;

  const _Sidebar({required this.currentRoute});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: AppTheme.sidebarWidth,
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        border: Border(
          right: BorderSide(color: AppTheme.border),
        ),
      ),
      child: Column(
        children: [
          // ─── Logo ──────────────────────────────────────
          Container(
            height: AppTheme.topBarHeight,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppTheme.gold, AppTheme.goldLight],
                    ),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Icon(Icons.photo_library, size: 14, color: Colors.black),
                ),
                const SizedBox(width: 10),
                const Text(
                  'Photo Access',
                  style: TextStyle(
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppTheme.gold.withValues(alpha:0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'BETA',
                    style: TextStyle(
                      color: AppTheme.gold,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          const Divider(height: 1),
          
          // ─── Workspace Navigation ──────────────────────
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
              children: [
                _SidebarSection(
                  title: 'WORKSPACE',
                  children: [
                    _SidebarItem(
                      icon: Icons.photo_library_outlined,
                      label: 'Library',
                      shortcut: 'G',
                      isActive: currentRoute == '/library',
                      onTap: () => context.go('/library'),
                    ),
                    _SidebarItem(
                      icon: Icons.compare_outlined,
                      label: 'Cull',
                      shortcut: 'C',
                      isActive: currentRoute == '/cull',
                      onTap: () => context.go('/cull'),
                    ),
                    _SidebarItem(
                      icon: Icons.tune,
                      label: 'Develop',
                      shortcut: 'D',
                      isActive: currentRoute == '/develop',
                      onTap: () => context.go('/develop'),
                    ),
                    _SidebarItem(
                      icon: Icons.face_retouching_natural,
                      label: 'Retouch',
                      shortcut: 'R',
                      isActive: currentRoute == '/retouch',
                      onTap: () => context.go('/retouch'),
                    ),
                    _SidebarItem(
                      icon: Icons.upload_outlined,
                      label: 'Export',
                      shortcut: 'E',
                      isActive: currentRoute == '/export',
                      onTap: () => context.go('/export'),
                    ),
                  ],
                ),
                
                const SizedBox(height: 16),
                
                _SidebarSection(
                  title: 'CATALOG',
                  children: [
                    _SidebarItem(
                      icon: Icons.folder_outlined,
                      label: 'All Photos',
                      count: '0',
                      isActive: true,
                      onTap: () {},
                    ),
                    _SidebarItem(
                      icon: Icons.star_outline,
                      label: 'Favorites',
                      onTap: () {},
                    ),
                    _SidebarItem(
                      icon: Icons.flag_outlined,
                      label: 'Flagged',
                      onTap: () {},
                    ),
                    _SidebarItem(
                      icon: Icons.schedule,
                      label: 'Recent',
                      onTap: () {},
                    ),
                  ],
                ),
                
                const SizedBox(height: 16),
                
                _SidebarSection(
                  title: 'ALBUMS',
                  children: [
                    _SidebarItem(
                      icon: Icons.add,
                      label: 'New Album',
                      onTap: () {},
                    ),
                  ],
                ),
              ],
            ),
          ),
          
          const Divider(height: 1),
          
          // ─── Bottom Actions ────────────────────────────
          _SidebarItem(
            icon: Icons.settings_outlined,
            label: 'Settings',
            isActive: currentRoute == '/settings',
            onTap: () => context.go('/settings'),
          ),
        ],
      ),
    );
  }
}

// ─── Sidebar Section ───────────────────────────────────────

class _SidebarSection extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _SidebarSection({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Text(
            title,
            style: const TextStyle(
              color: AppTheme.textTertiary,
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
        ),
        ...children,
      ],
    );
  }
}

// ─── Sidebar Item ──────────────────────────────────────────

class _SidebarItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? shortcut;
  final String? count;
  final bool isActive;
  final VoidCallback onTap;

  const _SidebarItem({
    required this.icon,
    required this.label,
    this.shortcut,
    this.count,
    this.isActive = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1),
      child: Material(
        color: isActive ? AppTheme.gold.withValues(alpha:0.1) : Colors.transparent,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppTheme.borderRadius),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: isActive
                ? BoxDecoration(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                    border: Border.all(color: AppTheme.gold.withValues(alpha:0.2)),
                  )
                : null,
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 16,
                  color: isActive ? AppTheme.gold : AppTheme.textSecondary,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      color: isActive ? AppTheme.textPrimary : AppTheme.textSecondary,
                      fontSize: 12,
                      fontWeight: isActive ? FontWeight.w500 : FontWeight.normal,
                    ),
                  ),
                ),
                if (shortcut != null)
                  Text(
                    shortcut!,
                    style: const TextStyle(
                      color: AppTheme.textTertiary,
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                if (count != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceLight,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      count!,
                      style: const TextStyle(
                        color: AppTheme.textTertiary,
                        fontSize: 10,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Top Bar ───────────────────────────────────────────────

class _TopBar extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      height: AppTheme.topBarHeight,
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        border: Border(
          bottom: BorderSide(color: AppTheme.border),
        ),
      ),
      child: Row(
        children: [
          const SizedBox(width: 16),
          
          // Import Button
          _TopBarButton(
            icon: Icons.add_outlined,
            label: 'Import',
            onTap: () => _importPhotos(context, ref),
          ),
          
          const SizedBox(width: 8),
          
          // Open Catalog
          _TopBarButton(
            icon: Icons.folder_open_outlined,
            label: 'Open Catalog',
            onTap: () {},
          ),
          
          const Spacer(),
          
          // Search
          SizedBox(
            width: 240,
            height: 32,
            child: TextField(
              onChanged: (value) => ref.read(searchQueryProvider.notifier).state = value,
              decoration: InputDecoration(
                hintText: 'Search photos...',
                prefixIcon: const Icon(Icons.search, size: 16, color: AppTheme.textTertiary),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                  borderSide: const BorderSide(color: AppTheme.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                  borderSide: const BorderSide(color: AppTheme.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                  borderSide: const BorderSide(color: AppTheme.gold),
                ),
                filled: true,
                fillColor: AppTheme.background,
              ),
              style: const TextStyle(color: AppTheme.textPrimary, fontSize: 12),
            ),
          ),
          
          const SizedBox(width: 12),
          
          // AI Status
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppTheme.green.withValues(alpha:0.1),
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.circle, size: 6, color: AppTheme.green),
                SizedBox(width: 4),
                Text(
                  'AI Ready',
                  style: TextStyle(color: AppTheme.green, fontSize: 10, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
          
          const SizedBox(width: 8),
          
          // GPU Status
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppTheme.blue.withValues(alpha:0.1),
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.speed, size: 12, color: AppTheme.blue),
                SizedBox(width: 4),
                Text(
                  'GPU',
                  style: TextStyle(color: AppTheme.blue, fontSize: 10, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
          
          const SizedBox(width: 12),
        ],
      ),
    );
  }

  void _importPhotos(BuildContext context, WidgetRef ref) async {
    // TODO: Implement file picker with native dialog
    // For now, this is a placeholder
    debugPrint('Import photos clicked');
  }
}

class _TopBarButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _TopBarButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppTheme.borderRadius),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: AppTheme.textSecondary),
              const SizedBox(width: 6),
              Text(
                label,
                style: const TextStyle(
                  color: AppTheme.textSecondary,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
