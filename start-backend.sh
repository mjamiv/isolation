#!/bin/bash
# Start IsoVis backend with OpenSeesPy (x86_64 conda env via Rosetta)
#
# Usage:
#   ./start-backend.sh          # normal start
#   ./start-backend.sh --reload # with hot-reload for development

CONDA_PYTHON="/Users/mjamiv/miniforge3/envs/isovis-x86/bin/python"
CONDA_UVICORN="/Users/mjamiv/miniforge3/envs/isovis-x86/bin/uvicorn"
BACKEND_DIR="$(cd "$(dirname "$0")/backend" && pwd)"

if [ ! -f "$CONDA_PYTHON" ]; then
  echo "ERROR: isovis-x86 conda env not found."
  echo "Create it with:"
  echo "  CONDA_SUBDIR=osx-64 conda create -n isovis-x86 python=3.11 -y"
  echo "  conda activate isovis-x86 && conda config --env --set subdir osx-64"
  echo "  pip install openseespy fastapi 'uvicorn[standard]' numpy scipy pydantic pydantic-settings python-multipart websockets"
  exit 1
fi

# Verify OpenSeesPy works
"$CONDA_PYTHON" -c "import openseespy.opensees as ops; ops.wipe()" 2>/dev/null
if [ $? -ne 0 ]; then
  echo "ERROR: OpenSeesPy import failed in isovis-x86 env"
  exit 1
fi

echo "Starting IsoVis backend (OpenSeesPy x86_64 via Rosetta)..."
echo "  API: http://localhost:8000"
echo "  Docs: http://localhost:8000/docs"

cd "$BACKEND_DIR"

if [ "$1" = "--reload" ]; then
  "$CONDA_UVICORN" app.main:app --host 0.0.0.0 --port 8000 --reload
else
  "$CONDA_UVICORN" app.main:app --host 0.0.0.0 --port 8000
fi
