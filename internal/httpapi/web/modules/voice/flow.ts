import type { Board } from '../types.js';
import type { BoardMember } from '../state/state.js';
import { showToast } from '../utils.js';
import { executeCommandIR } from './execute.js';
import { callMcpTool } from './mcp-client.js';
import { parseCommand } from './parser.js';
import { resolveCommandDraft } from './resolve.js';
import { startOneShotRecognition } from './speech.js';
import { isCommandFailure, type CommandFailure, type CommandResult, type ResolvedCommand } from './schema.js';

export type OpenVoiceCommandOptions = {
  projectId: number;
  projectSlug: string;
  board: Board;
  members: BoardMember[];
  role: string | null;
  isCurrent: () => boolean;
  refreshBoard: () => Promise<void>;
  recordMutation?: () => void;
  showMessage?: (message: string) => void;
};

type ParsedAlternative = {
  transcript: string;
  resolved: ResolvedCommand;
};

let activeAbortController: AbortController | null = null;

function setText(el: Element | null, text: string): void {
  if (el) el.textContent = text;
}

function commandHash(command: ResolvedCommand): string {
  return JSON.stringify(command.ir);
}

function sameCommand(a: ResolvedCommand, b: ResolvedCommand): boolean {
  return commandHash(a) === commandHash(b);
}

async function parseAndResolve(transcript: string, options: OpenVoiceCommandOptions): Promise<CommandResult<ResolvedCommand>> {
  if (!options.isCurrent()) {
    return { ok: false, code: "stale_context", message: "The board changed before the command could run." };
  }
  const parsed = parseCommand(transcript);
  if (isCommandFailure(parsed)) return parsed;
  return resolveCommandDraft(parsed.value, {
    projectId: options.projectId,
    projectSlug: options.projectSlug,
    board: options.board,
    members: options.members,
    callTool: callMcpTool,
  });
}

async function parseAlternatives(alternatives: string[], options: OpenVoiceCommandOptions): Promise<CommandResult<ParsedAlternative>> {
  const successes: ParsedAlternative[] = [];
  let firstFailure: CommandFailure | null = null;

  for (const transcript of alternatives) {
    const resolved = await parseAndResolve(transcript, options);
    if (!isCommandFailure(resolved)) {
      successes.push({ transcript, resolved: resolved.value });
    } else if (!firstFailure) {
      firstFailure = resolved;
    }
  }

  if (successes.length === 0) {
    return firstFailure ?? { ok: false, code: "unsupported", message: "Unsupported command." };
  }

  const first = successes[0];
  if (successes.some((candidate) => !sameCommand(candidate.resolved, first.resolved))) {
    return { ok: false, code: "unsupported", message: "Speech matched more than one command. Review the text and try again." };
  }

  return { ok: true, value: first };
}

function createDialog(): HTMLDialogElement {
  const dialog = document.createElement("dialog");
  dialog.className = "dialog voice-command-dialog";
  dialog.innerHTML = `
    <form method="dialog" class="dialog__form voice-command" id="voiceCommandForm">
      <div class="dialog__header">
        <div class="dialog__title">Voice</div>
        <button class="btn btn--ghost" type="button" id="voiceCommandClose" aria-label="Close">x</button>
      </div>

      <div class="voice-command__tabs" role="tablist" aria-label="Command input mode">
        <button type="button" class="voice-command__tab voice-command__tab--active" id="voiceModeSpeech">Speech</button>
        <button type="button" class="voice-command__tab" id="voiceModeType">Type</button>
      </div>

      <div class="voice-command__speech" id="voiceSpeechPanel">
        <button type="button" class="btn" id="voiceListenBtn">Listen</button>
        <button type="button" class="btn btn--ghost" id="voiceStopBtn" disabled>Stop</button>
        <span class="voice-command__status" id="voiceListenStatus" aria-live="polite"></span>
      </div>

      <label class="field">
        <div class="field__label">Command</div>
        <textarea id="voiceTranscript" class="input voice-command__transcript" rows="3" maxlength="260" placeholder="create story Fix login"></textarea>
      </label>

      <div class="voice-command__review">
        <button type="button" class="btn btn--ghost" id="voiceReviewBtn">Review</button>
        <span class="voice-command__status" id="voiceReviewStatus" aria-live="polite"></span>
      </div>

      <div class="voice-command__summary" id="voiceSummary" hidden></div>

      <div class="dialog__footer">
        <div class="spacer"></div>
        <button type="button" class="btn btn--ghost" id="voiceCancelBtn">Cancel</button>
        <button type="submit" class="btn" id="voiceExecuteBtn" disabled>Execute</button>
      </div>
    </form>
  `;
  return dialog;
}

export function openVoiceCommandDialog(options: OpenVoiceCommandOptions): void {
  const existing = document.getElementById("voiceCommandDialog");
  if (existing?.parentNode) {
    existing.parentNode.removeChild(existing);
  }

  const dialog = createDialog();
  dialog.id = "voiceCommandDialog";
  document.body.appendChild(dialog);

  const form = dialog.querySelector<HTMLFormElement>("#voiceCommandForm");
  const closeBtn = dialog.querySelector<HTMLButtonElement>("#voiceCommandClose");
  const cancelBtn = dialog.querySelector<HTMLButtonElement>("#voiceCancelBtn");
  const listenBtn = dialog.querySelector<HTMLButtonElement>("#voiceListenBtn");
  const stopBtn = dialog.querySelector<HTMLButtonElement>("#voiceStopBtn");
  const speechTab = dialog.querySelector<HTMLButtonElement>("#voiceModeSpeech");
  const typeTab = dialog.querySelector<HTMLButtonElement>("#voiceModeType");
  const speechPanel = dialog.querySelector<HTMLElement>("#voiceSpeechPanel");
  const transcript = dialog.querySelector<HTMLTextAreaElement>("#voiceTranscript");
  const reviewBtn = dialog.querySelector<HTMLButtonElement>("#voiceReviewBtn");
  const executeBtn = dialog.querySelector<HTMLButtonElement>("#voiceExecuteBtn");
  const summary = dialog.querySelector<HTMLElement>("#voiceSummary");
  const listenStatus = dialog.querySelector<HTMLElement>("#voiceListenStatus");
  const reviewStatus = dialog.querySelector<HTMLElement>("#voiceReviewStatus");
  const notify = options.showMessage ?? showToast;
  let currentCommand: ResolvedCommand | null = null;
  let executing = false;
  let lastExecutedHash: string | null = null;

  const clearResolved = () => {
    currentCommand = null;
    if (summary) {
      summary.hidden = true;
      summary.textContent = "";
    }
    if (executeBtn) {
      executeBtn.disabled = true;
      executeBtn.classList.remove("btn--danger");
      executeBtn.textContent = "Execute";
    }
  };

  const close = () => {
    activeAbortController?.abort();
    activeAbortController = null;
    if (dialog.open) dialog.close();
    dialog.remove();
  };

  const setMode = (mode: "speech" | "type") => {
    speechTab?.classList.toggle("voice-command__tab--active", mode === "speech");
    typeTab?.classList.toggle("voice-command__tab--active", mode === "type");
    if (speechPanel) speechPanel.hidden = mode !== "speech";
    setText(listenStatus, "");
  };

  const applyResolved = (resolved: ResolvedCommand) => {
    currentCommand = resolved;
    setText(summary, resolved.summary);
    if (summary) summary.hidden = false;
    if (executeBtn) {
      executeBtn.disabled = false;
      executeBtn.textContent = resolved.confirmLabel;
      executeBtn.classList.toggle("btn--danger", resolved.danger);
    }
    setText(reviewStatus, "");
  };

  const reviewTranscript = async () => {
    clearResolved();
    const value = transcript?.value.trim() ?? "";
    setText(reviewStatus, "Reviewing...");
    const resolved = await parseAndResolve(value, options);
    if (isCommandFailure(resolved)) {
      setText(reviewStatus, resolved.message);
      return;
    }
    applyResolved(resolved.value);
  };

  speechTab?.addEventListener("click", () => setMode("speech"));
  typeTab?.addEventListener("click", () => setMode("type"));
  closeBtn?.addEventListener("click", close);
  cancelBtn?.addEventListener("click", close);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });

  transcript?.addEventListener("input", clearResolved);
  reviewBtn?.addEventListener("click", () => {
    void reviewTranscript();
  });

  listenBtn?.addEventListener("click", async () => {
    clearResolved();
    setText(listenStatus, "Listening...");
    activeAbortController = new AbortController();
    if (listenBtn) listenBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
    try {
      const speech = await startOneShotRecognition({ signal: activeAbortController.signal });
      const parsed = await parseAlternatives(speech.alternatives, options);
      if (isCommandFailure(parsed)) {
        if (transcript && speech.alternatives[0]) transcript.value = speech.alternatives[0];
        setText(listenStatus, parsed.message);
        return;
      }
      if (transcript) transcript.value = parsed.value.transcript;
      applyResolved(parsed.value.resolved);
      setText(listenStatus, "Ready");
    } catch (err: any) {
      setText(listenStatus, err?.message || "Speech recognition failed.");
    } finally {
      activeAbortController = null;
      if (listenBtn) listenBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = true;
    }
  });

  stopBtn?.addEventListener("click", () => {
    activeAbortController?.abort();
    activeAbortController = null;
    setText(listenStatus, "Stopped");
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (executing || !currentCommand || !executeBtn) return;
    if (!options.isCurrent()) {
      setText(reviewStatus, "The board changed before the command could run.");
      return;
    }
    const hash = commandHash(currentCommand);
    if (hash === lastExecutedHash) {
      setText(reviewStatus, "This command already ran.");
      return;
    }

    executing = true;
    executeBtn.disabled = true;
    setText(reviewStatus, "Running...");
    try {
      await executeCommandIR(currentCommand.ir, {
        refreshBoard: options.refreshBoard,
        recordMutation: options.recordMutation,
      });
      lastExecutedHash = hash;
      notify("Command complete");
      close();
    } catch (err: any) {
      setText(reviewStatus, err?.message || "Command failed.");
      executeBtn.disabled = false;
    } finally {
      executing = false;
    }
  });

  setMode("speech");
  dialog.showModal();
  transcript?.focus();
}
