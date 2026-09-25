import { useCallback, useSyncExternalStore } from "react";

const DRAFT_STORAGE_KEY = "odyssea_chat_compose_drafts_v1";

export type ChatComposeDraftMap = Record<string, string>;

type Listener = () => void;

const EMPTY_DRAFTS: ChatComposeDraftMap = Object.freeze({});

class ChatComposeDraftService {
	private listeners = new Set<Listener>();
	private snapshot: ChatComposeDraftMap = EMPTY_DRAFTS;
	private hydrated = false;

	subscribe = (listener: Listener): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	private notify(): void {
		this.listeners.forEach(listener => listener());
	}

	private readFromStorage(): ChatComposeDraftMap {
		if (typeof window === "undefined") return EMPTY_DRAFTS;
		try {
			const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
			if (!raw) return EMPTY_DRAFTS;
			const parsed: unknown = JSON.parse(raw);
			if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
				return EMPTY_DRAFTS;
			}
			const next: ChatComposeDraftMap = {};
			for (const [chatRoomId, content] of Object.entries(parsed)) {
				if (typeof content === "string" && content.trim()) {
					next[chatRoomId] = content;
				}
			}
			return Object.keys(next).length > 0 ? next : EMPTY_DRAFTS;
		} catch {
			return EMPTY_DRAFTS;
		}
	}

	private ensureHydrated(): void {
		if (this.hydrated) return;
		this.hydrated = true;
		this.snapshot = this.readFromStorage();
	}

	getSnapshot = (): ChatComposeDraftMap => {
		this.ensureHydrated();
		return this.snapshot;
	};

	get(chatRoomId: string): string {
		if (!chatRoomId) return "";
		return this.getSnapshot()[chatRoomId] ?? "";
	}

	has(chatRoomId: string): boolean {
		return Boolean(this.get(chatRoomId).trim());
	}

	set(chatRoomId: string, content: string): void {
		if (!chatRoomId || typeof window === "undefined") return;
		this.ensureHydrated();
		const trimmed = content.trim();
		if (!trimmed) {
			this.clear(chatRoomId);
			return;
		}
		if (this.snapshot[chatRoomId] === content) return;
		const next: ChatComposeDraftMap = { ...this.snapshot, [chatRoomId]: content };
		this.snapshot = next;
		window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(next));
		this.notify();
	}

	clear(chatRoomId: string): void {
		if (!chatRoomId || typeof window === "undefined") return;
		this.ensureHydrated();
		if (!(chatRoomId in this.snapshot)) return;
		const next: ChatComposeDraftMap = { ...this.snapshot };
		delete next[chatRoomId];
		this.snapshot = Object.keys(next).length > 0 ? next : EMPTY_DRAFTS;
		if (this.snapshot === EMPTY_DRAFTS) {
			window.localStorage.removeItem(DRAFT_STORAGE_KEY);
		} else {
			window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(next));
		}
		this.notify();
	}

	clearAll(): void {
		if (typeof window === "undefined") return;
		this.ensureHydrated();
		if (this.snapshot === EMPTY_DRAFTS) return;
		this.snapshot = EMPTY_DRAFTS;
		window.localStorage.removeItem(DRAFT_STORAGE_KEY);
		this.notify();
	}
}

export const chatComposeDraftService = new ChatComposeDraftService();

/** Reactive draft text for a single chat room (list / compose). */
export function useChatComposeDraft(chatRoomId: string | undefined): string {
	const getSnapshot = useCallback(() => {
		if (!chatRoomId) return "";
		return chatComposeDraftService.get(chatRoomId);
	}, [chatRoomId]);

	return useSyncExternalStore(
		chatComposeDraftService.subscribe,
		getSnapshot,
		() => ""
	);
}
