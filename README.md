# Terraform Module GCS Publisher

A GitHub Action for publishing Terraform modules to Google Cloud Storage (GCS) buckets with proper versioning.

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Terraform%20Module%20GCS%20Publisher-blue.svg?colorA=24292e&colorB=0366d6&style=flat&longCache=true&logo=github)](https://github.com/marketplace/actions/terraform-module-gcs-publisher)

## Overview

This action helps you automate the process of publishing Terraform modules to GCS buckets, which can be used as a private Terraform module registry. It handles:

- Packaging Terraform modules into zip files
- Uploading modules to GCS with proper versioning
- Optional cleanup of old versions
- Cryptographic hash verification

## Security Features

- Minimized dependencies to reduce attack surface
- All dependencies pinned to specific versions
- Credentials handled securely with proper cleanup
- Input validation to prevent injection attacks
- Uses Google Cloud Storage signed URLs for secure access
- Proper error handling and logging

## Usage

```yaml
name: Publish Terraform Module

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Publish Terraform Module
        uses: infraspecdev/terraform-module-gcs-publisher@v1
        with:
          gcs-bucket: 'your-terraform-modules-bucket'
          module-name: 'vpc'
          module-version: ${{ github.event.release.tag_name }}
          module-path: '.'
          google-credentials: ${{ secrets.GOOGLE_CREDENTIALS }}
          delete-old-versions: 'true'
          keep-versions: '5'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `gcs-bucket` | GCS bucket name where Terraform modules will be stored | Yes | |
| `module-name` | Name of the Terraform module | Yes | |
| `module-version` | Version of the Terraform module (semver format) | Yes | |
| `module-path` | Path to the Terraform module directory | Yes | `.` |
| `google-credentials` | Google Cloud service account credentials (JSON) | Yes | |
| `delete-old-versions` | Whether to delete old versions of the module | No | `false` |
| `keep-versions` | Number of old versions to keep when deleting old versions | No | `5` |

## Outputs

| Output | Description |
|--------|-------------|
| `module-url` | URL of the uploaded Terraform module |
| `version` | Version of the uploaded Terraform module |

## Using Published Modules

You can reference the modules in your Terraform code by specifying the exact version:

```hcl
module "vpc" {
  source = "gcs::https://storage.googleapis.com/your-terraform-modules-bucket/modules/vpc/vpc-1.0.0.zip"
}
```

This approach ensures consistent and predictable deployments by pinning to specific module versions.

## Setting Up GCP Permissions

The service account used by this GitHub Action needs the following permissions:

- `storage.objects.create`
- `storage.objects.delete` (if using `delete-old-versions`)
- `storage.objects.get`
- `storage.objects.list`

## Contributing

Contributions are welcome. Submit a Pull Request to contribute to this project.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
