import "@testing-library/jest-dom";

// Mock Next.js router
jest.mock("next/navigation", () => ({
	useRouter: () => ({
		push: jest.fn(),
		replace: jest.fn(),
		back: jest.fn(),
		forward: jest.fn(),
		refresh: jest.fn(),
		prefetch: jest.fn(),
	}),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "",
}));

// Mock Next.js Link component
jest.mock("next/link", () => {
	return ({ children, href, ...props }) => {
		return (
			<a href={href} {...props}>
				{children}
			</a>
		);
	};
});

// Mock js-cookie
jest.mock("js-cookie", () => ({
	get: jest.fn(),
	set: jest.fn(),
	remove: jest.fn(),
}));

// Mock localStorage
const localStorageMock = {
	getItem: jest.fn(),
	setItem: jest.fn(),
	removeItem: jest.fn(),
	clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock fetch
global.fetch = jest.fn();

// Mock Response for Node.js environment
if (typeof global.Response === "undefined") {
	global.Response = class Response {
		constructor(body, init) {
			this.body = body;
			this.status = init?.status || 200;
			this.statusText = init?.statusText || "OK";
			this.headers = init?.headers || {};
		}

		json() {
			return Promise.resolve(JSON.parse(this.body));
		}

		text() {
			return Promise.resolve(this.body);
		}
	};
}

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: jest.fn().mockImplementation(query => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: jest.fn(), // deprecated
		removeListener: jest.fn(), // deprecated
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
		dispatchEvent: jest.fn(),
	})),
});
