import { newNote, personalError, PersonalError, type Note, type PersonalData,
  type PersonalBackup, type PersonalRepository } from "@/domain/personal";

export type Draft = { note: Note; generation: string | null; expectedVersion: number; dirty: boolean };
type Snapshot = {
  status: "loading" | "ready" | "error"; data: PersonalData | null; issue: string | null; busy: boolean;
  draft: Draft | null; saveStatus: "idle" | "editing" | "saving" | "saved" | "error" | "conflict"; saveIssue: string | null;
};
const initial: Snapshot = { status: "loading", data: null, issue: null, busy: false,
  draft: null, saveStatus: "idle", saveIssue: null };

export class PersonalStore {
  private snapshot: Snapshot = initial;
  private listeners = new Set<() => void>();
  private repository: PersonalRepository;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<boolean> | null = null;
  private edits = 0;
  private pending = 0;
  private selecting = false;
  private active = false;
  private channel: BroadcastChannel | null = null;
  private guarded = false;
  constructor(repository: PersonalRepository) { this.repository = repository; }
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => initial;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    const guard = this.active && (this.snapshot.draft?.dirty === true || this.snapshot.busy);
    if (guard !== this.guarded) {
      this.guarded = guard;
      if (guard) window.addEventListener("beforeunload", this.beforeUnload);
      else window.removeEventListener("beforeunload", this.beforeUnload);
    }
    this.listeners.forEach((listener) => listener());
  }
  private beforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault(); event.returnValue = "";
  };
  private navigation = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest("a[href]")) void this.flush();
  };
  private leaving = () => { void this.flush(); };
  private visible = () => {
    if (document.visibilityState === "visible") void this.refresh();
    else void this.flush();
  };
  private focused = () => { void this.refresh(); };
  start() {
    this.active = true;
    try { this.channel = new BroadcastChannel("stocklab-personal-v1"); this.channel.onmessage = this.focused; }
    catch { this.channel = null; }
    window.addEventListener("focus", this.focused);
    window.addEventListener("popstate", this.leaving);
    document.addEventListener("visibilitychange", this.visible);
    document.addEventListener("click", this.navigation, true);
    this.publish({});
    void this.refresh();
    return () => {
      this.active = false;
      this.channel?.close(); this.channel = null;
      window.removeEventListener("focus", this.focused);
      window.removeEventListener("popstate", this.leaving);
      document.removeEventListener("visibilitychange", this.visible);
      document.removeEventListener("click", this.navigation, true);
      window.removeEventListener("beforeunload", this.beforeUnload); this.guarded = false;
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
    };
  }
  private accept(data: PersonalData) {
    const previous = this.snapshot.data;
    if (previous?.generation === data.generation && previous.revision > data.revision) return;
    let draft = this.snapshot.draft;
    if (draft && !draft.dirty) {
      const draftId = draft.note.id;
      const note = data.notes.find((item) => item.id === draftId);
      draft = note ? { note, expectedVersion: note.version, generation: data.generation, dirty: false } : null;
    }
    this.publish({ data, status: "ready", issue: null, draft });
  }
  async refresh() {
    try { this.accept(await this.repository.load()); return true; }
    catch (error) { this.publish({ status: "error", issue: personalError(error).message }); return false; }
  }
  private announce() { try { this.channel?.postMessage("changed"); } catch { /* Focus refresh is the fallback. */ } }
  private async operation(action: () => Promise<PersonalData>) {
    this.pending++; this.publish({ busy: true, issue: null });
    try { this.accept(await action()); this.announce(); return true; }
    catch (error) {
      if (personalError(error).code === "conflict") await this.refresh();
      this.publish({ issue: personalError(error).message }); return false;
    } finally { this.pending--; this.publish({ busy: this.pending > 0 }); }
  }
  setWatchlist(symbols: string[]) {
    const data = this.snapshot.data;
    if (!data || this.snapshot.busy) return Promise.resolve(false);
    return this.operation(() => this.repository.setWatchlist(symbols, data.generation, data.watchVersion));
  }
  private async selectDraft(action: () => Promise<boolean>) {
    if (this.selecting || this.snapshot.busy) return false;
    this.selecting = true; this.pending++; this.publish({ busy: true });
    try { return await action(); }
    finally { this.selecting = false; this.pending--; this.publish({ busy: this.pending > 0 }); }
  }
  async create(symbol: string) {
    return this.selectDraft(async () => {
      if (!(await this.flush())) return false;
      const note = newNote(symbol);
      this.edits++;
      this.publish({ draft: { note, generation: this.snapshot.data?.generation ?? null, expectedVersion: 0, dirty: true },
        saveStatus: "editing", saveIssue: null });
      this.schedule(); return true;
    });
  }
  async open(id: string) {
    return this.selectDraft(async () => {
      if (this.snapshot.draft?.note.id === id) return true;
      if (!(await this.flush()) || !(await this.refresh())) return false;
      const data = this.snapshot.data!;
      const note = data.notes.find((item) => item.id === id);
      if (!note) { this.publish({ issue: "이 노트가 다른 탭에서 삭제되었습니다." }); return false; }
      this.edits++;
      this.publish({ draft: { note, generation: data.generation, expectedVersion: note.version, dirty: false }, saveStatus: "saved", saveIssue: null });
      return true;
    });
  }
  update(patch: Partial<Pick<Note, "symbol" | "title" | "thesis" | "evidence" | "risks" | "review" | "checklist">>) {
    const draft = this.snapshot.draft;
    if (!draft || this.snapshot.busy) return;
    this.edits++;
    const conflict = this.snapshot.saveStatus === "conflict";
    this.publish({ draft: { ...draft, note: { ...draft.note, ...patch }, dirty: true },
      saveStatus: conflict ? "conflict" : "editing", saveIssue: conflict ? this.snapshot.saveIssue : null });
    if (!conflict) this.schedule();
  }
  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, 600);
  }
  flush = (): Promise<boolean> => {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.saving) return this.saving;
    if (!this.snapshot.draft?.dirty) return Promise.resolve(true);
    if (this.snapshot.saveStatus === "conflict") return Promise.resolve(false);
    this.saving = this.saveLoop().finally(() => { this.saving = null; });
    return this.saving;
  };
  private async saveLoop(): Promise<boolean> {
    while (this.snapshot.draft?.dirty) {
      const draft = this.snapshot.draft;
      const edit = this.edits;
      this.publish({ saveStatus: "saving", saveIssue: null });
      try {
        if (!draft.note.title.trim()) throw new PersonalError("invalid");
        const generation = draft.generation ?? (await this.repository.load()).generation;
        const data = await this.repository.saveNote(draft.note, generation, draft.expectedVersion);
        this.accept(data); this.announce();
        const current = this.snapshot.draft;
        if (!current || current.note.id !== draft.note.id) return false;
        const saved = data.notes.find((item) => item.id === draft.note.id)!;
        const dirty = this.edits !== edit;
        this.publish({ draft: { note: dirty ? { ...current.note, version: saved.version, updatedAt: saved.updatedAt } : saved,
          generation: data.generation, expectedVersion: saved.version, dirty }, saveStatus: dirty ? "editing" : "saved", saveIssue: null });
      } catch (error) {
        const failure = personalError(error);
        if (failure.code === "conflict") await this.refresh();
        this.publish({ saveStatus: failure.code === "conflict" ? "conflict" : "error", saveIssue: failure.message });
        return false;
      }
    }
    return true;
  }
  async loadLatest() {
    return this.selectDraft(async () => {
      if (this.saving || !(await this.refresh())) return false;
      const data = this.snapshot.data!;
      const note = data.notes.find((item) => item.id === this.snapshot.draft?.note.id);
      this.edits++;
      this.publish({ draft: note ? { note, generation: data.generation, expectedVersion: note.version, dirty: false } : null,
        saveStatus: note ? "saved" : "idle", saveIssue: null });
      return true;
    });
  }
  async saveCopy() {
    return this.selectDraft(async () => {
      const draft = this.snapshot.draft;
      if (this.saving || !draft || !(await this.refresh())) return false;
      const note = draft.note;
      const now = new Date().toISOString();
      this.edits++;
      this.publish({ draft: { note: { ...note, id: crypto.randomUUID(), version: 0,
        title: `${note.title.slice(0, 115)} 사본`, createdAt: now, updatedAt: now },
        generation: this.snapshot.data!.generation, expectedVersion: 0, dirty: true }, saveStatus: "editing", saveIssue: null });
      return this.flush();
    });
  }
  async remove(id: string) {
    if (!(await this.flush())) return false;
    const data = this.snapshot.data;
    const note = data?.notes.find((item) => item.id === id);
    if (!data || !note) return false;
    return this.operation(() => this.repository.deleteNote(id, data.generation, note.version));
  }
  async closeDraft() {
    return this.selectDraft(async () => {
      if (this.saving) await this.saving;
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.edits++;
      this.publish({ draft: null, saveStatus: "idle", saveIssue: null });
      return true;
    });
  }
  importBackup(backup: PersonalBackup, expected: PersonalData) {
    if (this.snapshot.draft?.dirty || this.snapshot.busy) return Promise.resolve(false);
    return this.operation(() => this.repository.importBackup(backup, expected.generation, expected.revision));
  }
  reset(expected: PersonalData) {
    if (this.snapshot.draft?.dirty || this.snapshot.busy) return Promise.resolve(false);
    return this.operation(() => this.repository.reset(expected.generation, expected.revision));
  }
}
