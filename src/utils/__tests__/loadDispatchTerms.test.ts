import {
	driverNeedsLoadDispatchTermsAcceptance,
	getLoadDispatchTermsUiState,
	isLoadDispatchTermsSystemMessage,
	lockDispatchTermsAccepted,
	mergeDispatchTermsAcceptedFlag,
	resolveDispatchTermsAccepted,
	unlockDispatchTermsAccepted,
} from "../loadDispatchTerms";
import { mergeChatRoomParticipants } from "../normalizeChatParticipants";

const driverId = "driver-1";

const dispatchMessage = {
	senderId: "system",
	isSystemMessage: true,
	systemMessageKind: "load_dispatch",
};

const proximityMessage = {
	senderId: "system",
	isSystemMessage: true,
	systemMessageKind: "load_proximity",
};

describe("isLoadDispatchTermsSystemMessage", () => {
	it("accepts load_dispatch and legacy system messages without a kind", () => {
		expect(isLoadDispatchTermsSystemMessage(dispatchMessage)).toBe(true);
		expect(
			isLoadDispatchTermsSystemMessage({
				isSystemMessage: true,
				systemMessageKind: null,
			})
		).toBe(true);
	});

	it("ignores proximity, stale-location, rest-ended, and ordinary chat messages", () => {
		expect(isLoadDispatchTermsSystemMessage(proximityMessage)).toBe(false);
		expect(
			isLoadDispatchTermsSystemMessage({
				isSystemMessage: true,
				systemMessageKind: "load_stale_location",
			})
		).toBe(false);
		expect(
			isLoadDispatchTermsSystemMessage({
				isSystemMessage: true,
				systemMessageKind: "driver_rest_ended",
			})
		).toBe(false);
		expect(
			isLoadDispatchTermsSystemMessage({
				isSystemMessage: true,
				systemMessageKind: "driver_rest_updated",
			})
		).toBe(false);
		expect(
			isLoadDispatchTermsSystemMessage({
				senderId: driverId,
				isSystemMessage: false,
			})
		).toBe(false);
	});
});

describe("getLoadDispatchTermsUiState", () => {
	const base = {
		isDriver: true,
		chatType: "LOAD",
		currentUserId: driverId,
		appVersion: "2.3.7",
	};

	it("shows Accept only when the participant flag is false", () => {
		expect(
			getLoadDispatchTermsUiState({
				...base,
				dispatchTermsAccepted: false,
			})
		).toEqual({ hideComposer: true, showAcceptButton: true });
		expect(
			driverNeedsLoadDispatchTermsAcceptance({
				...base,
				dispatchTermsAccepted: false,
			})
		).toBe(true);
	});

	it("keeps the composer when the flag is true or missing", () => {
		expect(
			getLoadDispatchTermsUiState({
				...base,
				dispatchTermsAccepted: true,
			})
		).toEqual({ hideComposer: false, showAcceptButton: false });
		expect(getLoadDispatchTermsUiState(base)).toEqual({
			hideComposer: false,
			showAcceptButton: false,
		});
	});

	it("keeps the composer for a missing app version even when the flag is false", () => {
		expect(
			getLoadDispatchTermsUiState({
				...base,
				appVersion: null,
				dispatchTermsAccepted: false,
			})
		).toEqual({ hideComposer: false, showAcceptButton: false });
	});

	it("enforces the flag on web without an app version", () => {
		expect(
			getLoadDispatchTermsUiState({
				isDriver: true,
				chatType: "LOAD",
				currentUserId: driverId,
				skipAppVersionCheck: true,
				dispatchTermsAccepted: false,
			})
		).toEqual({ hideComposer: true, showAcceptButton: true });
	});

	it("replaces the offer-chat default true when the server requires acceptance", () => {
		expect(mergeDispatchTermsAcceptedFlag(true, false)).toBe(false);
		expect(
			mergeDispatchTermsAcceptedFlag(true, false, {
				chatRoomId: "room-1",
				userId: driverId,
			})
		).toBe(false);
	});

	it("keeps a just-accepted true ahead of a stale false", () => {
		lockDispatchTermsAccepted("room-1", driverId);
		expect(
			mergeDispatchTermsAcceptedFlag(true, false, {
				chatRoomId: "room-1",
				userId: driverId,
			})
		).toBe(true);
		unlockDispatchTermsAccepted("room-1", driverId);
	});

	it("lets an explicit false win over a cached offer true in participant merge", () => {
		const merged = mergeChatRoomParticipants(
			[{ userId: driverId, dispatchTermsAccepted: false, user: { id: driverId } }],
			[{ userId: driverId, dispatchTermsAccepted: true, user: { id: driverId } }],
			"room-1"
		);
		expect(merged[0]?.dispatchTermsAccepted).toBe(false);
	});

	it("shows Accept when any snapshot says the driver has not accepted", () => {
		expect(
			resolveDispatchTermsAccepted(
				[
					[{ userId: driverId, dispatchTermsAccepted: true }],
					[{ userId: driverId, dispatchTermsAccepted: false }],
				],
				driverId,
				"room-1"
			)
		).toBe(false);
	});

	it("does not gate staff or non-LOAD chats", () => {
		expect(
			getLoadDispatchTermsUiState({
				...base,
				isDriver: false,
				dispatchTermsAccepted: false,
			})
		).toEqual({ hideComposer: false, showAcceptButton: false });
		expect(
			getLoadDispatchTermsUiState({
				...base,
				chatType: "DIRECT",
				dispatchTermsAccepted: false,
			})
		).toEqual({ hideComposer: false, showAcceptButton: false });
	});
});
