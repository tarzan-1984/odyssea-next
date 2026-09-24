import {
	driverNeedsLoadDispatchTermsAcceptance,
	getLoadDispatchTermsUiState,
	isLoadDispatchTermsSystemMessage,
} from "../loadDispatchTerms";

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

const driverText = {
	senderId: driverId,
	isSystemMessage: false,
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

	it("does not show Accept when the only system message is proximity", () => {
		const state = getLoadDispatchTermsUiState({
			...base,
			messages: [driverText, proximityMessage],
		});
		expect(state).toEqual({ hideComposer: false, showAcceptButton: false });
		expect(
			driverNeedsLoadDispatchTermsAcceptance({
				...base,
				messages: [proximityMessage],
			})
		).toBe(false);
	});

	it("hides composer without Accept while history is loading and last message is proximity", () => {
		expect(
			getLoadDispatchTermsUiState({
				...base,
				messages: [proximityMessage],
				messagesReady: false,
			})
		).toEqual({ hideComposer: true, showAcceptButton: false });
	});

	it("shows Accept for a new LOAD chat with a dispatch system message", () => {
		expect(
			getLoadDispatchTermsUiState({
				...base,
				messages: [dispatchMessage],
			})
		).toEqual({ hideComposer: true, showAcceptButton: true });
	});

	it("keeps composer hidden but can show Accept before history loads if last message is dispatch", () => {
		expect(
			getLoadDispatchTermsUiState({
				...base,
				messages: [dispatchMessage],
				messagesReady: false,
			})
		).toEqual({ hideComposer: true, showAcceptButton: true });
	});

	it("does not show Accept after the driver already sent a message", () => {
		expect(
			getLoadDispatchTermsUiState({
				...base,
				messages: [dispatchMessage, driverText, proximityMessage],
			})
		).toEqual({ hideComposer: false, showAcceptButton: false });
	});

	it("enforces the gate on web without an app version", () => {
		expect(
			getLoadDispatchTermsUiState({
				isDriver: true,
				chatType: "LOAD",
				currentUserId: driverId,
				skipAppVersionCheck: true,
				messages: [dispatchMessage],
			})
		).toEqual({ hideComposer: true, showAcceptButton: true });
	});
});
