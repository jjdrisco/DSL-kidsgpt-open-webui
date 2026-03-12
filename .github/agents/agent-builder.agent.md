---
name: AgentBuilder
description: Creates new custom Copilot agents for features and workflows in this codebase.
---

## Agent File Format

All agents live in `.github/agents/` and follow this structure:

```markdown
---
name: AgentName
description: One-sentence description of the agent's purpose.
---

## Key Files

- `path/to/file.py` — what it does and why it matters for this feature.

## How It Works

1. Step-by-step numbered flow of the feature.

## Important Rules

- Constraints, gotchas, or conventions the agent must respect.
```

## Guidelines

- Keep files short — under 40 lines is ideal.
- Only include files directly relevant to the feature.
- "How It Works" should be 3–8 numbered steps max.
- "Important Rules" should be 2–5 bullets covering non-obvious constraints.
- Name the file `<feature>.agent.md` in snake_case or kebab-case.

## Process for Creating a New Agent

1. Ask the user which feature or workflow the agent covers.
2. Search the codebase for the relevant files (`grep_search`, `semantic_search`).
3. Read the key files to understand the data flow.
4. Write the agent file using the format above — minimal, no prose.
5. Create the file at `.github/agents/<feature>.agent.md`.
