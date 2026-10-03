// Type declarations for deep per-icon imports (lucide-react-native tree-shaking codemod).
// The package ships icons as untyped JS files under dist/esm/icons/.
declare module 'lucide-react-native/dist/esm/icons/*' {
  import { ComponentType } from 'react';
  import type { ColorValue, StyleProp, TextStyle, ViewStyle } from 'react-native';

  export interface LucideProps {
    size?: number | string;
    color?: ColorValue;
    strokeWidth?: number | string;
    fill?: string;
    strokeLinecap?: 'butt' | 'round' | 'square' | 'inherit';
    strokeLinejoin?: 'miter' | 'round' | 'bevel' | 'inherit';
    absoluteStrokeWidth?: boolean;
    style?: StyleProp<TextStyle & ViewStyle>;
  }

  const Icon: ComponentType<LucideProps>;
  export default Icon;
}
