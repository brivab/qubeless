# Système de Thème - Qubeless

## Vue d'ensemble

L'application Qubeless utilise un système de thème complet avec support du mode clair et sombre, implémenté avec Tailwind CSS et des variables CSS.

## Architecture du Thème

### 1. Variables CSS ([src/styles/themes.css](./src/styles/themes.css))

Le fichier `themes.css` définit toutes les couleurs via des variables CSS :
- Thème clair : Variables dans `:root`
- Thème sombre : Variables dans `[data-theme='dark']`

### 2. Configuration Tailwind ([tailwind.config.js](./tailwind.config.js))

La configuration Tailwind référence les variables CSS, permettant d'utiliser les couleurs via des classes :
```javascript
colors: {
  'bg-primary': 'var(--bg-primary)',
  'text-primary': 'var(--text-primary)',
  // ... etc
}
```

### 3. Store de Thème ([src/stores/theme.ts](./src/stores/theme.ts))

Gère l'état du thème :
- Lecture/écriture dans localStorage
- Application de l'attribut `data-theme` sur `<html>`
- Export de la fonction `toggleTheme()`

## Utilisation

### Basculer entre les thèmes

Via le composant `ThemeToggle.vue` dans la sidebar ou programmatiquement :

```typescript
import { useThemeStore } from '@/stores/theme';

const themeStore = useThemeStore();
themeStore.toggleTheme(); // Bascule light ↔ dark
```

### Utiliser les couleurs du thème

#### Dans les templates avec Tailwind
```vue
<template>
  <div class="bg-bg-primary text-text-primary border border-border-primary">
    <h1 class="text-text-secondary">Titre</h1>
  </div>
</template>
```

#### Dans les styles avec @apply
```vue
<style scoped>
.mon-composant {
  @apply bg-bg-secondary text-text-primary;
  @apply border border-border-primary rounded-lg;
}
</style>
```

#### Directement avec les variables CSS
```vue
<style scoped>
.special-gradient {
  background: linear-gradient(
    135deg,
    var(--card-bg-start) 0%,
    var(--card-bg-end) 100%
  );
}
</style>
```

## Palette de Couleurs

### Couleurs de base

| Type | Classe Tailwind | Variable CSS |
|------|----------------|--------------|
| Background principal | `bg-bg-primary` | `--bg-primary` |
| Background secondaire | `bg-bg-secondary` | `--bg-secondary` |
| Background tertiaire | `bg-bg-tertiary` | `--bg-tertiary` |
| Texte principal | `text-text-primary` | `--text-primary` |
| Texte secondaire | `text-text-secondary` | `--text-secondary` |
| Texte atténué | `text-text-muted` | `--text-muted` |
| Bordure principale | `border-border-primary` | `--border-primary` |
| Bordure secondaire | `border-border-secondary` | `--border-secondary` |

### Couleurs sémantiques

| Type | Classe Tailwind | Variable CSS |
|------|----------------|--------------|
| Primaire | `bg-primary` / `text-primary` | `--primary` |
| Accent | `bg-accent` / `text-accent` | `--accent` |
| Succès | `bg-success` / `text-success` | `--success-bg` |
| Avertissement | `bg-warning` / `text-warning` | `--warning-bg` |
| Erreur | `bg-error` / `text-error` | `--error-bg` |
| Info | `bg-info` / `text-info` | `--info-bg` |

### Couleurs de composants

#### Sidebar
- `sidebar-bg-start`, `sidebar-bg-end` - Dégradé de fond
- `sidebar-text` - Texte
- `sidebar-nav-hover` - Fond au survol

#### Cartes
- `card-bg-start`, `card-bg-end` - Dégradé de fond
- `card-border` - Bordure
- `card-border-hover` - Bordure au survol

#### Inputs
- `input-bg` - Fond
- `input-border` - Bordure
- `input-border-focus` - Bordure focus

#### Boutons
- `btn-bg-start`, `btn-bg-end` - Dégradé principal
- `ghost-bg-start`, `ghost-bg-end` - Dégradé ghost

## Badges et États

### Status Badges
- SUCCESS : Vert
- RUNNING : Jaune
- FAILED : Rouge
- PENDING : Bleu

### Severity Badges
- BLOCKER : Rouge foncé
- CRITICAL : Orange
- MAJOR : Bleu
- MINOR : Vert
- INFO : Gris

Toutes les couleurs sont disponibles via `badge-{type}-{property}` :
```vue
<span class="text-badge-success-text bg-gradient-to-br from-badge-success-bg-start to-badge-success-bg-end">
  Succès
</span>
```

## Transitions

Le thème utilise des transitions pour un changement fluide :
```css
transition-colors duration-theme  /* 300ms */
```

Appliqué automatiquement sur :
- body
- Textes
- Backgrounds
- Bordures

## Bonnes Pratiques

### ✅ À FAIRE
- Toujours utiliser les couleurs du thème
- Tester en mode clair ET sombre
- Utiliser les classes Tailwind quand possible
- Ajouter `transition-colors duration-theme` sur les éléments qui changent

### ❌ À ÉVITER
- Couleurs fixes (`bg-white`, `text-black`)
- Valeurs hex/rgb directes
- Oublier de tester le mode sombre

## Exemples

### Carte avec thème
```vue
<template>
  <div class="card">
    <h3 class="text-text-primary">Titre</h3>
    <p class="text-text-secondary">Description</p>
    <button>Action</button>
  </div>
</template>
```

### Composant personnalisé
```vue
<template>
  <div class="custom-panel">
    <h2>Mon panneau</h2>
    <p>Contenu du panneau</p>
  </div>
</template>

<style scoped>
.custom-panel {
  @apply bg-bg-secondary border-2 border-border-primary rounded-lg p-6;
  @apply transition-all duration-200;
}

.custom-panel:hover {
  @apply border-border-hover shadow-lg;
}

.custom-panel h2 {
  @apply text-xl font-bold text-text-primary mb-3;
}

.custom-panel p {
  @apply text-text-secondary;
}
</style>
```

### Dégradé personnalisé
```vue
<style scoped>
.hero-banner {
  background: linear-gradient(
    135deg,
    var(--primary) 0%,
    var(--accent) 100%
  );
  @apply text-white p-8 rounded-card;
}
</style>
```

## Ajouter de Nouvelles Couleurs

1. **Ajouter dans themes.css**
   ```css
   :root {
     --ma-nouvelle-couleur: #value-light;
   }

   [data-theme='dark'] {
     --ma-nouvelle-couleur: #value-dark;
   }
   ```

2. **Ajouter dans tailwind.config.js**
   ```javascript
   colors: {
     'ma-couleur': 'var(--ma-nouvelle-couleur)'
   }
   ```

3. **Utiliser dans les composants**
   ```vue
   <div class="bg-ma-couleur">...</div>
   ```

## Dépannage

### Les couleurs ne changent pas en mode sombre
- Vérifier que `data-theme="dark"` est bien sur `<html>`
- Vérifier que les variables CSS sont définies dans `[data-theme='dark']`
- Vérifier que vous utilisez les classes du thème et non des couleurs fixes

### Couleurs manquantes
- Vérifier `tailwind.config.js`
- Rebuild avec `pnpm run build`
- Vérifier la console pour les erreurs PostCSS

### Transitions saccadées
- Utiliser `transition-colors` plutôt que `transition-all` si seules les couleurs changent
- Ajuster `duration-theme` (300ms par défaut)

## Ressources

- [Variables CSS complètes](./src/styles/themes.css)
- [Configuration Tailwind](./tailwind.config.js)
- [Guide Tailwind](./TAILWIND_GUIDE.md)
- [Store de thème](./src/stores/theme.ts)
- [Composant ThemeToggle](./src/components/ThemeToggle.vue)
