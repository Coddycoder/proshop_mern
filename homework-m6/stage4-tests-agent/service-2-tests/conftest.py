"""Pytest bootstrap for the rag/query.py characterization tests.

Puts the `rag/` directory on sys.path so `import query` resolves to
`rag/query.py` (the service under test) regardless of where pytest is invoked
from. No real model or Qdrant server is loaded — every test monkeypatches the
heavy collaborators (see test_query.py).
"""

import pathlib
import sys

# rag/__tests__/conftest.py -> parent is rag/__tests__, parent.parent is rag/
RAG_DIR = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAG_DIR))
