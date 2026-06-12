# VoiceFlow pipeline

Optional browser speech shortcuts for board actions (push-to-talk or hands-free). The surrounding board/settings UI localizes with the SPA i18n layer, but command grammar, spoken confirmations, and disambiguation words remain English-centric today.

```mermaid
flowchart LR
  UI[Board topbar and settings]
  I18n[i18n runtime and locale catalogs]
  Mic[Web Speech API speech.ts]
  Parse[parser.ts vocabulary]
  Resolve[resolve.ts target-resolver.ts]
  Exec[execute.ts]
  McpC[mcp-client.ts optional]
  API[REST or MCP mutation]

  I18n --> UI
  UI --> Mic
  Mic --> Parse --> Resolve --> Exec
  Exec --> McpC
  Exec --> API
```

## Locale boundary

- Board chrome and `Settings -> Customization -> VoiceFlow` copy follow the app locale.
- Parser vocabulary, built-in status aliases, spoken `yes` / `no` confirmations, and spoken disambiguation words currently stay English-centric.
- `Safe-Mode` is the safer choice in a non-English UI because the command grammar does not switch with the app locale yet.

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
