import fs from "fs";
import path from "path";
import { RepoBrainState, createInitialRepoBrainState } from "../context/repo-brain.store.js";
import { RepoEvent } from "../context/repo-event.types.js";
import { RepoMemoryFile } from "../enums/repo-memory-file.enum.js";
import { ModelId } from "../enums/model.enum.js";
import { WorkUnit } from "../enums/work-unit.enum.js";

const contextPath = path.join(process.cwd(), ".cortex", "context.json");

type Listener = (state: RepoBrainState) => void;

class GlobalContextStore {
  private listeners: Listener[] = [];

  get(): RepoBrainState {
    if (!fs.existsSync(contextPath)) {
      return createInitialRepoBrainState(process.cwd());
    }

    return JSON.parse(fs.readFileSync(contextPath, "utf8"));
  }

  set(state: RepoBrainState) {
    fs.writeFileSync(contextPath, JSON.stringify(state, null, 2), "utf8");
    this.listeners.forEach((listener) => listener(state));
  }

  subscribe(listener: Listener) {
    this.listeners.push(listener);
    listener(this.get());

    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener);
    };
  }

  pushEvent(event: RepoEvent) {
    const state = this.get();

    const next = {
      ...state,
      eyes: event.targetFile === RepoMemoryFile.EYES ? [...state.eyes, event] : state.eyes,
      nose: event.targetFile === RepoMemoryFile.NOSE ? [...state.nose, event] : state.nose,
      ears: event.targetFile === RepoMemoryFile.EARS ? [...state.ears, event] : state.ears,
      hands: event.targetFile === RepoMemoryFile.HANDS ? [...state.hands, event] : state.hands,
      brain: event.targetFile === RepoMemoryFile.BRAIN ? [...state.brain, event] : state.brain
    };

    this.set(next);
  }

  setActiveWork(input: {
    directory?: string;
    file?: string;
    model?: ModelId;
    step?: WorkUnit;
  }) {
    const state = this.get();

    this.set({
      ...state,
      activeContext: {
        ...state.activeContext,
        activeDirectory: input.directory ?? state.activeContext.activeDirectory,
        activeFile: input.file ?? state.activeContext.activeFile,
        activeModel: input.model ?? state.activeContext.activeModel,
        activeStep: input.step ?? state.activeContext.activeStep
      }
    });
  }

  updateProgress(input: {
    totalFiles?: number;
    scannedFiles?: number;
    totalDirectories?: number;
    scannedDirectories?: number;
  }) {
    const state = this.get();
    const progress = {
      ...state.activeContext.progress,
      ...input
    };

    const percentComplete =
      progress.totalFiles > 0
        ? Math.round((progress.scannedFiles / progress.totalFiles) * 100)
        : 0;

    this.set({
      ...state,
      activeContext: {
        ...state.activeContext,
        progress: {
          ...progress,
          percentComplete
        }
      }
    });
  }
}

export const GlobalContext = new GlobalContextStore();
