# Analyzers UI Documentation

This document describes the Analyzer Management UI features available in the Qubeless web application.

## Overview

The Analyzer Management UI provides comprehensive tools for:

- **Global analyzer management** (admin only): Create, edit, enable/disable, and delete analyzers
- **Project-level configuration**: Enable/disable analyzers per project and configure their JSON settings

## Features

### 1. Admin Analyzers Page (`/admin/analyzers`)

**Access**: Admin users only

**Location**: Navigation sidebar → Admin → Analyzers

#### Capabilities

- **View all analyzers**: Grid display showing name, key, Docker image, and enabled status
- **Search & Filter**:
  - Full-text search by key or name
  - Filter by enabled/disabled status
- **Add analyzer**: Create new analyzers with validation
- **Edit analyzer**: Modify name, Docker image, and enabled status
- **Delete analyzer**: Remove analyzers (with confirmation)
- **Toggle enabled/disabled**: Control global availability

#### Add/Edit Analyzer Form

**Fields**:
- **Key** (required, immutable after creation): Lowercase letters, numbers, hyphens only (2-32 chars)
- **Name** (required): Display name
- **Docker Image** (required): Must include tag (e.g., `:latest`) or SHA256 digest
- **Enabled**: Global on/off toggle (default: true)

**Validation**:
- Key format: `^[a-z0-9-]{2,32}$`
- Docker image must contain `:` or `@sha256:`
- All fields validated before submission

#### User Experience

- Real-time search/filter without page reload
- Toast notifications for success/error actions
- Confirmation dialogs for destructive operations (delete, disable)
- Loading states during operations
- Error messages with clear descriptions

---

### 2. Project Analyzers Tab

**Access**: All authenticated users (per project permissions)

**Location**: Project Detail → Analyzers tab

#### Capabilities

- **View project analyzer configuration**: See all available analyzers and their project-specific settings
- **Enable/disable per project**: Override global settings for this project
- **Configure JSON settings**: Provide analyzer-specific configuration (e.g., thresholds, rules, options)
- **Format & validate JSON**: Built-in JSON formatter and real-time validation
- **Reset to server state**: Discard unsaved changes

#### Analyzer Configuration Card

Each analyzer displays:
- Name, key, and global enabled status
- Project-specific enabled toggle (disabled if analyzer is globally disabled)
- JSON configuration editor with:
  - Syntax highlighting (dark theme)
  - Real-time validation
  - "Format JSON" button for pretty-printing
  - "Reset" button to discard changes
  - "Save" button (disabled when no changes or validation errors)

**JSON Configuration**:
- Must be a valid JSON object (not array or primitive)
- Empty configuration is allowed (inherits defaults)
- Unsaved changes are tracked with visual indicator
- Validation errors displayed inline

#### Disabled Analyzer States

- **Globally disabled**: Project toggle is disabled; message shown
- **Using global default**: Shown when project hasn't overridden the setting

---

## Backend API Requirements

The UI expects the following backend endpoints:

### Global Analyzers (Admin)

```
GET    /api/analyzers
POST   /api/analyzers
PUT    /api/analyzers/:key
DELETE /api/analyzers/:key
```

**GET /api/analyzers** → Returns `Analyzer[]`

```typescript
interface Analyzer {
  id: string;
  key: string;
  name: string;
  dockerImage: string;
  enabled: boolean;
  createdAt: string;
}
```

**POST /api/analyzers** → Body: `{ key, name, dockerImage, enabled? }`

Returns created `Analyzer`

**PUT /api/analyzers/:key** → Body: `{ name?, dockerImage?, enabled? }`

Returns updated `Analyzer`

**DELETE /api/analyzers/:key** → Returns `204 No Content` or `void`

---

### Project Analyzers

```
GET /api/projects/:projectKey/analyzers
PUT /api/projects/:projectKey/analyzers/:analyzerKey
```

**GET /api/projects/:projectKey/analyzers** → Returns `ProjectAnalyzerStatus[]`

```typescript
interface ProjectAnalyzerStatus {
  analyzer: Analyzer;
  projectEnabled: boolean | null; // null = using global default
  effectiveEnabled: boolean;      // computed: global AND project
  configJson?: Record<string, unknown> | null;
}
```

**PUT /api/projects/:projectKey/analyzers/:analyzerKey** → Body:

```json
{
  "enabled": true,
  "configJson": {
    "threshold": 10,
    "rules": ["rule1", "rule2"]
  }
}
```

Returns updated `ProjectAnalyzerStatus`

---

## Component Architecture

### Pages
- `apps/web/src/views/AdminAnalyzersView.vue` - Admin analyzers management page
- `apps/web/src/views/ProjectDetailView.vue` - Modified to include Analyzers tab

### Components

**Reusable UI**:
- `apps/web/src/components/common/ErrorBanner.vue` - Error display
- `apps/web/src/components/common/LoadingState.vue` - Loading spinner
- `apps/web/src/components/common/ConfirmModal.vue` - Confirmation dialogs
- `apps/web/src/components/common/Toast.vue` - Toast notifications

**Analyzer-specific**:
- `apps/web/src/components/analyzers/AnalyzerFormModal.vue` - Create/edit analyzer modal
- `apps/web/src/components/analyzers/ProjectAnalyzerCard.vue` - Single analyzer config card
- `apps/web/src/components/analyzers/ProjectAnalyzersTab.vue` - Project analyzers tab content

### API Layer

**File**: `apps/web/src/services/api.ts`

**Functions**:
```typescript
// Global management
getAnalyzers(): Promise<Analyzer[]>
createAnalyzer(payload): Promise<Analyzer>
updateAnalyzer(key, payload): Promise<Analyzer>
deleteAnalyzer(key): Promise<void>

// Project configuration
getProjectAnalyzers(projectKey): Promise<ProjectAnalyzerStatus[]>
updateProjectAnalyzer(projectKey, analyzerKey, payload): Promise<ProjectAnalyzerStatus>
```

---

## User Flows

### Admin: Create a New Analyzer

1. Navigate to **Admin → Analyzers**
2. Click **"Add Analyzer"**
3. Fill in form:
   - Key: `eslint`
   - Name: `ESLint`
   - Docker Image: `myregistry/eslint-analyzer:v1.0.0`
   - Enabled: checked
4. Click **"Create"**
5. Success toast appears, analyzer added to list

### Admin: Disable an Analyzer Globally

1. Navigate to **Admin → Analyzers**
2. Find the analyzer in the list
3. Click the toggle switch to disable
4. Confirmation dialog appears: "Disabling will affect all projects"
5. Confirm → Analyzer marked as disabled
6. All project toggles for this analyzer become disabled

### User: Configure Analyzer for a Project

1. Navigate to **Project → Analyzers tab**
2. Find the desired analyzer card
3. Toggle enabled ON (if not globally disabled)
4. Edit JSON configuration:
   ```json
   {
     "threshold": 15,
     "excludePatterns": ["*.test.js"]
   }
   ```
5. Click **"Format JSON"** to pretty-print
6. Click **"Save"**
7. Success message appears, configuration saved

### User: Fix Invalid JSON

1. In Project Analyzers tab, type invalid JSON:
   ```
   {threshold 10}
   ```
2. Error banner appears: "Invalid JSON: Expected ':' at position X"
3. "Save" button is disabled
4. Fix the JSON: `{"threshold": 10}`
5. Error clears, "Save" button enabled

---

## Validation Rules

### Analyzer Key
- Pattern: `^[a-z0-9-]{2,32}$`
- Must be unique (enforced by backend)
- Immutable once created

### Docker Image
- Must contain `:` (tag) or `@sha256:` (digest)
- Examples:
  - ✅ `myregistry/analyzer:latest`
  - ✅ `myregistry/analyzer@sha256:abc123...`
  - ❌ `myregistry/analyzer`

### JSON Configuration
- Must be a valid JSON object `{...}`
- Cannot be array `[...]` or primitive `"string"`, `123`, etc.
- Empty/null is allowed (inherits defaults)

---

## Error Handling

All errors from the API are caught and displayed:
- **Toast notifications** for transient actions (save, delete, toggle)
- **Error banners** for persistent errors (page load failures)
- **Inline validation errors** for form/config issues

Error messages include:
- Clear description of what failed
- Actionable guidance when possible
- Dismissible UI (for non-critical errors)

---

## i18n Support

All UI text supports English and French locales:
- Navigation: `nav.analyzers`
- Project tab: `project.tabs.analyzers`

Translations defined in `apps/web/src/i18n.ts`

---

## Testing Checklist

### Admin Analyzers Page

- [ ] Load page shows all analyzers
- [ ] Search filters by key/name
- [ ] Filter by enabled/disabled works
- [ ] Create new analyzer with valid data succeeds
- [ ] Create analyzer with invalid key shows error
- [ ] Edit analyzer updates name/image/enabled
- [ ] Delete analyzer shows confirmation and removes it
- [ ] Toggle enabled/disabled updates global state
- [ ] Disabling globally warns about project impact

### Project Analyzers Tab

- [ ] Load tab shows all project analyzer configs
- [ ] Global disabled analyzers show correct state
- [ ] Enable/disable toggle works (when global enabled)
- [ ] JSON editor validates syntax
- [ ] Format JSON button pretty-prints
- [ ] Save button disabled when no changes
- [ ] Save button disabled when JSON invalid
- [ ] Reset button reverts to server state
- [ ] Save succeeds and shows success message
- [ ] Refresh after save shows updated config

---

## Future Enhancements

Potential improvements (not currently implemented):

- Analyzer templates/presets for common configurations
- Bulk enable/disable analyzers for projects
- Analyzer usage statistics (which projects use which analyzers)
- Configuration schema validation (JSON Schema)
- Import/export analyzer configurations
- Analyzer version management
- Audit log for analyzer changes

---

## Troubleshooting

**Issue**: Analyzer doesn't appear in project list
**Solution**: Check if analyzer is globally enabled in Admin → Analyzers

**Issue**: Can't enable analyzer in project
**Solution**: Analyzer must be globally enabled first

**Issue**: JSON validation error won't clear
**Solution**: Ensure JSON is a valid object `{}`, not array or primitive

**Issue**: Changes not saved
**Solution**: Check browser console for API errors; verify backend is running

**Issue**: Toast notification doesn't appear
**Solution**: Check component is mounted; toast has 3-second auto-dismiss

---

## Related Documentation

- [Backend API Documentation](./api.md) _(if exists)_
- [Scanner Configuration](./scanner-config.md) _(if exists)_
- [Quality Gates](./quality-gates.md) _(if exists)_
