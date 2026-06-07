# VoiceFlow pipeline

Browser speech drives board mutations through parse, resolve, and execute stages.

```mermaid
flowchart LR
  Mic[Web Speech API speech.ts]
  Parse[parser.ts vocabulary]
  Resolve[resolve.ts target-resolver.ts]
  Exec[execute.ts]
  McpC[mcp-client.ts optional]
  API[REST or MCP mutation]

  Mic --> Parse --> Resolve --> Exec
  Exec --> McpC
  Exec --> API
```

## State machine

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Listening: push to talk or hands free
  Listening --> Parsing: utterance final
  Parsing --> Confirming: ambiguous target
  Confirming --> Executing: user confirms
  Parsing --> Executing: high confidence
  Executing --> Idle: success or error
```

Preferences (`voiceflow-preferences.ts`) control enabled flag, hands-free confirmation, and mode. See `docs/voiceflow.md` for command vocabulary.
