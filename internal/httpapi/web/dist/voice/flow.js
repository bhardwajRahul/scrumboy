import { isAnonymousBoard, isTemporaryBoard, showToast } from '../utils.js';
import { canShowVoiceCommands } from '../views/board-command-capabilities.js';
import { executeCommandIR } from './execute.js';
import { callMcpTool } from './mcp-client.js';
import { parseCommand } from './parser.js';
import { resolveCommandDraft } from './resolve.js';
import { startOneShotRecognition } from './speech.js';
import { commandFailure, isCommandFailure, } from './schema.js';
function setText(el, text) {
    if (el)
        el.textContent = text;
}
function commandHash(command) {
    return JSON.stringify(command.ir);
}
function draftHash(draft) {
    return JSON.stringify(draft);
}
function dedupeAlternatives(alternatives) {
    const out = [];
    for (const alternative of alternatives) {
        const transcript = String(alternative ?? "").trim();
        if (transcript && !out.includes(transcript))
            out.push(transcript);
        if (out.length >= 3)
            break;
    }
    return out;
}
function getActiveContext(options) {
    const context = options.getContext();
    if (!context || context.projectId !== options.initialProjectId || context.projectSlug !== options.initialProjectSlug) {
        return commandFailure("stale_context", "The board changed before the command could run.");
    }
    const allowed = canShowVoiceCommands({
        projectId: context.projectId,
        projectSlug: context.projectSlug,
        role: context.role,
        isTemporary: isTemporaryBoard(context.board),
        isAnonymous: isAnonymousBoard(context.board),
    });
    if (!allowed) {
        return commandFailure("stale_context", "Commands are unavailable for this board.");
    }
    return { ok: true, value: context };
}
async function resolveParsedDraft(draft, context, signal) {
    return resolveCommandDraft(draft, {
        projectId: context.projectId,
        projectSlug: context.projectSlug,
        board: context.board,
        members: context.members,
        callTool: (tool, input) => callMcpTool(tool, input, { signal }),
    });
}
export async function parseAndResolveCommand(transcript, options, signal) {
    const context = getActiveContext(options);
    if (isCommandFailure(context))
        return context;
    const parsed = parseCommand(transcript);
    if (isCommandFailure(parsed))
        return parsed;
    return resolveParsedDraft(parsed.value, context.value, signal);
}
export async function parseAlternatives(alternatives, options, signal) {
    const successes = [];
    let firstFailure = null;
    for (const transcript of dedupeAlternatives(alternatives)) {
        const parsed = parseCommand(transcript);
        if (!isCommandFailure(parsed)) {
            successes.push({ transcript, draft: parsed.value, hash: draftHash(parsed.value) });
        }
        else if (!firstFailure) {
            firstFailure = parsed;
        }
    }
    if (successes.length === 0) {
        return firstFailure ?? commandFailure("unsupported", "Unsupported command.");
    }
    const first = successes[0];
    if (successes.some((candidate) => candidate.hash !== first.hash)) {
        return commandFailure("unsupported", "Speech matched more than one command. Review the text and try again.");
    }
    const context = getActiveContext(options);
    if (isCommandFailure(context))
        return context;
    const resolved = await resolveParsedDraft(first.draft, context.value, signal);
    if (isCommandFailure(resolved))
        return resolved;
    return { ok: true, value: { transcript: first.transcript, resolved: resolved.value } };
}
function createDialog() {
    const dialog = document.createElement("dialog");
    dialog.className = "dialog voice-command-dialog";
    dialog.innerHTML = `
    <form method="dialog" class="dialog__form voice-command" id="voiceCommandForm">
      <div class="dialog__header">
        <div class="dialog__title">Commands</div>
        <button class="btn btn--ghost" type="button" id="voiceCommandClose" aria-label="Close">x</button>
      </div>

      <div class="voice-command__tabs" role="tablist" aria-label="Command input mode">
        <button type="button" class="voice-command__tab voice-command__tab--active" id="voiceModeSpeech">Speak</button>
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
export function openVoiceCommandDialog(options) {
    const existing = document.getElementById("voiceCommandDialog");
    if (existing?.parentNode) {
        existing.dispatchEvent(new Event("voice-command:close"));
        if (existing.parentNode)
            existing.parentNode.removeChild(existing);
    }
    const dialog = createDialog();
    dialog.id = "voiceCommandDialog";
    document.body.appendChild(dialog);
    const form = dialog.querySelector("#voiceCommandForm");
    const closeBtn = dialog.querySelector("#voiceCommandClose");
    const cancelBtn = dialog.querySelector("#voiceCancelBtn");
    const listenBtn = dialog.querySelector("#voiceListenBtn");
    const stopBtn = dialog.querySelector("#voiceStopBtn");
    const speechTab = dialog.querySelector("#voiceModeSpeech");
    const typeTab = dialog.querySelector("#voiceModeType");
    const speechPanel = dialog.querySelector("#voiceSpeechPanel");
    const transcript = dialog.querySelector("#voiceTranscript");
    const reviewBtn = dialog.querySelector("#voiceReviewBtn");
    const executeBtn = dialog.querySelector("#voiceExecuteBtn");
    const summary = dialog.querySelector("#voiceSummary");
    const listenStatus = dialog.querySelector("#voiceListenStatus");
    const reviewStatus = dialog.querySelector("#voiceReviewStatus");
    const notify = options.showMessage ?? showToast;
    let currentCommand = null;
    let executing = false;
    let closed = false;
    let listenStoppedByUser = false;
    let lastExecutedHash = null;
    let listenController = null;
    let reviewController = null;
    let executeController = null;
    const safeSetText = (el, text) => {
        if (!closed)
            setText(el, text);
    };
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
        if (closed)
            return;
        closed = true;
        listenController?.abort();
        reviewController?.abort();
        executeController?.abort();
        listenController = null;
        reviewController = null;
        executeController = null;
        if (dialog.open)
            dialog.close();
        dialog.remove();
    };
    const setMode = (mode) => {
        speechTab?.classList.toggle("voice-command__tab--active", mode === "speech");
        typeTab?.classList.toggle("voice-command__tab--active", mode === "type");
        if (speechPanel)
            speechPanel.hidden = mode !== "speech";
        safeSetText(listenStatus, "");
    };
    const applyResolved = (resolved) => {
        if (closed)
            return;
        currentCommand = resolved;
        safeSetText(summary, resolved.summary);
        if (summary)
            summary.hidden = false;
        if (executeBtn) {
            executeBtn.disabled = false;
            executeBtn.textContent = resolved.confirmLabel;
            executeBtn.classList.toggle("btn--danger", resolved.danger);
        }
        safeSetText(reviewStatus, "");
    };
    const reviewTranscript = async () => {
        reviewController?.abort();
        const controller = new AbortController();
        reviewController = controller;
        clearResolved();
        const value = transcript?.value.trim() ?? "";
        safeSetText(reviewStatus, "Reviewing...");
        try {
            const resolved = await parseAndResolveCommand(value, options, controller.signal);
            if (closed || controller.signal.aborted || reviewController !== controller)
                return;
            if (isCommandFailure(resolved)) {
                safeSetText(reviewStatus, resolved.message);
                return;
            }
            applyResolved(resolved.value);
        }
        finally {
            if (reviewController === controller)
                reviewController = null;
        }
    };
    speechTab?.addEventListener("click", () => setMode("speech"));
    typeTab?.addEventListener("click", () => setMode("type"));
    closeBtn?.addEventListener("click", close);
    cancelBtn?.addEventListener("click", close);
    dialog.addEventListener("voice-command:close", close);
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog)
            close();
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
        listenController?.abort();
        reviewController?.abort();
        clearResolved();
        listenStoppedByUser = false;
        const controller = new AbortController();
        listenController = controller;
        safeSetText(listenStatus, "Listening...");
        if (listenBtn)
            listenBtn.disabled = true;
        if (stopBtn)
            stopBtn.disabled = false;
        try {
            const speech = await startOneShotRecognition({ signal: controller.signal });
            if (closed || controller.signal.aborted || listenController !== controller)
                return;
            const parsed = await parseAlternatives(speech.alternatives, options, controller.signal);
            if (closed || controller.signal.aborted || listenController !== controller)
                return;
            if (isCommandFailure(parsed)) {
                if (transcript && speech.alternatives[0])
                    transcript.value = speech.alternatives[0];
                safeSetText(listenStatus, parsed.message);
                return;
            }
            if (transcript)
                transcript.value = parsed.value.transcript;
            applyResolved(parsed.value.resolved);
            safeSetText(listenStatus, "Ready");
        }
        catch (err) {
            if (!closed && !controller.signal.aborted) {
                safeSetText(listenStatus, err?.message || "Speech recognition failed.");
            }
            else if (!closed && listenStoppedByUser) {
                safeSetText(listenStatus, "Stopped");
            }
        }
        finally {
            if (listenController === controller)
                listenController = null;
            if (!closed) {
                if (listenBtn)
                    listenBtn.disabled = false;
                if (stopBtn)
                    stopBtn.disabled = true;
            }
        }
    });
    stopBtn?.addEventListener("click", () => {
        listenStoppedByUser = true;
        listenController?.abort();
        listenController = null;
        safeSetText(listenStatus, "Stopped");
    });
    form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (executing || !currentCommand || !executeBtn)
            return;
        const reviewedCommand = currentCommand;
        const reviewedHash = commandHash(reviewedCommand);
        if (reviewedHash === lastExecutedHash) {
            safeSetText(reviewStatus, "This command already ran.");
            return;
        }
        executeController?.abort();
        const controller = new AbortController();
        executeController = controller;
        executing = true;
        executeBtn.disabled = true;
        safeSetText(reviewStatus, "Running...");
        try {
            const value = transcript?.value.trim() ?? "";
            const resolved = await parseAndResolveCommand(value, options, controller.signal);
            if (closed || controller.signal.aborted || executeController !== controller)
                return;
            if (isCommandFailure(resolved)) {
                safeSetText(reviewStatus, resolved.message);
                executeBtn.disabled = false;
                return;
            }
            const nextHash = commandHash(resolved.value);
            if (nextHash !== reviewedHash) {
                clearResolved();
                safeSetText(reviewStatus, "Command changed. Review again before running.");
                return;
            }
            await executeCommandIR(resolved.value.ir, {
                refreshBoard: options.refreshBoard,
                recordMutation: options.recordMutation,
                signal: controller.signal,
            });
            if (closed || controller.signal.aborted || executeController !== controller)
                return;
            lastExecutedHash = nextHash;
            notify("Command complete");
            close();
        }
        catch (err) {
            if (!closed && !controller.signal.aborted) {
                safeSetText(reviewStatus, err?.message || "Command failed.");
                executeBtn.disabled = false;
            }
        }
        finally {
            if (executeController === controller)
                executeController = null;
            executing = false;
        }
    });
    setMode("speech");
    dialog.showModal();
    transcript?.focus();
}
