/** @type {import('tailwindcss').Config} */
export default {
  // 编辑器内核独立 Tailwind 构建：扫描自身 + render 包源码，产出仅供编辑器子树使用的工具类。
  // 这样 web / admin 都 import 同一份编译产物（dist/editor.css），两端视觉完全一致，
  // 不再受宿主各自 tailwind 配置（preflight 开关、品牌色、主题令牌）差异影响。
  content: [
    './src/**/*.{ts,tsx}',
    '../render/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // 内核独立品牌色：与 web 端保持一致（#FF4D6D），保证双端统一。
        brand: {
          50: '#FFF1F4',
          100: '#FFE0E7',
          200: '#FFC5D3',
          300: '#FF9DB2',
          400: '#FF7093',
          500: '#FF4D6D',
          600: '#F22E56',
          700: '#C81E42',
          800: '#A81637',
          900: '#8A1230',
          DEFAULT: '#FF4D6D',
          dark: '#C81E42',
        },
      },
    },
  },
  // 基础重置改为 scoped（见 src/styles/editor.css），避免污染宿主全局（尤其 admin 的 antd）。
  corePlugins: {
    preflight: false,
  },
  plugins: [],
};
