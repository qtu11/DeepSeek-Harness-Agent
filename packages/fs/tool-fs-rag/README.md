# @deepseek-ai/dsh-tool-fs-rag

Model-facing RAG retrieval and document intelligence tools (`rag_search`, `doc_parse`) inspired by Qwen-Agent architecture.

## Overview

- **`rag_search`**: Segments target documents into overlapping line chunks, computes BM25 token relevance scores against natural language queries or keywords, and returns ranked snippets in structured `<doc_reference>` blocks.
- **`doc_parse`**: Inspects and outlines structured documents (Markdown, Source Code, JSON, YAML, Text) with chunk boundaries, total lines, and character summaries.
