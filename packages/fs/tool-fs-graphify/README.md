# @deepseek-ai/dsh-tool-fs-graphify

Deterministic AST Code Knowledge Graph and Work Memory reflection engine (Graphify) for DeepSeek Harness.

## Features

- **AST Codebase Knowledge Graph (`graphify_scan`)**: Extracts nodes (functions, classes, interfaces, types, endpoints, modules) and edges (`calls`, `imports`, `defines`, `inherits`, `depends_on`) across TypeScript, JavaScript, Python, Go, Rust, C#, SQL, and configurations.
- **Topology & Community Analysis**: Detects modular communities, God Nodes, and circular dependencies.
- **Instant Graph Traversal (`graphify_query`)**: Answers architectural queries (neighborhood, dependency paths, God nodes) without reading raw code files.
- **Work Memory Loop (`graphify_save_result`)**: Records Q&A results and outcome signals (`useful`, `dead_end`, `corrected`) to `graphify-out/memory/`.
- **Deterministic Reflection (`graphify_reflect`)**: Uses time-decay scoring to build `graphify-out/reflections/LESSONS.md`.
- **Context Injection**: Automatically injects high-level architecture maps and accumulated lessons into every new chat session.
