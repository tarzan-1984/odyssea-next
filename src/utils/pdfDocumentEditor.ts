import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist";

const PDF_RENDER_SCALE = 2;
let pdfWorkerConfigured = false;

function configurePdfWorker(): void {
	if (pdfWorkerConfigured || typeof window === "undefined") return;
	GlobalWorkerOptions.workerSrc = new URL(
		"pdfjs-dist/build/pdf.worker.min.mjs",
		import.meta.url
	).toString();
	pdfWorkerConfigured = true;
}

export async function loadChatPdfBytes(fileUrl: string, fileName: string): Promise<ArrayBuffer> {
	const response = await fetch(
		`/api/storage/download?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(fileName)}`,
		{ credentials: "include", cache: "no-store" }
	);
	if (!response.ok) {
		throw new Error("Failed to load PDF");
	}
	return response.arrayBuffer();
}

export async function openPdfDocument(data: ArrayBuffer): Promise<PDFDocumentProxy> {
	configurePdfWorker();
	return getDocument({ data }).promise;
}

export async function renderPdfPageToCanvas(
	pdf: PDFDocumentProxy,
	pageNumber: number,
	renderScale = PDF_RENDER_SCALE
): Promise<HTMLCanvasElement> {
	const page = await pdf.getPage(pageNumber);
	const viewport = page.getViewport({ scale: renderScale });
	const canvas = document.createElement("canvas");
	canvas.width = Math.floor(viewport.width);
	canvas.height = Math.floor(viewport.height);
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("Canvas is not supported");
	}
	await page.render({ canvasContext: ctx, viewport }).promise;
	return canvas;
}

export function editedPdfPageFilename(fileName: string, pageNumber: number): string {
	const base = (fileName || "document").trim().replace(/\.pdf$/i, "") || "document";
	return `${base}-page${pageNumber}-edited.pdf`;
}
