export type ChatMentionCandidate = {
	id: string;
	name: string;
	firstName: string;
	lastName: string;
	avatar?: string | null;
	profilePhoto?: string | null;
	userColor?: string | null;
	role?: string | null;
};

export type ChatMentionMatch = {
	start: number;
	end: number;
	name: string;
};

export type ChatMentionQuery = {
	start: number;
	query: string;
};

type MentionParticipantLike = {
	hideParticipant?: boolean;
	userId?: string;
	user?: {
		id?: string;
		firstName?: string | null;
		lastName?: string | null;
		avatar?: string | null;
		profilePhoto?: string | null;
		userColor?: string | null;
		role?: string | null;
	} | null;
};

const MENTION_CLASS = "chat-mention";

export function getChatMentionClassName(): string {
	return MENTION_CLASS;
}

export function formatMentionName(
	user?: Pick<MentionParticipantLike["user"] & object, "firstName" | "lastName"> | null
): string {
	if (!user) return "";
	return [user.firstName, user.lastName]
		.map(part => (part == null ? "" : String(part).trim()))
		.filter(Boolean)
		.join(" ")
		.trim();
}

export function buildMentionCandidates(
	participants: MentionParticipantLike[] | null | undefined
): ChatMentionCandidate[] {
	if (!participants?.length) return [];

	const seen = new Set<string>();
	const candidates: ChatMentionCandidate[] = [];

	for (const participant of participants) {
		if (participant.hideParticipant === true) continue;
		const user = participant.user;
		const id = user?.id || participant.userId || "";
		const name = formatMentionName(user);
		if (!id || !name || seen.has(id)) continue;
		seen.add(id);
		candidates.push({
			id,
			name,
			firstName: String(user?.firstName ?? "").trim(),
			lastName: String(user?.lastName ?? "").trim(),
			avatar: user?.avatar ?? null,
			profilePhoto: user?.profilePhoto ?? null,
			userColor: user?.userColor ?? null,
			role: user?.role ?? null,
		});
	}

	candidates.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
	return candidates;
}

export function mentionNamesFromCandidates(candidates: ChatMentionCandidate[]): string[] {
	const names = [...new Set(candidates.map(candidate => candidate.name).filter(Boolean))];
	names.sort((a, b) => b.length - a.length || a.localeCompare(b));
	return names;
}

function isWordChar(char: string | undefined): boolean {
	if (!char) return false;
	return /[A-Za-z0-9._]/.test(char);
}

export function canStartMentionAt(text: string, atIndex: number): boolean {
	if (atIndex < 0 || atIndex >= text.length || text[atIndex] !== "@") return false;
	if (atIndex === 0) return true;
	return !isWordChar(text[atIndex - 1]);
}

function isCompleteMentionBoundary(char: string | undefined): boolean {
	if (char == null || char === "") return true;
	return !/[A-Za-z0-9]/.test(char);
}

export function findMentionMatches(text: string, names: string[]): ChatMentionMatch[] {
	if (!text || names.length === 0) return [];

	const sortedNames = [...names]
		.filter(Boolean)
		.sort((a, b) => b.length - a.length || a.localeCompare(b));
	const matches: ChatMentionMatch[] = [];
	let index = 0;

	while (index < text.length) {
		if (text[index] === "@" && canStartMentionAt(text, index)) {
			const after = text.slice(index + 1);
			const matchedName = sortedNames.find(name => {
				if (after.length < name.length) return false;
				if (after.slice(0, name.length).toLowerCase() !== name.toLowerCase()) {
					return false;
				}
				return isCompleteMentionBoundary(after[name.length]);
			});

			if (matchedName) {
				const end = index + 1 + matchedName.length;
				matches.push({
					start: index,
					end,
					name: text.slice(index + 1, end),
				});
				index = end;
				continue;
			}
		}
		index += 1;
	}

	return matches;
}

export function findMentionQueryAtCaret(
	text: string,
	caret: number,
	names: string[] = []
): ChatMentionQuery | null {
	if (caret < 0) return null;
	const safeCaret = Math.min(caret, text.length);
	const before = text.slice(0, safeCaret);
	let atIndex = -1;

	for (let i = before.length - 1; i >= 0; i -= 1) {
		if (before[i] === "\n") break;
		if (before[i] === "@" && canStartMentionAt(before, i)) {
			atIndex = i;
			break;
		}
	}

	if (atIndex < 0) return null;

	const complete = findMentionMatches(text.slice(atIndex), names).find(match => match.start === 0);
	if (complete && safeCaret >= atIndex + complete.end) {
		return null;
	}

	return {
		start: atIndex,
		query: before.slice(atIndex + 1),
	};
}

export function filterMentionCandidates(
	candidates: ChatMentionCandidate[],
	query: string
): ChatMentionCandidate[] {
	const normalized = query.replace(/\s+/g, " ").trim().toLowerCase();
	if (!normalized) return candidates;

	return candidates.filter(candidate => {
		const name = candidate.name.toLowerCase();
		if (name.startsWith(normalized) || name.includes(` ${normalized}`)) {
			return true;
		}
		const parts = name.split(/\s+/);
		return parts.some(part => part.startsWith(normalized));
	});
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function collectSkipRanges(content: string): Array<{ start: number; end: number }> {
	const ranges: Array<{ start: number; end: number }> = [];

	for (const match of content.matchAll(/\[[^\]]*]\([^)]*\)/g)) {
		const start = match.index ?? 0;
		ranges.push({ start, end: start + match[0].length });
	}

	for (let i = 0; i < content.length; i += 1) {
		if (content[i] !== "<") continue;
		const close = content.indexOf(">", i + 1);
		if (close === -1) break;
		ranges.push({ start: i, end: close + 1 });
		i = close;
	}

	return ranges;
}

function isInsideSkipRange(
	index: number,
	ranges: Array<{ start: number; end: number }>
): boolean {
	return ranges.some(range => index >= range.start && index < range.end);
}

export function wrapChatMentionsInMarkdown(content: string, names: string[]): string {
	if (!content || names.length === 0) return content;

	const matches = findMentionMatches(content, names);
	if (matches.length === 0) return content;

	const skipRanges = collectSkipRanges(content);
	let result = "";
	let lastIndex = 0;

	for (const match of matches) {
		if (
			isInsideSkipRange(match.start, skipRanges) ||
			isInsideSkipRange(match.end - 1, skipRanges)
		) {
			continue;
		}
		result += content.slice(lastIndex, match.start);
		result += `<span class="${MENTION_CLASS}">${escapeHtml(
			content.slice(match.start, match.end)
		)}</span>`;
		lastIndex = match.end;
	}

	result += content.slice(lastIndex);
	return result;
}

export function splitTextByMentions(
	text: string,
	names: string[]
): Array<{ text: string; mention: boolean }> {
	if (!text) return [];
	const matches = findMentionMatches(text, names);
	if (matches.length === 0) return [{ text, mention: false }];

	const parts: Array<{ text: string; mention: boolean }> = [];
	let lastIndex = 0;

	for (const match of matches) {
		if (match.start > lastIndex) {
			parts.push({ text: text.slice(lastIndex, match.start), mention: false });
		}
		parts.push({ text: text.slice(match.start, match.end), mention: true });
		lastIndex = match.end;
	}

	if (lastIndex < text.length) {
		parts.push({ text: text.slice(lastIndex), mention: false });
	}

	return parts;
}
