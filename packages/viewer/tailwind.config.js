/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,js,html}'],
  theme: {
    extend: {
      colors: {
        // VS Code Dark Theme Colors
        'vs-bg': '#1e1e1e',
        'vs-bg-secondary': '#2d2d30',
        'vs-text': '#d4d4d4',
        'vs-muted': '#8c8c8c',
        'vs-accent': '#569cd6',
        'vs-user': '#6a9955',
        'vs-assistant': '#ce9178',
        'vs-function': '#dcdcaa',
        'vs-type': '#4ec9b0',
        'vs-error': '#f44747',
        'vs-warning': '#ffcc02',
        'vs-success': '#4ec9b0',
        'vs-border': '#3e3e42',
        'vs-hover': '#2a2d2e',
        'vs-selection': '#264f78'
      },
      fontFamily: {
        'mono': ['Consolas', 'Monaco', 'Courier New', 'monospace']
      },
      maxWidth: {
        'reading': '60em'
      }
    }
  },
  plugins: []
}