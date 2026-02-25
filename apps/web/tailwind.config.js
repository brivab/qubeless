/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Background colors
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-tertiary': 'var(--bg-tertiary)',

        // Text colors
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'text-muted': 'var(--text-muted)',

        // Border colors
        'border-primary': 'var(--border-primary)',
        'border-secondary': 'var(--border-secondary)',
        'border-hover': 'var(--border-hover)',

        // Sidebar
        sidebar: {
          'bg-start': 'var(--sidebar-bg-start)',
          'bg-end': 'var(--sidebar-bg-end)',
          text: 'var(--sidebar-text)',
          'text-secondary': 'var(--sidebar-text-secondary)',
          'nav-hover': 'var(--sidebar-nav-hover)',
          'nav-border': 'var(--sidebar-nav-border)',
          'nav-bg': 'var(--sidebar-nav-bg)'
        },

        // Primary/Accent colors
        primary: {
          DEFAULT: 'var(--primary)',
          dark: 'var(--primary-dark)',
          light: 'var(--primary-light)'
        },
        accent: {
          DEFAULT: 'var(--accent)',
          primary: 'var(--accent-primary)',
          secondary: 'var(--accent-secondary)',
          hover: 'var(--accent-hover)'
        },

        // Card colors
        card: {
          'bg-start': 'var(--card-bg-start)',
          'bg-end': 'var(--card-bg-end)',
          border: 'var(--card-border)',
          'border-hover': 'var(--card-border-hover)'
        },

        // Input colors
        input: {
          bg: 'var(--input-bg)',
          border: 'var(--input-border)',
          'border-hover': 'var(--input-border-hover)',
          'border-focus': 'var(--input-border-focus)'
        },

        // Button colors
        btn: {
          'bg-start': 'var(--btn-bg-start)',
          'bg-end': 'var(--btn-bg-end)'
        },

        // Ghost button
        ghost: {
          'bg-start': 'var(--ghost-btn-bg-start)',
          'bg-end': 'var(--ghost-btn-bg-end)',
          text: 'var(--ghost-btn-text)',
          border: 'var(--ghost-btn-border)',
          'bg-hover-start': 'var(--ghost-btn-bg-hover-start)',
          'bg-hover-end': 'var(--ghost-btn-bg-hover-end)',
          'border-hover': 'var(--ghost-btn-border-hover)'
        },

        // Badge colors
        badge: {
          // Status
          'success-bg-start': 'var(--badge-success-bg-start)',
          'success-bg-end': 'var(--badge-success-bg-end)',
          'success-text': 'var(--badge-success-text)',
          'success-border': 'var(--badge-success-border)',
          'running-bg-start': 'var(--badge-running-bg-start)',
          'running-bg-end': 'var(--badge-running-bg-end)',
          'running-text': 'var(--badge-running-text)',
          'running-border': 'var(--badge-running-border)',
          'failed-bg-start': 'var(--badge-failed-bg-start)',
          'failed-bg-end': 'var(--badge-failed-bg-end)',
          'failed-text': 'var(--badge-failed-text)',
          'failed-border': 'var(--badge-failed-border)',
          'pending-bg-start': 'var(--badge-pending-bg-start)',
          'pending-bg-end': 'var(--badge-pending-bg-end)',
          'pending-text': 'var(--badge-pending-text)',
          'pending-border': 'var(--badge-pending-border)',

          // Severity
          'blocker-bg-start': 'var(--badge-blocker-bg-start)',
          'blocker-bg-end': 'var(--badge-blocker-bg-end)',
          'blocker-text': 'var(--badge-blocker-text)',
          'blocker-border': 'var(--badge-blocker-border)',
          'critical-bg-start': 'var(--badge-critical-bg-start)',
          'critical-bg-end': 'var(--badge-critical-bg-end)',
          'critical-text': 'var(--badge-critical-text)',
          'critical-border': 'var(--badge-critical-border)',
          'major-bg-start': 'var(--badge-major-bg-start)',
          'major-bg-end': 'var(--badge-major-bg-end)',
          'major-text': 'var(--badge-major-text)',
          'major-border': 'var(--badge-major-border)',
          'minor-bg-start': 'var(--badge-minor-bg-start)',
          'minor-bg-end': 'var(--badge-minor-bg-end)',
          'minor-text': 'var(--badge-minor-text)',
          'minor-border': 'var(--badge-minor-border)',
          'info-bg-start': 'var(--badge-info-bg-start)',
          'info-bg-end': 'var(--badge-info-bg-end)',
          'info-text': 'var(--badge-info-text)',
          'info-border': 'var(--badge-info-border)',

          // Issue Status
          'open-bg-start': 'var(--badge-open-bg-start)',
          'open-bg-end': 'var(--badge-open-bg-end)',
          'open-text': 'var(--badge-open-text)',
          'open-border': 'var(--badge-open-border)',
          'resolved-bg-start': 'var(--badge-resolved-bg-start)',
          'resolved-bg-end': 'var(--badge-resolved-bg-end)',
          'resolved-text': 'var(--badge-resolved-text)',
          'resolved-border': 'var(--badge-resolved-border)'
        },

        // State colors
        success: {
          DEFAULT: 'var(--success-text)',
          bg: 'var(--success-bg)',
          'bg-light': 'var(--success-bg-light)',
          'bg-dark': 'var(--success-bg-dark)',
          'bg-darker': 'var(--success-bg-darker)',
          text: 'var(--success-text)',
          'text-dark': 'var(--success-text-dark)',
          'text-light': 'var(--success-text-light)',
          border: 'var(--success-border)'
        },
        warning: {
          DEFAULT: 'var(--warning-text)',
          bg: 'var(--warning-bg)',
          'bg-light': 'var(--warning-bg-light)',
          text: 'var(--warning-text)',
          'text-dark': 'var(--warning-text-dark)',
          border: 'var(--warning-border)'
        },
        error: {
          DEFAULT: 'var(--error-text)',
          bg: 'var(--error-bg)',
          text: 'var(--error-text)',
          'text-dark': 'var(--error-text-dark)',
          border: 'var(--error-border)'
        },
        info: {
          DEFAULT: 'var(--info-text)',
          bg: 'var(--info-bg)',
          'bg-start': 'var(--info-bg-start)',
          'bg-end': 'var(--info-bg-end)',
          text: 'var(--info-text)',
          border: 'var(--info-border)'
        },
        danger: {
          DEFAULT: 'var(--danger-text)',
          bg: 'var(--danger-bg)',
          text: 'var(--danger-text)',
          'text-dark': 'var(--danger-text-dark)',
          border: 'var(--danger-border)'
        },

        // Other UI elements
        modal: {
          overlay: 'var(--modal-overlay)',
          bg: 'var(--modal-bg)',
          border: 'var(--modal-border)'
        },
        tab: {
          text: 'var(--tab-text)',
          'text-active': 'var(--tab-text-active)',
          'text-hover': 'var(--tab-text-hover)',
          'border-active': 'var(--tab-border-active)',
          'bg-hover': 'var(--tab-bg-hover)',
          border: 'var(--tab-border)',
          'hover-bg-start': 'var(--tab-hover-bg-start)',
          'hover-bg-end': 'var(--tab-hover-bg-end)'
        },
        disabled: {
          bg: 'var(--disabled-bg)',
          text: 'var(--disabled-text)',
          border: 'var(--disabled-border)'
        },
        code: {
          bg: 'var(--code-bg)',
          text: 'var(--code-text)',
          border: 'var(--code-border)',
          'pill-bg': 'var(--code-pill-bg)'
        },
        log: {
          bg: 'var(--log-bg)',
          text: 'var(--log-text)',
          border: 'var(--log-border)'
        }
      },
      fontFamily: {
        sans: ['Space Grotesk', 'Helvetica Neue', 'sans-serif']
      },
      boxShadow: {
        card: '0 6px 30px var(--card-shadow)',
        'card-hover': '0 8px 35px var(--card-shadow-hover)',
        btn: '0 4px 12px var(--btn-shadow)',
        'btn-hover': '0 8px 20px var(--btn-shadow-hover)',
        'btn-active': '0 2px 8px var(--btn-shadow-active)',
        ghost: '0 2px 4px var(--ghost-btn-shadow)',
        'ghost-hover': '0 4px 8px var(--ghost-btn-shadow-hover)',
        'input-focus': '0 0 0 3px var(--input-shadow-focus)',
        'issue-card-hover': '0 0 0 0 var(--issue-card-shadow-hover)',
        modal: '0 0 0 0 var(--modal-shadow)',
        'badge-success': '0 0 0 0 var(--badge-success-shadow)',
        'badge-failed': '0 0 0 0 var(--badge-failed-shadow)',
        'badge-new': '0 0 0 0 var(--badge-new-shadow)',
        primary: '0 0 0 0 var(--primary-shadow)',
        'primary-hover': '0 0 0 0 var(--primary-shadow-hover)',
        'success-hover': '0 0 0 0 var(--success-shadow-hover)'
      },
      backgroundImage: {
        'gradient-sidebar': 'linear-gradient(180deg, var(--sidebar-bg-start) 0%, var(--sidebar-bg-end) 100%)',
        'gradient-card': 'linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%)',
        'gradient-btn': 'linear-gradient(135deg, var(--btn-bg-start) 0%, var(--btn-bg-end) 100%)',
        'gradient-ghost':
          'linear-gradient(135deg, var(--ghost-btn-bg-start) 0%, var(--ghost-btn-bg-end) 100%)',
        'gradient-ghost-hover':
          'linear-gradient(135deg, var(--ghost-btn-bg-hover-start) 0%, var(--ghost-btn-bg-hover-end) 100%)',
        'gradient-login':
          'radial-gradient(circle at 10% 20%, var(--login-gradient-1), transparent 25%), radial-gradient(circle at 90% 10%, var(--login-gradient-2), transparent 20%)',
        'gradient-tab-hover': 'linear-gradient(135deg, var(--tab-hover-bg-start) 0%, var(--tab-hover-bg-end) 100%)'
      },
      borderRadius: {
        card: '14px',
        btn: '10px'
      },
      spacing: {
        'sidebar-width': '260px'
      },
      transitionDuration: {
        theme: '300ms'
      }
    }
  },
  plugins: []
};
