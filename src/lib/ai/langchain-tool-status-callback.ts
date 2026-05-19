/**
 * LangChain callback that maps tool start events to application status phases.
 *
 * @author Lukas Alber
 */

import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { Serialized } from "@langchain/core/load/serializable";

/**
 * Emits {@link onStatus} when a bound tool run starts, using {@link toolToStatus} for the name.
 */
export class LangChainToolStatusCallback<S extends string> extends BaseCallbackHandler {
  name = "LangChainToolStatusCallback";

  constructor(
    private readonly onStatus: (status: S) => void,
    private readonly toolToStatus: Record<string, S>,
    /** When set, emitted at the start of each chat-model run (e.g. ReAct turns). */
    private readonly llmStartStatus?: S
  ) {
    super();
  }

  async handleChatModelStart() {
    if (this.llmStartStatus !== undefined) {
      this.onStatus(this.llmStartStatus);
    }
  }

  async handleToolStart(
    tool: Serialized,
    _input: string,
    _runId?: string,
    _parentRunId?: string,
    _tags?: string[],
    _metadata?: Record<string, unknown>,
    runName?: string
  ) {
    const name =
      runName ??
      (tool && "kwargs" in tool ? (tool.kwargs?.name as string | undefined) : undefined);
    const status = name ? this.toolToStatus[name] : undefined;
    if (status) this.onStatus(status);
  }
}
