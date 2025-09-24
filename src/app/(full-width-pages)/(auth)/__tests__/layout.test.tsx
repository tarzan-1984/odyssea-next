import React from "react";
import { render, screen } from "@testing-library/react";
import AuthLayout from "../layout";

// Mock the GridShape component
jest.mock("@/components/common/GridShape", () => {
	return function MockGridShape() {
		return <div data-testid="grid-shape">Grid Shape Component</div>;
	};
});

// Mock the ThemeContext
jest.mock("@/context/ThemeContext", () => ({
	ThemeProvider: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="theme-provider">{children}</div>
	),
}));

describe("AuthLayout", () => {
	it("renders the auth layout correctly", () => {
		render(
			<AuthLayout>
				<div>Test Content</div>
			</AuthLayout>
		);

		// Check if layout structure is rendered
		expect(screen.getByTestId("theme-provider")).toBeInTheDocument();
		expect(screen.getByTestId("grid-shape")).toBeInTheDocument();

		// Check if children content is rendered
		expect(screen.getByText("Test Content")).toBeInTheDocument();
	});

	it("renders the Odysseia logo and branding", () => {
		render(
			<AuthLayout>
				<div>Test Content</div>
			</AuthLayout>
		);

		// Check if logo text is rendered
		expect(screen.getByText("Odysseia")).toBeInTheDocument();

		// Check if branding text is rendered
		expect(
			screen.getByText(/Odysseia Inc is a trustworthy North-American carrier company/)
		).toBeInTheDocument();
		expect(
			screen.getByText(/which is dedicated to its values We care. br We move. We deliver/)
		).toBeInTheDocument();
	});

	it("has correct CSS classes for responsive design", () => {
		render(
			<AuthLayout>
				<div>Test Content</div>
			</AuthLayout>
		);

		const mainContainer = screen.getByText("Test Content").closest("div");
		const rightPanel = screen.getByText("Odysseia").closest("div");

		// Check if main container has correct classes
		expect(mainContainer).toHaveClass(
			"relative",
			"flex",
			"lg:flex-row",
			"w-full",
			"h-screen",
			"justify-center",
			"flex-col"
		);

		// Check if right panel has correct classes
		expect(rightPanel?.parentElement).toHaveClass(
			"lg:w-1/2",
			"w-full",
			"h-full",
			"bg-brand-950",
			"dark:bg-white/5",
			"lg:grid",
			"items-center",
			"hidden"
		);
	});

	it("has proper dark mode support", () => {
		render(
			<AuthLayout>
				<div>Test Content</div>
			</AuthLayout>
		);

		const mainContainer = screen.getByText("Test Content").closest("div");
		const rightPanel = screen.getByText("Odysseia").closest("div");

		// Check if dark mode classes are applied
		expect(mainContainer?.parentElement).toHaveClass("dark:bg-gray-900");
		expect(rightPanel?.parentElement).toHaveClass("dark:bg-white/5");
	});

	it("renders the logo as a link to home page", () => {
		render(
			<AuthLayout>
				<div>Test Content</div>
			</AuthLayout>
		);

		const logoLink = screen.getByText("Odysseia").closest("a");

		// Check if logo is wrapped in a link
		expect(logoLink).toBeInTheDocument();
		expect(logoLink).toHaveAttribute("href", "/");
	});

	it("has proper z-index and positioning", () => {
		render(
			<AuthLayout>
				<div>Test Content</div>
			</AuthLayout>
		);

		const mainContainer = screen.getByText("Test Content").closest("div");
		const rightPanel = screen.getByText("Odysseia").closest("div");

		// Check if z-index classes are applied
		expect(mainContainer?.parentElement).toHaveClass("z-1");
		expect(rightPanel?.parentElement).toHaveClass("z-1");
	});

	it("renders with proper padding and spacing", () => {
		render(
			<AuthLayout>
				<div>Test Content</div>
			</AuthLayout>
		);

		const outerContainer = screen.getByText("Test Content").closest("div")?.parentElement;

		// Check if padding classes are applied
		expect(outerContainer).toHaveClass("p-6", "sm:p-0");
	});

	it("has proper background colors", () => {
		render(
			<AuthLayout>
				<div>Test Content</div>
			</AuthLayout>
		);

		const outerContainer = screen.getByText("Test Content").closest("div")?.parentElement;
		const rightPanel = screen.getByText("Odysseia").closest("div");

		// Check if background colors are applied
		expect(outerContainer).toHaveClass("bg-white");
		expect(rightPanel?.parentElement).toHaveClass("bg-brand-950");
	});

	it("renders GridShape component in the right panel", () => {
		render(
			<AuthLayout>
				<div>Test Content</div>
			</AuthLayout>
		);

		// Check if GridShape component is rendered
		expect(screen.getByTestId("grid-shape")).toBeInTheDocument();
		expect(screen.getByText("Grid Shape Component")).toBeInTheDocument();
	});

	it("has proper text styling for branding text", () => {
		render(
			<AuthLayout>
				<div>Test Content</div>
			</AuthLayout>
		);

		const logoText = screen.getByText("Odysseia");
		const brandingText = screen.getByText(
			/Odysseia Inc is a trustworthy North-American carrier company/
		);

		// Check if text styling classes are applied
		expect(logoText).toHaveClass("text-white", "text-2xl");
		expect(brandingText).toHaveClass("text-center", "text-gray-400", "dark:text-white/60");
	});

	it("renders children content in the left panel", () => {
		render(
			<AuthLayout>
				<div data-testid="auth-form">Authentication Form</div>
			</AuthLayout>
		);

		// Check if children content is rendered in the left panel
		expect(screen.getByTestId("auth-form")).toBeInTheDocument();
		expect(screen.getByText("Authentication Form")).toBeInTheDocument();
	});
});
