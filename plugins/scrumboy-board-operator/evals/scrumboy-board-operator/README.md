# Scrumboy Board Operator Evals

These eval cases verify that the Scrumboy Board Operator Skill uses the correct
MCP or Agoragentic surface, reads board state before proposing mutations, and
keeps sensitive board data out of plugin telemetry.

Run them with the eval runner of your choice by mapping each JSONL record to an
agent task and checking the `expected` criteria.
