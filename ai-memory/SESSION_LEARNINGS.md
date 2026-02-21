# Session Learnings

- Entry point and routing are handled in main.tsx and App.tsx.
- Graph logic (auto-linking, keyword extraction) is centralized in graphStore.ts.
- UI is modular: ForceGraph for visualization, ReadingMode for content, AdminPanel for management.
- Tailwind and Vite configs are critical for build and styling.
- Utility functions (cn) are used for class merging.
- Data definitions (quranData.ts) are separated for clarity.
- Absolute imports and clear file structure improve maintainability.
- Code is organized for separation of concerns: data, logic, UI, config.
- TypeScript interfaces are used for type safety.
- Providers (React Query, Tooltip, Toaster) are set up in App.tsx.
- Session focused on minimizing token usage by targeting only the most critical files.