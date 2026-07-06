# Photo Access Editor

Professional desktop photo editing application built with Flutter + Rust.

## Quick Start

### 1. Install Prerequisites

```bash
# Install Flutter (3.19+)
# https://docs.flutter.dev/get-started/install/windows/desktop

# Install Rust
# https://rustup.rs/
rustup default stable

# Install Flutter Rust Bridge
cargo install flutter_rust_bridge_codegen
```

### 2. Setup Project

```bash
cd photo_access_editor

# Build Rust services
cd services
cargo build
cd ..

# Setup Flutter app
cd apps/desktop
flutter pub get
cd ../..
```

### 3. Run

```bash
cd apps/desktop
flutter run -d windows
```

## Project Structure

```
photo_access_editor/
├── apps/
│   └── desktop/              ← Flutter Desktop App
│       ├── lib/
│       │   ├── main.dart
│       │   ├── core/         ← Config, constants
│       │   ├── features/     ← Feature modules
│       │   │   ├── library/
│       │   │   ├── cull/
│       │   │   ├── develop/
│       │   │   ├── retouch/
│       │   │   └── export/
│       │   ├── models/       ← Data models
│       │   ├── routing/      ← GoRouter setup
│       │   ├── screens/      ← All screens
│       │   ├── services/     ← API & bridge
│       │   ├── state/        ← Riverpod providers
│       │   ├── theme/        ← Dark theme
│       │   ├── widgets/      ← Reusable widgets
│       │   └── utils/        ← Helpers
│       ├── windows/
│       └── pubspec.yaml
│
├── services/
│   ├── Cargo.toml            ← Rust workspace
│   ├── raw_engine/           ← RAW decoding (LibRaw)
│   ├── render_engine/        ← Edit graph, layers, GPU
│   ├── catalog_engine/       ← SQLite operations
│   ├── mask_engine/          ← SAM2 integration
│   ├── retouch_engine/       ← Portrait retouching
│   └── export_engine/        ← JPEG/PNG/TIFF/WebP export
│
├── shared/
│   ├── database/
│   │   └── migrations/       ← SQLite migrations
│   ├── models/               ← Shared data contracts
│   └── utils/                ← Shared utilities
│
├── tests/
├── docs/
└── PHOTO_ACCESS_EDITOR_MASTER_SPEC.md
```

## Workspaces

| Workspace | Shortcut | Purpose |
|-----------|----------|---------|
| Library | G | Browse and organize photos |
| Cull | C | AI-assisted image selection |
| Develop | D | RAW editing with sliders |
| Retouch | R | Portrait enhancement tools |
| Export | E | Export to JPEG/PNG/TIFF/WebP |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | Flutter Desktop |
| State | Riverpod |
| Navigation | GoRouter |
| Services | Rust (via flutter_rust_bridge) |
| Database | SQLite (via rusqlite) |
| AI | ONNX Runtime (planned) |
| RAW | LibRaw (planned) |

## Current Status

Phase 1 (Foundation) — in progress:

- [x] Project structure
- [x] Rust workspace (6 crates)
- [x] SQLite schema (35+ tables)
- [x] Catalog engine (CRUD)
- [x] RAW engine (decoder, thumbnails, metadata)
- [x] Render engine (edit graph, adjustments, compositor, preview)
- [x] Export engine (profiles, batch export)
- [x] Mask engine (mask data, operations)
- [x] Retouch engine (settings, operations)
- [x] Flutter app (main, theme, routing)
- [x] Library screen (grid, metadata, filmstrip)
- [x] Cull screen (filters, AI scores, comparison)
- [x] Develop screen (viewer, sliders, presets, history)
- [x] Retouch screen (categories, controls)
- [x] Export screen (settings, profiles, queue)
- [x] Settings screen (toggles, account)
- [ ] Flutter ↔ Rust bridge integration
- [ ] File picker for import
- [ ] Actual thumbnail generation from files
- [ ] GPU rendering pipeline

## Next Steps

1. Install Flutter + Rust toolchains
2. Run `flutter pub get` in `apps/desktop/`
3. Run `cargo build` in `services/`
4. Test the UI with `flutter run -d windows`
5. Integrate flutter_rust_bridge for Rust ↔ Flutter communication
