/** @type {import('tailwindcss').Config} */
export default {
  // 关键：扫描共享内核源码（@h5design/editor / @h5design/render 以 workspace:* 软链到 packages/*），
  // 否则内核里的 Tailwind 原子类不会被生成，编辑器 UI 会完全无样式（图标巨大/布局错乱/弹窗透明）。
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // 扫描共享内核源码：确保编辑器/渲染器的 Tailwind 原子类被 web 端 Tailwind JIT 编译生成。
    // （admin 端改用内核自带的 dist/editor.css，web 端保留自身编译以避免双 @tailwind utilities 冲突）
    '../../packages/editor/src/**/*.{ts,tsx}',
    '../../packages/render/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF1F4',
          100: '#FFE0E7',
          200: '#FFC5D3',
          300: '#FF9DB2',
          400: '#FF7093',
          500: '#FF4D6D',
          600: '#F22E56',
          700: '#D24830',
          800: '#A81637',
          900: '#8A1230',
          DEFAULT: '#FF4D6D',
          dark: '#D24830',
        },
      },
      // 等宽数字字体（对齐运营端 theme.ts T.fontNum：Bahnschrift / DIN Alternate）
      fontFamily: {
        mono: ["'Bahnschrift'", "'DIN Alternate'", 'Arial', 'system-ui', 'sans-serif'],
      },
    },
  },
  // 多语种 RTL 支持：保留 dir 前缀类名
  plugins: [],
};
