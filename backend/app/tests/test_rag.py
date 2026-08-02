import sys
import os

# Adjust path to import app modules correctly
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from langchain_core.documents import Document
from app.services.rag_service import rag_service


def test_rag_ingest_and_search():
    print("=== Running RAG Ingestion and Search Test ===")
    
    # 1. Setup mock test document
    test_doc = Document(
        page_content="Troubleshooting Guide: Redis connection timed out on port 6379. Make sure to restart the Redis server with 'redis-server restart'.",
        metadata={"source": "test_redis.md", "type": "runbook"}
    )
    
    # 2. Ingest document
    print("Ingesting test document...")
    ids = rag_service.ingest_documents([test_doc])
    print(f"Ingestion successful, returned chunk IDs: {ids}")
    assert len(ids) > 0, "Failed to ingest test document"
    
    # 3. Query document
    query = "Redis connection timed out on port 6379"
    print(f"Searching for: '{query}'...")
    results = rag_service.search(query, k=1)
    
    print(f"Search returned {len(results)} result(s).")
    assert len(results) > 0, "No results returned from query"
    
    returned_doc = results[0]
    print(f"Top result content:\n{returned_doc.page_content}")
    print(f"Top result metadata: {returned_doc.metadata}")
    
    assert "redis-server restart" in returned_doc.page_content, "Search result does not match expected document content"
    print("\n[SUCCESS] RAG Ingestion and Semantic Search test passed!")


if __name__ == "__main__":
    try:
        test_rag_ingest_and_search()
        sys.exit(0)
    except Exception as e:
        print(f"\n[FAILURE] Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
