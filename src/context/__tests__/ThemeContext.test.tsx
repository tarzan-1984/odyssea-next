import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../ThemeContext";

// Mock localStorage
const localStorageMock = {
	getItem: jest.fn(),
	setItem: jest.fn(),
	removeItem: jest.fn(),
	clear: jest.fn(),
};
Object.defineProperty(window, "localStorage", {
	value: localStorageMock,
});

// Mock document.documentElement.classList
const mockClassList = {
	add: jest.fn(),
	remove: jest.fn(),
};
Object.defineProperty(document, "documentElement", {
	value: { classList: mockClassList },
	writable: true,
});

// Test component that uses the theme context
const TestComponent = () => {
	const { theme, toggleTheme } = useTheme();

	return (
		<div>
			<span data-testid="current-theme">Current theme: {theme}</span>
			<button onClick={toggleTheme} data-testid="toggle-theme">
				Toggle Theme
			</button>
		</div>
	);
};

describe("ThemeContext", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockClassList.add.mockClear();
		mockClassList.remove.mockClear();
	});

	describe("ThemeProvider", () => {
		it("renders children correctly", () => {
			render(
				<ThemeProvider>
					<div data-testid="test-child">Test Child</div>
				</ThemeProvider>
			);

			expect(screen.getByTestId("test-child")).toBeInTheDocument();
			expect(screen.getByText("Test Child")).toBeInTheDocument();
		});

		it("initializes with light theme by default", () => {
			localStorageMock.getItem.mockReturnValue(null);

			render(
				<ThemeProvider>
					<TestComponent />
				</ThemeProvider>
			);

			expect(screen.getByTestId("current-theme")).toHaveTextContent("Current theme: light");
		});

		it("initializes with saved theme from localStorage", () => {
			localStorageMock.getItem.mockReturnValue("dark");

			render(
				<ThemeProvider>
					<TestComponent />
				</ThemeProvider>
			);

			expect(screen.getByTestId("current-theme")).toHaveTextContent("Current theme: dark");
		});

		it("applies dark theme CSS class when theme is dark", async () => {
			localStorageMock.getItem.mockReturnValue("dark");

			render(
				<ThemeProvider>
					<TestComponent />
				</ThemeProvider>
			);

			await waitFor(() => {
				expect(mockClassList.add).toHaveBeenCalledWith("dark");
			});
		});

		it("removes dark theme CSS class when theme is light", async () => {
			localStorageMock.getItem.mockReturnValue("light");

			render(
				<ThemeProvider>
					<TestComponent />
				</ThemeProvider>
			);

			await waitFor(() => {
				expect(mockClassList.remove).toHaveBeenCalledWith("dark");
			});
		});

		it("saves theme to localStorage when theme changes", async () => {
			localStorageMock.getItem.mockReturnValue("light");

			render(
				<ThemeProvider>
					<TestComponent />
				</ThemeProvider>
			);

			const toggleButton = screen.getByTestId("toggle-theme");

			// Toggle to dark theme
			fireEvent.click(toggleButton);

			await waitFor(() => {
				expect(localStorageMock.setItem).toHaveBeenCalledWith("theme", "dark");
			});
		});
	});

	describe("useTheme hook", () => {
		it("throws error when used outside ThemeProvider", () => {
			// Suppress console.error for this test
			const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

			expect(() => {
				render(<TestComponent />);
			}).toThrow("useTheme must be used within a ThemeProvider");

			consoleSpy.mockRestore();
		});

		it("provides current theme value", () => {
			localStorageMock.getItem.mockReturnValue("dark");

			render(
				<ThemeProvider>
					<TestComponent />
				</ThemeProvider>
			);

			expect(screen.getByTestId("current-theme")).toHaveTextContent("Current theme: dark");
		});

		it("toggles theme from light to dark", async () => {
			localStorageMock.getItem.mockReturnValue("light");

			render(
				<ThemeProvider>
					<TestComponent />
				</ThemeProvider>
			);

			const toggleButton = screen.getByTestId("toggle-theme");

			// Initial theme should be light
			expect(screen.getByTestId("current-theme")).toHaveTextContent("Current theme: light");

			// Click toggle button
			fireEvent.click(toggleButton);

			// Theme should change to dark
			await waitFor(() => {
				expect(screen.getByTestId("current-theme")).toHaveTextContent(
					"Current theme: dark"
				);
			});
		});

		it("toggles theme from dark to light", async () => {
			localStorageMock.getItem.mockReturnValue("dark");

			render(
				<ThemeProvider>
					<TestComponent />
				</ThemeProvider>
			);

			const toggleButton = screen.getByTestId("toggle-theme");

			// Initial theme should be dark
			expect(screen.getByTestId("current-theme")).toHaveTextContent("Current theme: dark");

			// Click toggle button
			fireEvent.click(toggleButton);

			// Theme should change to light
			await waitFor(() => {
				expect(screen.getByTestId("current-theme")).toHaveTextContent(
					"Current theme: light"
				);
			});
		});

		it("applies CSS classes correctly when toggling themes", async () => {
			localStorageMock.getItem.mockReturnValue("light");

			render(
				<ThemeProvider>
					<TestComponent />
				</ThemeProvider>
			);

			const toggleButton = screen.getByTestId("toggle-theme");

			// Toggle to dark theme
			fireEvent.click(toggleButton);

			await waitFor(() => {
				expect(mockClassList.add).toHaveBeenCalledWith("dark");
			});

			// Toggle back to light theme
			fireEvent.click(toggleButton);

			await waitFor(() => {
				expect(mockClassList.remove).toHaveBeenCalledWith("dark");
			});
		});
	});

	describe("Theme persistence", () => {
		it("persists theme changes across component re-renders", async () => {
			localStorageMock.getItem.mockReturnValue("light");

			const { rerender } = render(
				<ThemeProvider>
					<TestComponent />
				</ThemeProvider>
			);

			const toggleButton = screen.getByTestId("toggle-theme");

			// Toggle to dark theme
			fireEvent.click(toggleButton);

			await waitFor(() => {
				expect(screen.getByTestId("current-theme")).toHaveTextContent(
					"Current theme: dark"
				);
			});

			// Re-render the component
			rerender(
				<ThemeProvider>
					<TestComponent />
				</ThemeProvider>
			);

			// Theme should still be dark
			expect(screen.getByTestId("current-theme")).toHaveTextContent("Current theme: dark");
		});

		it("loads theme from localStorage on mount", () => {
			localStorageMock.getItem.mockReturnValue("dark");

			render(
				<ThemeProvider>
					<TestComponent />
				</ThemeProvider>
			);

			expect(localStorageMock.getItem).toHaveBeenCalledWith("theme");
			expect(screen.getByTestId("current-theme")).toHaveTextContent("Current theme: dark");
		});
	});

	describe("Edge cases", () => {
		it("handles empty string theme value from localStorage", () => {
			localStorageMock.getItem.mockReturnValue("");

			render(
				<ThemeProvider>
					<TestComponent />
				</ThemeProvider>
			);

			// Should default to light theme
			expect(screen.getByTestId("current-theme")).toHaveTextContent("Current theme: light");
		});

		it("handles null theme value from localStorage", () => {
			localStorageMock.getItem.mockReturnValue(null);

			render(
				<ThemeProvider>
					<TestComponent />
				</ThemeProvider>
			);

			// Should default to light theme
			expect(screen.getByTestId("current-theme")).toHaveTextContent("Current theme: light");
		});
	});
});
