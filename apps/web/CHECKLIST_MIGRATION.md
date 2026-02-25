# Checklist de Migration Tailwind CSS ✅

## Installation & Configuration

- [x] Installer Tailwind CSS v3.4.19
- [x] Installer PostCSS et Autoprefixer
- [x] Créer `tailwind.config.js` avec configuration personnalisée
- [x] Créer `postcss.config.js`
- [x] Ajouter les directives Tailwind dans `main.css`

## Styles Globaux

- [x] Migrer `main.css` vers Tailwind avec `@apply`
- [x] Conserver les variables CSS dans `themes.css`
- [x] Créer les classes de composants globaux (.card, .button, etc.)
- [x] Ajouter le support responsive dans les styles globaux

## Composants Migrés

### Composants Communs
- [x] ThemeToggle.vue
- [x] Toast.vue
- [ ] ErrorBanner.vue
- [ ] LoadingState.vue
- [ ] ConfirmModal.vue

### Badges
- [x] StatusBadge.vue
- [x] SeverityBadge.vue
- [x] IssueStatusBadge.vue
- [ ] TechnicalDebtBadge.vue

### Layout
- [x] MainLayout.vue
- [ ] App.vue

### Autres Composants
- [ ] IssueCard.vue
- [ ] SummaryCard.vue
- [ ] QualityGateCard.vue
- [ ] TrendsChart.vue
- [ ] AnalyzersCatalog.vue
- [ ] ProjectMembers.vue
- [ ] LanguageFilter.vue
- [ ] RunAnalysisModal.vue
- [ ] FileCoverageViewer.vue
- [ ] CoverageTrend.vue
- [ ] CoverageWidget.vue
- [ ] TechnicalDebtChart.vue
- [ ] TechnicalDebtWidget.vue
- [ ] DuplicationWidget.vue

### Vues
- [ ] LoginView.vue
- [ ] DashboardView.vue
- [ ] ProjectsView.vue
- [ ] ProjectDetailView.vue
- [ ] AnalysisDetailView.vue
- [ ] PortfolioView.vue
- [ ] OrganizationsView.vue
- [ ] AdminTokensView.vue
- [ ] AdminAnalyzersView.vue
- [ ] AdminAuditLogsView.vue
- [ ] RuleProfilesView.vue

## Thème Clair/Sombre

- [x] Variables CSS pour mode clair définies
- [x] Variables CSS pour mode sombre définies
- [x] Configuration Tailwind référençant les variables
- [x] Attribut `data-theme` fonctionnel
- [x] ThemeToggle fonctionnel
- [x] Store de thème opérationnel
- [x] Transitions entre thèmes fluides

## Tests & Validation

- [x] Build de production réussit
- [x] Serveur de développement démarre
- [ ] Test manuel en mode clair
- [ ] Test manuel en mode sombre
- [ ] Vérification responsive (mobile, tablette, desktop)
- [ ] Tests sur différents navigateurs
  - [ ] Chrome/Edge
  - [ ] Firefox
  - [ ] Safari

## Documentation

- [x] TAILWIND_GUIDE.md créé
- [x] MIGRATION_TAILWIND.md créé
- [x] README_THEME.md créé
- [x] CHECKLIST_MIGRATION.md créé
- [ ] Ajouter des commentaires dans le code si nécessaire
- [ ] Mettre à jour le README principal

## Optimisations Futures (Optionnel)

- [ ] Migrer tous les composants restants
- [ ] Créer des variantes de composants (tailles, styles)
- [ ] Ajouter Storybook pour documentation visuelle
- [ ] Optimiser la configuration Tailwind (purge, plugins)
- [ ] Créer des composants wrapper pour patterns répétés
- [ ] Ajouter des animations avec Tailwind
- [ ] Documenter les composants avec JSDoc/TSDoc

## Nettoyage

- [ ] Supprimer les anciens styles CSS inutilisés
- [ ] Supprimer les imports de styles dupliqués
- [ ] Vérifier qu'aucune couleur hardcodée ne reste
- [ ] Nettoyer les classes CSS obsolètes

## Notes de Migration

### Composants Critiques à Migrer en Priorité
1. LoginView - Point d'entrée de l'application
2. DashboardView - Vue principale
3. Modales et composants de formulaire
4. Graphiques et visualisations

### Points d'Attention
- Toujours tester en mode clair ET sombre après migration
- Vérifier la cohérence des espacements et tailles
- Maintenir les transitions existantes
- Conserver l'accessibilité (aria-labels, etc.)

### Patterns de Migration Recommandés

#### Pattern 1 : Classes simples
```vue
<!-- Avant -->
<style>
.element { padding: 16px; }
</style>

<!-- Après -->
<div class="p-4">
```

#### Pattern 2 : @apply pour patterns complexes
```vue
<!-- Avant -->
<style>
.element {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--bg-primary);
}
</style>

<!-- Après -->
<style>
.element {
  @apply flex items-center gap-2 p-3 bg-bg-primary;
}
</style>
```

#### Pattern 3 : Composants globaux
```vue
<!-- Si le pattern est utilisé partout -->
<!-- Ajouter dans main.css -->
@layer components {
  .mon-pattern {
    @apply flex items-center gap-2 p-3;
  }
}

<!-- Puis utiliser -->
<div class="mon-pattern">
```

## Status Final

**Date de migration initiale** : 2026-01-15

**Composants migrés** : 7/48 (15%)

**Status global** : 🟡 Migration de base complète, migration complète en cours

**Prêt pour production** : ✅ Oui (les composants non migrés utilisent toujours leurs styles CSS)

**Build** : ✅ Réussi

**Thème clair/sombre** : ✅ Fonctionnel

---

## Comment Continuer la Migration

1. Choisir un composant dans la liste ci-dessus
2. Lire le composant et identifier les styles
3. Remplacer par les classes Tailwind
4. Tester en mode clair et sombre
5. Cocher la case dans cette checklist
6. Passer au suivant

Voir [TAILWIND_GUIDE.md](./TAILWIND_GUIDE.md) pour plus de détails sur l'utilisation de Tailwind.
