import { buildTmsLoadRoutePoints, collectOrderedTmsLoadStops } from "../formatTmsLoadRoute";

describe("collectOrderedTmsLoadStops", () => {
	it("orders mixed pickup and delivery stops by date + time_start", () => {
		const pickups = [
			{
				type: "pick_up_location",
				address: "840 N. Russell Ave., Aurora, IL 60506",
				date: "2026-07-14 08:00:00",
				time_start: "08:00",
			},
			{
				type: "pick_up_location",
				address: "100 Extra Stop Rd, Nashville, TN 37201",
				date: "2026-07-14 14:00:00",
				time_start: "14:00",
			},
		];
		const deliveries = [
			{
				type: "delivery_location",
				address: "800 N. Adams Street, Monon, IN 47959",
				date: "2026-07-14 10:00:00",
				time_start: "10:00",
			},
			{
				type: "delivery_location",
				address: "1 Harbor St, Savannah, GA 31401",
				date: "2026-07-14 18:00:00",
				time_start: "18:00",
			},
		];

		const ordered = collectOrderedTmsLoadStops(pickups, deliveries);

		expect(ordered.map(stop => stop.loc.address)).toEqual([
			"840 N. Russell Ave., Aurora, IL 60506",
			"800 N. Adams Street, Monon, IN 47959",
			"100 Extra Stop Rd, Nashville, TN 37201",
			"1 Harbor St, Savannah, GA 31401",
		]);
		expect(ordered.map(stop => stop.type)).toEqual([
			"pick_up_location",
			"delivery_location",
			"pick_up_location",
			"delivery_location",
		]);
	});

	it("uses time_start over the clock embedded in date", () => {
		const pickups = [
			{
				type: "pick_up_location",
				address: "First PU, Chicago, IL",
				date: "2026-07-14 00:00:00",
				time_start: "08:00",
			},
		];
		const deliveries = [
			{
				type: "delivery_location",
				address: "Early DEL, Indianapolis, IN",
				date: "2026-07-14 00:00:00",
				time_start: "09:30",
			},
			{
				type: "delivery_location",
				address: "Late DEL, Columbus, OH",
				date: "2026-07-14 00:00:00",
				time_start: "16:00",
			},
		];

		const ordered = collectOrderedTmsLoadStops(JSON.stringify(pickups), JSON.stringify(deliveries));

		expect(ordered.map(stop => stop.loc.address)).toEqual([
			"First PU, Chicago, IL",
			"Early DEL, Indianapolis, IN",
			"Late DEL, Columbus, OH",
		]);
	});

	it("keeps same-day pickup before a delivery window that opens earlier", () => {
		const pickups = [
			{
				type: "pick_up_location",
				address: "East 68th ave 26100 suite 170, Aurora, CO 80019",
				date: "2026-09-17 08:30:00",
				time_start: "08:30",
			},
		];
		const deliveries = [
			{
				type: "delivery_location",
				address: "14255 E US 160 Hwy, Satanta, KS 67870",
				date: "2026-09-17 08:00:00",
				time_start: "08:00",
				time_end: "16:00",
			},
		];

		const ordered = collectOrderedTmsLoadStops(pickups, deliveries);

		expect(ordered.map(stop => stop.type)).toEqual([
			"pick_up_location",
			"delivery_location",
		]);
		expect(ordered.map(stop => stop.loc.address)).toEqual([
			"East 68th ave 26100 suite 170, Aurora, CO 80019",
			"14255 E US 160 Hwy, Satanta, KS 67870",
		]);
	});

	it("keeps pickups before deliveries when appointment times are missing", () => {
		const pickups = [{ type: "pick_up_location", address: "PU, St Louis, MO" }];
		const deliveries = [
			{ type: "delivery_location", address: "DEL A, Charleston, WV" },
			{ type: "delivery_location", address: "DEL B, Savannah, GA" },
		];

		const ordered = collectOrderedTmsLoadStops(pickups, deliveries);

		expect(ordered.map(stop => stop.loc.address)).toEqual([
			"PU, St Louis, MO",
			"DEL A, Charleston, WV",
			"DEL B, Savannah, GA",
		]);
	});
});

describe("buildTmsLoadRoutePoints", () => {
	it("keeps chronological order in the tracking route list", () => {
		const points = buildTmsLoadRoutePoints(
			[
				{
					type: "pick_up_location",
					address: "840 N. Russell Ave., Aurora, IL 60506",
					date: "2026-07-14 08:00:00",
					time_start: "08:00",
				},
			],
			[
				{
					type: "delivery_location",
					address: "1 Harbor St, Savannah, GA 31401",
					date: "2026-07-14 18:00:00",
					time_start: "18:00",
				},
				{
					type: "delivery_location",
					address: "800 N. Adams Street, Monon, IN 47959",
					date: "2026-07-14 10:00:00",
					time_start: "10:00",
				},
			]
		);

		expect(points.map(point => point.location)).toEqual([
			"Aurora, IL 60506",
			"Monon, IN 47959",
			"Savannah, GA 31401",
		]);
		expect(points.map(point => point.label)).toEqual([
			"Pick up",
			"1st Delivery",
			"2nd Delivery",
		]);
	});
});
