/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{ts,js,html}',
    './src/**/*.lit.ts',
    './dist/**/*.{js,html}'
  ],
  theme: {
    extend: {
      colors: {
        // VS Code Background Colors
        'vs-bg': 'var(--vs-bg)',
        'vs-bg-secondary': 'var(--vs-bg-secondary)',
        'vs-bg-tertiary': 'var(--vs-bg-tertiary)',
        'vs-bg-elevated': 'var(--vs-bg-elevated)',
        'vs-bg-input': 'var(--vs-bg-input)',
        'vs-bg-button': 'var(--vs-bg-button)',
        'vs-bg-button-hover': 'var(--vs-bg-button-hover)',
        
        // VS Code Text Colors
        'vs-text': 'var(--vs-text)',
        'vs-text-muted': 'var(--vs-text-muted)',
        'vs-text-subtle': 'var(--vs-text-subtle)',
        'vs-text-disabled': 'var(--vs-text-disabled)',
        'vs-text-inverse': 'var(--vs-text-inverse)',
        
        // VS Code Accent Colors
        'vs-accent': 'var(--vs-accent)',
        'vs-accent-hover': 'var(--vs-accent-hover)',
        'vs-accent-active': 'var(--vs-accent-active)',
        'vs-accent-muted': 'var(--vs-accent-muted)',
        
        // VS Code Semantic Colors
        'vs-user': 'var(--vs-user)',
        'vs-assistant': 'var(--vs-assistant)',
        'vs-function': 'var(--vs-function)',
        'vs-type': 'var(--vs-type)',
        'vs-keyword': 'var(--vs-keyword)',
        'vs-string': 'var(--vs-string)',
        'vs-comment': 'var(--vs-comment)',
        'vs-number': 'var(--vs-number)',
        'vs-operator': 'var(--vs-operator)',
        
        // VS Code Status Colors
        'vs-error': 'var(--vs-error)',
        'vs-error-bg': 'var(--vs-error-bg)',
        'vs-warning': 'var(--vs-warning)',
        'vs-warning-bg': 'var(--vs-warning-bg)',
        'vs-success': 'var(--vs-success)',
        'vs-success-bg': 'var(--vs-success-bg)',
        'vs-info': 'var(--vs-info)',
        'vs-info-bg': 'var(--vs-info-bg)',
        
        // VS Code Border Colors
        'vs-border': 'var(--vs-border)',
        'vs-border-light': 'var(--vs-border-light)',
        'vs-border-focus': 'var(--vs-border-focus)',
        'vs-border-error': 'var(--vs-border-error)',
        'vs-border-warning': 'var(--vs-border-warning)',
        'vs-border-success': 'var(--vs-border-success)',
        
        // VS Code Interactive States
        'vs-hover': 'var(--vs-hover)',
        'vs-active': 'var(--vs-active)',
        'vs-selection': 'var(--vs-selection)',
        'vs-selection-inactive': 'var(--vs-selection-inactive)',
        
        // VS Code Diff Colors
        'vs-diff-added': 'var(--vs-diff-added)',
        'vs-diff-added-border': 'var(--vs-diff-added-border)',
        'vs-diff-removed': 'var(--vs-diff-removed)',
        'vs-diff-removed-border': 'var(--vs-diff-removed-border)',
        'vs-diff-modified': 'var(--vs-diff-modified)',
        'vs-diff-modified-border': 'var(--vs-diff-modified-border)',
      },
      
      fontFamily: {
        'mono': 'var(--font-mono)',
        'sans': 'var(--font-sans)',
      },
      
      fontSize: {
        'xs': 'var(--text-xs)',
        'sm': 'var(--text-sm)',
        'base': 'var(--text-base)',
        'lg': 'var(--text-lg)',
        'xl': 'var(--text-xl)',
        '2xl': 'var(--text-2xl)',
        '3xl': 'var(--text-3xl)',
      },
      
      spacing: {
        'xs': 'var(--size-xs)',
        'sm': 'var(--size-sm)',
        'md': 'var(--size-md)',
        'lg': 'var(--size-lg)',
        'xl': 'var(--size-xl)',
        '2xl': 'var(--size-2xl)',
        '3xl': 'var(--size-3xl)',
      },
      
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
      },
      
      lineHeight: {
        'tight': 'var(--leading-tight)',
        'normal': 'var(--leading-normal)',
        'relaxed': 'var(--leading-relaxed)',
      },
      
      fontWeight: {
        'light': 'var(--font-light)',
        'normal': 'var(--font-normal)',
        'medium': 'var(--font-medium)',
        'semibold': 'var(--font-semibold)',
        'bold': 'var(--font-bold)',
      },
      
      transitionDuration: {
        'fast': '150ms',
        'normal': '250ms',
        'slow': '350ms',
      },
      
      transitionTimingFunction: {
        'vs': 'ease',
      },
      
      zIndex: {
        'dropdown': 'var(--z-dropdown)',
        'sticky': 'var(--z-sticky)',
        'fixed': 'var(--z-fixed)',
        'modal-backdrop': 'var(--z-modal-backdrop)',
        'modal': 'var(--z-modal)',
        'popover': 'var(--z-popover)',
        'tooltip': 'var(--z-tooltip)',
        'toast': 'var(--z-toast)',
      },
      
      boxShadow: {
        'vs': '0 4px 6px -1px var(--vs-shadow)',
        'vs-strong': '0 20px 25px -5px var(--vs-shadow-strong)',
        'vs-focus': '0 0 0 2px var(--vs-border-focus)',
      },
      
      backdropBlur: {
        'vs': '8px',
      },
      
      maxWidth: {
        'reading': '60em',
      },
      
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'bounce-subtle': 'bounce 1s ease-in-out 3',
        'fade-in': 'fadeIn 150ms ease-out',
        'fade-out': 'fadeOut 150ms ease-in',
        'slide-up': 'slideUp 250ms ease-out',
        'slide-down': 'slideDown 250ms ease-out',
        'scale-in': 'scaleIn 250ms ease-out',
        'scale-out': 'scaleOut 150ms ease-in',
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scaleOut: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.95)', opacity: '0' },
        },
      },
    },
  },
  plugins: [
    // Custom plugin for VS Code specific utilities
    function({ addUtilities, addComponents, theme }) {
      addUtilities({
        '.transition-vs': {
          transition: 'all var(--transition-normal)',
        },
        '.transition-vs-fast': {
          transition: 'all var(--transition-fast)',
        },
        '.transition-vs-slow': {
          transition: 'all var(--transition-slow)',
        },
        '.text-reading-width': {
          maxWidth: '60em',
        },
        '.scrollbar-vs': {
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--vs-scrollbar-thumb) var(--vs-scrollbar-bg)',
          '&::-webkit-scrollbar': {
            width: '12px',
            height: '12px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'var(--vs-scrollbar-bg)',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'var(--vs-scrollbar-thumb)',
            borderRadius: '6px',
            border: '2px solid var(--vs-bg)',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'var(--vs-scrollbar-thumb-hover)',
          },
        },
      });
      
      addComponents({
        '.btn-vs': {
          padding: `${theme('spacing.sm')} ${theme('spacing.md')}`,
          backgroundColor: 'var(--vs-bg-button)',
          color: 'var(--vs-text-inverse)',
          border: '1px solid var(--vs-border)',
          borderRadius: theme('borderRadius.md'),
          fontFamily: theme('fontFamily.mono'),
          fontSize: theme('fontSize.sm'),
          fontWeight: theme('fontWeight.medium'),
          cursor: 'pointer',
          transition: 'var(--transition-fast)',
          '&:hover': {
            backgroundColor: 'var(--vs-bg-button-hover)',
          },
          '&:focus': {
            outline: 'none',
            boxShadow: '0 0 0 2px var(--vs-border-focus)',
          },
          '&:disabled': {
            opacity: '0.6',
            cursor: 'not-allowed',
          },
        },
        '.btn-vs-secondary': {
          backgroundColor: 'var(--vs-bg-elevated)',
          color: 'var(--vs-text)',
          '&:hover': {
            backgroundColor: 'var(--vs-hover)',
          },
        },
        '.input-vs': {
          padding: `${theme('spacing.sm')} ${theme('spacing.md')}`,
          backgroundColor: 'var(--vs-bg-input)',
          color: 'var(--vs-text)',
          border: '1px solid var(--vs-border)',
          borderRadius: theme('borderRadius.md'),
          fontFamily: theme('fontFamily.mono'),
          fontSize: theme('fontSize.sm'),
          transition: 'var(--transition-fast)',
          '&:focus': {
            outline: 'none',
            borderColor: 'var(--vs-border-focus)',
            boxShadow: '0 0 0 1px var(--vs-border-focus)',
          },
          '&::placeholder': {
            color: 'var(--vs-text-subtle)',
          },
        },
        '.card-vs': {
          backgroundColor: 'var(--vs-bg-secondary)',
          border: '1px solid var(--vs-border)',
          borderRadius: theme('borderRadius.lg'),
          padding: theme('spacing.lg'),
          boxShadow: theme('boxShadow.vs'),
        },
        '.code-vs': {
          backgroundColor: 'var(--vs-code-bg)',
          color: 'var(--vs-text)',
          fontFamily: theme('fontFamily.mono'),
          fontSize: theme('fontSize.sm'),
          lineHeight: theme('lineHeight.relaxed'),
          padding: theme('spacing.md'),
          borderRadius: theme('borderRadius.md'),
          border: '1px solid var(--vs-border)',
          overflow: 'auto',
        },
      });
    },
  ],
}