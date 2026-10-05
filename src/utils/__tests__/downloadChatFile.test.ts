import { loadReferenceDownloadFilename } from "../downloadChatFile";

describe("loadReferenceDownloadFilename", () => {
	it("uses the load reference number and the original extension", () => {
		expect(loadReferenceDownloadFilename("0751671", "photo_1791044036301.jpg")).toBe(
			"0751671.jpg"
		);
		expect(loadReferenceDownloadFilename(" LD0124117 ", "bol.pdf")).toBe("LD0124117.pdf");
		expect(loadReferenceDownloadFilename("S4329183", "scan.PNG")).toBe("S4329183.png");
	});

	it("saves HEIC as jpeg and edited pages as pdf", () => {
		expect(
			loadReferenceDownloadFilename("836295", "IMG.HEIC", "https://cdn.example/IMG.HEIC")
		).toBe("836295.jpg");
		expect(
			loadReferenceDownloadFilename("1095", "photo_1791044036301.jpg", undefined, {
				forcePdf: true,
			})
		).toBe("1095.pdf");
	});

	it("returns null outside load chats", () => {
		expect(loadReferenceDownloadFilename(null, "file.pdf")).toBeNull();
		expect(loadReferenceDownloadFilename("   ", "file.pdf")).toBeNull();
	});
});
