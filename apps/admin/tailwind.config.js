/** @type {import('tailwindcss').Config} */
export default {
  // 关键：扫描共享内核源码（@h5design/editor / @h5design/render 以 workspace:* 软链到 packages/*），
  // 否则内核里的 Tailwind 原子类不会被生成，运营端画布会完全无样式。
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // 扫描共享内核源码：与 web 端采用同一机制（JIT 实时编译编辑器/渲染器的 Tailwind
    // 原子类），确保两端视觉像素级一致，且编辑器源码改动经 HMR 自动同步——不再依赖静态
    // 的 dist/editor.css 快照（旧机制会导致「web 已更新、admin 仍是旧产物」的脱节）。
    '../../packages/editor/src/**/*.{ts,tsx}',
    '../../packages/render/src/**/*.{ts,tsx}',
  ],
  // 关闭 preflight，避免 Tailwind 的 reset 覆盖 antd 的基础样式（按钮/表单/表格错位）。
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        // 全站朱砂主题色 #c24b2e
        brand: {
          50: '#FBEAE6',
          100: '#F3C9BF',
          200: '#E8A392',
          300: '#DB7C5E',
          400: '#CF5E3C',
          500: '#C24B2E',
          600: '#A83F26',
          700: '#8A3320',
          800: '#6E2A1B',
          900: '#561F15',
          DEFAULT: '#C24B2E',
          dark: '#8A3320',
        },
      },
    },
  },
  plugins: [],
};
