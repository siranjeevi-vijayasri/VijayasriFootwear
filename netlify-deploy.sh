#!/usr/bin/env bash
set -euo pipefail
# Run from this extracted project directory after installing Netlify CLI and linking your site.
netlify deploy --prod --dir . --functions netlify/functions
