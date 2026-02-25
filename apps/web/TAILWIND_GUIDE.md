# Guide Tailwind CSS - Qubeless Frontend

## Introduction

Le frontend Qubeless utilise maintenant **Tailwind CSS v3** pour un système de design unifié avec support du thème clair/sombre.

## Architecture

### Configuration

- **tailwind.config.js** : Configuration principale avec les couleurs personnalisées basées sur les CSS variables
- **postcss.config.js** : Configuration PostCSS pour le traitement Tailwind
- **src/assets/main.css** : Fichier principal avec les directives Tailwind et les composants globaux
- **src/styles/themes.css** : Variables CSS pour les thèmes clair/sombre

### Thème Clair/Sombre

Le thème est géré via l'attribut `data-theme` sur l'élément HTML :
- Mode clair : pas d'attribut ou `data-theme="light"`
- Mode sombre : `data-theme="dark"`

Le composant `ThemeToggle.vue` permet de basculer entre les thèmes.

## Utilisation dans les Composants

### Classes Tailwind Disponibles

#### Couleurs de fond
```vue
<div class="bg-bg-primary">Fond principal</div>
<div class="bg-bg-secondary">Fond secondaire</div>
<div class="bg-bg-tertiary">Fond tertiaire</div>
```

#### Couleurs de texte
```vue
<p class="text-text-primary">Texte principal</p>
<p class="text-text-secondary">Texte secondaire</p>
<p class="text-text-tertiary">Texte tertiaire</p>
<p class="text-text-muted">Texte atténué</p>
```

#### Bordures
```vue
<div class="border border-border-primary">Bordure normale</div>
<div class="border-2 border-border-secondary">Bordure épaisse</div>
<div class="hover:border-border-hover">Bordure au survol</div>
```

#### Couleurs primaires/accent
```vue
<button class="bg-primary text-white">Bouton primaire</button>
<button class="bg-accent hover:bg-accent-hover">Bouton accent</button>
```

### Composants Réutilisables

#### Cartes
```vue
<div class="card">
  <h3>Titre de la carte</h3>
  <p>Contenu de la carte</p>
</div>
```

#### Boutons
```vue
<!-- Bouton principal (style par défaut) -->
<button>Action principale</button>

<!-- Bouton ghost -->
<button class="ghost-button">Action secondaire</button>

<!-- Bouton ghost compact -->
<button class="ghost-button compact">Petit bouton</button>
```

#### Inputs et formulaires
```vue
<div class="form-group">
  <label>Libellé</label>
  <input type="text" placeholder="Saisir du texte" />
</div>

<div class="form-group">
  <label>Sélection</label>
  <select>
    <option>Option 1</option>
    <option>Option 2</option>
  </select>
</div>
```

### Badges

#### StatusBadge
```vue
<StatusBadge status="SUCCESS" />
<StatusBadge status="RUNNING" />
<StatusBadge status="FAILED" />
<StatusBadge status="PENDING" />
```

#### SeverityBadge
```vue
<SeverityBadge severity="BLOCKER" />
<SeverityBadge severity="CRITICAL" />
<SeverityBadge severity="MAJOR" />
<SeverityBadge severity="MINOR" />
<SeverityBadge severity="INFO" />
```

#### IssueStatusBadge
```vue
<IssueStatusBadge status="OPEN" />
<IssueStatusBadge status="FALSE_POSITIVE" />
<IssueStatusBadge status="ACCEPTED_RISK" />
<IssueStatusBadge status="RESOLVED" />
```

## Couleurs de Badges Disponibles

Toutes les couleurs de badges sont accessibles via les classes Tailwind :

```vue
<!-- Exemples -->
<span class="text-badge-success-text bg-gradient-to-br from-badge-success-bg-start to-badge-success-bg-end border border-badge-success-border">
  Succès personnalisé
</span>
```

## Styles Personnalisés

### Utiliser @apply dans les composants

```vue
<style scoped>
.mon-composant {
  @apply flex items-center gap-4 p-4;
  @apply bg-card-bg-start border border-card-border rounded-card;
  @apply transition-all duration-200;
}

.mon-composant:hover {
  @apply border-card-border-hover shadow-card-hover;
}
</style>
```

### Classes utilitaires courantes

```vue
<!-- Layout -->
<div class="flex flex-col gap-4">...</div>
<div class="grid grid-cols-2 gap-6">...</div>

<!-- Espacement -->
<div class="p-4">Padding 1rem</div>
<div class="px-6 py-3">Padding horizontal/vertical</div>
<div class="m-4">Marge 1rem</div>

<!-- Tailles -->
<div class="w-full">Largeur 100%</div>
<div class="h-screen">Hauteur viewport</div>
<div class="max-w-md">Largeur max medium</div>

<!-- Typographie -->
<p class="text-sm font-semibold">Petit texte semi-gras</p>
<p class="text-lg font-bold">Grand texte gras</p>
<p class="uppercase tracking-wide">Texte majuscules</p>

<!-- Bordures et arrondis -->
<div class="rounded-lg">Arrondi large</div>
<div class="rounded-btn">Arrondi bouton (10px)</div>
<div class="rounded-card">Arrondi carte (14px)</div>
<div class="rounded-full">Arrondi complet</div>

<!-- Ombres -->
<div class="shadow-card">Ombre carte</div>
<div class="shadow-btn">Ombre bouton</div>

<!-- Transitions -->
<div class="transition-all duration-200">Transition rapide</div>
<div class="transition-colors duration-theme">Transition thème (300ms)</div>
```

## Responsive Design

Tailwind utilise des préfixes pour les breakpoints :
- `sm:` - min-width: 640px
- `md:` - min-width: 768px
- `lg:` - min-width: 1024px
- `xl:` - min-width: 1280px

```vue
<div class="flex flex-col md:flex-row gap-4">
  <!-- Colonne sur mobile, ligne sur desktop -->
</div>

<p class="text-sm md:text-base lg:text-lg">
  <!-- Taille de texte adaptative -->
</p>
```

## Bonnes Pratiques

### 1. Préférer les classes Tailwind aux styles inline
❌ Mauvais :
```vue
<div style="background-color: var(--bg-primary); padding: 16px;">
```

✅ Bon :
```vue
<div class="bg-bg-primary p-4">
```

### 2. Utiliser les composants globaux pour la cohérence
❌ Mauvais :
```vue
<div class="bg-white border-2 border-gray-200 rounded-xl p-5 shadow-lg">
```

✅ Bon :
```vue
<div class="card">
```

### 3. Grouper les classes par catégorie
```vue
<!-- Layout, puis couleurs, puis typographie, puis effets -->
<div class="flex items-center gap-4 bg-bg-primary text-text-primary font-semibold transition-all">
```

### 4. Utiliser @apply pour les patterns répétés
Si vous utilisez les mêmes classes plusieurs fois dans un composant, créez une classe personnalisée avec `@apply`.

### 5. Respecter le thème
Toujours utiliser les couleurs du thème (`bg-bg-primary`, `text-text-primary`, etc.) plutôt que des couleurs fixes (`bg-white`, `text-black`) pour assurer le support du mode sombre.

## Migration de Composants Existants

Pour migrer un composant existant vers Tailwind :

1. Identifier les styles utilisés
2. Remplacer les propriétés CSS par les classes Tailwind équivalentes
3. Utiliser `@apply` dans `<style scoped>` si nécessaire
4. Vérifier que les couleurs utilisent les variables du thème
5. Tester en mode clair et sombre

Exemple :
```vue
<!-- Avant -->
<style scoped>
.ma-card {
  background: white;
  padding: 20px;
  border-radius: 14px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
</style>

<!-- Après -->
<div class="card">
  <!-- ou -->
</div>

<style scoped>
.ma-card {
  @apply bg-bg-secondary p-5 rounded-card shadow-card;
}
</style>
```

## Ressources

- [Documentation Tailwind CSS](https://tailwindcss.com/docs)
- [Configuration Tailwind du projet](./tailwind.config.js)
- [Variables CSS du thème](./src/styles/themes.css)
- [Styles globaux](./src/assets/main.css)

## Support

Pour toute question sur l'utilisation de Tailwind dans le projet, consultez :
- Les composants existants dans `src/components/`
- Le fichier `main.css` pour les composants globaux
- La configuration Tailwind pour les couleurs disponibles
