# Backup and import

Project export and restore plus Trello JSON import.

```mermaid
flowchart TB
  Export["GET api backup export"]
  Import["POST api backup import"]
  Trello["POST api import trello"]

  Export --> JSON[Scoped JSON snapshot]
  Import --> Mode{import mode}
  Mode --> Replace[replace]
  Mode --> Merge[merge]
  Mode --> Copy[copy as new]

  Trello --> Transform[trelloimport package]
  Transform --> StoreI[store ImportProjects]
  Import --> StoreI
```

## Trello transform

```mermaid
flowchart LR
  TrelloJSON[Trello board JSON upload]
  Map[Column and card mapping]
  Tags[Tag and member mapping]
  Proj[New or target project]

  TrelloJSON --> Map --> Tags --> Proj
```

Import body size is capped separately (`MaxTrelloImportBody`). Audit trail records destructive import operations when enabled.
