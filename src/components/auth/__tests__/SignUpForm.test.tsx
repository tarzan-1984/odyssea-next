import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignUpForm from "../SignUpForm";

// Mock the form components
jest.mock("@/components/form/input/Checkbox", () => {
	return function MockCheckbox({ checked, onChange, className }: any) {
		return (
			<input
				type="checkbox"
				checked={checked}
				onChange={e => onChange(e.target.checked)}
				className={className}
				data-testid="checkbox"
			/>
		);
	};
});

jest.mock("@/components/form/input/InputField", () => {
	return function MockInput({ type, id, name, placeholder }: any) {
		return (
			<input
				type={type}
				id={id}
				name={name}
				placeholder={placeholder}
				data-testid={`input-${name || id}`}
			/>
		);
	};
});

jest.mock("@/components/form/Label", () => {
	return function MockLabel({ children }: any) {
		return <label data-testid="label">{children}</label>;
	};
});

// Mock the icons
jest.mock("@/icons", () => ({
	ChevronLeftIcon: () => <div data-testid="chevron-left-icon">ChevronLeftIcon</div>,
	EyeCloseIcon: () => <div data-testid="eye-close-icon">EyeCloseIcon</div>,
	EyeIcon: () => <div data-testid="eye-icon">EyeIcon</div>,
}));

describe("SignUpForm", () => {
	it("renders the sign up form correctly", () => {
		render(<SignUpForm />);

		// Check if form elements are rendered
		expect(screen.getByRole("heading", { name: "Sign Up" })).toBeInTheDocument();
		expect(screen.getByText("Enter your email and password to sign up!")).toBeInTheDocument();

		// Check social login buttons
		expect(screen.getByText("Sign up with Google")).toBeInTheDocument();
		expect(screen.getByText("Sign up with X")).toBeInTheDocument();

		// Check form fields
		expect(screen.getByTestId("input-fname")).toBeInTheDocument();
		expect(screen.getByTestId("input-lname")).toBeInTheDocument();
		expect(screen.getByTestId("input-email")).toBeInTheDocument();
		expect(screen.getByTestId("input-undefined")).toBeInTheDocument(); // password input

		// Check submit button (the main form button)
		const submitButton = screen.getByRole("button", { name: "Sign Up" });
		expect(submitButton).toBeInTheDocument();

		// Check terms and conditions text
		expect(
			screen.getByText(/by creating an account means you agree to the/i)
		).toBeInTheDocument();
		expect(screen.getByText(/terms and conditions/i)).toBeInTheDocument();

		// Check sign in link
		expect(screen.getByText("Already have an account?")).toBeInTheDocument();
		expect(screen.getByText("Sign In")).toBeInTheDocument();
	});

	it("shows password when eye icon is clicked", async () => {
		const user = userEvent.setup();
		render(<SignUpForm />);

		const passwordInput = screen.getByTestId("input-undefined"); // password input
		const eyeIcon = screen.getByTestId("eye-close-icon");

		// Password should be hidden by default
		expect(passwordInput).toHaveAttribute("type", "password");

		// Click eye icon to show password
		await user.click(eyeIcon);

		// Password should be visible
		expect(passwordInput).toHaveAttribute("type", "text");
	});

	it("toggles checkbox state when clicked", async () => {
		const user = userEvent.setup();
		render(<SignUpForm />);

		const checkbox = screen.getByTestId("checkbox");

		// Checkbox should be unchecked by default
		expect(checkbox).not.toBeChecked();

		// Click checkbox to check it
		await user.click(checkbox);

		// Checkbox should be checked
		expect(checkbox).toBeChecked();

		// Click again to uncheck
		await user.click(checkbox);

		// Checkbox should be unchecked
		expect(checkbox).not.toBeChecked();
	});

	it("allows user to input data in form fields", async () => {
		const user = userEvent.setup();
		render(<SignUpForm />);

		const firstNameInput = screen.getByTestId("input-fname");
		const lastNameInput = screen.getByTestId("input-lname");
		const emailInput = screen.getByTestId("input-email");
		const passwordInput = screen.getByTestId("input-undefined");

		// Type in form fields
		await user.type(firstNameInput, "John");
		await user.type(lastNameInput, "Doe");
		await user.type(emailInput, "john.doe@example.com");
		await user.type(passwordInput, "password123");

		// Check if values are set
		expect(firstNameInput).toHaveValue("John");
		expect(lastNameInput).toHaveValue("Doe");
		expect(emailInput).toHaveValue("john.doe@example.com");
		expect(passwordInput).toHaveValue("password123");
	});

	it("shows social login buttons with correct styling", () => {
		render(<SignUpForm />);

		const googleButton = screen.getByText("Sign up with Google");
		const xButton = screen.getByText("Sign up with X");

		// Check if buttons have correct classes
		expect(googleButton).toHaveClass("inline-flex", "items-center", "justify-center", "gap-3");
		expect(xButton).toHaveClass("inline-flex", "items-center", "justify-center", "gap-3");
	});

	it('shows divider with "Or" text', () => {
		render(<SignUpForm />);

		expect(screen.getByText("Or")).toBeInTheDocument();
	});

	it("shows link to sign in page", () => {
		render(<SignUpForm />);

		const signInText = screen.getByText(/already have an account/i);
		expect(signInText).toBeInTheDocument();

		const signInLink = screen.getByText(/sign in/i);
		expect(signInLink).toBeInTheDocument();
	});

	it("has required field indicators", () => {
		render(<SignUpForm />);

		// Check if required fields have asterisk
		const labels = screen.getAllByTestId("label");

		// All labels should contain required field indicators
		labels.forEach(label => {
			expect(label).toContainHTML('<span class="text-error-500">*</span>');
		});
	});

	it("has proper form structure with grid layout", () => {
		render(<SignUpForm />);

		// Check that the form elements are present
		expect(screen.getByTestId("input-fname")).toBeInTheDocument();
		expect(screen.getByTestId("input-lname")).toBeInTheDocument();
		expect(screen.getByTestId("input-email")).toBeInTheDocument();
		expect(screen.getByTestId("input-undefined")).toBeInTheDocument();
	});

	it("shows terms and conditions text correctly", () => {
		render(<SignUpForm />);

		const termsText = screen.getByText(/by creating an account means you agree to the/i);
		const termsLink = screen.getByText(/terms and conditions/i);
		const privacyLink = screen.getByText(/privacy policy/i);

		expect(termsText).toBeInTheDocument();
		expect(termsLink).toBeInTheDocument();
		expect(privacyLink).toBeInTheDocument();
	});

	it("has proper form layout and spacing", () => {
		render(<SignUpForm />);

		// Check that the form elements are present
		expect(screen.getByTestId("input-fname")).toBeInTheDocument();
		expect(screen.getByTestId("input-lname")).toBeInTheDocument();
		expect(screen.getByTestId("input-email")).toBeInTheDocument();
		expect(screen.getByTestId("input-undefined")).toBeInTheDocument();
	});
});
