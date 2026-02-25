# Pylint Analyzer - Deployment Guide

## Prerequisites

- Docker installed and running
- Qubeless platform running (API + Worker services)
- Access to build Docker images

## Local Development Setup

### 1. Build the Docker Image

```bash
cd analyzers/pylint
docker build -t pylint-analyzer:latest .
```

### 2. Verify the Image

```bash
# Check image exists
docker images | grep pylint

# Run test suite
./test.sh
```

Expected output:
```
✅ All tests passed!
```

### 3. Seed the Database

The analyzer will be automatically detected when you run the seed script:

```bash
cd apps/api
pnpm prisma db seed
```

This will create an `Analyzer` entry in the database:
- **key**: `pylint`
- **name**: `Pylint`
- **dockerImage**: `pylint-analyzer:latest`
- **enabled**: `true`

### 4. Verify in Database

```bash
# Connect to your database and check
SELECT key, name, "dockerImage", enabled FROM "Analyzer" WHERE key = 'pylint';
```

Expected result:
```
 key    | name   | dockerImage            | enabled
--------+--------+------------------------+---------
 pylint | Pylint | pylint-analyzer:latest | true
```

## Production Deployment

### 1. Build and Tag for Registry

```bash
# Build with version tag
docker build -t your-registry.com/analyzers/pylint-analyzer:1.0.0 .

# Also tag as latest
docker tag your-registry.com/analyzers/pylint-analyzer:1.0.0 \
           your-registry.com/analyzers/pylint-analyzer:latest

# Push to registry
docker push your-registry.com/analyzers/pylint-analyzer:1.0.0
docker push your-registry.com/analyzers/pylint-analyzer:latest
```

### 2. Configure Environment Variables

Set these in your API service environment:

```bash
# .env or docker-compose.dev.yml
ANALYZER_IMAGE_PREFIX=your-registry.com/analyzers
ANALYZER_IMAGE_TAG=1.0.0
```

This will make the seed script generate:
```
dockerImage: "your-registry.com/analyzers/pylint-analyzer:1.0.0"
```

### 3. Seed Production Database

```bash
cd apps/api
DATABASE_URL="your-production-db-url" pnpm prisma db seed
```

### 4. Verify Worker Can Pull Image

```bash
# On worker node/container
docker pull your-registry.com/analyzers/pylint-analyzer:1.0.0
```

## Testing the Analyzer

### Manual Test

```bash
# Create test output directory
mkdir -p /tmp/pylint-test-output

# Run analyzer on demo project
docker run --rm \
  -v $(pwd)/../../examples/python-pylint-demo:/workspace:ro \
  -v /tmp/pylint-test-output:/out \
  pylint-analyzer:latest

# Check results
cat /tmp/pylint-test-output/report.json | jq '.issues | length'
# Should output: 23
```

### Automated Test

```bash
cd analyzers/pylint
./test.sh
```

## Troubleshooting

### Image Not Found Error

**Error**: `(HTTP code 404) no such container - No such image: pylint-analyzer:latest`

**Solution**:
1. Check image exists: `docker images | grep pylint`
2. Rebuild if needed: `docker build -t pylint-analyzer:latest .`
3. Check worker can access the image (same host or registry)

### No Issues Detected

**Check**:
1. Verify Python files exist in workspace: `docker run --rm -v /path:/workspace pylint-analyzer:latest`
2. Check run.log: `cat /out/run.log`
3. Verify files aren't excluded (not in venv/, dist/, etc.)

### Seed Not Detecting Analyzer

**Check**:
1. Dockerfile exists: `ls analyzers/pylint/Dockerfile`
2. Directory name is `pylint` (not `pylint-analyzer`)
3. Re-run seed: `cd apps/api && pnpm prisma db seed`

## Next Steps

After deployment:

1. **Enable for Projects**: Go to Project Settings → Analyzers → Enable Pylint
2. **Configure**: Add custom `.pylintrc` in project root if needed
3. **Run Analysis**: Trigger manual analysis or wait for next commit
4. **View Results**: Check Issues tab for Pylint findings

## Integration with CI/CD

Example GitHub Actions workflow:

```yaml
- name: Build Pylint Analyzer
  run: |
    cd analyzers/pylint
    docker build -t ghcr.io/${{ github.repository }}/pylint-analyzer:${{ github.sha }} .
    docker tag ghcr.io/${{ github.repository }}/pylint-analyzer:${{ github.sha }} \
               ghcr.io/${{ github.repository }}/pylint-analyzer:latest

- name: Push to Registry
  run: |
    docker push ghcr.io/${{ github.repository }}/pylint-analyzer:${{ github.sha }}
    docker push ghcr.io/${{ github.repository }}/pylint-analyzer:latest
```
